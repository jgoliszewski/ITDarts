@echo off
rem ITDarts: builds the web app, starts the server and opens the kiosk browser.
cd /d "%~dp0"
if not exist node_modules call npm install
call npm run kiosk
