/**
 * Creates test Firebase Auth users + Firestore profiles for PropFix testing.
 * Run with: node scripts/create-test-users.js
 *
 * Creates:
 *   landlord@propfix.test  / Test1234!  role: landlord
 *   caretaker@propfix.test / Test1234!  role: caretaker
 */

const https = require('https');

const API_KEY    = 'AIzaSyBp3uFnbiAkwvTNMhPBH_lVHjx75hMvS3A';
const PROJECT_ID = 'propfix-b29f1';
const FS_BASE    = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

function post(hostname, path, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = https.request({
      hostname, path, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(data) }));
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function patch(url, body) {
  return new Promise((resolve, reject) => {
    const { hostname, pathname } = new URL(url);
    const payload = JSON.stringify(body);
    const req = https.request({
      hostname, path: pathname, method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(data) }));
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function createAuthUser(email, password) {
  const res = await post(
    'identitytoolkit.googleapis.com',
    `/v1/accounts:signUp?key=${API_KEY}`,
    { email, password, returnSecureToken: true }
  );
  if (res.body.error) {
    if (res.body.error.message === 'EMAIL_EXISTS') {
      // Sign in instead to get uid
      const signIn = await post(
        'identitytoolkit.googleapis.com',
        `/v1/accounts:signInWithPassword?key=${API_KEY}`,
        { email, password, returnSecureToken: true }
      );
      return { uid: signIn.body.localId, existing: true };
    }
    throw new Error(`Auth error for ${email}: ${res.body.error.message}`);
  }
  return { uid: res.body.localId, existing: false };
}

async function writeFirestoreProfile(uid, fields) {
  const url = `${FS_BASE}/users/${uid}`;
  // Convert plain JS object to Firestore field format
  const firestoreFields = {};
  for (const [k, v] of Object.entries(fields)) {
    if (typeof v === 'string')  firestoreFields[k] = { stringValue: v };
    else if (typeof v === 'boolean') firestoreFields[k] = { booleanValue: v };
    else if (typeof v === 'number')  firestoreFields[k] = { integerValue: String(v) };
    else if (v === null)             firestoreFields[k] = { nullValue: null };
  }
  const res = await patch(url, { fields: firestoreFields });
  return res.status;
}

const USERS = [
  {
    email:    'landlord@propfix.test',
    password: 'Test1234!',
    profile: {
      name:       'David Mwangi',
      email:      'landlord@propfix.test',
      role:       'landlord',
      propertyId: '',
    },
  },
  {
    email:    'manager@propfix.test',
    password: 'Test1234!',
    profile: {
      name:       'Janet Waweru',
      email:      'manager@propfix.test',
      role:       'manager',
      propertyId: 'prop_001',
    },
  },
  {
    email:    'caretaker@propfix.test',
    password: 'Test1234!',
    profile: {
      name:       'Moses Kipchirchir',
      email:      'caretaker@propfix.test',
      role:       'caretaker',
      propertyId: 'prop_001',
    },
  },
];

async function main() {
  console.log('=== PropFix Test User Setup ===\n');

  for (const u of USERS) {
    process.stdout.write(`Creating ${u.email}... `);
    try {
      const { uid, existing } = await createAuthUser(u.email, u.password);
      const fsStatus = await writeFirestoreProfile(uid, { ...u.profile, uid });
      const tag = existing ? '(already existed)' : '(new)';
      console.log(`OK ${tag} — uid: ${uid} — Firestore: HTTP ${fsStatus}`);
    } catch (e) {
      console.log(`FAILED — ${e.message}`);
    }
  }

  console.log('\n=== Credentials ===');
  console.log('  Landlord:  landlord@propfix.test  / Test1234!');
  console.log('  Manager:   manager@propfix.test   / Test1234!');
  console.log('  Caretaker: caretaker@propfix.test / Test1234!');
  console.log('\nLog in as caretaker to submit a quotation, then as landlord to approve it.');
}

main().catch(console.error);
