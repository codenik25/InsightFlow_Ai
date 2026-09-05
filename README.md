# InsightFlow AI

> **From raw data to validated decisions.**

InsightFlow AI is an end-to-end **AI Decision Intelligence Platform**
that transforms real-world datasets into actionable, evidence-backed,
and validated business decisions.

Instead of stopping at dashboards, InsightFlow connects the complete
decision journey:

**Upload → Overview → Data Quality → Cleaning → Analysis → Insights →
Predictions → Optimization → Recommendations → Decisions → Guardrails**

The platform is designed around a simple question:

> **What should we do next---and can we trust that decision?**

------------------------------------------------------------------------

## Why InsightFlow?

Traditional analytics tools are excellent at explaining what happened:

-   Revenue increased.
-   Costs changed.
-   A correlation exists.
-   A model predicts a future value.

But organizations ultimately need to answer:

**What action should we take?**

InsightFlow bridges the gap between analytics and action by combining
data quality, exploratory analysis, AI-generated insights, predictive
modeling, scenario optimization, recommendations, decision
formalization, and guardrail validation into one connected workflow.

------------------------------------------------------------------------

## Core Workflow

### 01 --- Upload

Upload a real-world CSV dataset through the platform.

-   Uses the existing dataset ingestion API.
-   Creates a real dataset record.
-   Keeps the original uploaded dataset available for traceability.

### 02 --- Overview

Build an initial understanding of the dataset.

-   Dataset name
-   Row and column counts
-   File information
-   Dataset composition
-   Column profile
-   Real sample rows

### 03 --- Data Quality

Evaluate whether the dataset is reliable enough for downstream analysis.

The quality layer checks signals such as:

-   Missing values
-   Duplicate records
-   Invalid/semantic values
-   Consistency issues
-   Overall quality score

The quality score and diagnostics are based on backend analysis rather
than frontend-generated values.

### 04 --- Cleaning

Clean the dataset without modifying the original artifact.

Supported cleaning operations include:

-   Duplicate removal
-   Missing-value handling
-   Cleaning-plan configuration

The cleaned dataset is stored as a **separate processed artifact**.

This creates an explicit distinction between:

``` text
Raw Dataset
     ↓
Cleaning
     ↓
Processed Dataset
```

Downstream analytical stages use the processed dataset.

### 05 --- Analysis / Visualization

Explore the processed dataset through analytical visualizations.

The analysis layer includes:

-   KPI summaries
-   Distribution analysis
-   Correlation analysis
-   Category-level comparisons
-   Relationships between variables
-   Statistical shape/distribution information
-   Department/category performance

The visualization workspace is designed to remain readable across large
analytical sections without allowing charts to overflow their
containers.

### 06 --- Insights

Convert analytical findings into prioritized business insights.

Insights can include categories such as:

-   Performance
-   Trend
-   Correlation
-   Data Quality
-   Opportunity

Each insight can expose supporting context such as:

-   Observation
-   Severity
-   Priority
-   Explanation
-   Dimension
-   Metric
-   Top value
-   Contribution
-   Correlation
-   Sample size

The objective is to move from:

**"Here is a chart."**

to:

**"Here is what matters."**

### 07 --- Predictions

Move from understanding historical behavior to estimating future
outcomes.

The prediction layer supports:

-   ML task selection
-   Model generation
-   Model metrics
-   Feature summaries
-   Prediction inputs
-   Real prediction responses

The frontend consumes the existing ML APIs and does not fabricate
prediction results.

### 08 --- Optimization

Explore possible actions instead of only predicting outcomes.

Optimization works with:

-   Business objectives
-   Controllable features
-   Feature constraints
-   Scenario generation
-   Baseline prediction
-   Scenario prediction
-   Absolute change
-   Percentage change
-   Feasibility
-   Best scenario selection

This changes the question from:

> "What will happen?"

to:

> "What happens if we change something?"

### 09 --- Recommendations

Turn analytical and optimization evidence into actionable
recommendations.

Recommendations can include:

-   Recommendation type
-   Priority
-   Target metric
-   Baseline value
-   Projected value
-   Absolute delta
-   Percentage delta
-   Rationale
-   Trade-offs
-   Confidence
-   Evidence chain

Recommendations are connected to the underlying decision workflow rather
than being static UI text.

### 10 --- Decisions

Formalize the selected decision and preserve its evidence chain.

The decision layer connects:

-   Recommendation
-   Optimization
-   Scenario
-   Supporting evidence
-   Decision outcome

This creates traceability between the original data and the final
action.

### 11 --- Guardrails

A recommendation is not automatically a good decision.

Guardrails provide a final validation layer for formalized decisions.

The platform evaluates signals such as:

-   Feasibility score
-   Realism score
-   Risk score
-   Confidence score
-   Decision status
-   Feasibility status
-   Risk level
-   Passed rules
-   Warnings
-   Violated rules

The goal is not to replace human judgment.

The goal is to make AI-assisted decisions more explainable, auditable,
and responsible.

------------------------------------------------------------------------

## Example: Hospital Decision Intelligence

InsightFlow has been tested with a real-life hospital-style dataset
containing operational and financial variables such as:

-   Patient visits
-   Staff count
-   Average wait minutes
-   Bed occupancy percentage
-   Average bill
-   Operating cost
-   Total revenue
-   Satisfaction score
-   Readmission rate
-   Emergency cases
-   Department-level information

For example, the analytical layer can reveal relationships such as:

**Patient Visits ↔ Operating Cost**

and identify department-level differences in:

-   Average bill
-   Waiting time
-   Bed occupancy
-   Operational performance

Those findings can then feed into predictions, optimization scenarios,
recommendations, and final decision validation.

------------------------------------------------------------------------

## What Makes InsightFlow Different?

### 1. It does not stop at analytics

Most analytics workflows end at:

``` text
Dashboard → Insight
```

InsightFlow continues:

``` text
Dashboard
   ↓
Insight
   ↓
Prediction
   ↓
Scenario
   ↓
Recommendation
   ↓
Decision
   ↓
Guardrail Validation
```

### 2. Raw data remains immutable

Cleaning is non-destructive.

The original dataset is preserved and the processed dataset is stored
separately.

### 3. Evidence follows the decision

A recommendation is connected to the analytical and optimization context
that produced it.

### 4. AI is integrated into the workflow

AI/ML is used where it creates decision value:

-   Insight generation
-   Predictive analysis
-   Scenario evaluation
-   Recommendation generation
-   Decision reasoning

### 5. Decisions are validated

The final output is not simply:

> "AI recommends X."

It is closer to:

> "AI recommends X, based on this evidence, under these constraints,
> with this projected impact, and these validation signals."

------------------------------------------------------------------------

## Design System

InsightFlow uses a cinematic enterprise command-center aesthetic.

### Visual Language

-   Deep navy/near-black environment
-   Cyan, blue, and violet atmospheric lighting
-   Glassmorphism panels
-   Thin technical borders
-   Subtle technical grid
-   Data-flow lines
-   Central Insight Engine
-   Radial architecture nodes
-   Restrained glow
-   Smooth transitions
-   Lightweight ambient animation

### Typography

-   **Space Grotesk** --- primary display/headings
-   **Inter** --- interface/body text
-   **JetBrains Mono** --- technical labels and system information

### Interaction Principles

Animations are intended to communicate system activity rather than act
as decoration.

Examples:

-   Smooth page transitions
-   Animated analytical states
-   Insight Engine motion
-   Data-flow movement
-   Gauge interpolation
-   Hover/focus feedback
-   Loading and success states
-   Reduced-motion support

The visual layer must never replace functional state or backend truth.

------------------------------------------------------------------------

## Architecture

At a high level:

``` text
                    ┌─────────────────────┐
                    │     User / UI       │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │      Upload         │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │  Dataset Overview   │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │    Data Quality     │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │  Non-Destructive    │
                    │      Cleaning       │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │      Analysis       │
                    │   & Visualization   │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │      Insights       │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │     Predictions     │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │    Optimization     │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │   Recommendations   │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │      Decisions      │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │     Guardrails      │
                    └─────────────────────┘
```

------------------------------------------------------------------------

## Frontend

The frontend is a React/TypeScript application built around reusable
analytical and decision-intelligence components.

Key areas include:

``` text
src/
├── components/
│   ├── DashboardApp.tsx
│   ├── Header.tsx
│   ├── Sidebar.tsx
│   ├── PlatformOverview.tsx
│   ├── DatasetOverview.tsx
│   ├── DataQuality.tsx
│   ├── DataCleaning.tsx
│   ├── DataAnalysis.tsx
│   ├── DataInsights.tsx
│   ├── DataPredictions.tsx
│   ├── DataOptimization.tsx
│   ├── DataRecommendations.tsx
│   ├── DataDecisions.tsx
│   ├── DataGuardrails.tsx
│   └── ...
├── api.ts
└── index.css
```

The application uses the existing backend APIs and keeps the frontend
responsible for presentation, interaction, and workflow state.

------------------------------------------------------------------------

## Backend Integration

The frontend is connected to real backend endpoints for the decision
workflow.

Representative API operations include:

``` text
POST /api/v1/datasets/upload

GET  /api/v1/datasets/{dataset_id}/profile
GET  /api/v1/datasets/{dataset_id}/quality
POST /api/v1/datasets/{dataset_id}/clean

GET  /api/v1/datasets/{dataset_id}/eda
POST /api/v1/datasets/{dataset_id}/eda

GET  /api/v1/datasets/{dataset_id}/insights
POST /api/v1/datasets/{dataset_id}/insights/generate

GET  /api/v1/datasets/{dataset_id}/ml/tasks
GET  /api/v1/datasets/{dataset_id}/ml
POST /api/v1/datasets/{dataset_id}/ml/analyze
POST /api/v1/datasets/{dataset_id}/ml/{analysis_id}/predict

GET  /api/v1/datasets/{dataset_id}/decision/optimize/options
POST /api/v1/datasets/{dataset_id}/decision/optimize

POST /api/v1/datasets/{dataset_id}/decision/recommendations
POST /api/v1/datasets/{dataset_id}/decision/optimize/recommendations

GET  /api/v1/datasets/{dataset_id}/decision/command-center
```

The exact API implementation and contracts should be treated as the
source of truth for backend behavior.

------------------------------------------------------------------------

## Data Integrity Principles

InsightFlow follows several important integrity rules:

### No fake analytical data

Frontend values should come from backend responses or clearly represent
UI state.

### No mutation of raw datasets

Raw uploads remain immutable.

### Processed dataset lineage

Cleaning creates a new processed dataset that becomes the source for
downstream stages.

### No fabricated optimization results

Scenario values and objectives come from the optimization service.

### No fabricated recommendations

Recommendations are generated from the decision backend.

### Decision traceability

Formalized decisions preserve links to their supporting recommendation,
optimization, and scenario context.

------------------------------------------------------------------------

## Performance & UX

The interface is designed to feel cinematic without relying on heavy
video backgrounds.

The visual environment uses:

-   CSS gradients
-   SVG geometry
-   Lightweight animation
-   Framer Motion transitions
-   GPU-friendly transforms
-   Opacity-based effects
-   `prefers-reduced-motion` support

The goal is a premium visual experience while keeping the analytical
application responsive.

------------------------------------------------------------------------

## Development

### Install dependencies

``` bash
cd frontend
npm install
```

### Start the frontend

``` bash
npm run dev
```

### Lint

``` bash
npm run lint
```

### Production build

``` bash
npm run build
```

Run the backend according to the project's backend
environment/configuration before using API-dependent workflow stages.

------------------------------------------------------------------------

## Testing Philosophy

InsightFlow is designed to be verified using real datasets rather than
only synthetic UI states.

A recommended manual validation path is:

``` text
1. Upload real dataset
2. Verify Overview values
3. Verify Quality calculations
4. Verify raw dataset remains unchanged
5. Verify processed dataset after cleaning
6. Validate analytical values against independent calculations
7. Validate insight evidence
8. Validate prediction target/task
9. Validate optimization constraints and scenarios
10. Validate recommendation evidence
11. Refresh and verify decision persistence
12. Validate guardrail results
```

For analytical correctness, backend output should be independently
compared against calculations from the source dataset.

------------------------------------------------------------------------

## Current Product Vision

InsightFlow AI is being built as a **Decision Intelligence Platform**,
not simply an analytics dashboard.

The long-term product principle is:

> **Make every important decision explainable, measurable, and
> defensible.**

The platform should help users move from:

**Data**

to

**Understanding**

to

**Prediction**

to

**Action**

to

**Validated Decision**

------------------------------------------------------------------------

## Project Status

The core end-to-end workflow is implemented:

-   [x] Dataset upload
-   [x] Dataset overview
-   [x] Data quality analysis
-   [x] Non-destructive cleaning
-   [x] EDA and visualization
-   [x] AI-generated insights
-   [x] Predictive modeling
-   [x] Scenario optimization
-   [x] Recommendations
-   [x] Decision command center
-   [x] Decision guardrails
-   [x] Cinematic frontend design system
-   [x] Smooth interaction and transition system
-   [x] Frontend/backend workflow integration

The project is continuing through visual polish, analytical validation,
usability refinement, and reliability testing.

------------------------------------------------------------------------

## The Big Idea

**InsightFlow AI does not ask only:**

> "What does the data say?"

It asks:

> **"What does the data tell us to do, why should we do it, what could
> happen if we do it, and can we trust that decision?"**

------------------------------------------------------------------------

## License

Add the project's applicable license here before public distribution.
