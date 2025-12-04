"""
This script is used for registering new hardware devices (e.g., card readers).

When run, it performs a destructive setup of the database by dropping and
recreating the 'devices' table. It then listens for input events.
Any input from a physical device triggers an attempt to register that device's
unique ID as a 'device_code' in the database.
"""
import threading
import os
from dotenv import load_dotenv

from src.inputs import create_input_window_and_loop
from src.sound_manager import SoundManager

import requests

load_dotenv()

# --- Configuration ---
API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8000")
DEBOUNCE_SECONDS = float(os.getenv("DEBOUNCE_SECONDS", 0.2))

# --- Global State ---
sound_manager = SoundManager(asset_dir="assets")
debounce_timers = {}  # Only need timers for debouncing


def setup_database():
    """
    Drops the existing devices table and recreates it using API calls.
    WARNING: This is a destructive operation.
    """
    print("Setting up the database... This will drop and recreate the 'devices' table via API.")
    try:
        # Delete all existing devices
        response = requests.delete(f"{API_BASE_URL}/device/all")
        response.raise_for_status()
        print(response.json()["message"])

        # Setup the devices table (create if not exists)
        response = requests.post(f"{API_BASE_URL}/device/setup")
        response.raise_for_status()
        print(response.json()["message"])

    except requests.exceptions.RequestException as e:
        print(f"API call failed during database setup: {e}")
    except Exception as e:
        print(f"An unexpected error occurred during database setup: {e}")


def register_device(device_code):
    """
    Checks if a device is registered by its ID and registers it if not, using API calls.
    """
    if not device_code:
        return

    print(f"Processing registration for device ID: {device_code}")
    try:
        # Check if device exists
        response = requests.get(f"{API_BASE_URL}/device/check/{device_code}")
        response.raise_for_status()
        exists = response.json()["exists"]

        if exists:
            print(f"Device '{device_code}' is already registered.")
            sound_manager.play_failed()  # Using 'failed' sound for already exists
        else:
            # Register new device
            response = requests.post(f"{API_BASE_URL}/device", json={"deviceCode": device_code})
            response.raise_for_status()
            print(response.json()["message"])
            sound_manager.play_success()

    except requests.exceptions.HTTPError as http_err:
        if http_err.response.status_code == 409:  # Conflict, device already exists
            print(f"Device '{device_code}' is already registered (API reported conflict).")
            sound_manager.play_failed()
        else:
            print(f"API call failed during device registration: {http_err}")
            sound_manager.play_failed()
    except requests.exceptions.RequestException as req_err:
        print(f"Network or API error during device registration: {req_err}")
        sound_manager.play_failed()
    except Exception as e:
        print(f"An unexpected error occurred during device registration: {e}")
        sound_manager.play_failed()


def process_registration_attempt(device_id):
    """
    The debounced function that triggers the registration of the device itself.
    """
    print(f"Debounced event triggered for device: {device_id}")
    # The device_id from the listener IS the device_code we want to register.
    register_device(device_id)


def handle_key_press(device_id, char):
    """
    Handles an input event from the listener. Any input from a device
    triggers a debounced registration attempt for that device's ID.
    The character ('char') is ignored.
    """
    if device_id in debounce_timers and debounce_timers[device_id].is_alive():
        debounce_timers[device_id].cancel()

    debounce_timers[device_id] = threading.Timer(
        DEBOUNCE_SECONDS, process_registration_attempt, args=[device_id]
    )
    debounce_timers[device_id].start()


def main():
    """
    Main function to set up the database and run the device registration listener.
    """
    setup_database()
    sound_manager.start_worker()

    print("\nStarting device registration listener...")
    print("Present a device (e.g., swipe a card on a reader) to register it.")
    create_input_window_and_loop(handle_key_press)


if __name__ == "__main__":
    main()