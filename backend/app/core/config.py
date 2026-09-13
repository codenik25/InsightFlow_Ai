from typing import List, Optional
from pathlib import Path
import json

from pydantic import field_validator, ValidationInfo
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):

    # ============================================================
    # Application Settings
    # ============================================================

    PROJECT_NAME: str = "InsightFlow AI"
    VERSION: str = "0.1.0"

    ENVIRONMENT: str = "development"
    LOG_LEVEL: str = "INFO"
    DEBUG: bool = True

    HOST: str = "0.0.0.0"
    PORT: int = 8000


    # ============================================================
    # CORS Settings
    # ============================================================

    # Keep this as STRING so Render environment variables
    # do not cause Pydantic parsing errors.
    BACKEND_CORS_ORIGINS: str = (
        "http://localhost:5173,"
        "http://127.0.0.1:5173,"
        "http://localhost:3000"
    )


    @property
    def cors_origins(self) -> List[str]:
        """
        Converts BACKEND_CORS_ORIGINS into a list.

        Supports:

        Comma separated:
        http://localhost:5173,https://example.com

        JSON list:
        ["http://localhost:5173","https://example.com"]
        """

        value = self.BACKEND_CORS_ORIGINS

        if not value:
            return []

        value = value.strip()

        # JSON list format
        if value.startswith("["):

            try:
                origins = json.loads(value)

                if isinstance(origins, list):
                    return [
                        str(origin).strip()
                        for origin in origins
                        if str(origin).strip()
                    ]

            except json.JSONDecodeError:
                return []

        # Comma-separated format
        return [
            origin.strip()
            for origin in value.split(",")
            if origin.strip()
        ]


    # ============================================================
    # PostgreSQL Settings
    # ============================================================

    POSTGRES_SERVER: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_USER: str = "insightflow_user"
    POSTGRES_PASSWORD: str = "insightflow_password"
    POSTGRES_DB: str = "insightflow_db"


    DATABASE_URL: str = (
        "postgresql+psycopg://"
        "insightflow_user:insightflow_password"
        "@localhost:5432/insightflow_db"
    )


    # ============================================================
    # AI / LLM Settings
    # ============================================================

    AI_PROVIDER: str = "none"

    AI_API_KEY: Optional[str] = None

    AI_MODEL: str = "gpt-4o"

    AI_TIMEOUT_SECONDS: float = 10.0


    # ============================================================
    # Storage Settings
    # ============================================================

    STORAGE_BACKEND: str = "local"


    @field_validator("STORAGE_BACKEND")
    @classmethod
    def validate_storage_backend(cls, v: str) -> str:

        value = v.lower().strip()

        if value not in ["local", "supabase"]:

            raise ValueError(
                "STORAGE_BACKEND must be either "
                "'local' or 'supabase'"
            )

        return value


    # ============================================================
    # Supabase Settings
    # ============================================================

    SUPABASE_URL: Optional[str] = None

    SUPABASE_SERVICE_KEY: Optional[str] = None


    @field_validator("SUPABASE_SERVICE_KEY")
    @classmethod
    def validate_supabase_credentials(
        cls,
        v: Optional[str],
        info: ValidationInfo
    ) -> Optional[str]:

        storage_backend = info.data.get(
            "STORAGE_BACKEND",
            "local"
        )

        if storage_backend == "supabase":

            supabase_url = info.data.get(
                "SUPABASE_URL"
            )

            if not supabase_url:

                raise ValueError(
                    "SUPABASE_URL is required when "
                    "STORAGE_BACKEND is 'supabase'"
                )

            if not v:

                raise ValueError(
                    "SUPABASE_SERVICE_KEY is required when "
                    "STORAGE_BACKEND is 'supabase'"
                )

        return v


    # ============================================================
    # File Upload Settings
    # ============================================================

    MAX_UPLOAD_SIZE_BYTES: int = 52_428_800

    UPLOAD_DIR: str = "data/raw"

    PROCESSED_DIR: str = "data/processed"

    MODELS_DIR: str = "data/models"


    # ============================================================
    # Storage Paths
    # ============================================================

    @property
    def upload_dir_path(self) -> Path:

        path = Path(self.UPLOAD_DIR)

        if not path.is_absolute():

            path = (
                Path(__file__).resolve().parents[3]
                / self.UPLOAD_DIR
            )

        path.mkdir(
            parents=True,
            exist_ok=True
        )

        return path


    @property
    def processed_dir_path(self) -> Path:

        path = Path(self.PROCESSED_DIR)

        if not path.is_absolute():

            path = (
                Path(__file__).resolve().parents[3]
                / self.PROCESSED_DIR
            )

        path.mkdir(
            parents=True,
            exist_ok=True
        )

        return path


    @property
    def models_dir_path(self) -> Path:

        path = Path(self.MODELS_DIR)

        if not path.is_absolute():

            path = (
                Path(__file__).resolve().parents[3]
                / self.MODELS_DIR
            )

        path.mkdir(
            parents=True,
            exist_ok=True
        )

        return path


    # ============================================================
    # Pydantic Configuration
    # ============================================================

    model_config = SettingsConfigDict(

        env_file=".env",

        env_file_encoding="utf-8",

        case_sensitive=True,

        extra="ignore"

    )


# ================================================================
# Global Settings
# ================================================================

settings = Settings()