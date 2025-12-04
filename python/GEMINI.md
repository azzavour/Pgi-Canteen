# Project Overview

This project is a Python-based backend for a canteen transaction system. It uses the FastAPI framework to create a web server that manages real-time transactions, such as meal voucher redemptions. The system is designed to work with a hardware card reader (simulated by raw keyboard input) for employee identification.

The backend is split into two main components:
1.  A FastAPI web server that provides a REST API and sends real-time updates to a frontend using Server-Sent Events (SSE).
2.  A separate Python script that listens for raw keyboard input, processes the card swipes, and communicates with the FastAPI server.

The system uses a SQLite database to store all data, including transactions, employees, tenants (food stalls), and device-to-tenant mappings.

## Building and Running

### Prerequisites

-   Python 3.8+
-   Pip

### Setup

1.  **Create and activate a virtual environment:**
    ```bash
    python -m venv .venv
    .\.venv\Scripts\activate
    ```

2.  **Install dependencies:**
    ```bash
    pip install -r requirements.txt
    ```

3.  **Set up the database:**
    -   Run the migration script to create the SQLite database and import the data from the `example/data` directory:
    ```bash
    python -m src.migrate_to_sqlite
    ```
    This will create a `canteen.db` file in the `data` directory.

### Running the Application

The application requires two separate terminals to run both the web server and the keyboard listener.

1.  **Terminal 1: Start the FastAPI Web Server**
    ```bash
    uvicorn src.api:app --reload
    ```
    The API will be available at `http://localhost:8000`.

2.  **Terminal 2: Start the Keyboard Input Listener**
    ```bash
    python -m src.main
    ```

## Development Conventions

-   **Database:** The application uses a SQLite database (`data/canteen.db`) for all data storage. The `src/sqlite_database.py` module is responsible for the database connection and schema.
-   **Data Management:**
    -   All data (transactions, employees, tenants, devices) is stored in the SQLite database.
    -   The `src/app_state.py` module manages loading data from the database into memory on startup.
-   **API:** The API is built with FastAPI. Routes are defined in `src/api_routes.py`.
-   **Real-time Updates:** Server-Sent Events (SSE) are used to push real-time updates to the frontend. The SSE logic is handled in `src/app_state.py`.
-   **Hardware Interaction:** The `src/main.py` script handles the raw keyboard input, simulating a card reader. It uses the `requests` library to communicate with the FastAPI server.
-   **Audio Feedback:** The `pygame` library is used to provide audio feedback (success, failure, etc.) for card swipes. The `src/sound_manager.py` module manages the audio playback.
-   **Data Migration:** The `src/migrate_to_sqlite.py` script is used to populate the database from the example JSON files.
