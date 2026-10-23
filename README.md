# prototype crpt

An original night-sky market dashboard built with React, TypeScript and Vite. It includes animated stars, glass controls, dark/light appearance, live cryptocurrency prices and Mongolian currency information.

## What this update adds

- **Currency Market Orbit:** actual daily currency history with 7, 30 and 90-day views, alongside the existing crypto charts.
- **Searchable asset pickers:** choose MNT, USD, EUR, other supported currencies or crypto at the top right and in the converter. Quick choices, category filters, symbols and keyboard navigation replace the old dropdowns.
- **Bank exchange desk:** choose Golomt or TDB and switch between transfer and cash. Bank buy and sell quotes have separate columns, with the rate date and checked time.
- **Clear sources:** open **Data & sources** in the footer for the providers and official links.

The dashboard supports MNT plus 12 foreign currencies and 10 cryptocurrencies. Bank desk prices always mean **MNT per 1 foreign unit**, including JPY and KRW. Choosing BTC as your display asset changes the dashboard/converter view; bank quotes retain their explicit MNT basis.

The existing WebSocket connection, watchlists, converter, animations, single Light/Dark button, green Auto button, Vercel Analytics and Speed Insights remain included. Auto follows the system theme; pressing Light/Dark turns Auto off.

## Price sources

| Feature | Source | How it is obtained |
| --- | --- | --- |
| Daily reference rates and currency history | [Bank of Mongolia](https://www.mongolbank.mn/mn/currency-rates) | The official page's public data endpoint |
| Golomt buy/sell prices | [Golomt Bank](https://www.golomtbank.com/exchange) | The bank website's public dated JSON endpoint |
| TDB buy/sell prices | [Trade and Development Bank](https://www.tdbm.mn/mn/exchange-rates) | The official dated exchange-rate table |
| Live crypto prices | [Kraken](https://docs.kraken.com/exchange/api-reference/spot-websocket-v2/ticker) | Native browser WebSocket, USD trading pairs |
| Crypto history, market caps and reference quotes | [CoinGecko](https://www.coingecko.com/en/api) | Server-side HTTP requests |

Exact fiat requests implemented in the source:

```text
POST https://www.mongolbank.mn/mn/currency-rates/data?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
GET  https://www.golomtbank.com/api/exchange/?date=YYYYMMDD
GET  https://www.tdbm.mn/mn/exchange-rates
```

Dates use Ulaanbaatar time. These are public website feeds, rather than guaranteed contracted APIs; the banks can change their formats or availability. There is no GoGo feed or bank-price averaging in this implementation.

**Buy / Авах** means the bank buys your foreign currency. **Sell / Зарах** means you buy foreign currency from the bank. Cash and transfer values are separate. Missing and zero provider values display as an em dash. Selecting one bank never displays another bank's quotes under its name.

Currency-to-currency history uses the actual published reference rate on each date. The bank desk shows current bank offers separately; it does not pretend to have historical bank buy/sell series. Weekends and holidays may have no newly published quote. Crypto charts and currency charts quoted in crypto convert USD history using the latest display-asset quote; the interface labels these converted views.

Dashboard conversions normally use the latest Bank of Mongolia reference snapshot. If that request fails or returns invalid/old data, the existing fallback uses one complete TDB transfer-sell snapshot, labeled **Bank sell**. A bank desk selection does not change that conversion basis. Reverse and cross conversions calculated from reference/sell quotes are indicative, rather than executable two-sided bank offers.

### Verification on 23 October 2026

The Bank of Mongolia daily history endpoint and Golomt's dated JSON endpoint returned HTTP 200 and were validated against the new adapters. TDB's page was available to source inspection, but a direct server request from this build environment returned HTTP 403. Its adapter and unavailable state are implemented and tested; successful live TDB access from Vercel remains unverified. A failed bank request produces a clear unavailable state or that same bank's marked saved quotes.

## Step 1 — Update in VS Code

1. Download **prototype-crpt-update.txt** and place it in `F:\dev\projects\prototype-crpt`, beside `package.json`. Keep the exact filename; ensure Windows has not added another `.txt` extension.
2. Open this project folder in VS Code. Stop the dev server with **Ctrl+C**. The updater contains the full readable project source. You can open the text file in VS Code to review it before running.
3. Open **Terminal → New Terminal** using PowerShell. Run the following commands **one at a time**. Stop if any command fails.

```powershell
cd F:\dev\projects\prototype-crpt
```

```powershell
Copy-Item .\prototype-crpt-update.txt .\prototype-crpt-update.mjs
```

```powershell
node .\prototype-crpt-update.mjs
```

The updater first backs up changed existing source files in a dated sibling folder, such as `F:\dev\projects\prototype-crpt-backup-2026-...`. It retains Git history and `.env.local`. It refuses to run unless `package.json` identifies the project as `prototype-crpt`.

4. If the updater reports changed package files, or dependencies are incomplete, install them:

```powershell
npm ci --include=dev
```

This update adds no new dependencies. A project with a successful existing installation can proceed directly to the tests. Use Node.js 22.12 or newer, as required by this project's package file.

5. Run the tests, then the build, separately:

```powershell
npm test
```

```powershell
npm run build
```

6. Start the local website:

```powershell
npm run dev
```

7. Open the Local URL printed in the terminal, usually `http://localhost:5173`. This command serves both the React app and its local API. Check the following:

- Top-right asset picker: choose MNT, USD, EUR and BTC. Search by name/code and test converter selection.
- Market Orbit: choose **Currencies**, then USD or EUR; switch 7D/30D/90D. Choose **Crypto** for crypto history and live prices.
- Bank exchange desk: Golomt → transfer/cash; verify separate buy/sell values and displayed date. Select TDB and check either its own quotes or the explicit unavailable message.
- Bank-row chart button: opens that currency in Market Orbit.
- Light/Dark and Auto: Auto glows green; a manual theme switch turns it off.
- Footer **Data & sources**: lists the actual providers.

### Windows troubleshooting

If PowerShell reports access denied for `ConsoleHost_history.txt`, disable history saving for this terminal session and continue:

```powershell
Set-PSReadLineOption -HistorySaveStyle SaveNothing
```

That warning concerns PowerShell command history. It does not prove `Copy-Item` failed. Check the copied file:

```powershell
Test-Path .\prototype-crpt-update.mjs
```

If `npm ci` reports **EBUSY**, stop dev servers and close VS Code. Restart Windows if the file stays locked, reopen the project and retry `npm ci --include=dev`. Wait for a successful installation before running the build. A missing `tsc` after a failed install means the dependencies are incomplete. Do not commit a failed build.

Git's LF/CRLF warnings are informational. Never paste the terminal prompt `PS F:\...>` or the continuation marker `>>` as part of a command.

## Step 2 — Push to GitHub

Stop the dev server with **Ctrl+C**. Run each command separately:

```powershell
git status --short
```

```powershell
git add src server api tests public index.html package.json package-lock.json README.md vite.config.ts tsconfig.json vercel.json .env.example .gitignore
```

```powershell
git commit -m "Add currency Market Orbit bank rates and asset pickers"
```

```powershell
git push origin main
```

If the remote still contains `YOUR_USERNAME`, correct the existing remote once, rather than adding it again:

```powershell
git remote set-url origin https://github.com/chki1/prototype-crpt.git
```

Then repeat the push. The updater text/script and sibling backup do not need to be committed. The GitHub repository is [chki1/prototype-crpt](https://github.com/chki1/prototype-crpt).

## Step 3 — Verify on Vercel

1. Open your existing **prototype-crpt** project in Vercel and choose **Deployments**.
2. Find the commit **Add currency Market Orbit bank rates and asset pickers**. Wait for **Ready** and open the production URL. Refresh with **Ctrl+F5**.
3. If the repository is not connected yet, import `chki1/prototype-crpt`. Framework: **Vite**; build command: `npm run build`; output: `dist`; install: `npm ci`. The root directory must contain `package.json` and `api/market.ts`.
4. Test these paths after your deployed domain:

```text
/api/market?resource=bank&bank=golomt
/api/market?resource=bank&bank=tdb
/api/market?resource=fx-chart&currency=USD&quote=MNT&days=30
/api/market?resource=rates&feed=auto-v1
```

5. A healthy bank response has its selected `bankId`, `quoteDate`, `fetchedAt` and `quotes` with separate `cash` / `transfer` buy/sell values. The currency chart response has dated `points` and `source: "Bank of Mongolia"`. Compare the displayed quote date and numbers with the linked bank page using the same channel.
6. If TDB returns **503**, its upstream request was not usable. Inspect the function logs; keep the unavailable state until the bank feed can be reached normally. The implementation does not bypass a bank restriction or relabel Golomt prices as TDB. Other feeds are independent and continue working.
7. Repeat the local UI checks on the production site. Desktop, mobile, the bank desk and currency chart should all be checked after deployment because local tests do not establish Vercel's upstream connectivity.
8. Vercel Web Analytics and Speed Insights remain mounted once in `src/main.tsx`. If either is disabled in your Vercel project, enable it in the project's dashboard, redeploy and visit the production site. Data appears after real traffic is collected.

No API key is needed for the public fiat feeds or Kraken stream. CoinGecko can need an optional Demo API key if history requests are rate-limited. Set `COINGECKO_DEMO_API_KEY` in `.env.local` for local use and Vercel's server environment for deployment; redeploy after changing environment variables. Do not prefix it with `VITE_` or commit a secret.

## Refresh, caching and failure behavior

The bank desk checks every five minutes while visible. Bank snapshots cache independently for five minutes, with same-bank saved results allowed for up to one hour after refresh failure. Currency history caches per currency/quote/period for one hour; saved history can be retained up to 24 hours. Source dates and saved-state labels remain visible.

The dashboard's reference feed checks every 15 minutes while visible. The server tries Bank of Mongolia for up to nine seconds, then the fixed TDB transfer-sell fallback for up to six seconds. Primary cache lifetime is one hour; a successful fallback caches for 15 minutes. No cells from different sources or dates are combined into one FX snapshot.

Kraken updates arrive on actual exchange trades, with reconnect/backoff, hidden/offline pause and stale-price expiry. The public fiat feeds publish periodic quotes, so currencies do not pretend to tick on a WebSocket. All times shown by the app use Ulaanbaatar time (UTC+8).

## Key source files

| File | Purpose |
| --- | --- |
| `src/components/MarketOrbit.tsx` | Fiat/crypto history, asset and period controls |
| `src/components/AssetPicker.tsx` | Shared searchable asset-selection dialog |
| `src/components/BankRates.tsx` | Bank and cash/transfer buy/sell interface |
| `src/market.css` | Theme-aware picker and bank desk styling |
| `src/components/DataDialog.tsx` | Public provider names and links |
| `server/bank-quotes.ts` | Independent Golomt and TDB quote adapters |
| `server/fiat-history.ts` | Actual daily reference/cross-rate history |
| `server/currency-fallback.ts` | Reference feed with the fixed one-bank fallback |
| `server/market-service.ts` | API validation, isolated caches and failures |
| `tests/market-orbit.test.ts` | Currency history, quote columns, units and cache isolation |
| `api/market.ts` | Vercel API function |

The test suite also covers conversion math, WebSocket parsing/reconnect/cleanup, theme transitions, dates and stale-data expiry. Run `npm test` and `npm run build` after source changes.
