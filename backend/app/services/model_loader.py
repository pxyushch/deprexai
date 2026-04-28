from __future__ import annotations

import importlib
import json
import logging
import pickle
import zipfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Protocol

import numpy as np
import torch
from transformers import AutoModelForSequenceClassification, AutoTokenizer

from ..core.config import Settings
from ..core.constants import CANONICAL_LABELS, MODEL_ALIASES


logger = logging.getLogger(__name__)


class ModelAdapter(Protocol):
    alias: str
    display_name: str

    def predict_proba(self, texts: list[str]) -> np.ndarray: ...
    def describe(self) -> dict[str, Any]: ...


@dataclass
class ModelSpec:
    alias: str
    source: Path
    loader: str
    display_name: str
    tokenizer_source: Path | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


class ModelLoadError(RuntimeError):
    pass


def _safe_extract_zip(archive_path: Path, destination: Path) -> None:
    """Prevent zip-slip before extracting user-supplied archives."""
    destination.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(archive_path) as archive:
        for member in archive.infolist():
            member_path = (destination / member.filename).resolve()
            if not str(member_path).startswith(str(destination.resolve())):
                raise ModelLoadError(f"Unsafe path detected in archive: {member.filename}")
        archive.extractall(destination)


def _extract_if_needed(source: Path, settings: Settings) -> Path:
    if source.is_dir():
        return source

    if source.suffix.lower() != ".zip":
        return source

    target_root = settings.extracted_models_dir / source.stem
    if not target_root.exists():
        logger.info("Extracting %s into %s", source.name, target_root)
        _safe_extract_zip(source, target_root)

    nested_dirs = [item for item in target_root.iterdir() if item.is_dir()]
    if len(nested_dirs) == 1:
        return nested_dirs[0]
    return target_root


def _load_manifest(manifest_path: Path) -> dict[str, Any]:
    if not manifest_path.exists():
        return {}
    return json.loads(manifest_path.read_text(encoding="utf-8"))


def _discover_source(alias: str, models_dir: Path) -> Path | None:
    candidates = []
    aliases = MODEL_ALIASES.get(alias, [alias.lower()])
    for item in models_dir.iterdir():
        if item.name.startswith("."):
            continue
        normalized_name = item.stem.lower()
        if any(key in normalized_name for key in aliases):
            candidates.append(item)

    priority = {".zip": 0, "": 1, ".pkl": 2, ".pt": 3, ".pth": 4}
    candidates.sort(key=lambda item: priority.get(item.suffix.lower(), 10))
    return candidates[0] if candidates else None


def _detect_loader(source: Path, resolved_source: Path) -> str:
    if source.suffix.lower() == ".pkl":
        return "sklearn"
    if source.suffix.lower() in {".pt", ".pth"}:
        return "torchscript"
    if resolved_source.is_dir() and (resolved_source / "config.json").exists():
        return "huggingface"
    raise ModelLoadError(f"Unable to infer loader for {source}")


def _resolve_class_labels(config: Any) -> list[str]:
    id2label = getattr(config, "id2label", None) or {}
    if id2label:
        ordered = []
        for index in range(len(id2label)):
            ordered.append(id2label.get(index) or id2label.get(str(index)))
        if all(ordered):
            return ordered
    return CANONICAL_LABELS


class HuggingFaceTextClassifier:
    def __init__(self, spec: ModelSpec, settings: Settings) -> None:
        self.alias = spec.alias
        self.display_name = spec.display_name
        self.loader = spec.loader
        self.source = spec.source
        self.settings = settings
        self.device = torch.device(
            "cuda" if settings.prefer_gpu and torch.cuda.is_available() else "cpu"
        )
        model_dir = _extract_if_needed(spec.source, settings)
        self.resolved_source = model_dir
        tokenizer_dir = (
            _extract_if_needed(spec.tokenizer_source, settings)
            if spec.tokenizer_source
            else model_dir
        )
        self.tokenizer = AutoTokenizer.from_pretrained(
            tokenizer_dir, local_files_only=True, use_fast=True
        )
        self.model = AutoModelForSequenceClassification.from_pretrained(
            model_dir, local_files_only=True
        )
        self.model.to(self.device)
        self.model.eval()
        self.class_labels = _resolve_class_labels(self.model.config)
        self.index_by_label = {label: idx for idx, label in enumerate(self.class_labels)}
        logger.info(
            "Loaded %s from %s as %s on %s",
            spec.alias,
            model_dir,
            self.model.__class__.__name__,
            self.device,
        )

    def predict_proba(self, texts: list[str]) -> np.ndarray:
        encoded = self.tokenizer(
            texts,
            return_tensors="pt",
            truncation=True,
            padding=True,
            max_length=self.settings.max_length,
        )
        encoded = {key: value.to(self.device) for key, value in encoded.items()}
        with torch.inference_mode():
            logits = self.model(**encoded).logits
            probs = torch.softmax(logits, dim=-1).detach().cpu().numpy()

        reordered = np.zeros((len(texts), len(CANONICAL_LABELS)), dtype=np.float32)
        for target_index, label in enumerate(CANONICAL_LABELS):
            source_index = self.index_by_label.get(label, target_index)
            reordered[:, target_index] = probs[:, source_index]
        return reordered

    def describe(self) -> dict[str, Any]:
        return {
            "alias": self.alias,
            "display_name": self.display_name,
            "loader": self.loader,
            "source": self.source.name,
            "resolved_source": str(self.resolved_source),
            "model_type": self.model.__class__.__name__,
            "device": str(self.device),
            "class_labels": self.class_labels,
        }


class SklearnPipelineClassifier:
    def __init__(self, spec: ModelSpec, _: Settings) -> None:
        self.alias = spec.alias
        self.display_name = spec.display_name
        self.loader = spec.loader
        self.source = spec.source
        with spec.source.open("rb") as handle:
            self.pipeline = pickle.load(handle)

    def predict_proba(self, texts: list[str]) -> np.ndarray:
        probs = self.pipeline.predict_proba(texts)
        if probs.shape[1] != len(CANONICAL_LABELS):
            raise ModelLoadError(
                f"Sklearn model {self.alias} returned {probs.shape[1]} classes; expected 3."
            )
        return probs

    def describe(self) -> dict[str, Any]:
        return {
            "alias": self.alias,
            "display_name": self.display_name,
            "loader": self.loader,
            "source": self.source.name,
            "resolved_source": str(self.source.resolve()),
            "model_type": self.pipeline.__class__.__name__,
            "device": "cpu",
            "class_labels": CANONICAL_LABELS,
        }


class TorchScriptClassifier:
    def __init__(self, spec: ModelSpec, settings: Settings) -> None:
        self.alias = spec.alias
        self.display_name = spec.display_name
        self.loader = spec.loader
        self.source = spec.source
        self.settings = settings
        self.device = torch.device(
            "cuda" if settings.prefer_gpu and torch.cuda.is_available() else "cpu"
        )
        tokenizer_source = spec.tokenizer_source or spec.metadata.get("tokenizer_source")
        if not tokenizer_source:
            raise ModelLoadError(
                f"Torch model {spec.alias} needs tokenizer_source in models/manifest.json."
            )
        self.tokenizer = AutoTokenizer.from_pretrained(tokenizer_source, local_files_only=True)
        self.model = torch.jit.load(spec.source, map_location=self.device)
        self.model.eval()

    def predict_proba(self, texts: list[str]) -> np.ndarray:
        encoded = self.tokenizer(
            texts,
            return_tensors="pt",
            truncation=True,
            padding=True,
            max_length=self.settings.max_length,
        )
        encoded = {key: value.to(self.device) for key, value in encoded.items()}
        with torch.inference_mode():
            logits = self.model(**encoded)
            probs = torch.softmax(logits, dim=-1).detach().cpu().numpy()
        return probs

    def describe(self) -> dict[str, Any]:
        return {
            "alias": self.alias,
            "display_name": self.display_name,
            "loader": self.loader,
            "source": self.source.name,
            "resolved_source": str(self.source.resolve()),
            "model_type": self.model.__class__.__name__,
            "device": str(self.device),
            "class_labels": CANONICAL_LABELS,
        }


class ModelRegistry:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self._manifest = _load_manifest(settings.model_manifest_path)

    def load_all(self) -> list[ModelAdapter]:
        loaded_models: list[ModelAdapter] = []
        for alias in ("ESG", "ABV", "XDL"):
            model = self.load_one(alias)
            if model is not None:
                loaded_models.append(model)
        return loaded_models

    def load_one(self, alias: str) -> ModelAdapter | None:
        spec = self._resolve_spec(alias)
        if spec is None:
            logger.warning("Model %s not found under %s", alias, self.settings.models_dir)
            return None

        if spec.loader == "huggingface":
            return HuggingFaceTextClassifier(spec, self.settings)
        if spec.loader == "sklearn":
            return SklearnPipelineClassifier(spec, self.settings)
        if spec.loader == "torchscript":
            return TorchScriptClassifier(spec, self.settings)
        if spec.loader == "custom":
            return self._load_custom(spec)
        raise ModelLoadError(f"Unsupported loader type: {spec.loader}")

    def _resolve_spec(self, alias: str) -> ModelSpec | None:
        manifest_models = self._manifest.get("models", {})
        manifest_spec = manifest_models.get(alias, {})
        source = None
        if manifest_spec.get("source"):
            source = (self.settings.models_dir / manifest_spec["source"]).resolve()
        else:
            discovered = _discover_source(alias, self.settings.models_dir)
            if discovered is not None:
                source = discovered.resolve()
        if source is None or not source.exists():
            return None

        resolved_source = _extract_if_needed(source, self.settings)
        loader = manifest_spec.get("loader") or _detect_loader(source, resolved_source)
        tokenizer_source = manifest_spec.get("tokenizer_source")
        tokenizer_path = (
            (self.settings.models_dir / tokenizer_source).resolve() if tokenizer_source else None
        )
        display_name = manifest_spec.get("display_name", alias)
        metadata = manifest_spec.get("metadata", {})
        return ModelSpec(
            alias=alias,
            source=source,
            loader=loader,
            display_name=display_name,
            tokenizer_source=tokenizer_path,
            metadata=metadata,
        )

    def _load_custom(self, spec: ModelSpec) -> ModelAdapter:
        module_name = spec.metadata.get("module")
        callable_name = spec.metadata.get("callable")
        if not module_name or not callable_name:
            raise ModelLoadError(
                f"Custom loader for {spec.alias} must define metadata.module and metadata.callable."
            )
        module = importlib.import_module(module_name)
        factory = getattr(module, callable_name)
        return factory(spec=spec, settings=self.settings)
