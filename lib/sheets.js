/* Sheet helpers: tab names, column order, row reading / writing (complaint storage). */
const { sheetsClient, SPREADSHEET_ID } = require('./google');

const TABS = {
  items: process.env.ITEMS_TAB || 'ItemMaster',
  stores: process.env.STORES_TAB || 'Stores',
  complaints: process.env.COMPLAINTS_TAB || 'Complaints'
};

const COMPLAINT_HEADERS = [
  'TicketID', 'TicketDate', 'StoreCode', 'StoreName', 'ItemID', 'ArticleNo', 'ImageURL',
  'ColorName', 'Contrast', 'Size', 'SoldDate', 'SoldReturnDate', 'PurchasedDate',
  'CashmemoNo', 'SupplierName', 'ComplaintReason', 'Approver', 'Remarks', 'ChallanNo',
  'DebitNo', 'Status', 'Image1', 'Image2', 'Image3', 'Image4',
  'FollowupColor', 'FollowupReason', 'FollowupRemarks', 'CreatedAt',
  'DepartmentShortName', 'CategoryShortName', 'PurReturnId'
];

function colLetter(index) {
  let s = '', n = index;
  do { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1; } while (n >= 0);
  return s;
}

/* Ensure row 1 of Complaints is the header, and keep it in sync with COMPLAINT_HEADERS
   (so newly-added columns like Department/Category get their labels). */
async function ensureHeader() {
  const s = await sheetsClient();
  const r = await s.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${TABS.complaints}!1:1` });
  const first = (r.data.values && r.data.values[0]) || [];
  if (first[0] !== 'TicketID' && first.length > 0) {
    const meta = await s.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    const sheet = (meta.data.sheets || []).find(sh => sh.properties.title === TABS.complaints);
    if (!sheet) throw new Error('Tab "' + TABS.complaints + '" not found in the spreadsheet');
    await s.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { requests: [{ insertDimension: { range: { sheetId: sheet.properties.sheetId, dimension: 'ROWS', startIndex: 0, endIndex: 1 }, inheritFromBefore: false } }] }
    });
  }
  const lastCol = colLetter(COMPLAINT_HEADERS.length - 1);
  await s.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID, range: `${TABS.complaints}!A1:${lastCol}1`,
    valueInputOption: 'RAW', requestBody: { values: [COMPLAINT_HEADERS] }
  });
}

async function getRows(tab) {
  const s = await sheetsClient();
  const r = await s.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: tab, valueRenderOption: 'FORMATTED_VALUE' });
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

function field(row, ...names) {
  for (const n of names) {
    if (row[n] != null && row[n] !== '') return row[n];
    const key = Object.keys(row).find(k => k.toLowerCase() === n.toLowerCase());
    if (key && row[key] !== '') return row[key];
  }
  return '';
}

async function appendComplaint(rowValues) {
  await ensureHeader();
  const s = await sheetsClient();
  await s.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID, range: `${TABS.complaints}!A1`,
    valueInputOption: 'RAW', insertDataOption: 'INSERT_ROWS', requestBody: { values: [rowValues] }
  });
}

async function updateComplaintFields(rowNumber, fields) {
  const s = await sheetsClient();
  const data = Object.entries(fields).map(([h, v]) => {
    const idx = COMPLAINT_HEADERS.indexOf(h);
    if (idx < 0) return null;
    return { range: `${TABS.complaints}!${colLetter(idx)}${rowNumber}`, values: [[v == null ? '' : v]] };
  }).filter(Boolean);
  if (!data.length) return;
  await s.spreadsheets.values.batchUpdate({ spreadsheetId: SPREADSHEET_ID, requestBody: { valueInputOption: 'RAW', data } });
}

async function deleteComplaintByTicket(ticketId) {
  const s = await sheetsClient();
  const meta = await s.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const sheet = (meta.data.sheets || []).find(sh => sh.properties.title === TABS.complaints);
  if (!sheet) return false;
  const { rows } = await getRows(TABS.complaints);
  const row = rows.find(r => String(field(r, 'TicketID')).trim() === String(ticketId).trim());
  if (!row) return false;
  await s.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { requests: [{ deleteDimension: { range: { sheetId: sheet.properties.sheetId, dimension: 'ROWS', startIndex: row._row - 1, endIndex: row._row } } }] }
  });
  return true;
}

module.exports = { TABS, COMPLAINT_HEADERS, colLetter, getRows, field, appendComplaint, updateComplaintFields, ensureHeader, deleteComplaintByTicket };
