from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "mysql+pymysql://root:rootpass@localhost:3306/tradeswift_erp?charset=utf8mb4"
    app_name: str = "Tradeswift ERP API"
    debug: bool = True

    # Cloudflare R2 Storage
    cloudflare_account_id: str | None = None
    cloudflare_r2_access_key_id: str | None = None
    cloudflare_r2_secret_access_key: str | None = None
    cloudflare_r2_bucket_name: str | None = None
    cloudflare_r2_endpoint_url: str | None = None


settings = Settings()

