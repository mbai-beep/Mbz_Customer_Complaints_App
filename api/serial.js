/* GET /api/serial?storecode=...  ->  { serial }  next 4-digit serial (Turso) */
const { query } = require('../lib/turso');

module.exports = async (req, res) => {
  const code = String((req.query && req.query.storecode) || '').trim();
  try {
    const r = await query('SELECT COUNT(*) AS n FROM complaints WHERE storecode = ?', [code]);
    res.json({ serial: String((Number(r.rows[0].n) || 0) + 1).padStart(4, '0') });
  } catch (e) {
    res.json({ serial: '0001' });   // table not created yet
  }
};
