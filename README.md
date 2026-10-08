from pathlib import Path

readme = r"""# InsightFlow AI

> **An AI-powered Decision Intelligence Platform that transforms raw datasets into traceable, governed, outcome-aware decisions.**

InsightFlow AI is an end-to-end analytical decision platform built for moving from **data ingestion** to **evidence-backed decisions** without losing lineage, reproducibility, governance, or auditability.

Instead of stopping at dashboards or predictions, InsightFlow connects the analytical lifecycle:

```text
Dataset
   ↓
Quality
   ↓
Cleaning
   ↓
Analysis
   ↓
Insights
   ↓
Predictions
   ↓
Optimization
   ↓
Recommendations
   ↓
Decisions
   ↓
Guardrails
   ↓
Evidence
   ↓
Outcomes
   ↓
Performance
   ↓
Learning
   ↓
Governance
   ↓
Controlled Execution
   ↓
Audit / Knowledge
```

---

## Why InsightFlow AI?

Traditional analytics tools often answer:

> **"What happened?"**

InsightFlow is designed to go further:

> **"What did the data reveal?"**  
> **"What decision does that evidence support?"**  
> **"Why was that decision made?"**  
> **"What happened afterward?"**  
> **"What can we learn from the outcome?"**

The platform therefore combines analytical processing with **traceability, decision governance, outcome monitoring, and learning signals**.

---

## Core Capabilities

### Dataset Workspace

- Workspace and project organization
- Dataset registry
- Raw dataset preservation
- Processed dataset artifacts
- Dataset lineage
- Dataset versioning
- Version comparison and "What Changed?" analysis

### Analytical Pipeline

```text
Upload
  → Data Quality
  → Cleaning
  → Analysis
  → Insights
  → Predictions
  → Optimization
  → Recommendations
  → Decisions
  → Guardrails
```

Each stage uses the appropriate persisted dataset/artifact from the previous stage.

### Analysis & Intelligence

- Exploratory data analysis
- Statistical profiling
- Distribution analysis
- Correlation analysis
- Category-level analysis
- Time-series / trend analysis where appropriate
- Automated insight extraction
- Machine-learning prediction workflows
- Scenario-based optimization
- Recommendation generation

### Decision Intelligence

InsightFlow includes a dedicated decision workspace with nine complementary views:

1. **Decision** — formalize and understand the selected decision
2. **Evidence** — explore the evidence chain supporting the decision
3. **Outcome** — compare expected and actual outcomes
4. **Performance** — measure decision performance over time
5. **Learning** — identify persistent deviations and learning signals
6. **Governance** — review and control decision state transitions
7. **Execution** — manage the controlled execution lifecycle
8. **Audit** — inspect the chronological decision history
9. **Knowledge** — explore connected decision intelligence

These views intentionally use different visual compositions while sharing the same product design system.

---

## Traceability by Design

InsightFlow maintains an evidence chain connecting analytical artifacts to decisions.

```text
Dataset
   ↓
Version
   ↓
Analysis Run
   ↓
Insight
   ↓
Prediction
   ↓
Optimization
   ↓
Recommendation
   ↓
Decision
   ↓
Guardrail
```

The evidence graph is designed to answer:

> **Why is this recommendation or decision being made, and which persisted evidence supports it?**

The platform avoids inventing relationships when an explicit persisted relationship is not available.

---

## Reproducibility

Every analytical execution can be tracked as an analysis run with information such as:

- Project
- Dataset
- Dataset version
- Processed dataset
- Run type
- Configuration
- Input artifacts
- Output artifacts
- Status
- Error information
- Start/end timestamps
- Duration

This provides a foundation for understanding **which data and configuration produced a particular analytical result**.

---

## Decision Outcome Loop

InsightFlow extends decision analytics beyond the decision itself:

```text
Decision
   ↓
Expected Outcome
   ↓
Actual Outcome
   ↓
Outcome Comparison
   ↓
Performance
   ↓
Learning Signal
```

Actual outcomes are only represented when they are backed by persisted application data. The platform does not fabricate outcome observations.

---

## Governance & Controlled Execution

Decision approval and execution are deliberately separated.

```text
APPROVED
    ≠
EXECUTED
```

Governance supports controlled states such as:

```text
DRAFT
→ UNDER REVIEW
→ PENDING APPROVAL
→ APPROVED
→ EXECUTED
→ CLOSED
```

Execution follows its own controlled lifecycle and is not presented as autonomous real-world execution.

The platform is designed around **human review and explicit control** rather than autonomous approval, rejection, retraining, or decision mutation.

---

## AI Insight Memory

InsightFlow keeps analytical memory across dataset versions and analysis runs.

Memory states include:

- `NEW`
- `PERSISTED`
- `STRENGTHENED`
- `WEAKENED`
- `DISAPPEARED`

A deterministic fingerprinting approach is used to identify recurring analytical patterns across versions.

This allows users to distinguish between:

```text
A new pattern
        ↓
A persistent pattern
        ↓
A strengthened / weakened pattern
        ↓
A disappeared pattern
```

---

## Decision Performance Intelligence

Decision performance uses persisted outcome observations to calculate useful signals such as:

- Outcome coverage
- Match rate
- Material difference rate
- Average absolute delta
- Average relative delta
- Median relative delta
- Performance by metric
- Performance by model
- Performance by scenario
- Trend-level decision performance
- Repeated deviations

The platform avoids making strong conclusions when the available observation count is insufficient.

---

## Security

InsightFlow includes application-level authentication and authorization controls.

The current security model includes:

- User authentication
- Password hashing
- JWT-based authentication
- Workspace ownership
- Workspace/project authorization
- Protected dataset access
- Authenticated frontend states

Production security configuration should always be reviewed against the deployment environment and operational requirements.

---

## Technology Stack

### Frontend

- React
- TypeScript
- Vite
- Tailwind CSS
- Framer Motion
- Lucide React

### Backend

- Python
- FastAPI
- SQLAlchemy
- Pydantic
- Alembic

### Data & Storage

- PostgreSQL
- Supabase Storage / object storage integration
- CSV-based dataset artifacts

### Analytics / ML

- Python
- Pandas
- NumPy
- Scikit-learn
- Statistical and analytical processing modules

### Engineering

- REST APIs
- Database migrations
- Automated tests
- TypeScript build validation
- Componentized frontend architecture

---

## Architecture

High-level architecture:

```text
                    ┌──────────────────────┐
                    │   InsightFlow Web UI │
                    │ React + TypeScript   │
                    └──────────┬───────────┘
                               │
                          REST / JSON
                               │
                    ┌──────────▼───────────┐
                    │      FastAPI API     │
                    └──────────┬───────────┘
                               │
             ┌─────────────────┼─────────────────┐
             │                 │                 │
             ▼                 ▼                 ▼
        PostgreSQL       Storage / CSV      Analytics + ML
             │                 │                 │
             └─────────────────┼─────────────────┘
                               │
                       Decision Intelligence
                               │
            ┌──────────────────┼──────────────────┐
            ▼                  ▼                  ▼
       Evidence Graph     Outcome Loop       Governance
            │                  │                  │
            └──────────────────┼──────────────────┘
                               ▼
                       Controlled Execution
```

---

## Frontend Structure

The frontend is organized around reusable product surfaces and analytical views.

Representative areas include:

```text
frontend/
└── src/
    ├── components/
    │   ├── DatasetOverview
    │   ├── DataQuality
    │   ├── DataCleaning
    │   ├── DataAnalysis
    │   ├── DataInsights
    │   ├── DataPredictions
    │   ├── DataOptimization
    │   ├── DataRecommendations
    │   ├── DataDecisions
    │   ├── DataGuardrails
    │   ├── EvidenceGraphView
    │   ├── AnalysisRunHistory
    │   ├── InsightMemoryView
    │   ├── DecisionPerformanceView
    │   ├── DecisionLearningSignalsView
    │   ├── DecisionGovernanceView
    │   ├── DecisionExecutionView
    │   ├── DecisionReportView
    │   └── ...
    ├── services/
    │   └── api.ts
    ├── types/
    │   └── index.ts
    └── ...
```

---

## Backend Structure

Representative backend areas:

```text
backend/
└── app/
    ├── api/
    │   └── v1/
    ├── models/
    ├── schemas/
    ├── services/
    └── ...
```

Major service areas include:

- Dataset management
- Dataset comparison
- Analysis run lifecycle
- Insight memory
- Evidence graph
- Decision performance
- Decision learning
- Governance
- Controlled execution
- Decision reporting
- Authentication / authorization

---

## Design System

InsightFlow uses a dark, premium analytical visual language.

### Typography

- **Plus Jakarta Sans** — primary UI typography
- **IBM Plex Mono** — technical metadata, IDs, timestamps and other machine-oriented fields

### Visual Language

- Deep navy foundations
- Cyan / blue intelligence accents
- Restrained violet accents
- Glass-like analytical surfaces
- Technical grid details
- Smooth motion
- Subtle 3D depth
- Data-driven visual emphasis

The design goal is:

> **luxury professional intelligence software — not a generic AI dashboard**

Different product phases intentionally have different visual identities while remaining part of the same system.

---

## Loading Experience

InsightFlow uses continuous, state-driven loading experiences for real asynchronous operations.

The principle is:

```text
REAL REQUEST PENDING
       ↓
CONTINUOUS MOTION
       ↓
REAL REQUEST COMPLETE
       ↓
SETTLE / SUCCESS / ERROR
```

Loading visuals can use:

- animated SVG intelligence cores
- continuously moving signal paths
- orbiting particles
- layered rings
- analytical network motion
- subtle atmospheric motion

Importantly, visual animation does **not** determine backend completion.

No fake percentage progress should be used unless real progress is provided by the backend.

---

## Local Development

### Prerequisites

Install:

- Node.js
- npm
- Python
- PostgreSQL
- access to the configured object storage / Supabase environment

### Clone the repository

```bash
git clone <your-repository-url>
cd insightflow-ai
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The Vite development server will normally expose the frontend on its configured development port.

### Backend

Create and activate a Python virtual environment:

```bash
cd backend

python -m venv .venv
```

Windows:

```bash
.venv\Scripts\activate
```

macOS / Linux:

```bash
source .venv/bin/activate
```

Install backend dependencies:

```bash
pip install -r requirements.txt
```

Start the FastAPI application using the project's configured ASGI entrypoint.

---

## Environment Configuration

The application requires environment-specific configuration for:

- PostgreSQL connection
- object storage / Supabase access
- JWT / authentication secrets
- API configuration
- CORS / frontend origin configuration
- production deployment settings

Do not commit production secrets to source control.

Create local `.env` files according to the variable names used by the backend and frontend configuration already present in the project.

---

## Database Migrations

InsightFlow uses Alembic.

Typical workflow:

```bash
alembic upgrade head
```

Create a migration only when the application schema actually changes.

---

## Testing

Backend tests can be run with:

```bash
pytest
```

For a focused test file:

```bash
pytest tests/<test_file>.py -q
```

Frontend production/build validation:

```bash
npm run build
```

The project emphasizes lightweight, deterministic automated verification and avoids using browser automation as a requirement for ordinary development validation.

---

## API Domains

The platform exposes REST APIs across several major domains, including:

```text
/api/v1/workspaces
/api/v1/projects
/api/v1/datasets
/api/v1/runs
/api/v1/evidence
/api/v1/decisions
```

Additional endpoints cover version comparison, insight memory, decision performance, learning signals, governance, execution, and reporting.

Refer to the FastAPI application for the current endpoint contract.

---

## Example Decision Flow

A typical decision workflow looks like:

```text
1. Upload Dataset
        ↓
2. Profile & Quality Audit
        ↓
3. Clean Dataset
        ↓
4. Run Analysis
        ↓
5. Extract Insights
        ↓
6. Train / Evaluate Prediction Model
        ↓
7. Run Optimization Scenarios
        ↓
8. Generate Recommendations
        ↓
9. Formalize Decision
        ↓
10. Trace Evidence
        ↓
11. Validate Guardrails
        ↓
12. Govern Decision
        ↓
13. Controlled Execution
        ↓
14. Observe Outcome
        ↓
15. Measure Performance
        ↓
16. Generate Learning Signals
```

This produces a complete loop from **data → decision → outcome → learning**.

---

## Data Integrity Principles

InsightFlow follows several important principles:

### Raw Data Immutability

Raw datasets remain unchanged.

Cleaning creates a separate processed artifact.

### Lineage Awareness

Downstream stages operate against the appropriate dataset/version lineage.

### Explicit Evidence

Evidence relationships should come from persisted application relationships rather than visual inference.

### No Fabricated Outcomes

Actual outcomes must come from real persisted observations.

### Human Governance

Approval, escalation, and execution remain controlled workflows.

### No Autonomous Decision Mutation

Learning signals inform human review; they do not silently change recommendations or decisions.

---

## Current Project Direction

InsightFlow is being developed as a portfolio-quality and enterprise-oriented Decision Intelligence platform with emphasis on:

- analytical depth
- traceability
- reproducibility
- governance
- decision accountability
- premium user experience
- strong visual storytelling

The interface is intentionally evolving toward a **high-end decision intelligence command center**, with phase-specific workspaces rather than a single generic dashboard template.

---

## Roadmap

Potential future improvements include:

- richer enterprise role management
- refresh scheduling
- production-grade job orchestration
- stronger dataset lineage with explicit lineage IDs
- advanced model monitoring
- additional data drift intelligence
- external execution integrations
- richer decision knowledge exploration
- report export workflows
- deeper enterprise observability
- expanded multi-project analytics

---

## Project Status

InsightFlow AI currently includes the major foundations for:

- Workspaces & projects
- Dataset registry
- Dataset versioning
- Analysis run tracking
- AI insight memory
- Evidence graph traceability
- Decision outcomes
- Decision performance intelligence
- Decision learning signals
- Governance
- Controlled execution
- Decision reporting
- Authentication and authorization
- Premium analytical UI experiences

The project is actively evolving, particularly around **visual design, interaction quality, loading experiences, and enterprise-grade decision workflows**.

---

## Contributing

When contributing:

1. Preserve existing API/data contracts unless the change explicitly requires them.
2. Avoid introducing fabricated analytical values.
3. Keep raw data immutable.
4. Preserve lineage and traceability.
5. Add focused tests for behavioral changes.
6. Validate the frontend with `npm run build`.
7. Keep visual changes accessible and responsive.
8. Prefer reusable components over duplicated implementations.

---

## License

Add the project's intended license here.

---

## Author

**Nikunj Rathi**

B.Tech Computer Science & Engineering  
JECRC University, Jaipur

InsightFlow AI is developed as a project focused on **AI, analytics, decision intelligence, and production-oriented software engineering**.
"""

path = Path("/mnt/data/README.md")
path.write_text(readme, encoding="utf-8")

print(path)
