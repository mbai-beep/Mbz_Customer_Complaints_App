/* /api/complaints
     GET ?storecode=...  -> complaints for the store (from the Google Sheet)
     POST (payload)      -> create TicketID, upload photos to a per-store Drive folder,
                            append a row to the Sheet (CreatedAt in IST) */
const { Readable } = require('stream');
const { driveClient, DRIVE_FOLDER_ID } = require('../lib/google');
const { getRows, appendComplaint, ensureHeader, COMPLAINT_HEADERS, TABS, field } = require('../lib/sheets');

module.exports = async (req, res) => {
  if (req.method === 'GET') return list(req, res);
  if (req.method === 'POST') return create(req, res);
  res.status(405).json({ ok: false, error: 'Method not allowed' });
};

/* current date-time in IST as DD-MM-YYYY HH:MM:SS */
function istNow() {
  const d = new Date(Date.now() + 5.5 * 3600 * 1000);
  const p = n => String(n).padStart(2, '0');
  return `${p(d.getUTCDate())}-${p(d.getUTCMonth() + 1)}-${d.getUTCFullYear()} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
}

/* find (or create) a subfolder named after the store code inside the main Drive folder */
async function getStoreFolder(drive, storecode) {
  const name = String(storecode || 'unknown');
  const q = "name='" + name.replace(/'/g, "\\'") + "' and mimeType='application/vnd.google-apps.folder' and '"
    + DRIVE_FOLDER_ID + "' in parents and trashed=false";
  const list = await drive.files.list({
    q, fields: 'files(id,name)', supportsAllDrives: true, includeItemsFromAllDrives: true, corpora: 'allDrives'
  });
  if (list.data.files && list.data.files.length) return list.data.files[0].id;
  const folder = await drive.files.create({
    requestBody: { name, mimeType: 'application/vnd.google-apps.folder', parents: [DRIVE_FOLDER_ID] },
    fields: 'id', supportsAllDrives: true
  });
  return folder.data.id;
}

async function uploadImage(drive, dataUrl, name, parentId) {
  if (!dataUrl || !dataUrl.startsWith('data:')) return '';
  const m = dataUrl.match(/^data:(.+?);base64,(.*)$/);
  if (!m) return '';
  const file = await drive.files.create({
    requestBody: { name, parents: [parentId] },
    media: { mimeType: m[1], body: Readable.from(Buffer.from(m[2], 'base64')) },
    fields: 'id', supportsAllDrives: true
  });
  const id = file.data.id;
  try { await drive.permissions.create({ fileId: id, requestBody: { role: 'reader', type: 'anyone' }, supportsAllDrives: true }); }
  catch (e) { /* org may block public sharing; link still stored */ }
  return `https://drive.google.com/uc?export=view&id=${id}`;
}

async function create(req, res) {
  const c = req.body || {};
  try {
    await ensureHeader();
    const code = String(c.storecode || '').trim();

    // server-authoritative TicketID = <storecode>-<serial>  (e.g. 1-0001)
    const { rows } = await getRows(TABS.complaints);
    const n = rows.filter(r => String(field(r, 'StoreCode')).trim() === code).length;
    const ticketId = code + '-' + String(n + 1).padStart(4, '0');

    // photos -> per-store Drive subfolder
    const drive = await driveClient();
    const imgs = Array.isArray(c.images) ? c.images.slice(0, 4) : [];
    const links = [];
    if (imgs.length) {
      const folderId = await getStoreFolder(drive, code);
      for (let i = 0; i < imgs.length; i++) links.push(await uploadImage(drive, imgs[i], `${ticketId}_${i + 1}.jpg`, folderId));
    }
    while (links.length < 4) links.push('');

    const row = [
      ticketId, c.ticketDate || istNow(), code, c.storename || '', c.itemId || '',
      c.articleNo || '', c.imageUrl || '', c.colorName || '', c.contrast || '', c.size || '',
      c.soldDate || '', c.soldReturnDate || '', c.purchasedDate || '', c.cashmemoNo || '', c.supplierName || '',
      c.complaintReason || '', c.approver || '', c.remarks || '', c.challanNo || '', c.debitNo || '',
      c.status || 'Pending', links[0], links[1], links[2], links[3], '', '', '', istNow()
    ];
    if (row.length !== COMPLAINT_HEADERS.length) throw new Error('Row/column count mismatch');
    await appendComplaint(row);
    res.json({ ok: true, ticketId });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
}

async function list(req, res) {
  const code = String((req.query && req.query.storecode) || '').trim();
  try {
    await ensureHeader();
    const { rows } = await getRows(TABS.complaints);
    const data = rows.filter(r => String(field(r, 'StoreCode')).trim() === code).reverse().map(r => {
      const images = ['Image1', 'Image2', 'Image3', 'Image4'].map(k => field(r, k)).filter(Boolean);
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
