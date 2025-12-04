import requests
import os
from dotenv import load_dotenv

load_dotenv()

API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8000")

employee_data = []
tenant_data = {}
device_to_tenant_map = {}


def load_all_data():
    """Loads all necessary data from the API into memory."""
    global employee_data, tenant_data, device_to_tenant_map

    try:
        # Load employees from API
        employees_response = requests.get(f"{API_BASE_URL}/employee")
        employees_response.raise_for_status()
        employee_data = employees_response.json()

        # Load tenants from API
        tenants_response = requests.get(f"{API_BASE_URL}/tenant")
        tenants_response.raise_for_status()
        tenants_list = tenants_response.json()
        tenant_data = {tenant["id"]: tenant for tenant in tenants_list}

        # Load assigned devices with tenant info from API
        assigned_devices_response = requests.get(f"{API_BASE_URL}/device/assigned")
        assigned_devices_response.raise_for_status()
        assigned_devices = assigned_devices_response.json()

        new_map = {}
        for device in assigned_devices:
            device_code = device.get("device_code")
            tenant_info = device.get("tenant")
            if device_code and tenant_info:
                new_map[device_code] = tenant_info
        device_to_tenant_map = new_map

        print("Data loaded from API successfully.")

    except requests.exceptions.RequestException as e:
        print(f"Error loading data from API: {e}")
    except Exception as e:
        print(f"An unexpected error occurred during data loading: {e}")