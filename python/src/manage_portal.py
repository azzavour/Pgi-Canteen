import argparse

from .portal_control import read_override, set_override


def main():
    parser = argparse.ArgumentParser(
        description="Atur status portal Cawang Canteen (override jam buka/tutup)."
    )
    parser.add_argument(
        "action",
        choices=["open", "normal", "close", "status"],
        help=(
            "'open' memaksa portal selalu buka, 'close' memaksa tutup, "
            "'normal' kembali ke jadwal 08:00-11:00, 'status' menampilkan kondisi override."
        ),
    )
    args = parser.parse_args()

    if args.action == "status":
        override = read_override()
        if override == "open":
            print("Portal sedang dipaksa BUKA.")
        elif override == "closed":
            print("Portal sedang dipaksa TUTUP.")
        else:
            print("Portal mengikuti jadwal normal (08:00-11:00).")
        return

    if args.action == "open":
        set_override("open")
        print("Override diset: portal akan selalu BUKA (abaikan jam).")
    elif args.action == "close":
        set_override("closed")
        print("Override diset: portal ditutup manual.")
    else:  # normal
        set_override(None)
        print("Override dihapus. Portal kembali mengikuti jadwal normal.")


if __name__ == "__main__":
    main()
