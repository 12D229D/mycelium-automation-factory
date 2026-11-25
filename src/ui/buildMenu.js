/**
 * buildMenu.js - Barra de herramientas diegética, selector de edificios e inventario
 */

export class BuildMenu {
  constructor(containerId, onSelectTool, onRotate, onOpenTech) {
    this.container = document.getElementById(containerId);
    this.onSelectTool = onSelectTool;
    this.onRotate = onRotate;
    this.onOpenTech = onOpenTech;
    this.activeTool = 'extractor';
    this.currentDirection = 'E'; // 'N', 'E', 'S', 'W'
    this.unlockedStructures = new Set(['extractor', 'hypha', 'reactor', 'storage']);
    this.init();
  }

  unlockStructure(type) {
    this.unlockedStructures.add(type);
    this.render();
  }

  setDirection(dir) {
    this.currentDirection = dir;
    const dirEl = document.getElementById('current-dir-indicator');
    if (dirEl) {
      const symbols = { N: '▲ Norte', E: '► Este', S: '▼ Sur', W: '◄ Oeste' };
      dirEl.textContent = symbols[dir] || dir;
    }
  }

  init() {
    this.render();
  }

  render() {
    if (!this.container) return;

    const tools = [
      { id: 'extractor', name: 'Extractor', icon: '🍄', desc: 'Extrae nutrientes de yacimientos' },
      { id: 'hypha', name: 'Hifa T1', icon: '🧬', desc: 'Canal de transporte básico (2 u/s)' },
      { id: 'hypha_t2', name: 'Hifa T2', icon: '⚡', desc: 'Canal engrosado de alta velocidad (4 u/s)', req: 'hyphae_tier2' },
      { id: 'reactor', name: 'Reactor', icon: '⚗️', desc: 'Sintetiza compuestos bioactivos y polímeros' },
      { id: 'purifier', name: 'Purificador', icon: '💎', desc: 'Purifica antibióticos y teje seda', req: 'enzymatic_purification' },
      { id: 'storage', name: 'Almacén', icon: '📦', desc: 'Vesícula de reserva fúngica' },
      { id: 'delete', name: 'Digerir', icon: '🧪', desc: 'Descompone y recupera estructuras' }
    ];

    let html = `
      <div class="build-bar">
        <div class="build-tools-group">
    `;

    for (const tool of tools) {
      const isLocked = tool.req && !this.unlockedStructures.has(tool.id);
      const isSelected = this.activeTool === tool.id;

      html += `
        <button class="tool-btn ${isSelected ? 'active' : ''} ${isLocked ? 'locked' : ''}" 
                data-tool="${tool.id}" 
                ${isLocked ? 'disabled title="Requiere investigación previa"' : `title="${tool.desc}"`}>
          <span class="tool-icon">${tool.icon}</span>
          <span class="tool-label">${tool.name}</span>
        </button>
      `;
    }

    html += `
        </div>
        <div class="build-controls-group">
          <button id="btn-rotate" class="control-btn" title="Girar orientación de colocación [R]">
            <span class="ctrl-icon">🔄</span>
            <span id="current-dir-indicator">► Este</span>
          </button>
          <button id="btn-tech-tree" class="control-btn tech-btn" title="Árbol de Tecnologías Miceliales [T]">
            <span class="ctrl-icon">🌿</span>
            <span>Investigación</span>
          </button>
        </div>
      </div>
    `;

    this.container.innerHTML = html;
    this.bindEvents();
  }

  bindEvents() {
    const buttons = this.container.querySelectorAll('.tool-btn:not(.locked)');
    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        this.container.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeTool = btn.dataset.tool;
        if (this.onSelectTool) this.onSelectTool(this.activeTool);
      });
    });

    const rotateBtn = document.getElementById('btn-rotate');
    if (rotateBtn) {
      rotateBtn.addEventListener('click', () => {
        if (this.onRotate) this.onRotate();
      });
    }

    const techBtn = document.getElementById('btn-tech-tree');
    if (techBtn) {
      techBtn.addEventListener('click', () => {
        if (this.onOpenTech) this.onOpenTech();
      });
    }
  }
}
