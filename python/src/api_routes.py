import json
import math
from typing import List, Optional
from collections import defaultdict
import asyncio
import datetime
from datetime import date
import io
import calendar
import os
from uuid import uuid4

from fastapi import APIRouter, Request, HTTPException, status, Query, BackgroundTasks
from fastapi.responses import StreamingResponse, JSONResponse, Response
from pydantic import BaseModel, Field
from openpyxl import Workbook
from openpyxl.utils import get_column_letter
from openpyxl.styles import Font, PatternFill, Border, Side, Alignment

from . import sse_manager
from .sqlite_database import get_db_connection
from .email_service import send_order_confirmation
from .portal_auth import verify_portal_token
from update_employee_email import update_employee_email

router = APIRouter()


def generate_ticket_number(
    order_datetime: datetime.datetime, queue_number: int
) -> str:
    date_part = order_datetime.strftime("%y%m%d")
    queue_part = f"{queue_number:03d}"
    return f"{date_part}-{queue_part}"


def get_whatsapp_number_for_tenant(tenant_name: str) -> Optional[str]:
    mapping = {
        "yanti": "6285880259653",
        "rima": "6285718899709",
    }
    name_lower = tenant_name.lower()
    for key, number in mapping.items():
        if key in name_lower:
            return number
    return None


class EmployeeCreateRequest(BaseModel):
    card_number: str = Field(min_length=1, alias="cardNumber")
    employee_id: str = Field(min_length=1, alias="employeeId")
    name: str = Field(min_length=1)
    employee_group: str = Field(min_length=1, alias="employeeGroup")
    is_disabled: Optional[bool] = Field(False, alias="isDisabled")

    class Config:
        validate_by_name = True


class EmployeeUpdateRequest(BaseModel):
    card_number: Optional[str] = Field(None, alias="cardNumber")
    name: Optional[str] = None
    employee_group: Optional[str] = Field(None, alias="employeeGroup")
    is_disabled: Optional[bool] = Field(None, alias="isDisabled")

    class Config:
        validate_by_name = True


class TenantUpdateRequest(BaseModel):
    name: str
    quota: int
    menu: List[str]
    is_limited: bool = Field(alias="isLimited")

    class Config:
        validate_by_name = True


class TenantCreateRequest(BaseModel):
    name: str
    quota: int
    menu: List[str]
    is_limited: bool = Field(alias="isLimited")

    class Config:
        validate_by_name = True


class DeviceCreateRequest(BaseModel):
    device_code: str = Field(min_length=1, alias="deviceCode")

    class Config:
        validate_by_name = True


class DeviceUpdateRequest(BaseModel):
    tenant_id: Optional[int] = Field(None, alias="tenantId")

    class Config:
        validate_by_name = True


class TransactionCreateRequest(BaseModel):
    employee_id: str = Field(min_length=1, alias="employeeId")
    tenant_id: int = Field(alias="tenantId")
    transaction_date: str = Field(min_length=1, alias="transactionDate")

    class Config:
        validate_by_name = True


class TransactionUpdateRequest(BaseModel):
    employee_id: Optional[str] = Field(None, alias="employeeId")
    tenant_id: Optional[int] = Field(None, alias="tenantId")
    transaction_date: Optional[str] = Field(None, alias="transactionDate")

    class Config:
        validate_by_name = True


class PreorderCreateRequest(BaseModel):
    employee_id: str = Field(min_length=1, alias="employeeId")
    tenant_id: int = Field(alias="tenantId")
    menu_label: str = Field(min_length=1, alias="menuLabel")

    class Config:
        validate_by_name = True


class PortalLoginRequest(BaseModel):
    employee_id: str = Field(min_length=1, alias="employeeId")
    portal_token: str = Field(min_length=1, alias="portalToken")

    class Config:
        validate_by_name = True


@router.post("/auth/portal-login")
def portal_login(request: PortalLoginRequest):
    """
    Entry point for authentication requests coming from the portal.
    Verifies employee_id + portal_token combination before allowing continued flow.
    """
    employee = verify_portal_token(request.employee_id, request.portal_token)
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token portal atau employee_id tidak valid.",
        )
    return {
        "employee_id": employee["employee_id"],
        "name": employee.get("name"),
        "email": employee.get("email"),
    }


@router.post("/transaction", status_code=status.HTTP_201_CREATED)
def create_transaction(transaction_data: TransactionCreateRequest):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:

        cursor.execute(
            "SELECT card_number, name, employee_group FROM employees WHERE employee_id = ?",
            (transaction_data.employee_id,),
        )
        employee = cursor.fetchone()
        if not employee:
            raise HTTPException(
                status_code=404,
                detail=f"Employee with ID '{transaction_data.employee_id}' not found",
            )

        cursor.execute(
            "SELECT name FROM tenants WHERE id = ?", (transaction_data.tenant_id,)
        )
        tenant = cursor.fetchone()
        if not tenant:
            raise HTTPException(
                status_code=404,
                detail=f"Tenant with ID '{transaction_data.tenant_id}' not found",
            )

        employee_card_number = employee["card_number"]
        employee_name = employee["name"]
        employee_group = employee["employee_group"]
        tenant_name = tenant["name"]

        cursor.execute(
            """
            INSERT INTO transactions (card_number, employee_id, employee_name, employee_group, tenant_id, tenant_name, transaction_date)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                employee_card_number,
                transaction_data.employee_id,
                employee_name,
                employee_group,
                transaction_data.tenant_id,
                tenant_name,
                transaction_data.transaction_date,
            ),
        )
        conn.commit()

        sse_payload = {
            "id": str(transaction_data.tenant_id),
            "name": employee_name,
        }
        if sse_manager.main_event_loop:
            asyncio.run_coroutine_threadsafe(
                sse_manager.trigger_sse_event_async(sse_payload),
                sse_manager.main_event_loop,
            )

        return {"message": "Transaction logged successfully."}
    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to log transaction: {e}",
        )
    finally:
        conn.close()


@router.post("/preorder", status_code=status.HTTP_201_CREATED)
def create_preorder(preorder: PreorderCreateRequest, background_tasks: BackgroundTasks):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            """
            SELECT employee_id, card_number, name, is_disabled, is_blocked, email
            FROM employees
            WHERE employee_id = ?
            """,
            (preorder.employee_id,),
        )
        employee = cursor.fetchone()
        if (
            not employee
            or employee["is_disabled"]
            or employee["is_blocked"]
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Pegawai tidak dapat melakukan pre-order.",
                )

        card_number = employee["card_number"] or ""
        employee_email = (employee["email"] or "").strip()
        if not employee_email:
            employee_email = update_employee_email(preorder.employee_id)
            if not employee_email:
                print(
                    f"Peringatan: email untuk employee_id {preorder.employee_id} tidak ditemukan di DB maupun dummy mapping."
                )

        cursor.execute(
            "SELECT id, name, quota, is_limited FROM tenants WHERE id = ?",
            (preorder.tenant_id,),
        )
        tenant = cursor.fetchone()
        if not tenant:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Tenant dengan ID '{preorder.tenant_id}' tidak ditemukan.",
            )

        today = date.today().isoformat()
        cursor.execute(
            """
            SELECT 1
            FROM preorders
            WHERE employee_id = ?
              AND order_date = ?
            LIMIT 1
            """,
            (preorder.employee_id, today),
        )
        if cursor.fetchone():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Anda sudah melakukan pre-order hari ini. Hanya satu order per hari yang diperbolehkan.",
            )

        cursor.execute(
            """
            SELECT COUNT(*)
            FROM preorders
            WHERE tenant_id = ?
              AND order_date = ?
            """,
            (preorder.tenant_id, today),
        )
        order_count_today = cursor.fetchone()[0] + 1

        quota_value = tenant["quota"] or 0
        if quota_value > 0:
            queue_number = max(quota_value - order_count_today + 1, 0)
        else:
            queue_number = order_count_today

        remaining_quota: Optional[int] = None
        if quota_value > 0:
            remaining_quota = max(quota_value - order_count_today, 0)

        order_code = uuid4().hex
        order_datetime = datetime.datetime.now()
        ticket_number = generate_ticket_number(order_datetime, queue_number)
        weekday_names = [
            "Senin",
            "Selasa",
            "Rabu",
            "Kamis",
            "Jumat",
            "Sabtu",
            "Minggu",
        ]
        weekday_name = weekday_names[order_datetime.weekday()]
        order_datetime_text = f"{weekday_name} {order_datetime.strftime('%d/%m/%Y, %H.%M')}"
        cursor.execute(
            """
            INSERT INTO preorders (
                order_code,
                ticket_number,
                employee_id,
                card_number,
                employee_name,
                tenant_id,
                tenant_name,
                menu_label,
                order_date,
                status,
                queue_number
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?)
            """,
            (
                order_code,
                ticket_number,
                preorder.employee_id,
                card_number,
                employee["name"],
                tenant["id"],
                tenant["name"],
                preorder.menu_label,
                today,
                queue_number,
            ),
        )
        conn.commit()

        order_payload = {
            "ticket_number": ticket_number,
            "order_code": order_code,
            "employee_id": preorder.employee_id,
            "employee_name": employee["name"],
            "tenant_name": tenant["name"],
            "order_datetime_text": order_datetime_text,
            "order_date": today,
            "menu_label": preorder.menu_label,
            "menu_items": [{"label": preorder.menu_label, "qty": 1}],
            "queue_number": queue_number,
        }
        if employee_email:
            background_tasks.add_task(
                send_order_confirmation,
                employee_email,
                order_payload,
                recipient="employee",
            )
        canteen_email = os.getenv("CANTEEN_ORDER_EMAIL")
        if canteen_email:
            background_tasks.add_task(
                send_order_confirmation,
                canteen_email,
                order_payload,
                recipient="canteen",
            )

        return JSONResponse(
            content={
                "orderCode": ticket_number,
                "orderHash": order_code,
                "employeeId": preorder.employee_id,
                "employeeName": employee["name"],
                "tenantId": tenant["id"],
                "tenantName": tenant["name"],
                "menuLabel": preorder.menu_label,
                "orderDate": today,
                "queueNumber": queue_number,
                "remainingQuota": remaining_quota,
            }
        )
    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gagal membuat pre-order: {e}",
        )
    finally:
        conn.close()


# DEPRECATED: Endpoint admin sekali-jalan untuk mengirim token karyawan via email.
# Flow generate_tokens / broadcast_employee_tokens tidak lagi dipakai oleh autentikasi utama.
@router.post("/admin/send-employee-tokens", status_code=status.HTTP_410_GONE)
def send_employee_tokens():
    raise HTTPException(
        status_code=status.HTTP_410_GONE,
        detail="DEPRECATED: Token email tidak lagi digunakan dalam alur Cawang Canteen.",
    )


@router.get("/transaction/check_duplicate", status_code=status.HTTP_200_OK)
async def check_duplicate_transaction(
    card_number: str = Query(..., alias="cardNumber"),
    transaction_date: str = Query(..., alias="transactionDate"),
):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "SELECT 1 FROM transactions WHERE card_number = ? AND DATE(transaction_date) = ?",
            (card_number, transaction_date),
        )
        exists = cursor.fetchone() is not None
        return {"exists": exists}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to check duplicate transaction: {e}",
        )
    finally:
        conn.close()


@router.get("/transaction/daily_count", status_code=status.HTTP_200_OK)
async def get_daily_transaction_count(
    tenant_id: int = Query(..., alias="tenantId"),
    transaction_date: str = Query(..., alias="transactionDate"),
):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "SELECT COUNT(*) FROM transactions WHERE tenant_id = ? AND DATE(transaction_date) = ?",
            (tenant_id, transaction_date),
        )
        count = cursor.fetchone()[0]
        return {"count": count}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get daily transaction count: {e}",
        )
    finally:
        conn.close()


@router.get("/transaction/{transaction_id}/detail", status_code=status.HTTP_200_OK)
def get_transaction(transaction_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT * FROM transactions WHERE id = ?", (transaction_id,))
        transaction = cursor.fetchone()
        if not transaction:
            raise HTTPException(status_code=404, detail="Transaction not found")
        return JSONResponse(content=dict(transaction))
    finally:
        conn.close()


@router.put("/transaction/{transaction_id}/update", status_code=status.HTTP_200_OK)
def update_transaction(transaction_id: int, transaction_data: TransactionUpdateRequest):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        update_data_dict = transaction_data.dict(by_alias=True, exclude_unset=True)
        if not update_data_dict:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update"
            )

        update_fields = {}

        if "employeeId" in update_data_dict:
            employee_id = update_data_dict["employeeId"]
            cursor.execute(
                "SELECT card_number, name, employee_group FROM employees WHERE employee_id = ?",
                (employee_id,),
            )
            employee = cursor.fetchone()
            if not employee:
                raise HTTPException(
                    status_code=404,
                    detail=f"Employee with ID '{employee_id}' not found",
                )
            update_fields["employee_id"] = employee_id
            update_fields["card_number"] = employee["card_number"]
            update_fields["employee_name"] = employee["name"]
            update_fields["employee_group"] = employee["employee_group"]

        if "tenantId" in update_data_dict:
            tenant_id = update_data_dict["tenantId"]
            cursor.execute("SELECT name FROM tenants WHERE id = ?", (tenant_id,))
            tenant = cursor.fetchone()
            if not tenant:
                raise HTTPException(
                    status_code=404,
                    detail=f"Tenant with ID '{tenant_id}' not found",
                )
            update_fields["tenant_id"] = tenant_id
            update_fields["tenant_name"] = tenant["name"]

        if "transactionDate" in update_data_dict:
            update_fields["transaction_date"] = update_data_dict["transactionDate"]

        if not update_fields:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No valid fields to update",
            )

        set_clause = ", ".join([f"{key} = ?" for key in update_fields.keys()])
        query = f"UPDATE transactions SET {set_clause} WHERE id = ?"
        params = list(update_fields.values()) + [transaction_id]

        cursor.execute(query, tuple(params))
        conn.commit()

        return {"message": "Transaction updated successfully."}
    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update transaction: {e}",
        )
    finally:
        conn.close()


@router.delete("/transaction/{transaction_id}/delete", status_code=status.HTTP_200_OK)
def delete_transaction(transaction_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("DELETE FROM transactions WHERE id = ?", (transaction_id,))
        conn.commit()
        return {"message": "Transaction deleted successfully."}
    except Exception as e:
        conn.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete transaction: {e}",
        )
    finally:
        conn.close()


@router.delete("/device/all", status_code=status.HTTP_200_OK)
async def delete_all_devices():
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("DELETE FROM devices")
        conn.commit()
        return {"message": "All devices deleted successfully."}
    except Exception as e:
        conn.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete all devices: {e}",
        )
    finally:
        conn.close()


@router.post("/device/setup", status_code=status.HTTP_200_OK)
async def setup_devices_table():
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS devices (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                device_code TEXT NOT NULL UNIQUE,
                tenant_id INTEGER,
                FOREIGN KEY (tenant_id) REFERENCES tenants (id)
            );
        """
        )
        conn.commit()
        return {"message": "Devices table ensured to exist."}
    except Exception as e:
        conn.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to setup devices table: {e}",
        )
    finally:
        conn.close()


@router.get("/device/check/{device_code}", status_code=status.HTTP_200_OK)
async def check_device_exists(device_code: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT 1 FROM devices WHERE device_code = ?", (device_code,))
        exists = cursor.fetchone() is not None
        return {"exists": exists}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to check device existence: {e}",
        )
    finally:
        conn.close()


@router.post("/device", status_code=status.HTTP_201_CREATED)
async def register_new_device(device_data: DeviceCreateRequest):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "SELECT 1 FROM devices WHERE device_code = ?", (device_data.device_code,)
        )
        if cursor.fetchone():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Device '{device_data.device_code}' already registered.",
            )

        cursor.execute(
            "INSERT INTO devices (device_code) VALUES (?)", (device_data.device_code,)
        )
        conn.commit()
        return {
            "message": f"Device '{device_data.device_code}' registered successfully."
        }
    except HTTPException as http_exc:
        raise http_exc
    except Exception as e:
        conn.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to register device: {e}",
        )
    finally:
        conn.close()


@router.get("/sse")
async def sse_endpoint(request: Request):
    return StreamingResponse(
        sse_manager.event_stream(request), media_type="text/event-stream"
    )


@router.get("/employee")
async def get_employees():
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT * FROM employees ORDER BY name")
        employees = [dict(row) for row in cursor.fetchall()]
        return JSONResponse(content=employees)
    finally:
        conn.close()


@router.get("/tenant")
async def get_tenants():
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT * FROM tenants ORDER BY name")
        tenants_list = [dict(row) for row in cursor.fetchall()]

        for tenant in tenants_list:
            cursor.execute(
                "SELECT menu FROM tenant_menu WHERE tenant_id = ?", (tenant["id"],)
            )
            menus = cursor.fetchall()
            tenant["menu"] = [row["menu"] for row in menus]

        return JSONResponse(content=tenants_list)
    finally:
        conn.close()


@router.get("/device")
async def get_devices():
    conn = get_db_connection()
    cursor = conn.cursor()
    try:

        cursor.execute(
            """
            SELECT
                d.device_code,
                t.id AS tenant_id,
                t.name AS tenant_name
            FROM devices d
            LEFT JOIN tenants t ON d.tenant_id = t.id
            ORDER BY d.device_code
        """
        )

        devices = []
        for row in cursor.fetchall():
            tenant_info = None
            if row["tenant_id"]:
                tenant_info = {"id": row["tenant_id"], "name": row["tenant_name"]}
            devices.append({"device_code": row["device_code"], "tenant": tenant_info})

        return JSONResponse(content=devices)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch devices: {e}",
        )
    finally:
        if conn:
            conn.close()


@router.get("/dashboard/overview", status_code=status.HTTP_200_OK)
def get_dashboard_overview():
    """
    Provides a dashboard overview of all devices with assigned tenants,
    including tenant details, menu, and today's transaction count.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        today = datetime.date.today().isoformat()

        query = """
            SELECT
                d.device_code,
                t.id AS tenant_id,
                t.name AS tenant_name,
                COALESCE(t.quota, 0) AS quota
            FROM
                devices d
            JOIN
                tenants t ON d.tenant_id = t.id
            WHERE
                d.tenant_id IS NOT NULL
            ORDER BY
                d.tenant_id
        """
        cursor.execute(query)

        devices_with_tenants = cursor.fetchall()

        result = []
        tenant_ids = list(set(row["tenant_id"] for row in devices_with_tenants))

        all_menus = {}
        if tenant_ids:
            placeholders = ",".join("?" for _ in tenant_ids)
            menu_query = f"SELECT tenant_id, menu FROM tenant_menu WHERE tenant_id IN ({placeholders})"
            cursor.execute(menu_query, tenant_ids)

            for menu_row in cursor.fetchall():
                tid = menu_row["tenant_id"]
                if tid not in all_menus:
                    all_menus[tid] = []
                all_menus[tid].append(menu_row["menu"])

        for row in devices_with_tenants:
            tenant_id = row["tenant_id"]

            cursor.execute(
                """
                SELECT COALESCE(COUNT(*), 0) AS ordered_count
                FROM preorders
                WHERE tenant_id = ?
                  AND DATE(order_date) = DATE('now','localtime')
                """,
                (tenant_id,),
            )
            ordered_row = cursor.fetchone()
            ordered = int(ordered_row["ordered_count"]) if ordered_row else 0

            cursor.execute(
                """
                SELECT
                    p.queue_number,
                    p.menu_label,
                    e.name AS employee_name,
                    e.employee_id
                FROM preorders p
                LEFT JOIN employees e ON e.employee_id = p.employee_id
                WHERE p.tenant_id = ?
                  AND DATE(p.order_date) = DATE('now','localtime')
                ORDER BY p.order_date DESC, p.id DESC
                LIMIT 1
                """,
                (tenant_id,),
            )
            last_order_row = cursor.fetchone()
            last_order = None
            if last_order_row:
                last_order = {
                    "queueNumber": last_order_row["queue_number"],
                    "menuLabel": last_order_row["menu_label"],
                    "employeeName": last_order_row["employee_name"],
                    "employeeId": last_order_row["employee_id"],
                }

            quota_value = int(row["quota"] or 0)
            available = quota_value

            device_info = {
                "device_code": row["device_code"],
                "tenantId": tenant_id,
                "tenantName": row["tenant_name"],
                "available": available,
                "ordered": ordered,
                "lastOrder": last_order,
                "tenant": {
                    "id": tenant_id,
                    "name": row["tenant_name"],
                    "menu": all_menus.get(tenant_id, []),
                    "quota": quota_value,
                    "ordered": ordered,
                    "available": available,
                    "lastOrder": last_order,
                },
            }
            result.append(device_info)

        return JSONResponse(content=result)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch dashboard overview: {e}",
        )
    finally:
        if conn:
            conn.close()


@router.get("/device/assigned")
async def get_assigned_devices_with_menu():
    """
    Returns a list of all devices that have an assigned tenant,
    including the tenant's full details and menu.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            """
            SELECT
                d.device_code,
                t.id AS tenant_id,
                t.name AS tenant_name,
                t.quota,
                t.is_limited,
                tm.menu
            FROM
                devices d
            INNER JOIN
                tenants t ON d.tenant_id = t.id
            LEFT JOIN
                tenant_menu tm ON t.id = tm.tenant_id
            WHERE
                d.tenant_id IS NOT NULL
            ORDER BY
                d.device_code, t.id
        """
        )

        assigned_devices = {}
        for row in cursor.fetchall():
            device_code = row["device_code"]

            if device_code not in assigned_devices:
                assigned_devices[device_code] = {
                    "device_code": device_code,
                    "tenant": {
                        "id": row["tenant_id"],
                        "name": row["tenant_name"],
                        "quota": row["quota"],
                        "is_limited": row["is_limited"],
                        "menu": [],
                    },
                }

            if row["menu"] is not None:
                assigned_devices[device_code]["tenant"]["menu"].append(row["menu"])

        return JSONResponse(content=list(assigned_devices.values()))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch assigned devices: {e}",
        )
    finally:
        if conn:
            conn.close()


@router.put("/device/{device_code}")
async def update_device_tenant(device_code: str, update_data: DeviceUpdateRequest):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "UPDATE devices SET tenant_id = ? WHERE device_code = ?",
            (update_data.tenant_id, device_code),
        )
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update device: {e}",
        )
    finally:
        conn.close()

    return JSONResponse(
        content={"message": f"Device '{device_code}' updated successfully."},
        status_code=status.HTTP_200_OK,
    )


@router.post("/tenant", status_code=status.HTTP_201_CREATED)
async def create_tenant(create_data: TenantCreateRequest):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "INSERT INTO tenants (name, quota, is_limited) VALUES (?, ?, ?)",
            (
                create_data.name,
                create_data.quota,
                create_data.is_limited,
            ),
        )
        new_tenant_id = cursor.lastrowid

        if create_data.menu:
            menu_items = [(new_tenant_id, item) for item in create_data.menu]
            cursor.executemany(
                "INSERT INTO tenant_menu (tenant_id, menu) VALUES (?, ?)", menu_items
            )
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()
    return {"message": "Tenant created successfully", "tenantId": new_tenant_id}


@router.put("/tenant/{tenant_id}/update")
async def update_tenant(tenant_id: int, update_data: TenantUpdateRequest):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "UPDATE tenants SET name = ?, quota = ?, is_limited = ? WHERE id = ?",
            (update_data.name, update_data.quota, update_data.is_limited, tenant_id),
        )

        cursor.execute("DELETE FROM tenant_menu WHERE tenant_id = ?", (tenant_id,))

        if update_data.menu:
            menu_items = [(tenant_id, item) for item in update_data.menu]
            cursor.executemany(
                "INSERT INTO tenant_menu (tenant_id, menu) VALUES (?, ?)", menu_items
            )

        conn.commit()
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()
    return {"message": "Tenant updated successfully"}


@router.get("/tenant/{tenant_id}/detail")
async def get_tenant(tenant_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM tenants WHERE id = ?", (tenant_id,))
    tenant = cursor.fetchone()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    tenant_dict = dict(tenant)

    cursor.execute("SELECT menu FROM tenant_menu WHERE tenant_id = ?", (tenant_id,))
    menus = cursor.fetchall()
    tenant_dict["menu"] = [row["menu"] for row in menus]

    conn.close()
    return tenant_dict


@router.delete("/tenant/{tenant_id}/delete", status_code=status.HTTP_200_OK)
async def delete_tenant(tenant_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "UPDATE devices SET tenant_id = NULL WHERE tenant_id = ?", (tenant_id,)
        )
        cursor.execute("DELETE FROM tenant_menu WHERE tenant_id = ?", (tenant_id,))
        cursor.execute("DELETE FROM tenants WHERE id = ?", (tenant_id,))
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()
    return {"message": f"Tenant with id '{tenant_id}' deleted successfully."}


@router.post("/employee", status_code=status.HTTP_201_CREATED)
async def create_employee(create_data: EmployeeCreateRequest):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "SELECT * FROM employees WHERE employee_id = ? OR card_number = ?",
            (create_data.employee_id, create_data.card_number),
        )
        if cursor.fetchone():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Employee with ID '{create_data.employee_id}' or card number '{create_data.card_number}' already exists.",
            )

        cursor.execute(
            """
            INSERT INTO employees (employee_id, card_number, name, employee_group, admin, is_disabled)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                create_data.employee_id,
                create_data.card_number,
                create_data.name,
                create_data.employee_group,
                False,
                create_data.is_disabled,
            ),
        )
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create employee: {e}",
        )
    finally:
        conn.close()

    return JSONResponse(
        content={
            "message": f"Employee with ID '{create_data.employee_id}' created successfully."
        },
        status_code=status.HTTP_201_CREATED,
    )


@router.get("/employee/{employee_id}/detail")
async def get_employee(employee_id: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM employees WHERE employee_id = ?", (employee_id,))
    employee = cursor.fetchone()
    conn.close()
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Employee with ID '{employee_id}' not found.",
        )
    return JSONResponse(content=dict(employee))


@router.put("/employee/{employee_id}/update")
async def update_employee(employee_id: str, update_data: EmployeeUpdateRequest):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT * FROM employees WHERE employee_id = ?", (employee_id,))
        if not cursor.fetchone():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Employee with ID '{employee_id}' not found.",
            )

        update_fields = {k: v for k, v in update_data.dict(exclude_unset=True).items()}
        if not update_fields:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update"
            )

        set_clause = ", ".join([f"{key} = ?" for key in update_fields.keys()])
        query = f"UPDATE employees SET {set_clause} WHERE employee_id = ?"
        params = list(update_fields.values()) + [employee_id]

        cursor.execute(query, tuple(params))
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update employee: {e}",
        )
    finally:
        conn.close()

    return JSONResponse(
        content={"message": f"Employee with ID '{employee_id}' updated successfully."},
        status_code=status.HTTP_200_OK,
    )


@router.delete("/employee/{employee_id}/delete", status_code=status.HTTP_200_OK)
async def delete_employee(employee_id: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT * FROM employees WHERE employee_id = ?", (employee_id,))
        if not cursor.fetchone():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Employee with ID '{employee_id}' not found.",
            )

        cursor.execute("DELETE FROM employees WHERE employee_id = ?", (employee_id,))
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete employee: {e}",
        )
    finally:
        conn.close()

    return {"message": f"Employee with ID '{employee_id}' deleted successfully."}


@router.get("/transaction/report")
async def get_transaction_reports(
    search: Optional[str] = Query(
        None,
        description="Search by employee name, tenant name, or card number (case-insensitive, partial match)",
    ),
    employee_group: Optional[str] = Query(
        None,
        description="Filter by employee group (case-insensitive, partial match)",
    ),
    employee: Optional[str] = Query(
        None,
        description="Filter by employee name or employee ID (case-insensitive, partial match)",
    ),
    tenant: Optional[str] = Query(
        None,
        description="Filter by tenant name (case-insensitive, partial match)",
    ),
    start_date: Optional[str] = Query(
        None, description="Start date for period filter (YYYY-MM-DD)"
    ),
    end_date: Optional[str] = Query(
        None, description="End date for period filter (YYYY-MM-DD)"
    ),
    page: int = Query(1, ge=1, description="Page number for pagination"),
    page_size: int = Query(10, ge=1, le=100, description="Number of items per page"),
):
    conn = get_db_connection()
    try:
        cursor = conn.cursor()

        query_params = []
        where_clauses = []

        if search:
            where_clauses.append(
                "(LOWER(employee_name) LIKE ? OR LOWER(tenant_name) LIKE ? OR card_number LIKE ?)"
            )
            query_params.extend(
                [f"%{search.lower()}%", f"%{search.lower()}%", f"%{search}%"]
            )
        if employee_group:
            where_clauses.append("(LOWER(employee_group) LIKE ?)")
            query_params.append(f"%{employee_group.lower()}%")
        if employee:
            where_clauses.append("(employee_id LIKE ? OR LOWER(employee_name) LIKE ?)")
            query_params.append(f"%{employee.lower()}%")
            query_params.append(f"%{employee.lower()}%")
        if tenant:
            where_clauses.append("(LOWER(tenant_name) LIKE ?)")
            query_params.append(f"%{tenant.lower()}%")
        if start_date:
            where_clauses.append("transaction_date >= ?")
            query_params.append(start_date)
        if end_date:
            where_clauses.append("transaction_date <= ?")
            query_params.append(end_date)

        where_sql = ""
        if where_clauses:
            where_sql = "WHERE " + " AND ".join(where_clauses)

        count_query = f"SELECT COUNT(*) FROM transactions {where_sql}"
        cursor.execute(count_query, tuple(query_params))
        total_items = cursor.fetchone()[0]
        total_pages = math.ceil(total_items / page_size) if total_items > 0 else 0

        offset = (page - 1) * page_size
        data_query = f"""
            SELECT id, card_number, employee_id, employee_name, employee_group, tenant_id, tenant_name, transaction_date
            FROM transactions
            {where_sql}
            ORDER BY transaction_date DESC
            LIMIT ? OFFSET ?
        """

        paginated_params = query_params + [page_size, offset]
        cursor.execute(data_query, tuple(paginated_params))

        columns = [column[0] for column in cursor.description]
        transactions = [dict(zip(columns, row)) for row in cursor.fetchall()]

        return {
            "data": transactions,
            "pagination": {
                "page": page,
                "page_size": page_size,
                "total_items": total_items,
                "total_pages": total_pages,
            },
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred while fetching transaction reports: {e}",
        )
    finally:
        if conn:
            conn.close()


@router.get("/transaction/export")
async def export_transactions_to_excel(
    date: str = Query(
        datetime.date.today().isoformat(),
        description="Date for the export (YYYY-MM-DD)",
    ),
    employee_group: Optional[str] = Query(
        None,
        description="Filter by employee group (case-insensitive, partial match)",
    ),
):
    conn = get_db_connection()
    try:
        employee_group = employee_group.split()
        cursor = conn.cursor()

        query_transactions = """
            SELECT id, card_number, employee_id, employee_name, employee_group, tenant_id, tenant_name, transaction_date
            FROM transactions
            WHERE DATE(transaction_date) = ?
        """
        params_transactions = [date]
        if employee_group:
            query_transactions += " AND "
            for group in employee_group:
                query_transactions += " employee_group LIKE ? OR"
                params_transactions.append(f"%{group}%")    
            query_transactions = query_transactions[:-2]

        query_transactions += " ORDER BY transaction_date DESC"
        
        cursor.execute(query_transactions, tuple(params_transactions))

        transactions = [dict(row) for row in cursor.fetchall()]

        query_employee = "SELECT employee_id, name, employee_group FROM employees"
        params_employee = []
        if employee_group:
            query_employee += " WHERE "
            for group in employee_group:
                query_employee += " employee_group LIKE ? OR"
                params_employee.append(f"%{group}%")
            query_employee = query_employee[:-2]
            
        query_employee += " ORDER BY name"
        
        cursor.execute(query_employee, tuple(params_employee))
        
        employees = [dict(row) for row in cursor.fetchall()]

        wb = Workbook()
        sheet = wb.active
        sheet.title = "Transactions"

        header_row_num = 3
        headers = [
            "No",
            "Employee ID",
            "Employee Name",
            "Employee Group",
            "Tenant Name",
            "Eat",
            "Transaction Date",
        ]
        for col_num, header_title in enumerate(headers, 1):
            cell = sheet.cell(row=header_row_num, column=col_num, value=header_title)
            cell.font = Font(bold=True)
            cell.fill = PatternFill(
                start_color="D3D3D3", end_color="D3D3D3", fill_type="solid"
            )
            cell.alignment = Alignment(horizontal="center", vertical="center")

        current_row = 4
        no = 1
        for employee in employees:
            transaction = next(
                (
                    t
                    for t in transactions
                    if t["employee_id"] == employee["employee_id"]
                ),
                None,
            )

            sheet.cell(row=current_row, column=1, value=no)
            sheet.cell(row=current_row, column=2, value=employee["employee_id"])
            sheet.cell(row=current_row, column=3, value=employee["name"])
            sheet.cell(row=current_row, column=4, value=employee["employee_group"])

            formatted_date = datetime.datetime.strptime(date, "%Y-%m-%d").strftime(
                "%d-%m-%Y"
            )
            if transaction:
                sheet.cell(row=current_row, column=5, value=transaction["tenant_name"])
                sheet.cell(row=current_row, column=6, value=1)
                sheet.cell(row=current_row, column=7, value=formatted_date)
            else:
                sheet.cell(row=current_row, column=5, value="")
                sheet.cell(row=current_row, column=6, value=0)
                sheet.cell(row=current_row, column=7, value=formatted_date)

            no += 1
            current_row += 1

        employee_ids_set = {e["employee_id"] for e in employees}
        orphan_transactions = [
            t for t in transactions if t["employee_id"] not in employee_ids_set
        ]

        red_fill = PatternFill(
            start_color="FFFF0000", end_color="FFFF0000", fill_type="solid"
        )

        for transaction in orphan_transactions:
            sheet.cell(row=current_row, column=1, value=no)
            sheet.cell(row=current_row, column=2, value=transaction["employee_id"])
            sheet.cell(
                row=current_row, column=3, value=transaction.get("employee_name", "N/A")
            )
            sheet.cell(
                row=current_row,
                column=4,
                value=transaction.get("employee_group", "N/A"),
            )
            sheet.cell(row=current_row, column=5, value=transaction["tenant_name"])
            sheet.cell(row=current_row, column=6, value=1)
            sheet.cell(row=current_row, column=7, value=date)

            for col in range(1, 8):
                sheet.cell(row=current_row, column=col).fill = red_fill
            no += 1
            current_row += 1

        thin_border = Border(
            left=Side(style="thin"),
            right=Side(style="thin"),
            top=Side(style="thin"),
            bottom=Side(style="thin"),
        )

        for r in sheet.iter_rows(
            min_row=header_row_num, max_row=current_row - 1, min_col=1, max_col=7
        ):
            for cell in r:
                cell.border = thin_border

        sheet.column_dimensions["B"].width = 15
        sheet.column_dimensions["C"].width = 33.57
        sheet.column_dimensions["D"].width = 15.28
        sheet.column_dimensions["E"].width = 12.14
        sheet.column_dimensions["F"].width = 5
        sheet.column_dimensions["G"].width = 15

        for col_letter in ["A", "B", "D", "F", "G"]:
            for cell in sheet[col_letter]:
                cell.alignment = Alignment(horizontal="center", vertical="center")

        virtual_workbook = io.BytesIO()
        wb.save(virtual_workbook)
        virtual_workbook.seek(0)

        return Response(
            content=virtual_workbook.read(),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": f"attachment; filename=transactions-{formatted_date}.xlsx"
            },
        )
    except Exception as e:
        print(f"Error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred while exporting transaction reports: {e}",
        )
    finally:
        if conn:
            conn.close()


@router.get("/transaction/export/monthly")
async def export_transactions_to_excel(
    date: str = Query(
        datetime.date.today(),
        description="Date for the export (YYYY-MM)",
    ),
    employee_group: Optional[str] = Query(
        None,
        description="Filter by employee group (case-insensitive, partial match)",
    ),
):
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        date = date.split("-")
        if len(date) >= 2:
            date = date[0] + "-" + date[1]

        employee_group = employee_group.split()

        query_transactions = (
            "SELECT * FROM transactions WHERE strftime('%Y-%m', transaction_date) = ?"
        )
        params_transactions = [date]
        if employee_group:
            query_transactions += " AND "
        for group in employee_group:
            query_transactions += " employee_group LIKE ? OR"
            params_transactions.append(f"%{group}%")
        if employee_group:
            query_transactions = query_transactions[:-2]

        cursor.execute(query_transactions, tuple(params_transactions))

        transactions = [dict(row) for row in cursor.fetchall()]

        query_employees = "SELECT * FROM employees"
        params_employees = []
        if employee_group:
            query_employees += " WHERE "
        for group in employee_group:
            query_employees += " employee_group LIKE ? OR"
            params_employees.append(f"%{group}%")
        if employee_group:
            query_employees = query_employees[:-2]
        query_employees += " ORDER BY name"
        cursor.execute(query_employees, tuple(params_employees))
        employees = [dict(row) for row in cursor.fetchall()]
        employee_data = {}
        for emp in employees:
            employee_data[emp["employee_id"]] = {
                "details": emp,
                "eats_by_day": defaultdict(str),
            }

        for t in transactions:
            emp_id = t["employee_id"]
            if emp_id in employee_data:
                day = datetime.datetime.fromisoformat(t["transaction_date"]).day
                employee_data[emp_id]["eats_by_day"][day] = t["tenant_name"]

        wb = Workbook()
        sheet = wb.active
        sheet.title = f"Transactions {date}"

        year, month = map(int, date.split("-"))
        _, num_days = calendar.monthrange(year, month)

        header_row_num = 3
        static_headers = ["No", "Employee ID", "Employee Name", "Employee Group"]
        date_headers = [str(day) for day in range(1, num_days + 1)]
        all_headers = static_headers + date_headers

        for col_num, header_title in enumerate(all_headers, 1):
            cell = sheet.cell(row=header_row_num, column=col_num, value=header_title)
            cell.font = Font(bold=True)
            cell.fill = PatternFill(
                start_color="D3D3D3", end_color="D3D3D3", fill_type="solid"
            )
            cell.alignment = Alignment(horizontal="center", vertical="center")

        current_row = 4
        no = 1
        for emp in employees:
            emp_id = emp["employee_id"]
            data = employee_data[emp_id]

            sheet.cell(row=current_row, column=1, value=no)
            sheet.cell(row=current_row, column=2, value=data["details"]["employee_id"])
            sheet.cell(row=current_row, column=3, value=data["details"]["name"])
            sheet.cell(
                row=current_row, column=4, value=data["details"]["employee_group"]
            )

            for day in range(1, num_days + 1):
                eat_value = data["eats_by_day"].get(day, '')
                sheet.cell(
                    row=current_row, column=len(static_headers) + day, value=eat_value
                )

            current_row += 1
            no += 1

        employee_ids_set = {e["employee_id"] for e in employees}
        orphan_transactions = [
            t for t in transactions if t["employee_id"] not in employee_ids_set
        ]

        orphan_data = {}
        for t in orphan_transactions:
            emp_id = t["employee_id"]
            if emp_id not in orphan_data:
                orphan_data[emp_id] = {
                    "details": t,
                    "eats_by_day": defaultdict(str),
                }
            day = datetime.datetime.fromisoformat(t["transaction_date"]).day
            orphan_data[emp_id]["eats_by_day"][day] = t["tenant_name"]

        red_fill = PatternFill(
            start_color="FFFF0000", end_color="FFFF0000", fill_type="solid"
        )

        for emp_id, data in orphan_data.items():

            sheet.cell(row=current_row, column=1, value=no)
            sheet.cell(row=current_row, column=2, value=emp_id)
            sheet.cell(
                row=current_row,
                column=3,
                value=data["details"].get("employee_name", "N/A"),
            )
            sheet.cell(
                row=current_row,
                column=4,
                value=data["details"].get("employee_group", "N/A"),
            )

            for day in range(1, num_days + 1):
                eat_value = data["eats_by_day"].get(day, 0)
                sheet.cell(
                    row=current_row, column=len(static_headers) + day, value=eat_value
                )

            for col in range(1, len(all_headers) + 1):
                sheet.cell(row=current_row, column=col).fill = red_fill

            current_row += 1
            no += 1

        thin_border = Border(
            left=Side(style="thin"),
            right=Side(style="thin"),
            top=Side(style="thin"),
            bottom=Side(style="thin"),
        )
        for r in sheet.iter_rows(
            min_row=header_row_num,
            max_row=current_row - 1,
            min_col=1,
            max_col=len(all_headers),
        ):
            for cell in r:
                cell.border = thin_border

        sheet.column_dimensions["B"].width = 15
        sheet.column_dimensions["C"].width = 33.57
        sheet.column_dimensions["D"].width = 15.28

        for i in range(len(static_headers) + 1, len(all_headers) + 1):
            col_letter = get_column_letter(i)
            sheet.column_dimensions[col_letter].width = 4
        virtual_workbook = io.BytesIO()
        wb.save(virtual_workbook)
        virtual_workbook.seek(0)

        return Response(
            content=virtual_workbook.read(),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": f"attachment; filename=transactions-{date}.xlsx"
            },
        )
    except Exception as e:
        print(f"Error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred while exporting transaction reports: {e}",
        )
    finally:
        if conn:
            conn.close()
            
