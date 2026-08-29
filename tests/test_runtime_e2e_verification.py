import sys
import os
sys.path.insert(0, os.path.abspath("backend"))
import io
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app, raise_server_exceptions=True)

REALISTIC_CSV_DATA = """hospital_id,department,date,patient_count,operating_cost,satisfaction_score,total_revenue
HOSP01,General Medicine,2026-08-01,120,45000.0,88.5,185000.0
HOSP01,General Medicine,2026-08-02,125,46000.0,89.0,192000.0
HOSP01,Surgery,2026-08-01,45,85000.0,91.2,210000.0
HOSP01,Surgery,2026-08-02,48,88000.0,90.5,225000.0
HOSP01,Emergency,2026-08-01,210,62000.0,82.0,145000.0
HOSP01,Emergency,2026-08-02,215,64000.0,81.5,150000.0
HOSP01,Pediatrics,2026-08-01,85,32000.0,94.0,110000.0
HOSP01,Pediatrics,2026-08-02,90,33500.0,93.5,118000.0
HOSP01,Cardiology,2026-08-01,65,75000.0,87.0,195000.0
HOSP01,Cardiology,2026-08-02,68,77000.0,86.5,205000.0
"""


def test_final_runtime_e2e_pipeline_verification():
    """Execute complete end-to-end backend runtime verification across all 19 pipeline stages."""
    
    # 1. Health Endpoint Verification
    res_health = client.get("/api/health")
    assert res_health.status_code == 200
    assert res_health.json()["status"] == "healthy"
    print("\n[STEP 1] Health endpoint OK")

    # 2. Docs / Swagger Verification
    res_docs = client.get("/docs")
    assert res_docs.status_code == 200
    print("[STEP 2] Swagger docs OK")

    # 3. CSV Upload (Raw Dataset Registry)
    res_upload = client.post(
        "/api/v1/datasets/upload",
        files={"file": ("e2e_hospital_data.csv", io.BytesIO(REALISTIC_CSV_DATA.encode("utf-8")), "text/csv")},
    )
    assert res_upload.status_code == 201
    raw_dataset_id = res_upload.json()["dataset_id"]
    print(f"[STEP 3] Upload OK (raw_dataset_id={raw_dataset_id})")

    # 4. Dataset Registry Verification
    res_list = client.get("/api/v1/datasets")
    assert res_list.status_code == 200
    dataset_ids = [d["id"] for d in res_list.json()["items"]]
    assert raw_dataset_id in dataset_ids
    print("[STEP 4] Dataset listing registry OK")

    # 5. Validation & Cleaning
    res_clean = client.post(
        f"/api/v1/datasets/{raw_dataset_id}/clean/apply",
        json={"dataset_id": raw_dataset_id, "operations": [{"type": "remove_duplicates"}]},
    )
    assert res_clean.status_code == 200
    proc_dataset_id = res_clean.json()["output_dataset_id"]
    print(f"[STEP 5] Cleaning applied OK (proc_dataset_id={proc_dataset_id})")

    # 6. Data Profiling & Metadata
    res_profile = client.get(f"/api/v1/datasets/{proc_dataset_id}")
    assert res_profile.status_code == 200
    assert res_profile.json()["status"] == "processed"
    print("[STEP 6] Profiling metadata OK")

    # 7. Analytics & KPIs
    res_eda = client.get(f"/api/v1/datasets/{proc_dataset_id}/eda")
    assert res_eda.status_code == 200

    res_kpi = client.get(f"/api/v1/datasets/{proc_dataset_id}/reports/executive")
    print(f"KPI Status: {res_kpi.status_code}, Body: {res_kpi.text}")
    assert res_kpi.status_code == 200
    print("[STEP 7] EDA & KPI reports OK")

    # 8. Business Insights Generation
    res_gen_ins = client.post(f"/api/v1/datasets/{proc_dataset_id}/insights/generate")
    assert res_gen_ins.status_code in [200, 201]

    res_get_ins = client.get(f"/api/v1/datasets/{proc_dataset_id}/insights")
    assert res_get_ins.status_code == 200
    print("[STEP 8] Business Insights OK")

    # 9. Anomaly Intelligence
    res_anom = client.post(f"/api/v1/datasets/{proc_dataset_id}/anomaly/analyze")
    assert res_anom.status_code in [200, 201]
    print("[STEP 9] Anomaly Intelligence OK")

    # 10. ML Model Training & Analysis
    res_ml = client.post(
        f"/api/v1/datasets/{proc_dataset_id}/ml/analyze",
        json={"task_type": "regression", "target_column": "total_revenue"},
    )
    assert res_ml.status_code == 200
    ml_id = res_ml.json()["id"]
    print(f"[STEP 10] ML Analysis OK (ml_id={ml_id})")

    # 11. Decision Optimization Engine
    res_opt = client.post(
        f"/api/v1/datasets/{proc_dataset_id}/decision/optimize",
        json={"analysis_id": ml_id, "objective": "maximize"},
    )
    assert res_opt.status_code == 200
    opt_data = res_opt.json()
    opt_id = opt_data["optimization_id"]
    print(f"[STEP 11] Decision Optimization OK (opt_id={opt_id})")

    # 12. Decision Recommendations Generation
    res_recs = client.post(
        f"/api/v1/datasets/{proc_dataset_id}/decision/recommendations",
        json={"optimization_id": opt_id, "max_recommendations": 3},
    )
    print(f"Recs Status: {res_recs.status_code}, Body: {res_recs.text}")
    assert res_recs.status_code in [200, 201]
    recs_list = res_recs.json()["recommendations"]
    assert len(recs_list) > 0
    primary_rec_id = recs_list[0]["id"]
    print(f"[STEP 12] Recommendations OK (primary_rec_id={primary_rec_id})")

    # 13. Decision Guardrails Analysis
    res_guard = client.post(f"/api/v1/datasets/{proc_dataset_id}/decision/guardrails")
    print(f"Guard Status: {res_guard.status_code}, Body: {res_guard.text}")
    assert res_guard.status_code in [200, 201]
    guard_evals = res_guard.json()["evaluations"]
    assert len(guard_evals) > 0
    print("[STEP 13] Guardrails Analysis OK")

    # 14. What-If Scenario Simulation
    res_scen = client.post(
        f"/api/v1/datasets/{proc_dataset_id}/decision/scenarios",
        json={
            "name": "E2E Revenue Optimization Scenario",
            "ml_analysis_id": ml_id,
            "feature_changes": {"operating_cost": 50000.0},
        },
    )
    assert res_scen.status_code == 200
    scen_data = res_scen.json()
    assert scen_data["base_value"] != 0
    assert abs(scen_data["predicted_delta"] - (scen_data["predicted_outcome"] - scen_data["base_value"])) < 1e-3
    print("[STEP 14] What-If Scenarios OK")

    # 15. AI Decision Brief Generation (with Fallback & Evidence Verification)
    res_brief = client.post(
        f"/api/v1/datasets/{proc_dataset_id}/decision/brief",
        json={"recommendation_id": primary_rec_id},
    )
    assert res_brief.status_code == 201
    brief_data = res_brief.json()
    assert brief_data["recommendation_id"] == primary_rec_id
    assert brief_data["generation_mode"] in ["deterministic_fallback", "ai"]
    assert len(brief_data["claim_evidence_map"]) > 0
    print("[STEP 15] AI Decision Brief OK")

    # 16. Decision Outcomes Recording
    res_out = client.post(
        f"/api/v1/datasets/{proc_dataset_id}/decision/outcomes",
        json={
            "recommendation_id": primary_rec_id,
            "actual_metric": "total_revenue",
            "actual_value": 200000.0,
            "notes": "Verified Q3 actual revenue observation",
        },
    )
    assert res_out.status_code == 201
    outcome_data = res_out.json()
    assert outcome_data["achievement_percentage"] > 0
    print("[STEP 16] Decision Outcomes OK")

    # 17. Decision Memory Retrieval
    res_mem = client.get(f"/api/v1/datasets/{proc_dataset_id}/decision/memory")
    assert res_mem.status_code == 200
    mem_data = res_mem.json()
    assert mem_data["total_records"] >= 1
    print("[STEP 17] Decision Memory OK")

    # 18. Decision Performance Summary
    res_perf = client.get(f"/api/v1/datasets/{proc_dataset_id}/decision/performance")
    assert res_perf.status_code == 200
    perf_data = res_perf.json()
    assert perf_data["total_decisions"] >= 1
    print("[STEP 18] Decision Performance Summary OK")

    # 19. Decision Command Center Aggregation
    res_cc = client.get(f"/api/v1/datasets/{proc_dataset_id}/decision/command-center")
    assert res_cc.status_code == 200
    cc_data = res_cc.json()
    assert cc_data["dataset_id"] == proc_dataset_id
    assert cc_data["primary_recommendation"]["recommendation_id"] == primary_rec_id
    assert cc_data["snapshot"]["decision_readiness_score"] >= 0
    print("[STEP 19] Decision Command Center OK")
