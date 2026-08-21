import io
import pytest
from fastapi import UploadFile, HTTPException
from app.services.storage_service import sanitize_filename, LocalStorageProvider
from app.services.dataset_service import DatasetService


def test_sanitize_filename():
    assert sanitize_filename("../../../etc/passwd.csv") == "passwd.csv"
    assert sanitize_filename("my report (2026)#1!.csv") == "my_report__2026__1_.csv"


def test_local_storage_save_and_delete(tmp_path):
    storage = LocalStorageProvider(target_dir=tmp_path)
    content = b"header1,header2\nval1,val2\n"
    key, sanitized_name, size = storage.save_file(content, "test_file.csv")

    assert "data/raw/" in key
    assert sanitized_name == "test_file.csv"
    assert size == len(content)

    retrieved = storage.get_file_bytes(key)
    assert retrieved == content

    deleted = storage.delete_file(key)
    assert deleted is True


def test_ingest_invalid_file_extension(db_session):
    dummy_file = UploadFile(filename="script.exe", file=io.BytesIO(b"binary content"))
    with pytest.raises(HTTPException) as exc_info:
        DatasetService.ingest_and_profile_csv(db_session, dummy_file)
    assert exc_info.value.status_code == 400
    assert "Only CSV files" in exc_info.value.detail


def test_ingest_empty_file(db_session):
    empty_file = UploadFile(filename="empty.csv", file=io.BytesIO(b""))
    with pytest.raises(HTTPException) as exc_info:
        DatasetService.ingest_and_profile_csv(db_session, empty_file)
    assert exc_info.value.status_code == 400
    assert "empty" in exc_info.value.detail.lower()
