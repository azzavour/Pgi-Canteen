# Canteen Transaction System Backend

This project is a Python-based backend server designed to manage real-time transactions, such as meal voucher redemptions in a canteen or corporate cafeteria. It uses FastAPI for the web framework and listens for raw keyboard input, simulating a card reader for employee identification.

The system provides real-time feedback through audio cues and pushes live updates to a connected frontend via Server-Sent Events (SSE).

## Features

-   **Real-time Transaction Logging**: Captures 10-digit card numbers from raw keyboard input.
-   **Device-to-Tenant Mapping**: Assigns physical input devices to specific tenants (e.g., food stalls).
-   **Employee Validation**: Validates scanned card numbers against a predefined list of employees.
-   **Daily Quotas**: Enforces transaction limits per device, with different limits for morning and afternoon sessions.
-   **Audio Feedback**: Plays success, failure, or limit-reached sounds for immediate operational feedback.
-   **Live Frontend Updates**: Uses Server-Sent Events (`/sse`) to push transaction data to a web dashboard in real-time.
-   **REST API**: Provides endpoints to manage tenants, devices, employees, and view historical transaction reports.
-   **Modular & Decoupled Structure**: The web API and the hardware input listener are separated, allowing them to be run and scaled independently.

## Project Setup

Follow these steps to set up the development environment, configure the database, and run the project locally.

### Prerequisites

- **Python 3.8+**
- **Pip** (Python package installer)

### Installation and Configuration

**Step 1: Create and Activate a Virtual Environment**
This isolates the project's dependencies from your system's Python installation.
-   **On macOS/Linux:**
    ```bash
    python3 -m venv venv
    source venv/bin/activate
    ```
-   **On Windows:**
    ```bash
    python -m venv venv
    .\venv\Scripts\activate
    ```

**Step 2: Configure Environment Variables**
Create a `.env` file in the project root to specify the path for the SQLite database file.
```bash
cp .env.example .env
```
By default, the database will be created at `data/canteen.db`. You can change this path in the `.env` file.

**Step 3: Install Python Dependencies**
Install all the required Python libraries from the `requirements.txt` file.
```bash
pip install -r requirements.txt
```

**Step 4: Set Up the Database**
The SQLite database and all necessary tables are created automatically when the application starts. You can also set up the database manually by running the following command from the project root directory:
```bash
python -m src.sqlite_database
```

## Running the Application

The application is split into two main components that must be run separately in **two different terminal windows**. Ensure your virtual environment is activated in both.

### Terminal 1: Start the FastAPI Web Server

This process runs the web API, serves the endpoints, and manages the Server-Sent Events (SSE) connection for the frontend. The server now automatically uses the `API_HOST` and `API_PORT` variables from your `.env` file.

From the project root directory, run:
```bash
python -m src.api
```
The API will be available at the host and port specified in your `.env` file (e.g., `http://127.0.0.1:8000`). The server will also automatically reload when code changes are detected.

### Terminal 2: Start the Keyboard Input Listener

This process listens for raw keyboard input (simulating the card reader) and plays audio feedback. It communicates with the web server to log transactions and trigger live updates on the frontend.

From the project root directory, run:
```bash
python -m src.main
```
Once both processes are running, the system is fully operational.

## API Endpoints

The API is divided into public-facing endpoints for the frontend and internal endpoints for system communication.

### Public API

| Method   | Path                      | Description                                                                                                                        |
| :------- | :------------------------ | :--------------------------------------------------------------------------------------------------------------------------------- |
| `GET`    | `/sse`                    | Establishes a Server-Sent Events connection for live updates.                                                                      |
| `GET`    | `/employee`               | Retrieves the list of all employees.                                                                                               |
| `POST`   | `/employee`               | Creates a new employee.                                                                                                            |
| `GET`    | `/employee/{employee_id}` | Retrieves a single employee by their ID.                                                                                           |
| `PUT`    | `/employee/{employee_id}` | Updates an employee's details (e.g., `cardNumber`, `name`, `employeeGroup`, `is_disabled`).                                        |
| `DELETE` | `/employee/{employee_id}` | Deletes an employee.                                                                                                               |
| `GET`    | `/tenant`                 | Retrieves the list of all tenants.                                                                                                 |
| `POST`   | `/tenant`                 | Creates a new tenant.                                                                                                              |
| `GET`    | `/tenant/{tenant_id}`     | Retrieves a single tenant by its ID.                                                                                               |
| `PUT`    | `/tenant/{tenant_id}`     | Updates a tenant's details (e.g., `name`, `menu`, `is_limited`).                                                                   |
| `DELETE` | `/tenant/{tenant_id}`     | Deletes a tenant.                                                                                                                  |
| `GET`    | `/device`                 | Retrieves a list of all devices and their assigned tenants.                                                                        |
| `PUT`    | `/device/{device_id}`     | Assigns or unassigns a tenant for a specific device.                                                                               |
| `GET`    | `/report/transactions`    | Retrieves a paginated and filterable list of transactions. Supports filtering by employee group, employee, tenant, and date range. |

#### `/report/transactions` Query Parameters

| Parameter        | Type      | Description                                                      |
| :--------------- | :-------- | :--------------------------------------------------------------- |
| `employee_group` | `string`  | Filter by employee group (case-insensitive, partial match).      |
| `employee`       | `string`  | Filter by employee name or ID (case-insensitive, partial match). |
| `tenant`         | `string`  | Filter by tenant name or ID (case-insensitive, partial match).   |
| `start_date`     | `string`  | Start date for filtering (format: `YYYY-MM-DD`).                 |
| `end_date`       | `string`  | End date for filtering (format: `YYYY-MM-DD`).                   |
| `page`           | `integer` | The page number for pagination (starts at 1). Default: `1`.      |
| `page_size`      | `integer` | The number of items per page. Default: `10`.                     |

### Internal API

These endpoints are used for communication between the system's components.

| Method | Path                    | Description                                                                              |
| :----- | :---------------------- | :--------------------------------------------------------------------------------------- |
| `POST` | `/internal/sse/trigger` | Used by the keyboard listener (`main.py`) to trigger a live SSE update for the frontend. |
