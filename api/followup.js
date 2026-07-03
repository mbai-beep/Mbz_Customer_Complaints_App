/* POST /api/followup — manager review (Section 2), stored in Turso.
   Body: { ticketId, approver, status, color, reason, remarks, challanNo, debitNo } */
const { query } = require('../lib/turso');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' });
  const b = req.body || {};
  if (!b.ticketId) return res.json({ ok: false, error: 'ticketId required' });
  try {
    await query(`UPDATE complaints SET approver=?, status=?, challanno=?, debitno=?,
      followupcolor=?, followupreason=?, followupremarks=? WHERE ticketid=?`,
      [b.approver || '', b.status || 'Pending', b.challanNo || '', b.debitNo || '',
       b.color || '', b.reason || '', b.remarks || '', b.ticketId]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
};
