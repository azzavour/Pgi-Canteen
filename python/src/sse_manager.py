import asyncio
import json
from typing import List

main_event_loop = None
connections: List[asyncio.Queue] = []


async def trigger_sse_event_async(data: dict):
    """Asynchronously triggers an SSE event to all connected clients."""
    for q in connections:
        await q.put(data)


async def event_stream(request):
    """Generator function for the SSE stream."""
    q = asyncio.Queue()
    connections.append(q)
    try:
        while True:
            data = await q.get()
            if await request.is_disconnected():
                break
            json_data = json.dumps(data)
            yield f"data: {json_data}\n\n"
    except asyncio.CancelledError:
        print("Client disconnected.")
    finally:
        if q in connections:
            connections.remove(q)
