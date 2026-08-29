# Automated Business Insights Discovery Engine Documentation

## Executive Overview
The **InsightFlow Business Insights Discovery Engine** is a deterministic, explainable, domain-agnostic analytical pipeline that transforms raw dataset statistics and Exploratory Data Analysis (EDA) breakdowns into high-value, structured business findings.

It features:
- **Deduplication & Grouping**: Consolidates repetitive metric observations into high-level business patterns (e.g., operational underutilization patterns) while preserving underlying raw evidence pointers.
- **Evidence-Backed Opportunity Detection**: Generates actionable opportunity insights when empirical evidence thresholds are met.
- **Domain-Agnostic Metric Role Mapping**: Automatically detects metric roles (demand, staffing, utilization, financial revenue/expense/profit, quality, defects) across healthcare, retail, logistics, manufacturing, education, energy, SaaS, and transportation datasets.
- **Deterministic Priority, Confidence & Business Impact Scoring**: Calculates explainable priority scores ($0-100$) based on magnitude, evidence strength, business impact, and confidence level.
- **Strict Non-Causal Safety Guardrails**: Enforces observational language across all titles, observations, and recommendations without asserting direct causation.

---

## Architecture Diagram

```mermaid
flowcard
    subgraph Data & EDA Layer
        RAW["Raw Tabular Dataset"] --> CLEAN["Data Cleaning & Profiling"]
        CLEAN --> EDA["EDA Engine (KPIs, Breakdowns, Trends, Correlations)"]
    end

    subgraph Business Insight Discovery Engine
        EDA --> DISCOVERY["Raw Insight Discovery (Quality, Performance, Trend, Correlation)"]
        EDA --> CROSS["Cross-Metric Pattern Layer"]
        CROSS --> OPP["Opportunity Insight Detector (Evidence-Backed)"]
        DISCOVERY --> GROUPING["Grouping & Deduplication Layer"]
        CROSS --> GROUPING
        OPP --> GROUPING
        GROUPING --> SCORING["Priority, Confidence & Impact Scoring Engine"]
        SCORING --> GUARDRAIL["Non-Causal Safety Guardrail & Sanitizer"]
    end

    subgraph API & Persistence
        GUARDRAIL --> DB[("PostgreSQL dataset_insights Table")]
        GUARDRAIL --> API["InsightResponse API Endpoint (/api/v1/datasets/{id}/insights)"]
    end
```

---

## Key Pipeline Components

### 1. Domain-Agnostic Metric Family Detection (`MetricFamilyService`)
Maps column names using exact and substring alias rules to business roles:
- **`DEMAND`**: `patient_visits`, `units_sold`, `admissions`, `transactions`, `orders`, `bookings`, `volume`, `requests`.
- **`STAFFING`**: `staff_count`, `employees`, `labor_hours`, `headcount`, `drivers`, `teachers`, `workforce`.
- **`UTILIZATION`**: `occupancy_rate`, `utilization_rate`, `capacity_usage`, `seat_factor`, `load_factor`.
- **`FINANCIAL_EXPENSE`**: `operating_cost`, `cost`, `expenses`, `overhead`, `labor_cost`, `maintenance_cost`.
- **`FINANCIAL_REVENUE`**: `total_revenue`, `revenue`, `average_bill`, `unit_price`, `sales`, `billing`.
- **`FINANCIAL_PROFIT`**: `profit`, `margin`, `net_income`, `ebitda`, `roi`.
- **`QUALITY`**: `patient_satisfaction`, `satisfaction`, `rating`, `nps`, `csat`, `quality_score`.
- **`QUALITY_DEFECT`**: `readmission_rate`, `defect_rate`, `churn_rate`, `error_rate`, `return_rate`, `downtime`.

### 2. Grouping & Deduplication Layer
When an entity within a dimension (e.g., `Apex Medical Center` under `hospital`) exhibits $2+$ related metric findings (such as lowest patient visits, lowest staff count, lowest occupancy rate, lowest average bill, and lowest operating cost), the engine consolidates them into a single top-level grouped business finding:
- **Title**: `"Potential underutilization pattern at Apex Medical Center"`
- **Category**: `PERFORMANCE` / `OPPORTUNITY`
- **Group ID**: `grp_apex_medical_center`
- **Supporting Insight IDs**: `["raw_id_1", "raw_id_2", "raw_id_3", ...]`
- **Is Grouped**: `True`

Underlying raw evidence remains accessible and linked via `supporting_insight_ids`.

### 3. Real Opportunity Detection
Generates `OPPORTUNITY` insights when empirical evidence thresholds are met:
- **Pattern A (Capacity Optimization)**: High demand + high utilization ($\ge 80\%$).
- **Pattern B (Service Quality Improvement)**: High volume + lower relative satisfaction.
- **Pattern C (Margin & Efficiency Investigation)**: High revenue + high operating cost.
- **Pattern D (Resource Utilization Optimization)**: Low utilization ($<75\%$) + high available staffing.

If no evidence supports an opportunity, returning zero opportunities is enforced.

### 4. Deterministic Priority, Confidence & Business Impact Scoring
Priority scores ($0-100$) are calculated deterministically using the formula:

$$ \text{priority\_score} = 0.30 \times \text{magnitude\_score} + 0.30 \times \text{evidence\_score} + 0.25 \times \text{impact\_score} + 0.15 \times \text{confidence\_score} $$

- **Confidence Levels**:
  - `HIGH` ($\ge 0.85$ confidence score): Large sample size ($\ge 30$), grouped pattern, or strong correlation ($|r| \ge 0.70$).
  - `MEDIUM` ($0.60 - 0.84$): Moderate sample size or single strong metric breakdown.
  - `LOW` ($< 0.60$): Small sample size or weak correlation.
- **Business Impact**:
  - `HIGH`: Revenue, expense, profit, demand metrics, or grouped operational patterns.
  - `MEDIUM`: Utilization, staffing, satisfaction metrics.
  - `LOW`: Minor breakdowns or informational checks.

### 5. Non-Causal Safety Policy
Every title, observation, explanation, and recommendation is sanitized against prohibited terms (`causes`, `caused by`, `will cause`, `causal`, `guarantees`, `proves that`, `leads to`, `results in`).
Allowed observational terms: `suggests`, `is associated with`, `coincides with`, `may indicate`, `worth evaluating`, `could be explored`.

---

## API Schemas & Backward Compatibility

### Extended `Insight` Schema
```json
{
  "id": "c1f7a08b-...",
  "dataset_id": "proc_123",
  "category": "PERFORMANCE",
  "severity": "WARNING",
  "title": "Potential underutilization pattern at Apex Medical Center",
  "observation": "Apex Medical Center demonstrates a broader operational underutilization pattern characterized by lowest indicators across Patient Visits, Staff Count, Occupancy Rate, Average Bill, Operating Cost among hospitals.",
  "evidence": {
    "dimension": "hospital",
    "top_value": "Apex Medical Center",
    "details": {
      "supporting_count": 5,
      "metrics_involved": ["patient_visits", "staff_count", "occupancy_rate", "average_bill", "operating_cost"]
    }
  },
  "explanation": "Grouped business pattern consolidates 5 related raw metric findings into a single operational theme.",
  "recommendation": "Inspect operational workflow and resource metrics for Apex Medical Center in Patient Visits. This is worth evaluating because multiple operational metrics show co-occurring performance patterns across hospitals. Compare Apex Medical Center's performance against peer hospitals across related volume and cost indicators to determine appropriate operational tuning.",
  "priority_score": 94.0,
  "confidence": 0.95,
  "confidence_label": "HIGH",
  "business_impact": "HIGH",
  "group_id": "grp_apex_medical_center",
  "is_grouped": true,
  "supporting_insight_ids": ["raw_id_1", "raw_id_2", "raw_id_3", "raw_id_4", "raw_id_5"],
  "metrics_involved": ["patient_visits", "staff_count", "occupancy_rate", "average_bill", "operating_cost"],
  "affected_dimension": "hospital",
  "affected_entity": "Apex Medical Center",
  "non_causal_notice": "This finding represents an observational association derived from empirical dataset metrics and does not imply causal mechanisms.",
  "scoring_components": {
    "magnitude_score": 100.0,
    "evidence_score": 95.0,
    "impact_score": 85.0,
    "confidence_score": 90.0
  },
  "created_at": "2026-08-26T21:40:00Z"
}
```

---

## Testing Strategy

The engine is verified against 85 automated test cases:
1. `test_raw_csv_sha256_immutability`: Ensures `data/test_phase1_dirty.csv` SHA256 remains `9463762eb564db829aba0c48fb27d636ca40a17ccb82d9d5cc5be3d43f81d198`.
2. `test_metric_family_detector_domain_agnostic`: Verifies alias classification across healthcare, retail, and logistics.
3. `test_hospital_dataset_grouping_and_opportunities`: Validates Apex Medical Center grouping and opportunity detection on the hospital dataset.
4. `test_non_healthcare_domain_agnostic_dataset`: Confirms logistics fleet management dataset operates without hardcoded healthcare assumptions.
5. `test_non_causal_language_strictness`: Confirms 0 prohibited causal terms across generated text.
6. `test_edge_cases_safety`: Verifies safety with nulls, zero division, constant columns, and small datasets.
