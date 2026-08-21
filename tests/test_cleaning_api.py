import io
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_quality_and_cleaning_api_workflow():
    # 1. Upload dirty CSV dataset
    csv_content = """transaction_id,date,product,category,region,units_sold,unit_price,total_revenue
1001,2026-08-01,Laptop A,Electronics,Jaipur,2,55000,110000
1002,2026-08-02,Laptop B,Electronics,Delhi,1,65000,65000
1003,2026-08-03,Monitor A,Electronics,Jaipur,3,15000,45000
1004,2026-08-04,Keyboard A,Accessories,Mumbai,5,2500,12500
1005,2026-08-05,Mouse A,Accessories,Delhi,10,1200,12000
1006,2026-08-06,Laptop A,Electronics,Jaipur,1,55000,55000
1007,2026-08-07,Laptop C,Electronics,Mumbai,2,72000,144000
1008,2026-08-08,Monitor B,Electronics,Delhi,4,18000,72000
1009,2026-08-09,Keyboard B,Accessories,Jaipur,6,3000,18000
1010,2026-08-10,Mouse B,Accessories,Mumbai,8,1500,12000
1011,2026-08-11,Laptop B,Electronics,Delhi,2,65000,130000
1012,2026-08-12,Monitor A,Electronics,Jaipur,2,15000,30000
1013,2026-08-13,Laptop C,Electronics,Mumbai,1,72000,72000
1014,2026-08-14,Keyboard A,Accessories,Mumbai,4,2500,10000
1015,2026-08-15,Mouse A,Accessories,Delhi,12,1200,14400
1015,2026-08-15,Mouse A,Accessories,Delhi,12,1200,14400
1016,2026-08-16,Laptop D,Electronics,Jaipur,,58000,
1017,2026-08-17,Laptop E,Electronics,,2,60000,120000
1018,2026-08-18,Monitor C,Electronics,Delhi,3,,45000
"""

    upload_res = client.post(
        "/api/v1/datasets/upload",
        files={"file": ("test_phase1_dirty.csv", io.BytesIO(csv_content.encode("utf-8")), "text/csv")},
    )
    assert upload_res.status_code == 201
    dataset_id = upload_res.json()["dataset_id"]

    # 2. Get Quality Score
    quality_res = client.get(f"/api/v1/datasets/{dataset_id}/quality")
    assert quality_res.status_code == 200
    quality_data = quality_res.json()
    assert quality_data["completeness"]["total_missing_cells"] == 4
    assert quality_data["uniqueness"]["duplicate_rows"] == 1
    assert "score" in quality_data

    # 3. Cleaning Preview
    plan_payload = {
        "dataset_id": dataset_id,
        "operations": [
            {"type": "remove_duplicates"},
            {"type": "fill_missing", "column": "region", "strategy": "mode"},
            {"type": "fill_missing", "column": "unit_price", "strategy": "median"},
            {"type": "fill_missing", "column": "units_sold", "strategy": "median"},
            {"type": "fill_missing", "column": "total_revenue", "strategy": "median"},
        ]
    }
    preview_res = client.post(f"/api/v1/datasets/{dataset_id}/clean/preview", json=plan_payload)
    assert preview_res.status_code == 200
    preview_data = preview_res.json()
    assert preview_data["before"]["total_rows"] == 19
    assert preview_data["expected_after"]["total_rows"] == 18
    assert preview_data["expected_after"]["total_missing_cells"] == 0

    # 4. Apply Cleaning Plan
    apply_res = client.post(f"/api/v1/datasets/{dataset_id}/clean/apply", json=plan_payload)
    assert apply_res.status_code == 200
    apply_data = apply_res.json()
    assert apply_data["after"]["total_rows"] == 18
    assert apply_data["after"]["total_missing_cells"] == 0
    assert apply_data["transformation_logs_count"] == 5
    out_id = apply_data["output_dataset_id"]

    # 5. Fetch Transformation History
    history_res = client.get(f"/api/v1/datasets/{dataset_id}/transformations")
    assert history_res.status_code == 200
    history_data = history_res.json()
    assert history_data["total"] >= 5

    # 6. Download Dataset File (version=raw and version=processed)
    dl_raw = client.get(f"/api/v1/datasets/{dataset_id}/download?version=raw")
    assert dl_raw.status_code == 200
    assert b"1015,2026-08-15,Mouse A" in dl_raw.content

    dl_proc = client.get(f"/api/v1/datasets/{dataset_id}/download?version=processed")
    assert dl_proc.status_code == 200
    assert len(dl_proc.content.decode("utf-8").strip().splitlines()) == 19  # 1 header + 18 data lines
