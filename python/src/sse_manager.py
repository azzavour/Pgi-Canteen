import asyncio
import json
import time
from typing import List

main_event_loop = None
connections: List[asyncio.Queue] = []


async def trigger_sse_event_async(data: dict):
    """Asynchronously triggers an SSE event to all connected clients."""
    for q in connections:
        await q.put(data)


async def event_stream(request, keepalive_interval: int = 15):
    """Generator function for the SSE stream with keepalive to prevent idle disconnects."""
    q = asyncio.Queue()
    connections.append(q)
    try:
        while True:
            try:
                data = await asyncio.wait_for(q.get(), timeout=keepalive_interval)
            except asyncio.TimeoutError:
                if await request.is_disconnected():
                    break
                yield ": keepalive\n\n"
                continue

            if await request.is_disconnected():
                break

            json_data = json.dumps(data)
            tap_id = None
            if isinstance(data, dict):
                tap_id = data.get("tap_id")
            log_tap = tap_id or "N/A"
            print(f"[SSE] sent event tap_id={log_tap} ts={int(time.time() * 1000)}")
            yield f"data: {json_data}\n\n"
    except asyncio.CancelledError:
        print("Client disconnected.")
    finally:
        if q in connections:
            connections.remove(q)
