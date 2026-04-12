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
- Public JSON API routing has been added to `appscript/Code.gs`
- Booking frontend now has a first static API-driven scaffold in `frontend/booking/`
- Select frontend is still pending full migration
- Admin ERP remains in Apps Script and is intentionally kept separate

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
- Netlify booking site base directory: `frontend/booking`
- Netlify select site base directory: `frontend/select`

## Current API routes

- `GET /exec/api/init`
- `GET /exec/api/calendar-batch?year=YYYY&month=M&totalDur=NN&itemGroup=GROUP`
- `POST /exec/api/booking`
- `GET /exec/api/select-session?id=SESSION_ID`
- `POST /exec/api/select-submit`
- `POST /exec/api/select-update`

## Deployment docs

- [Architecture](./docs/architecture.md)
- [API Spec](./docs/api-spec.md)
- [Deployment](./docs/deployment.md)
