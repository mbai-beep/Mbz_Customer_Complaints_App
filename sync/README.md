# Item sync: SQL Server (zRetailHQ0) → Turso

Your app runs on Vercel and cannot reach the on-premise SQL Server directly.
This script runs **inside your network**, reads the 3 PowerBI views, and copies the
item details into the Turso table `item_details`. The app reads that table instantly.

## What it maps (joined on ItemId)

| Turso column   | Source |
|----------------|--------|
| itemid         | ItemId (common key in all 3 views) |
| articleno      | SLS view . ArticleNo |
| colourname     | SLS view . ColourName |
| contrastname   | SLS view . ContrastName |
| sizename       | SLS view . SizeName |
| solddate       | SLS view . CashmemoDt |
| cashmemono     | SLS view . CashmemoNo |
| suppliername   | SLS view . SupplierAlias |
| purchasedate   | PUR view . PurchaseDt |
| soldreturndate | PRT view . purreturndate |

SLS = VW_MB_POWERBI_SLS_DATA_WITHOUT_ITEMID, PUR = VW_MB_POWERBI_PUR_REPORT, PRT = VW_MB_POWERBI_PRT_REPORT.
Only the **latest** row per ItemId is kept (via ROW_NUMBER … ORDER BY <date> DESC).

## One-time setup

1. Install Node.js on the in-network machine (https://nodejs.org).
2. In this `sync` folder run: `npm install`
3. In **Turso**, create a **full-access** token (the app's read-only token can't write):
   Turso dashboard → your DB → Create Token → read & write → copy it.
4. Copy `config.example.json` to `config.json` and fill in:
   - `sqlserver`: the server/host, port, `zRetailHQ0`, user, password you use in SSMS.
   - `turso.authToken`: the full-access token from step 3.
   - The three `queries` already use your column names; adjust only if a name differs.

## Run it

```
npm start
```
You'll see row counts and "DONE." Then in the app: log in, type an ItemId, click Fetch.

## Keep it fresh (Windows Task Scheduler)

1. **Task Scheduler → Create Basic Task**.
2. Trigger: Daily or hourly — whatever freshness you need.
3. Action: **Start a program** → Program: `node`, Arguments: `sync.mjs`,
   Start in: the full path to this `sync` folder.
4. Finish. It now refreshes `item_details` automatically.

## Notes
- `config.json` holds credentials and is git-ignored — never commit it.
- If a query errors, the message names the column/table to fix.
