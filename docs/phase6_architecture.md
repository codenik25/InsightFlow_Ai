# Phase 6 Architecture: ML Task Discovery & Predictive Analytics Foundation

## Overview
Phase 6 transforms InsightFlow AI from a descriptive and diagnostic analytics platform into a predictive decision-support platform. Machine Learning (ML) is applied deterministically based on dataset profiling, data quality, and column role classifications.

```
CSV Ingestion (Phase 1)
   ↓
Quality Scoring & Issues (Phase 2)
   ↓
Dataset Cleaning & Immutability (Phase 3)
   ↓
Automated EDA & Metric Discovery (Phase 4)
   ↓
Deterministic Business Insight Engine (Phase 5)
   ↓
ML Task Discovery & Feature Selection (Phase 6)
   ↓
Baseline Model Pipeline & Artifact Persistence (Phase 6)
   ↓
Model Selection & Predictions Engine (Phase 6)
```

## Existing Architecture Audit (Phase 1–5 Integration Points)

1. **Dataset Resolution & Lineage**:
   - `EDAService.resolve_target_dataset(db, dataset_id)` resolves the active dataset.
   - Raw datasets (`is_processed=False`) are checked for child cleaned datasets (`is_processed=True`). If no cleaned dataset exists, ML operations are rejected with HTTP 400.
   - Raw CSV files in `data/raw/` are completely immutable. ML models operate strictly on cleaned dataframes from `data/processed/`.

2. **Column & Data Type Detection**:
   - `TypeDetector` (`backend/app/services/type_detector.py`) classifies columns into `numeric`, `categorical`, `datetime`, `boolean`, `identifier`, and `text`.
   - `MetricDiscoveryService` (`backend/app/services/metric_discovery_service.py`) assigns business roles: `measure`, `categorical_dimension`, `datetime_dimension`, `identifier`, `boolean`, `text`.
   - Feature discovery in Phase 6 leverages these existing classification utilities without duplicating type detection logic.

3. **Data Integrity & Immutability**:
   - Training baseline models does not mutate stored processed dataset files.
   - Predictions and model evaluation metrics are persisted as immutable analysis records in PostgreSQL (`ml_analyses` table).

## ML Domain Model Design (`backend/app/models/ml_analysis.py`)

- **Table**: `ml_analyses`
- **Schema**:
  - `id`: `String(36)`, Primary Key (UUID)
  - `dataset_id`: `String(36)`, Foreign Key to `datasets.id` (CASCADE)
  - `task_type`: `String(50)`, indexed (`regression`, `classification`, `time_series_forecasting`, `anomaly_detection`)
  - `target_column`: `String(255)`, nullable (null for unsupervised anomaly detection)
  - `feature_columns`: `JSON`, list of included feature names
  - `model_name`: `String(100)`, name of selected model
  - `model_version`: `String(20)`, default `"1.0"`
  - `model_artifact_path`: `String(512)`, relative path to saved model artifact in `data/models/<uuid>.joblib`
  - `feature_schema`: `JSON`, schema map of feature names, expected dtypes, ordering
  - `preprocessing_config`: `JSON`, imputer and encoding configurations
  - `random_seed`: `Integer`, default `42`
  - `training_row_count`: `Integer`
  - `test_row_count`: `Integer`
  - `metrics`: `JSON`, dictionary of evaluation metrics (MAE, RMSE, R², F1, Accuracy, etc.)
  - `status`: `String(50)`, default `"completed"`
  - `result_data`: `JSON`, contains model evaluation candidates, feature explanations, data warnings
  - `selection_reason`: `Text`, human-readable explanation for model selection
  - `created_at`: `DateTime(timezone=True)`, default UTC timestamp

## ML Pipelines & Evaluation Semantics

Supervised Learning, Time-Series Forecasting, and Anomaly Detection pipelines are strictly separated:

1. **Supervised Learning Pipeline (Regression & Classification)**:
   - Built using scikit-learn `Pipeline` + `ColumnTransformer` (numeric imputer/scaler, categorical imputer/one-hot encoder).
   - Classification uses stratified train-test split (`stratify=y`) only when all class counts permit it (`min_class_count >= 2`); otherwise falls back to unstratified split.
   - Evaluated on test split. Best model pipeline is saved to disk using `joblib` at `data/models/<uuid>.joblib`.

2. **Time-Series Forecasting Pipeline**:
   - Strictly enforces **chronological evaluation** (never random shuffle split).
   - Sorts observations by datetime column. Splitting uses the first 80% chronologically for fitting and the last 20% for testing.
   - Evaluation metrics computed on chronological test set.

3. **Anomaly Detection Pipeline**:
   - Unsupervised fitting on numeric features using `IsolationForest` or Z-score outlier detection.
   - Evaluated on anomaly count, anomaly percentage, and score distributions.

## Model Artifact Persistence & Safe Inferences

- Models are trained during `POST /api/v1/datasets/{dataset_id}/ml/analyze` and serialized using `joblib` into `data/models/<analysis_id>.joblib`.
- Inference endpoints (`POST /api/v1/datasets/{dataset_id}/ml/{analysis_id}/predict`) load the persisted model artifact using `analysis_id` looked up directly from the database.
- **Security & Reliability**: No arbitrary client file paths are accepted. Models are NEVER re-fitted during prediction calls. Preprocessing steps execute identically using the fitted `ColumnTransformer` inside the saved `Pipeline`.

## API Routing (`backend/app/api/v1/endpoints/ml.py`)

- `GET /api/v1/datasets/{dataset_id}/ml/tasks`: Returns ranked ML task candidates.
- `POST /api/v1/datasets/{dataset_id}/ml/analyze`: Executes ML task discovery, feature discovery, baseline training, pipeline serialization, model selection, and stores analysis record.
- `GET /api/v1/datasets/{dataset_id}/ml`: Lists stored ML analysis records for a dataset.
- `GET /api/v1/datasets/{dataset_id}/ml/{analysis_id}`: Retrieves detailed analysis record.
- `POST /api/v1/datasets/{dataset_id}/ml/{analysis_id}/predict`: Loads stored artifact and generates predictions for user-supplied input data.

## Frontend Navigation & UI (`frontend/src/components/MLInsightsDashboard.tsx`)

Adds a new **Predictive Analytics** tab within the dataset view displaying:
- Recommended ML tasks with suitability scores & reasons.
- Selected target and feature breakdown (included vs excluded features with reasons).
- Evaluated model metrics table.
- Selected model badge & explainable selection rationale.
- Sample size warning badge.
- Interactive Prediction form to run inference using saved model artifacts.
