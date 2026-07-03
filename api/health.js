/* GET /api/health  — diagnostic. Add ?item=<ItemId> to test a live lookup.
   Remove this file once everything works. */
const { query, batch } = require('../lib/turso');
const { getPool } = require('../lib/sqlserver');

module.exports = async (req, res) => {
  const out = {
    env: {
      turso: !!process.env.TURSO_DATABASE_URL && !!process.env.TURSO_AUTH_TOKEN,
      sqlServer: !!process.env.SQL_SERVER && !!process.env.SQL_USER
    }
  };

  // Turso login
  try { const r = await query('SELECT COUNT(*) AS n FROM storecode_table'); out.storecodeTable = { status: 'ok', rows: r.rows[0].n }; }
  catch (e) { out.storecodeTable = { status: 'ERROR: ' + e.message }; }

  // Turso complaints WRITE test — this is what "Submit Complaint" needs.
  try {
    await batch([{ sql: 'CREATE TABLE IF NOT EXISTS complaints (ticketid TEXT PRIMARY KEY, storecode TEXT, ticketdate TEXT, storename TEXT, itemid TEXT, articleno TEXT, imageurl TEXT, colorname TEXT, contrast TEXT, size TEXT, solddate TEXT, soldreturndate TEXT, purchaseddate TEXT, cashmemono TEXT, suppliername TEXT, complaintreason TEXT, approver TEXT, remarks TEXT, challanno TEXT, debitno TEXT, status TEXT, followupcolor TEXT, followupreason TEXT, followupremarks TEXT, createdat TEXT)' }]);
    const c = await query('SELECT COUNT(*) AS n FROM complaints');
    out.complaintsStore = { status: 'ok (writable)', rows: c.rows[0].n };
  } catch (e) {
    out.complaintsStore = { status: 'ERROR: ' + e.message + '  — if this says not authorized/read-only, set TURSO_AUTH_TOKEN in Vercel to a READ-WRITE token.' };
  }

  // SQL Server item lookup
  try {
    const pool = await getPool();
    out.sqlServer = { status: 'connected' };
    const testItem = (req.query && req.query.item) ? String(req.query.item).trim() : null;
    if (testItem) {
      const q = async (t) => { try { const r = await pool.request().input('id', testItem).query(t); return r.recordset[0] || null; } catch (e) { return { __error: e.message }; } };
      const s = await q('SELECT TOP 1 * FROM VW_MB_POWERBI_SLS_DATA_WITHOUT_ITEMID WHERE ItemId=@id ORDER BY CashmemoDt DESC');
      const p = await q('SELECT TOP 1 * FROM VW_MB_POWERBI_PUR_REPORT WHERE ItemId=@id ORDER BY PurchaseDt DESC');
      const r = await q('SELECT TOP 1 * FROM VW_MB_POWERBI_PRT_REPORT WHERE ItemId=@id');
      out.salesColumns = s && !s.__error ? Object.keys(s) : s;
      out.purchaseColumns = p && !p.__error ? Object.keys(p) : p;
      out.returnColumns = r && !r.__error ? Object.keys(r) : r;
    }
  } catch (e) {
    out.sqlServer = { status: 'ERROR: ' + e.message };
  }

  res.status(200).json(out);
};
