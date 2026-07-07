/* User accounts + roles, stored in Turso `users` table.
   Roles: admin (2626), manager (9999/9998/9997/9996), else store.
   Login falls back to the default password rule MBZ+<storecode> when a user has no
   row in `users` (so existing store codes keep working with no setup). */
const { query } = require('./turso');

const ADMIN_CODE = '2626';
const MANAGER_CODES = ['9999', '9998', '9997', '9996'];

function roleFor(code) {
  code = String(code || '').trim();
  if (code === ADMIN_CODE) return 'admin';
  if (MANAGER_CODES.includes(code)) return 'manager';
  return 'store';
}
function labelFor(role, code) {
  if (role === 'admin') return 'Administrator';
  if (role === 'manager') return 'Manager ' + code;
  return 'Store ' + code;
}

async function ensureUsersTable() {
  await query(`CREATE TABLE IF NOT EXISTS users (
    storecode TEXT PRIMARY KEY, password TEXT, role TEXT,
    enabled TEXT DEFAULT '1', storename TEXT, updatedat TEXT )`);
}

/* returns the users-table row for a code, or null (null also on any error) */
async function getUser(code) {
  try {
    const r = await query('SELECT * FROM users WHERE storecode = ?', [String(code)]);
    return r.rows[0] || null;
  } catch (e) { return null; }
}

async function verifyAdmin(code, password) {
  code = String(code || '').trim();
  if (roleFor(code) !== 'admin') return false;
  const u = await getUser(code);
  if (u) { if (String(u.enabled) === '0') return false; return u.password === password; }
  return password === 'MBZ' + code;
}

module.exports = { ADMIN_CODE, MANAGER_CODES, roleFor, labelFor, ensureUsersTable, getUser, verifyAdmin, query };
