# CLAUDE.md: SolarCharge

## What this is
PWA with a Polish UI that tells the owner (Kuba, uses it on an iPhone from the home screen) when to charge a Tesla Model Y LR from home PV surplus, and can automate it. Data comes from the Solarman OpenAPI (Sofar hybrid inverter + Solarman Wi-Fi logger + home battery), the Tesla Fleet API (car state + charge commands) and Open-Meteo (PV forecast).
Live at https://kubaosmola-dev.github.io/solarcharge/ (GitHub Pages, public repo, branch `main`).

## Hard constraints
- **Static site.** No build step, no npm, no bundler or framework, no new runtime dependencies. The whole app is `index.html` (inline CSS + vanilla JS, `'use strict'`). The only external resource is Google Fonts (DM Mono, Syne), and the app must still work without it.
- **Subpath-safe.** The app is served under `/solarcharge/`, so keep every path relative (`manifest.json`, `sw.js`, `icons/...`, `./?action=charge`). The manifest `id` is `/solarcharge/`.
- **Polish.** All UI text, toasts, error messages and code comments are in Polish (`lang="pl"`, `pl-PL` time formatting).
- **Zero setup for the owner.** Changes must work by pushing to `main` and opening the page. Never require him to install anything. If something truly needs a server (CORS proxy, tesla-http-proxy, LAN bridge), call it out as a separate component.
- **Never commit secrets** (Solarman App ID / App Secret / e-mail / password hash, Tesla token, VIN, station ID). The credential fields in `DEF` must stay empty strings. Users enter credentials under Ustawienia, and they are stored only in `localStorage` key `solarcharge.v2` as plain JSON. The Solarman password is saved as a SHA-256 hex string (`pwHash`), and that hash *is* the login credential. The forecast cache is in `solarcharge.v2.fc`.
- Do not rename `KEY` (`solarcharge.v2`) without a migration, or the user's saved settings and credentials are wiped.
- The localStorage origin `kubaosmola-dev.github.io` is shared with every other Pages site of this account. Never add untrusted scripts or CDNs.
- There is no `.nojekyll` or `_config.yml`, so Pages runs Jekyll and may serve Markdown files (README.md, this file) publicly as HTML. Never put private info in any file.

## Files & architecture
- `index.html`: the whole app. Script sections are marked `// ── Name ──` (search for these):
  - `<style>`: theme variables in `:root`. HTML views: `<!-- ═══ TERAZ ═══ -->` `#v-now`, `<!-- ═══ PLAN ═══ -->` `#v-plan`, `<!-- ═══ USTAWIENIA ═══ -->` `#v-set`. Also bottom `nav` (`data-v`), SYM/LIVE switch `#modeSeg` and status pills `#pillSolar #pillTesla #pillFc`.
  - `Stałe`: `EFF` 0.9, `KM_PER_KWH` 7.1, `BATT_KWH` 75, `KM_PER_PCT` 5.33, `KW_PER_A` 0.69 (3 ph × 230 V), `SIM_HOME_BATT_KWH` 10. `DEF` holds the defaults: pvPeak 28, homeAvg 4.5, lat/lon 50.06/19.94, target 80, minSurplus 3, maxAmps 16, battFirst, battMaxKw 5. `S` = persisted settings (`load()`/`save()`), `L` = current state in kW.
  - `Prognoza PV`: `clearSkyDay`, `fcDay`, `pvAt`, `loadForecast` (30 min cache, falls back to the clear-sky model).
  - `Logika nadwyżki`: `startKw()`, `isCharging()`, `available()`, `windows()`, `nextWindow()`.
  - `Symulacja`: `simTick` (runs every 3 s, and each tick is 1 min of simulated battery state).
  - `Automatyka`: `autoStep()`, `chargeCmd(kind, reason, amps)` (kind = start | stop | amps).
  - `Tesla Fleet API`: `tesla()`, `teslaPoll()`. `Solarman OpenAPI`: `sha256`, `sm()`, `solarPoll()`.
  - `Tryb`: `setMode('sim'|'live')`, which owns all polling timers. `Powiadomienia`: `maybeNotify()`.
  - `Widok: Teraz`: `render()`, `renderRec()` (recommendation card; the button action is in `#recBtn` `data-act`). `Widok: Plan`: `renderPlan()` (inline SVG).
  - `Widoki i ustawienia`: `show`, `fillSettings`, `bindNum` (accepts a decimal comma) and the event handlers. `Start`: boot sequence and SW registration (skipped on `file://`).
- `sw.js`: offline cache and notification click handling. `manifest.json`: PWA config. `icons/`: 192, 512 (also maskable) and apple-touch 180. `README.md`: user-facing docs in Polish.

## Data sources & APIs
**Solarman OpenAPI.** Base URL is `S.solar.url`, default `https://globalapi.solarmanpv.com`.
- `POST /account/v1.0/token?appId=…&language=en` with body `{appSecret, email, password: <sha256>}` returns `access_token`. The token is kept in memory (`smTok`), renewed 60 s before `expires_in`, and cleared on a 401. Requests send `Authorization: bearer <token>`.
- `POST /station/v1.0/list` is called only when stationId is empty. It takes the first station and saves it.
- `POST /station/v1.0/realTime {stationId}`, polled every 120 s. Fields used: `generationPower`, `usePower`, `chargePower`/`dischargePower` (fallback `batteryPower`), `batterySoc`, `lastUpdateTime` (seconds). Power values are W and get divided by 1000.
- Caveats in the code: the sign of batteryPower/gridPower is undocumented, so the code uses the separate charge/discharge fields. Grid power is *computed* from the balance, not read. `L.home = usePower − Tesla kW` assumes the wallbox is inside the measured home consumption.

**Tesla Fleet API.** Base URL is `S.tesla.url`, default `https://fleet-api.prd.eu.vn.cloud.tesla.com`. It can point at tesla-http-proxy or a CORS proxy instead.
- `GET /api/1/vehicles/{VIN}/vehicle_data?endpoints=charge_state` runs every 300 s (every call costs money) and 20 s after each command.
- `POST /api/1/vehicles/{VIN}/command/` + `set_charge_limit {percent}`, `set_charging_amps {charging_amps}`, `charge_start`, `charge_stop`. Model Y accepts only signed commands, so these go through tesla-http-proxy. An error containing "command protocol" is turned into that hint.
- The Bearer token is pasted by hand. There is no OAuth or refresh flow. A 401 is shown as "expires after ~8 h", and a 408 means the car is asleep (the app never sends `wake_up`).

**Open-Meteo:** `api.open-meteo.com/v1/forecast?…&hourly=shortwave_radiation&timezone=auto&forecast_days=3`. Hour h uses the value at h+1. kW = pvPeak × GHI / 850, capped at pvPeak.

Failed fetches are reported as "probably CORS, you need a proxy" (`netErr`). The "Adres API" fields accept a proxy URL.

## LIVE safety rules (must not break)
These live in `autoStep`, `chargeCmd`, `teslaPoll`, `setMode` and `available`:
1. Automation acts only on fresh data: Solarman `L.ts` at most 15 min old and Tesla `L.tTs` at most 12 min old.
2. After any command it waits until Solarman reports data newer than `lastCmd`.
3. Only one command runs at a time (`cmdBusy`). Amps change at most once per 120 s, with a deadband: they only change if |want − current| ≥ 2 A.
4. Start sends `set_charge_limit` = target first (so the car stops by itself if iOS suspends the app), then the amps, then `charge_start`. Errors meaning "already set / is_charging / complete / not_charging" are tolerated.
5. After a command error, `cmdBlockedUntil` backs off 5, 10, 20, 40 … up to 120 min, because Fleet commands are paid. Saving the Tesla settings resets it.
6. Amps are clamped to 5..maxAmps. `startKw()` = max(minSurplus, 5 A × 0.69 ≈ 3.45 kW). On low sun (surplus < 2.45 kW) it drops to 5 A and stops only after 3 consecutive low readings. It also stops at SOC ≥ target.
7. `teslaPoll` throws away a reading if a command was sent while it was in flight (`lastCmd > t0`).
8. Switching to LIVE never carries over simulated car state (`tState = 'Unknown'`) and resets `lastCmd`, `cmdFails` and `cmdBlockedUntil`. Manual Stop or "Ładuj mimo to" turns automation off.
9. `available()` never counts home-battery discharge or grid import as surplus. With `battFirst`, `battMaxKw` is reserved for the home battery until it is full (counts as full at 99 % and as not full again below 97 %; unknown SOC counts as full).
10. Automation runs only while the page is open. The home-battery 10 % floor exists only in the simulation: the app never writes inverter settings.
- Known gap: during the `cmdBlockedUntil` backoff the low-sun stop is skipped too, so the car can keep charging from the battery or grid up to its charge limit.

## Service worker
- `const CACHE = 'solarcharge-vN'` (currently **v3**). **Bump N whenever any cached file changes** (index.html, manifest.json, icons, sw.js) or `ASSETS` changes. Add new files to `ASSETS`.
- `activate` deletes only caches starting with `solarcharge-`. Keep that prefix filter, because the origin is shared.
- Navigation requests go network-first, saving the copy as `./index.html` for offline use. Other same-origin GETs use stale-while-revalidate. Cross-origin and non-GET requests (all API calls) bypass the SW.
- The `push` handler exists, but nothing subscribes to push. Notifications are local (`reg.showNotification`) and only fire while the app is open.

## Testing (manual)
- Syntax check: extract the `<script>` body and run `node --check`, run `node --check sw.js`, and validate manifest.json as JSON.
- Serve locally (`python3 -m http.server` in the repo, then open `http://localhost:8000/`). `crypto.subtle` (needed to save the Solarman password) and the SW need https or localhost. `file://` works, but without the SW.
- SYM mode: the Teraz tiles update every 3 s. Turning on Automatyka gives start/amps/stop toasts marked "(symulacja)". Also check the Plan DZIŚ/JUTRO chart and windows, that settings survive a reload, that `?action=charge` scrolls to the recommendation, and that there are no console errors.
- Never test LIVE commands against the real car without the owner. Never hard-code test credentials.
- Before pushing: CACHE bumped, Polish copy, relative paths, narrow-phone layout (safe-area, `max-width:370px` rule).

## Deploy
Commit and push to `main`, and GitHub Pages publishes it (deploy from branch; there is no Actions workflow in the repo). Users get the new page on their next online load.

## Open threads
- Hand-pasted Tesla token (~8 h); there is no refresh flow.
- LIVE probably needs a CORS proxy plus tesla-http-proxy for commands. Neither is in this repo.
- The SW `push` handler is unused (there is no push server or subscription).
- The low-sun stop is blocked during the error backoff (see above).
- Future wish: read the inverter/logger locally on the LAN instead of the Solarman cloud. A browser can't open raw TCP, so this needs a small local bridge that serves HTTP with CORS.
