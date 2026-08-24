import io
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app, raise_server_exceptions=False)


def test_recommendation_service_comprehensive_rules():
    csv_content = """txn_id,transaction_date,customer_code,product_category,unit_price,units_sold,target_revenue
101,2026-08-01,CUST01,Electronics,100,5,500
102,2026-08-02,CUST02,Electronics,200,3,600
103,2026-08-03,CUST03,Accessories,50,10,500
104,2026-08-04,CUST04,Accessories,150,2,300
105,2026-08-05,CUST05,Electronics,300,4,1200
106,2026-08-06,CUST06,Accessories,120,6,720
107,2026-08-07,CUST07,Electronics,250,1,250
108,2026-08-08,CUST08,Accessories,80,8,640
"""

    # 1. Upload Raw Dataset
    upload_res = client.post(
        "/api/v1/datasets/upload",
        files={"file": ("test_rec_service.csv", io.BytesIO(csv_content.encode("utf-8")), "text/csv")},
    )
    assert upload_res.status_code == 201
    raw_id = upload_res.json()["dataset_id"]

    # Test 15: Raw Dataset Protection (POST recommendation on raw dataset returns 400)
    raw_rec_res = client.post(
        f"/api/v1/datasets/{raw_id}/decision/recommendations",
        json={"optimization_id": "dummy-opt-id", "max_recommendations": 3},
    )
    assert raw_rec_res.status_code == 400
    assert "requires a processed dataset" in raw_rec_res.json()["detail"]

    # 2. Clean Dataset
    clean_plan = {"dataset_id": raw_id, "operations": [{"type": "remove_duplicates"}]}
    c_res = client.post(f"/api/v1/datasets/{raw_id}/clean/apply", json=clean_plan)
    assert c_res.status_code == 200
    proc_id = c_res.json()["output_dataset_id"]

    # 3. Generate Business Insights
    insights_res = client.post(f"/api/v1/datasets/{proc_id}/insights/generate")
    assert insights_res.status_code == 200

    # 4. Run ML Analysis
    ml_res = client.post(
        f"/api/v1/datasets/{proc_id}/ml/analyze",
        json={"task_type": "regression", "target_column": "target_revenue"},
    )
    assert ml_res.status_code == 200
    ml_id = ml_res.json()["id"]

    # 5. Run Decision Optimization
    opt_res = client.post(
        f"/api/v1/datasets/{proc_id}/decision/optimize",
        json={"analysis_id": ml_id, "objective": "maximize", "max_scenarios": 10},
    )
    assert opt_res.status_code == 200
    opt_id = opt_res.json()["optimization_id"]

    # Test 13: Invalid optimization ID (returns 404)
    bad_opt_res = client.post(
        f"/api/v1/datasets/{proc_id}/decision/recommendations",
        json={"optimization_id": "non-existent-opt-id", "max_recommendations": 3},
    )
    assert bad_opt_res.status_code == 404

    # Test 1: Generate Decision Recommendations
    rec_res = client.post(
        f"/api/v1/datasets/{proc_id}/decision/recommendations",
        json={"optimization_id": opt_id, "max_recommendations": 3},
    )
    assert rec_res.status_code == 201
    rec_data = rec_res.json()

    assert rec_data["dataset_id"] == proc_id
    assert rec_data["optimization_id"] == opt_id
    assert len(rec_data["recommendations"]) <= 3
    assert len(rec_data["recommendations"]) > 0

    # Test 7 & 8: Small dataset confidence & warning
    assert rec_data["overall_confidence"] == "EXPLORATORY"
    assert rec_data["warning"] is not None
    assert "contains only 8 rows" in rec_data["warning"]

    recs = rec_data["recommendations"]

    # Test 2, 3, 4: Priority & ranking
    for i, r in enumerate(recs):
        assert r["priority"] == i + 1
        assert r["confidence"] == "EXPLORATORY"
        assert r["target_metric"] == "target_revenue"
        assert r["tradeoffs"] is not None
        assert r["rationale"] is not None
        # Test 20: Non-causal language policy check
        for forbidden in ["causes", "will increase", "will decrease", "guarantees", "guaranteed", "definitely"]:
            assert forbidden not in r["rationale"].lower()
            assert forbidden not in r["tradeoffs"].lower()

        # Test 6: Evidence provenance object check
        ev = r["evidence"]
        assert ev["dataset_id"] == proc_id
        assert ev["ml_analysis_id"] == ml_id
        assert ev["optimization_id"] == opt_id

    # Test 5 & 18: Deterministic Repeated Execution
    rec_res2 = client.post(
        f"/api/v1/datasets/{proc_id}/decision/recommendations",
        json={"optimization_id": opt_id, "max_recommendations": 3},
    )
    assert rec_res2.status_code == 201
    rec_data2 = rec_res2.json()

    clean_recs1 = [{k: v for k, v in r.items() if k != "id"} for r in rec_data["recommendations"]]
    clean_recs2 = [{k: v for k, v in r.items() if k != "id"} for r in rec_data2["recommendations"]]
    assert clean_recs1 == clean_recs2

    # Test 16 & 17: Persistence & Retrieval (GET /recommendations & GET /recommendations/{id})
    list_rec_res = client.get(f"/api/v1/datasets/{proc_id}/decision/recommendations")
    assert list_rec_res.status_code == 200
    assert len(list_rec_res.json()) >= 1

    first_rec_id = recs[0]["id"]
    get_rec_res = client.get(f"/api/v1/datasets/{proc_id}/decision/recommendations/{first_rec_id}")
    assert get_rec_res.status_code == 200
    assert get_rec_res.json()["id"] == first_rec_id
