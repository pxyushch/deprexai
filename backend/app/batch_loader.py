
def parallel_batch_tokenize(texts, tokenizer, max_workers=4):
    return tokenizer(texts, padding=True, truncation=True, return_tensors='pt')
