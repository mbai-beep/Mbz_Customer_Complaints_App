/* GET /api/serial?storecode=...  ->  { serial }  next 4-digit serial (from the Google Sheet) */
const { getRows, TABS, field } = require('../lib/sheets');

module.exports = async (req, res) => {
  const code = String((req.query && req.query.storecode) || '').trim();
  try {
    const { rows } = await getRows(TABS.complaints);
    const serials = rows
      .filter(r => String(field(r, 'StoreCode')).trim() === code)
      .map(r => { const m = String(field(r, 'TicketID')).match(/-(\d+)\s*$/); return m ? parseInt(m[1], 10) : 0; });
    const next = (serials.length ? Math.max(...serials) : 0) + 1;
    res.json({ serial: String(next).padStart(4, '0') });
  } catch (e) {
    res.json({ serial: '0001', note: e.message });
  }
};
