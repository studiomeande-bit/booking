# Migration Plan

## Phase 1

- Preserve current Apps Script code inside `appscript/`
- Freeze current production references
- Prepare frontend/build/deploy skeleton

## Phase 2

- Extract customer booking dependencies from current `index.html`
- Extract customer select dependencies from current `select.html`
- Define API response contracts

## Phase 3

- Add customer JSON API routing to Apps Script
- Keep admin HTML flow working unchanged

## Phase 4

- Build booking frontend for Netlify
- Build select frontend for Netlify

## Phase 5

- Connect GitHub repository to two Netlify sites
- Configure custom domains in Netlify and IONOS

## Phase 6

- End-to-end testing
- Production rollout
