/* User accounts + roles.
   Role and Mobile_Number now come from the Turso `storecode_table` (columns Role,
   Mobile_Number). The `users` table holds admin-managed overrides: password,
   enabled flag, password history and expiry. */
const { query } = require('./turso');

const ADMIN_CODE = '2266';
const MANAGER_CODES = ['9999', '9998', '9997', '9996'];

function normalizeRole(v) {
  v = String(v || '').trim().toLowerCase();
  if (v === 'admin') return 'admin';
  if (v === 'manager') return 'manager';
  if (v === 'employee' || v === 'store' || v === 'staff') return 'employee';
  return '';
}
function roleFor(code) {              // fallback when storecode_table has no Role
  code = String(code || '').trim();
  if (code === ADMIN_CODE) return 'admin';
  if (MANAGER_CODES.includes(code)) return 'manager';
  return 'employee';
}
function labelFor(role, code) {
  if (role === 'admin') return 'Administrator';
  if (role === 'manager') return 'Manager ' + code;
  return 'Store ' + code;
}

/* look up a code in storecode_table -> { role, mobile, storename } (or null) */
async function storeInfo(code) {
  try {
    const r = await query('SELECT * FROM storecode_table');
    const c = String(code).trim();
    const row = r.rows.find(x => Object.keys(x).some(k => String(x[k]).trim() === c));
    if (!row) return null;
    const roleKey = Object.keys(row).find(k => /^role$/i.test(k));
    const mobKey  = Object.keys(row).find(k => /mobile|phone|contact/i.test(k));
    const nameKey = Object.keys(row).find(k => /store.?name|storename|branch|outlet|name|title/i.test(k) && String(row[k]).trim() !== c);
    return {
      role: roleKey ? normalizeRole(row[roleKey]) : '',
      mobile: mobKey ? String(row[mobKey] || '').replace(/\D/g, '') : '',
      storename: nameKey ? String(row[nameKey]) : ('Store ' + c)
    };
  } catch (e) { return null; }
}

async function ensureUsersTable() {
  await query(`CREATE TABLE IF NOT EXISTS users (
    storecode TEXT PRIMARY KEY, password TEXT, role TEXT,
    enabled TEXT DEFAULT '1', storename TEXT, updatedat TEXT )`);
  await query('ALTER TABLE users ADD COLUMN passwordhistory TEXT').catch(() => {});
  await query('ALTER TABLE users ADD COLUMN passwordexpiry TEXT').catch(() => {});
  await query(`CREATE TABLE IF NOT EXISTS otp_codes (
    storecode TEXT PRIMARY KEY, otp TEXT, expiresat TEXT )`);
}

async function getUser(code) {
  try { const r = await query('SELECT * FROM users WHERE storecode = ?', [String(code)]); return r.rows[0] || null; }
  catch (e) { return null; }
}

async function effectiveRole(code) {
  const info = await storeInfo(code);
  return (info && info.role) || roleFor(code);
}

async function verifyAdmin(code, password) {
  code = String(code || '').trim();
  if ((await effectiveRole(code)) !== 'admin') return false;
  const u = await getUser(code);
  if (u) { if (String(u.enabled) === '0') return false; return u.password === password; }
  return password === 'MBZ' + code;
}

module.exports = { ADMIN_CODE, MANAGER_CODES, roleFor, labelFor, normalizeRole, storeInfo, effectiveRole, ensureUsersTable, getUser, verifyAdmin, query };
