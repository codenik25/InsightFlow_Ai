# InsightFlow AI - API Specification (Phase 1)

## Health Endpoints

### 1. Top-Level Health Check
- **Endpoint**: `GET /api/health`
- **Description**: Returns overall service status and database connectivity probe.
- **Response `200 OK`**:
```json
{
  "status": "healthy",
  "project_name": "InsightFlow AI",
  "version": "0.1.0",
  "environment": "development",
  "timestamp": "2026-08-21T10:40:00.000Z",
  "database_connected": true,
  "details": "PostgreSQL database connection operational"
}
```

### 2. Versioned Health Check
- **Endpoint**: `GET /api/v1/health`
- **Description**: Versioned health check endpoint returning identical schema.

---

## Datasets & Ingestion Endpoints (Phase 1)

### 3. Upload & Profile CSV Dataset
- **Endpoint**: `POST /api/v1/datasets/upload`
- **Content-Type**: `multipart/form-data`
- **Payload**:
  - `file`: CSV File (`UploadFile`)
- **Validation Rules**:
  - File extension must be `.csv`.
  - Max upload size: 50 MB (configurable via `MAX_UPLOAD_SIZE_BYTES`).
  - Readability: UTF-8 / Latin-1 encoding with valid tabular rows.
- **Response `201 Created`**: `DatasetProfileResponse`
```json
{
  "dataset_id": "3b29a10f-621e-4c2f-b442-2d880d8591f1",
  "overview": {
    "filename": "sample_sales_data.csv",
    "total_rows": 6,
    "total_columns": 8,
    "file_size_bytes": 412,
    "memory_usage_bytes": 1024,
    "duplicate_rows": 0,
    "duplicate_row_percentage": 0.0,
    "empty_column_count": 0,
    "constant_column_count": 0
  },
  "columns": [
    {
      "name": "transaction_id",
      "inferred_type": "identifier",
      "null_count": 0,
      "null_percentage": 0.0,
      "unique_count": 6,
      "unique_percentage": 100.0,
      "sample_values": ["TXN-1001", "TXN-1002", "TXN-1003"],
      "numeric_stats": null,
      "categorical_stats": {
        "top_values": [
          {"value": "TXN-1001", "count": 1, "percentage": 16.67}
        ],
        "unique_count": 6
      },
      "datetime_stats": null
    },
    {
      "name": "units_sold",
      "inferred_type": "numeric",
      "null_count": 0,
      "null_percentage": 0.0,
      "unique_count": 6,
      "unique_percentage": 100.0,
      "sample_values": [15, 2, 45, 10, 8],
      "numeric_stats": {
        "min": 2.0,
        "max": 45.0,
        "mean": 15.0,
        "median": 9.0,
        "std": 15.44,
        "p25": 3.5,
        "p50": 9.0,
        "p75": 13.25
      },
      "categorical_stats": null,
      "datetime_stats": null
    }
  ],
  "quality": {
    "duplicate_row_count": 0,
    "duplicate_row_percentage": 0.0,
    "empty_columns": [],
    "constant_columns": []
  }
}
```

### 4. Get Saved Dataset Profile
- **Endpoint**: `GET /api/v1/datasets/{dataset_id}/profile`
- **Description**: Returns stored JSON data profile for a dataset by ID.
- **Response `200 OK`**: `DatasetProfileResponse`
- **Response `404 Not Found`**: Error details object.

### 5. List Datasets Metadata
- **Endpoint**: `GET /api/v1/datasets`
- **Query Parameters**:
  - `skip` (integer, default 0)
  - `limit` (integer, default 100)
- **Response `200 OK`**: `DatasetListResponse`
