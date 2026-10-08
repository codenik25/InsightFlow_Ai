import io
import uuid


def test_list_and_create_workspace(client):
    # 1. Listing workspaces should auto-seed or return default workspace
    res = client.get("/api/v1/workspaces")
    assert res.status_code == 200
    workspaces = res.json()
    assert len(workspaces) >= 1
    assert "id" in workspaces[0]
    assert "name" in workspaces[0]

    # 2. Create custom workspace
    ws_name = f"Test Workspace {uuid.uuid4().hex[:6]}"
    create_res = client.post(
        "/api/v1/workspaces",
        json={"name": ws_name, "description": "Custom test workspace"},
    )
    assert create_res.status_code == 201
    created_ws = create_res.json()
    assert created_ws["name"] == ws_name
    assert created_ws["description"] == "Custom test workspace"

    # 3. Retrieve workspace by ID
    get_res = client.get(f"/api/v1/workspaces/{created_ws['id']}")
    assert get_res.status_code == 200
    assert get_res.json()["id"] == created_ws["id"]


def test_project_crud_and_dataset_association(client):
    # 1. Get primary workspace
    ws_res = client.get("/api/v1/workspaces")
    assert ws_res.status_code == 200
    primary_ws = ws_res.json()[0]

    # 2. Create new project in this workspace
    proj_name = f"Operations Project {uuid.uuid4().hex[:6]}"
    proj_res = client.post(
        f"/api/v1/workspaces/{primary_ws['id']}/projects",
        json={"name": proj_name, "description": "Operations and logistics dataset tracking"},
    )
    assert proj_res.status_code == 201
    proj_data = proj_res.json()
    assert proj_data["name"] == proj_name
    assert proj_data["workspace_id"] == primary_ws["id"]
    project_id = proj_data["id"]

    # 3. Update project details
    patch_res = client.patch(
        f"/api/v1/projects/{project_id}",
        json={"description": "Updated project description"},
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["description"] == "Updated project description"

    # 4. Upload dataset associated with this project
    csv_content = (
        "patient_id,age,department,stay_days,cost\n"
        "P1,45,Cardiology,4,1200.50\n"
        "P2,62,Neurology,7,3400.00\n"
        "P3,29,Orthopedics,2,850.00\n"
    )
    upload_res = client.post(
        "/api/v1/datasets/upload",
        files={"file": ("project_hospital_test.csv", io.BytesIO(csv_content.encode("utf-8")), "text/csv")},
        data={"project_id": project_id},
    )
    assert upload_res.status_code == 201
    uploaded_data = upload_res.json()
    dataset_id = uploaded_data["dataset_id"]

    # 5. Fetch project datasets registry
    registry_res = client.get(f"/api/v1/projects/{project_id}/datasets")
    assert registry_res.status_code == 200
    reg_data = registry_res.json()
    assert reg_data["id"] == project_id
    assert reg_data["dataset_count"] >= 1
    assert len(reg_data["datasets"]) >= 1

    ds_entry = next((d for d in reg_data["datasets"] if d["id"] == dataset_id), None)
    assert ds_entry is not None
    assert ds_entry["name"] == "project_hospital_test.csv"
    assert ds_entry["row_count"] == 3
    assert ds_entry["column_count"] == 5
    assert ds_entry["status"] == "READY"
    assert ds_entry["quality_score"] is not None
    assert ds_entry["quality_score"] >= 0.0

    # 6. Verify list_datasets with project_id filter
    filter_res = client.get(f"/api/v1/datasets?project_id={project_id}")
    assert filter_res.status_code == 200
    filter_data = filter_res.json()
    assert filter_data["total"] >= 1
    assert any(d["id"] == dataset_id for d in filter_data["items"])
