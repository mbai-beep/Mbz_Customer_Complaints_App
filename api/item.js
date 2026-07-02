/* GET /api/item?itemId=...  ->  merged item record queried LIVE from SQL Server.
   One small lookup per view, filtered to the single ItemId (fast, always fresh). */
const { getPool } = require('../lib/sqlserver');

const SALES = 'SELECT TOP 1 ArticleNo, ColourName, ContrastName, SizeName, CashmemoDt, CashmemoNo, SupplierAlias FROM VW_MB_POWERBI_SLS_DATA_WITHOUT_ITEMID WHERE ItemId = @id ORDER BY CashmemoDt DESC';
const PUR   = 'SELECT TOP 1 PurchaseDt FROM VW_MB_POWERBI_PUR_REPORT WHERE ItemId = @id ORDER BY PurchaseDt DESC';
const PRT   = 'SELECT TOP 1 purreturndate FROM VW_MB_POWERBI_PRT_REPORT WHERE ItemId = @id ORDER BY purreturndate DESC';

const d = v => v == null ? '' : (v instanceof Date ? v.toISOString().slice(0, 10) : String(v));

module.exports = async (req, res) => {
  const itemId = String((req.query && req.query.itemId) || '').trim();
  if (!itemId) return res.status(400).json(null);
  try {
    const pool = await getPool();
    const run = async (q) => {
      try { const r = await pool.request().input('id', itemId).query(q); return r.recordset[0] || {}; }
      catch (e) { return { __error: e.message }; }
    };
    const [S, P, R] = await Promise.all([run(SALES), run(PUR), run(PRT)]);

    // if every view errored, surface it
    if (S.__error && P.__error && R.__error) {
      return res.status(500).json({ error: S.__error });
    }
    // nothing found for this item
    const nothing = !S.ArticleNo && !S.CashmemoNo && !P.PurchaseDt && !R.purreturndate;
    if (nothing) return res.json(null);

    res.json({
      articleNo:      S.ArticleNo || '',
      imageUrl:       '',
      colorName:      S.ColourName || '',
      contrast:       S.ContrastName || '',
      size:           S.SizeName || '',
      soldDate:       d(S.CashmemoDt),
      soldReturnDate: d(R.purreturndate),
      purchasedDate:  d(P.PurchaseDt),
      cashmemoNo:     S.CashmemoNo || '',
      supplierName:   S.SupplierAlias || ''
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
