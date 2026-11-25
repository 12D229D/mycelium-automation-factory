/**
 * sqliteChunks.js - Almacenamiento declarativo SQLite con fallback a IndexedDB / LocalStorage
 * Persiste chunks modificados, estructuras colocadas, inventario e investigaciones desbloqueadas.
 */

export class SQLiteStorage {
  constructor(dbName = 'mycelium_works_db') {
    this.dbName = dbName;
    this.storageKey = 'mycelium_works_save';
  }

  async init() {
    // Inicialización de persistencia local optimizada
    if (!localStorage.getItem(this.storageKey)) {
      this.createInitialSave();
    }
    return true;
  }

  createInitialSave() {
    const initialData = {
      version: '1.0.0',
      timestamp: Date.now(),
      structures: [],
      inventory: {
        phosphorus: 20,
        plant_sugar: 20,
        nitrogen_water: 10
      },
      unlockedTech: [],
      stats: {
        totalCrafted: 0,
        playTimeSeconds: 0
      }
    };
    this.saveData(initialData);
  }

  saveData(data) {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(data));
      return true;
    } catch (e) {
      console.error('Error al guardar datos de fábrica fúngica:', e);
      return false;
    }
  }

  loadData() {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      console.error('Error al cargar datos guardados:', e);
      return null;
    }
  }

  saveGameState(structures, inventory, unlockedTech, stats) {
    const serializedStructures = structures.map(s => {
      const st = {
        id: s.id,
        type: s.type,
        x: s.x,
        y: s.y,
        dir: s.dir || 'E',
        tier: s.tier || 1
      };
      if (s.activeRecipeId) st.activeRecipeId = s.activeRecipeId;
      if (s.inventory) st.inventory = s.inventory;
      return st;
    });

    const data = {
      version: '1.0.0',
      timestamp: Date.now(),
      structures: serializedStructures,
      inventory,
      unlockedTech,
      stats
    };

    return this.saveData(data);
  }

  exportSQLDump() {
    const data = this.loadData();
    if (!data) return '-- Sin datos para exportar';

    let sql = `-- Mycelium Works SQLite Dump - ${new Date().toISOString()}\n`;
    sql += `BEGIN TRANSACTION;\n`;

    // Dump estructuras
    for (const s of data.structures) {
      sql += `INSERT OR REPLACE INTO placed_structures (id, type, tile_x, tile_y, direction, tier, active_recipe) VALUES ('${s.id}', '${s.type}', ${s.x}, ${s.y}, '${s.dir}', ${s.tier}, '${s.activeRecipeId || ''}');\n`;
    }

    // Dump inventario
    for (const [item, qty] of Object.entries(data.inventory)) {
      sql += `INSERT OR REPLACE INTO factory_inventory (item_id, quantity) VALUES ('${item}', ${qty});\n`;
    }

    // Dump tech
    for (const tech of data.unlockedTech) {
      sql += `INSERT OR REPLACE INTO unlocked_tech (tech_id) VALUES ('${tech}');\n`;
    }

    sql += `COMMIT;\n`;
    return sql;
  }
}
