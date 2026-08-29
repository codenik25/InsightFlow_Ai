import hashlib
import io
import pytest
import pandas as pd
from fastapi import UploadFile
from app.services.dataset_service import DatasetService
from app.services.cleaning_service import CleaningService
from app.services.insight_service import InsightService
from app.schemas.cleaning import CleaningPlan, CleaningOperation
from app.services.metric_family_service import MetricFamilyService


def test_raw_csv_sha256_immutability():
    """Verify data/test_phase1_dirty.csv hash remains exactly 9463762eb564db829aba0c48fb27d636ca40a17ccb82d9d5cc5be3d43f81d198."""
    filepath = "data/test_phase1_dirty.csv"
    with open(filepath, "rb") as f:
        content = f.read()
    digest = hashlib.sha256(content).hexdigest()
    assert digest == "9463762eb564db829aba0c48fb27d636ca40a17ccb82d9d5cc5be3d43f81d198"


def test_metric_family_detector_domain_agnostic():
    """Verify metric family detector accurately classifies healthcare, retail, and logistics column names."""
    # Healthcare
    assert MetricFamilyService.detect_family("patient_visits") == "demand"
    assert MetricFamilyService.detect_family("staff_count") == "staffing"
    assert MetricFamilyService.detect_family("occupancy_rate") == "utilization"
    assert MetricFamilyService.detect_family("operating_cost") == "financial_expense"
    assert MetricFamilyService.detect_family("patient_satisfaction") == "quality"
    assert MetricFamilyService.detect_family("readmission_rate") == "quality_defect"

    # Retail / E-commerce
    assert MetricFamilyService.detect_family("units_sold") == "demand"
    assert MetricFamilyService.detect_family("total_revenue") == "financial_revenue"
    assert MetricFamilyService.detect_family("unit_price") == "financial_revenue"

    # Logistics / Transport
    assert MetricFamilyService.detect_family("trips") == "demand"
    assert MetricFamilyService.detect_family("drivers") == "staffing"
    assert MetricFamilyService.detect_family("fuel_cost") == "financial_expense"


def test_hospital_dataset_grouping_and_opportunities(db_session):
    """Verifies that hospital dataset produces grouped business pattern for Apex Medical Center and evidence-backed opportunities."""
    hospital_csv = """date,hospital,city,state,department,patient_visits,staff_count,occupancy_rate,average_bill,operating_cost,patient_satisfaction,readmission_rate,total_revenue
2024-01-01,CityCare Hospital,Jaipur,Rajasthan,Cardiology,600,20,0.916,5813.13,2082094.01,76.35,0.0829,3487875.55
2024-01-01,CityCare Hospital,Jaipur,Rajasthan,Orthopedics,465,18,0.839,4795.16,1665216.75,84.01,0.0856,2229749.99
2024-01-01,CityCare Hospital,Jaipur,Rajasthan,General Medicine,661,25,0.884,2465.95,1188222.03,80.66,0.0752,1629993.20
2024-01-01,Metro Health Center,Delhi,Delhi,Cardiology,753,29,0.939,6157.61,3248303.81,78.66,0.0907,4636681.49
2024-01-01,Metro Health Center,Delhi,Delhi,Orthopedics,503,20,0.837,4866.86,1720597.18,84.52,0.0800,2448031.82
2024-01-01,Apex Medical Center,Lucknow,Uttar Pradesh,Cardiology,499,21,0.810,5706.58,1805854.76,87.94,0.0751,2847584.37
2024-01-01,Apex Medical Center,Lucknow,Uttar Pradesh,Orthopedics,440,14,0.787,4755.50,1422711.66,86.44,0.0528,2092421.04
2024-01-01,Apex Medical Center,Lucknow,Uttar Pradesh,General Medicine,487,16,0.886,2635.60,960015.50,80.54,0.0602,1283538.96
2024-01-01,Apex Medical Center,Lucknow,Uttar Pradesh,Pediatrics,279,12,0.679,2241.66,452448.01,80.63,0.0630,625423.10
2024-01-01,Apex Medical Center,Lucknow,Uttar Pradesh,Neurology,215,8,0.709,5228.46,783901.84,81.61,0.0474,1124119.25
"""
    file_obj = UploadFile(
        filename="hospital_test.csv",
        file=io.BytesIO(hospital_csv.encode("utf-8")),
    )
    profile = DatasetService.ingest_and_profile_csv(db_session, file_obj)
    raw_dataset = DatasetService.get_dataset_by_id(db_session, profile.dataset_id)
    raw_df = DatasetService.load_dataset_dataframe(raw_dataset)

    plan = CleaningPlan(dataset_id=profile.dataset_id, operations=[CleaningOperation(type="remove_duplicates")])
    apply_res = CleaningService.apply_cleaning(db_session, raw_dataset, raw_df, plan)

    res = InsightService.generate_insights(db_session, apply_res.output_dataset_id)

    # 1. Grouped Finding for Apex Medical Center
    apex_grouped = [i for i in res.insights if i.is_grouped and i.affected_entity == "Apex Medical Center"]
    assert len(apex_grouped) > 0, "Apex Medical Center should produce at least one grouped business finding"
    grp = apex_grouped[0]
    assert "Apex Medical Center" in grp.title
    assert grp.group_id is not None
    assert len(grp.supporting_insight_ids) >= 3
    assert grp.confidence_label in ["HIGH", "MEDIUM"]
    assert grp.business_impact in ["HIGH", "MEDIUM"]

    # 2. Opportunity Detection
    opportunities = [i for i in res.insights if i.category == "OPPORTUNITY"]
    assert len(opportunities) > 0, "Hospital dataset with high volume/utilization should generate at least 1 opportunity"
    opp = opportunities[0]
    assert opp.category == "OPPORTUNITY"
    assert opp.recommendation is not None
    assert "causes" not in opp.recommendation.lower()
    assert "will cause" not in opp.recommendation.lower()


def test_non_healthcare_domain_agnostic_dataset(db_session):
    """Verifies that non-healthcare dataset (logistics / fleet management) works seamlessly."""
    logistics_csv = """date,fleet_region,depot,drivers,fuel_cost,maintenance_cost,deliveries,utilization_rate,total_revenue
2026-08-01,North,Depot A,45,120000,45000,1200,0.92,450000
2026-08-01,North,Depot B,30,85000,30000,850,0.85,310000
2026-08-01,South,Depot C,15,40000,15000,300,0.60,110000
2026-08-01,South,Depot D,12,35000,12000,250,0.55,90000
2026-08-01,South,Depot E,10,28000,10000,180,0.50,70000
"""
    file_obj = UploadFile(
        filename="logistics_test.csv",
        file=io.BytesIO(logistics_csv.encode("utf-8")),
    )
    profile = DatasetService.ingest_and_profile_csv(db_session, file_obj)
    raw_dataset = DatasetService.get_dataset_by_id(db_session, profile.dataset_id)
    raw_df = DatasetService.load_dataset_dataframe(raw_dataset)

    plan = CleaningPlan(dataset_id=profile.dataset_id, operations=[CleaningOperation(type="remove_duplicates")])
    apply_res = CleaningService.apply_cleaning(db_session, raw_dataset, raw_df, plan)

    res = InsightService.generate_insights(db_session, apply_res.output_dataset_id)
    assert res.summary.total > 0
    categories = {i.category for i in res.insights}
    assert len(categories) > 0

    # Ensure no hospital specific terms hardcoded in title/observation unless in raw data
    for i in res.insights:
        combined = f"{i.title} {i.observation}".lower()
        assert "hospital" not in combined
        assert "patient" not in combined


def test_non_causal_language_strictness(db_session):
    """Verifies that prohibited causal terms are strictly absent from titles, observations, and recommendations."""
    csv_content = """id,category,sales,cost
1,A,1000,200
2,B,2000,400
3,C,3000,600
"""
    file_obj = UploadFile(
        filename="test_causal_safety.csv",
        file=io.BytesIO(csv_content.encode("utf-8")),
    )
    profile = DatasetService.ingest_and_profile_csv(db_session, file_obj)
    raw_dataset = DatasetService.get_dataset_by_id(db_session, profile.dataset_id)
    raw_df = DatasetService.load_dataset_dataframe(raw_dataset)

    plan = CleaningPlan(dataset_id=profile.dataset_id, operations=[CleaningOperation(type="remove_duplicates")])
    apply_res = CleaningService.apply_cleaning(db_session, raw_dataset, raw_df, plan)

    res = InsightService.generate_insights(db_session, apply_res.output_dataset_id)

    prohibited = ["causes", "caused by", "will cause", "causal", "guarantees", "proves that", "leads to", "results in"]

    for i in res.insights:
        combined = f"{i.title} {i.observation} {i.recommendation or ''}".lower()
        for p in prohibited:
            assert p not in combined, f"Prohibited causal phrase '{p}' found in insight: {combined}"


def test_edge_cases_safety(db_session):
    """Verifies engine safety against missing values, constant columns, and small datasets."""
    edge_csv = """date,category,val_const,val_missing,val_num
2026-08-01,A,100,,10
2026-08-02,A,100,20,20
2026-08-03,B,100,,30
"""
    file_obj = UploadFile(
        filename="test_edge_cases.csv",
        file=io.BytesIO(edge_csv.encode("utf-8")),
    )
    profile = DatasetService.ingest_and_profile_csv(db_session, file_obj)
    raw_dataset = DatasetService.get_dataset_by_id(db_session, profile.dataset_id)
    raw_df = DatasetService.load_dataset_dataframe(raw_dataset)

    plan = CleaningPlan(dataset_id=profile.dataset_id, operations=[CleaningOperation(type="remove_duplicates")])
    apply_res = CleaningService.apply_cleaning(db_session, raw_dataset, raw_df, plan)

    # Should run cleanly without throwing NaN/ZeroDivision error
    res = InsightService.generate_insights(db_session, apply_res.output_dataset_id)
    assert res.summary.total >= 0
