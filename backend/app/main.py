from __future__ import annotations

from contextlib import asynccontextmanager
import logging
from time import perf_counter
from uuid import uuid4

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .api.routes import router
from .core.config import get_settings
from .core.logging import configure_logging
from .services.dataset_service import DatasetService
from .services.explainability import LimeExplainerService
from .services.model_loader import ModelRegistry
from .services.prediction_service import EnsemblePredictor


settings = get_settings()
configure_logging(settings.log_level)
logger = logging.getLogger(__name__)


def _make_json_safe(value):
    if isinstance(value, dict):
        return {key: _make_json_safe(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_make_json_safe(item) for item in value]
    if isinstance(value, tuple):
        return [_make_json_safe(item) for item in value]
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value
    return str(value)


@asynccontextmanager
async def lifespan(app: FastAPI):
    registry = ModelRegistry(settings)
    predictor = EnsemblePredictor(
        registry=registry,
        strict_model_count=settings.strict_model_count,
        cache_size=settings.prediction_cache_size,
    )
    predictor.warmup()
    app.state.predictor = predictor
    app.state.explainer_service = LimeExplainerService(
        predictor=predictor,
        feature_count=settings.lime_features,
        num_samples=settings.lime_num_samples,
    )
    app.state.dataset_service = DatasetService(settings=settings, predictor=predictor)
    yield


app = FastAPI(
    title=settings.app_name,
    description=(
        "DepreXAI – Explainable AI for Depression Severity Detection and Monitoring. "
        "Research use only; not a medical diagnosis system."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_request_context(request: Request, call_next):
    request_id = uuid4().hex[:12]
    request.state.request_id = request_id
    started = perf_counter()
    try:
        response = await call_next(request)
    except Exception:
        logger.exception(
            "Unhandled request error request_id=%s method=%s path=%s",
            request_id,
            request.method,
            request.url.path,
        )
        raise
    duration_ms = round((perf_counter() - started) * 1000, 2)
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Response-Time-Ms"] = str(duration_ms)
    logger.info(
        "request_id=%s method=%s path=%s status=%s duration_ms=%s",
        request_id,
        request.method,
        request.url.path,
        response.status_code,
        duration_ms,
    )
    return response


@app.exception_handler(RequestValidationError)
async def handle_validation_error(request: Request, exc: RequestValidationError):
    request_id = getattr(request.state, "request_id", "unknown")
    details = _make_json_safe(exc.errors())
    logger.warning("Validation error request_id=%s errors=%s", request_id, details)
    message = "Please check the request payload and try again."
    if details:
        first_error = details[0]
        if isinstance(first_error, dict) and first_error.get("msg"):
            message = str(first_error["msg"])
    return JSONResponse(
        status_code=422,
        content={
            "error": {
                "code": "validation_error",
                "message": message,
                "details": details,
                "request_id": request_id,
            }
        },
    )


@app.exception_handler(HTTPException)
async def handle_http_error(request: Request, exc: HTTPException):
    request_id = getattr(request.state, "request_id", "unknown")
    detail = exc.detail if isinstance(exc.detail, dict) else {"message": str(exc.detail)}
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": detail.get("code", "request_failed"),
                "message": detail.get("message", "The request could not be completed."),
                "details": detail.get("details"),
                "request_id": request_id,
            }
        },
    )


@app.exception_handler(Exception)
async def handle_unexpected_error(request: Request, exc: Exception):
    request_id = getattr(request.state, "request_id", "unknown")
    logger.exception("Unexpected application error request_id=%s", request_id)
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "code": "internal_server_error",
                "message": "Something went wrong on the server.",
                "request_id": request_id,
            }
        },
    )


app.include_router(router)
