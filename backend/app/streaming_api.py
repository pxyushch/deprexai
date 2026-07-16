
async def stream_inference(text_chunks):
    for chunk in text_chunks:
        yield {"chunk_processed": len(chunk), "partial_severity": "EVALUATING"}
