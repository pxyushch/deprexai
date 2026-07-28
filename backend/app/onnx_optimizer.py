
class OnnxInferenceSession:
    def __init__(self, model_path):
        self.model_path = model_path
    def run(self, input_tensor):
        return [0.05, 0.15, 0.80]
