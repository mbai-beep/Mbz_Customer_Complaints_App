/* POST /api/followup — manager review (Section 2), stored in the Google Sheet.
   Body: { ticketId, approver, status, finalStatus, color, reason, remarks, challanNo, debitNo } */
const { getRows, updateComplaintFields, TABS, field } = require('../lib/sheets');

/* current date-time in IST as DD-MM-YYYY HH:MM:SS */
function istNow() {
  const d = new Date(Date.now() + 5.5 * 3600 * 1000);
  const p = n => String(n).padStart(2, '0');
  return `${p(d.getUTCDate())}-${p(d.getUTCMonth() + 1)}-${d.getUTCFullYear()} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' });
  const b = req.body || {};
  if (!b.ticketId) return res.json({ ok: false, error: 'ticketId required' });
  try {
    const { rows } = await getRows(TABS.complaints);
    // Target the LAST row with this TicketID (the newest one, which is what the
    // history list shows first) so a legacy duplicate ID can't misdirect the write.
    const matches = rows.filter(r => String(field(r, 'TicketID')).trim() === String(b.ticketId).trim());
    const row = matches.length ? matches[matches.length - 1] : null;
    if (!row) return res.json({ ok: false, error: 'Ticket not found' });
    await updateComplaintFields(row._row, {
      Approver: b.approver || '', Status: b.status || 'Pending', FinalStatus: b.finalStatus || '',
      ChallanNo: b.challanNo || '', DebitNo: b.debitNo || '',
      FollowupColor: b.color || '', FollowupReason: b.reason || '', FollowupRemarks: b.remarks || '',
      ComplaintStatus: b.complaintStatus || '',
      ReviewedAt: istNow()
    });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
};
