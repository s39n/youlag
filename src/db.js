
/**
 * IndexedDB wrapper for caching
 * Primarily for storing dearrow data, to reduce API calls.
 * 
 * Note: This is a simple wrapper and does not include features like versioning, multiple object stores, etc.
 *
 * Usage:
 *   await dbSet('dearrow', videoId, data); // Store data for a videoId
 *   await dbGet('dearrow', videoId);       // Retrieve data for a videoId
 *
 * All data is stored in the 'youlag-cache' database.
 */

function dbOpen(dbName, storeName) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 1);
    request.onupgradeneeded = function (event) {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(storeName)) {
        db.createObjectStore(storeName);
      }
    };
    request.onsuccess = function (event) {
      resolve(event.target.result);
    };
    request.onerror = function (event) {
      reject(event.target.error);
    };
  });
}

async function dbSet(storeName, key, value) {
  const db = await dbOpen('youlag-cache', storeName);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.put(value, key);
    req.onsuccess = () => resolve();
    req.onerror = (e) => reject(e);
  });
}

async function dbGet(storeName, key) {
  const db = await dbOpen('youlag-cache', storeName);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = (e) => reject(e);
  });
}
