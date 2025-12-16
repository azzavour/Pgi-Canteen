import os
import sqlite3
from dotenv import load_dotenv

load_dotenv()

SAMPLE_EMPLOYEE = {
    "employee_id": "34283",
    "card_number": "CARD-34283",
    "name": "Annisa",
    "employee_group": "General",
    "email": "annisafitriana38@gmail.com",
}


def get_db_connection(mode: str = "default"):
    """Establishes a connection to the SQLite database."""
    db_file = os.getenv("DATABASE_FILE", "data/canteen.db")
    db_dir = os.path.dirname(db_file)
    if db_dir:
        os.makedirs(db_dir, exist_ok=True)

    mode = (mode or "default").lower()
    if mode == "tap":
        timeout_seconds = 1
        busy_timeout_ms = 1000
    else:
        timeout_seconds = 5
        busy_timeout_ms = 5000

    conn = sqlite3.connect(db_file, timeout=timeout_seconds)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA synchronous = NORMAL;")
    conn.execute(f"PRAGMA busy_timeout = {busy_timeout_ms};")
    return conn


def create_tables(fresh: bool = False):
    """Creates all necessary tables in the database if they don't exist."""
    conn = get_db_connection()
    cursor = conn.cursor()

    if fresh:
        print("Dropping all existing tables...")
        cursor.execute("DROP TABLE IF EXISTS transactions")
        cursor.execute("DROP TABLE IF EXISTS devices")
        cursor.execute("DROP TABLE IF EXISTS tenant_menu")
        cursor.execute("DROP TABLE IF EXISTS tenants")
        print("All tables dropped.")

    # Employee Table
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS employees (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ticket_number TEXT, 
            employee_id TEXT,
            card_number TEXT,
            name TEXT,
            employee_group TEXT,
            admin BOOLEAN DEFAULT 0,
            is_disabled BOOLEAN DEFAULT 0,
            is_blocked BOOLEAN DEFAULT 0,
            email TEXT
        )
    """
    )
    cursor.execute("PRAGMA table_info(employees)")
    employee_columns = [row[1] for row in cursor.fetchall()]
    if "order_token_hash" not in employee_columns:
        cursor.execute("ALTER TABLE employees ADD COLUMN order_token_hash TEXT")
    if "email" not in employee_columns:
        cursor.execute("ALTER TABLE employees ADD COLUMN email TEXT")

    # Ensure at least one sample employee has an email for testing purposes.
    cursor.execute(
        "SELECT id FROM employees WHERE employee_id = ?",
        (SAMPLE_EMPLOYEE["employee_id"],),
    )
    sample_row = cursor.fetchone()
    if sample_row:
        cursor.execute(
            "UPDATE employees SET email = ? WHERE employee_id = ?",
            (SAMPLE_EMPLOYEE["email"], SAMPLE_EMPLOYEE["employee_id"]),
        )
    else:
        cursor.execute(
            """
            INSERT INTO employees (employee_id, card_number, name, employee_group, email)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                SAMPLE_EMPLOYEE["employee_id"],
                SAMPLE_EMPLOYEE["card_number"],
                SAMPLE_EMPLOYEE["name"],
                SAMPLE_EMPLOYEE["employee_group"],
                SAMPLE_EMPLOYEE["email"],
            ),
        )

    # Tenant Table
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS tenants (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            quota INTEGER,
            is_limited BOOLEAN DEFAULT 1,
            verification_code TEXT
        )
    """
    )
    cursor.execute("PRAGMA table_info(tenants)")
    tenant_columns = [row[1] for row in cursor.fetchall()]
    if "verification_code" not in tenant_columns:
        cursor.execute("ALTER TABLE tenants ADD COLUMN verification_code TEXT")

    # Tenant Menu Table
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS tenant_menu (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tenant_id INTEGER,
            menu TEXT
        )
    """
    )

    # Devices Table
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS devices (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            device_code TEXT,
            tenant_id INTEGER
        )
    """
    )

    # Transactions Table
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            card_number TEXT,
            employee_id TEXT,
            employee_name TEXT,
            employee_group TEXT,
            tenant_id INTEGER,
            tenant_name TEXT,
            transaction_date TEXT NOT NULL DEFAULT (datetime('now','localtime'))
        )
    """
    )
    _ensure_transactions_timestamp_schema(cursor)
    _ensure_transaction_day_schema(cursor)

    # Preorders Table
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS preorders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_code TEXT UNIQUE,
            employee_id TEXT NOT NULL,
            card_number TEXT NOT NULL,
            employee_name TEXT NOT NULL,
            tenant_id INTEGER NOT NULL,
            tenant_name TEXT NOT NULL,
            menu_label TEXT NOT NULL,
            order_date TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'PENDING',
            created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
            taken_at TEXT,
            queue_number INTEGER
        )
    """
    )
    cursor.execute("PRAGMA table_info(preorders)")
    preorder_columns = [row[1] for row in cursor.fetchall()]
    if "queue_number" not in preorder_columns:
        cursor.execute("ALTER TABLE preorders ADD COLUMN queue_number INTEGER")
    cursor.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_preorders_employee_tenant_date_status
        ON preorders (employee_id, tenant_id, order_date, status)
    """
    )
    cursor.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_preorders_tenant_date_status
        ON preorders (tenant_id, order_date, status)
    """
    )
    cursor.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_preorders_tenant_date
        ON preorders (tenant_id, order_date)
    """
    )
    cursor.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_transactions_tenant_date
        ON transactions (tenant_id, transaction_date)
    """
    )
    cursor.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_transactions_card_date
        ON transactions (card_number, transaction_date)
    """
    )

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS canteen_status (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            mode TEXT NOT NULL CHECK (mode IN ('OPEN','CLOSE','NORMAL')),
            updated_at TEXT NOT NULL,
            updated_by TEXT
        )
        """
    )
    cursor.execute(
        """
        INSERT OR IGNORE INTO canteen_status (id, mode, updated_at)
        VALUES (1, 'NORMAL', datetime('now','localtime'))
        """
    )

    conn.commit()
    conn.close()
    print("Database and tables created successfully.")


def _ensure_transactions_timestamp_schema(cursor):
    """
    Make sure transactions.transaction_date stores full timestamp (TEXT, NOT NULL)
    and normalize existing YYYY-MM-DD rows.
    """
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='transactions'")
    if cursor.fetchone() is None:
        return

    cursor.execute("PRAGMA table_info(transactions)")
    columns = cursor.fetchall()
    if not columns:
        return

    column_info = {col[1]: col for col in columns}
    tx_col = column_info.get("transaction_date")
    if tx_col is None:
        return

    declared_type = (tx_col[2] or "").upper()
    not_null = bool(tx_col[3])

    needs_rebuild = declared_type != "TEXT" or not not_null

    if needs_rebuild:
        cursor.execute("ALTER TABLE transactions RENAME TO transactions_old")
        cursor.execute(
            """
            CREATE TABLE transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                card_number TEXT,
                employee_id TEXT,
                employee_name TEXT,
                employee_group TEXT,
                tenant_id INTEGER,
                tenant_name TEXT,
                transaction_date TEXT NOT NULL DEFAULT (datetime('now','localtime'))
            )
        """
        )
        cursor.execute(
            """
            INSERT INTO transactions (
                id,
                card_number,
                employee_id,
                employee_name,
                employee_group,
                tenant_id,
                tenant_name,
                transaction_date
            )
            SELECT
                id,
                card_number,
                employee_id,
                employee_name,
                employee_group,
                tenant_id,
                tenant_name,
                CASE
                    WHEN transaction_date IS NULL OR transaction_date = ''
                        THEN datetime('now','localtime')
                    WHEN LENGTH(transaction_date) = 10
                        THEN transaction_date || ' 00:00:00'
                    ELSE transaction_date
                END
            FROM transactions_old
        """
        )
        cursor.execute("DROP TABLE transactions_old")
    else:
        cursor.execute(
            """
            UPDATE transactions
            SET transaction_date = transaction_date || ' 00:00:00'
            WHERE transaction_date IS NOT NULL
              AND LENGTH(transaction_date) = 10
        """
        )


def _ensure_transaction_day_schema(cursor):
    """
    Adds transaction_day column and unique index for (card_number, transaction_day).
    """
    cursor.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='transactions'"
    )
    if cursor.fetchone() is None:
        return

    cursor.execute("PRAGMA table_info(transactions)")
    columns = cursor.fetchall()
    if not columns:
        return

    column_names = [col[1] for col in columns]
    if "transaction_day" not in column_names:
        cursor.execute("ALTER TABLE transactions ADD COLUMN transaction_day TEXT")

    cursor.execute(
        """
        UPDATE transactions
        SET transaction_day = substr(transaction_date, 1, 10)
        WHERE transaction_day IS NULL
          AND transaction_date IS NOT NULL
        """
    )

    cursor.execute("DROP INDEX IF EXISTS idx_transactions_card_day")
    cursor.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_card_day
        ON transactions (card_number, transaction_day)
        """
    )


if __name__ == "__main__":
    import sys

    # Check if '--fresh' argument is provided
    fresh_start = "--fresh" in sys.argv
    if fresh_start:
        print("Starting with a fresh database setup.")
    create_tables(fresh=fresh_start)
