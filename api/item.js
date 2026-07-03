/* GET /api/item?itemId=...  ->  merged item record queried LIVE from SQL Server.
   Reads all three views with SELECT * and picks fields tolerantly, so a single
   unexpected column name never blanks the whole lookup. */
const { getPool } = require('../lib/sqlserver');

const SALES = 'SELECT TOP 1 * FROM VW_MB_POWERBI_SLS_DATA_WITHOUT_ITEMID WHERE ItemId = @id ORDER BY CashmemoDt DESC';
const PUR   = 'SELECT TOP 1 * FROM VW_MB_POWERBI_PUR_REPORT WHERE ItemId = @id ORDER BY PurchaseDt DESC';
const PRT   = 'SELECT TOP 1 * FROM VW_MB_POWERBI_PRT_REPORT WHERE ItemId = @id';

const d = v => v == null ? '' : (v instanceof Date ? v.toISOString().slice(0, 10) : String(v));

function pick(o, names, rx) {
  if (!o) return '';
  for (const n of names) {
    const k = Object.keys(o).find(k => k.toLowerCase() === n.toLowerCase());
    if (k && o[k] != null && o[k] !== '') return o[k];
  }
  if (rx) for (const k of Object.keys(o)) if (rx.test(k) && o[k] != null && o[k] !== '') return o[k];
  return '';
}
function pickImage(o) {
  if (!o) return '';
  for (const n of ['ImageURL', 'ImageUrl', 'Image_Url', 'ImagePath', 'ImageLink', 'Image']) {
    const k = Object.keys(o).find(k => k.toLowerCase() === n.toLowerCase());
    if (k && o[k]) return o[k];
  }
  for (const k of Object.keys(o)) if (/image|img|photo/i.test(k) && /^https?:\/\//i.test(String(o[k]))) return o[k];
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

    const s = S.__error ? {} : S, p = P.__error ? {} : P, r = R.__error ? {} : R;
    const merged = Object.assign({}, r, p, s);   // sales wins on collisions

    const out = {
      articleNo:      pick(s, ['ArticleNo', 'Article No', 'Article'], /article\s*no/i),
      imageUrl:       pickImage(merged),
      colorName:      pick(s, ['ColourName', 'ColorName', 'Colour', 'Color']),
      contrast:       pick(s, ['ContrastName', 'Contrast']),
      size:           pick(s, ['SizeName', 'Size']),
      soldDate:       d(pick(s, ['CashmemoDt', 'SoldDate', 'Sold Date'])),
      soldReturnDate: d(pick(r, ['purreturndate', 'PurReturnDt', 'PurReturnDate'], /return.*(dt|date)/i)),
      purchasedDate:  d(pick(p, ['PurchaseDt', 'PurchasedDate', 'PurchaseDate'])),
      cashmemoNo:     pick(s, ['CashmemoNo', 'Cashmemo No', 'CashMemoNo']),
      supplierName:   pick(merged, ['SupplierAlias', 'SupplierName', 'Supplier'])
    };
    const nothing = !out.articleNo && !out.cashmemoNo && !out.purchasedDate && !out.soldReturnDate && !out.colorName;
    if (nothing) return res.json(null);
    res.json(out);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
