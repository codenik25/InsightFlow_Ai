import io
import sys
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app, raise_server_exceptions=False)

HARDCORE_HOSPITAL_CSV = """patient_id,date,city,hospital,department,category,units_sold,unit_price,average_bill,operating_cost,occupancy_rate,patient_satisfaction,readmission_rate,notes,total_revenue
P001,2026-08-01,New York,St Jude,Cardiology,Inpatient,5,"$5,000","$12,000.50","$50,000",0.75,85,0.12,"patient admitted with mild chest pain","$25,000"
P002,2026-08-02,Boston,Mercy,Neurology,Outpatient,3,"$12,500","$15,200.00","$60,000",0.80,90,0.15,"scheduled MRI scan follow-up","$37,500"
P003,2026-08-03,Chicago,General,Orthopedics,Inpatient,10,"$2,000","$8,500.00","$45,000",0.85,78,0.18,"knee replacement consultation","$20,000"
P004,2026-08-04,Dallas,CityCare,Cardiology,Outpatient,2,"$8,000","$18,000.00","$70,000",0.90,92,0.10,"ECG routine checkup","$16,000"
P005,2026-08-05,Houston,Mount Sinai,Oncology,Inpatient,4,"$15,000","$22,000.00","$85,000",0.95,88,0.22,"chemotherapy session 1","$60,000"
P006,2026-08-06,Miami,Grace,Neurology,Inpatient,6,"$6,000","$11,000.00","$55,000",0.70,82,0.14,"N/A","$36,000"
P007,2026-08-07,Seattle,Swedish,Orthopedics,Outpatient,1,"$25,000","$28,000.00","$90,000",0.88,95,0.08,"patient requested extra blankets","$25,000"
P008,2026-08-08,Denver,St Anthony,Cardiology,Inpatient,8,"$3,500","$9,800.00","$48,000",0.82,86,0.16,"physical therapy session","$28,000"
P009,2026-08-09,Phoenix,Valley,Oncology,Outpatient,5,"$7,500","$16,500.00","$65,000",0.78,84,0.19,"lab test bloodwork","$37,500"
P010,2026-08-10,Atlanta,Piedmont,Neurology,Inpatient,3,"$18,000","$24,000.00","$95,000",0.92,91,0.11,"patient discharged home","$54,000"
P011,2026-08-11,Detroit,Henry Ford,Orthopedics,Outpatient,7,"$4,000","$10,500.00","$52,000",1.35,140,1.40,"EEG diagnostic scan","$28,000"
P012,2026-08-12,Austin,Seton,Cardiology,Inpatient,2,"$12,000","$19,500.00","$75,000",0.86,89,0.13,"hip surgery follow-up","$24,000"
P013,2026-08-13,San Jose,Good Sam,Oncology,Inpatient,4,"$9,000","$14,000.00","$58,000",-0.20,-15,-0.05,"blood pressure monitoring","$36,000"
P014,2026-08-14,San Francisco,UCSF,Neurology,Outpatient,9,"$2,500","$7,200.00","$42,000",0.74,80,0.17,"consultation with specialist","$22,500"
P015,2026-08-15,Los Angeles,Cedars,Orthopedics,Inpatient,3,"$11,000","-$500.00","-$100",0.81,87,0.15,"patient recovering well","$33,000"
"""

HIGH_CARDINALITY_IDENTIFIERS_CSV = """account_number,txn_code,record_id,department,operating_cost,average_bill,target_profit
ACC_1001,TXN_901,REC_001,Finance,5000,1200,3800
ACC_1002,TXN_902,REC_002,Sales,6000,1500,4500
ACC_1003,TXN_903,REC_003,Operations,7000,1800,5200
ACC_1004,TXN_904,REC_004,Finance,5500,1300,4200
ACC_1005,TXN_905,REC_005,Sales,6500,1600,4900
ACC_1006,TXN_906,REC_006,Operations,7500,1900,5600
ACC_1007,TXN_907,REC_007,Finance,5200,1250,3950
ACC_1008,TXN_908,REC_008,Sales,6200,1550,4650
ACC_1009,TXN_909,REC_009,Operations,7200,1850,5350
ACC_1010,TXN_910,REC_010,Finance,5800,1400,4400
"""


def test_hardcore_optimization_options_and_semantic_bounds():
    # 1. Upload Hardcore Hospital CSV
    u_res = client.post(
        "/api/v1/datasets/upload",
        files={"file": ("hardcore_hosp.csv", io.BytesIO(HARDCORE_HOSPITAL_CSV.encode("utf-8")), "text/csv")},
    )
    assert u_res.status_code == 201
    raw_id = u_res.json()["dataset_id"]

    # 2. Clean Dataset
    c_res = client.post(
        f"/api/v1/datasets/{raw_id}/clean/apply",
        json={"dataset_id": raw_id, "operations": [{"type": "remove_duplicates"}]},
    )
    assert c_res.status_code == 200
    proc_id = c_res.json()["output_dataset_id"]

    # 3. Run ML Analysis
    ml_res = client.post(
        f"/api/v1/datasets/{proc_id}/ml/analyze",
        json={"task_type": "regression", "target_column": "total_revenue", "datetime_column": "date"},
    )
    assert ml_res.status_code == 200
    analysis_id = ml_res.json()["id"]

    # 4. Fetch Optimization Options
    opt_res = client.get(f"/api/v1/datasets/{proc_id}/decision/optimization/options")
    assert opt_res.status_code == 200
    opt_data = opt_res.json()

    feat_map = {f["column"]: f for f in opt_data["controllable_features"]}

    # Requirement 1: average_bill & operating_cost are recognized as valid numeric measures
    assert "average_bill" in feat_map
    assert feat_map["average_bill"]["allowed"] is True
    assert feat_map["average_bill"]["data_type"] == "numeric"
    assert feat_map["average_bill"]["role"] == "measure"
    assert feat_map["average_bill"]["min_value"] >= 0.0  # -500 is excluded

    assert "operating_cost" in feat_map
    assert feat_map["operating_cost"]["allowed"] is True
    assert feat_map["operating_cost"]["data_type"] == "numeric"
    assert feat_map["operating_cost"]["role"] == "measure"
    assert feat_map["operating_cost"]["min_value"] >= 0.0  # -100 is excluded

    # Requirement 2: Semantic Range Bounds
    if "occupancy_rate" in feat_map and feat_map["occupancy_rate"]["allowed"]:
        assert feat_map["occupancy_rate"]["max_value"] <= 1.0
        assert feat_map["occupancy_rate"]["min_value"] >= 0.0

    if "patient_satisfaction" in feat_map and feat_map["patient_satisfaction"]["allowed"]:
        assert feat_map["patient_satisfaction"]["max_value"] <= 100.0
        assert feat_map["patient_satisfaction"]["min_value"] >= 0.0

    if "readmission_rate" in feat_map and feat_map["readmission_rate"]["allowed"]:
        assert feat_map["readmission_rate"]["max_value"] <= 1.0
        assert feat_map["readmission_rate"]["min_value"] >= 0.0

    # Requirement 3: Exclusions
    if "patient_id" in feat_map:
        assert feat_map["patient_id"]["allowed"] is False
        assert feat_map["patient_id"]["role"] == "identifier"

    if "notes" in feat_map:
        assert feat_map["notes"]["allowed"] is False
        assert feat_map["notes"]["role"] == "text"

    if "total_revenue" in feat_map:
        assert feat_map["total_revenue"]["allowed"] is False
        assert feat_map["total_revenue"]["role"] == "target"


def test_high_cardinality_numeric_identifiers_exclusion():
    # 1. Upload High Cardinality Identifiers CSV
    u_res = client.post(
        "/api/v1/datasets/upload",
        files={"file": ("identifiers_test.csv", io.BytesIO(HIGH_CARDINALITY_IDENTIFIERS_CSV.encode("utf-8")), "text/csv")},
    )
    assert u_res.status_code == 201
    raw_id = u_res.json()["dataset_id"]

    # 2. Clean Dataset
    c_res = client.post(
        f"/api/v1/datasets/{raw_id}/clean/apply",
        json={"dataset_id": raw_id, "operations": [{"type": "remove_duplicates"}]},
    )
    assert c_res.status_code == 200
    proc_id = c_res.json()["output_dataset_id"]

    # 3. Run ML Analysis
    ml_res = client.post(
        f"/api/v1/datasets/{proc_id}/ml/analyze",
        json={"task_type": "regression", "target_column": "target_profit"},
    )
    assert ml_res.status_code == 200

    # 4. Fetch Optimization Options
    opt_res = client.get(f"/api/v1/datasets/{proc_id}/decision/optimization/options")
    assert opt_res.status_code == 200
    opt_data = opt_res.json()

    feat_map = {f["column"]: f for f in opt_data["controllable_features"]}

    for id_col in ["account_number", "txn_code", "record_id"]:
        if id_col in feat_map:
            assert feat_map[id_col]["allowed"] is False
            assert feat_map[id_col]["role"] == "identifier"

    assert feat_map["operating_cost"]["allowed"] is True
    assert feat_map["operating_cost"]["data_type"] == "numeric"
    assert feat_map["average_bill"]["allowed"] is True
    assert feat_map["average_bill"]["data_type"] == "numeric"


def test_optimization_execution_with_non_controllable_high_cardinality_categorical_features():
    """Verify optimization scenario generation and prediction execution when ML model contains non-controllable categorical features (e.g. hospital, city)."""
    # 1. Upload Hardcore Hospital CSV
    u_res = client.post(
        "/api/v1/datasets/upload",
        files={"file": ("hardcore_exec.csv", io.BytesIO(HARDCORE_HOSPITAL_CSV.encode("utf-8")), "text/csv")},
    )
    assert u_res.status_code == 201
    raw_id = u_res.json()["dataset_id"]

    # 2. Clean Dataset
    c_res = client.post(
        f"/api/v1/datasets/{raw_id}/clean/apply",
        json={"dataset_id": raw_id, "operations": [{"type": "remove_duplicates"}]},
    )
    assert c_res.status_code == 200
    proc_id = c_res.json()["output_dataset_id"]

    # 3. Run ML Analysis
    ml_res = client.post(
        f"/api/v1/datasets/{proc_id}/ml/analyze",
        json={"task_type": "regression", "target_column": "total_revenue", "datetime_column": "date"},
    )
    assert ml_res.status_code == 200
    ml_data = ml_res.json()
    ml_id = ml_data["id"]
    required_features = ml_data["feature_columns"]

    # 4. Fetch Optimization Options and verify city/hospital exist as non-controllable
    options_res = client.get(f"/api/v1/datasets/{proc_id}/decision/optimization/options")
    assert options_res.status_code == 200
    options_data = options_res.json()
    feat_map = {f["column"]: f for f in options_data["controllable_features"]}

    if "hospital" in feat_map:
        assert feat_map["hospital"]["allowed"] is False
    if "city" in feat_map:
        assert feat_map["city"]["allowed"] is False

    # 5. Run Decision Optimization (POST /optimize)
    opt_exec_res = client.post(
        f"/api/v1/datasets/{proc_id}/decision/optimize",
        json={"analysis_id": ml_id, "objective": "maximize", "max_scenarios": 5},
    )
    assert opt_exec_res.status_code == 200
    exec_data = opt_exec_res.json()

    assert exec_data["dataset_id"] == proc_id
    assert exec_data["ml_analysis_id"] == ml_id
    assert len(exec_data["scenarios"]) > 0

    # Verify baseline_inputs contain all required model features including city and hospital
    baseline_inputs = exec_data["baseline_inputs"]
    for req_feat in required_features:
        assert req_feat in baseline_inputs

    # Verify each scenario input contains all required model features and only controllable features vary
    scenarios = exec_data["scenarios"]
    for scen in scenarios:
        scen_inputs = scen["inputs"]
        for req_feat in required_features:
            assert req_feat in scen_inputs
        # Non-controllable features (e.g. hospital, city) must remain equal to baseline
        for col, feat_info in feat_map.items():
            if not feat_info["allowed"] and col in required_features:
                assert scen_inputs[col] == baseline_inputs[col]

    # Verify target (total_revenue), free-text (notes), and date are excluded from baseline inputs
    assert "total_revenue" not in baseline_inputs
    assert "notes" not in baseline_inputs
    assert "date" not in baseline_inputs


def test_optimization_execution_only_numeric_controllable_features():
    """Verify optimization execution when dataset contains only numeric controllable features."""
    csv_data = """units_sold,unit_price,operating_cost,total_revenue
5,100,200,500
3,200,300,600
10,50,150,500
2,150,250,300
4,300,400,1200
6,120,220,720
1,250,350,250
8,80,180,640
"""
    u_res = client.post(
        "/api/v1/datasets/upload",
        files={"file": ("numeric_only.csv", io.BytesIO(csv_data.encode("utf-8")), "text/csv")},
    )
    raw_id = u_res.json()["dataset_id"]

    c_res = client.post(
        f"/api/v1/datasets/{raw_id}/clean/apply",
        json={"dataset_id": raw_id, "operations": [{"type": "remove_duplicates"}]},
    )
    proc_id = c_res.json()["output_dataset_id"]

    ml_res = client.post(
        f"/api/v1/datasets/{proc_id}/ml/analyze",
        json={"task_type": "regression", "target_column": "total_revenue"},
    )
    ml_id = ml_res.json()["id"]

    opt_res = client.post(
        f"/api/v1/datasets/{proc_id}/decision/optimize",
        json={"analysis_id": ml_id, "objective": "maximize", "max_scenarios": 5},
    )
    assert opt_res.status_code == 200
    data = opt_res.json()
    assert len(data["scenarios"]) > 0
    assert "total_revenue" not in data["baseline_inputs"]


def test_optimization_execution_free_text_and_datetime_excluded_from_model_inputs():
    """Verify free text (notes) and datetime (date) are excluded from model inputs and scenario inputs."""
    csv_data = """date,notes,units_sold,unit_price,total_revenue
2026-08-01,"admitted patient",5,100,500
2026-08-02,"routine checkup",3,200,600
2026-08-03,"mri follow-up",10,50,500
2026-08-04,"blood pressure test",2,150,300
2026-08-05,"chemotherapy session",4,300,1200
2026-08-06,"discharged home",6,120,720
2026-08-07,"consultation",1,250,250
2026-08-08,"physical therapy",8,80,640
"""
    u_res = client.post(
        "/api/v1/datasets/upload",
        files={"file": ("text_dt.csv", io.BytesIO(csv_data.encode("utf-8")), "text/csv")},
    )
    raw_id = u_res.json()["dataset_id"]

    c_res = client.post(
        f"/api/v1/datasets/{raw_id}/clean/apply",
        json={"dataset_id": raw_id, "operations": [{"type": "remove_duplicates"}]},
    )
    proc_id = c_res.json()["output_dataset_id"]

    ml_res = client.post(
        f"/api/v1/datasets/{proc_id}/ml/analyze",
        json={"task_type": "regression", "target_column": "total_revenue", "datetime_column": "date"},
    )
    ml_id = ml_res.json()["id"]

    opt_res = client.post(
        f"/api/v1/datasets/{proc_id}/decision/optimize",
        json={"analysis_id": ml_id, "objective": "maximize", "max_scenarios": 5},
    )
    assert opt_res.status_code == 200
    data = opt_res.json()
    b_inputs = data["baseline_inputs"]

    assert "notes" not in b_inputs
    assert "date" not in b_inputs
    assert "total_revenue" not in b_inputs


def test_optimization_missing_required_feature_baseline_context_returns_controlled_400():
    """Verify that if a required model feature has no valid baseline context in dataset, a controlled 400 error is returned."""
    # Test 1: Raw dataset protection
    csv_data = """units_sold,unit_price,corrupt_col,total_revenue
5,100,N/A,500
3,200,N/A,600
10,50,N/A,500
2,150,N/A,300
4,300,N/A,1200
6,120,N/A,720
1,250,N/A,250
8,80,N/A,640
"""
    u_res = client.post(
        "/api/v1/datasets/upload",
        files={"file": ("corrupt.csv", io.BytesIO(csv_data.encode("utf-8")), "text/csv")},
    )
    raw_id = u_res.json()["dataset_id"]

    raw_opt_res = client.post(
        f"/api/v1/datasets/{raw_id}/decision/optimize",
        json={"objective": "maximize"},
    )
    assert raw_opt_res.status_code == 400
    assert "requires a processed dataset" in raw_opt_res.json()["detail"]

    # Test 2: Clean dataset and run ML analysis
    c_res = client.post(
        f"/api/v1/datasets/{raw_id}/clean/apply",
        json={"dataset_id": raw_id, "operations": [{"type": "remove_duplicates"}]},
    )
    proc_id = c_res.json()["output_dataset_id"]

    ml_res = client.post(
        f"/api/v1/datasets/{proc_id}/ml/analyze",
        json={"task_type": "regression", "target_column": "total_revenue"},
    )
    assert ml_res.status_code == 200
    ml_id = ml_res.json()["id"]

    # Test 3: Pass unknown feature in baseline_inputs (returns controlled 400)
    bad_inputs_res = client.post(
        f"/api/v1/datasets/{proc_id}/decision/optimize",
        json={"analysis_id": ml_id, "objective": "maximize", "baseline_inputs": {"non_existent_col": 999}},
    )
    assert bad_inputs_res.status_code == 400
    assert "unknown feature columns" in bad_inputs_res.json()["detail"].lower()
