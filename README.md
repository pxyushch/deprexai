# DepreXAI

DepreXAI is a full-stack research platform for depression severity detection and monitoring. It combines a FastAPI backend, a React + Vite frontend, ensemble model inference, LIME explanations, and a region-wise dashboard for demo and presentation use.

This tool is for research purposes only and not a medical diagnosis system.

## Stack

- Backend: FastAPI, Transformers, PyTorch, scikit-learn, LIME, pandas
- Frontend: React, Vite, Tailwind CSS, Framer Motion, shadcn-style UI primitives, Recharts
- Deployment: Docker, Docker Compose, Render/Railway-ready structure

## Project Structure

```text
backend/
frontend/
models/
data/
```

## Included Local Assets

The following provided files have already been staged into the project:

- `models/albert_finetuned-20260420T083839Z-3-001.zip`
- `models/electra_finetuned-20260420T083839Z-3-001.zip`
- `models/xtremedistil_finetuned-20260420T083843Z-3-001.zip`
- `data/source/depression_dataset.csv`

The backend loads real model files from `/models` and does not mock predictions when compatible artifacts are present.

## Backend Setup

From the repository root:

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r backend/requirements.txt
uvicorn backend.app.main:app --reload
```

API endpoints:

- `POST /predict`
- `GET /load-dataset`
- `GET /process-data`
- `GET /stats`
- `GET /health`

## Frontend Setup

```powershell
cd frontend
copy .env.example .env
npm install
npm run dev
```

By default the frontend expects the API at `http://localhost:8000`.
For slower hosted inference, you can raise `VITE_PREDICT_TIMEOUT_MS` (default example: `240000`).

## Model Notes

- The loader supports extracted HuggingFace directories and zip archives directly.
- If you later use `.pkl`, `.pt`, or differently named assets, create `models/manifest.json` from `models/manifest.example.json`.
- The supplied `xtremedistil` archive appears to contain an ALBERT-style config internally. The loader uses the actual config safely, but you should verify the artifact lineage if you plan to cite that checkpoint as XtremeDistil in a paper or demo.

## Dataset Flow

1. `GET /load-dataset` tries Kaggle first when `KAGGLE_USERNAME`, `KAGGLE_KEY`, and `KAGGLE_DATASET_SLUG` are configured.
2. If Kaggle is unavailable, it falls back to a public GitHub-hosted depression-related dataset URL.
3. `GET /process-data` runs predictions on the dataset, assigns deterministic simulated regions, and stores `data/processed/regional_predictions.csv`.
4. `GET /stats` returns region-wise counts and zone classifications.

Zone logic is based on the severe-class share within each region:

- Severe > 50% → Red
- Severe 30–50% → Orange
- Moderate dominant → Yellow
- Mostly mild → Green

## Docker

Run both services:

```powershell
copy .env.example .env
docker compose up --build
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:8000`

## Public Deployment (No Install Needed for Users)

This repository includes [`render.yaml`](./render.yaml) for a two-service deploy on Render:

1. `deprexai-api` (Docker web service, FastAPI backend)
2. `deprexai-web` (static site, React frontend)

After deployment, anyone can open the frontend URL in a browser and use the project without installing anything locally.

### Deploy Steps

1. Push this repository to GitHub (or GitLab/Bitbucket).
2. In Render, click `New` -> `Blueprint`.
3. Connect the repository and select your branch.
4. Render auto-detects `render.yaml` and creates both services.
5. Wait for deploy completion, then open the `deprexai-web` URL and share it.

Optional direct launch URL format:
`https://render.com/deploy?repo=<YOUR_PUBLIC_REPO_URL>`

### Important Notes

- Backend port is cloud-compatible: it now binds to `${PORT}` automatically in Docker.
- `ALLOWED_ORIGINS` supports:
  - `*`
  - Comma-separated URLs
  - JSON list format such as `["https://site1.com","https://site2.com"]`
- If backend memory is not enough for model loading on your chosen plan, increase the backend service plan and redeploy.

## Non-breaking improvement path

- Keep preprocessing and tokenization aligned with the training notebook
- Add optional confidence calibration later if needed
- Add weighted ensemble fusion only if benchmarked and documented
- Increase batch size for offline dataset processing when GPU memory allows
