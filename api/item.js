/* GET /api/item?itemId=...  ->  merged item record queried LIVE from SQL Server.
   Reads all three views with SELECT * and MERGES them, then picks each field from
   whichever view(s) contain the ItemID. So if the item is only in the Purchase or
   Purchase-Return view, its Article/Colour/Contrast/Size/etc. still fill in. */
const { getPool } = require('../lib/sqlserver');

const SALES = 'SELECT TOP 1 * FROM VW_MB_POWERBI_SLS_DATA_WITHOUT_ITEMID WHERE ItemId = @id ORDER BY CashmemoDt DESC';
const PUR   = 'SELECT TOP 1 * FROM VW_MB_POWERBI_PUR_REPORT WHERE ItemId = @id';
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
    // merge all three; a view with real values wins over an empty one for the same column
    const M = {};
    [r, p, s].forEach(src => { for (const k of Object.keys(src)) { if (src[k] != null && src[k] !== '') M[k] = src[k]; else if (!(k in M)) M[k] = src[k]; } });

    const out = {
      articleNo:      pick(M, ['ArticleNo', 'Article No', 'Article'], /article\s*no/i),
      imageUrl:       pickImage(M),
      colorName:      pick(M, ['ColourName', 'ColorName', 'Colour', 'Color']),
      contrast:       pick(M, ['ContrastName', 'Contrast']),
      size:           pick(M, ['SizeName', 'Size']),
      soldDate:       d(pick(M, ['CashmemoDt', 'SoldDate', 'Sold Date'])),
      soldReturnDate: d(pick(M, ['purreturndate', 'PurReturnDt', 'PurReturnDate'], /return.*(dt|date)/i)),
      purchasedDate:  d(pick(M, ['PurchaseDt', 'PurchasedDate', 'PurchaseDate'])),
      cashmemoNo:     pick(M, ['CashmemoNo', 'Cashmemo No', 'CashMemoNo']),
      supplierName:   pick(M, ['SupplierAlias', 'SupplierName', 'Supplier'])
    };
    const nothing = !out.articleNo && !out.cashmemoNo && !out.purchasedDate && !out.soldReturnDate && !out.colorName && !out.size;
    if (nothing) return res.json(null);
    res.json(out);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
