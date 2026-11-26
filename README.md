# MoneyStream

A browser-only personal finance prototype. Account balances are entered manually; there are no bank connections or backend accounts. The demo account (`demo` / `demo`) contains sample data.

## Run

Requires Node.js 20.9 or newer.

```sh
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Run `npm run lint` or `npm run build` to validate the app. The calculation tests use `node --test lib/finance.test.mjs lib/analytics.test.mjs lib/transaction-filter.test.mjs lib/transaction-csv.test.mjs` and require Node.js 22.18 or newer. A production build can be started with `npm start`.

## Local data

Accounts, transactions, goals, activity, and daily balance snapshots are stored in IndexedDB through `lib/storage.ts`; theme, session, and analytics dashboard preferences are stored in browser storage. Data is specific to the browser and origin. The Settings section exports and imports a JSON backup of the current user's accounts, transactions, and goals. Import replaces those records; backups do not include passwords or theme settings. Settings can erase the current user's financial records or all local profiles and data. Erasing all data also removes the demo profile; create a new local profile afterward.

Transactions do not automatically change account balances. Transfers and credit-card payments are excluded from cash flow; manually entered purchases are counted as expenses. Net position uses the current balances of included accounts, not statement balances. Credit card statement payments are recorded separately from current balance.

The Transactions section filters existing records by search, account, account type, transaction type, category, status, recurrence, dates, and amount. Its summary reflects the filtered results, and the table supports sorting and pagination. Status and recurrence are manually recorded; existing transactions without a status remain marked as not recorded.

The Transactions CSV export contains the filtered records and escapes spreadsheet formulas. CSV import accepts this MoneyStream format only, requires matching account IDs, and rejects duplicate transaction IDs. Imports append records atomically and do not change manually maintained account balances.

The Accounts and Goals sections show summaries calculated from the same local records used on the dashboard. Removing an account preserves associated transactions but removes their account link.
Goals can include a description, category, target date and monthly contribution target, and can be marked paused. These fields are included in backups; contribution targets do not automatically move money.

The sidebar opens separate dashboard, transactions, accounts, goals, analytics, and settings views. Analytics is a customizable dashboard: choose which of five charts to show (cash flow, spending breakdown, net worth growth, asset allocation, and spending comparison), reorder them by dragging or from each chart's menu, change widths and per-chart settings, and download the data behind any chart as CSV. The layout, filters, and chart settings are saved per profile in this browser. All charts use the same local records and rules as the rest of the app: only income and expense transactions count toward cash flow, and net worth is included assets minus credit card and loan balances.

Net worth history comes from balance snapshots: each day the app loads or an account changes, the current balances are recorded. Earlier balances are never estimated, so the net worth chart starts on the first recorded day and fills in over time. Backups do not include balance history, and importing a backup or erasing financial data clears it. Light and dark themes can be changed in Settings and are applied immediately.

On phones and tablets, use the bottom navigation to switch views. Transaction search and history remain available from the header and dashboard. The dashboard's mobile net-position card can hide or show its displayed amount.
Cash-flow charts show tooltips on hover, or on tap on touch-first devices. The selected monthly values are also available to screen readers, and interface motion respects reduced-motion preferences.

In production, a service worker caches the application shell for offline use after an initial successful online visit on HTTPS or localhost. Browser storage or cached files can be evicted or cleared, so keep backups. Development mode does not enable offline caching.

**This is not secure authentication or encrypted storage.** Prototype passwords are stored in plain text in IndexedDB, and browser-controlled session hints are not an authorization boundary. Backups are plain-text files containing financial data. Do not enter real credentials or sensitive financial information. Future server-backed authentication and a repository implementation should replace the local prototype before handling sensitive data.