/* GET /api/health  — diagnostic. Add ?item=<ItemId> to test a live lookup.
   Checks env vars, Turso login table, and the live SQL Server item lookup.
   Remove this file once everything works. */
const { query } = require('../lib/turso');
const { getPool } = require('../lib/sqlserver');

module.exports = async (req, res) => {
  const out = {
    hasTursoUrl: !!process.env.TURSO_DATABASE_URL,
    hasTursoToken: !!process.env.TURSO_AUTH_TOKEN,
    hasSqlServer: !!process.env.SQL_SERVER,
    hasSqlUser: !!process.env.SQL_USER,
    hasSqlPassword: !!process.env.SQL_PASSWORD,
    sqlDatabase: process.env.SQL_DATABASE || null
  };

  try {
    const r = await query('SELECT COUNT(*) AS n FROM storecode_table');
    out.storecodeTable = { status: 'ok', rows: r.rows[0] ? r.rows[0].n : null };
  } catch (e) { out.storecodeTable = { status: 'ERROR: ' + e.message }; }

  try {
    const pool = await getPool();
    out.sqlServer = { status: 'connected' };
    const testItem = (req.query && req.query.item) ? String(req.query.item).trim() : null;
    if (testItem) {
      const q = async (t) => { try { const r = await pool.request().input('id', testItem).query(t); return r.recordset[0] || null; } catch (e) { return { __error: e.message }; } };
      out.sales = await q('SELECT TOP 1 ArticleNo, ColourName, ContrastName, SizeName, CashmemoDt, CashmemoNo, SupplierAlias FROM VW_MB_POWERBI_SLS_DATA_WITHOUT_ITEMID WHERE ItemId = @id ORDER BY CashmemoDt DESC');
      out.purchase = await q('SELECT TOP 1 PurchaseDt FROM VW_MB_POWERBI_PUR_REPORT WHERE ItemId = @id ORDER BY PurchaseDt DESC');
      out.purchaseReturn = await q('SELECT TOP 1 purreturndate FROM VW_MB_POWERBI_PRT_REPORT WHERE ItemId = @id ORDER BY purreturndate DESC');
    }
  } catch (e) {
    out.sqlServer = { status: 'ERROR: ' + e.message + ' (Vercel may be blocked by the SQL Server firewall)' };
  }

  res.status(200).json(out);
};
