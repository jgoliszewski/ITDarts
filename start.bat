@echo off
rem ITDarts: pulls the latest changes, builds the web app, starts the server and opens the kiosk browser.
cd /d "%~dp0"
rem Pull is best effort: no network, no git or local changes must not block the start.
set GIT_TERMINAL_PROMPT=0
for /f %%h in ('git rev-parse HEAD 2^>nul') do set OLD_HEAD=%%h
rem One block: cmd parses it whole, so a pull that rewrites this file cannot break the run.
(
  git pull --ff-only || echo Could not pull the latest changes, starting the current version.
  if defined OLD_HEAD git diff --quiet %OLD_HEAD% HEAD -- package-lock.json 2>NUL || call npm install
  if not exist node_modules call npm install
  call npm run kiosk
  exit /b
)
