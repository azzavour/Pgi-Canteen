import hashlib
import secrets
from datetime import datetime

from .sqlite_database import get_db_connection


def generate_plain_token(length: int = 32) -> str:
    """
    Generate random token yang aman untuk dikirim via URL.
    Gunakan secrets.token_urlsafe agar karakter-karakternya URL-safe.
    length di sini adalah panjang kira-kira (bisa sedikit lebih karena encoding).
    """
    return secrets.token_urlsafe(length)


def hash_token(plain_token: str) -> str:
    """
    Hash token dengan SHA-256 dan kembalikan hex digest.
    """
    return hashlib.sha256(plain_token.encode("utf-8")).hexdigest()


def generate_tokens_for_employees():
    """
    Mengisi kolom order_token_hash untuk semua employee yang belum punya token.
    - Hanya employee dengan order_token_hash IS NULL atau '' yang akan diproses.
    - Untuk setiap employee tersebut:
      - generate plain_token (random)
      - hash dengan SHA-256
      - update order_token_hash di database
      - print mapping employee_id, name, plain_token ke stdout,
        agar bisa dikopi ke sistem lain atau file eksternal.
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute(
        """
        SELECT employee_id, name
        FROM employees
        WHERE order_token_hash IS NULL
           OR order_token_hash = ''
        """
    )
    rows = cursor.fetchall()

    if not rows:
        print("Tidak ada employee yang perlu dibuatkan token (semua sudah punya).")
        conn.close()
        return

    print(f"Generate token untuk {len(rows)} employee pada {datetime.now().isoformat()}:\n")
    print("employee_id,name,token")

    for employee_id, name in rows:
        plain_token = generate_plain_token(16)
        token_hash = hash_token(plain_token)

        cursor.execute(
            """
            UPDATE employees
            SET order_token_hash = ?
            WHERE employee_id = ?
            """,
            (token_hash, employee_id),
        )

        safe_name = name.replace(",", " ") if name else ""
        print(f"{employee_id},{safe_name},{plain_token}")

    conn.commit()
    conn.close()
    print("\nSelesai. Simpan mapping employee_id,name,token di sistem lain dengan aman.")


if __name__ == "__main__":
    generate_tokens_for_employees()
