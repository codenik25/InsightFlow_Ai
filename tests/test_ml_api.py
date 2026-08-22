import io
import os
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_ml_api_workflow_and_safety():
    csv_content = """transaction_id,date,product,category,region,units_sold,unit_price,total_revenue
1001,2026-08-01,Laptop A,Electronics,East,2,55000,110000
1002,2026-08-02,Laptop B,Electronics,West,1,65000,65000
1003,2026-08-03,Monitor A,Electronics,East,3,15000,45000
1004,2026-08-04,Keyboard A,Accessories,South,5,2500,12500
1005,2026-08-05,Mouse A,Accessories,West,10,1200,12000
1006,2026-08-06,Laptop C,Electronics,East,2,70000,140000
1007,2026-08-07,Monitor B,Electronics,South,4,18000,72000
1008,2026-08-08,Keyboard B,Accessories,East,6,3000,18000
1009,2026-08-09,Mouse B,Accessories,West,12,1500,18000
1010,2026-08-10,Desk A,Furniture,East,1,25000,25000
1011,2026-08-11,Chair A,Furniture,South,4,8000,32000
1012,2026-08-12,Desk B,Furniture,West,2,30000,60000
"""

    # 1. Upload raw dataset
    upload_res = client.post(
        "/api/v1/datasets/upload",
        files={"file": ("test_ml_api.csv", io.BytesIO(csv_content.encode("utf-8")), "text/csv")},
    )
    assert upload_res.status_code == 201
    raw_dataset_id = upload_res.json()["dataset_id"]

    # 2. Raw dataset must return 400 Bad Request for ML task discovery
    raw_tasks_res = client.get(f"/api/v1/datasets/{raw_dataset_id}/ml/tasks")
    assert raw_tasks_res.status_code == 400
    assert "cleaning must be completed first" in raw_tasks_res.json()["detail"] or "requires a processed dataset" in raw_tasks_res.json()["detail"]

    # 3. Raw dataset must return 400 Bad Request for ML analyze
    raw_analyze_res = client.post(f"/api/v1/datasets/{raw_dataset_id}/ml/analyze")
    assert raw_analyze_res.status_code == 400

    # 4. Clean dataset to produce processed child
    plan_payload = {
        "dataset_id": raw_dataset_id,
        "operations": [{"type": "remove_duplicates"}]
    }
    apply_res = client.post(f"/api/v1/datasets/{raw_dataset_id}/clean/apply", json=plan_payload)
    assert apply_res.status_code == 200
    proc_dataset_id = apply_res.json()["output_dataset_id"]

    # 5. GET ML tasks on raw_dataset_id -> resolves to proc_dataset_id
    tasks_res = client.get(f"/api/v1/datasets/{raw_dataset_id}/ml/tasks")
    assert tasks_res.status_code == 200
    task_data = tasks_res.json()
    assert task_data["is_processed"] is True
    assert len(task_data["candidate_tasks"]) > 0

    # 6. POST ML analyze (Regression)
    analyze_payload = {
        "task_type": "regression",
        "target_column": "total_revenue"
    }
    analyze_res = client.post(f"/api/v1/datasets/{raw_dataset_id}/ml/analyze", json=analyze_payload)
    assert analyze_res.status_code == 200
    analysis_data = analyze_res.json()
    analysis_id = analysis_data["id"]
    assert analysis_data["dataset_id"] == proc_dataset_id
    assert analysis_data["target_column"] == "total_revenue"
    assert analysis_data["model_name"] != ""
    assert analysis_data["model_artifact_path"] is not None
    assert "metrics" in analysis_data
    assert len(analysis_data["candidate_models"]) > 0

    # 7. GET list of ML analyses
    list_res = client.get(f"/api/v1/datasets/{raw_dataset_id}/ml")
    assert list_res.status_code == 200
    assert len(list_res.json()) >= 1

    # 8. GET single ML analysis details
    detail_res = client.get(f"/api/v1/datasets/{raw_dataset_id}/ml/{analysis_id}")
    assert detail_res.status_code == 200
    assert detail_res.json()["id"] == analysis_id

    # 9. POST valid single-row prediction using stored trained model artifact
    features = analysis_data["feature_columns"]
    valid_single_item = {
        "units_sold": 5,
        "unit_price": 5000,
        "category": "Electronics",
        "region": "East",
        "product": "Laptop A"
    }
    valid_single_record = {k: v for k, v in valid_single_item.items() if k in features}
    valid_single_payload = {"inputs": [valid_single_record]}

    predict_res = client.post(f"/api/v1/datasets/{raw_dataset_id}/ml/{analysis_id}/predict", json=valid_single_payload)
    assert predict_res.status_code == 200
    pred_data = predict_res.json()
    assert pred_data["analysis_id"] == analysis_id
    assert len(pred_data["predictions"]) == 1
    assert "stored model artifact" in pred_data["explanation"]

    # 10. Multi-row valid prediction (200)
    valid_multi_payload = {"inputs": [valid_single_record, valid_single_record]}
    multi_res = client.post(f"/api/v1/datasets/{raw_dataset_id}/ml/{analysis_id}/predict", json=valid_multi_payload)
    assert multi_res.status_code == 200
    assert len(multi_res.json()["predictions"]) == 2

    # 11. Deterministic repeated prediction (identical output)
    pred_repeat_1 = client.post(f"/api/v1/datasets/{raw_dataset_id}/ml/{analysis_id}/predict", json=valid_single_payload).json()
    pred_repeat_2 = client.post(f"/api/v1/datasets/{raw_dataset_id}/ml/{analysis_id}/predict", json=valid_single_payload).json()
    assert pred_repeat_1 == pred_repeat_2

    # 12. HARDENING TEST 1: Reject empty inputs list [] (400)
    empty_payload = {"inputs": []}
    empty_res = client.post(f"/api/v1/datasets/{raw_dataset_id}/ml/{analysis_id}/predict", json=empty_payload)
    assert empty_res.status_code == 400
    assert "cannot be empty" in empty_res.json()["detail"]

    # 13. HARDENING TEST 2: Reject empty feature object {} (400)
    empty_dict_payload = {"inputs": [{}]}
    empty_dict_res = client.post(f"/api/v1/datasets/{raw_dataset_id}/ml/{analysis_id}/predict", json=empty_dict_payload)
    assert empty_dict_res.status_code == 400
    assert "cannot be empty" in empty_dict_res.json()["detail"]

    # 14. HARDENING TEST 3: Reject Swagger additionalProp1 payload (400)
    dummy_payload = {"inputs": [{"additionalProp1": {}}]}
    dummy_res = client.post(f"/api/v1/datasets/{raw_dataset_id}/ml/{analysis_id}/predict", json=dummy_payload)
    assert dummy_res.status_code == 400
    assert "contains unknown feature columns" in dummy_res.json()["detail"]

    # 15. HARDENING TEST 4: Reject missing required feature (400)
    missing_record = {k: v for k, v in valid_single_record.items() if k != features[0]}
    missing_res = client.post(f"/api/v1/datasets/{raw_dataset_id}/ml/{analysis_id}/predict", json={"inputs": [missing_record]})
    assert missing_res.status_code == 400
    assert "is missing required feature columns" in missing_res.json()["detail"]

    # 16. HARDENING TEST 5: Reject unknown feature (400)
    unknown_record = {**valid_single_record, "fake_column": 123}
    unknown_res = client.post(f"/api/v1/datasets/{raw_dataset_id}/ml/{analysis_id}/predict", json={"inputs": [unknown_record]})
    assert unknown_res.status_code == 400
    assert "contains unknown feature columns" in unknown_res.json()["detail"]

    # 17. HARDENING TEST 6: Reject invalid numeric value (400)
    invalid_num_record = {**valid_single_record}
    for col in features:
        if col in ["units_sold", "unit_price"]:
            invalid_num_record[col] = "not-a-number"
            break
    invalid_num_res = client.post(f"/api/v1/datasets/{raw_dataset_id}/ml/{analysis_id}/predict", json={"inputs": [invalid_num_record]})
    assert invalid_num_res.status_code == 400
    assert "Expected number" in invalid_num_res.json()["detail"]

    # 18. HARDENING TEST 7: Reject null numeric value (400)
    null_record = {**valid_single_record}
    null_record[features[0]] = None
    null_res = client.post(f"/api/v1/datasets/{raw_dataset_id}/ml/{analysis_id}/predict", json={"inputs": [null_record]})
    assert null_res.status_code == 400
    assert "contains null/missing values" in null_res.json()["detail"]

    # 19. HARDENING TEST 8: Reject nested object value (400)
    nested_record = {**valid_single_record}
    nested_record[features[0]] = {"nested": "value"}
    nested_res = client.post(f"/api/v1/datasets/{raw_dataset_id}/ml/{analysis_id}/predict", json={"inputs": [nested_record]})
    assert nested_res.status_code == 400
    assert "Nested structures are not allowed" in nested_res.json()["detail"]

    # 20. HARDENING TEST: Non-existent analysis_id returns 404
    missing_analysis_res = client.post(f"/api/v1/datasets/{raw_dataset_id}/ml/nonexistent-analysis-id/predict", json=valid_single_payload)
    assert missing_analysis_res.status_code == 404

    # 21. HARDENING TEST: Non-existent dataset_id returns 404
    missing_dataset_res = client.get(f"/api/v1/datasets/nonexistent-dataset-id/ml/tasks")
    assert missing_dataset_res.status_code == 404



