
function renderAttentionHeatmap(tokens, weights) {
  const container = document.getElementById('heatmap-container');
  if (!container) return;
  container.innerHTML = tokens.map((t, i) => `<span style="background: rgba(239,68,68,${Math.abs(weights[i])})">${t}</span>`).join(' ');
}
