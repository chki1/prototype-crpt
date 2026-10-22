# prototype crpt

A personal market dashboard with a night-sky dark theme, a soft sky light theme and iOS 27 inspired glass controls. Built with React, TypeScript and Vite, with a small Vercel API function.

## What is included

- A midnight-purple dashboard with a star field, drifting aurora, shooting stars, a floating planet, chart animations and hover effects.
- Automatic system light/dark appearance, with a System / Light / Dark selector. System mode responds immediately when the device theme changes; manual overrides are remembered.
- Frosted widgets, pill-shaped buttons, segmented controls, edge highlights and spring-like press feedback. Prices, native selects, chart lines, dialogs and navigation adapt to both themes.
- 12 world currencies displayed as the MNT value of **1 unit**: USD, EUR, CNY, JPY, KRW, GBP, RUB, AUD, CAD, CHF, SGD and HKD.
- 10 cryptocurrencies with USD and MNT prices, real 24-hour changes, market caps and seven-day sparklines.
- Historical crypto charts with 1-day, 7-day and 30-day periods, pointer tooltips and keyboard arrow-key inspection.
- A converter for currencies, MNT and crypto, including reverse conversion and a copy button.
- Search, category filters, sorting and favorites saved in this browser.
- Responsive desktop/mobile layouts, an accessible mobile menu, a motion toggle and support for reduced-motion preferences.
- A Vercel function that caches provider responses and keeps an optional API key on the server.
- Explicit loading, unavailable and saved-data states. The application never substitutes fabricated quotes.

## Apply this update to an existing copy

1. Extract the updated ZIP into a temporary folder.
2. Copy the **contents** of its `prototype-crpt` folder into your existing `F:\dev\projects\prototype-crpt` folder and replace matching project files. Keep your existing `.git` folder and `.env.local`.
3. This appearance update adds no new dependencies. In VS Code, stop a running dev server with Ctrl+C and start it again with `npm run dev`.
4. Run `npm test` and `npm run build`.
5. Follow section 4 below to commit and push the update to your existing GitHub repository. Vercel then builds the updated site.

Use the full installation steps below if you have not set up the project yet.

## 1. Set up in VS Code on Windows

### 1.1 Check Node and Git

Install a current Node.js LTS release from <https://nodejs.org> if needed. Node 24 is a good choice; this project requires Node 22.12 or newer. Install Git from <https://git-scm.com/downloads/win> if it is missing.

In a VS Code terminal, check:

```powershell
node --version
npm --version
git --version
```

Reopen VS Code after installing Node or Git so the new commands are available.

### 1.2 Extract the project

1. Download `prototype-crpt.zip`.
2. Right-click the ZIP in File Explorer and choose **Extract All**.
3. Choose `F:\dev\projects` as the extraction destination. The ZIP already contains a folder named `prototype-crpt`.
4. Confirm that `F:\dev\projects\prototype-crpt\package.json` exists. If the extraction tool added an extra outer folder, move the inner `prototype-crpt` folder into `F:\dev\projects`.
5. In VS Code, choose **File → Open Folder**, then open `F:\dev\projects\prototype-crpt`.

This is a complete new project. Open its folder rather than copying only `App.tsx` into the earlier crypto tracker.

### 1.3 Install and run

Choose **Terminal → New Terminal**. Run:

```powershell
cd F:\dev\projects\prototype-crpt
npm ci
npm run dev
```

`npm ci` installs the exact package versions from the included lockfile. It is normal for `node_modules` to be absent before this step.

Open the Local URL printed in the terminal, normally:

```text
http://localhost:5173
```

Keep that terminal running while you use the local website. If that port is in use, Vite prints another available port; use the printed URL.

**Use `npm run dev`, not VS Code Live Server or a double-click on `index.html`.** The dev command runs both the React app and its local market-data endpoint.

### 1.4 Try the features

1. Check the USD card: it shows how many tögrög correspond to **1 USD**.
2. Set the converter to USD → MNT and enter `100`.
3. Click **Swap currencies**, then enter an amount in MNT to convert back to USD.
4. Try CNY, EUR, KRW or Bitcoin in the converter.
5. Select another cryptocurrency or choose 1D, 7D or 30D in the chart.
6. Search for an asset name or code. Search is a substring match, so `USD` also matches `USDT`.
7. Click a star to save or remove a favorite. Check **Watchlist**.
8. Toggle **Ambient motion** in the sidebar or mobile menu.

Prices require an internet connection and a response from the data providers. A blank value means unavailable data; a saved-data notice means an older real response is being shown.

### 1.5 Verify before uploading

In a second terminal in the same folder, run:

```powershell
npm test
npm run build
```

The tests cover conversion formulas, reverse and cross-currency conversion, missing data, API validation, caching and provider failures. The build also runs TypeScript checks.

Appearance checks also cover the initial system theme, saved manual overrides, native-control colors and unavailable or malformed browser storage.

If you use the same terminal as the dev server, press **Ctrl + C** first. Start it again later with `npm run dev`.

### 1.6 Choose an appearance

Find **Appearance** near the bottom of the desktop sidebar, or open the menu on mobile:

- **System** is the default. It follows your device or browser's light/dark preference, including changes while the website is open.
- **Light** keeps the bright, frosted sky appearance.
- **Dark** keeps the midnight sky appearance.

The active mode is remembered in this browser. Selecting System again resumes automatic switching. On Windows, you can test automatic switching from **Settings → Personalization → Colors → Choose your mode**. The site uses the light/dark preference exposed by the browser.

The saved theme is applied before the first paint to avoid a flash of the opposite theme on reload. Reduced-motion preferences remain supported; browsers that support reduced transparency get more opaque surfaces.

## 2. Put the project on GitHub

### 2.1 Create an empty repository

1. Open <https://github.com/new> and sign in to your account.
2. Repository name: **prototype-crpt**.
3. Choose Public or Private according to your preference.
4. Leave **Add a README**, **Add .gitignore**, and **Choose a license** unset for this first upload. This project already has its own README and ignore file.
5. Click **Create repository**.
6. Copy the repository's HTTPS URL from the Quick setup page.

The display name is `prototype crpt`; the folder and repository use `prototype-crpt`.

### 2.2 Upload from the VS Code terminal

Run these commands from the folder containing `package.json`:

```powershell
cd F:\dev\projects\prototype-crpt
git init -b main
git add .
git commit -m "Create prototype crpt market dashboard"
```

Then replace `YOUR_USERNAME` with your actual GitHub username, or paste the exact URL copied from GitHub:

```powershell
git remote add origin https://github.com/YOUR_USERNAME/prototype-crpt.git
git push -u origin main
```

If Git opens a browser authentication window, sign in to the same GitHub account that owns the repository. Do not use your GitHub password as a Git token in a terminal.

If Git reports **Author identity unknown**, set your commit identity for this repository and repeat the commit:

```powershell
git config user.name "Your Name"
git config user.email "YOUR_GITHUB_COMMIT_EMAIL"
git add .
git commit -m "Create prototype crpt market dashboard"
git push -u origin main
```

Use your verified email or GitHub-provided noreply commit email. These placeholder values must be replaced.

Refresh your repository page. It should show `src`, `server`, `api`, `package.json`, `package-lock.json`, `vercel.json` and this README. `node_modules`, local secrets and build output are intentionally ignored.

## 3. Deploy on Vercel

### 3.1 Import the repository

1. Open <https://vercel.com>.
2. Sign in with GitHub.
3. Choose **Add New → Project**.
4. Find **prototype-crpt** under Import Git Repository and click **Import**.
5. If it is missing, adjust Vercel's GitHub repository access so it can see this repository.

### 3.2 Confirm build settings

| Setting | Value |
| --- | --- |
| Project name | `prototype-crpt` |
| Framework preset | **Vite** |
| Root directory | `./` — the directory containing `package.json` |
| Install command | `npm ci` |
| Build command | `npm run build` |
| Output directory | `dist` |
| Node.js version | **24.x**, or another supported version satisfying the package's engine requirement |

The included `vercel.json` already supplies the framework, install command, build command and output directory. Usually you only need to confirm the detected settings.

### 3.3 API keys

Currency rates use the open ExchangeRate-API endpoint and do not need a key.

Crypto tries CoinGecko's keyless access by default. If it repeatedly reports rate limiting, create a free **Demo** API key at <https://www.coingecko.com/en/api>.

In Vercel, add this environment variable for Production and Preview:

| Name | Value |
| --- | --- |
| `COINGECKO_DEMO_API_KEY` | Your own CoinGecko Demo API key |

Use this exact server-only name, with **no `VITE_` prefix**. The code sends it from the server in the `x-cg-demo-api-key` header. A paid Pro key uses a different CoinGecko endpoint and is not a drop-in substitute for a Demo key here.

You can deploy without adding a key and add it later if needed. After adding or changing an environment variable on an existing deployment, redeploy the project.

For local development with a Demo key:

```powershell
Copy-Item .env.example .env.local
```

Open `.env.local`, add your key after `COINGECKO_DEMO_API_KEY=`, save, and restart `npm run dev`. The local environment file is ignored by Git.

### 3.4 Publish and check

1. Click **Deploy**.
2. Wait for the build to reach **Ready**.
3. Open the deployment URL returned by Vercel.
4. Check USD → MNT and a crypto chart.
5. If the page loads but prices do not, open the deployment's `/api/market?resource=rates` path. A working response includes a `rates` object with `MNT`.
6. Check `/api/market?resource=crypto` to verify CoinGecko. For a 503, check the returned message and Vercel's function logs; add a Demo key if the provider is rate limiting requests.

Deploy the **whole repository**, including `api` and `server`. Uploading only `dist` to static hosting will not include the market API.

## 4. Publish later changes

Edit the relevant source files in VS Code and check the result locally. Then run:

```powershell
npm run build
git add .
git commit -m "Update prototype crpt design"
git push origin main
```

Vercel's Git integration automatically creates a new deployment from pushes to the connected production branch. If an update does not appear, check that branch in Vercel's deployment list and look at its build result.

## 5. Make the website yours

| File | What to change |
| --- | --- |
| `src/config.ts` | Display name, supported fiat currencies and crypto IDs |
| `src/App.tsx` | Hero copy, navigation labels, dashboard layout, featured cards |
| `src/styles.css` | Layout, fonts, spacing, stars, aurora, planet and animations |
| `src/theme.css` | Light/dark color tokens, glass surfaces, pill controls and theme-aware chart colors |
| `src/components/ThemeControl.tsx` | System / Light / Dark selector and keyboard navigation |
| `src/lib/useTheme.ts` | Device-theme change listener, preference persistence and appearance synchronization |
| `src/components/Converter.tsx` | Converter layout and labels |
| `src/components/PriceChart.tsx` | Chart appearance and tooltips |
| `src/components/DataDialog.tsx` | Source explanations |
| `index.html` | Browser title, description and appearance bootstrap before first paint |
| `public/favicon.svg` | Browser icon |
| `server/market-service.ts` | Provider integration, response validation and caching |
| `api/market.ts` | Vercel API entry point |
| `vite.config.ts` | Local development and preview API support |

The CSS variables in `src/theme.css` control the appearance. The first block defines dark colors; the `[data-theme='light']` block defines light colors. The font stack uses Google Fonts with local system-font fallbacks. This app uses ordinary React components and CSS; Headless UI and Tailwind are not dependencies.

## 6. How the rates work

ExchangeRate-API responds with amounts per USD. If `MNT` is the amount of tögrög per USD and `CNY` is the amount of yuan per USD:

```text
MNT per 1 USD = rates.MNT
MNT per 1 CNY = rates.MNT / rates.CNY
MNT per 1 BTC = bitcoin.priceUsd * rates.MNT
Converted amount = amount * MNT_per_source_unit / MNT_per_target_unit
```

The UI always displays each rate per **one source unit**, including JPY and KRW. It does not silently switch to 100-yen or 1,000-won units.

- **Fiat source:** ExchangeRate-API's open endpoint. Quotes update daily; the app checks hourly and respects the provider's next-update time where possible.
- **Crypto source:** CoinGecko. The page refreshes prices every five minutes while visible; chart responses are cached for 15 minutes.
- **Crypto charts:** Actual historical USD timestamp/price pairs. MNT prices use the latest daily FX rate; the chart does not claim to show historical USD/MNT rates.
- **Freshness:** Provider update timestamps and saved-data notices are visible. Server memory/CDN caching and browser caching reduce repeat requests; caching and quotas do not guarantee uninterrupted upstream availability.
- **Rate type:** Indicative reference rates. They are not official Bank of Mongolia quotes or a commercial bank's buy/sell offer.
- **Privacy:** Favorites, appearance and the motion setting are stored locally in the browser. This project has no accounts, database or visitor-tracking feature.

## 7. Common fixes

| Problem | What to do |
| --- | --- |
| `npm` or `node` is not recognized | Install Node, then close and reopen VS Code. |
| PowerShell blocks `npm.ps1` | Use `npm.cmd ci`, `npm.cmd run dev` and `npm.cmd run build`. |
| Cannot find React or a module | Run `npm ci` from the folder containing `package.json`; then restart VS Code's TypeScript server if needed. |
| Unexpected TypeScript warnings in the editor | With a `.tsx` file open, run **TypeScript: Select TypeScript Version → Use Workspace Version** from Ctrl+Shift+P. |
| `Repository not found` | Confirm the repository exists under the signed-in account and check `git remote -v`. Use the exact HTTPS URL copied from its GitHub page. |
| `remote origin already exists` | Inspect `git remote -v`; if it is the wrong repository, correct it with `git remote set-url origin YOUR_CORRECT_REPOSITORY_URL`. |
| Vercel cannot find `package.json` | Set Root Directory to the repository directory containing that file. |
| Website works locally, but `/api/market` is 404 on Vercel | Verify `api/market.ts` and `server` were committed. Deploy the complete repository with the included Vercel configuration. |
| Crypto quotes are unavailable or rate limited | Retry later, or add a CoinGecko Demo key under the exact environment-variable name above and redeploy. |
| Currency values differ from your bank | The app uses reference rates; banks apply their own buy/sell spreads. |

## Official references

- [Vite setup and Node requirements](https://vite.dev/guide/)
- [Adding a local project to GitHub](https://docs.github.com/en/migrations/importing-source-code/using-the-command-line-to-import-source-code/adding-locally-hosted-code-to-github)
- [Vite on Vercel](https://vercel.com/docs/frameworks/frontend/vite)
- [Vercel Node functions](https://vercel.com/docs/functions/runtimes/node-js)
- [ExchangeRate-API open endpoint](https://www.exchangerate-api.com/docs/free)
- [CoinGecko market data](https://docs.coingecko.com/demo/reference/coins-markets)
- [CoinGecko historical charts](https://docs.coingecko.com/demo/reference/coins-id-market-chart)
