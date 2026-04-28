from __future__ import annotations

import logging
from time import perf_counter

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

from ..schemas.dataset import DatasetLoadResponse, ProcessDataResponse, StatsResponse
from ..schemas.prediction import HealthResponse, PredictRequest, PredictResponse
from ..services.dataset_service import DatasetService
from ..services.explainability import LimeExplainerService
from ..services.model_loader import ModelLoadError
from ..services.prediction_service import EnsemblePredictor


router = APIRouter()
logger = logging.getLogger(__name__)


def get_predictor(request: Request) -> EnsemblePredictor:
    return request.app.state.predictor


def get_dataset_service(request: Request) -> DatasetService:
    return request.app.state.dataset_service


def get_explainer(request: Request) -> LimeExplainerService:
    return request.app.state.explainer_service


@router.get("/health", response_model=HealthResponse)
def health(predictor: EnsemblePredictor = Depends(get_predictor)) -> HealthResponse:
    try:
        predictor.warmup()
    except ModelLoadError:
        pass
    return HealthResponse(
        status="ok",
        loaded_models=predictor.model_names,
        artifacts=predictor.model_descriptions,
    )


@router.post("/predict", response_model=PredictResponse)
def predict(
    payload: PredictRequest,
    predictor: EnsemblePredictor = Depends(get_predictor),
    explainer: LimeExplainerService = Depends(get_explainer),
) -> PredictResponse:
    total_started = perf_counter()
    try:
        inference_started = perf_counter()
        result = predictor.predict(payload.text)
        inference_ms = (perf_counter() - inference_started) * 1000
        explanation_started = perf_counter()
        explanation = explainer.explain(payload.text, result.prediction)
        explanation_ms = (perf_counter() - explanation_started) * 1000
    except ModelLoadError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "model_unavailable",
                "message": str(error),
            },
        ) from error
    except Exception as error:
        logger.exception("Prediction failed.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "code": "prediction_failed",
                "message": "The prediction request could not be completed.",
            },
        ) from error

    return PredictResponse(
        prediction=result.prediction,
        confidence=result.confidence,
        probabilities=result.probabilities,
        explanation=explanation,
        meta={
            "cleaned_text": result.cleaned_text,
            "input_characters": len(payload.text),
            "cleaned_characters": len(result.cleaned_text),
            "input_words": len(payload.text.split()),
            "cleaned_words": len(result.cleaned_text.split()) if result.cleaned_text else 0,
            "inference_ms": round(inference_ms, 2),
            "explanation_ms": round(explanation_ms, 2),
            "total_ms": round((perf_counter() - total_started) * 1000, 2),
            "cached": result.cached,
            "models_used": predictor.model_names,
            "calibration": {
                "applied": result.calibration.applied,
                "strategy": result.calibration.strategy,
                "reason": result.calibration.reason,
                "raw_prediction": result.calibration.raw_prediction,
                "raw_confidence": round(result.calibration.raw_confidence, 4),
            },
        },
    )


@router.get("/load-dataset", response_model=DatasetLoadResponse)
def load_dataset(dataset_service: DatasetService = Depends(get_dataset_service)) -> DatasetLoadResponse:
    try:
        result = dataset_service.load_dataset()
        return DatasetLoadResponse(**result)
    except Exception as error:
        logger.exception("Dataset load failed.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "code": "dataset_load_failed",
                "message": "The dataset could not be loaded.",
            },
        ) from error


@router.get("/process-data", response_model=ProcessDataResponse)
def process_data(
    limit: int | None = Query(default=None, ge=1, le=50000),
    dataset_service: DatasetService = Depends(get_dataset_service),
) -> ProcessDataResponse:
    try:
        result = dataset_service.process_dataset(limit=limit)
        return ProcessDataResponse(**result)
    except ModelLoadError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "model_unavailable",
                "message": str(error),
            },
        ) from error
    except Exception as error:
        logger.exception("Dataset processing failed.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "code": "dataset_processing_failed",
                "message": "The dataset could not be processed.",
            },
        ) from error


@router.get("/stats", response_model=StatsResponse)
def stats(dataset_service: DatasetService = Depends(get_dataset_service)) -> StatsResponse:
    try:
        return StatsResponse(**dataset_service.stats())
    except ModelLoadError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "model_unavailable",
                "message": str(error),
            },
        ) from error
    except Exception as error:
        logger.exception("Stats retrieval failed.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "code": "stats_failed",
                "message": "The dashboard statistics could not be loaded.",
            },
        ) from error
