import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const PROD_KEY_PATH = path.join(ROOT_DIR, 'scripts', 'keys', 'prod.json');
const QA_KEY_PATH = path.join(ROOT_DIR, 'scripts', 'keys', 'qa.json');

const PROD_PROJECT_ID = 'gen-lang-client-0187524364';
const PROD_DATABASE_ID = 'ai-studio-7acfc9af-7e0a-4798-8750-8aa5612b35a9';
const QA_PROJECT_ID = 'finapp-qa';

const TARGET_ADMIN_EMAIL = 'alejandroromerobaier@gmail.com';

const COLLECTIONS = [
  'users',
  'categories',
  'projects',
  'cards',
  'budgets',
  'shortcuts',
  'notifications',
  'transactions',
];

function checkKeyFiles() {
  const missing = [];
  if (!fs.existsSync(PROD_KEY_PATH)) missing.push(PROD_KEY_PATH);
  if (!fs.existsSync(QA_KEY_PATH)) missing.push(QA_KEY_PATH);

  if (missing.length > 0) {
    console.error('\n❌ Faltan las credenciales de Cuenta de Servicio (Service Account):\n');
    if (!fs.existsSync(PROD_KEY_PATH)) {
      console.error(`  1. Descargá la clave de Producción (solo lectura):`);
      console.error(`     https://console.firebase.google.com/project/${PROD_PROJECT_ID}/settings/serviceaccounts/adminsdk`);
      console.error(`     -> Guardala en: scripts/keys/prod.json\n`);
    }
    if (!fs.existsSync(QA_KEY_PATH)) {
      console.error(`  2. Descargá la clave de QA (escritura destino):`);
      console.error(`     https://console.firebase.google.com/project/${QA_PROJECT_ID}/settings/serviceaccounts/adminsdk`);
      console.error(`     -> Guardala en: scripts/keys/qa.json\n`);
    }
    console.error('ℹ️  La carpeta scripts/keys/ ya está protegida en .gitignore para que nunca se suba a GitHub.\n');
    process.exit(1);
  }
}

async function deleteCollectionInBatches(db, collectionName) {
  const colRef = db.collection(collectionName);
  let deletedCount = 0;

  while (true) {
    const snapshot = await colRef.limit(400).get();
    if (snapshot.empty) break;

    const batch = db.batch();
    for (const docSnap of snapshot.docs) {
      batch.delete(docSnap.ref);
    }
    await batch.commit();
    deletedCount += snapshot.size;
  }

  return deletedCount;
}

async function copyCollectionInBatches(prodDb, qaDb, collectionName) {
  const snapshot = await prodDb.collection(collectionName).get();
  if (snapshot.empty) return 0;

  let copiedCount = 0;
  let batch = qaDb.batch();
  let opsInBatch = 0;

  for (const docSnap of snapshot.docs) {
    const destRef = qaDb.collection(collectionName).doc(docSnap.id);
    batch.set(destRef, docSnap.data());
    opsInBatch++;
    copiedCount++;

    if (opsInBatch >= 400) {
      await batch.commit();
      batch = qaDb.batch();
      opsInBatch = 0;
    }
  }

  if (opsInBatch > 0) {
    await batch.commit();
  }

  return copiedCount;
}

async function syncAdminAuthUser(prodAuth, qaAuth) {
  console.log(`\n🔐 Sincronizando usuario administrador (${TARGET_ADMIN_EMAIL}) en Firebase Auth de QA...`);
  try {
    const prodUser = await prodAuth.getUserByEmail(TARGET_ADMIN_EMAIL);

    try {
      const existingQaUser = await qaAuth.getUser(prodUser.uid);
      console.log(`   ✅ El usuario ya existe en QA Auth con el UID exacto: ${existingQaUser.uid}`);
      return;
    } catch (err) {
      if (err.code !== 'auth/user-not-found') {
        throw err;
      }
    }

    // Check if an account with the same email exists under a different UID in QA
    try {
      const oldQaUser = await qaAuth.getUserByEmail(TARGET_ADMIN_EMAIL);
      if (oldQaUser.uid !== prodUser.uid) {
        console.log(`   ⚠️ Eliminando cuenta previa en QA con UID distinto (${oldQaUser.uid}) para alinear UID...`);
        await qaAuth.deleteUser(oldQaUser.uid);
      }
    } catch (err) {
      if (err.code !== 'auth/user-not-found') throw err;
    }

    await qaAuth.importUsers([
      {
        uid: prodUser.uid,
        email: prodUser.email,
        emailVerified: prodUser.emailVerified,
        displayName: prodUser.displayName,
        photoURL: prodUser.photoURL,
        providerData: prodUser.providerData.map((p) => ({
          uid: p.uid,
          email: p.email,
          displayName: p.displayName,
          photoURL: p.photoURL,
          providerId: p.providerId,
        })),
      },
    ]);

    console.log(`   ✅ Usuario importado en QA Auth con UID idéntico: ${prodUser.uid}`);
  } catch (err) {
    console.warn(`   ⚠️ No se pudo sincronizar automáticamente en Auth: ${err.message}`);
  }
}

async function main() {
  checkKeyFiles();

  const prodKey = JSON.parse(fs.readFileSync(PROD_KEY_PATH, 'utf8'));
  const qaKey = JSON.parse(fs.readFileSync(QA_KEY_PATH, 'utf8'));

  // Strict security guardrails
  if (prodKey.project_id !== PROD_PROJECT_ID) {
    throw new Error(`El archivo prod.json debe ser de '${PROD_PROJECT_ID}', pero es '${prodKey.project_id}'.`);
  }
  if (qaKey.project_id !== QA_PROJECT_ID) {
    throw new Error(`⛔ BLOQUEO DE SEGURIDAD: Solo se permite escribir en '${QA_PROJECT_ID}', pero qa.json apunta a '${qaKey.project_id}'.`);
  }

  const prodApp = initializeApp({ credential: cert(prodKey) }, 'prod');
  const qaApp = initializeApp({ credential: cert(qaKey) }, 'qa');

  const prodDb = getFirestore(prodApp, PROD_DATABASE_ID);
  const qaDb = getFirestore(qaApp); // (default) in finapp-qa

  const prodAuth = getAuth(prodApp);
  const qaAuth = getAuth(qaApp);

  console.log('\n======================================================');
  console.log('🔄 CLONACIÓN DE BASE DE DATOS: PRODUCCIÓN -> QA');
  console.log(`📖 Origen (Solo Lectura): ${PROD_PROJECT_ID} [${PROD_DATABASE_ID}]`);
  console.log(`📝 Destino (Pisar QA):    ${QA_PROJECT_ID} [(default)]`);
  console.log('======================================================');

  await syncAdminAuthUser(prodAuth, qaAuth);

  console.log('\n📦 Sincronizando colecciones de Firestore...\n');
  let totalCopied = 0;

  for (const col of COLLECTIONS) {
    const deleted = await deleteCollectionInBatches(qaDb, col);
    const copied = await copyCollectionInBatches(prodDb, qaDb, col);
    totalCopied += copied;
    console.log(`   • ${col.padEnd(15)} | Limpiados en QA: ${String(deleted).padStart(4)} | Copiados desde Prod: ${String(copied).padStart(4)}`);
  }

  console.log('\n======================================================');
  console.log(`✅ ¡Clonación completada! Total de documentos copiados: ${totalCopied}`);
  console.log(`🌐 Ya podés probar con tus datos reales en: https://${QA_PROJECT_ID}.web.app`);
  console.log('🛡️  La base de datos de Producción permaneció 100% intacta.');
  console.log('======================================================\n');

  process.exit(0);
}

main().catch((err) => {
  console.error('\n❌ Error durante la sincronización:', err);
  process.exit(1);
});
