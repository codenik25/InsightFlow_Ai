from typing import Dict, Optional, List, Set


class MetricFamilyService:
    """Domain-agnostic metric family and role classification service.

    Supports automatic detection of known business metric families (demand, staffing,
    utilization, financial expense, financial revenue, quality, defects) using generic alias rules,
    with healthcare, retail, logistics, manufacturing, and SaaS column names fully supported.
    """

    FAMILY_ALIASES: Dict[str, Set[str]] = {
        "demand": {
            "patient_visits", "visits", "admissions", "transactions", "units_sold",
            "orders", "bookings", "volume", "trips", "passengers", "requests", "calls",
            "enrollments", "sales_volume", "clicks", "leads", "conversions"
        },
        "staffing": {
            "staff_count", "staff", "employees", "labor_hours", "headcount", "workforce",
            "drivers", "teachers", "technicians", "agents", "nurses", "doctors", "personnel"
        },
        "utilization": {
            "occupancy_rate", "occupancy", "utilization_rate", "utilization", "capacity_usage",
            "seat_factor", "load_factor", "machine_utilization", "bandwidth_utilization", "bed_occupancy"
        },
        "financial_expense": {
            "operating_cost", "cost", "expenses", "expense", "overhead", "labor_cost",
            "maintenance_cost", "cost_per_unit", "expenditure", "opex", "capex"
        },
        "financial_revenue": {
            "total_revenue", "revenue", "average_bill", "avg_bill", "unit_price", "price",
            "sales", "billing", "gross_income", "fare", "arpu", "mrr", "arr"
        },
        "financial_profit": {
            "profit", "margin", "net_income", "ebitda", "roi", "net_profit", "gross_margin"
        },
        "quality": {
            "patient_satisfaction", "satisfaction", "rating", "nps", "csat", "quality_score",
            "review_score", "customer_satisfaction"
        },
        "quality_defect": {
            "readmission_rate", "readmission", "defect_rate", "churn_rate", "error_rate",
            "return_rate", "incident_count", "downtime", "rejection_rate"
        }
    }

    @classmethod
    def detect_family(cls, col_name: str) -> Optional[str]:
        """Detect the metric family for a given column name using normalized exact & substring matching."""
        if not col_name:
            return None
        
        clean = col_name.lower().strip().replace("-", "_")

        # 1. Exact match check
        for family, aliases in cls.FAMILY_ALIASES.items():
            if clean in aliases:
                return family

        # 2. Substring match check
        for family, aliases in cls.FAMILY_ALIASES.items():
            for alias in aliases:
                if alias in clean or clean in alias:
                    return family

        return None

    @classmethod
    def get_related_metrics(cls, cols: List[str]) -> Dict[str, List[str]]:
        """Group a list of column names by their detected metric family."""
        family_map: Dict[str, List[str]] = {}
        for c in cols:
            fam = cls.detect_family(c)
            if fam:
                family_map.setdefault(fam, []).append(c)
        return family_map
