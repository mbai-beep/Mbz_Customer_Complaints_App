/* GET /api/item?itemId=...  ->  merged item record queried LIVE from SQL Server. */
const { getPool } = require('../lib/sqlserver');

const SALES = 'SELECT TOP 1 ArticleNo, ColourName, ContrastName, SizeName, CashmemoDt, CashmemoNo, SupplierAlias FROM VW_MB_POWERBI_SLS_DATA_WITHOUT_ITEMID WHERE ItemId = @id ORDER BY CashmemoDt DESC';
const PUR   = 'SELECT TOP 1 PurchaseDt FROM VW_MB_POWERBI_PUR_REPORT WHERE ItemId = @id ORDER BY PurchaseDt DESC';
const PRT   = 'SELECT TOP 1 * FROM VW_MB_POWERBI_PRT_REPORT WHERE ItemId = @id';   // pick the return-date col from whatever it is named

const d = v => v == null ? '' : (v instanceof Date ? v.toISOString().slice(0, 10) : String(v));

function pickReturnDate(R) {
  if (!R) return '';
  // exact known names first
  for (const k of ['purreturndate', 'PurReturnDt', 'PurReturnDate', 'purreturndt']) if (R[k]) return R[k];
  // otherwise any column that looks like a return date
  for (const k of Object.keys(R)) if (/return/i.test(k) && /(dt|date)/i.test(k) && R[k]) return R[k];
  return '';
}

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
    if (S.__error && P.__error && R.__error) return res.status(500).json({ error: S.__error });

    const returnDate = R.__error ? '' : pickReturnDate(R);
    const nothing = !S.ArticleNo && !S.CashmemoNo && !P.PurchaseDt && !returnDate;
    if (nothing) return res.json(null);

    res.json({
      articleNo:      S.ArticleNo || '',
      imageUrl:       '',
      colorName:      S.ColourName || '',
      contrast:       S.ContrastName || '',
      size:           S.SizeName || '',
      soldDate:       d(S.CashmemoDt),
      soldReturnDate: d(returnDate),
      purchasedDate:  d(P.PurchaseDt),
      cashmemoNo:     S.CashmemoNo || '',
      supplierName:   S.SupplierAlias || ''
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
