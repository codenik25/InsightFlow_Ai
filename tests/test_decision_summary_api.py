import io
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

DATASET_A_CSV = """id,val_a,val_b,target_y
1,10.0,100.0,500.0
2,12.0,105.0,520.0
3,11.0,102.0,510.0
4,13.0,108.0,530.0
5,14.0,110.0,540.0
6,15.0,112.0,550.0
7,16.0,115.0,560.0
8,17.0,118.0,570.0
9,18.0,120.0,580.0
10,19.0,122.0,590.0
"""

DATASET_B_CSV = """id,metric_x,metric_y,target_z
1,50.0,1.0,1000.0
2,52.0,1.1,1020.0
3,51.0,1.0,1010.0
4,53.0,1.2,1030.0
5,54.0,1.3,1040.0
6,55.0,1.4,1050.0
7,56.0,1.5,1060.0
8,57.0,1.6,1070.0
9,58.0,1.7,1080.0
10,59.0,1.8,1090.0
"""


def _prepare_processed_dataset(csv_str: str, filename: str) -> str:
    """Helper to upload and clean raw dataset into processed dataset."""
    u_res = client.post(
        "/api/v1/datasets/upload",
        files={"file": (filename, io.BytesIO(csv_str.encode("utf-8")), "text/csv")},
    )
    raw_id = u_res.json()["dataset_id"]

    c_res = client.post(
        f"/api/v1/datasets/{raw_id}/clean/apply",
        json={"dataset_id": raw_id, "operations": [{"type": "remove_duplicates"}]},
    )
    return c_res.json()["output_dataset_id"]


def test_decision_summary_retrieval_and_isolation():
    """Verify GET /api/v1/datasets/{dataset_id}/decision returns persisted scenarios and recommendations with strict dataset isolation."""
    # 1. Setup Dataset A & Dataset B
    proc_id_a = _prepare_processed_dataset(DATASET_A_CSV, "dataset_a.csv")
    proc_id_b = _prepare_processed_dataset(DATASET_B_CSV, "dataset_b.csv")

    # 2. Run ML & Optimization for Dataset A
    ml_res_a = client.post(
        f"/api/v1/datasets/{proc_id_a}/ml/analyze",
        json={"task_type": "regression", "target_column": "target_y"},
    )
    ml_id_a = ml_res_a.json()["id"]

    opt_res_a = client.post(
        f"/api/v1/datasets/{proc_id_a}/decision/optimize",
        json={"analysis_id": ml_id_a, "objective": "maximize"},
    )
    opt_id_a = opt_res_a.json()["optimization_id"]

    # Generate Recommendations for Dataset A (via Phase 7.2B RecommendationService -> decision_recommendation_evaluations)
    rec_res_a = client.post(
        f"/api/v1/datasets/{proc_id_a}/decision/recommendations",
        json={"optimization_id": opt_id_a, "max_recommendations": 3},
    )
    assert rec_res_a.status_code == 201

    # 3. Run ML & What-If Scenario for Dataset B (via Phase 7.2 DecisionService -> scenarios & decision_recommendations)
    ml_res_b = client.post(
        f"/api/v1/datasets/{proc_id_b}/ml/analyze",
        json={"task_type": "regression", "target_column": "target_z"},
    )
    ml_id_b = ml_res_b.json()["id"]

    scen_res_b = client.post(
        f"/api/v1/datasets/{proc_id_b}/decision/scenarios",
        json={"name": "Dataset B Scenario", "ml_analysis_id": ml_id_b, "feature_changes": {"metric_x": 65.0}},
    )
    scen_id_b = scen_res_b.json()["id"]

    rec_res_b = client.post(
        f"/api/v1/datasets/{proc_id_b}/decision/recommendations",
        params={"scenario_id": scen_id_b, "ml_analysis_id": ml_id_b},
    )
    assert rec_res_b.status_code == 200

    # 4. Query Decision Summary for Dataset A
    sum_res_a = client.get(f"/api/v1/datasets/{proc_id_a}/decision")
    assert sum_res_a.status_code == 200
    sum_data_a = sum_res_a.json()

    assert sum_data_a["dataset_id"] == proc_id_a
    assert sum_data_a["is_processed"] is True
    assert len(sum_data_a["scenarios"]) >= 1
    assert len(sum_data_a["recommendations"]) >= 1

    # 5. Query Decision Summary for Dataset B
    sum_res_b = client.get(f"/api/v1/datasets/{proc_id_b}/decision")
    assert sum_res_b.status_code == 200
    sum_data_b = sum_res_b.json()

    assert sum_data_b["dataset_id"] == proc_id_b
    assert sum_data_b["is_processed"] is True
    assert len(sum_data_b["scenarios"]) >= 1
    assert len(sum_data_b["recommendations"]) >= 1

    # 6. Verify Strict Dataset Isolation
    # Dataset A summary MUST NOT contain Dataset B IDs
    scen_ids_a = [s["id"] for s in sum_data_a["scenarios"]]
    rec_ids_a = [r["id"] for r in sum_data_a["recommendations"]]
    scen_ids_b = [s["id"] for s in sum_data_b["scenarios"]]
    rec_ids_b = [r["id"] for r in sum_data_b["recommendations"]]

    assert not set(scen_ids_a).intersection(set(scen_ids_b))
    assert not set(rec_ids_a).intersection(set(rec_ids_b))


def test_decision_summary_partial_existences():
    """Verify summary endpoint handles cases where only scenarios or only recommendations exist."""
    proc_id = _prepare_processed_dataset(DATASET_A_CSV, "dataset_partial.csv")

    ml_res = client.post(
        f"/api/v1/datasets/{proc_id}/ml/analyze",
        json={"task_type": "regression", "target_column": "target_y"},
    )
    ml_id = ml_res.json()["id"]

    # Scenario only
    scen_res = client.post(
        f"/api/v1/datasets/{proc_id}/decision/scenarios",
        json={"name": "Standalone Scenario", "ml_analysis_id": ml_id, "feature_changes": {"val_a": 25.0}},
    )
    assert scen_res.status_code == 200

    sum_res = client.get(f"/api/v1/datasets/{proc_id}/decision")
    assert sum_res.status_code == 200
    sum_data = sum_res.json()
    assert len(sum_data["scenarios"]) >= 1
    assert sum_data["recommendations"] == []
