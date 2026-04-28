export type SeverityKey = "mild" | "moderate" | "severe";

export interface ExplanationToken {
  token: string;
  weight: number;
  normalized_weight: number;
  magnitude: number;
  direction: "supports" | "opposes";
  rank: number;
}

export interface ExplanationResponse {
  tokens: ExplanationToken[];
  supporting: ExplanationToken[];
  opposing: ExplanationToken[];
  max_abs_weight: number;
}

export interface CalibrationMeta {
  applied: boolean;
  strategy: string | null;
  reason: string | null;
  raw_prediction: "Mild" | "Moderate" | "Severe";
  raw_confidence: number;
}

export interface PredictionMeta {
  cleaned_text: string;
  input_characters: number;
  cleaned_characters: number;
  input_words: number;
  cleaned_words: number;
  inference_ms: number;
  explanation_ms: number;
  total_ms: number;
  cached: boolean;
  models_used: string[];
  calibration: CalibrationMeta;
}

export interface ModelArtifact {
  alias: string;
  display_name: string;
  loader: string;
  source: string;
  resolved_source: string;
  model_type: string;
  device: string;
  class_labels: string[];
}

export interface PredictionResponse {
  prediction: "Mild" | "Moderate" | "Severe";
  confidence: number;
  probabilities: Record<SeverityKey, number>;
  explanation: ExplanationResponse;
  meta: PredictionMeta;
}

export interface RegionStats {
  mild: number;
  moderate: number;
  severe: number;
  zone: "Green" | "Yellow" | "Orange" | "Red";
  total: number;
  severe_share: number;
  average_confidence: number;
}

export interface DashboardSummary {
  total_posts: number;
  average_confidence: number;
  highest_alert_region: string | null;
  highest_alert_zone: "Green" | "Yellow" | "Orange" | "Red" | null;
  severe_share: number;
}

export interface DashboardMeta {
  status: "ready" | "empty";
  cached: boolean;
  generated_at: string | null;
  limit: number | null;
  source_path: string | null;
  processed_path: string | null;
  stats_path: string | null;
  processing_profile: string;
}

export interface DatasetLoadResponse {
  status: string;
  source: string;
  path: string;
  rows: number;
  columns: string[];
  cached: boolean;
}

export interface ProcessDataResponse {
  status: string;
  output_path: string;
  stats_path: string;
  rows_processed: number;
  regions: Record<string, number>;
  limit: number | null;
  cached: boolean;
  generated_at: string;
  processing_profile: string;
}

export interface StatsResponse {
  regions: Record<string, RegionStats>;
  summary: DashboardSummary;
  meta: DashboardMeta;
}

export interface HealthResponse {
  status: string;
  loaded_models: string[];
  artifacts: ModelArtifact[];
}
