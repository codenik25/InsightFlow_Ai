# Phase 4 Walkthrough: Automated Business Insight Engine

## 1. Overview & Architecture

Phase 4 introduces an automated, deterministic, domain-agnostic **Business Insight Engine** to InsightFlow AI.

```
CSV Upload
  │
  ▼
Profiling (Phase 1)
  │
  ▼
Quality Analysis (Phase 2)
  │
  ▼
Cleaning Pipeline → Processed Dataset (18 rows, 0 missing, 0 duplicates)
  │
  ▼
Automated EDA & KPI Discovery (Phase 3)
  │
  ▼
Automated Business Insight Engine (Phase 4)
```

### Key Principles Enforced
- **Zero LLM / External AI Dependencies**: 100% rule-based and explainable calculations.
- **Traceable Evidence**: Every insight contains structured evidence metrics (dimension, metric name, top values, contribution %, correlation $r$, sample size).
- **Processed Dataset Selection**: Resolves `EDAService.resolve_target_dataset` to guarantee that raw uncleaned datasets are rejected and insights are strictly computed on processed datasets.
- **Non-Causal Language**: Recommendations avoid unsupported causal claims ("because of") and use evidence-backed phrasing ("may indicate", "could suggest", "worth investigating").

---

## 2. Insight Discovery Rules

The engine automatically generates prioritized insights across 6 core categories:

1. **Data Quality Verification (`DATA_QUALITY`)**:
   - Detects dataset cleaning verification (0 missing cells, 0 duplicates across 18 rows).
   - Priority score: `95.0`.
2. **Category Performance (`PERFORMANCE`)**:
   - **Top Performers**: Identifies highest contributing category per measure (e.g. `Delhi` top revenue region, `Laptop C` top product revenue).
   - **Lowest Performers**: Identifies lowest contributing category per measure with contribution %.
3. **Concentration Risk & Opportunity (`OPPORTUNITY` / `PERFORMANCE`)**:
   - Detects when a category accounts for $\ge 60\%$ (notable) or $\ge 80\%$ (high) of total metric value (e.g. `Electronics` accounts for `92.2%` of total revenue).
4. **Time Series Trends (`TREND`)**:
   - Analyzes sequential velocity over date dimensions (`increasing`, `decreasing`, `stable`).
   - Includes baseline value, latest value, absolute change, and % change (+50.0% units sold, -67.27% unit price).
5. **Bivariate Correlations (`CORRELATION`)**:
   - Classifies Pearson correlation strength ($|r| \ge 0.7$ Strong, $0.3 \le |r| < 0.7$ Moderate).
   - Includes non-causal explanation note: *"Correlation measures linear co-movement; correlation does not imply direct causation."*

---

## 3. Verification & Test Results

### A. Alembic Migration Status (`python -m alembic current`)
```text
INFO  [alembic.runtime.migration] Context impl PostgresqlImpl.
INFO  [alembic.runtime.migration] Will assume transactional DDL.
005_insight_engine (head)
```

### B. Pytest Suite (`python -m pytest tests/`)
```text
============================= test session starts =============================
platform win32 -- Python 3.12.3, pytest-8.4.2, pluggy-1.6.0
rootdir: C:\Users\nrnik\OneDrive\Desktop\InsightFlow
plugins: anyio-3.7.1
collected 50 items

tests\test_cleaning_api.py .                                             [  2%]
tests\test_cleaning_service.py ...                                       [  8%]
tests\test_config.py .                                                   [ 10%]
tests\test_database.py ..                                                [ 14%]
tests\test_dataset_api.py ...                                            [ 20%]
tests\test_eda_api.py .                                                  [ 22%]
tests\test_eda_service.py ...                                            [ 28%]
tests\test_health.py ...                                                 [ 34%]
tests\test_insight_api.py .                                              [ 36%]
tests\test_insight_service.py .                                          [ 38%]
tests\test_kpi_service.py ....                                           [ 46%]
tests\test_metric_discovery.py ...                                       [ 52%]
tests\test_profiling_service.py ....                                     [ 60%]
tests\test_quality_service.py ...                                        [ 66%]
tests\test_relationship_service.py .                                     [ 68%]
tests\test_startup.py ..                                                 [ 72%]
tests\test_trend_service.py ..                                           [ 76%]
tests\test_type_detector.py ........                                     [ 92%]
tests\test_upload.py ....                                                [100%]

============================= 50 passed in 1.45s ==============================
```

### C. Frontend Production Build (`cd frontend && npm run build`)
```text
> insightflow-frontend@0.1.0 build
> tsc && vite build

vite v5.4.21 building for production...
transforming...
✓ 2077 modules transformed.
rendering chunks...
dist/index.html                   0.97 kB │ gzip:   0.52 kB
dist/assets/index-CRJdtlY-.css   23.75 kB │ gzip:   4.91 kB
dist/assets/index-DyDmcBtR.js   651.89 kB │ gzip: 181.05 kB
✓ built in 4.83s
```

### D. Verification Script (`scratch/verify_phase4_insights.py`)
- Analyzes Processed Dataset ID: `37055491-5969-4e0e-a8b9-34dae0959fa2`
- Total Generated Insights: `28`
- High Priority Insights:
  - `[1] DATA_QUALITY` (Score: `95.0`): Dataset quality verified and cleaned (18 rows, 0 missing, 0 duplicates).
  - `[2] PERFORMANCE` (Score: `88.44`): Electronics is the top Total Revenue Category (Revenue: $933,000, 92.2% contribution).
  - `[3] OPPORTUNITY` (Score: `85.0`): High Category concentration in Electronics (92.2%).
  - `[4] CORRELATION` (Score: `81.52`): Unit Price and Total Revenue show a strong positive correlation (r = 0.8259).
  - `[5] TREND` (Score: `80.0`): Units Sold is increasing over date (+50.0% change).
