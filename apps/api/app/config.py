from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    api_env: str = "development"
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    skip_startup_validation: bool = False
    sentry_dsn: str = ""
    sentry_traces_sample_rate: float = 0.0
    create_room_rate_limit: int = 10
    join_rate_limit: int = 30
    send_message_rate_limit: int = 60
    rate_limit_window_seconds: int = 60
    supabase_url: str = ""
    supabase_service_role_key: str = ""
    web_app_url: str = "http://localhost:3000"
    session_secret: str = ""
    metrics_secret: str = ""
    upstash_redis_rest_url: str = ""
    upstash_redis_rest_token: str = ""
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"

    model_config = SettingsConfigDict(env_file=".env", env_prefix="", extra="ignore")

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
