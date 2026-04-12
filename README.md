# Studio mean Reservation Platform

This repository is the new split structure for the Studio mean reservation platform.

## Structure

- `frontend/`
  - Netlify-hosted customer-facing sites
  - `booking.studio-mean.com`
  - `select.studio-mean.com`
- `appscript/`
  - Google Apps Script backend and admin ERP
- `docs/`
  - Architecture, API, deployment, and migration notes

## Current status

- Existing Apps Script production files were copied into `appscript/`
- Frontend split has not been implemented yet
- Customer pages still need to be rebuilt to remove Apps Script HTML/runtime dependencies

## Production references

- GitHub repository: `https://github.com/studiomeande-bit/booking`
- Apps Script Script ID: `1AETZGNAJEe2X1MKclKMmQv_Jr_Z2MgJIUAzlis-Y4HwQBbf11rFX1sJa`
- Apps Script Web App URL:
  - `https://script.google.com/macros/s/AKfycbxnHuB2u4-pDD23JDdFDpHB0ZIzGxLWm15Xgc7_-qkyOTctNpGlYDMIcQyq4KB7QC6X8w/exec`
- Spreadsheet ID: `1STWAMt30xku--NnFDHp1WOgpdGNQCH8T9Y0mZP6H8fI`

## Domain plan

- Booking frontend: `booking.studio-mean.com`
- Select frontend: `select.studio-mean.com`
- Admin ERP: Apps Script web app

## Deployment model

- Frontend: GitHub `main` push -> Netlify auto deploy
- Apps Script: `clasp push` + `clasp deploy`
