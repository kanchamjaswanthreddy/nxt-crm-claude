/**
 * Script to create Licensing Materials entries in Firestore.
 * PDFs need to be uploaded separately through Firebase Console or CRM UI.
 *
 * Usage: node scripts/upload-licensing-materials.mjs
 */

import { readFileSync } from 'fs';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

// Load .env.local manually — handles multi-line quoted values (e.g. PEM keys)
const envContent = readFileSync('.env.local', 'utf-8');
const envLines = envContent.split('\n');
let idx = 0;
while (idx < envLines.length) {
  const line = envLines[idx].trim();
  idx++;
  if (!line || line.startsWith('#')) continue;
  const eqIdx = line.indexOf('=');
  if (eqIdx === -1) continue;
  const key = line.slice(0, eqIdx).trim();
  let val = line.slice(eqIdx + 1);
  const trimVal = val.trim();
  if (trimVal.startsWith('"')) {
    val = trimVal.slice(1);
    if (val.endsWith('"')) {
      val = val.slice(0, -1);
    } else {
      const parts = [val];
      while (idx < envLines.length) {
        const nextLine = envLines[idx];
        idx++;
        if (nextLine.trimEnd().endsWith('"')) {
          parts.push(nextLine.trimEnd().slice(0, -1));
          break;
        }
        parts.push(nextLine);
      }
      val = parts.join('\n');
    }
  } else if (trimVal.startsWith("'")) {
    val = trimVal.slice(1);
    if (val.endsWith("'")) val = val.slice(0, -1);
  } else {
    val = trimVal;
  }
  if (!process.env[key]) process.env[key] = val;
}

const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey,
    }),
  });
}

const db = getFirestore();

const MATERIALS = [
  { fileName: 'ExamFX Claire AI One-Sheet.pdf', title: 'ExamFX Claire AI — One-Sheet Overview' },
  { fileName: 'ExamFX_Live Online Training.pdf', title: 'ExamFX Live Online Training Guide' },
  { fileName: 'ExamFX_Manager Tracking_CW.pdf', title: 'ExamFX Manager Tracking (CW)' },
  { fileName: 'ExamFX_Readiness Exam_CW.pdf', title: 'ExamFX Readiness Exam (CW)' },
  { fileName: 'L&H_10-Day_Pro-PSI_NonReq - 2-course states.pdf', title: 'Life & Health 10-Day Pro-PSI (2-Course States)' },
  { fileName: 'Life_5-Day_Pro-PSI_NonReq.pdf', title: 'Life Insurance 5-Day Pro-PSI (Non-Required)' },
  { fileName: 'Recommended Study Steps_Insurance.pdf', title: 'Recommended Study Steps for Insurance Licensing' },
];

async function getAgencyId() {
  const snap = await db.collection('agencies').limit(1).get();
  if (!snap.empty) return snap.docs[0].id;
  return 'nxt-financial-group';
}

async function main() {
  const agencyId = await getAgencyId();
  console.log(`Using agency ID: ${agencyId}\n`);

  // Check for existing licensing resources to avoid duplicates
  const existing = await db.collection('learningResources')
    .where('agencyId', '==', agencyId)
    .where('category', '==', 'licensing')
    .get();

  if (!existing.empty) {
    console.log(`Found ${existing.size} existing licensing resources. Skipping to avoid duplicates.`);
    console.log('Delete them first if you want to re-run this script.');
    return;
  }

  for (let i = 0; i < MATERIALS.length; i++) {
    const { fileName, title } = MATERIALS[i];
    console.log(`[${i + 1}/${MATERIALS.length}] Creating: ${title}`);

    await db.collection('learningResources').add({
      agencyId,
      title,
      description: `Licensing preparation material: ${title}`,
      category: 'licensing',
      contentType: 'pdf',
      url: '#pending-upload',
      fileName,
      thumbnailUrl: null,
      sortOrder: i + 1,
      requiredForOnboarding: false,
      createdBy: 'system',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    console.log(`   ✓ Created: ${title}`);
  }

  console.log(`\nDone! ${MATERIALS.length} licensing material entries created in NXT Academy.`);
  console.log('\nNote: PDF files need to be uploaded through Firebase Console Storage');
  console.log('or through the CRM document upload UI. Update the URLs after uploading.');
}

main().catch(console.error);
