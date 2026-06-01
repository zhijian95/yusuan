from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    APP_NAME: str = "预算算不算"
    APP_VERSION: str = "1.1.2"
    DEBUG: bool = True

    DATABASE_URL: str = "sqlite:///./budget.db"

    SECRET_KEY: str = "change-me-to-a-secure-random-string-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480

    ENCRYPTION_KEY: str = "change-me-32-bytes-key-for-aes!!"

    SUPER_ADMIN_USERNAME: str = "admin"
    SUPER_ADMIN_PASSWORD: str = "admin123"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
