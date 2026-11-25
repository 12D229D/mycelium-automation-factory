/**
 * hyphaeFlow.js - Red de hifas orgánicas que actúan como cintas transportadoras
 * Calcula caudal, bifurcaciones de nutrientes y movimiento entre baldosas.
 */

export const DIRECTIONS = {
  N: { dx: 0, dy: -1, opposite: 'S' },
  E: { dx: 1, dy: 0, opposite: 'W' },
  S: { dx: 0, dy: 1, opposite: 'N' },
  W: { dx: -1, dy: 0, opposite: 'E' }
};

export class HyphaSegment {
  constructor(x, y, dir = 'E', tier = 1) {
    this.id = `hypha_${x}_${y}`;
    this.type = 'hypha';
    this.x = x;
    this.y = y;
    this.dir = dir; // Dirección hacia donde fluyen los nutrientes
    this.tier = tier;
    this.maxCapacity = tier === 1 ? 4 : 8; // items simultáneos en el segmento
    this.speed = tier === 1 ? 1.0 : 2.0; // velocidad de avance
    this.items = []; // Array de { id, item, progress: 0..1 }
    this.nextTarget = null;
  }

  canAcceptItem() {
    if (this.items.length >= this.maxCapacity) return false;
    // Si el último item aún está en el inicio (< 0.25), esperamos a que avance
    if (this.items.length > 0) {
      const last = this.items[this.items.length - 1];
      if (last.progress < 0.25) return false;
    }
    return true;
  }

  pushItem(itemId) {
    if (!this.canAcceptItem()) return false;
    this.items.push({
      uid: Math.random().toString(36).substring(2, 9),
      item: itemId,
      progress: 0.0
    });
    return true;
  }

  update(deltaTime, world) {
    const moveAmount = this.speed * deltaTime;
    const targetX = this.x + DIRECTIONS[this.dir].dx;
    const targetY = this.y + DIRECTIONS[this.dir].dy;
    const targetStructure = world.getStructureAt(targetX, targetY);

    for (let i = 0; i < this.items.length; i++) {
      const it = this.items[i];
      it.progress += moveAmount;

      // Si llega al final de la hifa (progress >= 1.0)
      if (it.progress >= 1.0) {
        if (targetStructure) {
          let transferred = false;

          if (targetStructure.type === 'hypha') {
            if (targetStructure.canAcceptItem()) {
              targetStructure.pushItem(it.item);
              transferred = true;
            }
          } else if (targetStructure.type === 'reactor' || targetStructure.type === 'purifier') {
            if (targetStructure.acceptInput(it.item)) {
              transferred = true;
            }
          } else if (targetStructure.type === 'storage') {
            if (targetStructure.store(it.item, 1)) {
              transferred = true;
            }
          }

          if (transferred) {
            this.items.splice(i, 1);
            i--;
          } else {
            // Estructura receptora bloqueada (cuello de botella)
            it.progress = 1.0;
          }
        } else {
          // No hay salida conectada, se acumula al final
          it.progress = 1.0;
        }
      }
    }
  }
}
