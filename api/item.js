/* GET /api/item?itemId=...  ->  item record with each field sourced from its
   specific view:
     Sales (SLS): Article, Colour, Contrast, Size, Department, Category, SoldDate,
                  CashmemoNo, SupplierName, ItemMRP, SalesCost
     Purchase (PUR): PurchasedDate
     Purchase-Return (PRT): PurReturnId, PurchaseReturnDate */
const { getPool } = require('../lib/sqlserver');

const SALES = 'SELECT TOP 1 * FROM VW_MB_POWERBI_SLS_DATA_WITHOUT_ITEMID WHERE ItemId = @id ORDER BY CashmemoDt DESC';
const SOLD  = 'SELECT TOP 1 * FROM VW_MB_POWERBI_SLS_DATA_WITHOUT_ITEMID WHERE ItemId = @id AND SalesQuantity > 0 ORDER BY CashmemoDt DESC';
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

    const [S, SD, P, prtRows] = await Promise.all([run(SALES), run(SOLD), run(PUR), runRows(PRT)]);
    if (S.__error && P.__error && !prtRows.length) return res.status(500).json({ error: S.__error });

    const s = S.__error ? {} : S, p = P.__error ? {} : P;
    const sd = SD.__error ? {} : SD;   // latest SLS row with SalesQuantity > 0 (SoldDate only)

    let returnDate = '', purReturnId = '';
    for (const rr of prtRows) { if (!returnDate) { const v = pick(rr, ['purreturndate', 'PurReturnDt', 'PurReturnDate'], /return.*d(t|ate)/i); if (v) returnDate = v; } }
    for (const rr of prtRows) { const v = pick(rr, ['PurReturnId', 'PurReturnID', 'purreturnid', 'Pur_Return_Id'], /return.*id$/i); if (v) { purReturnId = v; break; } }

    const out = {
      articleNo:           pick(s, ['ArticleNo', 'Article No', 'Article'], /article\s*no|^article$/i),
      imageUrl:            pickImage(s),
      colorName:           pick(s, ['ColourName', 'ColorName', 'Colour', 'Color'], /colou?r.*name|^colou?r$/i),
      contrast:            pick(s, ['ContrastName', 'Contrast'], /contrast/i),
      size:                pick(s, ['SizeName', 'Size'], /(^|[^a-z])size([^a-z]|$)/i),
      departmentShortName: pick(s, ['DepartmentShortName', 'Department Short Name', 'DeptShortName', 'Department'], /depart/i),
      categoryShortName:   pick(s, ['CategoryShortName', 'Category Short Name', 'Category'], /categor/i),
      purchasedDate:       d(pick(p, ['PurchaseDt', 'PurchasedDate', 'PurchaseDate'], /purchase.*d(t|ate)/i)),
      purReturnId:         purReturnId,
      soldReturnDate:      d(returnDate),
      soldDate:            d(pick(sd, ['CashmemoDt', 'SoldDate', 'Sold Date'], /(cashmemo|sold).*d(t|ate)/i)),
      cashmemoNo:          pick(sd, ['CashmemoNo', 'Cashmemo No', 'CashMemoNo'], /cashmemo.*n(o|umber)/i),
      supplierName:        pick(s, ['SupplierName', 'SupplierAlias', 'Supplier'], /supplier/i),
      itemMRP:             pick(s, ['ItemMRP', 'Item MRP', 'MRP', 'ItemMrp'], /\bmrp\b/i),
      salesCost:           pick(s, ['SalesCost', 'Sales Cost', 'SaleCost', 'SellingCost', 'Sales_Cost'], /sale?s?\s*cost|selling\s*cost/i)
    };
    const nothing = !out.articleNo && !out.soldDate && !out.cashmemoNo && !out.colorName && !out.size && !out.purchasedDate && !out.soldReturnDate && !out.purReturnId;
    if (nothing) return res.json(null);
    res.json(out);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
