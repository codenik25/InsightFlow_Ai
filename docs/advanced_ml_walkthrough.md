# Advanced ML Intelligence Layer - Technical Walkthrough

This document outlines the architecture, pipeline design, API contracts, and verification details of the Advanced ML Intelligence Layer implemented in InsightFlow AI.

---

## 1. XGBoost Model Benchmarking Architecture

### Pipeline Integration
- Integrated XGBoost candidate models (`XGBRegressor` for regression and `XGBClassifierWrapper` for classification) into the candidate model evaluation pipeline in `MLTaskService`.
- Model candidates are evaluated against validation metrics (RMSE, MAE, R², MAPE for regression; Accuracy, Precision, Recall, F1 for classification).
- Candidate model selection remains deterministic (`random_state=42`).
- Trained winning models are persisted as joblib artifacts and seamlessly loaded for prediction and explainability.

### Graceful Fallback
- `HAS_XGBOOST` module detection checks XGBoost availability at startup.
- If XGBoost is unavailable in the execution environment, candidate evaluation automatically degrades to Random Forest and Linear/Logistic models without crashing.

### Frontend Benchmarking UI
- The ML Insights Dashboard features an explicit **MODEL BENCHMARK** card displaying:
  - Candidate model names (with ⭐ badge highlighting the winning model).
  - Validation metrics table.
  - Status labels (`SELECTED` vs `CANDIDATE`).
  - Clear rationale text explaining model selection based on validation performance.

---

## 2. Real Demand Forecasting Architecture

### Chronological Pipeline & Safety
- **Detection**: Automatically identifies sequential date/timestamp columns and continuous demand/sales targets.
- **Chronological Split**: Enforces sequential train/validation splitting (first 80% historical rows for training, trailing 20% for validation) to prevent future data leakage.
- **Feature Engineering**:
  - `trend_index`: Continuous sequential time index.
  - Calendar features: `day_of_week`, `day_of_month`, `month`.
  - Temporal Lags: `lag_1`, `lag_7` (created dynamically when dataset row count permits).
  - Rolling Windows: `rolling_mean_3`.
- **Uncertainty Bounds**: Computes model-based residual standard error bounds (lower & upper confidence intervals).
- **Data Sufficiency**:
  - Sample size <30 rows: `confidence = "EXPLORATORY"` with explicit warning banners.
  - 30-100 rows: `confidence = "LIMITED"`.
  - >100 rows: `confidence = "STANDARD"`.

### Business Interpretation
- Non-causal phrasing (*"The model projects..."*, *"The forecast indicates..."*).
- Highlights peak forecast period, lowest forecast period, and percentage change.

---

## 3. Production-Grade Anomaly Intelligence

### Unsupervised Isolation Forest Engine
- Numerical preprocessing with mean imputation (`SimpleImputer`) and standardization (`StandardScaler`).
- `IsolationForest` unsupervised model with `random_state=42`.
- Normalized anomaly scores (0.0 to 1.0) and severity classification (`LOW`, `MEDIUM`, `HIGH`).

### Feature Deviation Attribution
- Calculates per-feature Z-scores to identify top features driving outlier status.
- Generates non-causal descriptions (*"Statistically unusual observation where values for '[feature]' deviate from expected distributions"*).

### Frontend Anomaly Dashboard
- Displays Total Observations, Anomalies Detected, Anomaly Rate %, and High-Risk Count.
- Filter tabs: `All`, `Anomalous`, `Normal`, `High Severity`.
- Paginated table (10 items per page) for responsive browser performance.

---

## 4. API Endpoint Summary

| Namespace | Method | Endpoint | Description |
| :--- | :--- | :--- | :--- |
| **Forecasting** | `GET` | `/api/v1/datasets/{id}/forecast/tasks` | Discover forecasting candidate tasks |
| **Forecasting** | `POST` | `/api/v1/datasets/{id}/forecast/analyze` | Train forecasting model & project horizon |
| **Forecasting** | `POST` | `/api/v1/datasets/{id}/forecast/predict` | Generate horizon forecast |
| **Forecasting** | `GET` | `/api/v1/datasets/{id}/forecast/{forecast_id}` | Get saved forecast result |
| **Anomaly** | `POST` | `/api/v1/datasets/{id}/anomaly/analyze` | Execute Isolation Forest anomaly detection |
| **Anomaly** | `GET` | `/api/v1/datasets/{id}/anomaly` | List anomaly analyses for dataset |
| **Anomaly** | `GET` | `/api/v1/datasets/{id}/anomaly/{anomaly_id}` | Get saved anomaly analysis details |

---

## 5. Security, Lineage & Data Protection

- Raw dataset byte-for-byte SHA256 integrity preserved (`9463762eb564db829aba0c48fb27d636ca40a17ccb82d9d5cc5be3d43f81d198`).
- Lineage resolution: Requests on raw datasets resolve automatically to active processed child datasets; un-cleaned raw dataset requests return `HTTP 400`.
- All database tables use `ON DELETE CASCADE` foreign keys tied to `datasets.id`.
