/**
 * One-time script to backfill NXT IDs for existing agents.
 *
 * Usage:
 *   node --env-file=.env.local scripts/backfill-nxt-ids.js
 *
 * Assigns:
 *   Shiv Thakur  → NXT0001
 *   Jaswa        → NXT0002
 *   Sony Pradhan → NXT0003
 *
 * Also sets the counter document to 3 so the next auto-assigned ID is NXT0004.
 */

const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const formatPrivateKey = (key) => key ? key.replace(/\\n/g, '\n') : undefined;

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: formatPrivateKey(process.env.FIREBASE_PRIVATE_KEY),
    }),
  });
}

const db = getFirestore();

// Map: full_name substring → NXT ID
const ASSIGNMENTS = [
  { nameMatch: 'shiv', nxtId: 'NXT0001' },
  { nameMatch: 'jaswa', nxtId: 'NXT0002' },
  { nameMatch: 'sony', nxtId: 'NXT0003' },
];

async function backfill() {
  const snap = await db.collection('agents').get();
  const batch = db.batch();
  let assigned = 0;

  snap.forEach((doc) => {
    const data = doc.data();
    const name = (data.full_name || '').toLowerCase();
    const match = ASSIGNMENTS.find((a) => name.includes(a.nameMatch));
    if (match) {
      console.log(`  ${match.nxtId} → ${data.full_name} (${doc.id})`);
      batch.update(doc.ref, { nxt_id: match.nxtId });
      assigned++;
    }
  });

  // Set counter to 3
  const counterRef = db.collection('counters').doc('nxt_id_counter');
  batch.set(counterRef, { current: 3 }, { merge: true });

  if (assigned === 0) {
    console.log('No matching agents found. Check names in Firestore.');
    return;
  }

  await batch.commit();
  console.log(`\nDone. Assigned ${assigned} NXT IDs. Counter set to 3.`);
  console.log('Next auto-assigned ID will be NXT0004.');
}

backfill().catch(console.error);
