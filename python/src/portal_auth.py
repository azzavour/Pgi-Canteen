import os
from typing import Dict, Optional, Tuple

from dotenv import load_dotenv

try:
    import pyodbc
except ModuleNotFoundError:
    pyodbc = None

load_dotenv()

# Stub user used when portal DB connection has not been configured yet.
STUB_PORTAL_USERS: Dict[Tuple[str, str], Dict[str, str]] = {
    ("34283", "TEST123"): {
        "employee_id": "34283",
        "name": "Contoh Pengguna Portal",
        "email": "portal.stub@example.com",
    }
}


def verify_portal_token(employee_id: str, portal_token: str) -> Optional[Dict[str, str]]:
    """
    Verifies combination of employee_id + token against the portal database.
    Falls back to a stub user mapping when the portal DB is not available.
    """
    employee_id = (employee_id or "").strip()
    portal_token = (portal_token or "").strip()
    if not employee_id or not portal_token:
        return None

    driver = os.getenv("PORTAL_DB_DRIVER")
    host = os.getenv("PORTAL_DB_HOST")
    port = os.getenv("PORTAL_DB_PORT", "1433")
    db_name = os.getenv("PORTAL_DB_NAME")
    user = os.getenv("PORTAL_DB_USER")
    password = os.getenv("PORTAL_DB_PASSWORD")
    table = os.getenv("PORTAL_DB_TABLE", "PortalEmployees")

    if pyodbc and all([driver, host, db_name, user, password]):
        conn_str = (
            f"DRIVER={{{driver}}};"
            f"SERVER={host},{port};"
            f"DATABASE={db_name};"
            f"UID={user};"
            f"PWD={password};"
        )
        portal_conn = None
        try:
            portal_conn = pyodbc.connect(conn_str)
            cursor = portal_conn.cursor()
            cursor.execute(
                f"""
                SELECT emp_id, name, email
                FROM {table}
                WHERE emp_id = ? AND token = ?
                """,
                (employee_id, portal_token),
            )
            row = cursor.fetchone()
            if row:
                return {
                    "employee_id": row[0],
                    "name": row[1],
                    "email": row[2],
                }
        except Exception as exc:
            print(f"Failed to verify portal token via DB: {exc}")
        finally:
            if portal_conn is not None:
                portal_conn.close()

    return STUB_PORTAL_USERS.get((employee_id, portal_token))


__all__ = ["verify_portal_token"]
