# Models Directory

Place your trained model assets in this folder.

Supported out of the box:

- Extracted HuggingFace folders containing `config.json`, `tokenizer.json`, and `model.safetensors`
- HuggingFace zip archives with the same files inside
- `pickle` / `joblib` style sklearn pipelines that expose `predict_proba`
- TorchScript `.pt` or `.pth` files when a tokenizer path is provided in `manifest.json`

Expected aliases:

- `ESG` → Electra family
- `ABV` → ALBERT family
- `XDL` → XtremeDistil family

Auto-discovery uses filenames, so these work directly:

- `electra_finetuned-....zip`
- `albert_finetuned-....zip`
- `xtremedistil_finetuned-....zip`

If your filenames differ or the format is custom, create `models/manifest.json` using the example file.

## Note About The Provided Artifacts

The supplied `xtremedistil` archive appears to expose an ALBERT-style config inside the zip even though its filename suggests XtremeDistil. The loader uses the actual model config at runtime, so it will still load safely, but you may want to verify that artifact lineage before presenting benchmark claims.
