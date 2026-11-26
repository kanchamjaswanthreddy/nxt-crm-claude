const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const crypto = require('crypto');
const fs = require('fs');

// USAGE: node scripts/bulk-invite.js path/to/agents.csv
// CSV Format expected: name,email,role,uplineEmail
// E.g:
// John Doe,john@test.com,manager,
// Jane Smith,jane@test.com,agent,john@test.com

const AGENCY_ID = 'DEFAULT_AGENCY'; // Replace with actual production agency ID

async function run() {
  const csvFile = process.argv[2];
  if (!csvFile) {
    console.error("Please provide a path to the CSV file.");
    process.exit(1);
  }

  // NOTE: You must export GOOGLE_APPLICATION_CREDENTIALS pointing to the prod service account JSON
  initializeApp();
  const db = getFirestore();
  
  const content = fs.readFileSync(csvFile, 'utf8');
  const lines = content.split('\n').filter(l => l.trim().length > 0);
  
  // Skip header if exists
  let startIndex = 0;
  if (lines[0].toLowerCase().includes('email')) startIndex = 1;

  for (let i = startIndex; i < lines.length; i++) {
    const [name, email, role, uplineEmail] = lines[i].split(',').map(s => s.trim());
    
    if (!email || !name || !role) {
      console.log(`Skipping invalid line: ${lines[i]}`);
      continue;
    }

    try {
      let uplineAgentId = null;
      let hierarchyPath = null;

      if (uplineEmail) {
        // Resolve upline email to an agent ID
        const uplineSnap = await db.collection('agents').where('email', '==', uplineEmail.toLowerCase()).get();
        if (!uplineSnap.empty) {
          const upline = uplineSnap.docs[0];
          uplineAgentId = upline.id;
          hierarchyPath = upline.data().hierarchyPath;
        } else {
          console.warn(`WARNING: Upline ${uplineEmail} not found for ${email}. Assigning as top-level.`);
        }
      }

      const token = crypto.randomBytes(32).toString('hex');
      const inviteRef = db.collection('invites').doc();

      await inviteRef.set({
        agencyId: AGENCY_ID,
        email: email.toLowerCase(),
        name,
        role: role.toLowerCase(),
        uplineAgentId,
        parentHierarchyPath: hierarchyPath,
        token,
        status: 'pending',
        createdAt: FieldValue.serverTimestamp(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      });

      console.log(`✅ Created invite for ${email} (Role: ${role}, Upline: ${uplineEmail || 'None'})`);
      // In a real launch, you might also trigger an email sending service here, or just output the tokens to a CSV to distribute manually.
      
    } catch (err) {
      console.error(`❌ Failed to create invite for ${email}:`, err);
    }
  }

  console.log("Bulk invite process complete.");
  process.exit(0);
}

run();
