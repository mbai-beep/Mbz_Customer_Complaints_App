/* GET /api/serial?storecode=...  ->  { serial }  (next 4-digit serial for this store) */
const { getRows, TABS, field } = require('../lib/sheets');

module.exports = async (req, res) => {
  const code = String((req.query && req.query.storecode) || '').trim();
  try {
    const { rows } = await getRows(TABS.complaints);
    const n = rows.filter(r => String(field(r, 'StoreCode')).trim() === code).length;
    res.json({ serial: String(n + 1).padStart(4, '0') });
  } catch (e) {
    // If the Complaints tab is empty/missing a header yet, start at 0001
    res.json({ serial: '0001', note: e.message });
  }
};
