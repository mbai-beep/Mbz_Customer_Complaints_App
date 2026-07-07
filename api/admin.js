/* POST /api/admin  — admin-only operations. Body must include adminCode + adminPassword.
   actions: listUsers | saveUser | setEnabled | setPassword | deleteComplaint */
const { ensureUsersTable, getUser, verifyAdmin, roleFor, query } = require('../lib/users');
const { deleteComplaintByTicket } = require('../lib/sheets');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' });
  const b = req.body || {};
  try {
    if (!(await verifyAdmin(b.adminCode, b.adminPassword)))
      return res.status(403).json({ ok: false, error: 'Admin authentication failed' });
    await ensureUsersTable();
    const now = new Date().toISOString();

    switch (b.action) {
      case 'listUsers': {
        const r = await query('SELECT storecode, role, enabled, storename FROM users ORDER BY storecode');
        return res.json({ ok: true, users: r.rows });
      }
      case 'saveUser': {
        const code = String(b.storecode || '').trim();
        if (!code) return res.json({ ok: false, error: 'storecode required' });
        const password = b.password || ('MBZ' + code);
        const role = b.role || roleFor(code);
        const enabled = (b.enabled === false || b.enabled === '0') ? '0' : '1';
        await query(`INSERT INTO users (storecode,password,role,enabled,storename,updatedat)
          VALUES (?,?,?,?,?,?)
          ON CONFLICT(storecode) DO UPDATE SET password=excluded.password, role=excluded.role,
          enabled=excluded.enabled, storename=excluded.storename, updatedat=excluded.updatedat`,
          [code, password, role, enabled, b.storename || '', now]);
        return res.json({ ok: true });
      }
      case 'setEnabled': {
        const code = String(b.storecode || '').trim();
        const enabled = b.enabled ? '1' : '0';
        const u = await getUser(code);
        if (u) await query('UPDATE users SET enabled=?, updatedat=? WHERE storecode=?', [enabled, now, code]);
        else await query(`INSERT INTO users (storecode,password,role,enabled,updatedat) VALUES (?,?,?,?,?)`,
          [code, 'MBZ' + code, roleFor(code), enabled, now]);
        return res.json({ ok: true });
      }
      case 'setPassword': {
        const code = String(b.storecode || '').trim();
        const pw = b.password || '';
        if (!pw) return res.json({ ok: false, error: 'password required' });
        const u = await getUser(code);
        if (u) await query('UPDATE users SET password=?, updatedat=? WHERE storecode=?', [pw, now, code]);
        else await query(`INSERT INTO users (storecode,password,role,enabled,updatedat) VALUES (?,?,?,?,?)`,
          [code, pw, roleFor(code), '1', now]);
        return res.json({ ok: true });
      }
      case 'deleteComplaint': {
        const ok = await deleteComplaintByTicket(String(b.ticketId || ''));
        return res.json({ ok });
      }
      default:
        return res.json({ ok: false, error: 'Unknown action' });
    }
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
};
