/* GET /api/health  — diagnostic. Add ?item=<ItemId> to test a live lookup.
   Remove this file once everything works. */
const { query } = require('../lib/turso');
const { getPool } = require('../lib/sqlserver');
const { getRows, TABS } = require('../lib/sheets');
const { credentialsInfo } = require('../lib/google');

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

  try { const r = await query('SELECT COUNT(*) AS n FROM storecode_table'); out.storecodeTable = { status: 'ok', rows: r.rows[0].n }; }
  catch (e) { out.storecodeTable = { status: 'ERROR: ' + e.message }; }

  // Google credentials parse check (also shows the service-account email to share the Sheet/Drive with)
  try { out.googleCredentials = credentialsInfo(); }
  catch (e) { out.googleCredentials = { ok: false, error: e.message }; }

  // Google Sheet — complaint storage (what Submit writes to)
  try {
    const g = await getRows(TABS.complaints);
    out.googleSheet = { status: 'ok', complaintsTab: TABS.complaints, headers: g.header, existingRows: g.rows.length };
  } catch (e) {
    out.googleSheet = { status: 'ERROR: ' + e.message };
  }

  // SQL Server — dump columns from all three views for the test item
  try {
    const pool = await getPool();
    out.sqlServer = { status: 'connected' };
    const testItem = (req.query && req.query.item) ? String(req.query.item).trim() : null;
    if (testItem) {
      const q = async (t) => { try { const r = await pool.request().input('id', testItem).query(t); return r.recordset[0] || '(no row)'; } catch (e) { return { __error: e.message }; } };
      out.salesRow = await q('SELECT TOP 1 * FROM VW_MB_POWERBI_SLS_DATA_WITHOUT_ITEMID WHERE ItemId=@id ORDER BY CashmemoDt DESC');
      out.purchaseRow = await q('SELECT TOP 1 * FROM VW_MB_POWERBI_PUR_REPORT WHERE ItemId=@id');
      out.returnRow = await q('SELECT TOP 1 * FROM VW_MB_POWERBI_PRT_REPORT WHERE ItemId=@id');
      out.purchaseColumns = (out.purchaseRow && typeof out.purchaseRow === 'object' && !out.purchaseRow.__error) ? Object.keys(out.purchaseRow) : out.purchaseRow;
      out.returnColumns = (out.returnRow && typeof out.returnRow === 'object' && !out.returnRow.__error) ? Object.keys(out.returnRow) : out.returnRow;
    }
  } catch (e) {
    out.sqlServer = { status: 'ERROR: ' + e.message };
  }

  res.status(200).json(out);
};
