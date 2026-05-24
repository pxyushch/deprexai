
import numpy as np

class EnsembleVoter:
    def __init__(self, weights=[0.4, 0.35, 0.25]):
        self.weights = np.array(weights)

    def vote(self, prob_matrix):
        weighted_probs = np.average(prob_matrix, axis=0, weights=self.weights)
        return int(np.argmax(weighted_probs))
