/* GET /api/item?itemId=...  ->  merged item record from the 3 SQL Server views.
   General fields merge from whichever view has them. Sold Return Date is scanned
   across ALL Purchase-Return rows for the item (first non-empty value). */
const { getPool } = require('../lib/sqlserver');

const SALES = 'SELECT TOP 1 * FROM VW_MB_POWERBI_SLS_DATA_WITHOUT_ITEMID WHERE ItemId = @id ORDER BY CashmemoDt DESC';
const PUR   = 'SELECT TOP 1 * FROM VW_MB_POWERBI_PUR_REPORT WHERE ItemId = @id';
const PRT   = 'SELECT TOP 50 * FROM VW_MB_POWERBI_PRT_REPORT WHERE ItemId = @id';

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
    const run = async (q) => { try { const r = await pool.request().input('id', itemId).query(q); return r.recordset[0] || {}; } catch (e) { return { __error: e.message }; } };
    const runRows = async (q) => { try { const r = await pool.request().input('id', itemId).query(q); return r.recordset || []; } catch (e) { return []; } };

    const [S, P, prtRows] = await Promise.all([run(SALES), run(PUR), runRows(PRT)]);
    if (S.__error && P.__error && !prtRows.length) return res.status(500).json({ error: S.__error });

    const s = S.__error ? {} : S, p = P.__error ? {} : P, r = prtRows[0] || {};
    const M = {};
    [r, p, s].forEach(src => { for (const k of Object.keys(src)) { if (src[k] != null && src[k] !== '') M[k] = src[k]; else if (!(k in M)) M[k] = src[k]; } });

    // Sold Return Date: first non-empty across all PRT rows
    let returnDate = '';
    for (const rr of prtRows) { const v = pick(rr, ['purreturndate', 'PurReturnDt', 'PurReturnDate'], /return.*d(t|ate)/i); if (v) { returnDate = v; break; } }

    const out = {
      articleNo:           pick(M, ['ArticleNo', 'Article No', 'Article'], /article\s*no|^article$/i),
      imageUrl:            pickImage(M),
      colorName:           pick(M, ['ColourName', 'ColorName', 'Colour', 'Color'], /colou?r.*name|^colou?r$/i),
      contrast:            pick(M, ['ContrastName', 'Contrast'], /contrast/i),
      size:                pick(M, ['SizeName', 'Size'], /(^|[^a-z])size([^a-z]|$)/i),
      departmentShortName: pick(M, ['DepartmentShortName', 'Department Short Name', 'DeptShortName', 'Department'], /depart/i),
      categoryShortName:   pick(M, ['CategoryShortName', 'Category Short Name', 'Category'], /categor/i),
      soldDate:            d(pick(s, ['CashmemoDt', 'SoldDate', 'Sold Date'], /(cashmemo|sold).*d(t|ate)/i)),
      soldReturnDate:      d(returnDate),
      purchasedDate:       d(pick(M, ['PurchaseDt', 'PurchasedDate', 'PurchaseDate'], /purchase.*d(t|ate)/i)),
      cashmemoNo:          pick(s, ['CashmemoNo', 'Cashmemo No', 'CashMemoNo'], /cashmemo.*n(o|umber)/i),
      supplierName:        pick(M, ['SupplierAlias', 'SupplierName', 'Supplier'], /supplier/i)
    };
    const nothing = !out.articleNo && !out.cashmemoNo && !out.purchasedDate && !out.soldReturnDate && !out.colorName && !out.size;
    if (nothing) return res.json(null);
    res.json(out);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
