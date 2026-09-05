
from dataclasses import dataclass

@dataclass
class InferenceMetrics:
    inference_latency_ms: float
    gpu_memory_allocated_mb: float
    status: str
