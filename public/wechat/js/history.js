// Historical simulation summaries for Xiaoyuan. Live snapshots and the simulation clock stay separate.
(function (global) {
  let datasets = [], generatedAt = null;
  global.SolarHistory = Object.freeze({ get datasets() { return datasets; }, get generatedAt() { return generatedAt; } });
  async function refresh() {
    try {
      const result = await WorkspaceClient.request('history', { signal: AbortSignal.timeout(10000) });
      datasets = result.datasets || []; generatedAt = result.generatedAt;
      window.dispatchEvent(new Event('solar-history-ready'));
    } catch { /* Keep the last known history, never substitute invented values. */ }
  }
  void refresh(); setInterval(refresh, 60000);
})(globalThis);
