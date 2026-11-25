/**
 * chunks.js - Generación procedural de cuadrícula infinita por chunks
 * Utiliza algoritmos de ruido pseudo-aleatorio basados en gradientes matemáticos
 * sin dependencias externas para garantizar máximo rendimiento y compatibilidad.
 */

export const CHUNK_SIZE = 16; // 16x16 celdas por chunk
export const TILE_SIZE = 32;  // Tamaño visual de celda en píxeles base

// Generador de ruido determinista con semilla (hash rápido tipo Murmur/FNV)
function pseudoRandom(x, y, seed = 1337) {
  let n = Math.sin(x * 12.9898 + y * 78.233 + seed * 43758.5453) * 43758.5453123;
  return n - Math.floor(n);
}

// Ruido 2D suave interpolado bicúbico
function smoothNoise2D(x, y, seed) {
  const i = Math.floor(x);
  const j = Math.floor(y);
  const fx = x - i;
  const fy = y - j;

  // Curva s-curve (Hermite suave)
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);

  const n00 = pseudoRandom(i, j, seed);
  const n10 = pseudoRandom(i + 1, j, seed);
  const n01 = pseudoRandom(i, j + 1, seed);
  const n11 = pseudoRandom(i + 1, j + 1, seed);

  const nx0 = n00 * (1 - sx) + n10 * sx;
  const nx1 = n01 * (1 - sx) + n11 * sx;

  return nx0 * (1 - sy) + nx1 * sy;
}

// Octavas de ruido fractal
function fractalNoise(x, y, seed, octaves = 3, persistence = 0.5) {
  let total = 0;
  let frequency = 1;
  let amplitude = 1;
  let maxValue = 0;

  for (let o = 0; o < octaves; o++) {
    total += smoothNoise2D(x * frequency, y * frequency, seed + o * 100) * amplitude;
    maxValue += amplitude;
    amplitude *= persistence;
    frequency *= 2;
  }

  return total / maxValue;
}

export class WorldManager {
  constructor(seed = 42819) {
    this.seed = seed;
    this.chunks = new Map(); // Llave: "chunkX,chunkY"
    this.structures = new Map(); // Llave: "tileX,tileY" -> Structure
  }

  getChunkKey(cx, cy) {
    return `${cx},${cy}`;
  }

  getTileKey(tx, ty) {
    return `${tx},${ty}`;
  }

  getTile(tx, ty) {
    const cx = Math.floor(tx / CHUNK_SIZE);
    const cy = Math.floor(ty / CHUNK_SIZE);
    const chunk = this.getOrCreateChunk(cx, cy);
    const lx = ((tx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const ly = ((ty % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    return chunk.tiles[ly * CHUNK_SIZE + lx];
  }

  getOrCreateChunk(cx, cy) {
    const key = this.getChunkKey(cx, cy);
    if (this.chunks.has(key)) {
      return this.chunks.get(key);
    }
    const chunk = this.generateChunk(cx, cy);
    this.chunks.set(key, chunk);
    return chunk;
  }

  generateChunk(cx, cy) {
    const tiles = new Array(CHUNK_SIZE * CHUNK_SIZE);
    const resources = [];

    for (let ly = 0; ly < CHUNK_SIZE; ly++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const gx = cx * CHUNK_SIZE + lx;
        const gy = cy * CHUNK_SIZE + ly;

        // Capas de ruido para diferentes recursos y bioma
        const biomeNoise = fractalNoise(gx * 0.04, gy * 0.04, this.seed);
        const pNoise = fractalNoise(gx * 0.08, gy * 0.08, this.seed + 101);
        const sNoise = fractalNoise(gx * 0.08, gy * 0.08, this.seed + 202);
        const nNoise = fractalNoise(gx * 0.08, gy * 0.08, this.seed + 303);

        let resource = null;
        let richness = 0;

        // Densidad de yacimientos fúngicos
        if (pNoise > 0.72) {
          resource = 'phosphorus';
          richness = Math.floor((pNoise - 0.72) * 800) + 150;
        } else if (sNoise > 0.73) {
          resource = 'plant_sugar';
          richness = Math.floor((sNoise - 0.73) * 750) + 120;
        } else if (nNoise > 0.74) {
          resource = 'nitrogen_water';
          richness = Math.floor((nNoise - 0.74) * 900) + 200;
        }

        // Tipo de terreno base
        let terrain = 'humus'; // Humus fértil oscuro
        if (biomeNoise > 0.65) terrain = 'mycelial_bed'; // Lecho de micelio denso
        else if (biomeNoise < 0.35) terrain = 'root_cluster'; // Raíces leñosas profundas

        const tile = {
          x: gx,
          y: gy,
          terrain,
          resource,
          richness,
          bioluminescence: Math.min(1.0, Math.max(0.1, biomeNoise * 0.8 + 0.2))
        };

        tiles[ly * CHUNK_SIZE + lx] = tile;
        if (resource) {
          resources.push({ x: gx, y: gy, type: resource, richness });
        }
      }
    }

    return {
      cx,
      cy,
      tiles,
      resources,
      modified: false
    };
  }

  getStructureAt(tx, ty) {
    return this.structures.get(this.getTileKey(tx, ty)) || null;
  }

  placeStructure(structure) {
    const key = this.getTileKey(structure.x, structure.y);
    this.structures.set(key, structure);
    const cx = Math.floor(structure.x / CHUNK_SIZE);
    const cy = Math.floor(structure.y / CHUNK_SIZE);
    const chunk = this.getOrCreateChunk(cx, cy);
    chunk.modified = true;
    return structure;
  }

  removeStructure(tx, ty) {
    const key = this.getTileKey(tx, ty);
    const st = this.structures.get(key);
    if (st) {
      this.structures.delete(key);
      const cx = Math.floor(tx / CHUNK_SIZE);
      const cy = Math.floor(ty / CHUNK_SIZE);
      const chunk = this.getOrCreateChunk(cx, cy);
      chunk.modified = true;
      return st;
    }
    return null;
  }

  getAllStructures() {
    return Array.from(this.structures.values());
  }
}
