import type {
  DatasetLoadResponse,
  HealthResponse,
  PredictionResponse,
  ProcessDataResponse,
  StatsResponse,
} from "@/types/api";

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
const DEFAULT_TIMEOUT_MS = 25000;
const LONG_TIMEOUT_MS = 480000;

type ApiErrorPayload = {
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
    request_id?: string;
  };
};

async function request<T>(
  path: string,
  init?: RequestInit,
  options?: { timeoutMs?: number },
): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(
    () => controller.abort(),
    options?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );

  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    signal: controller.signal,
    ...init,
  }).catch((error) => {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("The request took too long to finish. Please try again.");
    }
    throw error;
  }).finally(() => {
    window.clearTimeout(timeout);
  });

  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as ApiErrorPayload | null;
    const requestId = data?.error?.request_id ? ` (request ${data.error.request_id})` : "";
    throw new Error(
      `${data?.error?.message ?? `Request failed with status ${response.status}`}${requestId}`,
    );
  }

  return (await response.json()) as T;
}

export const api = {
  health: () => request<HealthResponse>("/health"),
  predict: (text: string) =>
    request<PredictionResponse>("/predict", {
      method: "POST",
      body: JSON.stringify({ text }),
    }, { timeoutMs: DEFAULT_TIMEOUT_MS }),
  loadDataset: () => request<DatasetLoadResponse>("/load-dataset"),
  processData: (limit?: number) =>
    request<ProcessDataResponse>(
      limit ? `/process-data?limit=${limit}` : "/process-data",
      undefined,
      { timeoutMs: LONG_TIMEOUT_MS },
    ),
  stats: () => request<StatsResponse>("/stats", undefined, { timeoutMs: DEFAULT_TIMEOUT_MS }),
};

export { API_BASE_URL };
