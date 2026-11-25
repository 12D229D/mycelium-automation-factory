/**
 * statsPanel.js - Panel de estadísticas, análisis de cuellos de botella y producción/minuto
 */

export class StatsPanel {
  constructor(containerId, recipeManager) {
    this.container = document.getElementById(containerId);
    this.recipeManager = recipeManager;
    this.productionLog = []; // array de { timestamp, item, count }
    this.ratesPerMinute = {}; // item -> qty/min
    this.bottlenecks = [];
  }

  logProduction(itemId, count = 1) {
    const now = Date.now();
    this.productionLog.push({ timestamp: now, item: itemId, count });
    // Mantener solo los últimos 60 segundos
    const cutoff = now - 60000;
    while (this.productionLog.length > 0 && this.productionLog[0].timestamp < cutoff) {
      this.productionLog.shift();
    }
  }

  updateMetrics(structures) {
    const now = Date.now();
    const cutoff = now - 60000;
    this.productionLog = this.productionLog.filter(log => log.timestamp >= cutoff);

    // Calcular tasas por minuto
    const rates = {};
    for (const log of this.productionLog) {
      rates[log.item] = (rates[log.item] || 0) + log.count;
    }
    this.ratesPerMinute = rates;

    // Detectar cuellos de botella en estructuras
    const issues = [];
    let blockedCount = 0;
    let starvingCount = 0;

    for (const st of structures) {
      if (st.type === 'reactor' || st.type === 'purifier') {
        if (st.status === 'blocked') blockedCount++;
        else if (st.status === 'waiting_inputs') starvingCount++;
      }
    }

    if (blockedCount > 0) {
      issues.push(`⚠️ ${blockedCount} procesadores con salida saturada (cuello de botella)`);
    }
    if (starvingCount > 0) {
      issues.push(`ℹ️ ${starvingCount} procesadores en espera de nutrientes`);
    }

    this.bottlenecks = issues;
    this.render();
  }

  render() {
    if (!this.container) return;

    let html = `
      <div class="stats-header">
        <span class="stats-title">Flujo Micelial</span>
        <span class="stats-badge">Tiempo Real</span>
      </div>
      <div class="stats-rates">
    `;

    const keys = Object.keys(this.ratesPerMinute);
    if (keys.length === 0) {
      html += `<div class="stat-empty">Construye extractores e hifas para generar biomasa</div>`;
    } else {
      for (const item of keys) {
        const info = this.recipeManager.getResourceInfo(item);
        const rate = this.ratesPerMinute[item] || 0;
        html += `
          <div class="stat-row">
            <span class="stat-dot" style="background: ${info.color}"></span>
            <span class="stat-name">${info.name}</span>
            <span class="stat-val">${rate}/min</span>
          </div>
        `;
      }
    }

    html += `</div>`;

    if (this.bottlenecks.length > 0) {
      html += `<div class="stats-bottlenecks">`;
      for (const b of this.bottlenecks) {
        html += `<div class="bottleneck-item">${b}</div>`;
      }
      html += `</div>`;
    }

    this.container.innerHTML = html;
  }
}
