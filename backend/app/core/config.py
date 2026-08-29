from typing import List, Union, Optional
from pathlib import Path
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "InsightFlow AI"
    VERSION: str = "0.1.0"
    ENVIRONMENT: str = "development"
    LOG_LEVEL: str = "INFO"
    DEBUG: bool = True

    HOST: str = "0.0.0.0"
    PORT: int = 8000

    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
    ]

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, (list, str)):
            return v
        raise ValueError(v)

    POSTGRES_SERVER: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_USER: str = "insightflow_user"
    POSTGRES_PASSWORD: str = "insightflow_password"
    POSTGRES_DB: str = "insightflow_db"
    
    DATABASE_URL: str = "postgresql+psycopg://insightflow_user:insightflow_password@localhost:5432/insightflow_db"

    # AI / LLM Provider Settings
    AI_PROVIDER: str = "none"
    AI_API_KEY: Optional[str] = None
    AI_MODEL: str = "gpt-4o"
    AI_TIMEOUT_SECONDS: float = 10.0

    # File Ingestion & Storage Settings
    MAX_UPLOAD_SIZE_BYTES: int = 52_428_800  # 50 MB default max upload size
    UPLOAD_DIR: str = "data/raw"
    PROCESSED_DIR: str = "data/processed"
    MODELS_DIR: str = "data/models"

    @property
    def upload_dir_path(self) -> Path:
        """Returns resolved Path object for raw file upload storage."""
        path = Path(self.UPLOAD_DIR)
        if not path.is_absolute():
            # Resolve relative to root directory
            path = Path(__file__).resolve().parents[3] / self.UPLOAD_DIR
        path.mkdir(parents=True, exist_ok=True)
        return path

    @property
    def processed_dir_path(self) -> Path:
        """Returns resolved Path object for processed file storage."""
        path = Path(self.PROCESSED_DIR)
        if not path.is_absolute():
            path = Path(__file__).resolve().parents[3] / self.PROCESSED_DIR
        path.mkdir(parents=True, exist_ok=True)
        return path

    @property
    def models_dir_path(self) -> Path:
        """Returns resolved Path object for trained ML model artifact storage."""
        path = Path(self.MODELS_DIR)
        if not path.is_absolute():
            path = Path(__file__).resolve().parents[3] / self.MODELS_DIR
        path.mkdir(parents=True, exist_ok=True)
        return path


    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )


settings = Settings()

