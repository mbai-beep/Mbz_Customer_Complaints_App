/* POST /api/followup  { ticketId, color, reason, remarks }  ->  { ok } */
const { getRows, updateFollowup, TABS, field } = require('../lib/sheets');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' });
  const { ticketId, color, reason, remarks } = req.body || {};
  if (!ticketId) return res.json({ ok: false, error: 'ticketId required' });
  try {
    const { rows } = await getRows(TABS.complaints);
    const row = rows.find(r => String(field(r, 'TicketID')).trim() === String(ticketId).trim());
    if (!row) return res.json({ ok: false, error: 'Ticket not found' });
    await updateFollowup(row._row, color, reason, remarks);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
};
