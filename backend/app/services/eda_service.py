import uuid
from datetime import datetime, timezone
from typing import Optional
import pandas as pd
from sqlalchemy import select
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.dataset import Dataset
from app.models.eda_result import EDAAnalysis
from app.schemas.eda import EDAResponse
from app.services.dataset_service import DatasetService
from app.services.metric_discovery_service import MetricDiscoveryService
from app.services.kpi_service import KPIService
from app.services.trend_service import TrendService
from app.services.relationship_service import RelationshipService


class EDAService:
    """Orchestrator for automated Exploratory Data Analysis & KPI discovery on processed datasets."""

    @classmethod
    def resolve_target_dataset(cls, db: Session, dataset_id: str) -> Dataset:
        """
        Resolves the appropriate processed dataset for EDA:
        1. If dataset_id is already a processed dataset (is_processed=True), returns it.
        2. If dataset_id is raw (is_processed=False), checks for a processed child dataset.
        3. If a processed child dataset exists, returns it.
        4. If no processed child dataset exists, raises 400 Bad Request.
        """
        dataset = DatasetService.get_dataset_by_id(db=db, dataset_id=dataset_id)
        if not dataset:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Dataset with ID '{dataset_id}' not found.",
            )

        if dataset.is_processed:
            return dataset

        # Query for child processed dataset
        stmt = (
            select(Dataset)
            .where(Dataset.parent_id == dataset_id, Dataset.is_processed == True)
            .order_by(Dataset.created_at.desc())
        )
        child_processed = db.scalars(stmt).first()
        if child_processed:
            return child_processed

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Automated EDA requires a processed dataset. Dataset '{dataset_id}' has not been cleaned/processed yet. Please apply a cleaning plan first.",
        )

    @classmethod
    def generate_eda(cls, db: Session, dataset_id: str) -> EDAResponse:
        target_dataset = cls.resolve_target_dataset(db=db, dataset_id=dataset_id)
        df = DatasetService.load_dataset_dataframe(target_dataset)

        # 1. Discover Column Roles
        roles = MetricDiscoveryService.discover_column_roles(df)

        # 2. Dataset Overview KPIs
        overview_kpis = KPIService.compute_dataset_overview_kpis(df, roles)

        # 3. Discovered Measure KPIs
        discovered_kpis = KPIService.discover_measure_kpis(df, roles)

        # 4. Category Breakdowns & Top/Bottom Analysis
        category_breakdowns = KPIService.discover_category_breakdowns(df, roles)

        # 5. Time-Series Trends
        trends = TrendService.evaluate_trends(df, roles)

        # 6. Bivariate Relationships (Pearson Correlation)
        relationships = RelationshipService.evaluate_relationships(df, roles)

        # 7. Distribution Statistics
        distributions = RelationshipService.evaluate_distributions(df, roles)

        eda_id = str(uuid.uuid4())
        created_at_str = datetime.now(timezone.utc).isoformat()

        response = EDAResponse(
            id=eda_id,
            dataset_id=target_dataset.id,
            created_at=created_at_str,
            column_roles=roles,
            overview_kpis=overview_kpis,
            discovered_kpis=discovered_kpis,
            category_breakdowns=category_breakdowns,
            trends=trends,
            relationships=relationships,
            distributions=distributions,
        )

        # Persist / update in database under target_dataset.id
        analysis_record = EDAAnalysis(
            id=eda_id,
            dataset_id=target_dataset.id,
            analysis_version="1.0",
            result_data=response.model_dump(),
            status="completed",
        )
        db.add(analysis_record)
        db.commit()

        return response

    @classmethod
    def get_eda(cls, db: Session, dataset_id: str) -> EDAResponse:
        """Fetch latest stored EDA result or generate on-the-fly for the resolved processed dataset."""
        target_dataset = cls.resolve_target_dataset(db=db, dataset_id=dataset_id)

        stmt = (
            select(EDAAnalysis)
            .where(EDAAnalysis.dataset_id == target_dataset.id)
            .order_by(EDAAnalysis.created_at.desc())
        )
        existing = db.scalars(stmt).first()
        if existing and existing.result_data:
            return EDAResponse(**existing.result_data)

        # Fallback to generate
        return cls.generate_eda(db=db, dataset_id=target_dataset.id)
