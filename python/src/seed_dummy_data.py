import datetime
import hashlib

from src.sqlite_database import get_db_connection
from src.tenant_utils import generate_verification_code


def seed_dummy_data():
    conn = get_db_connection()
    cursor = conn.cursor()

    cleanup_tables = [
        "preorders",
        "transactions",
        "devices",
        "tenant_menu",
        "tenants",
        "employees",
    ]

    try:
        for table in cleanup_tables:
            cursor.execute(f"DELETE FROM {table}")
            print(f"[{datetime.datetime.now().isoformat()}] Cleared table '{table}'.")

        token_hash = hashlib.sha256("1234".encode("utf-8")).hexdigest()
        employees = [
            (
                "34283",
                "0003871263",
                "ISMAIL BIN MAIL",
                "Karyawan",
                0,
                0,
                0,
                token_hash,
                "ismail@example.com",
            ),
            (
                "90001",
                "CARD90001",
                "Ariffin",
                "Karyawan",
                0,
                0,
                0,
                token_hash,
                "dummy@example.com",
            ),
            (
                "98765",
                "CARD568348437",
                "Aruffin",
                "Karyawan",
                0,
                0,
                0,
                token_hash,
                "dummy@example.com",
            ),
             (
                "53432",
                "CARD459345934",
                "Fizi",
                "Karyawan",
                0,
                0,
                0,
                token_hash,
                "dummy@example.com",
            ),
        ]
        cursor.executemany(
            """
            INSERT INTO employees (
                employee_id,
                card_number,
                name,
                employee_group,
                admin,
                is_disabled,
                is_blocked,
                order_token_hash,
                email
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            employees,
        )
        print("Inserted employee dummy data.")

        tenants = [
            (1, "Bu Yanti", 1, 1, generate_verification_code()),
            (2, "Bu Rima", 1, 1, generate_verification_code()),
        ]
        cursor.executemany(
            """
            INSERT INTO tenants (id, name, quota, is_limited, verification_code)
            VALUES (?, ?, ?, ?, ?)
            """,
            tenants,
        )
        print("Inserted tenant dummy data.")

        tenant_menus = [
            (
                1,
                "A: Nasi, Soto Betawi, Gorengan.",
            ),
            (
                1,
                "B: Nasi, Ayam Semur Pedas, Tumis Buncis Wortel/ Orek Tempe, Gorengan.",
            ),
            (
                1,
                "C: Nasi, Dendeng Balado, Toge Tahu/ Orek Tempe, Gorengan.",
            ),
            (
                1,
                "D: Nasi, Cumi Chili Padi, Tumis Buncis wortel/ Tumis Toge Tahu, Gorengan.",
            ),
            (1, "E:"),
            (
                2,
                "A: Nasi, Sop Janda, Gorengan.",
            ),
            (
                2,
                "B: Nasi, Paket Ayam bakar Madu ( dada/ Paha ).",
            ),
            (
                2,
                "C: Nasi, Tumis Cumi Asin, Tumis Labu Jagung, Gorengan.",
            ),
            (2, "D:"),
            (2, "E:"),
        ]
        cursor.executemany(
            """
            INSERT INTO tenant_menu (tenant_id, menu)
            VALUES (?, ?)
            """,
            tenant_menus,
        )
        print("Inserted tenant menu dummy data.")

        devices = [
            ("73a0fcf", 2),
            ("2cb6fd84", 1),
        ]
        cursor.executemany(
            """
            INSERT INTO devices (device_code, tenant_id)
            VALUES (?, ?)
            """,
            devices,
        )
        print("Inserted device dummy data.")

        conn.commit()
        print("Seed dummy data completed.")
    finally:
        conn.close()


if __name__ == "__main__":
    seed_dummy_data()
