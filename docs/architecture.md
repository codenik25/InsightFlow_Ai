# InsightFlow AI - System Architecture Document (Phase 1)

## Overview
InsightFlow AI is designed as a modular, high-performance automated analytics and decision-intelligence platform.

## Phase 1 Architecture: CSV Ingestion & Data Profiling

```
                                +-----------------------------------+
                                |   React + TypeScript Frontend     |
                                | (Drag-and-Drop CSV, Profile View) |
                                +-----------------+-----------------+
                                                  |
                                                  | POST /api/v1/datasets/upload
                                                  v
                                +-----------------+-----------------+
                                |        FastAPI Backend            |
                                |  +-----------------------------+  |
                                |  | Routers (Thin API Handlers) |  |
                                |  +--------------+--------------+  |
                                |                 |                 |
                                |  +--------------v--------------+  |
                                |  | Services (Business Logic)   |  |
                                |  | - StorageService            |  |
                                |  | - TypeDetector              |  |
                                |  | - ProfilingService          |  |
                                |  | - DatasetService            |  |
                                |  +-------+-------------+-------+  |
                                |          |             |          |
                                +----------|-------------|----------+
                                           |             |
                         Save <uuid>.csv   |             | Store Metadata & Profile JSON
                                           v             v
                                +----------+----+   +----+----------+
                                |  Local / Cloud|   |   PostgreSQL  |
                                | Storage Engine|   |    Database   |
                                |  (data/raw/)  |   |   (datasets)  |
                                +---------------+   +---------------+
```

## Storage & Ingestion Security
- **Storage Abstraction**: Uploaded raw CSV files are saved via `StorageProvider` interface (`LocalStorageProvider`) into `data/raw/<uuid>.csv`.
- **Filename Sanitization**: User-supplied filenames are sanitized to strip path traversals and special characters before storing original name as metadata.
- **Path Isolation**: Internal filesystem paths are never returned in API responses; relative storage keys are used.
- **File Validation**: Strict `.csv` extension verification, maximum file size enforcement (configurable via `MAX_UPLOAD_SIZE_BYTES`), and UTF-8/Latin-1 encoding checks.

## Deterministic Data Type Detection
Column classification is driven by `TypeDetector`:
- `identifier`: Recognized via name patterns (e.g. `_id`, `uuid`, `code`, `number`) or 100% unique sequence.
- `datetime`: ISO format strings or parseable date sequences.
- `boolean`: Logical values and boolean subsets.
- `numeric`: Floating point and integer metrics.
- `categorical`: String columns with low cardinality / unique ratio (< 30%).
- `text`: High cardinality free-form string text.
