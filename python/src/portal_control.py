import json
import os
from pathlib import Path
from typing import Optional

CONTROL_FILE = os.getenv("PORTAL_CONTROL_FILE", "data/portal_control.json")


def _control_path() -> Path:
    path = Path(CONTROL_FILE)
    if not path.is_absolute():
        base = Path(__file__).resolve().parents[1]
        path = base / path
    return path


def read_override() -> Optional[str]:
    path = _control_path()
    try:
        with path.open("r", encoding="utf-8") as f:
            data = json.load(f)
        return data.get("override")
    except FileNotFoundError:
        return None
    except json.JSONDecodeError:
        return None


def set_override(mode: Optional[str]) -> None:
    path = _control_path()
    if not mode or mode == "normal":
        if path.exists():
            path.unlink()
        return

    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump({"override": mode}, f)
