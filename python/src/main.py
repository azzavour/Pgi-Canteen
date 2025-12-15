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
TAP_REQUEST_TIMEOUT_SECONDS = float(os.getenv("TAP_REQUEST_TIMEOUT_SECONDS", 2.0))

# --- Global State for this process ---
sound_manager = SoundManager(asset_dir="assets")
input_buffers = {}
debounce_timers = {}
buffer_lock = threading.Lock()
last_input_strings = {}
_sse_thread_started = False
tap_request_times: dict[str, dict[str, int]] = {}
tap_request_lock = threading.Lock()


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
        tenant_info = app_state.device_to_tenant_map.get(device_id, {})

        if not tenant_info:
            print(
                f"Warning: Device ID '{device_id}' not found in tenant map. Transaction not logged."
            )
            sound_manager.play_failed({"tap_id": None})
            return

        tenant_id = tenant_info.get("id")

        if tenant_id is None:
            print(
                f"[{device_id}] Tenant ID tidak ditemukan dalam mapping. Transaksi dibatalkan."
            )
            sound_manager.play_failed({"tap_id": None})
            return

        tenant_name = tenant_info.get("name", "Unknown Tenant")
        tap_epoch_ms = int(time.time() * 1000)
        tap_id = f"{input_string}-{tap_epoch_ms}"
        tap_payload = {
            "card_number": input_string,
            "tenant_id": tenant_id,
            "tap_ts": datetime.datetime.now().astimezone().isoformat(),
            "tap_id": tap_id,
        }

        def trigger_sound(sound_type: str):
            sound_metadata = {"tap_id": tap_id}
            t_sound_trigger = int(time.time() * 1000)
            print(
                f"[tap_device] tap_id={tap_id} stage=sound_trigger sound={sound_type} t_sound_trigger={t_sound_trigger}"
            )
            if sound_type == "success":
                sound_manager.play_success(sound_metadata)
            elif sound_type == "limit_reached":
                sound_manager.play_limit_reached(sound_metadata)
            else:
                sound_manager.play_failed(sound_metadata)

        request_start_ms = int(time.time() * 1000)
        print(
            f"[tap_device] tap_id={tap_id} stage=request_start device={device_id} ts={request_start_ms}"
        )
        response = requests.post(
            f"{API_BASE_URL}/tap",
            json=tap_payload,
            timeout=TAP_REQUEST_TIMEOUT_SECONDS,
        )
        request_end_ms = int(time.time() * 1000)
        rtt_ms = request_end_ms - request_start_ms
        print(
            f"[tap_device] tap_id={tap_id} stage=request_end device={device_id} ts={request_end_ms} rtt_ms={rtt_ms:.2f} status_code={response.status_code}"
        )
        response.raise_for_status()
        response_data = response.json()
        server_tap_id = response_data.get("tap_id") or tap_id
        status_value = response_data.get("status")
        reason_value = response_data.get("reason")
        server_commit_ts = response_data.get("server_commit_ts")
        tap_id = server_tap_id
        print(
            f"[tap_device] tap_id={tap_id} stage=response_parsed status={status_value} reason={reason_value} server_commit_ts={server_commit_ts}"
        )

        if status_value == "accepted":
            with tap_request_lock:
                tap_request_times[tap_id] = {
                    "request_start_ms": request_start_ms,
                    "request_end_ms": request_end_ms,
                }
            trigger_sound("success")
            print(
                f"[{device_id}] TAP success for card {input_string} -> tenant {tenant_name}"
            )
        else:
            if reason_value == "quota_exceeded":
                trigger_sound("limit_reached")
            else:
                trigger_sound("failed")

    except requests.exceptions.RequestException as e:
        request_error_ts = int(time.time() * 1000)
        print(
            f"[tap_device] tap_id={locals().get('tap_id', 'NA')} stage=request_exception ts={request_error_ts} error={e}"
        )
        sound_manager.play_failed({"tap_id": locals().get("tap_id")})
    except Exception as e:
        print(f"An unexpected error occurred during transaction processing: {e}")
        sound_manager.play_failed({"tap_id": locals().get("tap_id")})


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
                                        event_data = json.loads(json_payload)
                                        tap_id = event_data.get("tap_id")
                                        server_commit_ts = event_data.get("server_commit_ts")
                                        t_sse_received = int(time.time() * 1000)
                                        delta_ms = (
                                            t_sse_received - server_commit_ts
                                            if isinstance(server_commit_ts, int)
                                            else None
                                        )
                                        print(
                                            f"[tap_sse] tap_id={tap_id or 'N/A'} stage=sse_received t_sse_received={t_sse_received}"
                                            + (
                                                f" server_commit_ts={server_commit_ts} delta_ms={delta_ms}"
                                                if server_commit_ts
                                                else ""
                                            )
                                        )
                                        start_info = None
                                        if tap_id:
                                            with tap_request_lock:
                                                start_info = tap_request_times.pop(tap_id, None)
                                        if start_info:
                                            total_elapsed = (
                                                t_sse_received
                                                - start_info.get("request_start_ms", t_sse_received)
                                            )
                                            print(
                                                f"[tap_sse] tap_id={tap_id} stage=sse_total_elapsed total_ms={total_elapsed}"
                                            )
                                        print("[SSE LISTENER] update diterima, refresh data tenant.")
                                        app_state.load_all_data()
                                        print(
                                            f"[tap_sse] tap_id={tap_id or 'N/A'} stage=app_state_refreshed ts={int(time.time() * 1000)}"
                                        )
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
