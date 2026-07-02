/* GET /api/health  — diagnostic. Add ?item=<ItemId> to test a live lookup.
   Remove this file once everything works. */
const { query } = require('../lib/turso');
const { getPool } = require('../lib/sqlserver');
const { getRows, TABS } = require('../lib/sheets');

module.exports = async (req, res) => {
  const out = {
    env: {
      turso: !!process.env.TURSO_DATABASE_URL && !!process.env.TURSO_AUTH_TOKEN,
      sqlServer: !!process.env.SQL_SERVER && !!process.env.SQL_USER,
      spreadsheetId: !!process.env.SPREADSHEET_ID,
      driveFolderId: !!process.env.DRIVE_FOLDER_ID,
      googleCreds: !!(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_SERVICE_ACCOUNT_BASE64)
    }
  };

  // Turso login table
  try { const r = await query('SELECT COUNT(*) AS n FROM storecode_table'); out.storecodeTable = { status: 'ok', rows: r.rows[0].n }; }
  catch (e) { out.storecodeTable = { status: 'ERROR: ' + e.message }; }

  // Google Sheet (complaint storage) — this is what "Submit Complaint" writes to
  try {
    const g = await getRows(TABS.complaints);
    out.googleSheet = { status: 'ok', complaintsTab: TABS.complaints, headerCount: g.header.length, existingRows: g.rows.length };
  } catch (e) {
    out.googleSheet = { status: 'ERROR: ' + e.message + ' (submit needs: creds set in Vercel, Sheet shared with the service account, and a "' + TABS.complaints + '" tab)' };
  }

  // SQL Server item lookup
  try {
    const pool = await getPool();
    out.sqlServer = { status: 'connected' };
    const testItem = (req.query && req.query.item) ? String(req.query.item).trim() : null;
    if (testItem) {
      const q = async (t) => { try { const r = await pool.request().input('id', testItem).query(t); return r.recordset[0] || null; } catch (e) { return { __error: e.message }; } };
      out.sales = await q('SELECT TOP 1 ArticleNo, ColourName, ContrastName, SizeName, CashmemoDt, CashmemoNo, SupplierAlias FROM VW_MB_POWERBI_SLS_DATA_WITHOUT_ITEMID WHERE ItemId=@id ORDER BY CashmemoDt DESC');
      out.purchase = await q('SELECT TOP 1 PurchaseDt FROM VW_MB_POWERBI_PUR_REPORT WHERE ItemId=@id ORDER BY PurchaseDt DESC');
      out.purchaseReturnRow = await q('SELECT TOP 1 * FROM VW_MB_POWERBI_PRT_REPORT WHERE ItemId=@id');
      out.prtColumns = out.purchaseReturnRow && !out.purchaseReturnRow.__error ? Object.keys(out.purchaseReturnRow) : 'no row / error';
    }
  } catch (e) {
    out.sqlServer = { status: 'ERROR: ' + e.message };
  }

  res.status(200).json(out);
};
