/* =====================================================================
   Sheet helpers: tab names, column order, row reading / writing.

   Expected tabs in the Google Sheet (see README for exact headers):
     - ItemMaster  : item lookup data keyed by ItemID
     - Stores      : StoreCode -> StoreName
     - Complaints  : where complaints are stored (created automatically)
   ===================================================================== */

const { sheetsClient, SPREADSHEET_ID } = require('./google');

const TABS = {
  items: process.env.ITEMS_TAB || 'ItemMaster',
  stores: process.env.STORES_TAB || 'Stores',
  complaints: process.env.COMPLAINTS_TAB || 'Complaints'
};

// Column order written to / read from the Complaints tab.
const COMPLAINT_HEADERS = [
  'TicketID', 'TicketDate', 'StoreCode', 'StoreName', 'ItemID', 'ArticleNo', 'ImageURL',
  'ColorName', 'Contrast', 'Size', 'SoldDate', 'SoldReturnDate', 'PurchasedDate',
  'CashmemoNo', 'SupplierName', 'ComplaintReason', 'Approver', 'Remarks', 'ChallanNo',
  'DebitNo', 'Status', 'Image1', 'Image2', 'Image3', 'Image4',
  'FollowupColor', 'FollowupReason', 'FollowupRemarks', 'CreatedAt'
];

// 0-based column index -> A1 letter (A, B, ... Z, AA, AB ...)
function colLetter(index) {
  let s = '', n = index;
  do { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1; } while (n >= 0);
  return s;
}

/* Read a whole tab as objects keyed by its header row.
   Each object gets a hidden _row = its 1-based sheet row number. */
async function getRows(tab) {
  const s = await sheetsClient();
  const r = await s.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: tab,
    valueRenderOption: 'FORMATTED_VALUE'
  });
  const values = r.data.values || [];
  if (values.length < 1) return { header: [], rows: [] };
  const header = values[0].map(h => String(h).trim());
  const rows = values.slice(1).map((arr, i) => {
    const o = { _row: i + 2 };
    header.forEach((h, c) => { o[h] = arr[c] != null ? arr[c] : ''; });
    return o;
  });
  return { header, rows };
}

/* Case-insensitive field getter, tolerant of small header naming differences. */
function field(row, ...names) {
  for (const n of names) {
    if (row[n] != null && row[n] !== '') return row[n];
    const key = Object.keys(row).find(k => k.toLowerCase() === n.toLowerCase());
    if (key && row[key] !== '') return row[key];
  }
  return '';
}

async function appendComplaint(rowValues) {
  const s = await sheetsClient();
  await s.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${TABS.complaints}!A1`,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [rowValues] }
  });
}

async function updateFollowup(rowNumber, color, reason, remarks) {
  const s = await sheetsClient();
  const start = COMPLAINT_HEADERS.indexOf('FollowupColor');
  const range = `${TABS.complaints}!${colLetter(start)}${rowNumber}:${colLetter(start + 2)}${rowNumber}`;
  await s.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range,
    valueInputOption: 'RAW',
    requestBody: { values: [[color || '', reason || '', remarks || '']] }
  });
}

module.exports = { TABS, COMPLAINT_HEADERS, colLetter, getRows, field, appendComplaint, updateFollowup };
