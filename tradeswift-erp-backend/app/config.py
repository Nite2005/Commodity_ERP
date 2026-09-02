from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "mysql+pymysql://root:rootpass@localhost:3306/tradeswift_erp?charset=utf8mb4"
    app_name: str = "Tradeswift ERP API"
    debug: bool = True


settings = Settings()
