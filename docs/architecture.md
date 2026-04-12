# Architecture

## Target

- Customer booking UI runs on Netlify
- Customer select UI runs on Netlify
- Admin ERP stays on Google Apps Script HTML Service
- Business logic, Google Sheets, Calendar, Gmail, invoice logic remain in Apps Script

## Split boundary

### Frontend

- No `google.script.run`
- No Apps Script template syntax
- No server-side HTML injection from Apps Script
- Only `fetch()` based API calls

### Backend

- JSON API for customer flows
- Existing admin RPC flow remains operational
- Shared business logic stays in Apps Script helpers

## Planned frontend structure

```txt
frontend/
  booking/
    index.html
    booking.css
    booking.js
  select/
    index.html
    select.css
    select.js
  shared/
    api.js
    config.js
    utils.js
```

## Planned backend endpoints

- `GET /api/init`
- `GET /api/calendar-batch`
- `POST /api/booking`
- `GET /api/select-session`
- `POST /api/select-submit`
- `POST /api/select-update`

## Security

- CORS allowlist:
  - `https://booking.studio-mean.com`
  - `https://select.studio-mean.com`
- Signed select token
- Booking request ID / nonce
- Honeypot support
