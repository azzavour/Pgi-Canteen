import datetime
from typing import Dict, Any


def evaluate_tenant_quota_for_today(conn, target_tenant_id: int) -> Dict[str, Any]:
    """
    Hitung remaining kuota untuk seluruh tenant dan tentukan apakah tenant target
    diperbolehkan menerima order saat ini.
    """
    today = datetime.date.today().isoformat()
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT
            t.id,
            t.quota,
            COALESCE(tx.order_count, 0) AS order_count
        FROM tenants t
        LEFT JOIN (
            SELECT tenant_id, COUNT(*) AS order_count
            FROM transactions
            WHERE DATE(transaction_date) = ?
            GROUP BY tenant_id
        ) tx ON tx.tenant_id = t.id
        """,
        (today,),
    )
    rows = cursor.fetchall()
    if not rows:
        raise ValueError("Data tenant tidak ditemukan.")

    tenant_map = {row["id"]: row for row in rows}
    target_row = tenant_map.get(target_tenant_id)
    if not target_row:
        raise ValueError(f"Tenant dengan ID {target_tenant_id} tidak ditemukan.")

    limited_rows = [
        row for row in tenant_map.values() if (row["quota"] or 0) > 0
    ]

    if limited_rows:
        remaining_map = {
            row["id"]: int((row["quota"] or 0) - row["order_count"])
            for row in limited_rows
        }
        max_remaining_any = max(remaining_map.values())
    else:
        remaining_map = {}
        max_remaining_any = 0

    target_quota_value = target_row["quota"]
    target_is_limited = (target_quota_value or 0) > 0
    target_remaining = (
        int((target_quota_value or 0) - target_row["order_count"])
        if target_is_limited
        else None
    )

    if not limited_rows or not target_is_limited:
        can_order = True
    elif max_remaining_any <= 0:
        can_order = True
    else:
        can_order = target_remaining is not None and target_remaining > 0

    is_free_mode = bool(limited_rows) and max_remaining_any <= 0

    return {
        "tenant_id": target_tenant_id,
        "target_quota": target_quota_value,
        "target_is_limited": target_is_limited,
        "remaining_for_target": target_remaining,
        "max_remaining_any": max_remaining_any,
        "can_order_for_target": can_order,
        "is_free_mode": is_free_mode,
    }
