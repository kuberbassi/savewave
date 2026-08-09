import type { HistoryEntry } from './types';
const DATABASE = 'savewave'; const STORE = 'history'; const LIMIT = 50;
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => { const request = indexedDB.open(DATABASE, 1); request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'id' }); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
}
export async function addHistory(entry: HistoryEntry): Promise<void> {
  const db = await openDatabase(); const transaction = db.transaction(STORE, 'readwrite'); transaction.objectStore(STORE).put(entry);
  await new Promise<void>((resolve, reject) => { transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error); }); db.close();
  const entries = await listHistory(); if (entries.length > LIMIT) await removeHistory(entries.slice(LIMIT).map(item => item.id));
}
export async function listHistory(): Promise<HistoryEntry[]> {
  const db = await openDatabase(); const request = db.transaction(STORE).objectStore(STORE).getAll();
  const result = await new Promise<HistoryEntry[]>((resolve, reject) => { request.onsuccess = () => resolve(request.result.sort((a, b) => b.timestamp - a.timestamp)); request.onerror = () => reject(request.error); }); db.close(); return result;
}
export async function removeHistory(ids: string[]): Promise<void> { const db = await openDatabase(); const transaction = db.transaction(STORE, 'readwrite'); ids.forEach(id => transaction.objectStore(STORE).delete(id)); await new Promise<void>((resolve, reject) => { transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error); }); db.close(); }
export async function clearHistory(): Promise<void> { const db = await openDatabase(); const transaction = db.transaction(STORE, 'readwrite'); transaction.objectStore(STORE).clear(); await new Promise<void>((resolve, reject) => { transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error); }); db.close(); }
