# MoneyStream

A browser-only personal finance prototype. Account balances are entered manually; there are no bank connections or backend accounts. The demo account (`demo` / `demo`) contains sample data.

## Run

Requires Node.js 20.9 or newer.

```sh
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Run `npm run lint` or `npm run build` to validate the app. The calculation tests use `node --test lib/finance.test.mjs` and require Node.js 22.18 or newer. A production build can be started with `npm start`.

## Local data

Accounts, transactions, goals, and activity are stored in IndexedDB through `lib/storage.ts`; theme and session preferences are stored in browser storage. Data is specific to the browser and origin. The Settings section exports and imports a JSON backup of the current user's accounts, transactions, and goals. Import replaces those records; backups do not include passwords or theme settings. Settings can erase the current user's financial records or all local profiles and data. Erasing all data also removes the demo profile; create a new local profile afterward.

Transactions do not automatically change account balances. Transfers and credit-card payments are excluded from cash flow; manually entered purchases are counted as expenses. Net position uses the current balances of included accounts, not statement balances. Credit card statement payments are recorded separately from current balance.

In production, a service worker caches the application shell for offline use after an initial successful online visit on HTTPS or localhost. Browser storage or cached files can be evicted or cleared, so keep backups. Development mode does not enable offline caching.

**This is not secure authentication or encrypted storage.** Prototype passwords are stored in plain text in IndexedDB, and browser-controlled session hints are not an authorization boundary. Backups are plain-text files containing financial data. Do not enter real credentials or sensitive financial information. Future server-backed authentication and a repository implementation should replace the local prototype before handling sensitive data.