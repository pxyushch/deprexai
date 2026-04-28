from __future__ import annotations

from pydantic import BaseModel


class DatasetLoadResponse(BaseModel):
    status: str
    source: str
    path: str
    rows: int
    columns: list[str]
    cached: bool


class ProcessDataResponse(BaseModel):
    status: str
    output_path: str
    stats_path: str
    rows_processed: int
    regions: dict[str, int]
    limit: int | None
    cached: bool
    generated_at: str
    processing_profile: str


class RegionStats(BaseModel):
    mild: int
    moderate: int
    severe: int
    zone: str
    total: int
    severe_share: float
    average_confidence: float


class DashboardSummary(BaseModel):
    total_posts: int
    average_confidence: float
    highest_alert_region: str | None
    highest_alert_zone: str | None
    severe_share: float


class DashboardMeta(BaseModel):
    status: str
    cached: bool
    generated_at: str | None
    limit: int | None
    source_path: str | None
    processed_path: str | None
    stats_path: str | None
    processing_profile: str


class StatsResponse(BaseModel):
    regions: dict[str, RegionStats]
    summary: DashboardSummary
    meta: DashboardMeta
