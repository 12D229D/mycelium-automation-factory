/**
 * tileRenderer.js - Renderizado Canvas 2D de alta fidelidad bioluminiscente
 * Dibuja terreno por chunks, yacimientos cristalinos de fósforo/azúcar/nitrógeno,
 * hifas animadas con pulsos de fluidos de nutrientes y estructuras complejas.
 */

import { CHUNK_SIZE, TILE_SIZE } from '../sim/chunks.js';

export class TileRenderer {
  constructor(canvas, world, camera, recipeManager) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.world = world;
    this.camera = camera;
    this.recipeManager = recipeManager;
    this.animationTime = 0;
  }

  render(deltaTime, cursorTile, activeTool) {
    this.animationTime += deltaTime;
    const ctx = this.ctx;
    const width = this.canvas.width;
    const height = this.canvas.height;

    // Limpiar fondo con tono humus abisal
    ctx.fillStyle = '#070a0e';
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    // Centrar en pantalla y aplicar cámara (zoom y pan)
    ctx.translate(width / 2, height / 2);
    ctx.scale(this.camera.zoom, this.camera.zoom);
    ctx.translate(-this.camera.x, -this.camera.y);

    // Calcular límites visibles del mundo en coordenadas de baldosas
    const halfW = (width / 2) / this.camera.zoom;
    const halfH = (height / 2) / this.camera.zoom;
    const minX = Math.floor((this.camera.x - halfW) / TILE_SIZE) - 1;
    const maxX = Math.ceil((this.camera.x + halfW) / TILE_SIZE) + 1;
    const minY = Math.floor((this.camera.y - halfH) / TILE_SIZE) - 1;
    const maxY = Math.ceil((this.camera.y + halfH) / TILE_SIZE) + 1;

    const minChunkX = Math.floor(minX / CHUNK_SIZE);
    const maxChunkX = Math.floor(maxX / CHUNK_SIZE);
    const minChunkY = Math.floor(minY / CHUNK_SIZE);
    const maxChunkY = Math.floor(maxY / CHUNK_SIZE);

    // 1. Renderizar Chunks y Terreno
    for (let cy = minChunkY; cy <= maxChunkY; cy++) {
      for (let cx = minChunkX; cx <= maxChunkX; cx++) {
        this.renderChunk(cx, cy, ctx);
      }
    }

    // 2. Renderizar Red de Hifas y Nódulos de Procesamiento
    const structures = this.world.getAllStructures();
    for (const st of structures) {
      if (st.x >= minX && st.x <= maxX && st.y >= minY && st.y <= maxY) {
        this.renderStructure(st, ctx);
      }
    }

    // 3. Renderizar Vista Previa de Herramienta / Cursor de Construcción
    if (cursorTile) {
      this.renderCursor(cursorTile, activeTool, ctx);
    }

    ctx.restore();
  }

  renderChunk(cx, cy, ctx) {
    const chunk = this.world.getOrCreateChunk(cx, cy);
    const startX = cx * CHUNK_SIZE * TILE_SIZE;
    const startY = cy * CHUNK_SIZE * TILE_SIZE;

    // Cuadrícula y baldosas del chunk
    for (let ly = 0; ly < CHUNK_SIZE; ly++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const tile = chunk.tiles[ly * CHUNK_SIZE + lx];
        const tx = startX + lx * TILE_SIZE;
        const ty = startY + ly * TILE_SIZE;

        // Color de humus según bioma
        if (tile.terrain === 'mycelial_bed') {
          ctx.fillStyle = '#0b191e';
        } else if (tile.terrain === 'root_cluster') {
          ctx.fillStyle = '#0a1314';
        } else {
          ctx.fillStyle = '#090e12';
        }
        ctx.fillRect(tx, ty, TILE_SIZE, TILE_SIZE);

        // Líneas tenues de cuadrícula
        ctx.strokeStyle = 'rgba(30, 58, 70, 0.25)';
        ctx.lineWidth = 1;
        ctx.strokeRect(tx, ty, TILE_SIZE, TILE_SIZE);

        // Efecto bioluminiscente ambiental
        if (tile.bioluminescence > 0.5) {
          const pulse = (Math.sin(this.animationTime * 2 + tile.x + tile.y) + 1) * 0.5;
          ctx.fillStyle = `rgba(34, 197, 94, ${tile.bioluminescence * 0.08 * pulse})`;
          ctx.beginPath();
          ctx.arc(tx + TILE_SIZE / 2, ty + TILE_SIZE / 2, TILE_SIZE * 0.4, 0, Math.PI * 2);
          ctx.fill();
        }

        // Si tiene depósito de recursos
        if (tile.resource) {
          this.renderResourceTile(tile, tx, ty, ctx);
        }
      }
    }
  }

  renderResourceTile(tile, tx, ty, ctx) {
    const resInfo = this.recipeManager.getResourceInfo(tile.resource);
    const pulse = 0.8 + 0.2 * Math.sin(this.animationTime * 3 + tile.x * 0.5);

    ctx.save();
    ctx.translate(tx + TILE_SIZE / 2, ty + TILE_SIZE / 2);

    // Resplandor del yacimiento
    const radGlow = TILE_SIZE * 0.6 * pulse;
    const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, radGlow);
    glow.addColorStop(0, resInfo.color || '#4ade80');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, radGlow, 0, Math.PI * 2);
    ctx.fill();

    // Cristales de esporas o nódulos de extracción
    ctx.fillStyle = resInfo.color || '#4ade80';
    if (tile.resource === 'phosphorus') {
      // Cristales romboidales verdes
      ctx.beginPath();
      ctx.moveTo(0, -7);
      ctx.lineTo(6, 0);
      ctx.lineTo(0, 7);
      ctx.lineTo(-6, 0);
      ctx.closePath();
      ctx.fill();
    } else if (tile.resource === 'plant_sugar') {
      // Racimos de esferas doradas
      ctx.beginPath();
      ctx.arc(-3, -2, 4, 0, Math.PI * 2);
      ctx.arc(4, 2, 3.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (tile.resource === 'nitrogen_water') {
      // Gota o géiser acuífero azul fluorescente
      ctx.beginPath();
      ctx.arc(0, 2, 5, 0, Math.PI);
      ctx.lineTo(0, -6);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }

  renderStructure(st, ctx) {
    const tx = st.x * TILE_SIZE;
    const ty = st.y * TILE_SIZE;

    ctx.save();
    ctx.translate(tx + TILE_SIZE / 2, ty + TILE_SIZE / 2);

    if (st.type === 'hypha') {
      this.renderHypha(st, ctx);
    } else if (st.type === 'extractor') {
      this.renderExtractor(st, ctx);
    } else if (st.type === 'reactor') {
      this.renderReactor(st, ctx);
    } else if (st.type === 'purifier') {
      this.renderPurifier(st, ctx);
    } else if (st.type === 'storage') {
      this.renderStorage(st, ctx);
    }

    ctx.restore();
  }

  renderHypha(st, ctx) {
    // Dirección: 'N', 'E', 'S', 'W'
    const angles = { E: 0, S: Math.PI / 2, W: Math.PI, N: -Math.PI / 2 };
    ctx.rotate(angles[st.dir] || 0);

    // Filamento principal de hifa (tubo biológico)
    ctx.strokeStyle = st.tier === 2 ? '#a855f7' : '#06b6d4';
    ctx.lineWidth = st.tier === 2 ? 10 : 7;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-TILE_SIZE * 0.45, 0);
    ctx.lineTo(TILE_SIZE * 0.45, 0);
    ctx.stroke();

    // Núcleo luminiscente interior
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Flecha de orientación sutil
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.beginPath();
    ctx.moveTo(4, -3);
    ctx.lineTo(8, 0);
    ctx.lineTo(4, 3);
    ctx.fill();

    // Partículas/Nutrientes fluyendo
    if (st.items && st.items.length > 0) {
      for (const it of st.items) {
        const itemX = (-TILE_SIZE * 0.45) + (it.progress * TILE_SIZE * 0.9);
        const res = this.recipeManager.getResourceInfo(it.item);

        ctx.fillStyle = res.color || '#4ade80';
        ctx.shadowColor = res.color || '#4ade80';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(itemX, 0, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0; // reset
      }
    }
  }

  renderExtractor(st, ctx) {
    const pulse = Math.sin(this.animationTime * 4) * 2;

    // Base del hongo extractor
    ctx.fillStyle = '#064e3b';
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, Math.PI * 2);
    ctx.fill();

    // Sombrero bioluminiscente del hongo
    ctx.fillStyle = '#10b981';
    ctx.shadowColor = '#10b981';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(0, 0, 8 + pulse * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Núcleo esporal y boquilla de salida orientada
    const angles = { E: 0, S: Math.PI / 2, W: Math.PI, N: -Math.PI / 2 };
    ctx.rotate(angles[st.dir] || 0);
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.moveTo(4, -4);
    ctx.lineTo(12, 0);
    ctx.lineTo(4, 4);
    ctx.closePath();
    ctx.fill();
  }

  renderReactor(st, ctx) {
    // Caja biológica de fermentación y esporas
    ctx.fillStyle = '#311042';
    ctx.fillRect(-12, -12, 24, 24);

    ctx.strokeStyle = '#c084fc';
    ctx.lineWidth = 2;
    ctx.strokeRect(-12, -12, 24, 24);

    // Indicador de estado de síntesis
    if (st.status === 'crafting') {
      const rot = this.animationTime * 5;
      ctx.rotate(rot);
      ctx.fillStyle = '#f43f5e';
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = st.status === 'blocked' ? '#ef4444' : '#a855f7';
      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  renderPurifier(st, ctx) {
    // Cámara de filtración enzimática hexagonal
    ctx.fillStyle = '#083344';
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3;
      const x = 12 * Math.cos(angle);
      const y = 12 * Math.sin(angle);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Espiral enzimática
    ctx.strokeStyle = '#7dd3fc';
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, Math.PI * (0.5 + (st.progress || 0) * 1.5));
    ctx.stroke();
  }

  renderStorage(st, ctx) {
    // Almacén o vesícula fúngica
    ctx.fillStyle = '#1c1917';
    ctx.beginPath();
    ctx.arc(0, 0, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Conteo o pulso de almacenamiento
    const totalStored = Object.values(st.inventory || {}).reduce((a, b) => a + b, 0);
    const fillRatio = Math.min(1.0, totalStored / (st.maxCapacity || 100));

    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(0, 0, 3 + fillRatio * 6, 0, Math.PI * 2);
    ctx.fill();
  }

  renderCursor(tile, tool, ctx) {
    const tx = tile.x * TILE_SIZE;
    const ty = tile.y * TILE_SIZE;

    ctx.save();
    ctx.translate(tx, ty);

    if (tool === 'delete') {
      ctx.fillStyle = 'rgba(239, 68, 68, 0.35)';
      ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.strokeRect(0, 0, TILE_SIZE, TILE_SIZE);
    } else {
      ctx.fillStyle = 'rgba(56, 189, 248, 0.25)';
      ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.strokeRect(0, 0, TILE_SIZE, TILE_SIZE);
    }

    ctx.restore();
  }
}
