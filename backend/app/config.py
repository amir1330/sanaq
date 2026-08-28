from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Sanaq"
    debug: bool = False
    secret_key: str = "change-me-in-production"
    access_token_expire_minutes: int = 60
    refresh_token_expire_days: int = 14
    database_url: str = (
        "postgresql+asyncpg://coffee:coffee@localhost:5432/coffeeos"
    )
    cors_origins: str = "http://localhost:5173"
    upload_dir: str = "uploads"
    seed_demo: bool = False
    admin_email: str = "admin@coffeeos.local"
    admin_password: str = ""
    webkassa_url: str = "https://kkm.webkassa.kz"
    webkassa_api_key: str = ""
    webkassa_operation_sale: int = 2
    webkassa_operation_refund: int = 3
    webkassa_payment_cash: int = 0
    webkassa_payment_card: int = 1
    webkassa_unit_code: int = 0
    webkassa_token_ttl_seconds: int = 20 * 60
    webkassa_retry_seconds: int = 120
    webkassa_max_attempts: int = 5

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
