/**
 * simWorker.js - Núcleo de simulación a paso fijo (fixed tick loop)
 * Gestiona el cómputo de flujos, avance de reacciones y actualización de estructuras
 * sin bloquear el renderizado ni la interacción de la UI.
 */

self.onmessage = function (e) {
  const { type, payload } = e.data;

  switch (type) {
    case 'INIT':
      initSimulation(payload);
      break;
    case 'TICK':
      stepSimulation(payload.deltaTime);
      break;
    case 'ADD_STRUCTURE':
      // Comando para agregar estructura
      self.postMessage({ type: 'STRUCTURE_ADDED', payload });
      break;
  }
};

let tickCount = 0;
function initSimulation(config) {
  tickCount = 0;
  self.postMessage({ type: 'READY', payload: { status: 'initialized' } });
}

function stepSimulation(dt) {
  tickCount++;
  // Responde con pulso de confirmación de tick procesado
  self.postMessage({
    type: 'TICK_COMPLETED',
    payload: {
      tick: tickCount,
      dt
    }
  });
}
