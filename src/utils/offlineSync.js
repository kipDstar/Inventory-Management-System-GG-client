// src/utils/offlineSync.js
// Offline-first sync utility (stub)

// Queue for offline actions
let queue = [];

export function queueAction(action) {
  queue.push(action);
  saveQueue();
}

export function getQueue() {
  return queue;
}

export function clearQueue() {
  queue = [];
  saveQueue();
}

function saveQueue() {
  localStorage.setItem('offlineQueue', JSON.stringify(queue));
}

export function loadQueue() {
  const q = localStorage.getItem('offlineQueue');
  if (q) queue = JSON.parse(q);
}

export async function trySync(api) {
  loadQueue();
  for (const action of queue) {
    try {
      await api(action);
      queue = queue.filter(a => a !== action);
      saveQueue();
    } catch (e) {
      // Still offline or failed
      break;
    }
  }
}
