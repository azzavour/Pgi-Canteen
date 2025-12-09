import os
import smtplib
from email.message import EmailMessage
from typing import Any, Dict, List, Optional
from urllib.parse import quote_plus

SMTP_HOST = os.getenv("SMTP_HOST", "localhost")
SMTP_PORT = int(os.getenv("SMTP_PORT", "25"))
SMTP_USERNAME = os.getenv("SMTP_USERNAME") or ""
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD") or ""
SMTP_USE_TLS = os.getenv("SMTP_USE_TLS", "true").lower() == "true"
SMTP_USE_AUTH = os.getenv("SMTP_USE_AUTH", "true").lower() == "true"
SMTP_FROM = os.getenv("SMTP_FROM", SMTP_USERNAME or "no-reply@cawang-canteen.local")


def _build_menu_lines(order: Dict[str, Any]) -> List[str]:
    menu_items = order.get("menu_items")
    if not menu_items:
        label = order.get("menu_label") or order.get("menu")
        qty = order.get("quantity") or 1
        if label:
            menu_items = [{"label": label, "qty": qty}]

    lines: List[str] = []
    for item in menu_items or []:
        label = item.get("label") or item.get("menu")
        qty = item.get("qty") or item.get("quantity") or 1
        if label:
            lines.append(f"- {label} x{qty}")
    return lines or ["- (detail menu tidak tersedia)"]


def _get_whatsapp_number_for_tenant(tenant_name: str) -> Optional[str]:
    tenant_name = (tenant_name or "").lower()
    mapping = {
        "yanti": "6285880259653",
        "rima": "6285718899709",
    }
    for key, value in mapping.items():
        if key in tenant_name:
            return value
    return None


def _build_whatsapp_url(order: Dict[str, Any], employee_name: str, employee_id: str) -> Optional[str]:
    existing = order.get("whatsapp_url")
    if existing:
        return existing
    tenant_name = order.get("tenant_name", "")
    wa_number = _get_whatsapp_number_for_tenant(tenant_name)
    if not wa_number:
        return None
    menu_label = order.get("menu_label") or order.get("menu") or ""
    order_datetime_text = order.get("order_datetime_text") or order.get("order_date") or ""
    ticket_number = order.get("ticket_number") or order.get("order_code") or ""
    queue_number = order.get("queue_number")
    queue_text = f" Nomor pesanan: {queue_number}." if queue_number else ""
    message = (
        f"Halo Bu, saya {employee_name} (ID: {employee_id}) sudah memesan {menu_label} "
        f"di {tenant_name} pada {order_datetime_text}. Kode pesanan: {ticket_number}.{queue_text}"
    )
    return f"https://api.whatsapp.com/send?phone={wa_number}&text={quote_plus(message)}"


def send_order_confirmation(
    to_email: Optional[str], order: Dict[str, Any], *, recipient: str = "employee"
) -> None:
    """
    Kirim email ringkasan pre-order ke karyawan sesuai desain Cawang Canteen.
    """
    if not to_email:
        return

    employee_name = order.get("employee_name", "")
    employee_id = order.get("employee_id", "")
    tenant_name = order.get("tenant_name", "")
    ticket_number = order.get("ticket_number") or order.get("order_code") or ""
    order_datetime_text = order.get("order_datetime_text") or order.get("order_date") or ""
    menu_label = order.get("menu_label") or order.get("menu") or "-"
    menu_entries = _build_menu_lines(order)
    menu_lines = "\n".join(menu_entries)
    queue_number = order.get("queue_number")
    date_for_subject = order.get("subject_date") or order_datetime_text

    subject = f"Konfirmasi Pre-Order Cawang Canteen - {date_for_subject}"
    greeting = f"Halo {employee_name},"

    queue_text = f"\nNomor Antrean: {queue_number}" if queue_number else ""

    plain_text = f"""
{greeting}

Terima kasih telah melakukan pemesanan melalui Cawang Canteen. Pesanan Anda telah berhasil kami terima dan tercatat di sistem.

Ketersediaan menu akan dikonfirmasi langsung oleh tenant terkait pada saat proses konfirmasi pesanan. Jika menu tidak tersedia, Anda dapat memilih menu lain dari tenant yang sama.

Terima kasih atas pengertian dan kerja sama Anda.

ORDER : {ticket_number} {order_datetime_text}

Nama        : {employee_name} ({employee_id})
Tenant      : {tenant_name}
Menu        : {menu_label}
Nomor antre : {queue_number or "-"}

Harap tunjukkan tiket ini saat pengambilan pesanan dan foto bukti order untuk dilampirkan saat konfirmasi.
""".strip()

    whatsapp_url = _build_whatsapp_url(order, employee_name, employee_id)
    if whatsapp_url:
        qr_code_url = f"https://api.qrserver.com/v1/create-qr-code/?size=260x260&data={quote_plus(whatsapp_url)}"
        qr_section = f"""
            <div style="margin:12px 0;">
              <img src="{qr_code_url}" alt="QR WhatsApp" width="210" height="210" style="border:1px solid #000;padding:6px;background:#fff;" />
            </div>
            <div>
              <a href="{whatsapp_url}" style="font-size:12px;color:#1d4ed8;text-decoration:none;">Klik di sini untuk buka WhatsApp</a>
            </div>
        """
    else:
        qr_section = """
            <div style="margin:12px 0;padding:40px 10px;border:1px dashed #999;font-size:12px;color:#555;text-align:center;">
              QR WhatsApp tidak tersedia
            </div>
        """

    html_body = f"""
<!doctype html>
<html>
  <body style="font-family: Arial, sans-serif; color:#111;">
    <div style="max-width:520px;margin:0 auto;">
      <p style="font-size:14px; margin:0 0 12px 0;">{greeting}</p>
      <p style="font-size:13px; margin:0 0 10px 0;">
        Terima kasih telah melakukan pemesanan melalui Cawang Canteen. Pesanan Anda telah berhasil kami terima dan tercatat di sistem.
      </p>
      <p style="font-size:13px; margin:0 0 10px 0;">
        Ketersediaan menu akan dikonfirmasi langsung oleh tenant terkait pada saat proses konfirmasi pesanan. Jika menu tidak tersedia, Anda dapat memilih menu lain dari tenant yang sama.
      </p>
      <p style="font-size:13px; margin:0 0 16px 0;">
        Terima kasih atas pengertian dan kerja sama Anda.
      </p>
      <div style="font-size:14px;font-weight:bold;margin-bottom:16px;">
        ORDER : <span style="font-family:monospace;">{ticket_number}</span> {order_datetime_text}
      </div>
      <div style="border:2px solid #000;padding:14px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
          <tr>
            <td width="55%" style="text-align:center;border-right:2px solid #000;padding:8px;">
              <div style="font-weight:bold;font-size:20px;text-transform:uppercase;margin-bottom:6px;">
                {employee_name.upper()}
              </div>
              <div style="font-size:13px;margin-bottom:12px;">{employee_id}</div>
              <div style="font-weight:bold;font-size:56px;margin-bottom:12px;">
                {queue_number or "-"}
              </div>
              <div style="font-weight:bold;font-size:13px;text-transform:uppercase;margin-bottom:4px;">
                {menu_label}
              </div>
              <div style="font-size:12px;">{tenant_name}</div>
            </td>
            <td width="45%" style="text-align:center;padding:8px;">
              <div style="font-weight:bold;font-size:16px;margin-bottom:8px;">SCAN KONFIRMASI ORDER</div>
              {qr_section}
            </td>
          </tr>
        </table>
      </div>
      <p style="text-align:center; font-size:12px; margin-top:18px;">
        Foto bukti order ini untuk dilampirkan saat melakukan konfirmasi.
      </p>
    </div>
  </body>
</html>
""".strip()

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = SMTP_FROM or SMTP_USERNAME
    msg["To"] = to_email
    msg.set_content(plain_text)
    msg.add_alternative(html_body, subtype="html")

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.ehlo()
            if SMTP_USE_TLS:
                server.starttls()
                server.ehlo()
            if SMTP_USE_AUTH and SMTP_USERNAME and SMTP_PASSWORD:
                server.login(SMTP_USERNAME, SMTP_PASSWORD)
            server.send_message(msg)
    except Exception as exc:
        print(f"Failed to send email: {exc!r}")
        raise
