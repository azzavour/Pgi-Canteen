import os
from typing import Dict, Optional, Set, Tuple

from dotenv import load_dotenv

try:
    import pyodbc
except ModuleNotFoundError:
    pyodbc = None

from .sqlite_database import get_db_connection

load_dotenv()

# Token dummy untuk testing jika DB Portal mati total
DUMMY_PORTAL_TOKENS: Set[Tuple[str, str]] = {
    ("34283", "TEST123"),
    ("90001", "12345"),
    ("98765", "ABCDE"),
    ("53432", "XYZ987"),
}


def _verify_token_in_portal_db(employee_id: str, portal_token: str) -> bool:
    """
    Cek ke portal database apakah kombinasi emp_id + token valid.
    VERSI DEBUGGING: Mencetak log error koneksi ke terminal.
    """
    driver = os.getenv("PORTAL_DB_DRIVER")
    host = os.getenv("PORTAL_DB_HOST")
    port = os.getenv("PORTAL_DB_PORT", "1433")
    db_name = os.getenv("PORTAL_DB_NAME")
    user = os.getenv("PORTAL_DB_USER")
    password = os.getenv("PORTAL_DB_PASSWORD")
    table = os.getenv("PORTAL_DB_TABLE", "users")

    print(f"\n[DEBUG PORTAL] Memulai verifikasi untuk User: {employee_id}")

    # 1. Cek apakah library pyodbc terinstall
    if not pyodbc:
        print("[DEBUG PORTAL ERROR] Library 'pyodbc' tidak ditemukan atau gagal di-load.")
        print("[DEBUG PORTAL INFO] Sistem akan mencoba menggunakan Dummy Token.")
        return (employee_id, portal_token) in DUMMY_PORTAL_TOKENS

    # 2. Cek kelengkapan konfigurasi ENV
    if not all([driver, host, db_name, user, password]):
        print("[DEBUG PORTAL ERROR] Konfigurasi Database Portal di .env TIDAK LENGKAP.")
        print(f"   - DRIVER: {driver}")
        print(f"   - HOST: {host}")
        print(f"   - DB NAME: {db_name}")
        print(f"   - USER: {user}")
        print("[DEBUG PORTAL INFO] Sistem akan mencoba menggunakan Dummy Token.")
        return (employee_id, portal_token) in DUMMY_PORTAL_TOKENS

    conn_str = (
        f"DRIVER={{{driver}}};"
        f"SERVER={host},{port};"
        f"DATABASE={db_name};"
        f"UID={user};"
        f"PWD={password};"
    )

    portal_conn = None
    try:
        print(f"[DEBUG PORTAL] Mencoba menghubungkan ke Server Database: {host}...")
        portal_conn = pyodbc.connect(conn_str)
        print("[DEBUG PORTAL] Koneksi Berhasil!")

        cursor = portal_conn.cursor()
        query = f"SELECT 1 FROM {table} WHERE emp_id = ? AND token = ?"
        
        # Hanya print 20 karakter awal token agar log tidak terlalu penuh
        token_preview = portal_token[:20] + "..." if len(portal_token) > 10 else portal_token
        print(f"[DEBUG PORTAL] Menjalankan Query: SELECT 1 FROM {table} WHERE emp_id={employee_id} AND token={token_preview}")
        
        cursor.execute(query, (employee_id, portal_token))
        row = cursor.fetchone()
        
        if row:
            print("[DEBUG PORTAL] RESULT: Token DITEMUKAN dan VALID di Database Portal.")
            return True
        else:
            print("[DEBUG PORTAL] RESULT: Token TIDAK DITEMUKAN di Database Portal.")
            # Tetap cek dummy jika di DB asli tidak ada (opsional, tergantung kebutuhan)
            is_dummy = (employee_id, portal_token) in DUMMY_PORTAL_TOKENS
            if is_dummy:
                print("[DEBUG PORTAL] Tapi token cocok dengan DUMMY_TOKENS.")
            return is_dummy

    except Exception as exc:
        print(f"[DEBUG PORTAL EXCEPTION] Gagal saat koneksi/query ke DB Portal: {exc}")
        print("[DEBUG PORTAL INFO] Fallback ke Dummy Token karena error.")
        return (employee_id, portal_token) in DUMMY_PORTAL_TOKENS
    finally:
        if portal_conn is not None:
            portal_conn.close()


def verify_portal_token(employee_id: str, portal_token: str) -> Optional[Dict[str, str]]:
    """
    Validasi token di portal DB, kemudian ambil data pegawai dari SQLite.
    """
    employee_id = (employee_id or "").strip()
    portal_token = (portal_token or "").strip()
    
    if not employee_id or not portal_token:
        print("[DEBUG AUTH] Employee ID atau Token kosong dari Request.")
        return None

    # Step 1: Validasi Token ke Database Portal (MS SQL)
    if not _verify_token_in_portal_db(employee_id, portal_token):
        print("[DEBUG AUTH] Verifikasi GAGAL di tahap Database Portal.")
        return None

    # Step 2: Ambil detail User dari Database Lokal (SQLite)
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        print(f"[DEBUG LOCAL] Mencari data user {employee_id} di SQLite lokal...")
        cursor.execute(
            """
            SELECT employee_id, name, email
            FROM employees
            WHERE employee_id = ?
            """,
            (employee_id,),
        )
        row = cursor.fetchone()
        
        if not row:
            print(f"[DEBUG LOCAL] Login Ditolak: User {employee_id} valid di Portal, TAPI TIDAK ADA di SQLite lokal.")
            return None
        
        print(f"[DEBUG LOCAL] User ditemukan: {row['name']} ({row['email']})")
        return {
            "employee_id": row["employee_id"],
            "name": row["name"],
            "email": row["email"],
        }
    finally:
        conn.close()


__all__ = ["verify_portal_token"]
