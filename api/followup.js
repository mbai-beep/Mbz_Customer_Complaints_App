/* POST /api/followup  — manager review of a complaint (Section 2).
   Body: { ticketId, approver, status, color, reason, remarks, challanNo, debitNo } */
const { getRows, updateComplaintFields, TABS, field } = require('../lib/sheets');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' });
  const b = req.body || {};
  if (!b.ticketId) return res.json({ ok: false, error: 'ticketId required' });
  try {
    const { rows } = await getRows(TABS.complaints);
    const row = rows.find(r => String(field(r, 'TicketID')).trim() === String(b.ticketId).trim());
    if (!row) return res.json({ ok: false, error: 'Ticket not found' });
    await updateComplaintFields(row._row, {
      Approver: b.approver || '',
      Status: b.status || 'Pending',
      ChallanNo: b.challanNo || '',
      DebitNo: b.debitNo || '',
      FollowupColor: b.color || '',
      FollowupReason: b.reason || '',
      FollowupRemarks: b.remarks || ''
    });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
};
