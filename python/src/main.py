import threading
import datetime
import requests
import os
import time
import json
from dotenv import load_dotenv

from .inputs import create_input_window_and_loop
from .sound_manager import SoundManager
from . import app_state

load_dotenv()

# --- Configuration ---
API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8000")
DEBOUNCE_SECONDS = float(os.getenv("DEBOUNCE_SECONDS", 0.2))
APP_STATE_REFRESH_SECONDS = int(os.getenv("APP_STATE_REFRESH_SECONDS", 300))

# --- Global State for this process ---
sound_manager = SoundManager(asset_dir="assets")
input_buffers = {}
debounce_timers = {}
buffer_lock = threading.Lock()
last_input_strings = {}
_sse_thread_started = False


def log_buffer(device_id):
    app_state.ensure_data_fresh(APP_STATE_REFRESH_SECONDS)
    with buffer_lock:
        local_buffer = input_buffers.get(device_id, [])
        input_buffers[device_id] = []

    if not local_buffer:
        return

    chars = [item[1] for item in local_buffer]
    input_string = "".join(chars).rstrip("\r")

    if last_input_strings.get(device_id) == input_string:
        print('ignoring')
        return

    last_input_strings[device_id] = input_string

    def reset_last_input():
        if last_input_strings.get(device_id) == input_string:
            last_input_strings.pop(device_id, None)

    threading.Timer(2.0, reset_last_input).start()

    if not (len(input_string) == 10 and input_string.isdigit()):
        return

    found_employee = next(
        (
            employee
            for employee in app_state.employee_data
            if employee.get("card_number") == input_string
        ),
        None,
    )

    if not found_employee:
        sound_manager.play_failed()
        print(f"Card {input_string} not found")
        return

    if found_employee.get("is_disabled"):
        sound_manager.play_failed()
        print(
            f"Employee {found_employee.get('name')} ({found_employee.get('employee_id')}) is disabled."
        )
        return

    print(
        f"[{device_id}] Employee ID: {found_employee.get('employee_id')}, Name: {found_employee.get('name')}"
    )

    try:
        today = datetime.date.today()
        tenant_info = app_state.device_to_tenant_map.get(device_id, {})

        if not tenant_info:
            print(
                f"Warning: Device ID '{device_id}' not found in tenant map. Transaction not logged."
            )
            sound_manager.play_failed()
            return

        tenant_id = tenant_info.get("id")
        is_limited = bool(tenant_info.get("is_limited"))

        if tenant_id is None:
            print(
                f"[{device_id}] Tenant ID tidak ditemukan dalam mapping. Transaksi dibatalkan."
            )
            sound_manager.play_failed()
            return

        if is_limited:
            duplicate_check_response = requests.get(
                f"{API_BASE_URL}/transaction/check_duplicate",
                params={
                    "cardNumber": input_string,
                    "transactionDate": today.isoformat(),
                },
            )
            duplicate_check_response.raise_for_status()
            if duplicate_check_response.json()["exists"]:
                print(
                    f"[{device_id}] Duplicate input found, not logging: '{input_string}'"
                )
                sound_manager.play_failed()
                return

        try:
            quota_response = requests.get(
                f"{API_BASE_URL}/tenant/{tenant_id}/quota-state"
            )
            quota_response.raise_for_status()
            quota_state = quota_response.json()
        except requests.exceptions.RequestException as quota_error:
            print(f"[{device_id}] Gagal mengecek kuota tenant: {quota_error}")
            sound_manager.play_failed()
            return

        if not quota_state.get("can_order_for_target", True):
            print(
                f"[DEVICE TAP BLOCKED] tenant={tenant_info.get('name')} "
                f"employee={found_employee.get('employee_id')} "
                f"remaining={quota_state.get('remaining_for_target')} "
                f"max_remaining={quota_state.get('max_remaining_any')}"
            )
            sound_manager.play_limit_reached()
            return

        if quota_state.get("is_free_mode"):
            print(
                f"[DEVICE TAP FREE MODE] tenant={tenant_info.get('name')} "
                f"remaining={quota_state.get('remaining_for_target')} "
                f"max_remaining={quota_state.get('max_remaining_any')}"
            )

        tenant_name = tenant_info.get("name", "Unknown Tenant")
        timestamp = datetime.datetime.now()

        # Log transaction via API
        transaction_payload = {
            "cardNumber": input_string,
            "employeeId": found_employee.get("employee_id"),
            "employeeName": found_employee.get("name"),
            "employeeGroup": found_employee.get("employee_group"),
            "tenantId": tenant_id,
            "tenantName": tenant_name,
            "transactionDate": timestamp.isoformat(),
        }
        transaction_response = requests.post(
            f"{API_BASE_URL}/transaction", json=transaction_payload
        )
        transaction_response.raise_for_status()

        print(
            f"[{device_id}] Successfully logged transaction for card number: {input_string}"
        )
        sound_manager.play_success()

    except requests.exceptions.RequestException as e:
        print(f"Error during transaction processing via API: {e}")
        sound_manager.play_failed()
    except Exception as e:
        print(f"An unexpected error occurred during transaction processing: {e}")
        sound_manager.play_failed()


def handle_key_press(device_id, char):
    if device_id in debounce_timers and debounce_timers[device_id]:
        debounce_timers[device_id].cancel()

    with buffer_lock:
        if device_id not in input_buffers:
            input_buffers[device_id] = []
        input_buffers[device_id].append((device_id, char))
    debounce_timers[device_id] = threading.Timer(
        DEBOUNCE_SECONDS, log_buffer, args=[device_id]
    )
    debounce_timers[device_id].start()


def main():
    """Main function to run the keyboard listener and sound manager."""
    app_state.load_all_data()
    sound_manager.start_worker()

    def sse_listener():
        url = f"{API_BASE_URL}/sse"
        while True:
            try:
                with requests.get(url, stream=True, timeout=90) as response:
                    response.raise_for_status()
                    event_lines = []
                    for raw_line in response.iter_lines(decode_unicode=True):
                        if raw_line is None:
                            continue
                        line = raw_line.strip()
                        if not line:
                            if event_lines:
                                payload = "\n".join(event_lines)
                                event_lines = []
                                if payload.startswith("data:"):
                                    try:
                                        json_payload = payload.replace("data:", "", 1).strip()
                                        json.loads(json_payload)
                                        print("[SSE LISTENER] update diterima, refresh data tenant.")
                                        app_state.load_all_data()
                                    except json.JSONDecodeError:
                                        print("[SSE LISTENER] gagal parsing payload SSE.")
                            continue
                        if line.startswith(":"):
                            continue
                        event_lines.append(line)
            except Exception as exc:
                print(f"[SSE LISTENER] koneksi terputus: {exc}. Reconnect 5 detik.")
                time.sleep(5)

    global _sse_thread_started
    if not _sse_thread_started:
        threading.Thread(target=sse_listener, daemon=True).start()
        _sse_thread_started = True

    print("Starting raw keyboard input listener...")
    create_input_window_and_loop(handle_key_press)


if __name__ == "__main__":
    main()
