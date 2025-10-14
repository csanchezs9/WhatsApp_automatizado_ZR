# Repository Guidelines

## Project Structure & Module Organization
The Node.js service entry point lives in `src/index.js`, wiring Express middleware and the `/webhook` route. HTTP routing is defined in `src/routes/whatsapp.js` and dispatches to `src/controllers/webhookController.js` for message handling. Domain logic and external integrations are grouped under `src/services/` (menu building, order flow, quotes, WhatsApp API). Shared assets such as promo copy live in `src/data/`. Operational references are kept in `docs/`, while helper automation sits in `scripts/setup-ngrok.ps1`. Ad-hoc simulation scripts (`test-bot.js`, `test-finalizar.js`, `test-casos-extremos.js`) remain at the repository root for quick manual testing.
IMPORTANT: DONT EDIT THE ECOMMERCE

## Build, Test, and Development Commands
- `npm install` - install Node dependencies; rerun after pulling service-level changes.
- `npm run dev` - start Nodemon for local development with automatic restarts.
- `npm start` - launch the production-style server used by hosting platforms.
- `node test-bot.js` (or other root test script) - replay a stored webhook payload against the local server.
- `.\scripts\setup-ngrok.ps1` - open an ngrok tunnel and print the callback URL for Meta configuration.

## Coding Style & Naming Conventions
Use two-space indentation, single quotes, and terminating semicolons to match existing CommonJS modules. Prefer `camelCase` for functions, variables, and filenames; reserve `PascalCase` for constructor-like utilities. Keep controller and service files focused on a single responsibility and favor small async functions with explicit returns. Log strings should remain ASCII-safe to avoid mojibake in Windows consoles. Environment constants stay uppercase with underscores (e.g., `WEBHOOK_VERIFY_TOKEN`).

## Testing Guidelines
There is no bundled test runner; rely on the simulated webhook scripts or crafted `curl` payloads while developing. Before pushing, run `npm run dev` and send representative messages through the test scripts to confirm menu flows, order creation, and error paths. Document manual scenarios in the PR description when adding new menu options or API calls, and capture console output or ngrok traces for regressions.

## Commit & Pull Request Guidelines
Follow the existing Conventional Commit style (`feat:`, `fix:`, `chore:`) with present-tense imperatives, keeping the summary under about 60 characters. Group related changes per commit; configuration edits and feature work should not mix. Pull requests should include: a concise change overview, screenshots or transcript snippets of WhatsApp interactions when UI text shifts, explicit test notes (which script or `curl` payloads ran), and links to Jira or issue trackers when applicable. Flag environment or migration steps under a dedicated Deployment notes subsection.

## Environment & Configuration
Keep secrets in `.env`; only commit updates to `.env.example` when adding new keys. Regenerate tokens through Meta and update the `start-dev.bat` helper if port defaults change. When touching axios clients in `src/services/`, centralize base URLs and timeouts to respect hosting constraints. Coordinate webhook token changes with the deployment checklist in `docs/` to avoid downtime.
