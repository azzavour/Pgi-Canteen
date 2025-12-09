import os
import smtplib
from email.message import EmailMessage
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parents[1]
dotenv_path = BASE_DIR / ".env"
print("DOTENV PATH:", dotenv_path, "exists?", dotenv_path.exists())

load_dotenv(dotenv_path)

SMTP_HOST = os.getenv("SMTP_HOST", "localhost")
SMTP_PORT = int(os.getenv("SMTP_PORT", "25"))
SMTP_USERNAME = os.getenv("SMTP_USERNAME") or ""
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD") or ""
SMTP_USE_TLS = os.getenv("SMTP_USE_TLS", "true").lower() == "true"
SMTP_USE_AUTH = os.getenv("SMTP_USE_AUTH", "true").lower() == "true"
SMTP_FROM = os.getenv("SMTP_FROM", SMTP_USERNAME or "no-reply@cawang-canteen.local")

TO_EMAIL = "izzynisa.26@gmail.com"

print("SMTP_HOST:", SMTP_HOST)
print("SMTP_PORT:", SMTP_PORT)
print("SMTP_USERNAME:", SMTP_USERNAME)
print("SMTP_USE_TLS:", SMTP_USE_TLS)
print("SMTP_USE_AUTH:", SMTP_USE_AUTH)

msg = EmailMessage()
msg["Subject"] = "Tes SMTP dari Cawang Canteen"
msg["From"] = SMTP_FROM
msg["To"] = TO_EMAIL
msg.set_content("Kalau email ini masuk, konfigurasi SMTP sudah benar.")

try:
    with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
        server.ehlo()
        if SMTP_USE_TLS:
            server.starttls()
            server.ehlo()
        if SMTP_USE_AUTH and SMTP_USERNAME and SMTP_PASSWORD:
            server.login(SMTP_USERNAME, SMTP_PASSWORD)
        server.send_message(msg)
    print("OK - Email test terkirim, cek inbox/spam.")
except Exception as exc:
    print("ERROR - Gagal kirim email:", repr(exc))
