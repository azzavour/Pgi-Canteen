import requests

API_BASE_URL = "http://127.0.0.1:8000"   # atau IP server kamu
TENANT_ID = 1                            # ganti: tenant device yang mau dites
EMPLOYEE_ID = "90001"                    # emp_id dummy kamu
CARD_ID = "CARD90001"                   # bebas atau yang ada di DB

def simulate_tap():
    # 1. tanya kuota dulu
    r = requests.get(f"{API_BASE_URL}/tenant/{TENANT_ID}/quota-state")
    r.raise_for_status()
    data = r.json()
    print("quota-state:", data)

    if not data["can_order_for_target"]:
        print("➡ TAP DIBLOKIR oleh helper (can_order_for_target = False)")
        return

    # 2. kalau boleh, kirim transaksi seperti device
    payload = {
        "employeeid": EMPLOYEE_ID,
        "tenantId": TENANT_ID,
        "transactionDate": CARD_ID,  # sesuaikan field persis dengan /transaction kamu
    }
    r2 = requests.post(f"{API_BASE_URL}/transaction", json=payload)
    print("transaction response:", r2.status_code, r2.text)

if __name__ == "__main__":
    simulate_tap()
