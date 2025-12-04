import json
import os
import sys

# Add the project root to the Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.sqlite_database import get_db_connection, create_tables

DATA_DIRECTORY = "data"
EMPLOYEE_FILE_PATH = os.path.join(DATA_DIRECTORY, "employee.json")
TENANT_FILE_PATH = os.path.join(DATA_DIRECTORY, "tenant.json")
TENANT_DEVICE_FILE_PATH = os.path.join(DATA_DIRECTORY, "tenant_device.json")

def migrate_employees(cursor):
    """Migrates employee data from JSON to SQLite."""
    try:
        with open(EMPLOYEE_FILE_PATH, "r", encoding="utf-8") as f:
            employee_data = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        print(f"Warning: {EMPLOYEE_FILE_PATH} not found or is invalid.")
        return

    for employee in employee_data:
        cursor.execute(
            """
            INSERT OR REPLACE INTO employees (employeeId, cardNumber, employeeGroup, name, admin)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                employee.get("employeeId"),
                employee.get("cardNumber"),
                employee.get("employeeGroup"),
                employee.get("name"),
                employee.get("admin", False),
            ),
        )
    print(f"Migrated {len(employee_data)} employees.")

def migrate_tenants(cursor):
    """Migrates tenant data from JSON to SQLite."""
    try:
        with open(TENANT_FILE_PATH, "r", encoding="utf-8") as f:
            tenant_data = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        print(f"Warning: {TENANT_FILE_PATH} not found or is invalid.")
        return

    for tenant_id, info in tenant_data.items():
        cursor.execute(
            """
            INSERT OR REPLACE INTO tenants (id, name, quota, menu)
            VALUES (?, ?, ?, ?)
            """,
            (
                tenant_id,
                info.get("name"),
                info.get("quota"),
                json.dumps(info.get("menu")),
            ),
        )
    print(f"Migrated {len(tenant_data)} tenants.")

def migrate_devices(cursor):
    """Migrates device data from JSON to SQLite."""
    try:
        with open(TENANT_DEVICE_FILE_PATH, "r", encoding="utf-8") as f:
            device_data = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        print(f"Warning: {TENANT_DEVICE_FILE_PATH} not found or is invalid.")
        return

    for device_id, tenant_id in device_data.items():
        cursor.execute(
            """
            INSERT OR REPLACE INTO devices (id, tenant_id)
            VALUES (?, ?)
            """,
            (device_id, tenant_id),
        )
    print(f"Migrated {len(device_data)} devices.")

def migrate():
    """Runs the full migration from JSON files to SQLite."""
    print("Starting database migration...")
    create_tables()
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        migrate_employees(cursor)
        migrate_tenants(cursor)
        migrate_devices(cursor)
        conn.commit()
        print("Migration completed successfully.")
    except Exception as e:
        conn.rollback()
        print(f"An error occurred during migration: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
