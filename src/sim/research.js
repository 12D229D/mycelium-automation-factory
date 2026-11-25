/**
 * research.js - Gestión del árbol tecnológico micelial
 * Permite desbloquear tecnologías consumiendo productos de la fábrica.
 */

export class ResearchManager {
  constructor(techData) {
    this.technologies = techData.technologies || [];
    this.techMap = new Map(this.technologies.map(t => [t.id, t]));
    this.unlockedTech = new Set();
    this.researchProgress = new Map(); // id -> { [item]: currentCount }
  }

  isUnlocked(techId) {
    return this.unlockedTech.has(techId);
  }

  canResearch(techId) {
    if (this.isUnlocked(techId)) return false;
    const tech = this.techMap.get(techId);
    if (!tech) return false;

    // Verificar prerrequisitos
    for (const req of tech.requires) {
      if (!this.unlockedTech.has(req)) {
        return false;
      }
    }
    return true;
  }

  getTech(techId) {
    return this.techMap.get(techId);
  }

  getAllTechnologies() {
    return this.technologies.map(tech => ({
      ...tech,
      unlocked: this.isUnlocked(tech.id),
      available: this.canResearch(tech.id),
      progress: this.getProgress(tech.id)
    }));
  }

  getProgress(techId) {
    const tech = this.techMap.get(techId);
    if (!tech) return 0;
    if (this.isUnlocked(techId)) return 1.0;

    const prog = this.researchProgress.get(techId) || {};
    let totalReq = 0;
    let totalDone = 0;

    for (const [item, qty] of Object.entries(tech.cost)) {
      totalReq += qty;
      totalDone += Math.min(qty, prog[item] || 0);
    }

    return totalReq > 0 ? totalDone / totalReq : 0;
  }

  contributeResearch(techId, availableInventory) {
    if (!this.canResearch(techId)) return { success: false, reason: 'Prerequisitos pendientes o ya investigado' };
    const tech = this.techMap.get(techId);

    // Verificar si el inventario tiene los recursos requeridos
    for (const [item, qty] of Object.entries(tech.cost)) {
      if ((availableInventory[item] || 0) < qty) {
        return { success: false, reason: `Insuficiente ${item}: requiere ${qty}` };
      }
    }

    // Consumir
    for (const [item, qty] of Object.entries(tech.cost)) {
      availableInventory[item] -= qty;
    }

    this.unlockedTech.add(techId);
    return { success: true, tech };
  }

  // Carga de estado desde persistencia SQLite / LocalStorage
  loadState(unlockedIds = []) {
    this.unlockedTech = new Set(unlockedIds);
  }

  getState() {
    return Array.from(this.unlockedTech);
  }
}
