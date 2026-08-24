import io
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_controllable_feature_discovery_and_rules():
    csv_content = """txn_id,transaction_date,customer_code,product_category,unit_price,units_sold,constant_col,high_missing,target_revenue
101,2026-08-01,CUST01,Electronics,100,5,CONST,,500
102,2026-08-02,CUST02,Electronics,200,3,CONST,,600
103,2026-08-03,CUST03,Accessories,50,10,CONST,,500
104,2026-08-04,CUST04,Accessories,150,2,CONST,,300
105,2026-08-05,CUST05,Electronics,300,4,CONST,,1200
106,2026-08-06,CUST06,Accessories,120,6,CONST,,720
107,2026-08-07,CUST07,Electronics,250,1,CONST,,250
108,2026-08-08,CUST08,Accessories,80,8,CONST,,640
"""

    # 1. Upload raw dataset
    upload_res = client.post(
        "/api/v1/datasets/upload",
        files={"file": ("test_opt.csv", io.BytesIO(csv_content.encode("utf-8")), "text/csv")},
    )
    assert upload_res.status_code == 201
    raw_dataset_id = upload_res.json()["dataset_id"]

    # Test 9: Raw dataset without processed child returns 400
    raw_opt_res = client.get(f"/api/v1/datasets/{raw_dataset_id}/decision/optimization/options")
    assert raw_opt_res.status_code == 400
    assert "requires a processed dataset" in raw_opt_res.json()["detail"]

    # 2. Clean dataset
    plan_payload = {
        "dataset_id": raw_dataset_id,
        "operations": [{"type": "remove_duplicates"}]
    }
    apply_res = client.post(f"/api/v1/datasets/{raw_dataset_id}/clean/apply", json=plan_payload)
    assert apply_res.status_code == 200
    proc_dataset_id = apply_res.json()["output_dataset_id"]

    # Test 10: Raw dataset WITH processed child resolves to processed dataset
    raw_with_child_res = client.get(f"/api/v1/datasets/{raw_dataset_id}/decision/optimization/options")
    # Will return 400 because ML analysis hasn't been run yet on proc_dataset_id
    assert raw_with_child_res.status_code == 400
    assert "No ML analysis found" in raw_with_child_res.json()["detail"]

    # 3. Run ML Analysis
    analyze_res = client.post(
        f"/api/v1/datasets/{proc_dataset_id}/ml/analyze",
        json={"task_type": "regression", "target_column": "target_revenue"},
    )
    assert analyze_res.status_code == 200
    analysis_id = analyze_res.json()["id"]

    # 4. Discover Controllable Features
    opt_res = client.get(f"/api/v1/datasets/{proc_dataset_id}/decision/optimization/options")
    assert opt_res.status_code == 200
    opt_data = opt_res.json()

    assert opt_data["dataset_id"] == proc_dataset_id
    assert opt_data["analysis_id"] == analysis_id
    assert opt_data["target_column"] == "target_revenue"
    assert opt_data["objective_options"] == ["maximize", "minimize"]

    # Test 12: Small dataset warning appears for < 30 rows
    assert len(opt_data["warnings"]) > 0
    assert "contains only 8 rows" in opt_data["warnings"][0]

    features_map = {f["column"]: f for f in opt_data["controllable_features"]}

    # Test 1: Numeric business feature (units_sold, unit_price) discovered as controllable
    assert "units_sold" in features_map
    assert features_map["units_sold"]["allowed"] is True
    assert features_map["units_sold"]["optimization_supported"] is True
    assert features_map["units_sold"]["data_type"] == "numeric"

    # Test 2: Target column excluded if in feature set
    if "target_revenue" in features_map:
        assert features_map["target_revenue"]["allowed"] is False
        assert "Target column cannot be directly optimized" in features_map["target_revenue"]["exclusion_reason"]

    # Test 3: Identifier column (txn_id, customer_code) excluded
    if "txn_id" in features_map:
        assert features_map["txn_id"]["allowed"] is False
        assert "Identifier column is not suitable for optimization" in features_map["txn_id"]["exclusion_reason"]

    if "customer_code" in features_map:
        assert features_map["customer_code"]["allowed"] is False
        assert "Identifier column is not suitable for optimization" in features_map["customer_code"]["exclusion_reason"]

    # Test 4: Temporal / Date column (transaction_date) excluded
    if "transaction_date" in features_map:
        assert features_map["transaction_date"]["allowed"] is False
        assert "Temporal column is not supported" in features_map["transaction_date"]["exclusion_reason"]

    # Test 5: Zero-variance column (constant_col) excluded
    if "constant_col" in features_map:
        assert features_map["constant_col"]["allowed"] is False
        assert "Feature has no variation" in features_map["constant_col"]["exclusion_reason"]

    # Test 6: High-missingness column (high_missing) excluded
    if "high_missing" in features_map:
        assert features_map["high_missing"]["allowed"] is False
        assert "missingness safety threshold" in features_map["high_missing"]["exclusion_reason"]

    # Test 7: Supported low-cardinality categorical (product_category) handled
    if "product_category" in features_map:
        assert features_map["product_category"]["allowed"] is True
        assert features_map["product_category"]["data_type"] == "categorical"
        assert len(features_map["product_category"]["categories"]) == 2

    # Test 11: Cross-dataset ML analysis is rejected with 404
    cross_res = client.get(f"/api/v1/datasets/{proc_dataset_id}/decision/optimization/options?analysis_id=invalid-analysis-id")
    assert cross_res.status_code == 404

    # Test 13: Deterministic Feature Discovery
    opt_res2 = client.get(f"/api/v1/datasets/{proc_dataset_id}/decision/optimization/options")
    assert opt_res2.status_code == 200
    assert opt_res.json()["controllable_features"] == opt_res2.json()["controllable_features"]
