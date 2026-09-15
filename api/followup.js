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
    // Only update the fields actually sent, so a card-level Complaint-Status change
    // doesn't blank out an existing full review (and vice-versa).
    const fields = {};
    if ('approver' in b) fields.Approver = b.approver || '';
    if ('status' in b) fields.Status = b.status || 'Pending';
    if ('finalStatus' in b) fields.FinalStatus = b.finalStatus || '';
    if ('complaintStatus' in b) fields.ComplaintStatus = b.complaintStatus || '';
    if ('challanNo' in b) fields.ChallanNo = b.challanNo || '';
    if ('debitNo' in b) fields.DebitNo = b.debitNo || '';
    if ('color' in b) fields.FollowupColor = b.color || '';
    if ('reason' in b) fields.FollowupReason = b.reason || '';
    if ('remarks' in b) fields.FollowupRemarks = b.remarks || '';
    // Stamp review time only on a full manager review, not a card status toggle.
    if ('approver' in b || 'finalStatus' in b) fields.ReviewedAt = istNow();
    await updateComplaintFields(row._row, fields);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
};
