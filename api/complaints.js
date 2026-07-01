/* /api/complaints
     GET  ?storecode=...   -> array of complaints for the store
     POST  (full payload)  -> uploads up to 4 photos to Drive, appends a row   */

const { Readable } = require('stream');
const { driveClient, DRIVE_FOLDER_ID } = require('../lib/google');
const { getRows, appendComplaint, COMPLAINT_HEADERS, TABS, field } = require('../lib/sheets');

module.exports = async (req, res) => {
  if (req.method === 'GET') return listComplaints(req, res);
  if (req.method === 'POST') return createComplaint(req, res);
  res.status(405).json({ ok: false, error: 'Method not allowed' });
};

/* ---- upload one base64 data URL to the Drive folder, return a viewable link ---- */
async function uploadImage(dataUrl, name) {
  if (!dataUrl || !dataUrl.startsWith('data:')) return '';
  const m = dataUrl.match(/^data:(.+?);base64,(.*)$/);
  if (!m) return '';
  const mimeType = m[1];
  const buffer = Buffer.from(m[2], 'base64');
  const drive = await driveClient();

  const file = await drive.files.create({
    requestBody: { name, parents: DRIVE_FOLDER_ID ? [DRIVE_FOLDER_ID] : undefined },
    media: { mimeType, body: Readable.from(buffer) },
    fields: 'id, webViewLink',
    supportsAllDrives: true
  });
  const id = file.data.id;

  // make it viewable by anyone with the link (so the photo renders in the app)
  try {
    await drive.permissions.create({
      fileId: id,
      requestBody: { role: 'reader', type: 'anyone' },
      supportsAllDrives: true
    });
  } catch (e) { /* org policy may block public sharing; link still saved */ }

  return `https://drive.google.com/uc?export=view&id=${id}`;
}

async function createComplaint(req, res) {
  const c = req.body || {};
  try {
    const imgs = Array.isArray(c.images) ? c.images.slice(0, 4) : [];
    const links = [];
    for (let i = 0; i < imgs.length; i++) {
      links.push(await uploadImage(imgs[i], `${c.ticketId || 'complaint'}_${i + 1}.jpg`));
    }
    while (links.length < 4) links.push('');

    const row = [
      c.ticketId || '', c.ticketDate || '', c.storecode || '', c.storename || '',
      c.itemId || '', c.articleNo || '', c.imageUrl || '', c.colorName || '', c.contrast || '',
      c.size || '', c.soldDate || '', c.soldReturnDate || '', c.purchasedDate || '',
      c.cashmemoNo || '', c.supplierName || '', c.complaintReason || '', c.approver || '',
      c.remarks || '', c.challanNo || '', c.debitNo || '', c.status || 'Pending',
      links[0], links[1], links[2], links[3],
      '', '', '',                              // followup color/reason/remarks
      new Date().toISOString()
    ];
    if (row.length !== COMPLAINT_HEADERS.length) {
      throw new Error('Row/column count mismatch');
    }
    await appendComplaint(row);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
}

async function listComplaints(req, res) {
  const code = String((req.query && req.query.storecode) || '').trim();
  try {
    const { rows } = await getRows(TABS.complaints);
    const data = rows
      .filter(r => String(field(r, 'StoreCode')).trim() === code)
      .reverse() // newest first
      .map(r => {
        const images = ['Image1', 'Image2', 'Image3', 'Image4']
          .map(k => field(r, k)).filter(Boolean);
        const fc = field(r, 'FollowupColor'), fr = field(r, 'FollowupReason'), fm = field(r, 'FollowupRemarks');
        return {
          ticketId: field(r, 'TicketID'), ticketDate: field(r, 'TicketDate'),
          storecode: field(r, 'StoreCode'), storename: field(r, 'StoreName'),
          itemId: field(r, 'ItemID'), articleNo: field(r, 'ArticleNo'), imageUrl: field(r, 'ImageURL'),
          colorName: field(r, 'ColorName'), contrast: field(r, 'Contrast'), size: field(r, 'Size'),
          soldDate: field(r, 'SoldDate'), soldReturnDate: field(r, 'SoldReturnDate'),
          purchasedDate: field(r, 'PurchasedDate'), cashmemoNo: field(r, 'CashmemoNo'),
          supplierName: field(r, 'SupplierName'), complaintReason: field(r, 'ComplaintReason'),
          approver: field(r, 'Approver'), remarks: field(r, 'Remarks'),
          challanNo: field(r, 'ChallanNo'), debitNo: field(r, 'DebitNo'), status: field(r, 'Status'),
          images,
          followup: (fc || fr || fm) ? { color: fc, reason: fr, remarks: fm } : null
        };
      });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
