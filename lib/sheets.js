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
  'FollowupColor', 'FollowupReason', 'FollowupRemarks', 'CreatedAt'
];

function colLetter(index) {
  let s = '', n = index;
  do { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1; } while (n >= 0);
  return s;
}

/* Ensure row 1 of the Complaints tab is the header. If missing, insert it at the top
   (existing data rows shift down so everything lines up). */
async function ensureHeader() {
  const s = await sheetsClient();
  const r = await s.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${TABS.complaints}!A1:AC1` });
  const first = (r.data.values && r.data.values[0]) || [];
  if (first[0] === 'TicketID') return;                 // header already present
  const meta = await s.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const sheet = (meta.data.sheets || []).find(sh => sh.properties.title === TABS.complaints);
  if (!sheet) throw new Error('Tab "' + TABS.complaints + '" not found in the spreadsheet');
  const sheetId = sheet.properties.sheetId;
  const hasData = first.length > 0;
  if (hasData) {
    await s.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { requests: [{ insertDimension: { range: { sheetId, dimension: 'ROWS', startIndex: 0, endIndex: 1 }, inheritFromBefore: false } }] }
    });
  }
  await s.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID, range: `${TABS.complaints}!A1`,
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

module.exports = { TABS, COMPLAINT_HEADERS, colLetter, getRows, field, appendComplaint, updateComplaintFields, ensureHeader };
