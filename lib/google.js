/* =====================================================================
   Google auth (service account) + Sheets & Drive clients.
   Credentials come from environment variables so nothing secret is
   ever committed to GitHub:

     GOOGLE_SERVICE_ACCOUNT_JSON     full service-account JSON (one line), OR
     GOOGLE_SERVICE_ACCOUNT_BASE64   the same JSON, base64-encoded
     SPREADSHEET_ID                  the Google Sheet ID
     DRIVE_FOLDER_ID                 the Drive folder ID for complaint photos

   For LOCAL dev you may instead set GOOGLE_APPLICATION_CREDENTIALS to the
   path of your key file (e.g. D:\secure\Customer_Complaints\key.json).
   ===================================================================== */

const { google } = require('googleapis');

const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive'
];

let _auth;
function getAuth() {
  if (_auth) return _auth;
  let credentials;
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  } else if (process.env.GOOGLE_SERVICE_ACCOUNT_BASE64) {
    credentials = JSON.parse(
      Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8')
    );
  }
  if (credentials) {
    // env vars often escape newlines in the private key
    if (credentials.private_key) {
      credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
    }
    _auth = new google.auth.GoogleAuth({ credentials, scopes: SCOPES });
  } else {
    // fall back to GOOGLE_APPLICATION_CREDENTIALS file path (local dev)
    _auth = new google.auth.GoogleAuth({ scopes: SCOPES });
  }
  return _auth;
}

let _sheets, _drive;
async function sheetsClient() {
  if (_sheets) return _sheets;
  const auth = await getAuth().getClient();
  _sheets = google.sheets({ version: 'v4', auth });
  return _sheets;
}
async function driveClient() {
  if (_drive) return _drive;
  const auth = await getAuth().getClient();
  _drive = google.drive({ version: 'v3', auth });
  return _drive;
}

module.exports = {
  google,
  sheetsClient,
  driveClient,
  SPREADSHEET_ID: process.env.SPREADSHEET_ID,
  DRIVE_FOLDER_ID: process.env.DRIVE_FOLDER_ID
};
