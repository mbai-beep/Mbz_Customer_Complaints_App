/* POST /api/login { storecode, password } -> { ok, storecode, storename, role }
   Role comes from storecode_table (Role column); password from the users override
   (if any) else default MBZ+storecode. Expired passwords must be reset. */
const { storeInfo, getUser, roleFor, labelFor } = require('../lib/users');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' });
  const { storecode, password } = req.body || {};
  const code = String(storecode || '').trim();
  if (!code) return res.json({ ok: false, error: 'Store code required' });

  try {
    const info = await storeInfo(code);
    const role = (info && info.role) || roleFor(code);
    const storename = (info && info.storename) || labelFor(role, code);
    const user = await getUser(code);

    if (user) {
      if (String(user.enabled) === '0' || String(user.enabled).toLowerCase() === 'false')
        return res.json({ ok: false, error: 'Account is disabled. Contact admin.' });
      if (user.passwordexpiry && Date.now() > Date.parse(user.passwordexpiry))
        return res.json({ ok: false, error: 'Password expired. Use Forgot Password to set a new one.' });
      if (password !== user.password) return res.json({ ok: false, error: 'Invalid password' });
      return res.json({ ok: true, storecode: code, storename: user.storename || storename, role: user.role || role });
    }

    if (password !== 'MBZ' + code) return res.json({ ok: false, error: 'Invalid password' });
    if (role === 'employee' && !info) return res.json({ ok: false, error: 'Store code not found' });
    return res.json({ ok: true, storecode: code, storename, role });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
};
