import os
import sqlite3
import pyodbc
import datetime
from dotenv import load_dotenv

# Ensure your .env file contains connection details for BOTH SQLite and SQL Server
# DATABASE_FILE=data/canteen.db
# DB_SERVER=your_server
# DB_DATABASE=your_db
# DB_USERNAME=your_user
# DB_PASSWORD=your_pass

load_dotenv()

def get_sqlite_connection():
    """Establishes a connection to the source SQLite database."""
    db_file = os.getenv("DATABASE_FILE")
    if not db_file:
        raise ValueError("DATABASE_FILE not set in .env file")
    conn = sqlite3.connect(db_file)
    conn.row_factory = sqlite3.Row
    return conn

def get_sql_server_connection():
    """Establishes a connection to the destination SQL Server database."""
    server = os.getenv("DB_SERVER")
    database = os.getenv("DB_DATABASE")
    username = os.getenv("DB_USERNAME")
    password = os.getenv("DB_PASSWORD")
    driver = "{ODBC Driver 17 for SQL Server}"

    if not all([server, database, username, password]):
        raise ValueError("SQL Server connection details are missing in the .env file.")

    conn_str = f"DRIVER={driver};SERVER={server};DATABASE={database};UID={username};PWD={password}"
    return pyodbc.connect(conn_str)

def migrate_table(sqlite_cursor, sql_cursor, table_name, columns):
    """Migrates a single table by selecting from SQLite and inserting into SQL Server."""
    print(f"Migrating data for table: {table_name}...", end="")
    
    # Select data from SQLite
    sqlite_cursor.execute(f"SELECT {', '.join(columns)} FROM {table_name}")
    rows = sqlite_cursor.fetchall()
    
    if not rows:
        print(" No data to migrate.")
        return

    # Prepare insert statement for SQL Server
    placeholders = ', '.join(['?'] * len(columns))
    sql_insert = f"INSERT INTO {table_name} ({', '.join(columns)}) VALUES ({placeholders})"
    
    # Convert rows to list of tuples, handling transaction_date for SQL Server
    processed_rows = []
    if table_name == "transactions":
        for row in rows:
            row_dict = dict(row)
            # Convert SQLite datetime string to Python datetime object
            # SQLite stores 'YYYY-MM-DD HH:MM:SS'
            transaction_date_str = row_dict['transaction_date']
            if transaction_date_str:
                # Handle potential fractional seconds if they exist, otherwise parse without them
                if '.' in transaction_date_str:
                    dt_obj = datetime.datetime.strptime(transaction_date_str, '%Y-%m-%dT%H:%M:%S.%f')
                else:
                    dt_obj = datetime.datetime.strptime(transaction_date_str, '%Y-%m-%dT%H:%M:%S')
                row_dict['transaction_date'] = dt_obj
            processed_rows.append(tuple(row_dict.values()))
    else:
        processed_rows = [tuple(row) for row in rows]

    # Insert data into SQL Server
    sql_cursor.executemany(sql_insert, processed_rows)
    print(f" Migrated {len(rows)} rows.")

def main():
    """Main function to orchestrate the database migration."""
    sqlite_conn = None
    sql_conn = None

    # The order of migration is important due to foreign key constraints.
    # We migrate parent tables before child tables.
    migration_plan = {
        "employees": ["employee_id", "card_number", "name", "employee_group", "admin", "is_disabled"],
        "tenants": ["id", "name", "quota", "is_limited"],
        "tenant_menu": ["tenant_id", "menu"],
        "devices": ["device_code", "tenant_id"],
        "transactions": ["card_number", "employee_id", "employee_name", "employee_group", "tenant_id", "tenant_name", "transaction_date"],
    }

    try:
        sqlite_conn = get_sqlite_connection()
        sql_conn = get_sql_server_connection()

        sqlite_cursor = sqlite_conn.cursor()
        sql_cursor = sql_conn.cursor()

        print("Starting data migration from SQLite to SQL Server.")
        print("IMPORTANT: Make sure the SQL Server database schema is up to date.")

        # In a transaction, clear existing data from destination tables (in reverse order)
        print("\nStep 1: Clearing existing data from SQL Server tables...")
        for table in reversed(list(migration_plan.keys())):
            print(f"  - Clearing {table}")
            sql_cursor.execute(f"DELETE FROM {table}")
        
        # Migrate data table by table
        print("\nStep 2: Migrating data...")
        for table, columns in migration_plan.items():
            migrate_table(sqlite_cursor, sql_cursor, table, columns)

        # Commit the transaction to SQL Server
        sql_conn.commit()
        print("\nData migration completed successfully!")

    except Exception as e:
        print(f"\nAn error occurred during migration: {e}")
        if sql_conn:
            print("Rolling back all changes in SQL Server.")
            sql_conn.rollback()
        print("Migration failed.")

    finally:
        if sqlite_conn:
            sqlite_conn.close()
        if sql_conn:
            sql_conn.close()

if __name__ == "__main__":
    main()
