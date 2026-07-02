/* GET /api/health  — diagnostic. Visit https://<your-app>/api/health
   Add ?item=<ItemID>, e.g. /api/health?item=26033105031
   Reports env vars, Turso reachability, and the sales view schema/sample.
   Does NOT reveal secret values. Remove this file once everything works. */
const { query } = require('../lib/turso');

const SALES_VIEW = 'VW_MB_POWERBI_SLS_DATA_WITHOUT_ITEMID';

module.exports = async (req, res) => {
  const out = {
    hasTursoUrl: !!process.env.TURSO_DATABASE_URL,
    hasTursoToken: !!process.env.TURSO_AUTH_TOKEN,
    hasSpreadsheetId: !!process.env.SPREADSHEET_ID,
    hasDriveFolderId: !!process.env.DRIVE_FOLDER_ID
  };

  try {
    const r = await query('SELECT COUNT(*) AS n FROM storecode_table');
    out.turso = { status: 'ok', storeCount: r.rows[0] ? r.rows[0].n : null };
  } catch (e) {
    out.turso = { status: 'ERROR: ' + e.message };
  }

  try {
    const t = await query("SELECT name, type FROM sqlite_master WHERE type IN ('table','view') ORDER BY name");
    out.tursoObjects = t.rows;
  } catch (e) {
    out.tursoObjects = 'ERROR: ' + e.message;
  }

  try {
    const info = await query('PRAGMA table_info(' + SALES_VIEW + ')');
    out.salesView = { name: SALES_VIEW, columns: info.rows.map(function (r) { return r.name; }) };
    try {
      const c = await query('SELECT COUNT(*) AS n FROM ' + SALES_VIEW);
      out.salesView.rowCount = c.rows[0] ? c.rows[0].n : null;
    } catch (e) { out.salesView.rowCount = 'ERROR: ' + e.message; }
    const sample = await query('SELECT * FROM ' + SALES_VIEW + ' LIMIT 2');
    out.salesView.sampleRows = sample.rows;
    const testItem = (req.query && req.query.item) ? String(req.query.item).trim() : null;
    if (testItem && sample.cols.length) {
      const where = sample.cols.map(function (c) { return 'CAST("' + c + '" AS TEXT) = ?'; }).join(' OR ');
      const args = sample.cols.map(function () { return testItem; });
      try {
        const hit = await query('SELECT * FROM ' + SALES_VIEW + ' WHERE ' + where + ' LIMIT 3', args);
        out.itemLookupTest = { item: testItem, found: hit.rows.length, rows: hit.rows };
      } catch (e) { out.itemLookupTest = { item: testItem, error: e.message }; }
    }
  } catch (e) {
    out.salesView = { name: SALES_VIEW, status: 'ERROR: ' + e.message };
  }

  res.status(200).json(out);
};
