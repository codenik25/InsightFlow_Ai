import hashlib
import tempfile
from pathlib import Path
import pandas as pd
import pytest
from fastapi import HTTPException
from app.schemas.cleaning import CleaningPlan, CleaningOperation
from app.services.cleaning_service import CleaningService


def get_dirty_df() -> pd.DataFrame:
    data = {
        "transaction_id": list(range(1001, 1016)) + [1015] + list(range(1017, 1019)) + [1015],
        "region": ["Jaipur", "Delhi", "Jaipur", "Mumbai", "Delhi", "Jaipur", "Mumbai", "Delhi", "Jaipur", "Mumbai", "Delhi", "Jaipur", "Mumbai", "Mumbai", "Delhi", "Delhi", "Jaipur", None, "Delhi"],
        "units_sold": [2, 1, 3, 5, 10, 1, 2, 4, 6, 8, 2, 2, 1, 4, 12, 12, 2, None, 3],
        "unit_price": [55000, 65000, 15000, 2500, 1200, 55000, 72000, 18000, 3000, 1500, 65000, 15000, 72000, 2500, 1200, 1200, 58000, 60000, None],
        "total_revenue": [110000, 65000, 45000, 12500, 12000, 55000, 144000, 72000, 18000, 12000, 130000, 30000, 72000, 10000, 14400, 14400, None, 120000, 45000],
    }
    return pd.DataFrame(data)


def test_cleaning_plan_validation_rejects_incompatible():
    df = get_dirty_df()

    # Reject mean strategy on non-numeric column
    plan_invalid_mean = CleaningPlan(
        dataset_id="ds1",
        operations=[CleaningOperation(type="fill_missing", column="region", strategy="mean")]
    )
    with pytest.raises(HTTPException) as exc_info:
        CleaningService.validate_plan(df, plan_invalid_mean)
    assert "incompatible" in str(exc_info.value.detail).lower()

    # Reject non-existent column
    plan_missing_col = CleaningPlan(
        dataset_id="ds1",
        operations=[CleaningOperation(type="fill_missing", column="unknown_col", strategy="mode")]
    )
    with pytest.raises(HTTPException) as exc_info:
        CleaningService.validate_plan(df, plan_missing_col)
    assert "non-existent" in str(exc_info.value.detail).lower()

    # Reject case conversion on numeric column
    plan_invalid_case = CleaningPlan(
        dataset_id="ds1",
        operations=[CleaningOperation(type="convert_case", column="unit_price", strategy="lowercase")]
    )
    with pytest.raises(HTTPException) as exc_info:
        CleaningService.validate_plan(df, plan_invalid_case)
    assert "incompatible" in str(exc_info.value.detail).lower()


def test_cleaning_preview_does_not_modify_raw_dataframe():
    df = get_dirty_df()
    df_copy = df.copy()

    plan = CleaningPlan(
        dataset_id="ds1",
        operations=[
            CleaningOperation(type="remove_duplicates"),
            CleaningOperation(type="fill_missing", column="region", strategy="mode"),
            CleaningOperation(type="fill_missing", column="unit_price", strategy="median"),
        ]
    )

    preview = CleaningService.preview_cleaning(df, "ds1", plan)

    assert preview.before.total_rows == 19
    assert preview.expected_after.total_rows == 18
    assert preview.expected_after.total_missing_cells < preview.before.total_missing_cells

    # Verify original dataframe is unmodified
    assert len(df) == 19
    assert df.equals(df_copy)


def test_raw_file_sha256_immutability():
    """Verify raw CSV file hash remains strictly unchanged before & after preview & apply operations."""
    df = get_dirty_df()
    
    with tempfile.NamedTemporaryFile(mode="w+", suffix=".csv", delete=False) as tmp:
        df.to_csv(tmp.name, index=False)
        tmp_path = Path(tmp.name)

    try:
        # Calculate SHA256 before
        hash_before = hashlib.sha256(tmp_path.read_bytes()).hexdigest()

        # Run preview
        plan = CleaningPlan(
            dataset_id="test-ds",
            operations=[
                CleaningOperation(type="remove_duplicates"),
                CleaningOperation(type="fill_missing", column="region", strategy="mode"),
            ]
        )
        CleaningService.preview_cleaning(df, "test-ds", plan)

        # Calculate SHA256 after preview
        hash_after_preview = hashlib.sha256(tmp_path.read_bytes()).hexdigest()
        assert hash_before == hash_after_preview

        # Apply operations on copy
        CleaningService.apply_operations(df, plan.operations)

        # Calculate SHA256 after apply
        hash_after_apply = hashlib.sha256(tmp_path.read_bytes()).hexdigest()
        assert hash_before == hash_after_apply

    finally:
        if tmp_path.exists():
            tmp_path.unlink()
