# InsightFlow AI

**InsightFlow AI** is an automated analytics and decision-intelligence platform designed to validate, clean, analyze, and generate insights from structured datasets.

This repository contains **Phase 1: CSV Dataset Ingestion & Data Profiling Engine** — featuring drag-and-drop CSV file ingestion, storage abstraction (`data/raw/`), deterministic column data type detection, automated dataset profiling, and interactive profile visualization dashboard.

---

## 🏗 Architecture Overview

```
InsightFlow/
├── backend/
│   ├── app/
│   │   ├── api/v1/endpoints/
│   │   │   ├── health.py        # /api/v1/health endpoint
│   │   │   └── datasets.py      # POST /upload and GET /{id}/profile endpoints
│   │   ├── core/
│   │   │   ├── config.py        # MAX_UPLOAD_SIZE_BYTES (50 MB) and UPLOAD_DIR
│   │   │   ├── logging.py       # Structured logging setup
│   │   │   └── database.py      # Sync SQLAlchemy 2.0 Engine with psycopg 3
│   │   ├── models/
│   │   │   └── dataset.py       # Dataset metadata ORM schema with status & profile_data
│   │   ├── schemas/
│   │   │   ├── dataset.py       # Dataset request/response Pydantic schemas
│   │   │   └── profile.py       # Profile overview, column stats, and quality summary schemas
│   │   ├── services/
│   │   │   ├── storage_service.py   # StorageProvider & LocalStorageProvider (data/raw/<uuid>.csv)
│   │   │   ├── type_detector.py     # Deterministic type classifier (numeric, datetime, boolean, id, etc.)
│   │   │   ├── profiling_service.py # Pandas-based dataset profiling engine
│   │   │   ├── health_service.py    # Database health probe service
│   │   │   └── dataset_service.py   # Ingestion, validation, profiling & CRUD orchestration
│   │   └── main.py              # FastAPI App factory, CORS, exception handlers
│   ├── alembic/
│   │   └── versions/
│   │       ├── 001_initial_dataset_schema.py
│   │       └── 002_add_dataset_status_and_profile.py # Migration for status & profile_data
│   ├── requirements.txt         # Backend dependencies
│   └── Dockerfile               # Backend container definition
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── DatasetUploadModal.tsx # CSV Drag-and-drop ingestion modal
│   │   │   ├── DatasetProfileView.tsx # Interactive dataset profile dashboard
│   │   │   ├── ColumnProfileTable.tsx # Column data type and null stats table
│   │   │   ├── Header.tsx             # System health status bar
│   │   │   ├── Sidebar.tsx            # Analytics navigation sidebar
│   │   │   ├── StatusCard.tsx         # Live DB & API environment probe
│   │   │   ├── DatasetSection.tsx     # Dataset metadata registry table
│   │   │   └── ArchitectureCard.tsx  # Stack overview
│   │   ├── services/
│   │   │   └── api.ts                 # Type-safe API client (uploadDataset, fetchDatasetProfile)
│   │   ├── types/
│   │   │   └── index.ts               # TypeScript interfaces (DatasetProfileData, ColumnProfile, etc.)
│   │   ├── App.tsx                    # Main dashboard container
│   │   ├── main.tsx                   # React entry point
│   │   └── index.css                  # Tailwind CSS styling
│   ├── package.json                   # Frontend dependencies
│   ├── vite.config.ts                 # Vite bundler & API proxy
│   └── Dockerfile                     # Frontend container definition
├── data/
│   ├── raw/                           # Isolated directory for raw uploaded CSV files (<uuid>.csv)
│   ├── processed/                     # Workspace for cleaned dataset outputs
│   └── sample_sales_data.csv          # Verified sample dataset for testing
├── docs/
│   ├── architecture.md                # System architecture documentation
│   └── api_spec.md                    # REST API endpoint specification
├── tests/
│   ├── test_upload.py                 # File upload, size limit, and storage provider tests
│   ├── test_type_detector.py          # Deterministic column type classification tests
│   ├── test_profiling_service.py      # Pandas dataset profiling engine tests
│   ├── test_dataset_api.py            # API endpoint integration tests
│   ├── test_config.py                 # Configuration system tests
│   ├── test_database.py               # Database connectivity & CRUD tests
│   ├── test_health.py                 # Health check endpoints tests
│   └── test_startup.py                # App startup tests
├── docker-compose.yml                 # PostgreSQL + FastAPI + Vite docker compose stack
├── .env.example                       # Environment variable template
└── README.md                          # Project documentation
```

---

## 🛠 Technology Stack

### Frontend
- **React 18** — Component-based UI.
- **TypeScript 5** — Strict type safety for profile schemas and API clients.
- **Vite 5** — High-performance frontend bundler.
- **Tailwind CSS 3** — Slate/indigo/emerald analytics design system.
- **Lucide Icons** — Iconography.

### Backend
- **Python 3.12** — Core backend runtime.
- **FastAPI 0.110+** — Asynchronous web framework.
- **Pandas 2.2** — Tabular data manipulation and profiling engine.
- **Pydantic v2** — API schema validation.
- **SQLAlchemy 2.0 & psycopg 3** — Database ORM & PostgreSQL driver.
- **Alembic** — Schema migrations.

---

## 🚀 Quickstart & Local Setup Instructions

### Step 1: Configure Environment

```powershell
cp .env.example .env
```

### Step 2: Start PostgreSQL Database Container

```powershell
docker-compose up -d db
```

### Step 3: Run Database Migrations

```powershell
python -m pip install -r backend/requirements.txt
cd backend
alembic upgrade head
cd ..
```

### Step 4: Start Backend API

```powershell
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
- Interactive Swagger Docs: `http://localhost:8000/docs`

### Step 5: Start Frontend Dashboard

```powershell
cd frontend
npm install
npm run dev
```
- Access Dashboard UI: `http://localhost:5173`

---

## 🧪 Automated Testing

Run the 24 backend unit and integration tests:

```powershell
python -m pytest tests/
```

Run frontend build check and TypeScript compilation:

```powershell
cd frontend
npm run build
```

---

## 📋 Phase 1 Scope & Features Implemented

- [x] **CSV Upload Endpoint** (`POST /api/v1/datasets/upload`): Validates file type, size, encoding, non-empty content.
- [x] **Storage Service Abstraction**: Securely stores raw files in `data/raw/<uuid>.csv` with filename sanitization.
- [x] **Deterministic Data Type Detection**: Classifies columns into `numeric`, `categorical`, `datetime`, `boolean`, `identifier`, `text`.
- [x] **Automated Data Profiling Engine**: Computes dataset row/column counts, memory usage, duplicate rows, missing percentage, numeric statistics (mean, median, std, min, max, quartiles), categorical value frequencies, and date ranges.
- [x] **Database Persistence**: Alembic migration `002` adding `status` and `profile_data` JSON column.
- [x] **Frontend Ingestion & Profile View**: Drag-and-drop upload modal, progress state, column profile table, numeric metrics breakdown, quality alerts, and categorical distributions.
- [x] **Automated Test Suite**: 24 tests passing 100%.

---

## 🎯 Next Recommended Step for Phase 2

**Phase 2 Focus**: **Automated Data Validation, Cleaning & Transformation Engine**
1. Implement dataset cleaning pipeline (handling missing values, dropping duplicate rows, casting data types).
2. Generate cleaned output datasets saved in `data/processed/`.
3. Provide interactive data cleaning preview and transformation configuration API.
#   I n s i g h t F l o w - A i  
 #   I n s i g h t F l o w - A i  
 