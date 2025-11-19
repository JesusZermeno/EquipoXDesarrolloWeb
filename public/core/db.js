// IndexedDB para SunTec (lecturas de devices y KV simple)

const DB_NAME = 'suntec-db';
const DB_VERSION = 1;

let _dbPromise = null;

export function initDB() {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (ev) => {
      const db = ev.target.result;

      // KV genérico (para flags/ajustes)
      if (!db.objectStoreNames.contains('kv')) {
        db.createObjectStore('kv', { keyPath: 'key' });
      }

      // Lecturas de dispositivos
      if (!db.objectStoreNames.contains('state')) {
        const os = db.createObjectStore('state', { keyPath: 'id', autoIncrement: true });
        // Búsquedas por device + timestamp
        os.createIndex('device_ts', ['deviceId', 'ts'], { unique: false });
        // Búsquedas por device + día (YYYYMMDD)
        os.createIndex('device_day', ['deviceId', 'day'], { unique: false });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return _dbPromise;
}

/* ================= KV simple ================= */

export async function kvSet(key, value) {
  const db = await initDB();
  return txWrap(db, 'kv', 'readwrite', (store) => store.put({ key, value }));
}
export async function kvGet(key) {
  const db = await initDB();
  return txWrap(db, 'kv', 'readonly', (store) => store.get(key))
    .then(rec => (rec ? rec.value : undefined));
}
export async function kvDel(key) {
  const db = await initDB();
  return txWrap(db, 'kv', 'readwrite', (store) => store.delete(key));
}

/* ================= State (lecturas) ================= */

function yyyymmdd(ms) {
  const d = new Date(ms);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}${m}${day}`;
}

/**
 * Guarda UNA lectura.
 * @param {{deviceId:string, ts:number, valor:number, nivel:number, estado:any}} rec
 */
export async function addState(rec) {
  const db = await initDB();
  const row = {
    deviceId: rec.deviceId,
    ts: Number(rec.ts),
    day: yyyymmdd(rec.ts),
    valor: Number(rec.valor ?? 0),
    nivel: Number(rec.nivel ?? 0),
    estado: rec.estado
  };
  return txWrap(db, 'state', 'readwrite', (store) => store.add(row));
}

/**
 * Guarda VARIAS lecturas de golpe.
 * @param {Array<{deviceId:string, ts:number, valor:number, nivel:number, estado:any}>} rows
 */
export async function addStatesBulk(rows = []) {
  if (!rows.length) return;
  const db = await initDB();
  return txWrap(db, 'state', 'readwrite', (store) => {
    for (const r of rows) {
      const row = {
        deviceId: r.deviceId,
        ts: Number(r.ts),
        day: yyyymmdd(r.ts),
        valor: Number(r.valor ?? 0),
        nivel: Number(r.nivel ?? 0),
        estado: r.estado
      };
      store.add(row);
    }
  });
}

/**
 * Lee el ÚLTIMO registro de un device (para fallback de KPIs).
 * @returns Promise<{id,deviceId,ts,day,valor,nivel,estado}|undefined>
 */
export async function getLastState(deviceId) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('state', 'readonly');
    const store = tx.objectStore('state');
    const idx = store.index('device_ts');

    // Bound abierto por arriba y avanzamos en 'prev' para traer el último
    const upper = [deviceId, Number.MAX_SAFE_INTEGER];
    const lower = [deviceId, -1];
    const range = IDBKeyRange.bound(lower, upper);

    const req = idx.openCursor(range, 'prev');
    req.onsuccess = () => {
      const cur = req.result;
      resolve(cur ? cur.value : undefined);
    };
    req.onerror = () => reject(req.error);
  });
}

/**
 * Lee por rango de fechas (ts en ms) usando índice device_ts.
 * @returns Promise<Array<{id,deviceId,ts,day,valor,nivel,estado}>>
 */
export async function getStatesByRange(deviceId, fromMs, toMs, limit = 1000) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('state', 'readonly');
    const store = tx.objectStore('state');
    const idx = store.index('device_ts');

    const range = IDBKeyRange.bound([deviceId, Number(fromMs)], [deviceId, Number(toMs)]);
    const req = idx.openCursor(range, 'next');
    const out = [];

    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor && out.length < limit) {
        out.push(cursor.value);
        cursor.continue();
      } else {
        resolve(out);
      }
    };
    req.onerror = () => reject(req.error);
  });
}

/**
 * Borra lecturas anteriores a cierta fecha (mantenimiento).
 * @param {Date|number} before
 */
export async function pruneBefore(before) {
  const db = await initDB();
  const cut = Number(before);
  const tx = db.transaction('state', 'readwrite');
  const store = tx.objectStore('state');
  return new Promise((resolve, reject) => {
    const req = store.openCursor();
    req.onsuccess = () => {
      const cur = req.result;
      if (!cur) return resolve(true);
      const val = cur.value;
      if (val.ts < cut) cur.delete();
      cur.continue();
    };
    req.onerror = () => reject(req.error);
  });
}

/* ================ util tx ================ */
function txWrap(db, storeName, mode, fn) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const ret = fn(store);
    tx.oncomplete = () => resolve(ret?.result);
    tx.onerror = () => reject(tx.error || ret?.error);
    tx.onabort = () => reject(tx.error);
  });
}
