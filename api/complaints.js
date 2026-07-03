/* /api/complaints
     GET ?storecode=...  -> complaints for the store (with images + manager fields)
     POST (payload)      -> store a new complaint + up to 4 images   (Turso) */
const { query, batch } = require('../lib/turso');

const CREATE_C = `CREATE TABLE IF NOT EXISTS complaints (
  ticketid TEXT PRIMARY KEY, ticketdate TEXT, storecode TEXT, storename TEXT,
  itemid TEXT, articleno TEXT, imageurl TEXT, colorname TEXT, contrast TEXT, size TEXT,
  solddate TEXT, soldreturndate TEXT, purchaseddate TEXT, cashmemono TEXT, suppliername TEXT,
  complaintreason TEXT, approver TEXT, remarks TEXT, challanno TEXT, debitno TEXT, status TEXT,
  followupcolor TEXT, followupreason TEXT, followupremarks TEXT, createdat TEXT )`;
const CREATE_I = `CREATE TABLE IF NOT EXISTS complaint_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT, ticketid TEXT, position INTEGER, imagedata TEXT )`;

async function ensure() { await batch([{ sql: CREATE_C }, { sql: CREATE_I }]); }

module.exports = async (req, res) => {
  if (req.method === 'GET') return list(req, res);
  if (req.method === 'POST') return create(req, res);
  res.status(405).json({ ok: false, error: 'Method not allowed' });
};

async function create(req, res) {
  const c = req.body || {};
  try {
    await ensure();
    const stmts = [{
      sql: `INSERT INTO complaints
        (ticketid,ticketdate,storecode,storename,itemid,articleno,imageurl,colorname,contrast,size,
         solddate,soldreturndate,purchaseddate,cashmemono,suppliername,complaintreason,
         approver,remarks,challanno,debitno,status,followupcolor,followupreason,followupremarks,createdat)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(ticketid) DO UPDATE SET itemid=excluded.itemid`,
      args: [c.ticketId, c.ticketDate, c.storecode, c.storename, c.itemId, c.articleNo, c.imageUrl,
        c.colorName, c.contrast, c.size, c.soldDate, c.soldReturnDate, c.purchasedDate, c.cashmemoNo,
        c.supplierName, c.complaintReason, c.approver || '', c.remarks || '', c.challanNo || '',
        c.debitNo || '', c.status || 'Pending', '', '', '', new Date().toISOString()]
    }];
    (Array.isArray(c.images) ? c.images.slice(0, 4) : []).forEach((img, i) => {
      stmts.push({ sql: 'INSERT INTO complaint_images (ticketid,position,imagedata) VALUES (?,?,?)', args: [c.ticketId, String(i), img] });
    });
    await batch(stmts);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
}

async function list(req, res) {
  const code = String((req.query && req.query.storecode) || '').trim();
  try {
    await ensure();
    const r = await query('SELECT * FROM complaints WHERE storecode = ? ORDER BY createdat DESC', [code]);
    const ids = r.rows.map(x => x.ticketid);
    const imgMap = {};
    if (ids.length) {
      const placeholders = ids.map(() => '?').join(',');
      const imgs = await query('SELECT ticketid, imagedata FROM complaint_images WHERE ticketid IN (' + placeholders + ') ORDER BY position', ids);
      imgs.rows.forEach(x => { (imgMap[x.ticketid] = imgMap[x.ticketid] || []).push(x.imagedata); });
    }
    res.json(r.rows.map(x => ({
      ticketId: x.ticketid, ticketDate: x.ticketdate, storecode: x.storecode, storename: x.storename,
      itemId: x.itemid, articleNo: x.articleno, imageUrl: x.imageurl, colorName: x.colorname,
      contrast: x.contrast, size: x.size, soldDate: x.solddate, soldReturnDate: x.soldreturndate,
      purchasedDate: x.purchaseddate, cashmemoNo: x.cashmemono, supplierName: x.suppliername,
      complaintReason: x.complaintreason, approver: x.approver, remarks: x.remarks,
      challanNo: x.challanno, debitNo: x.debitno, status: x.status,
      images: imgMap[x.ticketid] || [],
      followup: (x.followupcolor || x.followupreason || x.followupremarks)
        ? { color: x.followupcolor, reason: x.followupreason, remarks: x.followupremarks } : null
    })));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
