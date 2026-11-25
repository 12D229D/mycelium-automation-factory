-- Esquema declarativo SQLite 3.45+ para Mycelium Works
-- Gestiona chunks generados, estructuras construidas, inventario fúngico e investigaciones

CREATE TABLE IF NOT EXISTS world_metadata (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS world_chunks (
    chunk_x INTEGER NOT NULL,
    chunk_y INTEGER NOT NULL,
    seed INTEGER NOT NULL,
    biolum_density REAL DEFAULT 1.0,
    resource_data TEXT NOT NULL, -- JSON serializado de yacimientos (fósforo, azúcar, nitrógeno)
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (chunk_x, chunk_y)
);

CREATE TABLE IF NOT EXISTS placed_structures (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,          -- 'extractor', 'hypha', 'reactor', 'purifier', 'storage', 'hub'
    tile_x INTEGER NOT NULL,
    tile_y INTEGER NOT NULL,
    direction TEXT DEFAULT 'N',  -- 'N', 'E', 'S', 'W'
    tier INTEGER DEFAULT 1,
    active_recipe TEXT,
    internal_buffer TEXT,        -- JSON de inventario local/buffer
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS factory_inventory (
    item_id TEXT PRIMARY KEY,
    quantity REAL NOT NULL DEFAULT 0,
    discovered BOOLEAN DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS unlocked_tech (
    tech_id TEXT PRIMARY KEY,
    unlocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    progress REAL DEFAULT 1.0
);

CREATE TABLE IF NOT EXISTS production_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp INTEGER NOT NULL,
    item_id TEXT NOT NULL,
    produced_last_minute REAL DEFAULT 0,
    consumed_last_minute REAL DEFAULT 0
);
