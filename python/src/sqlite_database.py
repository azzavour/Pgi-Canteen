import os
import sqlite3
from dotenv import load_dotenv

load_dotenv()


def get_db_connection():
    """Establishes a connection to the SQLite database."""
    db_file = os.getenv("DATABASE_FILE", "data/canteen.db")
    os.makedirs(os.path.dirname(db_file), exist_ok=True)
    conn = sqlite3.connect(db_file)
    conn.row_factory = sqlite3.Row
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
            employee_id TEXT,
            card_number TEXT,
            name TEXT,
            employee_group TEXT,
            admin BOOLEAN DEFAULT 0,
            is_disabled BOOLEAN DEFAULT 0,
            is_blocked BOOLEAN DEFAULT 0
        )
    """
    )

    # Tenant Table
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS tenants (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            quota INTEGER,
            is_limited BOOLEAN DEFAULT 1
        )
    """
    )

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
            transaction_date TEXT DEFAULT (datetime('now','localtime'))
        )
    """
    )

    conn.commit()
    conn.close()
    print("Database and tables created successfully.")


if __name__ == "__main__":
    import sys

    # Check if '--fresh' argument is provided
    fresh_start = "--fresh" in sys.argv
    if fresh_start:
        print("Starting with a fresh database setup.")
    create_tables(fresh=fresh_start)
