/* POST /api/login  { storecode, password }  ->  { ok, storecode, storename } */
const { getRows, TABS, field } = require('../lib/sheets');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' });
  const { storecode, password } = req.body || {};
  if (!storecode) return res.json({ ok: false, error: 'Store code required' });
  // password rule: MBZ + storecode (also enforced in the browser)
  if (password !== 'MBZ' + storecode) return res.json({ ok: false, error: 'Invalid password' });
  try {
    const { rows } = await getRows(TABS.stores);
    const row = rows.find(r => String(field(r, 'StoreCode', 'Store Code')).trim() === String(storecode).trim());
    const storename = row ? (field(row, 'StoreName', 'Store Name') || ('Store ' + storecode)) : ('Store ' + storecode);
    res.json({ ok: true, storecode, storename });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
};
