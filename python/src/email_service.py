import datetime
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


def _get_tenant_prefix(tenant_name: str) -> str:
    name = (tenant_name or "").lower()
    if "yanti" in name:
        return "A"
    if "rima" in name:
        return "B"
    return ""


def _get_day_and_date(order_datetime_text: Optional[str]) -> tuple[str, str]:
    if not order_datetime_text:
        return "", ""
    primary = order_datetime_text.split(",", 1)[0].strip()
    parts = primary.split(" ", 1)
    day_name = parts[0]
    date_part = parts[1].strip() if len(parts) > 1 else ""
    return day_name, date_part


def _get_day_and_date_from_order_date(order_date: Optional[str]) -> tuple[str, str]:
    if not order_date:
        return "", ""
    try:
        dt = datetime.datetime.fromisoformat(order_date)
    except ValueError:
        try:
            dt = datetime.datetime.strptime(order_date, "%d/%m/%Y")
        except ValueError:
            return "", ""
    weekday_names = [
        "Senin",
        "Selasa",
        "Rabu",
        "Kamis",
        "Jumat",
        "Sabtu",
        "Minggu",
    ]
    day_name = weekday_names[dt.weekday()]
    date_label = dt.strftime("%d/%m/%Y")
    return day_name, date_label


def _get_whatsapp_day_time(order_date: Optional[str]) -> tuple[str, str]:
    if not order_date:
        return "", ""
    normalized = order_date.strip()
    if normalized.endswith(("Z", "z")):
        normalized = normalized[:-1] + "+00:00"
    try:
        dt = datetime.datetime.fromisoformat(normalized)
    except ValueError:
        return "", ""
    weekday_names = [
        "Senin",
        "Selasa",
        "Rabu",
        "Kamis",
        "Jumat",
        "Sabtu",
        "Minggu",
    ]
    day_label = f"{weekday_names[dt.weekday()]}, {dt.strftime('%d/%m/%Y')}"
    time_label = dt.strftime("%H.%M")
    return day_label, time_label


def _build_whatsapp_url(order: Dict[str, Any], employee_name: str, employee_id: str) -> Optional[str]:
    existing = order.get("whatsapp_url")
    if existing:
        return existing
    tenant_name = order.get("tenant_name", "")
    wa_number = _get_whatsapp_number_for_tenant(tenant_name)
    if not wa_number:
        return None
    menu_label = order.get("menu_label") or order.get("menu") or ""
    order_date_value = order.get("order_date") or ""
    ticket_number = order.get("ticket_number") or order.get("order_code") or ""
    queue_number = order.get("queue_number")
    verification_code = (
        order.get("tenant_verification_code")
        or order.get("tenantVerificationCode")
        or ""
    )
    tenant_prefix = _get_tenant_prefix(tenant_name)
    display_ticket = (
        f"{verification_code}-{ticket_number}"
        if verification_code and ticket_number
        else ticket_number
    )
    queue_code = (
        f"{tenant_prefix}{queue_number}"
        if queue_number is not None and tenant_prefix
        else (str(queue_number) if queue_number is not None else "-")
    )
    day_label, time_label = _get_whatsapp_day_time(order_date_value)
    employee_identity = f" ({employee_id})" if employee_id else ""
    message = (
        f"#{display_ticket}\n\n"
        f"Halo Bu, saya {employee_name}{employee_identity} sudah memesan {menu_label} di {tenant_name} dengan detail pesanan :\n\n"
        f"Hari/tanggal : {day_label or '-'}\n"
        f"Waktu : {time_label or '-'}\n"
        f"Nomor pesanan : {queue_code}"
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
    tenant_verification_code = (
        order.get("tenant_verification_code")
        or order.get("tenantVerificationCode")
        or ""
    )
    tenant_prefix = _get_tenant_prefix(tenant_name)
    ticket_display_code = (
        f"{tenant_verification_code}-{ticket_number}"
        if tenant_verification_code and ticket_number
        else ticket_number
    )

    subject = f"Konfirmasi Pre-Order Cawang Canteen - {date_for_subject}"
    greeting = f"Halo {employee_name},"

    queue_text = f"\nNomor Antrean: {queue_number}" if queue_number else ""
    day_name, date_part = _get_day_and_date(order_datetime_text)

    plain_text = f"""
{greeting}

Terima kasih telah melakukan pemesanan melalui Cawang Canteen. Pesanan Anda telah berhasil kami terima dan tercatat di sistem.

Ketersediaan menu akan dikonfirmasi langsung oleh tenant terkait pada saat proses konfirmasi pesanan. Jika menu tidak tersedia, Anda dapat memilih menu lain dari tenant yang sama.

Terima kasih atas pengertian dan kerja sama Anda.

ORDER : {ticket_display_code} {order_datetime_text}

Nama        : {employee_name} ({employee_id})
Tenant      : {tenant_name}
Menu        : {menu_label}
Hari/tanggal : {day_name or "-"}
Waktu        : {date_part or "-"}
Nomor antre  : {((tenant_prefix + " ") if tenant_prefix else "") + (str(queue_number) if queue_number else "-")}
Kode tenant : {tenant_verification_code or "-"}

Kirim kode ini ({ticket_display_code or tenant_verification_code or "-"}) saat konfirmasi WhatsApp setelah memindai QR.
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
        ORDER : <span style="font-family:monospace;">{ticket_display_code}</span> {order_datetime_text}
      </div>
      <div style="border:2px solid #000;padding:14px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
          <tr>
            <td width="55%" style="text-align:center;border-right:2px solid #000;padding:8px;">
              <div style="font-weight:bold;font-size:20px;text-transform:uppercase;margin-bottom:6px;">
                {employee_name.upper()}
              </div>
              <div style="font-size:13px;margin-bottom:12px;">{employee_id}</div>
              <div style="display:flex;align-items:center;justify-content:center;gap:16px;margin-bottom:12px;">
                {"<span style='font-weight:bold;font-size:48px;'>{}</span>".format(tenant_prefix) if tenant_prefix else ""}
                <span style="font-weight:bold;font-size:56px;">
                  {queue_number or "-"}
                </span>
              </div>
              <div style="font-weight:bold;font-size:13px;text-transform:uppercase;margin-bottom:4px;">
                {menu_label}
              </div>
              <div style="font-size:12px;">{tenant_name}</div>
              <div style="font-size:12px;margin-top:8px;">
                Kode Tenant: <strong>{tenant_verification_code or "-"}</strong>
              </div>
            </td>
            <td width="45%" style="text-align:center;padding:8px;">
              <div style="font-weight:bold;font-size:16px;margin-bottom:8px;">SCAN KONFIRMASI ORDER</div>
              {qr_section}
            </td>
          </tr>
        </table>
        <div style="font-size:11px;margin-top:12px;text-align:left;">
          # {ticket_display_code}<br/><br/>
          Halo Bu, saya {employee_name} (ID: {employee_id})<br/><br/>
          sudah memesan {menu_label} di {tenant_name} dengan detail pesanan :<br/><br/>
          Hari/tanggal : {day_name or "-"}<br/>
          Waktu : {date_part or "-"}<br/>
          Nomor pesanan : {(tenant_prefix or "") + (str(queue_number) if queue_number is not None else "-")}
        </div>
      </div>
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
