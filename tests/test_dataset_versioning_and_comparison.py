import io
import uuid
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.main import app
from app.core.database import SessionLocal
from app.models.workspace import Workspace
from app.models.project import Project
from app.models.dataset import Dataset
from app.models.insight import DatasetInsight
from app.models.ml_analysis import MLAnalysis

client = TestClient(app)


@pytest.fixture
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture
def test_project(db_session: Session):
    """Creates a distinct test project under a dedicated workspace."""
    ws = Workspace(
        id=str(uuid.uuid4()),
        name=f"Versioning Test Workspace {uuid.uuid4().hex[:6]}",
        description="Workspace for version testing",
    )
    db_session.add(ws)
    db_session.flush()

    proj = Project(
        id=str(uuid.uuid4()),
        workspace_id=ws.id,
        name=f"Versioning Test Project {uuid.uuid4().hex[:6]}",
        description="Testing lineage-aware versioning and comparison",
    )
    db_session.add(proj)
    db_session.commit()
    db_session.refresh(proj)
    return proj


def test_lineage_aware_version_increments_and_independence(db_session: Session, test_project: Project):
    """
    Tests 1, 2, 3:
    1. Same dataset lineage increments: hospital_data.csv -> v1, v2, v3
    2. Independent dataset starts at v1: patient_data.csv -> v1
    3. Patient second version: patient_data.csv -> v2
    Verifies immutability of earlier versions.
    """
    hosp_v1_csv = b"patient_id,cost,stay_days\n1,1000.0,3\n2,2000.0,5\n"
    hosp_v2_csv = b"patient_id,cost,stay_days,department\n1,1200.0,3,Cardio\n2,2100.0,4,Neuro\n3,3100.0,6,Ortho\n"
    hosp_v3_csv = b"patient_id,cost,stay_days,department\n1,1100.0,2,Cardio\n2,2050.0,4,Neuro\n"

    patient_v1_csv = b"patient_id,age,blood_group\n1,45,O+\n2,62,A+\n"
    patient_v2_csv = b"patient_id,age,blood_group,allergies\n1,45,O+,Penicillin\n2,62,A+,None\n3,33,B-,Sulfa\n"

    # 1. Upload hospital_data.csv -> v1
    r_h1 = client.post(
        "/api/v1/datasets/upload",
        files={"file": ("hospital_data.csv", io.BytesIO(hosp_v1_csv), "text/csv")},
        data={"project_id": test_project.id},
    )
    assert r_h1.status_code == 201
    h1_id = r_h1.json()["dataset_id"]
    ds_h1 = db_session.get(Dataset, h1_id)
    assert ds_h1.version == 1

    # Upload hospital_data.csv -> v2
    r_h2 = client.post(
        "/api/v1/datasets/upload",
        files={"file": ("hospital_data.csv", io.BytesIO(hosp_v2_csv), "text/csv")},
        data={"project_id": test_project.id},
    )
    assert r_h2.status_code == 201
    h2_id = r_h2.json()["dataset_id"]
    ds_h2 = db_session.get(Dataset, h2_id)
    assert ds_h2.version == 2

    # Upload hospital_data.csv -> v3
    r_h3 = client.post(
        "/api/v1/datasets/upload",
        files={"file": ("hospital_data.csv", io.BytesIO(hosp_v3_csv), "text/csv")},
        data={"project_id": test_project.id},
    )
    assert r_h3.status_code == 201
    h3_id = r_h3.json()["dataset_id"]
    ds_h3 = db_session.get(Dataset, h3_id)
    assert ds_h3.version == 3

    # 2. Independent dataset patient_data.csv starts at v1 (NOT v4!)
    r_p1 = client.post(
        "/api/v1/datasets/upload",
        files={"file": ("patient_data.csv", io.BytesIO(patient_v1_csv), "text/csv")},
        data={"project_id": test_project.id},
    )
    assert r_p1.status_code == 201
    p1_id = r_p1.json()["dataset_id"]
    ds_p1 = db_session.get(Dataset, p1_id)
    assert ds_p1.version == 1, f"Expected patient_data.csv to start at v1, got v{ds_p1.version}"

    # 3. Patient second version -> v2
    r_p2 = client.post(
        "/api/v1/datasets/upload",
        files={"file": ("patient_data.csv", io.BytesIO(patient_v2_csv), "text/csv")},
        data={"project_id": test_project.id},
    )
    assert r_p2.status_code == 201
    p2_id = r_p2.json()["dataset_id"]
    ds_p2 = db_session.get(Dataset, p2_id)
    assert ds_p2.version == 2, f"Expected patient_data.csv second version to be v2, got v{ds_p2.version}"

    # Verify immutability of previous versions
    db_session.refresh(ds_h1)
    db_session.refresh(ds_h2)
    db_session.refresh(ds_p1)
    assert ds_h1.version == 1
    assert ds_h1.row_count == 2
    assert ds_h2.version == 2
    assert ds_h2.row_count == 3
    assert ds_p1.version == 1
    assert ds_p1.row_count == 2


def test_same_lineage_comparison_succeeds(db_session: Session, test_project: Project):
    """Test 4: Same-lineage comparison succeeds (Hospital v1 vs Hospital v2)."""
    csv_v1 = b"patient_id,cost,admissions,status\n1,1000.0,2,Active\n2,2000.0,4,Active\n3,3000.0,6,Pending\n"
    csv_v2 = b"patient_id,cost,risk_score,status\n1,1500.0,0.85,Active\n2,2500.0,0.92,Active\n3,3500.0,0.78,Discharged\n4,4500.0,0.65,Active\n"

    r1 = client.post(
        "/api/v1/datasets/upload",
        files={"file": ("hospital_data.csv", io.BytesIO(csv_v1), "text/csv")},
        data={"project_id": test_project.id},
    )
    v1_id = r1.json()["dataset_id"]

    r2 = client.post(
        "/api/v1/datasets/upload",
        files={"file": ("hospital_data.csv", io.BytesIO(csv_v2), "text/csv")},
        data={"project_id": test_project.id},
    )
    v2_id = r2.json()["dataset_id"]

    cmp_res = client.get(f"/api/v1/datasets/{v1_id}/compare/{v2_id}")
    assert cmp_res.status_code == 200
    data = cmp_res.json()

    # 1. Summary
    summary = data["summary"]
    assert summary["rows_base"] == 3
    assert summary["rows_comparison"] == 4
    assert summary["rows_change"] == 1
    assert summary["columns_added_count"] == 1  # risk_score
    assert summary["columns_removed_count"] == 1  # admissions

    # 2. Schema changes
    schema = {sc["column"]: sc["change_type"] for sc in data["schema_changes"]}
    assert schema.get("risk_score") == "added"
    assert schema.get("admissions") == "removed"
    assert schema.get("cost") == "unchanged"

    # 3. Metric changes
    cost_metric = next((m for m in data["metric_changes"] if m["column"] == "cost"), None)
    assert cost_metric is not None
    assert cost_metric["base_mean"] == 2000.0
    assert cost_metric["comparison_mean"] == 3000.0
    assert cost_metric["mean_change_pct"] == 50.0

    # 4. Distribution changes
    status_dist = next((d for d in data["distribution_changes"] if d["column"] == "status"), None)
    assert status_dist is not None
    assert "Discharged" in status_dist["new_categories"]
    assert "Pending" in status_dist["disappeared_categories"]

    # 5. Quality delta
    quality = data["quality_changes"]
    assert quality["status"] in ["improved", "degraded", "stable"]


def test_cross_lineage_comparison_fails_with_400(db_session: Session, test_project: Project):
    """Test 5: Cross-lineage comparison (Hospital v1 vs Patient v1) fails with HTTP 400."""
    r_h = client.post(
        "/api/v1/datasets/upload",
        files={"file": ("hospital_data.csv", io.BytesIO(b"id,cost\n1,100\n"), "text/csv")},
        data={"project_id": test_project.id},
    )
    h_id = r_h.json()["dataset_id"]

    r_p = client.post(
        "/api/v1/datasets/upload",
        files={"file": ("patient_data.csv", io.BytesIO(b"id,age\n1,50\n"), "text/csv")},
        data={"project_id": test_project.id},
    )
    p_id = r_p.json()["dataset_id"]

    cmp_res = client.get(f"/api/v1/datasets/{h_id}/compare/{p_id}")
    assert cmp_res.status_code == 400
    assert "Cross-lineage dataset comparison is not permitted" in cmp_res.text


def test_cross_project_comparison_still_fails(db_session: Session, test_project: Project):
    """Test 6: Cross-project comparison is rejected with HTTP 400."""
    other_proj = Project(
        id=str(uuid.uuid4()),
        workspace_id=test_project.workspace_id,
        name="Other Isolated Project",
    )
    db_session.add(other_proj)
    db_session.commit()

    r1 = client.post(
        "/api/v1/datasets/upload",
        files={"file": ("hospital_data.csv", io.BytesIO(b"x,y\n1,10\n"), "text/csv")},
        data={"project_id": test_project.id},
    )
    r2 = client.post(
        "/api/v1/datasets/upload",
        files={"file": ("hospital_data.csv", io.BytesIO(b"x,y\n1,20\n"), "text/csv")},
        data={"project_id": other_proj.id},
    )

    cmp_res = client.get(f"/api/v1/datasets/{r1.json()['dataset_id']}/compare/{r2.json()['dataset_id']}")
    assert cmp_res.status_code == 400
    assert "Cross-project dataset comparison is not permitted" in cmp_res.text


def test_self_comparison_returns_zero_deltas(db_session: Session, test_project: Project):
    """Test 7: Self-comparison returns zero deltas."""
    csv = b"a,b\n1,10\n2,20\n"
    res = client.post(
        "/api/v1/datasets/upload",
        files={"file": ("self_test.csv", io.BytesIO(csv), "text/csv")},
        data={"project_id": test_project.id},
    )
    ds_id = res.json()["dataset_id"]

    cmp_res = client.get(f"/api/v1/datasets/{ds_id}/compare/{ds_id}")
    assert cmp_res.status_code == 200
    data = cmp_res.json()
    assert data["summary"]["rows_change"] == 0
    assert data["summary"]["columns_added_count"] == 0
    assert data["summary"]["columns_removed_count"] == 0


def test_raw_to_processed_lineage_and_version_retention(db_session: Session, test_project: Project):
    """
    Tests 8 & 9:
    8. Raw -> processed lineage remains correct (parent_id == raw.id, is_processed == True, project_id preserved).
    9. Processed child retains the raw version number.
    """
    # Upload raw hospital_data.csv v1 then v2
    client.post(
        "/api/v1/datasets/upload",
        files={"file": ("hospital_ops.csv", io.BytesIO(b"id,val\n1,10\n"), "text/csv")},
        data={"project_id": test_project.id},
    )
    r_v2 = client.post(
        "/api/v1/datasets/upload",
        files={"file": ("hospital_ops.csv", io.BytesIO(b"id,val\n1,10\n2,20\n2,20\n"), "text/csv")},
        data={"project_id": test_project.id},
    )
    raw_v2_id = r_v2.json()["dataset_id"]
    raw_v2 = db_session.get(Dataset, raw_v2_id)
    assert raw_v2.version == 2
    assert raw_v2.is_processed is False
    assert raw_v2.parent_id is None

    # Apply cleaning to raw v2
    clean_plan = {
        "dataset_id": raw_v2_id,
        "operations": [
            {"type": "remove_duplicates"},
        ],
    }
    clean_res = client.post(f"/api/v1/datasets/{raw_v2_id}/clean/apply", json=clean_plan)
    assert clean_res.status_code == 200
    proc_id = clean_res.json()["output_dataset_id"]

    proc_ds = db_session.get(Dataset, proc_id)
    assert proc_ds is not None
    # 8. Verify raw -> processed lineage
    assert proc_ds.is_processed is True
    assert proc_ds.parent_id == raw_v2_id
    assert proc_ds.project_id == test_project.id

    # 9. Processed child retains the raw version number
    assert proc_ds.version == raw_v2.version == 2


def test_version_listing_for_dataset_returns_only_its_own_lineage(db_session: Session, test_project: Project):
    """Test 10: GET /datasets/{dataset_id}/versions returns ONLY its own lineage."""
    # Seed Hospital v1, v2, v3
    r_h1 = client.post(
        "/api/v1/datasets/upload",
        files={"file": ("lineage_hosp.csv", io.BytesIO(b"x\n1\n"), "text/csv")},
        data={"project_id": test_project.id},
    )
    r_h2 = client.post(
        "/api/v1/datasets/upload",
        files={"file": ("lineage_hosp.csv", io.BytesIO(b"x\n2\n"), "text/csv")},
        data={"project_id": test_project.id},
    )
    r_h3 = client.post(
        "/api/v1/datasets/upload",
        files={"file": ("lineage_hosp.csv", io.BytesIO(b"x\n3\n"), "text/csv")},
        data={"project_id": test_project.id},
    )
    h2_id = r_h2.json()["dataset_id"]

    # Seed Patient v1, v2 in same project
    client.post(
        "/api/v1/datasets/upload",
        files={"file": ("lineage_patient.csv", io.BytesIO(b"y\n1\n"), "text/csv")},
        data={"project_id": test_project.id},
    )
    client.post(
        "/api/v1/datasets/upload",
        files={"file": ("lineage_patient.csv", io.BytesIO(b"y\n2\n"), "text/csv")},
        data={"project_id": test_project.id},
    )

    # Query versions for Hospital v2
    v_res = client.get(f"/api/v1/datasets/{h2_id}/versions")
    assert v_res.status_code == 200
    v_data = v_res.json()

    assert v_data["lineage_name"] == "lineage_hosp.csv"
    assert v_data["total_versions"] == 3
    names = {v["name"] for v in v_data["versions"]}
    assert names == {"lineage_hosp.csv"}
    assert "lineage_patient.csv" not in names
    versions = [v["version"] for v in v_data["versions"]]
    assert versions == [3, 2, 1]


def test_project_level_version_listing_groups_by_lineage(db_session: Session, test_project: Project):
    """
    Test 11: Project-level version listing does not create a misleading flat timeline.
    Verifies lineages discovery, family groups, and explicit lineage query filtering.
    """
    # Seed 2 versions of Alpha and 1 version of Beta
    client.post(
        "/api/v1/datasets/upload",
        files={"file": ("alpha_data.csv", io.BytesIO(b"a\n1\n"), "text/csv")},
        data={"project_id": test_project.id},
    )
    client.post(
        "/api/v1/datasets/upload",
        files={"file": ("alpha_data.csv", io.BytesIO(b"a\n2\n"), "text/csv")},
        data={"project_id": test_project.id},
    )
    client.post(
        "/api/v1/datasets/upload",
        files={"file": ("beta_data.csv", io.BytesIO(b"b\n1\n"), "text/csv")},
        data={"project_id": test_project.id},
    )

    # 1. Unfiltered call: should discover both lineages and return primary family
    proj_res = client.get(f"/api/v1/projects/{test_project.id}/versions")
    assert proj_res.status_code == 200
    p_data = proj_res.json()

    assert "alpha_data.csv" in p_data["lineages"]
    assert "beta_data.csv" in p_data["lineages"]
    assert len(p_data["families"]) == 2

    # versions returned should NOT be a flat mix of alpha + beta
    assert p_data["lineage_name"] in ["alpha_data.csv", "beta_data.csv"]
    for v in p_data["versions"]:
        assert v["name"] == p_data["lineage_name"]

    # 2. Filtered call with ?lineage=beta_data.csv
    beta_res = client.get(f"/api/v1/projects/{test_project.id}/versions?lineage=beta_data.csv")
    assert beta_res.status_code == 200
    b_data = beta_res.json()
    assert b_data["lineage_name"] == "beta_data.csv"
    assert b_data["total_versions"] == 1
    assert len(b_data["versions"]) == 1
    assert b_data["versions"][0]["name"] == "beta_data.csv"
    assert b_data["versions"][0]["version"] == 1


def test_insight_and_prediction_impact(db_session: Session, test_project: Project):
    """Test 12: Downstream impact on insights and trained ML models within same lineage."""
    csv_base = b"feat1,feat2,target\n1,10,100\n2,20,200\n3,30,300\n"
    csv_comp = b"feat1,unrelated\n1,10\n2,20\n3,30\n"  # feat2 and target removed

    res_base = client.post(
        "/api/v1/datasets/upload",
        files={"file": ("hospital_ml.csv", io.BytesIO(csv_base), "text/csv")},
        data={"project_id": test_project.id},
    )
    base_id = res_base.json()["dataset_id"]

    res_comp = client.post(
        "/api/v1/datasets/upload",
        files={"file": ("hospital_ml.csv", io.BytesIO(csv_comp), "text/csv")},
        data={"project_id": test_project.id},
    )
    comp_id = res_comp.json()["dataset_id"]

    # Seed an insight linked to feat2
    ins = DatasetInsight(
        dataset_id=base_id,
        category="KPI",
        severity="INFO",
        title="Feat2 Efficiency Indicator",
        observation="Feat2 indicates strong baseline efficiency.",
        evidence={"score": 88},
        source_column="feat2",
    )
    db_session.add(ins)

    # Seed an MLAnalysis model requiring feat1, feat2, target
    ml = MLAnalysis(
        dataset_id=base_id,
        task_type="regression",
        target_column="target",
        feature_columns=["feat1", "feat2"],
        model_name="RandomForestRegressor",
        status="completed",
    )
    db_session.add(ml)
    db_session.commit()

    cmp_res = client.get(f"/api/v1/datasets/{base_id}/compare/{comp_id}")
    assert cmp_res.status_code == 200
    data = cmp_res.json()

    # Insight impact check: feat2 was removed -> NO LONGER OBSERVED
    ins_impact = next((i for i in data["insight_impacts"] if i["title"] == "Feat2 Efficiency Indicator"), None)
    assert ins_impact is not None
    assert ins_impact["status"] == "NO LONGER OBSERVED"

    # Prediction impact check: feat2 and target missing -> MODEL INPUT SCHEMA CHANGED
    pred_impact = data["prediction_impact"]
    assert pred_impact["schema_status"] == "MODEL INPUT SCHEMA CHANGED"
    assert pred_impact["refresh_recommended"] is True
    assert "feat2" in pred_impact["affected_features"]
    assert "target" in pred_impact["missing_targets"]
