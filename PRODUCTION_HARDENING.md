# InsightFlow AI — Production Hardening & Operational Guide (Phase 15)

## 1. Executive Summary & Production Posture

InsightFlow AI is a deterministic, evidence-backed decision intelligence platform engineered with a strict boundary between analytical computation, decision governance, and operational execution. 

Phase 15 hardens the platform for production deployment across:
- **Security & Tenancy**: Multi-tenant isolation at dataset, decision, execution, outcome, and knowledge boundaries.
- **Observability**: Standardized structured logging, response time injection (`X-Response-Time-Ms`), and dedicated liveness/readiness probes.
- **Resilience**: Safe error containment avoiding traceback or credential exposure, idempotent mutation protection, and transactional integrity.
- **Defensive Headers**: Injection of `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, and `X-XSS-Protection`.

---

## 2. Required Environment Variables

InsightFlow AI validates all configuration at boot-time via Pydantic (`app.core.config.Settings`).

### Core Application Settings

| Variable | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `PROJECT_NAME` | String | `"InsightFlow AI"` | Public display name of the platform |
| `ENVIRONMENT` | String | `"development"` | Target environment (`"development"`, `"staging"`, `"production"`, `"testing"`). In `"production"`, `DEBUG` is strictly forced to `False`. |
| `DEBUG` | Boolean | `False` (in prod) | Debug mode. **Must be false in production**. |
| `LOG_LEVEL` | String | `"INFO"` | Logging verbosity (`"DEBUG"`, `"INFO"`, `"WARNING"`, `"ERROR"`). Engine SQL echoing is suppressed in production. |
| `HOST` | String | `"0.0.0.0"` | Bind interface address |
| `PORT` | Integer | `8000` | Bind port |
| `BACKEND_CORS_ORIGINS` | JSON List | `["http://localhost:5173", ...]` | Allowed HTTP origins. **Wildcard `["*"]` is strictly rejected at startup when `ENVIRONMENT="production"`.** |

### Database Settings (PostgreSQL)

InsightFlow AI uses SQLAlchemy 2.0 with the modern `psycopg3` driver.

| Variable | Type | Example | Description |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` | String | `postgresql+psycopg://user:pass@host:5432/dbname` | Full primary connection string |
| `POSTGRES_SERVER` | String | `"localhost"` | Hostname or IP of PostgreSQL instance |
| `POSTGRES_PORT` | Integer | `5432` | PostgreSQL port |
| `POSTGRES_USER` | String | `"insightflow_user"` | Database role |
| `POSTGRES_PASSWORD` | String | `"<strong-password>"` | Role authentication secret |
| `POSTGRES_DB` | String | `"insightflow_db"` | Logical database name |

### Storage Backend Settings

| Variable | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `STORAGE_BACKEND` | String | `"local"` | Storage engine: `"local"` or `"supabase"` |
| `UPLOAD_DIR` | String | `"./uploads"` | Directory for local artifact storage |
| `MAX_UPLOAD_SIZE_MB` | Integer | `50` | Maximum allowable upload size in megabytes |
| `SUPABASE_URL` | String | `None` | Required if `STORAGE_BACKEND="supabase"` |
| `SUPABASE_SERVICE_KEY` | String | `None` | Required if `STORAGE_BACKEND="supabase"` |
| `SUPABASE_BUCKET_NAME` | String | `"datasets"` | Supabase storage bucket name |

---

## 3. Health & Readiness Probes

InsightFlow AI separates process liveliness from operational dependency readiness:

### Liveness Probe (`GET /health/live`)
- **Purpose**: Verifies that the FastAPI process is responsive and event loop is healthy.
- **Target Response**: HTTP 200 `{"status": "live", "project_name": "InsightFlow AI", "version": "0.1.0"}`
- **Use Case**: Container orchestrators (Docker, Kubernetes) restart condition.

### Readiness Probe (`GET /health/ready`)
- **Purpose**: Verifies database connectivity and readiness to serve queries by executing a lightweight probe (`SELECT 1`).
- **Target Response**: 
  - **Healthy**: HTTP 200 `{"status": "ready", "database_connected": true, ...}`
  - **Degraded**: HTTP 503 `{"status": "not_ready", "database_connected": false, "details": "Safe non-leaking message"}`
- **Security Rule**: Error details never reveal database credentials, usernames, hosts, or raw tracebacks.
- **Use Case**: Ingress routing and load-balancer traffic readiness.

### Overview Endpoint (`GET /health` or `GET /api/v1/health`)
- Returns combined service status, environment, version, and database state.

---

## 4. Security & Tenancy Model

### Project & Workspace Isolation
- All operational and analytical resources (`datasets`, `decisions`, `executions`, `outcomes`, `knowledge`, `evidence`) are partitioned by `project_id`.
- Endpoints accept `project_id` and enforce boundary cross-validation. Mismatched resource and project requests yield `HTTP 404 NOT FOUND` to prevent information disclosure (IDOR prevention).
- Dataset operations (`/profile`, `/quality`, `/cleaning`, `/versions`, `/runs`) strictly verify ownership before execution.

### Upload Security
- **Path Traversal Protection**: Filenames undergo sanitization via `sanitize_filename()` stripping Windows (`\`) and POSIX (`/`) separators, directory traversal sequences (`..`), and unsafe characters.
- **File Type Enforcement**: File inspection verifies CSV media type; non-CSV files and empty files return HTTP 400.
- **Size Enforcement**: Ingestion streams enforce a hard cap at `MAX_UPLOAD_SIZE_MB` (default 50MB).

### Defensive Security Headers
Every API response is injected with security headers via ASGI middleware:
```http
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
X-XSS-Protection: 1; mode=block
X-Response-Time-Ms: 1.25
```

### Safe Error Handling
- Unhandled 500 exceptions are trapped by a global handler returning:
  `{"detail": "Internal Server Error. Please contact support.", "error": "Internal Server Error"}`
- Stack traces are logged server-side with unique request context and **never** returned across HTTP.
- Pydantic validation errors (422) return structured error lists without system leakage.

---

## 5. Database & Transaction Safety

1. **Connection Pooling**: Uses SQLAlchemy `QueuePool` with sensible defaults.
2. **Transaction Integrity**: Mutations are scoped to database sessions with explicit rollback on error.
3. **Audit Immutability**:
   - `evidence_edges`: Append-only DAG linking datasets, analysis runs, insights, decisions, executions, and outcomes.
   - `decision_governance_events`: Append-only audit trail for approvals, rejections, and reviews.
   - `decision_execution_events`: Append-only event history for execution lifecycle transitions.
4. **Idempotency**: Repeated calls to evidence recording deduplicate cleanly without throwing duplicate constraint errors.

---

## 6. Observability & Logging

- **Format**: Structured text and JSON-compatible logging via `app.core.logging`.
- **Query Noise Suppression**: SQLAlchemy engine SQL echoing is suppressed to `WARNING` in production to prevent log saturation.
- **Request Timing**: Each request measures execution latency and returns `X-Response-Time-Ms` in HTTP headers.
- **Sensitive Data Masking**: Request logging records method, route, status code, and latency; request authorization headers, cookies, and upload payloads are omitted from logs.

---

## 7. Deployment Expectations (Docker Compose)

The platform is bundled for containerized operation using Docker Compose:

```bash
# 1. Clone repository and configure production environment
cp .env.example .env
# Edit .env to set ENVIRONMENT=production, secure passwords, and allowed origins

# 2. Build and start containers
docker compose up -d --build

# 3. Verify health
curl -f http://localhost:8000/health/ready
```

### Services Defined:
- **`db`**: PostgreSQL 16 Alpine container with healthcheck (`pg_isready`).
- **`backend`**: FastAPI application running on Uvicorn.
- **`frontend`**: Single-page application built with React, Vite, and TypeScript.

---

## 8. Backup & Recovery Operations

Operational responsibility for data persistence is divided as follows:

| Responsibility | Component | Operational Procedure |
| :--- | :--- | :--- |
| **Infrastructure / DBA** | PostgreSQL Data | Scheduled `pg_dump` or managed DB point-in-time recovery (PITR). Database volume: `postgres_data`. |
| **Infrastructure / Ops** | Dataset Storage | If `STORAGE_BACKEND="local"`, backup the `./uploads` persistent directory. If `STORAGE_BACKEND="supabase"`, manage bucket versioning in Supabase dashboard. |
| **Application Layer** | Audit Trail Integrity | The application guarantees append-only referential integrity across audit events and evidence edges. |

---

## 9. Known Architectural Boundaries

To maintain factual engineering transparency:
- **Authentication**: Phase 15 enforces strict project/workspace tenancy boundaries and input validation. User identity management (OAuth/SSO/RBAC) is delegated to upstream reverse proxies/API gateways or future enterprise identity phases.
- **Async Execution**: Heavy analytical calculations execute synchronously within FastAPI request handlers. Redis, Kafka, or Celery background task workers are not present in this lightweight deployment model.
- **High Availability**: When deployed with multiple backend replicas, use a centralized PostgreSQL database and configure `STORAGE_BACKEND="supabase"` (or shared network mount) so uploaded files are accessible across all nodes.
