import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import admin from 'firebase-admin';
import fs from 'fs';

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// ----- Firebase Admin -----
const serviceAccount = JSON.parse(
  fs.readFileSync(new URL('./serviceAccountKey.json', import.meta.url))
);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// ----- Middleware auth (verifica ID Token) -----
async function authGuard(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice('Bearer '.length)
      : null;
    if (!token) return res.status(401).json({ error: 'No token provided' });

    const decoded = await admin.auth().verifyIdToken(token);
    req.user = decoded; // uid, email
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// ----- Registro -----
app.post('/auth/register', async (req, res) => {
  try {
    const {
      email, password, displayName = '',
      nombre, apellidoP, apellidoM, fechaNac, telefono
    } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'email y password son requeridos' });
    }

    const user = await admin.auth().createUser({ email, password, displayName });
    await db.collection('users').doc(user.uid).set({
      email,
      displayName,
      nombre: nombre || '',
      apellidoP: apellidoP || '',
      apellidoM: apellidoM || '',
      fechaNac: fechaNac || '',
      telefono: telefono || '',
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.json({ uid: user.uid, email });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ----- Login (REST Firebase) -----
app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'email y password son requeridos' });

    const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${process.env.FIREBASE_API_KEY}`;
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true })
    });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: data.error?.message || 'Login failed' });

    res.json({
      idToken: data.idToken,
      refreshToken: data.refreshToken,
      uid: data.localId,
      expiresIn: data.expiresIn
    });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// ----- Perfil protegido -----
app.get('/me', authGuard, async (req, res) => {
  try {
    const uid = req.user.uid;
    const doc = await db.collection('users').doc(uid).get();
    const profile = doc.exists ? doc.data() : {};
    res.json({ uid, email: req.user.email, profile });
  } catch {
    res.status(500).json({ error: 'Error leyendo perfil' });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`API escuchando en http://localhost:${port}`));
