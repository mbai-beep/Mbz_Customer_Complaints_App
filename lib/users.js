/* User accounts + roles.
   Role and Mobile_Number come from the Turso `storecode_table`.
   `users`   : admin-managed overrides (password, enabled, role, storename).
   `pw_meta` : password history + expiry (kept separate so no ALTER is needed).
   `otp_codes`: transient OTPs for forgot-password. */
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
function roleFor(code) {
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

async function storeInfo(code) {
  try {
    const r = await query('SELECT * FROM storecode_table');
    const c = String(code).trim();
    const row = r.rows.find(x => Object.keys(x).some(k => String(x[k]).trim() === c));
    if (!row) return null;
    const roleKey = Object.keys(row).find(k => /^role$/i.test(k));
    const mobKey  = Object.keys(row).find(k => /mobile|phone|contact/i.test(k));
    const nameKey = Object.keys(row).find(k => /store.?name|storename|branch|outlet|name|title/i.test(k) && row[k] != null && String(row[k]).trim() && String(row[k]).trim() !== c);
    return {
      role: roleKey && row[roleKey] != null ? normalizeRole(row[roleKey]) : '',
      mobile: mobKey && row[mobKey] != null ? String(row[mobKey]).replace(/\D/g, '') : '',
      storename: nameKey ? String(row[nameKey]) : ('Store ' + c)
    };
  } catch (e) { return null; }
}

async function ensureUsersTable() {
  await query(`CREATE TABLE IF NOT EXISTS users (
    storecode TEXT PRIMARY KEY, password TEXT, role TEXT,
    enabled TEXT DEFAULT '1', storename TEXT, updatedat TEXT )`);
  await query(`CREATE TABLE IF NOT EXISTS otp_codes (
    storecode TEXT PRIMARY KEY, otp TEXT, expiresat TEXT )`);
  await query(`CREATE TABLE IF NOT EXISTS pw_meta (
    storecode TEXT PRIMARY KEY, history TEXT, expiry TEXT )`);
}

async function getUser(code) {
  try { const r = await query('SELECT * FROM users WHERE storecode = ?', [String(code)]); return r.rows[0] || null; }
  catch (e) { return null; }
}

async function getPwMeta(code) {
  try {
    const r = await query('SELECT * FROM pw_meta WHERE storecode = ?', [String(code)]);
    const row = r.rows[0];
    if (!row) return { history: [], expiry: null };
    let h = []; try { h = row.history ? JSON.parse(row.history) : []; } catch (_) {}
    return { history: h, expiry: row.expiry || null };
  } catch (e) { return { history: [], expiry: null }; }
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

module.exports = { ADMIN_CODE, MANAGER_CODES, roleFor, labelFor, normalizeRole, storeInfo, effectiveRole, ensureUsersTable, getUser, getPwMeta, verifyAdmin, query };
