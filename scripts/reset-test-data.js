/**
 * Resets Firestore test data for PropFix quotation system testing.
 * Run with: node scripts/reset-test-data.js
 *
 * Uses Firestore REST API (project is in test mode — no auth required).
 */

const https = require('https');

const PROJECT_ID = 'propfix-b29f1';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE + path);
    const payload = body ? JSON.stringify(body) : null;
    const req = https.request({
      hostname: url.hostname,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function listDocs(collection) {
  const res = await request('GET', `/${collection}?pageSize=100`);
  return res.body.documents || [];
}

async function deleteDoc(name) {
  // name is the full resource path returned by Firestore
  const path = name.replace(`projects/${PROJECT_ID}/databases/(default)/documents`, '');
  const res = await request('DELETE', path);
  return res.status;
}

async function main() {
  console.log('=== PropFix Test Data Reset ===\n');

  // 1. Delete all quotation documents
  console.log('Fetching quotations...');
  const quotDocs = await listDocs('quotations');
  if (quotDocs.length === 0) {
    console.log('  No quotation documents found — already clean.');
  } else {
    for (const d of quotDocs) {
      const status = await deleteDoc(d.name);
      const id = d.name.split('/').pop();
      console.log(`  Deleted quotation ${id} (HTTP ${status})`);
    }
    console.log(`  Removed ${quotDocs.length} quotation(s).`);
  }

  // 2. List existing users collection to see what we have
  console.log('\nFetching user profiles...');
  const userDocs = await listDocs('users');
  if (userDocs.length === 0) {
    console.log('  No user profiles found in Firestore yet.');
    console.log('  Users need to register through the app to get a profile.');
  } else {
    console.log('  Existing users:');
    for (const d of userDocs) {
      const fields = d.fields || {};
      const name = fields.name?.stringValue || '(no name)';
      const email = fields.email?.stringValue || '(no email)';
      const role = fields.role?.stringValue || '(no role)';
      const propId = fields.propertyId?.stringValue || '(none)';
      console.log(`    - ${name} | ${email} | role: ${role} | propertyId: ${propId}`);
    }
  }

  // 3. List properties
  console.log('\nFetching properties...');
  const propDocs = await listDocs('properties');
  if (propDocs.length === 0) {
    console.log('  No properties found.');
  } else {
    console.log('  Properties:');
    for (const d of propDocs) {
      const f = d.fields || {};
      const name = f.name?.stringValue || '(no name)';
      const id = d.name.split('/').pop();
      console.log(`    - ${name} (id: ${id})`);
    }
  }

  console.log('\nDone. Quotations cleared. Ready for fresh test run.');
}

main().catch(console.error);
