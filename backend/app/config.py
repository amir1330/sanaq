from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "CoffeeOS"
    debug: bool = False
    secret_key: str = "change-me-in-production"
    access_token_expire_minutes: int = 60
    refresh_token_expire_days: int = 14
    database_url: str = (
        "postgresql+asyncpg://coffee:coffee@localhost:5432/coffeeos"
    )
    cors_origins: str = "http://localhost:5173,http://localhost:8080,http://localhost"
    upload_dir: str = "uploads"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
