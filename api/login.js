/* POST /api/login  { storecode, password }  ->  { ok, storecode, storename }
   Validates the store code against the Turso table `storecode_details`.
   Tolerant of the table's column names: it matches the code against any
   column, and uses a store-name-like column for the display name if present. */
const { query } = require('../lib/turso');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' });
  const { storecode, password } = req.body || {};
  if (!storecode) return res.json({ ok: false, error: 'Store code required' });
  // password rule: MBZ + storecode (also enforced in the browser)
  if (password !== 'MBZ' + storecode) return res.json({ ok: false, error: 'Invalid password' });

  const code = String(storecode).trim();
  try {
    const { rows } = await query('SELECT * FROM storecode_details');

    // find the row whose store-code column equals the entered code
    let match = null, matchCol = null;
    for (const row of rows) {
      for (const k of Object.keys(row)) {
        if (row[k] != null && String(row[k]).trim() === code) { match = row; matchCol = k; break; }
      }
      if (match) break;
    }
    if (!match) return res.json({ ok: false, error: 'Store code not found' });

    // pick a store-name-like column (not the code column) if one exists
    const nameKey = Object.keys(match).find(
      k => k !== matchCol && /store.?name|storename|branch|outlet|name|title/i.test(k) && match[k]
    );
    const storename = nameKey ? String(match[nameKey]) : ('Store ' + code);

    res.json({ ok: true, storecode: code, storename });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
};
