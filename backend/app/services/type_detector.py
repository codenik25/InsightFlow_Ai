import re
from typing import Literal, Any
import pandas as pd
import numpy as np

InferredType = Literal['numeric', 'categorical', 'datetime', 'boolean', 'identifier', 'text']


class TypeDetector:
    """Deterministic, modular column data type classifier."""

    IDENTIFIER_KEYWORDS = {
        'id', 'uuid', 'guid', 'key', 'code', 'txn', 'sku', 'ssn', 
        'num', 'number', 'index', 'record', 'hash', 'account', 'ref', 'reference'
    }

    BOOLEAN_VALUES = {
        'true', 'false', 't', 'f', 'yes', 'no', 'y', 'n', '0', '1', '0.0', '1.0'
    }

    FREE_TEXT_KEYWORDS = {
        'notes', 'note', 'comment', 'comments', 'remark', 'remarks', 
        'description', 'descriptions', 'narrative', 'summary', 'text', 
        'reason', 'feedback', 'details', 'log', 'message'
    }

    NULL_LIKE_STRINGS = {
        'unknown', 'n/a', 'na', 'null', 'none', 'missing', 'blank', 
        'n.a.', 'nan', '', '-', 'undefined', 'null-like'
    }

    @classmethod
    def is_null_like(cls, val: Any) -> bool:
        """Check if a value represents a null-like or missing placeholder."""
        if val is None or pd.isna(val):
            return True
        val_str = str(val).strip().lower()
        return val_str in cls.NULL_LIKE_STRINGS

    @classmethod
    def clean_categorical_series(cls, series: pd.Series) -> pd.Series:
        """Trim whitespace and replace null-like strings with np.nan for clean dimensional analysis."""
        if series is None or len(series) == 0:
            return pd.Series(dtype=object)

        s_str = series.dropna().astype(str).str.strip()
        mask_null_like = s_str.str.lower().isin(cls.NULL_LIKE_STRINGS)
        s_clean = s_str.copy()
        s_clean[mask_null_like] = np.nan
        return s_clean.dropna()

    @classmethod
    def is_identifier_candidate_name(cls, col_name: str) -> bool:
        """Check if column name matches identifier candidate patterns."""
        col_name_lower = str(col_name).strip().lower()
        if col_name_lower == 'id' or col_name_lower.endswith('_id') or col_name_lower.endswith('-id') or col_name_lower.startswith('id_'):
            return True
        tokens = re.split(r'[_.\s-]', col_name_lower)
        return any(kw in tokens for kw in cls.IDENTIFIER_KEYWORDS)

    @classmethod
    def detect_column_type(cls, series: pd.Series, col_name: str) -> InferredType:
        """Classify Pandas Series into an explicit data type category."""
        clean_series = series.dropna()
        total_count = len(series)
        non_null_count = len(clean_series)

        if non_null_count == 0:
            return 'categorical'  # fallback for completely empty column

        col_name_lower = str(col_name).strip().lower()
        col_tokens = set(re.split(r'[_.\s-]', col_name_lower))

        # Clean string representation of sample values
        str_samples = clean_series.astype(str).str.strip().str.lower()
        unique_vals = set(str_samples.unique())
        unique_count = len(unique_vals)
        uniqueness_ratio = unique_count / non_null_count if non_null_count > 0 else 0.0
        avg_str_len = float(clean_series.astype(str).str.len().mean()) if non_null_count > 0 else 0.0

        # 0. Free-text explicit keyword or long narrative check
        if any(kw in col_tokens for kw in cls.FREE_TEXT_KEYWORDS):
            return 'text'

        if avg_str_len >= 30 and unique_count > 10 and not pd.api.types.is_numeric_dtype(series.dtype):
            return 'text'

        # 1. Identifier Check (by name pattern or high uniqueness)
        is_id_name = cls.is_identifier_candidate_name(col_name)
        if is_id_name and uniqueness_ratio >= 0.8 and non_null_count >= 1:
            return 'identifier'

        # 2. Boolean Check
        if pd.api.types.is_bool_dtype(series.dtype) or (unique_count <= 2 and unique_vals.issubset(cls.BOOLEAN_VALUES)):
            return 'boolean'

        # 3. Datetime Check
        if pd.api.types.is_datetime64_any_dtype(series.dtype):
            return 'datetime'

        # Attempt to detect datetime strings if series is object/string
        if pd.api.types.is_object_dtype(series.dtype) or pd.api.types.is_string_dtype(series.dtype):
            if any(kw in col_name_lower for kw in ['date', 'time', 'timestamp', 'created', 'updated', 'dt']):
                dt_coerced = pd.to_datetime(clean_series, errors='coerce')
                valid_dt_count = int(dt_coerced.notna().sum())
                if non_null_count > 0 and (valid_dt_count / non_null_count) >= 0.5:
                    return 'datetime'

        # 4. Numeric Check
        if pd.api.types.is_numeric_dtype(series.dtype):
            if is_id_name and uniqueness_ratio >= 0.8:
                return 'identifier'
            return 'numeric'

        # Try coercing object/string column to numeric (cleaning currency and commas)
        cleaned_num_s = clean_series.astype(str).str.strip().str.replace(r'[$,€£]', '', regex=True).str.replace(',', '', regex=False)
        numeric_coerced = pd.to_numeric(cleaned_num_s, errors='coerce')
        valid_num_count = int(numeric_coerced.notna().sum())
        if non_null_count > 0 and (valid_num_count / non_null_count) >= 0.5:
            if is_id_name and uniqueness_ratio >= 0.8:
                return 'identifier'
            return 'numeric'

        # 5. Categorical vs Text Check
        cardinality_ratio = unique_count / non_null_count if non_null_count > 0 else 0.0
        if unique_count <= 50 or cardinality_ratio <= 0.3:
            return 'categorical'

        return 'text'
