from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    PROJECT_NAME: str = "Billing Assistant"
    VERSION: str = "0.1.0"

    DATABASE_URL: str = "sqlite:///./billing.db"

    CORS_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://frontend:3000",
    ]

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
