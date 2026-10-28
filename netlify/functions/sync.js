// Netlify Serverless Function: Central Bank Data & Client Synchronization Engine
// Ensures seamless, real-time client sync between public web clients and admin consoles

const fs = require('fs');
const path = require('path');
const os = require('os');

// In-memory cache for warm function invocations
let memoryDb = null;

// File path for persistence in container /tmp
const TMP_DATA_FILE = path.join(os.tmpdir(), 'mcb_bank_data.json');

// Default initial verified client baseline
const DEFAULT_USERS = [
  {
    id: "u1",
    name: "Adaeze Okafor",
    email: "adaeze.okafor@crestmail.com",
    accountNumber: "4829104820",
    tier: "basic",
    balance: 0.00,
    status: "active",
    kyc: "verified",
    joined: "Mar 2025",
    profileDetails: {
      name: "Adaeze Okafor",
      country: "US",
      phone: "+1 (555) 382-9012",
      dob: "1992-06-15",
      addr: "1400 Park Ave, Suite 22B",
      city: "New York",
      state: "NY",
      zip: "10017"
    }
  },
  {
    id: "u2",
    name: "Chidi Nwosu",
    email: "chidi.nwosu@crestmail.com",
    accountNumber: "7391049281",
    tier: "premium",
    balance: 0.00,
    status: "active",
    kyc: "verified",
    joined: "Jan 2025"
  },
  {
    id: "u3",
    name: "Maya Kimani",
    email: "maya.kimani@crestmail.com",
    accountNumber: "8192047193",
    tier: "private",
    balance: 0.00,
    status: "active",
    kyc: "verified",
    joined: "Nov 2024"
  },
  {
    id: "u4",
    name: "Tolu Adeyemi",
    email: "tolu.adeyemi@crestmail.com",
    accountNumber: "6281940172",
    tier: "basic",
    balance: 0.00,
    status: "active",
    kyc: "pending",
    target: "premium",
    joined: "Sep 2026",
    kycDetails: {
      name: "Tolu Adeyemi",
      dob: "1988-06-14",
      nat: "United States",
      idType: "Passport",
      idFile: "us_passport_adeyemi.pdf",
      ssnLast4: "6192",
      addrType: "Bank Statement",
      addrFile: "chase_statement_sept2026.pdf",
      submittedAt: "Today · 08:30 AM"
    }
  },
  {
    id: "u5",
    name: "Jonas Berg",
    email: "jonas.berg@crestmail.com",
    accountNumber: "5192840192",
    tier: "basic",
    balance: 0.00,
    status: "frozen",
    kyc: "pending",
    target: "private",
    joined: "Oct 2026",
    kycDetails: {
      name: "Jonas Berg",
      dob: "1984-11-03",
      nat: "Germany",
      idType: "National ID Card",
      idFile: "personalausweis_berg.pdf",
      ssnLast4: "4081",
      addrType: "Utility Bill",
      addrFile: "berlin_energy_bill.pdf",
      submittedAt: "Yesterday · 16:20"
    }
  },
  {
    id: "u6",
    name: "Amina Diallo",
    email: "amina.diallo@crestmail.com",
    accountNumber: "9182736450",
    tier: "premium",
    balance: 0.00,
    status: "active",
    kyc: "pending",
    target: "private",
    joined: "Oct 2026",
    kycDetails: {
      name: "Amina Diallo",
      dob: "1992-03-29",
      nat: "United Kingdom",
      idType: "Driver License",
      idFile: "uk_driving_licence_diallo.pdf",
      ssnLast4: "8835",
      addrType: "Lease Agreement",
      addrFile: "london_tenancy_signed.pdf",
      submittedAt: "Yesterday · 19:45"
    }
  },
  {
    id: "u7",
    name: "Sofia Reyes",
    email: "sofia.reyes@crestmail.com",
    accountNumber: "9953654784",
    tier: "basic",
    balance: 0.00,
    status: "active",
    kyc: "rejected",
    joined: "Aug 2026"
  },
  {
    id: "u_mvqwuow2vace",
    name: "Lord Montgomery Vance",
    email: "m.vance@crestsovereign.com",
    accountNumber: "8503489565",
    tier: "private",
    balance: 500000.00,
    status: "active",
    kyc: "verified",
    joined: "Oct 2026",
    profileDetails: {
      addr: "Executive Suite",
      city: "New York",
      country: "US",
      dob: "1985-05-15",
      name: "Lord Montgomery Vance",
      phone: "+1 (555) 516-7284",
      state: "NY",
      zip: "10001"
    }
  },
  {
    id: "u_mvs6u5hl41wx",
    name: "Sir Julian Sterling",
    email: "julian.sterling@crestvault.ch",
    accountNumber: "9568727400",
    tier: "private",
    balance: 850000.00,
    status: "active",
    kyc: "verified",
    joined: "Oct 2026",
    profileDetails: {
      addr: "Executive Suite",
      city: "New York",
      country: "US",
      dob: "1985-05-15",
      name: "Sir Julian Sterling",
      phone: "+1 (555) 514-8867",
      state: "NY",
      zip: "10001"
    }
  },
  {
    id: "user_3KRpGBa4gpEFYxExRLeFYCKWgzv",
    name: "daniel Hendrick",
    email: "bossdaniels04@gmail.com",
    tier: "basic",
    balance: 0.00,
    status: "active",
    kyc: "verified",
    joined: "Today",
    accountNumber: "7380996608"
  }
];

function loadDatabase() {
  if (memoryDb && Array.isArray(memoryDb.users) && memoryDb.users.length > 0) {
    return memoryDb;
  }

  // 1. Try reading from /tmp persistence
  try {
    if (fs.existsSync(TMP_DATA_FILE)) {
      const raw = fs.readFileSync(TMP_DATA_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.users) && parsed.users.length > 0) {
        memoryDb = parsed;
        return memoryDb;
      }
    }
  } catch (e) {
    console.warn('Could not read /tmp database cache:', e.message);
  }

  // 2. Try reading from bundled bank_data.json
  const candidateFiles = [
    path.join(__dirname, '../../bank_data.json'),
    path.join(__dirname, '../bank_data.json'),
    path.join(__dirname, 'bank_data.json'),
    path.join(process.cwd(), 'bank_data.json')
  ];
  for (const f of candidateFiles) {
    try {
      if (fs.existsSync(f)) {
        const raw = fs.readFileSync(f, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.users) && parsed.users.length > 0) {
          memoryDb = {
            users: parsed.users,
            txs: parsed.txs || [],
            deleted_user_ids: parsed.deleted_user_ids || [],
            last_updated: Date.now()
          };
          saveDatabase(memoryDb);
          return memoryDb;
        }
      }
    } catch(e) {}
  }

  // 3. Fallback to full DEFAULT_USERS baseline
  memoryDb = {
    users: JSON.parse(JSON.stringify(DEFAULT_USERS)),
    txs: [],
    deleted_user_ids: [],
    last_updated: Date.now()
  };

  saveDatabase(memoryDb);
  return memoryDb;
}

function saveDatabase(db) {
  try {
    db.last_updated = Date.now();
    memoryDb = db;
    fs.writeFileSync(TMP_DATA_FILE, JSON.stringify(db, null, 2), 'utf8');
  } catch (e) {
    console.warn('Could not persist /tmp database cache:', e.message);
  }
}

// Telegram dispatch helper
async function dispatchTelegramAlert(htmlText) {
  try {
    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8987826516:AAFx2sNsEOHxUL8m0OKP8w7qpv8yaEMV9oU';
    const CHAT_IDS = process.env.TELEGRAM_ADMIN_CHAT_ID ? [process.env.TELEGRAM_ADMIN_CHAT_ID] : [8828015300, 5038100074];

    if (!BOT_TOKEN || !htmlText) return;

    const sends = CHAT_IDS.map(chatId => {
      return fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: htmlText,
          parse_mode: 'HTML'
        })
      }).catch(err => console.warn('Telegram dispatch error for chat', chatId, err));
    });

    await Promise.all(sends);
  } catch (err) {
    console.warn('Telegram dispatch error:', err.message);
  }
}

function generateAccountNumber(userId, name, seedIndex) {
  const seed = (userId || 'user') + (name || 'client');
  const hash = Math.abs(seed.split('').reduce((acc, ch) => acc * 31 + ch.charCodeAt(0), 10482018 + (seedIndex || 1) * 7919)) % 9000000000 + 1000000000;
  return hash.toString();
}

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const db = loadDatabase();
  const deletedIds = new Set(db.deleted_user_ids || []);

  if (event.httpMethod === 'GET') {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ok: true,
        users: db.users || [],
        txs: db.txs || [],
        deleted_user_ids: Array.from(deletedIds),
        total_users: (db.users || []).length,
        timestamp: Date.now()
      })
    };
  }

  if (event.httpMethod === 'POST') {
    try {
      const payload = JSON.parse(event.body || '{}');
      const action = payload.action || 'sync_users';
      let stateChanged = false;

      // Handle user deletion
      if (action === 'delete_user') {
        const delId = payload.userId || (payload.user && payload.user.id);
        if (delId) {
          deletedIds.add(delId);
          db.deleted_user_ids = Array.from(deletedIds);
          db.users = db.users.filter(u => u.id !== delId && u.accountNumber !== delId);
          db.txs = (db.txs || []).filter(t => t.userId !== delId);
          stateChanged = true;
        }
      }

      // Handle registration of new client
      if (action === 'register_user' && payload.user) {
        const nu = payload.user;
        if (nu) {
          if (!nu.id) {
            nu.id = 'u_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
          }
          if (!deletedIds.has(nu.id)) {
            // Normalize and validate
            if (!nu.accountNumber) {
              nu.accountNumber = generateAccountNumber(nu.id, nu.name, db.users.length);
            }
            if (nu.balance === undefined || nu.balance === null) nu.balance = 0.00;
            if (!nu.status) nu.status = 'active';
            if (!nu.kyc) nu.kyc = 'verified';
            if (!nu.tier) nu.tier = 'basic';
            if (!nu.joined) nu.joined = 'Today';

            const existingIdx = db.users.findIndex(u => u.id === nu.id || (u.email && nu.email && u.email.toLowerCase() === nu.email.toLowerCase()));
            if (existingIdx >= 0) {
              // Update existing record, preserve existing non-zero balance and KYC if higher
              db.users[existingIdx] = Object.assign({}, db.users[existingIdx], nu);
            } else {
              db.users.push(nu);
              console.log(`[SYNC] Registered new client: ${nu.name} (${nu.id})`);

              // Send Telegram notice if requested or alert not yet sent
              if (payload.sendAlert !== false) {
                const regAlert = `🏛️ <b>NEW CLIENT REGISTERED</b>\n\n<b>Client:</b> ${nu.name}\n<b>Email:</b> ${nu.email || 'N/A'}\n<b>Account Number:</b> <code>${nu.accountNumber}</code>\n<b>Initial Tier:</b> ${nu.tier.toUpperCase()}\n<b>Balance:</b> $${Number(nu.balance || 0).toLocaleString()}\n<b>Status:</b> Active · Verified`;
                dispatchTelegramAlert(regAlert).catch(() => {});
              }
            }
            stateChanged = true;
          }
        }
      }

      // Handle single user update (e.g., KYC submission, KYC approval, balance adjustment, freeze)
      if (action === 'update_user' && payload.user) {
        const uu = payload.user;
        const uIdx = db.users.findIndex(u => u.id === uu.id || (u.accountNumber && u.accountNumber === uu.accountNumber));
        if (uIdx >= 0) {
          db.users[uIdx] = Object.assign({}, db.users[uIdx], uu);
          stateChanged = true;
        }
      }

      // Bidirectional merge of client-submitted user list (Never drop valid users)
      if (Array.isArray(payload.users)) {
        const userMap = new Map();
        // Seed map with server database users
        db.users.forEach(u => {
          if (u && u.id && !deletedIds.has(u.id)) {
            userMap.set(u.id, u);
          }
        });

        // Merge incoming client users
        payload.users.forEach(u => {
          if (!u || !u.id || deletedIds.has(u.id) || (u.accountNumber && deletedIds.has(u.accountNumber))) {
            return;
          }

          if (userMap.has(u.id)) {
            const existing = userMap.get(u.id);
            // Merge attributes carefully
            const merged = Object.assign({}, existing, u);
            const exUpdated = Number(existing.updatedAt) || 0;
            const inUpdated = Number(u.updatedAt) || 0;
            if (exUpdated > inUpdated) {
              merged.balance = existing.balance;
              merged.updatedAt = existing.updatedAt;
            } else if (u.balance !== undefined && u.balance !== null) {
              merged.balance = u.balance;
              if (u.updatedAt) merged.updatedAt = u.updatedAt;
            }
            // If server has pending KYC details or specific balance, retain truth
            if (u.unlockRequest) merged.unlockRequest = u.unlockRequest;
            if (u.kycDetails) merged.kycDetails = u.kycDetails;
            userMap.set(u.id, merged);
          } else {
            // New user discovered in client storage
            if (!u.accountNumber) {
              u.accountNumber = generateAccountNumber(u.id, u.name, userMap.size);
            }
            userMap.set(u.id, u);
            stateChanged = true;
          }
        });

        db.users = Array.from(userMap.values());
        stateChanged = true;
      }

      // Update transactions if provided
      if (Array.isArray(payload.txs) && payload.txs.length > 0) {
        const existingTxMap = new Map();
        (db.txs || []).forEach(t => {
          const key = (t.userId || '') + (t.d || '') + (t.a || '') + (t.n || '');
          existingTxMap.set(key, t);
        });
        payload.txs.forEach(t => {
          const key = (t.userId || '') + (t.d || '') + (t.a || '') + (t.n || '');
          if (!existingTxMap.has(key)) {
            existingTxMap.set(key, t);
            stateChanged = true;
          }
        });
        db.txs = Array.from(existingTxMap.values()).slice(0, 100);
      }

      if (stateChanged) {
        saveDatabase(db);
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          ok: true,
          users: db.users,
          txs: db.txs || [],
          deleted_user_ids: Array.from(deletedIds),
          total_users: db.users.length,
          timestamp: Date.now()
        })
      };
    } catch (err) {
      console.error('[SYNC ERROR]:', err);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ ok: false, error: err.message, users: db.users || [] })
      };
    }
  }

  return {
    statusCode: 405,
    headers,
    body: JSON.stringify({ error: 'Method Not Allowed' })
  };
};
