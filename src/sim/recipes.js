/**
 * recipes.js - Cadenas de refinamiento, síntesis biológica y gestión de estructuras
 */

export class RecipeManager {
  constructor(recipesData) {
    this.resources = recipesData.resources || {};
    this.recipes = recipesData.recipes || [];
    this.recipeMap = new Map(this.recipes.map(r => [r.id, r]));
  }

  getRecipe(id) {
    return this.recipeMap.get(id);
  }

  getRecipesForStructure(structureType) {
    return this.recipes.filter(r => r.structureType === structureType);
  }

  getResourceInfo(id) {
    return this.resources[id] || {
      id,
      name: id,
      color: '#8b5cf6',
      hsl: 'hsl(262, 83%, 58%)'
    };
  }
}

// Estructura: Extractor de Nutrientes
export class ExtractorStructure {
  constructor(x, y, dir = 'E') {
    this.id = `extractor_${x}_${y}`;
    this.type = 'extractor';
    this.x = x;
    this.y = y;
    this.dir = dir;
    this.targetResource = null;
    this.cycleTimer = 0;
    this.cycleDuration = 1.8; // Segundos por extracción
    this.buffer = [];
    this.maxBuffer = 10;
    this.active = true;
    this.lastOutputTimestamp = 0;
  }

  init(world) {
    const tile = world.getTile(this.x, this.y);
    if (tile && tile.resource) {
      this.targetResource = tile.resource;
    }
  }

  update(deltaTime, world, speedMultiplier = 1.0) {
    if (!this.targetResource) {
      this.init(world);
      if (!this.targetResource) return;
    }

    // Extracción continua si hay espacio en el buffer interno
    if (this.buffer.length < this.maxBuffer) {
      this.cycleTimer += deltaTime * speedMultiplier;
      if (this.cycleTimer >= this.cycleDuration) {
        this.cycleTimer = 0;
        this.buffer.push(this.targetResource);
      }
    }

    // Intentar empujar el recurso hacia la estructura frontal
    if (this.buffer.length > 0) {
      const dx = this.dir === 'E' ? 1 : this.dir === 'W' ? -1 : 0;
      const dy = this.dir === 'S' ? 1 : this.dir === 'N' ? -1 : 0;
      const frontStructure = world.getStructureAt(this.x + dx, this.y + dy);

      if (frontStructure) {
        let sent = false;
        const itemToPush = this.buffer[0];

        if (frontStructure.type === 'hypha' && frontStructure.canAcceptItem()) {
          frontStructure.pushItem(itemToPush);
          sent = true;
        } else if ((frontStructure.type === 'reactor' || frontStructure.type === 'purifier') && frontStructure.acceptInput(itemToPush)) {
          sent = true;
        } else if (frontStructure.type === 'storage' && frontStructure.store(itemToPush, 1)) {
          sent = true;
        }

        if (sent) {
          this.buffer.shift();
        }
      }
    }
  }
}

// Estructura: Reactor de Esporas / Purificador Enzimático (Procesadores)
export class ProcessingNode {
  constructor(type, x, y, dir = 'E', defaultRecipeId = null) {
    this.id = `${type}_${x}_${y}`;
    this.type = type; // 'reactor' o 'purifier'
    this.x = x;
    this.y = y;
    this.dir = dir;
    this.activeRecipeId = defaultRecipeId;
    this.inputBuffer = {}; // { item_id: count }
    this.outputBuffer = []; // array de item_id
    this.progress = 0; // 0..1
    this.isCrafting = false;
    this.status = 'idle'; // 'idle', 'crafting', 'blocked'
  }

  setRecipe(recipeId) {
    this.activeRecipeId = recipeId;
    this.progress = 0;
    this.isCrafting = false;
  }

  acceptInput(itemId) {
    // Si la receta requiere este item y no tenemos exceso acumulado (< 10)
    const current = this.inputBuffer[itemId] || 0;
    if (current >= 12) return false;
    this.inputBuffer[itemId] = current + 1;
    return true;
  }

  update(deltaTime, world, recipeManager, speedMultiplier = 1.0) {
    const recipe = recipeManager.getRecipe(this.activeRecipeId);
    if (!recipe) {
      this.status = 'no_recipe';
      return;
    }

    // Verificar si tenemos los insumos requeridos
    let hasInputs = true;
    for (const [inItem, reqQty] of Object.entries(recipe.inputs)) {
      if ((this.inputBuffer[inItem] || 0) < reqQty) {
        hasInputs = false;
        break;
      }
    }

    // Si no está crafteando pero tiene insumos, consumir e iniciar síntesis
    if (!this.isCrafting && hasInputs && this.outputBuffer.length < 8) {
      for (const [inItem, reqQty] of Object.entries(recipe.inputs)) {
        this.inputBuffer[inItem] -= reqQty;
      }
      this.isCrafting = true;
      this.progress = 0;
    }

    if (this.isCrafting) {
      this.status = 'crafting';
      this.progress += (deltaTime * speedMultiplier) / recipe.craftTime;
      if (this.progress >= 1.0) {
        this.progress = 0;
        this.isCrafting = false;
        // Generar productos
        for (const [outItem, outQty] of Object.entries(recipe.outputs)) {
          for (let i = 0; i < outQty; i++) {
            this.outputBuffer.push(outItem);
          }
        }
      }
    } else if (this.outputBuffer.length >= 8) {
      this.status = 'blocked';
    } else {
      this.status = 'waiting_inputs';
    }

    // Expulsar items del output hacia el frente
    if (this.outputBuffer.length > 0) {
      const dx = this.dir === 'E' ? 1 : this.dir === 'W' ? -1 : 0;
      const dy = this.dir === 'S' ? 1 : this.dir === 'N' ? -1 : 0;
      const frontStructure = world.getStructureAt(this.x + dx, this.y + dy);

      if (frontStructure) {
        const itemToPush = this.outputBuffer[0];
        let sent = false;

        if (frontStructure.type === 'hypha' && frontStructure.canAcceptItem()) {
          frontStructure.pushItem(itemToPush);
          sent = true;
        } else if ((frontStructure.type === 'reactor' || frontStructure.type === 'purifier') && frontStructure.acceptInput(itemToPush)) {
          sent = true;
        } else if (frontStructure.type === 'storage' && frontStructure.store(itemToPush, 1)) {
          sent = true;
        }

        if (sent) {
          this.outputBuffer.shift();
        }
      }
    }
  }
}

// Estructura: Almacén Fúngico
export class StorageStructure {
  constructor(x, y, maxCap = 200) {
    this.id = `storage_${x}_${y}`;
    this.type = 'storage';
    this.x = x;
    this.y = y;
    this.inventory = {}; // { itemId: quantity }
    this.maxCapacity = maxCap;
  }

  store(itemId, qty = 1) {
    const current = this.inventory[itemId] || 0;
    const totalItems = Object.values(this.inventory).reduce((a, b) => a + b, 0);
    if (totalItems + qty > this.maxCapacity) return false;
    this.inventory[itemId] = current + qty;
    return true;
  }

  withdraw(itemId, qty = 1) {
    const current = this.inventory[itemId] || 0;
    if (current < qty) return false;
    this.inventory[itemId] -= qty;
    if (this.inventory[itemId] <= 0) delete this.inventory[itemId];
    return true;
  }
}
