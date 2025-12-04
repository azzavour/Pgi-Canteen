import uvicorn
import asyncio
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api_routes import router as api_router
from . import sse_manager


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Manages the application's lifespan.
    Loads data on startup and prepares the event loop for SSE.
    """
    # Set the main event loop for the SSE manager
    sse_manager.main_event_loop = asyncio.get_running_loop()

    yield

    print("API shutting down.")


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)

if __name__ == "__main__":
    host = os.getenv("API_HOST", "127.0.0.1")
    port = int(os.getenv("API_PORT", "8000"))
    uvicorn.run("src.api:app", host=host, port=port, reload=True)
