/* GET /api/item?itemId=...  ->  latest matching item record (or null) */
const { getRows, TABS, field } = require('../lib/sheets');

module.exports = async (req, res) => {
  const itemId = String((req.query && req.query.itemId) || '').trim();
  if (!itemId) return res.status(400).json(null);
  try {
    const { rows } = await getRows(TABS.items);
    const matches = rows.filter(r => String(field(r, 'ItemID', 'ItemId', 'Item Id')).trim() === itemId);
    if (!matches.length) return res.json(null);
    const r = matches[matches.length - 1]; // last row = latest record
    res.json({
      articleNo:      field(r, 'ArticleNo', 'Article No', 'Article'),
      imageUrl:       field(r, 'ImageURL', 'Image URL', 'Image_Url', 'ImageUrl'),
      colorName:      field(r, 'ColorName', 'Color Name', 'Color'),
      contrast:       field(r, 'Contrast'),
      size:           field(r, 'Size'),
      soldDate:       field(r, 'SoldDate', 'Sold Date', 'Sold_Date'),
      soldReturnDate: field(r, 'SoldReturnDate', 'Sold Return Date', 'Sold_Return_Date'),
      purchasedDate:  field(r, 'PurchasedDate', 'Purchased Date', 'Purchased_Date'),
      cashmemoNo:     field(r, 'CashmemoNo', 'Cashmemo No', 'CashMemoNo'),
      supplierName:   field(r, 'SupplierName', 'Supplier Name', 'Supplier')
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
