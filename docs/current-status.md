# Current Status

Updated: 2026-04-12 Europe/Berlin

## Live Endpoints

- Booking frontend: `https://booking.studio-mean.com`
- Select frontend: `https://select.studio-mean.com`
- Apps Script web app: `https://script.google.com/macros/s/AKfycbxnHuB2u4-pDD23JDdFDpHB0ZIzGxLWm15Xgc7_-qkyOTctNpGlYDMIcQyq4KB7QC6X8w/exec`

## Repositories / IDs

- GitHub repo: `https://github.com/studiomeande-bit/booking`
- Apps Script Script ID: `1AETZGNAJEe2X1MKclKMmQv_Jr_Z2MgJIUAzlis-Y4HwQBbf11rFX1sJa`
- Spreadsheet ID: `1STWAMt30xku--NnFDHp1WOgpdGNQCH8T9Y0mZP6H8fI`

## Current Structure

- Frontend booking:
  - `frontend/booking/index.html`
  - `frontend/booking/booking.js`
  - `frontend/booking/booking.css`
- Frontend select:
  - `frontend/select/index.html`
  - `frontend/select/select.js`
  - `frontend/select/select.css`
- Apps Script backend/admin:
  - `appscript/Code.gs`
  - `appscript/Admin.html`

## What Is Working

- Netlify static booking/select pages are connected to Apps Script public JSON APIs.
- Booking flow is split into category -> package -> date -> time -> booking details.
- Passport flow hides AI consent, marketing consent, and select-all-required rows.
- Booking submit readiness now checks:
  - product/date/time
  - name/phone/email
  - GDPR
  - AI consent for non-pass flows
  - location for outdoor/pre-wedding
  - baby name when required
  - reshooting consent when required
  - passport country and other-country text when required
- Success result uses a card UI instead of raw text.
- Old Apps Script select links redirect to `select.studio-mean.com?id=...`.
- Backend still handles:
  - booking DB save
  - calendar event creation
  - customer/admin email send
  - admin update / reschedule / cancel flows

## Booking Rules Already Implemented

- Studio default people: 2
- Outdoor default people: 2
- Outdoor 1 person discount: `-30€`
- Outdoor 3+ people surcharge: `+30€` each extra person
- Outdoor options: pet, extra outfit
- Profile Basic:
  - infant disabled
  - senior weekday free
- Profile Business:
  - senior weekday `-50€`
- Profile Professional:
  - senior weekday `-50€`
  - senior Saturday `-30€`
- Kids discount `-10€`
- Background selection for profile/studio
- Background recommendations with outfit hints
- Passport add-on for profile/studio
- Baby/birthday flow:
  - baby name required where applicable
  - review and memo include baby name

## Most Recent Commits

- `5ca9729` Fix booking form return notice layout
- `b42c1e3` Use booking success card after submit
- `635c910` Tighten booking submit readiness checks
- `477a441` Improve booking submit readiness for passport flow

## Apps Script Deployment

- Latest confirmed deployment in prior work: `@243`
- Customer pages are redirected from Apps Script to Netlify domains.

## Remaining Work

### Booking frontend

- Final parity review against original `/Users/taewoongmin/index.html`
- Improve submit success UX further using returned quote/isReturn data
- Final mobile readability cleanup
- Review remaining package-specific copy / edge cases
- Additional calendar loading optimization if needed

### Select frontend

- Deep parity review against original select behavior
- Real session-based UX validation
- Existing submission restore/edit flow validation

### End-to-end verification

- Booking submit -> customer mail -> admin notification
- Admin edit / reschedule / cancel on records created from Netlify frontend
- Select link from old emails -> redirected select frontend -> submit/update flow

## Resume Instructions

When resuming, first inspect:

1. `docs/current-status.md`
2. `git log --oneline -10`
3. `frontend/booking/booking.js`
4. `appscript/Code.gs`

Then continue from:

- booking parity / end-to-end verification first
- select parity second

