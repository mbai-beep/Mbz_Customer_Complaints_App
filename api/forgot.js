/* POST /api/forgot  { storecode }  -> resets that account's password to the
   default (MBZ+storecode) so the user can log in again. Disabled accounts stay
   disabled (password reset alone won't let a disabled user in). */
const { query } = require('../lib/turso');
const { ensureUsersTable, getUser } = require('../lib/users');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' });
  const code = String((req.body && req.body.storecode) || '').trim();
  if (!code) return res.json({ ok: false, error: 'Store code required' });
  try {
    await ensureUsersTable();
    const def = 'MBZ' + code;
    const u = await getUser(code);
    if (u) {
      if (String(u.enabled) === '0') return res.json({ ok: false, error: 'Account is disabled. Contact admin.' });
      await query('UPDATE users SET password=?, updatedat=? WHERE storecode=?', [def, new Date().toISOString(), code]);
    }
    // if no users row exists, the default rule (MBZ+code) already works
    res.json({ ok: true, password: def });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
};
