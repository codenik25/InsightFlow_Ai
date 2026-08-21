from app.services.health_service import HealthService
from app.services.dataset_service import DatasetService
from app.schemas.dataset import DatasetCreate


def test_database_health_probe(db_session):
    """Test HealthService database status probe on active session."""
    health_response = HealthService.check_health(db=db_session)
    assert health_response.status == "healthy"
    assert health_response.database_connected is True
    assert "operational" in health_response.details.lower()


def test_dataset_service_crud(db_session):
    """Test DatasetService metadata CRUD operations on test database."""
    initial_count = DatasetService.count_datasets(db_session)
    assert initial_count == 0

    new_dataset_data = DatasetCreate(
        name="Test Sales Sample",
        description="Sample dataset for database connectivity testing",
        file_path="data/sample_sales_data.csv",
        file_size_bytes=2048,
        row_count=6,
        column_count=8,
        mime_type="text/csv",
    )

    created = DatasetService.create_dataset_metadata(db_session, new_dataset_data)
    assert created.id is not None
    assert created.name == "Test Sales Sample"

    datasets = DatasetService.list_datasets(db_session)
    assert len(datasets) == 1
    assert datasets[0].id == created.id

    fetched = DatasetService.get_dataset_by_id(db_session, created.id)
    assert fetched is not None
    assert fetched.name == "Test Sales Sample"
