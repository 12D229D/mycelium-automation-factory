/**
 * main.js - Punto de entrada principal para Mycelium Works
 * Inicializa el mundo procedural por chunks, simulación a paso fijo,
 * orquestador Web Worker, renderizador bioluminiscente, cámara, interfaz y persistencia SQLite.
 */

import { WorldManager, TILE_SIZE, CHUNK_SIZE } from './sim/chunks.js';
import { HyphaSegment, DIRECTIONS } from './sim/hyphaeFlow.js';
import { RecipeManager, ExtractorStructure, ProcessingNode, StorageStructure } from './sim/recipes.js';
import { ResearchManager } from './sim/research.js';
import { Camera } from './render/camera.js';
import { TileRenderer } from './render/tileRenderer.js';
import { BuildMenu } from './ui/buildMenu.js';
import { StatsPanel } from './ui/statsPanel.js';
import { SQLiteStorage } from './storage/sqliteChunks.js';

class MyceliumGame {
  constructor() {
    this.canvas = document.getElementById('sim-canvas');
    this.minimapCanvas = document.getElementById('minimap-canvas');
    this.minimapCtx = this.minimapCanvas.getContext('2d');

    this.world = new WorldManager(78432);
    this.camera = new Camera(this.canvas);
    this.storage = new SQLiteStorage();

    this.recipesData = null;
    this.techData = null;
    this.recipeManager = null;
    this.researchManager = null;
    this.renderer = null;
    this.statsPanel = null;
    this.buildMenu = null;

    this.currentTool = 'extractor';
    this.currentDir = 'E'; // 'N', 'E', 'S', 'W'
    this.cursorTile = null;

    this.inventory = {
      phosphorus: 35,
      plant_sugar: 30,
      nitrogen_water: 20,
      bioactive_compound: 0,
      mycelial_antibiotic: 0,
      chitin_silk: 0,
      spore_polymer: 0
    };

    this.simSpeedMultiplier = 1.0;
    this.lastTime = performance.now();
    this.fixedTimeStep = 1 / 30; // 30 ticks de simulación por segundo
    this.accumulator = 0;
    this.saveInterval = 10; // Guardar cada 10s
    this.saveTimer = 0;

    // Web Worker de simulación opcional / concurrente
    this.worker = null;
  }

  async init() {
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());

    // Cargar datos declarativos JSON
    const [recipesRes, techRes] = await Promise.all([
      fetch('src/data/recipes.json').then(r => r.json()),
      fetch('src/data/tech.json').then(r => r.json())
    ]);

    this.recipesData = recipesRes;
    this.techData = techRes;
    this.recipeManager = new RecipeManager(this.recipesData);
    this.researchManager = new ResearchManager(this.techData);

    // Inicializar almacenamiento
    await this.storage.init();
    const saved = this.storage.loadData();
    if (saved) {
      if (saved.inventory) Object.assign(this.inventory, saved.inventory);
      if (saved.unlockedTech) {
        this.researchManager.loadState(saved.unlockedTech);
      }
    }

    // Inicializar subsistemas gráficos y de UI
    this.renderer = new TileRenderer(this.canvas, this.world, this.camera, this.recipeManager);
    this.statsPanel = new StatsPanel('stats-panel-container', this.recipeManager);

    this.buildMenu = new BuildMenu(
      'build-menu-container',
      (tool) => { this.currentTool = tool; },
      () => { this.rotateCurrentDirection(); },
      () => { this.toggleTechModal(true); }
    );

    // Si ya hay tecnologías investigadas, reflejar en el menú
    for (const techId of this.researchManager.getState()) {
      this.applyTechUnlocks(techId);
    }

    // Inicializar Web Worker
    this.initWorker();

    // Colocar estructuras iniciales si el mapa está vacío
    this.setupInitialFactory();

    // Eventos de entrada (Ratón / Teclado)
    this.bindInputs();

    // Eventos del modal de tecnología
    this.bindTechModal();

    // Actualizar HUD
    this.updateInventoryUI();

    // Iniciar loop principal
    requestAnimationFrame((t) => this.gameLoop(t));
  }

  resizeCanvas() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  initWorker() {
    try {
      this.worker = new Worker('src/sim/simWorker.js');
      this.worker.postMessage({ type: 'INIT', payload: { seed: this.world.seed } });
      this.worker.onmessage = (e) => {
        // Recibir sincronización del worker
      };
    } catch (e) {
      console.warn('Web Worker aislado: ejecutando bucle nativo en hilo principal', e);
    }
  }

  setupInitialFactory() {
    // Si ya había estructuras guardadas, restaurarlas
    const saved = this.storage.loadData();
    if (saved && saved.structures && saved.structures.length > 0) {
      for (const s of saved.structures) {
        this.createStructureFromData(s);
      }
      return;
    }

    // Generar un extractor sobre un yacimiento cercano (0, 0)
    // Buscamos un recurso en el chunk inicial
    const chunk0 = this.world.getOrCreateChunk(0, 0);
    let target = chunk0.resources[0] || { x: 2, y: 2 };

    const ext = new ExtractorStructure(target.x, target.y, 'E');
    ext.init(this.world);
    this.world.placeStructure(ext);

    // Hifa hacia un reactor
    const h1 = new HyphaSegment(target.x + 1, target.y, 'E');
    const h2 = new HyphaSegment(target.x + 2, target.y, 'E');
    this.world.placeStructure(h1);
    this.world.placeStructure(h2);

    const reactor = new ProcessingNode('reactor', target.x + 3, target.y, 'E', 'bioactive_compound');
    this.world.placeStructure(reactor);

    const h3 = new HyphaSegment(target.x + 4, target.y, 'E');
    this.world.placeStructure(h3);

    const storage = new StorageStructure(target.x + 5, target.y, 250);
    this.world.placeStructure(storage);

    // Centrar cámara
    this.camera.x = target.x * TILE_SIZE;
    this.camera.y = target.y * TILE_SIZE;
  }

  createStructureFromData(s) {
    let st = null;
    if (s.type === 'extractor') {
      st = new ExtractorStructure(s.x, s.y, s.dir);
      st.init(this.world);
    } else if (s.type === 'hypha') {
      st = new HyphaSegment(s.x, s.y, s.dir, s.tier || 1);
    } else if (s.type === 'reactor' || s.type === 'purifier') {
      st = new ProcessingNode(s.type, s.x, s.y, s.dir, s.activeRecipeId);
    } else if (s.type === 'storage') {
      st = new StorageStructure(s.x, s.y, 250);
      if (s.inventory) st.inventory = s.inventory;
    }

    if (st) {
      this.world.placeStructure(st);
    }
  }

  rotateCurrentDirection() {
    const order = ['N', 'E', 'S', 'W'];
    const idx = (order.indexOf(this.currentDir) + 1) % order.length;
    this.currentDir = order[idx];
    this.buildMenu.setDirection(this.currentDir);
  }

  bindInputs() {
    // Pan y Zoom con ratón
    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
        // Pan con botón central o Shift + Click Izquierdo
        this.camera.isDragging = true;
        this.camera.lastMouseX = e.clientX;
        this.camera.lastMouseY = e.clientY;
      } else if (e.button === 0) {
        // Clic izquierdo: acción de herramienta
        this.handleTileAction(e);
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (this.camera.isDragging) {
        const dx = e.clientX - this.camera.lastMouseX;
        const dy = e.clientY - this.camera.lastMouseY;
        this.camera.pan(dx, dy);
        this.camera.lastMouseX = e.clientX;
        this.camera.lastMouseY = e.clientY;
      }

      // Actualizar posición de celda bajo el cursor
      this.cursorTile = this.camera.screenToTile(e.clientX, e.clientY, TILE_SIZE);
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 1 || e.button === 0) {
        this.camera.isDragging = false;
      }
    });

    // Zoom con rueda
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.camera.zoomAt(e.deltaY, e.clientX, e.clientY);
    }, { passive: false });

    // Atajos de teclado
    window.addEventListener('keydown', (e) => {
      const key = e.key.toLowerCase();
      if (key === 'r') {
        this.rotateCurrentDirection();
      } else if (key === 't') {
        this.toggleTechModal();
      } else if (key === '1') {
        this.currentTool = 'extractor';
        this.buildMenu.activeTool = 'extractor';
        this.buildMenu.render();
      } else if (key === '2') {
        this.currentTool = 'hypha';
        this.buildMenu.activeTool = 'hypha';
        this.buildMenu.render();
      } else if (key === '3') {
        this.currentTool = 'reactor';
        this.buildMenu.activeTool = 'reactor';
        this.buildMenu.render();
      } else if (key === '4') {
        this.currentTool = 'purifier';
        this.buildMenu.activeTool = 'purifier';
        this.buildMenu.render();
      } else if (key === '5') {
        this.currentTool = 'storage';
        this.buildMenu.activeTool = 'storage';
        this.buildMenu.render();
      } else if (key === 'x') {
        this.currentTool = 'delete';
        this.buildMenu.activeTool = 'delete';
        this.buildMenu.render();
      }
    });
  }

  handleTileAction(e) {
    if (!this.cursorTile) return;
    const { x, y } = this.cursorTile;
    const existing = this.world.getStructureAt(x, y);

    if (this.currentTool === 'delete') {
      if (existing) {
        this.world.removeStructure(x, y);
      }
      return;
    }

    if (existing) {
      // Si hacemos clic en un reactor/purificador existente, alternar su receta
      if (existing.type === 'reactor') {
        existing.setRecipe(existing.activeRecipeId === 'bioactive_compound' ? 'spore_polymer' : 'bioactive_compound');
      } else if (existing.type === 'purifier') {
        existing.setRecipe(existing.activeRecipeId === 'mycelial_antibiotic' ? 'chitin_silk' : 'mycelial_antibiotic');
      }
      return;
    }

    // Colocar nueva estructura
    if (this.currentTool === 'extractor') {
      const ext = new ExtractorStructure(x, y, this.currentDir);
      ext.init(this.world);
      this.world.placeStructure(ext);
    } else if (this.currentTool === 'hypha') {
      const h = new HyphaSegment(x, y, this.currentDir, 1);
      this.world.placeStructure(h);
    } else if (this.currentTool === 'hypha_t2') {
      const h = new HyphaSegment(x, y, this.currentDir, 2);
      this.world.placeStructure(h);
    } else if (this.currentTool === 'reactor') {
      const r = new ProcessingNode('reactor', x, y, this.currentDir, 'bioactive_compound');
      this.world.placeStructure(r);
    } else if (this.currentTool === 'purifier') {
      const p = new ProcessingNode('purifier', x, y, this.currentDir, 'mycelial_antibiotic');
      this.world.placeStructure(p);
    } else if (this.currentTool === 'storage') {
      const s = new StorageStructure(x, y, 250);
      this.world.placeStructure(s);
    }
  }

  bindTechModal() {
    const modal = document.getElementById('tech-modal');
    const closeBtn = document.getElementById('close-tech-btn');
    closeBtn.addEventListener('click', () => this.toggleTechModal(false));

    modal.addEventListener('click', (e) => {
      if (e.target === modal) this.toggleTechModal(false);
    });
  }

  toggleTechModal(forceOpen) {
    const modal = document.getElementById('tech-modal');
    const shouldOpen = forceOpen !== undefined ? forceOpen : !modal.classList.contains('active');

    if (shouldOpen) {
      modal.classList.add('active');
      modal.setAttribute('aria-hidden', 'false');
      this.renderTechTree();
    } else {
      modal.classList.remove('active');
      modal.setAttribute('aria-hidden', 'true');
    }
  }

  renderTechTree() {
    const container = document.getElementById('tech-grid');
    if (!container) return;

    const techs = this.researchManager.getAllTechnologies();
    let html = '';

    for (const tech of techs) {
      const isDone = tech.unlocked;
      const isAvail = tech.available;

      let badgeClass = isDone ? 'done' : isAvail ? 'avail' : 'locked';
      let badgeText = isDone ? '✓ Completada' : isAvail ? 'Disponible' : 'Bloqueada';

      html += `
        <div class="tech-item ${isDone ? 'unlocked' : ''}">
          <div class="tech-item-header">
            <span class="tech-name">${tech.name}</span>
            <span class="tech-badge ${badgeClass}">${badgeText}</span>
          </div>
          <p class="tech-desc">${tech.description}</p>
          <div class="tech-costs">
      `;

      for (const [res, qty] of Object.entries(tech.cost)) {
        const currentQty = Math.floor(this.inventory[res] || 0);
        const info = this.recipeManager.getResourceInfo(res);
        html += `
          <span class="cost-tag" style="border: 1px solid ${info.color}">
            ${info.name}: ${currentQty}/${qty}
          </span>
        `;
      }

      html += `
          </div>
          <button class="research-action-btn" data-tech="${tech.id}" ${!isAvail ? 'disabled' : ''}>
            ${isDone ? 'Investigado' : 'Investigar'}
          </button>
        </div>
      `;
    }

    container.innerHTML = html;

    // Vincular botones de investigar
    container.querySelectorAll('.research-action-btn:not(:disabled)').forEach(btn => {
      btn.addEventListener('click', () => {
        const techId = btn.dataset.tech;
        const res = this.researchManager.contributeResearch(techId, this.inventory);
        if (res.success) {
          this.applyTechUnlocks(techId);
          this.updateInventoryUI();
          this.renderTechTree();
          this.buildMenu.render();
          this.storage.saveGameState(
            this.world.getAllStructures(),
            this.inventory,
            this.researchManager.getState(),
            {}
          );
        } else {
          alert(res.reason);
        }
      });
    });
  }

  applyTechUnlocks(techId) {
    const tech = this.researchManager.getTech(techId);
    if (!tech || !tech.unlocks) return;

    if (tech.unlocks.structures) {
      for (const s of tech.unlocks.structures) {
        this.buildMenu.unlockStructure(s);
      }
    }
    if (tech.unlocks.extractorEfficiency) {
      this.simSpeedMultiplier = tech.unlocks.extractorEfficiency;
    }
  }

  updateInventoryUI() {
    for (const [key, val] of Object.entries(this.inventory)) {
      const el = document.getElementById(`inv-${key}`);
      if (el) el.textContent = Math.floor(val);
    }
  }

  // Bucle fijo de simulación
  simulationTick(dt) {
    const structures = this.world.getAllStructures();

    for (const st of structures) {
      if (st.type === 'extractor') {
        st.update(dt, this.world, this.simSpeedMultiplier);
      } else if (st.type === 'hypha') {
        st.update(dt, this.world);
      } else if (st.type === 'reactor' || st.type === 'purifier') {
        const prevStatus = st.status;
        st.update(dt, this.world, this.recipeManager, this.simSpeedMultiplier);
        if (prevStatus === 'crafting' && st.status !== 'crafting') {
          // Síntesis terminada
          const r = this.recipeManager.getRecipe(st.activeRecipeId);
          if (r) {
            for (const [outItem, outQty] of Object.entries(r.outputs)) {
              this.statsPanel.logProduction(outItem, outQty);
            }
          }
        }
      } else if (st.type === 'storage') {
        // Traspasar recursos del almacén al inventario utilizable del jugador
        for (const [item, qty] of Object.entries(st.inventory)) {
          if (qty > 0) {
            this.inventory[item] = (this.inventory[item] || 0) + qty;
            this.statsPanel.logProduction(item, qty);
            delete st.inventory[item];
          }
        }
      }
    }

    // Actualizar métricas del panel de producción
    this.statsPanel.updateMetrics(structures);
    this.updateInventoryUI();
  }

  renderMinimap() {
    const ctx = this.minimapCtx;
    const w = this.minimapCanvas.width;
    const h = this.minimapCanvas.height;

    ctx.fillStyle = '#050a0f';
    ctx.fillRect(0, 0, w, h);

    const cx = w / 2;
    const cy = h / 2;
    const scale = 2.5;

    // Dibujar estructuras en el minimapa
    const structures = this.world.getAllStructures();
    for (const st of structures) {
      const mx = cx + (st.x * scale);
      const my = cy + (st.y * scale);
      if (mx >= 0 && mx < w && my >= 0 && my < h) {
        ctx.fillStyle = st.type === 'hypha' ? '#38bdf8' : st.type === 'extractor' ? '#4ade80' : '#c084fc';
        ctx.fillRect(mx - 1, my - 1, 3, 3);
      }
    }

    // Marco del punto de vista de la cámara
    const camX = cx + (this.camera.x / TILE_SIZE * scale);
    const camY = cy + (this.camera.y / TILE_SIZE * scale);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(camX - 10, camY - 7, 20, 14);
  }

  gameLoop(currentTime) {
    const delta = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;

    // Simulación a paso fijo (Fixed Timestep)
    this.accumulator += Math.min(delta, 0.1);
    while (this.accumulator >= this.fixedTimeStep) {
      this.simulationTick(this.fixedTimeStep);
      this.accumulator -= this.fixedTimeStep;

      if (this.worker) {
        this.worker.postMessage({ type: 'TICK', payload: { deltaTime: this.fixedTimeStep } });
      }
    }

    // Actualizar cámara (interpolación suave)
    this.camera.update(delta);

    // Renderizar mundo en Canvas
    this.renderer.render(delta, this.cursorTile, this.currentTool);

    // Renderizar minimapa
    this.renderMinimap();

    // Guardado incremental
    this.saveTimer += delta;
    if (this.saveTimer >= this.saveInterval) {
      this.saveTimer = 0;
      this.storage.saveGameState(
        this.world.getAllStructures(),
        this.inventory,
        this.researchManager.getState(),
        {}
      );
    }

    requestAnimationFrame((t) => this.gameLoop(t));
  }
}

// Iniciar aplicación al cargar el DOM
window.addEventListener('DOMContentLoaded', () => {
  const game = new MyceliumGame();
  game.init();
});
