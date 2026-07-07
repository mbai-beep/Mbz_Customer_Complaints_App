/* POST /api/login { storecode, password } -> { ok, storecode, storename, role }
   Checks the Turso `users` table first (for admin-managed accounts / password changes),
   then falls back to the default rule password = MBZ+storecode. */
const { query } = require('../lib/turso');
const { getUser, roleFor, labelFor } = require('../lib/users');

function pickStoreName(rows, code) {
  const row = rows.find(r => Object.keys(r).some(k => String(r[k]).trim() === code));
  if (!row) return 'Store ' + code;
  const key = Object.keys(row).find(k => /store.?name|storename|branch|outlet|name|title/i.test(k) && String(row[k]).trim() !== code && row[k]);
  return key ? String(row[key]) : 'Store ' + code;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' });
  const { storecode, password } = req.body || {};
  const code = String(storecode || '').trim();
  if (!code) return res.json({ ok: false, error: 'Store code required' });

  try {
    const role = roleFor(code);
    const user = await getUser(code);

    // Admin-managed account exists → use its password / enabled flag / role
    if (user) {
      if (String(user.enabled) === '0' || String(user.enabled).toLowerCase() === 'false')
        return res.json({ ok: false, error: 'Account is disabled. Contact admin.' });
      if (password !== user.password) return res.json({ ok: false, error: 'Invalid password' });
      return res.json({ ok: true, storecode: code, storename: user.storename || labelFor(user.role || role, code), role: user.role || role });
    }

    // No stored account → default rule
    if (password !== 'MBZ' + code) return res.json({ ok: false, error: 'Invalid password' });

    if (role === 'store') {
      const r = await query('SELECT * FROM storecode_table');
      const found = r.rows.some(row => Object.keys(row).some(k => String(row[k]).trim() === code));
      if (!found) return res.json({ ok: false, error: 'Store code not found' });
      return res.json({ ok: true, storecode: code, storename: pickStoreName(r.rows, code), role: 'store' });
    }
    // admin / manager default login
    return res.json({ ok: true, storecode: code, storename: labelFor(role, code), role });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
};
