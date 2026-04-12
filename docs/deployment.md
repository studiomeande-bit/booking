# Deployment

## Netlify sites

This repository is used by two separate Netlify sites.

### Booking site

- Domain: `booking.studio-mean.com`
- Netlify site: `friendly-cucurucho-15e97a`
- GitHub repo: `studiomeande-bit/booking`
- Branch: `main`
- Base directory: `frontend/booking`
- Publish directory: `.`
- Build command: leave empty

### Select site

- Domain: `select.studio-mean.com`
- Netlify site: `iridescent-biscotti-e27dfb`
- GitHub repo: `studiomeande-bit/booking`
- Branch: `main`
- Base directory: `frontend/select`
- Publish directory: `.`
- Build command: leave empty

## Netlify environment variables

Set on both sites:

- `API_BASE_URL=https://script.google.com/macros/s/AKfycbxnHuB2u4-pDD23JDdFDpHB0ZIzGxLWm15Xgc7_-qkyOTctNpGlYDMIcQyq4KB7QC6X8w/exec`
- `SITE_MODE=production`

## Apps Script deployment

From `appscript/`:

```bash
clasp push
clasp deploy
```

Recommended:

- keep one production deployment for customers and admin
- update versions instead of creating unrelated new scripts

## Notes

- `booking` and `select` are intentionally self-contained static folders so each Netlify site can publish independently
- shared frontend helpers are duplicated per site on purpose at this stage to avoid cross-directory publish issues
