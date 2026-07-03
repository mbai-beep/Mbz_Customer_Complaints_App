/* Google auth (service account) + Sheets & Drive clients.
   Credentials from env: GOOGLE_SERVICE_ACCOUNT_JSON (raw one-line JSON) OR
   GOOGLE_SERVICE_ACCOUNT_BASE64 (base64 of that JSON). */
const { google } = require('googleapis');

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive'];

function parseCredentials() {
  let raw, source;
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) { raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON; source = 'GOOGLE_SERVICE_ACCOUNT_JSON'; }
  else if (process.env.GOOGLE_SERVICE_ACCOUNT_BASE64) {
    source = 'GOOGLE_SERVICE_ACCOUNT_BASE64';
    try { raw = Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8'); }
    catch (e) { throw new Error(source + ' is not valid base64'); }
  } else return null;

  let creds;
  try { creds = JSON.parse(raw); }
  catch (e) {
    throw new Error(source + ' does not contain valid service-account JSON. It decoded to: '
      + JSON.stringify(raw.slice(0, 24)) + '… Re-create it from the .json key file (see notes).');
  }
  if (creds.private_key) creds.private_key = creds.private_key.replace(/\\n/g, '\n');
  return creds;
}

function credentialsInfo() {
  const c = parseCredentials();
  if (!c) return { ok: false, error: 'No Google credentials env var set' };
  return { ok: true, clientEmail: c.client_email || '(no client_email in key)' };
}

let _auth;
function getAuth() {
  if (_auth) return _auth;
  const credentials = parseCredentials();
  _auth = credentials
    ? new google.auth.GoogleAuth({ credentials, scopes: SCOPES })
    : new google.auth.GoogleAuth({ scopes: SCOPES });   // GOOGLE_APPLICATION_CREDENTIALS fallback
  return _auth;
}

let _sheets, _drive;
async function sheetsClient() { if (!_sheets) _sheets = google.sheets({ version: 'v4', auth: await getAuth().getClient() }); return _sheets; }
async function driveClient() { if (!_drive) _drive = google.drive({ version: 'v3', auth: await getAuth().getClient() }); return _drive; }

module.exports = {
  google, sheetsClient, driveClient, credentialsInfo,
  SPREADSHEET_ID: process.env.SPREADSHEET_ID,
  DRIVE_FOLDER_ID: process.env.DRIVE_FOLDER_ID
};
