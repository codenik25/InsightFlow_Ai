import io


def test_api_upload_sample_csv(client):
    csv_content = (
        "transaction_id,date,region,category,product,units_sold,unit_price,total_revenue\n"
        "TXN-1001,2026-01-05,North America,Electronics,Wireless Headphones,15,89.99,1349.85\n"
        "TXN-1002,2026-01-06,Europe,Software,Analytics Suite Enterprise,2,1200.00,2400.00\n"
        "TXN-1003,2026-01-08,Asia-Pacific,Hardware,Ergonomic Keyboard,45,49.50,2227.50\n"
    )

    response = client.post(
        "/api/v1/datasets/upload",
        files={"file": ("sample_sales_data.csv", io.BytesIO(csv_content.encode("utf-8")), "text/csv")},
    )

    assert response.status_code == 201
    data = response.json()
    assert "dataset_id" in data
    assert data["overview"]["filename"] == "sample_sales_data.csv"
    assert data["overview"]["total_rows"] == 3
    assert data["overview"]["total_columns"] == 8

    dataset_id = data["dataset_id"]

    # Verify profile retrieval GET endpoint
    profile_response = client.get(f"/api/v1/datasets/{dataset_id}/profile")
    assert profile_response.status_code == 200
    pdata = profile_response.json()
    assert pdata["dataset_id"] == dataset_id
    assert len(pdata["columns"]) == 8


def test_api_upload_invalid_extension(client):
    response = client.post(
        "/api/v1/datasets/upload",
        files={"file": ("document.pdf", io.BytesIO(b"dummy pdf content"), "application/pdf")},
    )
    assert response.status_code == 400
    assert "Only CSV files" in response.json()["detail"]


def test_api_upload_malformed_csv(client):
    # Malformed / empty headers
    response = client.post(
        "/api/v1/datasets/upload",
        files={"file": ("malformed.csv", io.BytesIO(b""), "text/csv")},
    )
    assert response.status_code == 400
