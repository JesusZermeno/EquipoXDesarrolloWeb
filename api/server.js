// /api/server.js
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

/* -------------------- util -------------------- */
function readJsonFile(relativePath) {
  const url = new URL(relativePath, import.meta.url);
  return JSON.parse(fs.readFileSync(url));
}

/* -------------------- Firebase Admin: MI-APP-VANILLA (auth / users) -------------------- */
/**
 * En producción (Render):
 *   - usar variable de entorno VANILLA_SERVICE_ACCOUNT_JSON con el JSON completo.
 * En local:
 *   - usa el archivo ./serviceAccountKey.json
 */
let vanillaServiceAccount;

if (process.env.VANILLA_SERVICE_ACCOUNT_JSON) {
  try {
    vanillaServiceAccount = JSON.parse(process.env.VANILLA_SERVICE_ACCOUNT_JSON);
  } catch (e) {
    console.error('[Vanilla] Error parseando VANILLA_SERVICE_ACCOUNT_JSON:', e);
    process.exit(1);
  }
} else {
  // Desarrollo local
  vanillaServiceAccount = readJsonFile('./serviceAccountKey.json');
}

admin.initializeApp({
  credential: admin.credential.cert(vanillaServiceAccount),
});
const vanillaDb = admin.firestore();

/* -------------------- Firebase Admin secundario: SUNTEC (devices) -------------------- */
/**
 * En producción (Render):
 *   - usar variable de entorno SUNTEC_SERVICE_ACCOUNT_JSON con el JSON completo.
 * En local:
 *   - usa el archivo ./keys/suntec-service-account.json
 *     (o el path indicado en SUNTEC_SERVICE_ACCOUNT)
 */
let sunTecApp = null;
let sunTecDb  = null;

try {
  let suntecServiceAccount;

  if (process.env.SUNTEC_SERVICE_ACCOUNT_JSON) {
    try {
      suntecServiceAccount = JSON.parse(process.env.SUNTEC_SERVICE_ACCOUNT_JSON);
    } catch (e) {
      console.error('[SunTec] Error parseando SUNTEC_SERVICE_ACCOUNT_JSON:', e);
      throw e;
    }
  } else {
    const suntecSaPath = process.env.SUNTEC_SERVICE_ACCOUNT || './keys/suntec-service-account.json';
    suntecServiceAccount = readJsonFile(suntecSaPath);
  }

  sunTecApp = admin.initializeApp(
    {
      credential: admin.credential.cert(suntecServiceAccount),
      projectId: process.env.SUNTEC_PROJECT_ID || suntecServiceAccount.project_id,
    },
    'suntec'
  );
  sunTecDb = sunTecApp.firestore();
  console.log('[SunTec] Firestore listo para devices.');
} catch (e) {
  console.warn('[SunTec] No se pudo inicializar:', e?.message || e);
}

function getSunTecDb() {
  if (!sunTecDb) {
    throw new Error('SunTec DB no inicializada. Revisa SUNTEC_SERVICE_ACCOUNT_JSON / SUNTEC_SERVICE_ACCOUNT / SUNTEC_PROJECT_ID.');
  }
  return sunTecDb;
}

/* -------------------- Auth Guard (verifica ID Token de mi-app-vanilla) -------------------- */
async function authGuard(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const headerToken = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null;
    const queryToken  = req.query.token ? String(req.query.token) : null;
    const token = headerToken || queryToken;

    if (!token) return res.status(401).json({ error: 'No token provided' });

    const decoded = await admin.auth().verifyIdToken(token);
    req.user = decoded;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/* -------------------- Auth & Users (mi-app-vanilla) -------------------- */
// Registro
app.post('/auth/register', async (req, res) => {
  try {
    const { email, password, displayName = '', nombre, apellidoP, apellidoM, fechaNac, telefono } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email y password son requeridos' });

    const user = await admin.auth().createUser({ email, password, displayName });
    await vanillaDb.collection('users').doc(user.uid).set({
      email,
      displayName,
      nombre: nombre || '',
      apellidoP: apellidoP || '',
      apellidoM: apellidoM || '',
      fechaNac: fechaNac || '',
      telefono: telefono || '',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({ uid: user.uid, email });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Login (REST con FIREBASE_API_KEY de mi-app-vanilla)
app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email y password son requeridos' });

    const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${process.env.FIREBASE_API_KEY}`;
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: data.error?.message || 'Login failed' });

    res.json({
      idToken: data.idToken,
      refreshToken: data.refreshToken,
      uid: data.localId,
      expiresIn: data.expiresIn,
    });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Perfil
app.get('/me', authGuard, async (req, res) => {
  try {
    const uid = req.user.uid;
    const doc = await vanillaDb.collection('users').doc(uid).get();
    const profile = doc.exists ? doc.data() : {};
    res.json({ uid, email: req.user.email, profile });
  } catch {
    res.status(500).json({ error: 'Error leyendo perfil' });
  }
});

/* -------------------- Devices (SunTec): REST -------------------- */
// Último state
app.get('/devices/:deviceId/state/last', authGuard, async (req, res) => {
  try {
    const { deviceId } = req.params;
    const db = getSunTecDb();

    const snap = await db
      .collection('devices').doc(deviceId)
      .collection('state')
      .orderBy('ts', 'desc')
      .limit(1)
      .get();

    if (snap.empty) return res.status(404).json({ error: 'Sin lecturas de state.' });

    const d = snap.docs[0].data();
    res.json({
      estado: d.estado ?? null,
      nivel: d.nivel ?? null,
      valor: d.valor ?? null,
      ts: d.ts?.toMillis ? d.ts.toMillis() : d.ts ?? null,
    });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Error leyendo último state' });
  }
});

// Listado por rango
app.get('/devices/:deviceId/state', authGuard, async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { from, to, limit = 50 } = req.query;
    const db = getSunTecDb();

    let q = db.collection('devices').doc(deviceId).collection('state').orderBy('ts', 'desc');
    if (from) q = q.where('ts', '>=', new Date(Number(from)));
    if (to) q = q.where('ts', '<=', new Date(Number(to)));

    const snap = await q.limit(Number(limit)).get();
    const items = snap.docs.map((doc) => {
      const x = doc.data();
      return {
        id: doc.id,
        estado: x.estado ?? null,
        nivel: x.nivel ?? null,
        valor: x.valor ?? null,
        ts: x.ts?.toMillis ? x.ts.toMillis() : x.ts ?? null,
      };
    });
    res.json({ deviceId, count: items.length, items });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Error listando state' });
  }
});

/* -------------------- Devices (SunTec): SSE tiempo real -------------------- */
app.get('/devices/:deviceId/state/stream', async (req, res) => {
  try {
    // auth (query ?token=... o header Authorization)
    const authHeader = req.headers.authorization || '';
    const headerToken = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null;
    const idToken = String(req.query.token || headerToken || '');
    if (!idToken) return res.status(401).end();
    await admin.auth().verifyIdToken(idToken);

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    // keep-alive cada 25s
    const ping = setInterval(() => {
      if (!res.writableEnded) res.write(': keep-alive\n\n');
    }, 25000);

    const { deviceId } = req.params;
    const db = getSunTecDb();

    const unsub = db
      .collection('devices').doc(deviceId)
      .collection('state')
      .orderBy('ts', 'desc')
      .limit(1)
      .onSnapshot(
        (snap) => {
          if (snap.empty) return;
          const d = snap.docs[0].data();
          const payload = {
            estado: d.estado ?? null,
            nivel: d.nivel ?? null,
            valor: d.valor ?? null,
            ts: d.ts?.toMillis ? d.ts.toMillis() : d.ts ?? null,
          };
          res.write(`data: ${JSON.stringify(payload)}\n\n`);
        },
        (err) => {
          res.write(`event: error\ndata: ${JSON.stringify({ error: err.message })}\n\n`);
        }
      );

    req.on('close', () => {
      clearInterval(ping);
      try { unsub(); } catch {}
      res.end();
    });
  } catch {
    res.status(401).json({ error: 'Unauthorized' });
  }
});

/* -------------------- Servir el FRONT -------------------- */
// Sirve /public tanto en /public como en raíz
app.use('/public', express.static(PUBLIC_DIR, { maxAge: '1h', etag: true }));
app.use(express.static(PUBLIC_DIR, { maxAge: '1h', etag: true }));

// index
app.get('/', (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

/* -------------------- Health -------------------- */
app.get('/health', (_req, res) => {
  res.json({ ok: true, vanillaAuth: true, sunTecReady: !!sunTecDb });
});

/* -------------------- Init -------------------- */
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`API escuchando en http://localhost:${port}`));
