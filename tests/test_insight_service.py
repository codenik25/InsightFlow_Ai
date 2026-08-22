import io
import pytest
from fastapi import UploadFile, HTTPException
from app.services.dataset_service import DatasetService
from app.services.cleaning_service import CleaningService
from app.services.insight_service import InsightService
from app.schemas.cleaning import CleaningPlan, CleaningOperation


def test_insight_generation_end_to_end(db_session):
    """Verifies end-to-end insight discovery, evidence generation, and priority sorting."""
    dirty_csv_content = """transaction_id,date,product,category,region,units_sold,unit_price,total_revenue
1001,2026-08-01,Laptop A,Electronics,Delhi,2,55000,110000
1002,2026-08-02,Laptop B,Electronics,Delhi,1,65000,65000
1003,2026-08-03,Monitor A,Electronics,Delhi,3,15000,45000
1004,2026-08-04,Keyboard A,Accessories,Mumbai,5,2500,12500
1005,2026-08-05,Mouse A,Accessories,Delhi,10,1200,12000
1006,2026-08-06,Laptop A,Electronics,Delhi,1,55000,55000
1007,2026-08-07,Laptop C,Electronics,Mumbai,2,72000,144000
1008,2026-08-08,Monitor B,Electronics,Delhi,4,18000,72000
1009,2026-08-09,Keyboard B,Accessories,Delhi,6,3000,18000
1010,2026-08-10,Mouse B,Accessories,Mumbai,8,1500,12000
1011,2026-08-11,Laptop B,Electronics,Delhi,2,65000,130000
1012,2026-08-12,Monitor A,Electronics,Delhi,2,15000,30000
1013,2026-08-13,Laptop C,Electronics,Mumbai,1,72000,72000
1014,2026-08-14,Keyboard A,Accessories,Mumbai,4,2500,10000
1015,2026-08-15,Mouse A,Accessories,Delhi,12,1200,14400
1015,2026-08-15,Mouse A,Accessories,Delhi,12,1200,14400
1016,2026-08-16,Laptop D,Electronics,Delhi,,58000,
1017,2026-08-17,Laptop E,Electronics,,2,60000,120000
1018,2026-08-18,Monitor C,Electronics,Delhi,3,,45000
"""
    file_obj = UploadFile(
        filename="test_phase1_dirty.csv",
        file=io.BytesIO(dirty_csv_content.encode("utf-8")),
    )

    profile = DatasetService.ingest_and_profile_csv(db_session, file_obj)
    raw_id = profile.dataset_id
    raw_dataset = DatasetService.get_dataset_by_id(db_session, raw_id)
    raw_df = DatasetService.load_dataset_dataframe(raw_dataset)

    # 1. Direct insight generation on raw dataset MUST raise 400 Bad Request
    with pytest.raises(HTTPException) as exc_info:
        InsightService.generate_insights(db_session, raw_id)
    assert exc_info.value.status_code == 400
    assert "requires a processed dataset" in exc_info.value.detail

    # 2. Apply cleaning to create processed child dataset
    plan = CleaningPlan(
        dataset_id=raw_id,
        operations=[
            CleaningOperation(type="remove_duplicates"),
            CleaningOperation(type="fill_missing", column="region", strategy="mode"),
            CleaningOperation(type="fill_missing", column="unit_price", strategy="median"),
            CleaningOperation(type="fill_missing", column="units_sold", strategy="median"),
            CleaningOperation(type="fill_missing", column="total_revenue", strategy="median"),
        ]
    )
    apply_res = CleaningService.apply_cleaning(db_session, raw_dataset, raw_df, plan)
    proc_id = apply_res.output_dataset_id

    # 3. Generate insights for raw_id -> automatically resolves to proc_id
    insights_res = InsightService.generate_insights(db_session, raw_id)
    assert insights_res.dataset_id == proc_id
    assert len(insights_res.insights) > 0

    # 4. Verify priority sorting (descending order)
    scores = [i.priority_score for i in insights_res.insights]
    assert scores == sorted(scores, reverse=True)

    # 5. Verify presence of categories
    categories = {i.category for i in insights_res.insights}
    assert "DATA_QUALITY" in categories
    assert "PERFORMANCE" in categories
    assert "CORRELATION" in categories

    # 6. Verify evidence structure
    quality_insight = next(i for i in insights_res.insights if i.category == "DATA_QUALITY")
    assert quality_insight.evidence.sample_size == 18
    assert quality_insight.evidence.quality_score_after == 100.0

    # 7. Verify GET method returns persisted insights
    fetched_res = InsightService.get_insights(db_session, raw_id)
    assert fetched_res.dataset_id == proc_id
    assert len(fetched_res.insights) == len(insights_res.insights)

    # 8. Verify summary count exhaustion: sum of severity counts == total_insights
    summary = fetched_res.summary
    severity_sum = summary.critical_count + summary.warning_count + summary.positive_count + summary.info_count
    assert severity_sum == summary.total
    assert len(fetched_res.insights) == summary.total

    # Verify category counts sum to total insights
    category_counts = {}
    for i in fetched_res.insights:
        category_counts[i.category] = category_counts.get(i.category, 0) + 1
    assert sum(category_counts.values()) == summary.total


def test_non_additive_metric_rules_unit_price(db_session):
    """Verifies that unit_price does not generate concentration insights or contribution_percent."""
    csv_content = """transaction_id,date,product,category,region,units_sold,unit_price,total_revenue
1001,2026-08-01,Laptop A,Electronics,Delhi,2,55000,110000
1002,2026-08-02,Laptop B,Electronics,Delhi,1,65000,65000
1003,2026-08-03,Monitor A,Electronics,Delhi,3,15000,45000
1004,2026-08-04,Keyboard A,Accessories,Mumbai,5,2500,12500
1005,2026-08-05,Mouse A,Accessories,Delhi,10,1200,12000
"""
    file_obj = UploadFile(
        filename="test_non_additive.csv",
        file=io.BytesIO(csv_content.encode("utf-8")),
    )
    profile = DatasetService.ingest_and_profile_csv(db_session, file_obj)
    raw_dataset = DatasetService.get_dataset_by_id(db_session, profile.dataset_id)
    raw_df = DatasetService.load_dataset_dataframe(raw_dataset)

    plan = CleaningPlan(dataset_id=profile.dataset_id, operations=[CleaningOperation(type="remove_duplicates")])
    apply_res = CleaningService.apply_cleaning(db_session, raw_dataset, raw_df, plan)

    res = InsightService.generate_insights(db_session, apply_res.output_dataset_id)

    # 1. Check unit_price insights
    unit_price_insights = [i for i in res.insights if i.source_column == "unit_price"]

    # Must NOT contain concentration insight for unit_price
    for i in unit_price_insights:
        assert "concentration" not in i.title.lower()
        assert "concentration" not in i.observation.lower()

    # Performance insights for unit_price MUST NOT have contribution_percent or total_value
    for i in unit_price_insights:
        if i.category == "PERFORMANCE":
            assert i.evidence.contribution_percent is None
            assert i.evidence.total_value is None
            # Check for average comparison phrasing
            assert "highest average" in i.title.lower() or "lowest average" in i.title.lower()
            assert "contributing" not in i.observation.lower()

    # 2. Check total_revenue and units_sold (additive metrics)
    revenue_insights = [i for i in res.insights if i.source_column == "total_revenue" and i.category == "PERFORMANCE"]
    assert len(revenue_insights) > 0
    top_rev = revenue_insights[0]
    assert top_rev.evidence.contribution_percent is not None
    assert top_rev.evidence.total_value is not None


def test_wording_and_label_refinements(db_session):
    """Verifies presentation refinements: absolute difference comparison, clean metric labels, and natural dimension pluralization."""
    csv_content = """transaction_id,date,product,category,region,units_sold,unit_price,total_revenue
1001,2026-08-01,Laptop A,Electronics,Delhi,2,55000,110000
1002,2026-08-02,Laptop B,Electronics,Delhi,1,65000,65000
1003,2026-08-03,Monitor A,Electronics,Delhi,3,15000,45000
1004,2026-08-04,Keyboard A,Accessories,Mumbai,5,2500,12500
1005,2026-08-05,Mouse A,Accessories,Delhi,10,1200,12000
"""
    file_obj = UploadFile(
        filename="test_wording_refinement.csv",
        file=io.BytesIO(csv_content.encode("utf-8")),
    )
    profile = DatasetService.ingest_and_profile_csv(db_session, file_obj)
    raw_dataset = DatasetService.get_dataset_by_id(db_session, profile.dataset_id)
    raw_df = DatasetService.load_dataset_dataframe(raw_dataset)

    plan = CleaningPlan(dataset_id=profile.dataset_id, operations=[CleaningOperation(type="remove_duplicates")])
    apply_res = CleaningService.apply_cleaning(db_session, raw_dataset, raw_df, plan)

    res = InsightService.generate_insights(db_session, apply_res.output_dataset_id)

    # A. Check metric labels
    assert InsightService.format_metric_label("total_revenue") == "Total Revenue"
    assert InsightService.format_metric_label("units_sold") == "Units Sold"
    assert InsightService.format_metric_label("unit_price") == "Unit Price"

    # B. Check dimension pluralization
    assert InsightService.format_dimension_plural("category") == "categories"
    assert InsightService.format_dimension_plural("product") == "products"
    assert InsightService.format_dimension_plural("region") == "regions"

    # C. Check generated text constraints across all insights
    for i in res.insights:
        combined_text = f"{i.title} {i.observation} {i.recommendation or ''}"
        assert "Total Total Revenue" not in combined_text
        assert "Category categories" not in combined_text
        assert "Product products" not in combined_text
        assert "Region regions" not in combined_text

    # D. Check price/rate top performer wording uses absolute difference and no % higher
    unit_price_top = next(
        i for i in res.insights if i.source_column == "unit_price" and i.category == "PERFORMANCE" and "highest" in i.title.lower()
    )
    assert "% higher" not in unit_price_top.observation
    assert "higher than" in unit_price_top.observation
    assert unit_price_top.evidence.comparison_diff is not None
    assert unit_price_top.evidence.contribution_percent is None
    assert unit_price_top.evidence.total_value is None

    # E. Check total_revenue top performer wording
    rev_top = next(
        i for i in res.insights if i.source_column == "total_revenue" and i.category == "PERFORMANCE" and "highest" in i.title.lower()
    )
    assert "Total Revenue" in rev_top.title
    assert "contributing" in rev_top.observation
    assert rev_top.evidence.contribution_percent is not None
    assert rev_top.evidence.total_value is not None
