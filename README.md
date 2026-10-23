# prototype crpt

A React, TypeScript and Vite dashboard with an original night-sky design, animated stars, glass widgets and a soft light theme.

## Features

- MNT, USD and EUR display currency selected at the top right.
- Daily reference FX quotes, with a single commercial-bank fallback when the primary request fails, times out or returns invalid/old data.
- The fallback uses the same bank's non-cash sell column for all 12 currencies. Rates are labeled **Bank sell**, including their date. Reference and bank rates are never mixed in one snapshot.
- Prices are per one source unit, including JPY and KRW. Reverse and cross-currency values are indicative calculations, rather than executable bank buy/sell offers.
- 10 cryptocurrency USD pairs streamed over one native browser WebSocket, with automatic reconnection and green/red price feedback.
- Historical charts, watchlists, search, sorting and a converter.
- One Light/Dark button and a small Auto control. Auto glows green while following the system; a manual theme change turns it off. Preferences survive reloads.
- Vercel Web Analytics and Speed Insights are installed once in `src/main.tsx`.
- The public currency interface has neutral labels and the app's own design. The historical crypto API's required attribution remains in the footer.

## Apply the update in VS Code

1. Download the plain `prototype-crpt-update.mjs` source script and place it inside `F:\dev\projects\prototype-crpt`, beside `package.json`.
2. In VS Code, open that project folder. Stop any running dev server with **Ctrl+C**.
3. Open the script to review it. It contains the complete project source as readable JavaScript strings and creates a dated sibling backup of existing project files before replacing them. Git history and local environment settings are retained.
4. In Terminal, run each command separately and stop if one fails:

```powershell
cd F:\dev\projects\prototype-crpt
```

```powershell
node .\prototype-crpt-update.mjs
```

5. If dependencies are missing, or the script reports that package files changed, install:

```powershell
npm ci --include=dev
```

If Windows reports `EBUSY`, stop dev servers and close the editor. Restart Windows if the file remains locked, reopen the project and retry the installation. Wait for a successful installation before continuing. A missing `tsc` after a failed installation means dependencies are incomplete.

6. Run the tests:

```powershell
npm test
```

7. Build:

```powershell
npm run build
```

8. Start the local website:

```powershell
npm run dev
```

9. Open the Local URL printed in Terminal, usually `http://localhost:5173`. This command serves both the app and its local API. Check **Live crypto**, MNT/USD/EUR, the quote type/date and the Light/Dark/Auto controls.

## Upload to GitHub

Stop the dev server with **Ctrl+C**. Run each command separately:

```powershell
git add src server api tests public index.html package.json package-lock.json README.md vite.config.ts tsconfig.json vercel.json .env.example .gitignore
```

```powershell
git commit -m "Add live prices single-bank currency fallback and theme controls"
```

```powershell
git push origin main
```

The existing repository is `https://github.com/chki1/prototype-crpt.git`. If the remote still contains the earlier username placeholder, correct it once with:

```powershell
git remote set-url origin https://github.com/chki1/prototype-crpt.git
```

Then repeat the push. A successful push is followed by a Vercel deployment when the repository is connected.

## Deploy and verify on Vercel

1. Open the existing `prototype-crpt` project, then **Deployments**.
2. Find the pushed commit and wait for **Ready**. Open the production URL and refresh with **Ctrl+F5**.
3. If importing for the first time, choose the `chki1/prototype-crpt` repository, **Vite**, output directory `dist`, build `npm run build`, and install `npm ci`. The root directory must contain `package.json`.
4. Add `/api/market?resource=rates&feed=auto-v1` after the deployed site's domain. A healthy response has `rates.MNT`, `quoteDate`, and `rateType` equal to `reference` or `bank-transfer-sell`.
5. Confirm that USD→MNT equals `rates.MNT`. The visible FX label must match `rateType`: **Daily reference** or **Bank sell**. Check all three display currencies and compare the quote date with the returned API data.
6. If the endpoint returns 503, inspect the response and the deployment's function logs. Both upstreams are external dependencies and can time out. Saved values are labeled; missing data stays empty.
7. Enable **Analytics** and **Speed Insights** in this Vercel project if needed, then redeploy after activation and visit the production site. Allow time for real traffic to appear.

## Data flow and caching

The fiat loader in `server/currency-fallback.ts` first requests the official daily feed with a 9-second timeout. After a network, HTTP, validation or freshness failure, it requests one fixed bank page with a 6-second timeout. The whole sequence stays below the function's 20-second limit. It validates the dated table, the non-cash buy/sell column order, every required currency and the spread before accepting the sell prices. Provider names stay in server metadata for diagnosis, rather than the public currency UI.

All rates are normalized to the existing per-USD representation. If `S_USD` is MNT per USD and `S_CNY` is MNT per CNY in the chosen snapshot, `rates.MNT = S_USD`, `rates.USD = 1` and `rates.CNY = S_USD / S_CNY`. No cells from different banks or dates are combined.

Primary successes cache for one hour. Bank fallbacks cache for 15 minutes before trying the primary again. Concurrent HTTP requests share one upstream operation. When both upstreams fail, the last successful official quote can be kept for up to seven days and a saved bank fallback for up to one day, clearly marked stale. The browser checks every 15 minutes while visible. A new cache key avoids labeling old browser/provider data as the new feed.

Cryptocurrency prices use Kraken WebSocket v2 USD pairs. Updates arrive on exchange trades and UI updates are coalesced for up to 200 ms. A response watchdog reconnects a silent connection; retries use backoff. Hidden/offline tabs pause and reconnect when active. Disconnected stream quotes are stale, expire after two minutes, then use available reference quotes. USDT uses its actual USD pair.

CoinGecko supplies historical charts, sparklines, market capitalization and optional reference quotes. An optional `COINGECKO_DEMO_API_KEY` belongs in `.env.local` locally and Vercel's server environment. Fiat and public live crypto feeds need no key. Historical MNT/EUR charts apply the latest FX basis to the whole USD series; they do not reconstruct historical daily FX.

## Checks and files

The test suite covers conversion math, missing/invalid data, dated bank table validation, one-bank fallback isolation, primary recovery, caching, stale expiry, WebSocket parsing/reconnect/cleanup and theme transitions. Run `npm test` and `npm run build` after code changes.

| File | Purpose |
| --- | --- |
| `server/currency-fallback.ts` | Primary request and one-bank fallback |
| `server/bank-of-mongolia.ts` | Official daily-feed adapter |
| `server/market-service.ts` | HTTP API cache, history/reference data and errors |
| `src/lib/live-feed.ts` | Socket validation, subscription and reconnect behavior |
| `src/lib/useLivePrices.ts` | React socket lifecycle |
| `src/components/ThemeControl.tsx` | Single Light/Dark and green Auto buttons |
| `src/components/CurrencyControl.tsx` | Top-right display currency selector |
| `src/App.tsx` | Dashboard layout and neutral rate labels |
| `src/theme.css` | Theme colors and glass controls |
| `api/market.ts` | Vercel function entry point |

The bank's public HTML format can change. The adapter fails closed on a missing/reordered table instead of selecting the wrong price column. Verify the live API after deployment; a passing build or test suite alone does not prove upstream availability from Vercel.
