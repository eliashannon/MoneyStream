# MoneyStream

A browser-only personal finance tracker prototype for credit cards, checking, and savings. Balances are entered manually; there are no bank connections, APIs, servers, or cloud accounts.

## Get started

Requires Node.js 20.9 or newer.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Use **Continue with demo account** or sign in with username `demo` and password `demo`. The first browser database is seeded with sample accounts and activity.

Other commands: `npm run lint`, `npm run build`, and `npm start` (after building).

## Prototype storage and authentication

`lib/storage.ts` is the IndexedDB adapter for users, accounts, and activity. Data belongs to the current browser and origin; clearing browser data removes it. `lib/demoData.ts` contains the first-run seed. The session hint is kept in localStorage when “Keep me signed in” is checked, or sessionStorage otherwise; the theme preference is also in localStorage.

**This is not secure authentication.** `lib/auth.ts` stores prototype passwords in plain text in IndexedDB and uses a client-controlled session hint. Anyone with access to the browser can read or alter them. Password recovery is simulated, and social and passkey options are disabled. Do not enter real credentials or sensitive financial data.

For a future backend, replace the `lib/storage.ts` repository with a server-backed implementation and replace `lib/auth.ts` and the client-side session gate in `app/page.tsx` with real server-side authentication and authorization. The current gate is a UI convenience, not a security boundary.

## Structure

- `app/` — app shell, theme, and global styles
- `components/auth/` — local sign-in and account creation
- `components/dashboard/` — overview, chart, filters, and activity
- `components/accounts/` — account editor
- `lib/` — typed models, IndexedDB adapter, demo data, and prototype auth
