import io
import pytest
from fastapi import UploadFile, HTTPException
from app.services.dataset_service import DatasetService
from app.services.cleaning_service import CleaningService
from app.services.eda_service import EDAService
from app.schemas.cleaning import CleaningPlan, CleaningOperation


def test_raw_dataset_without_processed_child_raises_400(db_session):
    """Raw dataset without a processed child MUST raise 400 Bad Request."""
    csv_content = """transaction_id,date,product,category,region,units_sold,unit_price,total_revenue
1001,2026-08-01,Laptop A,Electronics,Jaipur,2,55000,110000
1002,2026-08-02,Laptop B,Electronics,Delhi,1,65000,65000
"""
    dummy_file = UploadFile(
        filename="test_raw_only.csv",
        file=io.BytesIO(csv_content.encode("utf-8")),
    )

    profile = DatasetService.ingest_and_profile_csv(db_session, dummy_file)
    raw_dataset_id = profile.dataset_id

    # Generating EDA directly on uncleaned raw dataset must raise 400
    with pytest.raises(HTTPException) as exc_info:
        EDAService.generate_eda(db_session, raw_dataset_id)

    assert exc_info.value.status_code == 400
    assert "requires a processed dataset" in exc_info.value.detail


def test_raw_dataset_with_processed_child_selects_processed_data(db_session):
    """Raw dataset with processed child MUST automatically resolve to processed dataset for EDA."""
    dirty_csv_content = """transaction_id,date,product,category,region,units_sold,unit_price,total_revenue
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

    file_obj = UploadFile(
        filename="test_phase1_dirty.csv",
        file=io.BytesIO(dirty_csv_content.encode("utf-8")),
    )

    profile = DatasetService.ingest_and_profile_csv(db_session, file_obj)
    raw_dataset_id = profile.dataset_id
    raw_dataset = DatasetService.get_dataset_by_id(db_session, raw_dataset_id)
    raw_df = DatasetService.load_dataset_dataframe(raw_dataset)

    # Apply cleaning plan -> creates processed child dataset
    plan = CleaningPlan(
        dataset_id=raw_dataset_id,
        operations=[
            CleaningOperation(type="remove_duplicates"),
            CleaningOperation(type="fill_missing", column="region", strategy="mode"),
            CleaningOperation(type="fill_missing", column="unit_price", strategy="median"),
            CleaningOperation(type="fill_missing", column="units_sold", strategy="median"),
            CleaningOperation(type="fill_missing", column="total_revenue", strategy="median"),
        ]
    )
    apply_res = CleaningService.apply_cleaning(db_session, raw_dataset, raw_df, plan)
    processed_child_id = apply_res.output_dataset_id

    # Generate EDA passing raw_dataset_id
    eda = EDAService.generate_eda(db_session, raw_dataset_id)

    # 1. EDA result dataset_id MUST match processed_child_id (NOT raw_dataset_id)
    assert eda.dataset_id == processed_child_id
    assert eda.dataset_id != raw_dataset_id

    # 2. Overview metrics MUST come from processed dataset (18 rows, 0 missing, 0 duplicates)
    assert eda.overview_kpis.total_rows == 18
    assert eda.overview_kpis.total_missing_cells == 0
    assert eda.overview_kpis.duplicate_rows == 0

    # 3. KPI results MUST come from processed data (Total Units Sold = 71, Total Revenue = 1,011,900)
    kpis_map = {k.name: k.value for k in eda.discovered_kpis}
    assert kpis_map["Total Units Sold"] == 71
    assert kpis_map["Total Revenue"] == 1011900.0

    # 4. Fetch EDA passing raw_dataset_id also resolves to processed_child_id
    fetched_eda = EDAService.get_eda(db_session, raw_dataset_id)
    assert fetched_eda.dataset_id == processed_child_id
    assert fetched_eda.overview_kpis.total_rows == 18


def test_eda_directly_on_processed_dataset(db_session):
    """Directly passing a processed dataset ID generates EDA for that processed dataset."""
    dirty_csv_content = """transaction_id,date,product,category,region,units_sold,unit_price,total_revenue
1001,2026-08-01,Laptop A,Electronics,Jaipur,2,55000,110000
1002,2026-08-02,Laptop B,Electronics,Delhi,1,65000,65000
1003,2026-08-03,Monitor A,Electronics,Jaipur,3,15000,45000
"""
    file_obj = UploadFile(
        filename="test_direct_proc.csv",
        file=io.BytesIO(dirty_csv_content.encode("utf-8")),
    )
    profile = DatasetService.ingest_and_profile_csv(db_session, file_obj)
    raw_dataset = DatasetService.get_dataset_by_id(db_session, profile.dataset_id)
    raw_df = DatasetService.load_dataset_dataframe(raw_dataset)

    plan = CleaningPlan(dataset_id=profile.dataset_id, operations=[CleaningOperation(type="remove_duplicates")])
    apply_res = CleaningService.apply_cleaning(db_session, raw_dataset, raw_df, plan)
    proc_id = apply_res.output_dataset_id

    eda = EDAService.generate_eda(db_session, proc_id)
    assert eda.dataset_id == proc_id
    assert eda.overview_kpis.total_rows == 3
