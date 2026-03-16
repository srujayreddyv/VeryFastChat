import logging

import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration

from app.config import settings

logger = logging.getLogger(__name__)


def init_sentry() -> None:
    if not settings.sentry_dsn:
        logger.info("Sentry disabled for API")
        return

    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        environment=settings.api_env,
        integrations=[FastApiIntegration(transaction_style="endpoint")],
        traces_sample_rate=settings.sentry_traces_sample_rate,
        send_default_pii=False,
    )
    logger.info("Sentry enabled for API")
