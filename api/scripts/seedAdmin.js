// api/scripts/seedAdmin.js
import 'dotenv/config';
import admin from 'firebase-admin';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

// Paths base
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// Carga service account del proyecto *mi-app-vanilla* (el mismo de auth)
const saPath = path.join(__dirname, '..', 'serviceAccountKey.json');
if (!fs.existsSync(saPath)) {
  console.error(`[seedAdmin] No existe ${saPath}. Asegúrate de colocar ahí tu serviceAccountKey.json`);
  process.exit(1);
}
const serviceAccount = JSON.parse(fs.readFileSync(saPath, 'utf8'));

// Inicializa Admin SDK
if (admin.apps.length === 0) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

// Lee credenciales desde .env (o usa defaults)
const ADMIN_EMAIL    = process.env.ADMIN_EMAIL    || 'admin@suntec.mx';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin123*';
const DISPLAY_NAME   = process.env.ADMIN_NAME     || 'SunTec Admin';

async function ensureAdmin() {
  try {
    // 1) Obtiene o crea el usuario
    let userRecord;
    try {
      userRecord = await admin.auth().getUserByEmail(ADMIN_EMAIL);
      console.log(`[seedAdmin] Usuario encontrado: ${userRecord.uid}`);
    } catch (e) {
      if (e?.errorInfo?.code === 'auth/user-not-found') {
        userRecord = await admin.auth().createUser({
          email: ADMIN_EMAIL,
          password: ADMIN_PASSWORD,
          displayName: DISPLAY_NAME,
          emailVerified: true,
        });
        console.log(`[seedAdmin] Usuario creado: ${userRecord.uid}`);
      } else {
        throw e;
      }
    }

    // 2) Configura custom claims
    await admin.auth().setCustomUserClaims(userRecord.uid, { role: 'admin' });
    console.log('[seedAdmin] Custom claims role=admin asignado');

    // 3) Guarda/actualiza espejo en Firestore
    await db.collection('users').doc(userRecord.uid).set(
      {
        email: ADMIN_EMAIL,
        displayName: userRecord.displayName || DISPLAY_NAME,
        role: 'admin',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    console.log('[seedAdmin] Firestore users/{uid} actualizado con role=admin');

    console.log('\n✅ Listo. Admin seed completado.\n');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Error en seedAdmin:', err);
    process.exit(1);
  }
}

ensureAdmin();
