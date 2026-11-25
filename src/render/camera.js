/**
 * camera.js - Control de cámara 2D con Pan, Zoom e interpolación suave
 */

export class Camera {
  constructor(canvas) {
    this.canvas = canvas;
    this.x = 0; // Posición de la cámara en coordenadas del mundo
    this.y = 0;
    this.zoom = 1.0;
    this.targetZoom = 1.0;
    this.minZoom = 0.35;
    this.maxZoom = 2.5;
    this.isDragging = false;
    this.lastMouseX = 0;
    this.lastMouseY = 0;
  }

  screenToWorld(screenX, screenY) {
    const rect = this.canvas.getBoundingClientRect();
    const cx = screenX - rect.left - this.canvas.width / 2;
    const cy = screenY - rect.top - this.canvas.height / 2;
    return {
      x: this.x + cx / this.zoom,
      y: this.y + cy / this.zoom
    };
  }

  worldToScreen(worldX, worldY) {
    const screenX = (worldX - this.x) * this.zoom + this.canvas.width / 2;
    const screenY = (worldY - this.y) * this.zoom + this.canvas.height / 2;
    return { x: screenX, y: screenY };
  }

  screenToTile(screenX, screenY, tileSize = 32) {
    const worldPos = this.screenToWorld(screenX, screenY);
    return {
      x: Math.floor(worldPos.x / tileSize),
      y: Math.floor(worldPos.y / tileSize)
    };
  }

  update(deltaTime) {
    // Interpolación suave del zoom
    this.zoom += (this.targetZoom - this.zoom) * Math.min(1.0, deltaTime * 12);
  }

  pan(dx, dy) {
    this.x -= dx / this.zoom;
    this.y -= dy / this.zoom;
  }

  zoomAt(delta, screenX, screenY) {
    const prePos = this.screenToWorld(screenX, screenY);
    const zoomFactor = delta < 0 ? 1.15 : 0.87;
    this.targetZoom = Math.min(this.maxZoom, Math.max(this.minZoom, this.targetZoom * zoomFactor));
    // Reajustar para zoom centrado en el puntero
    const postPos = this.screenToWorld(screenX, screenY);
    this.x += (prePos.x - postPos.x) * 0.5;
    this.y += (prePos.y - postPos.y) * 0.5;
  }
}
