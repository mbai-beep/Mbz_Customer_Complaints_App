# Meena Bazaar — Customer Complaints App

Responsive web app (mobile + computer) for store teams to raise and follow up on
customer complaints. **Database = Google Sheets. Photos = Google Drive. Hosting = Vercel.**

```
index.html              the app (login, Section 1 new complaint, Section 2 history)
meena_bazaar_logo.png   login logo
api/                    Vercel serverless functions (the "backend")
  login.js  item.js  serial.js  complaints.js  followup.js
lib/                    Google auth + Sheets/Drive helpers
package.json  vercel.json  .gitignore  .env.example
```

No password or key is ever stored in the code — all secrets live in environment variables.

---

## 1. Prepare the Google Sheet

In the sheet (`SPREADSHEET_ID = 1iS_aufJM6fEDHW2MKhZ2eVXiNJVSLU6tVMbPvNgMFS0`) create **three tabs**
with these header rows (row 1, exact spelling):

**Tab `ItemMaster`** — your item lookup data (one row per item; if an item repeats, the last row wins = "latest"):
```
ItemID | ArticleNo | ImageURL | ColorName | Contrast | Size | SoldDate | SoldReturnDate | PurchasedDate | CashmemoNo | SupplierName
```

**Tab `Stores`**:
```
StoreCode | StoreName
```

**Tab `Complaints`** — paste this header row exactly (the app fills the rows):
```
TicketID | TicketDate | StoreCode | StoreName | ItemID | ArticleNo | ImageURL | ColorName | Contrast | Size | SoldDate | SoldReturnDate | PurchasedDate | CashmemoNo | SupplierName | ComplaintReason | Approver | Remarks | ChallanNo | DebitNo | Status | Image1 | Image2 | Image3 | Image4 | FollowupColor | FollowupReason | FollowupRemarks | CreatedAt
```

## 2. Give the service account access

1. In Google Cloud Console, enable **Google Sheets API** and **Google Drive API** for the project.
2. Open your service-account JSON (in `D:\secure\Customer_Complaints`) and copy its `client_email`
   (looks like `name@project.iam.gserviceaccount.com`).
3. **Share the Google Sheet** with that email as **Editor**.
4. **Share the Drive folder** (the one in your Drive URL) with that email as **Editor**.

## 3. Set environment variables

You need `SPREADSHEET_ID`, `DRIVE_FOLDER_ID`, and the service-account credentials.
For Vercel, the easiest is base64. On Windows PowerShell:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("D:\secure\Customer_Complaints\key.json"))
```

Copy the long output into `GOOGLE_SERVICE_ACCOUNT_BASE64`. See `.env.example` for all keys.

## 4. Push to GitHub

```powershell
cd D:\AI_ML_Projects\Complaints_App
git init
git add .
git commit -m "Meena Bazaar Customer Complaints App"
git branch -M main
git remote add origin https://github.com/mbai-beep/Mbz_Customer_Complaints_App.git
git push -u origin main
```
(If the repo already has commits, use `git pull --rebase origin main` first. The `.gitignore`
keeps `node_modules`, `.env`, and any key file out of the repo.)

## 5. Deploy to Vercel

**Option A — dashboard (recommended):**
1. vercel.com → **Add New → Project** → import `Mbz_Customer_Complaints_App`.
2. Framework preset: **Other**. No build command needed.
3. **Settings → Environment Variables**: add `SPREADSHEET_ID`, `DRIVE_FOLDER_ID`,
   `GOOGLE_SERVICE_ACCOUNT_BASE64`, `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`
   (and any optional `*_TAB` overrides).

   > **Login** is validated against the `storecode_details` table in Turso.
   > Item lookup and complaint storage use the Google Sheet + Drive.
4. **Deploy.** Every future `git push` auto-deploys.

**Option B — CLI:**
```powershell
npm i -g vercel
cd D:\AI_ML_Projects\Complaints_App
vercel            # link the project
vercel env add SPREADSHEET_ID
vercel env add DRIVE_FOLDER_ID
vercel env add GOOGLE_SERVICE_ACCOUNT_BASE64
vercel --prod
```

Your app will be live at `https://mbz-customer-complaints-app.vercel.app` (or your chosen domain).
Login: **store code** as username, password **`MBZ<storecode>`**.

---

## Local development

```powershell
cd D:\AI_ML_Projects\Complaints_App
npm install
# create a .env from .env.example (you can use GOOGLE_APPLICATION_CREDENTIALS for local)
npm i -g vercel
vercel dev        # runs the static site + /api functions at http://localhost:3000
```

To preview just the UI without Google (sample data), set `USE_MOCK = true` near the top of
the `<script>` in `index.html` and open the file directly (logins `1024`/`MBZ1024`, items `IT5001`/`IT5002`).

## Notes
- "Latest record" for an item = the **last matching row** in `ItemMaster`. Keep newest at the bottom (the app appends, so complaints are naturally chronological).
- Drive photos are made "anyone with the link can view" so they render in the history. If your
  Workspace blocks public link sharing, the links are still saved but images may not preview for
  users outside the org.
- The `MBZ<storecode>` rule is enforced both in the browser and in `api/login.js`.
