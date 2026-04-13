# Update Roadmap

Updated: 2026-04-13 Europe/Berlin

## Immediate

1. Business / Event customer UI cleanup
- remove visible hour-by-hour price table from booking customer detail panel
- keep only current selection summary and consultation message
- verify mail / success screen still avoid direct customer price exposure

2. Booking mobile and calendar polish
- tighten mobile footer layout
- refine month header spacing
- refine loading card size and hierarchy
- keep date/time on same page without auto-jump after time click

3. Booking end-to-end verification
- Netlify booking submit
- Google Sheets row creation
- Google Calendar event creation
- Apple Calendar reflection check
- customer mail delivery
- admin notification mail
- admin edit / reschedule / cancel

4. Lexware actual workflow validation
- send one real invoice via `📚 전송`
- sync payment status via `💶 상태`
- verify booking ledger / invoice sheet / accounting tab update consistently
- confirm receivables are driven by Lexware status when available

5. Receivables cleanup
- verify which rows should truly remain `미수금`
- remove false positives from local-only completed payments
- confirm contract deposit / balance payments show consistently

## Next

6. Calendar performance follow-up
- measure current month / next month / third month load gap
- tune month-summary cache TTL
- refine background prefetch order
- reduce visual confusion while loading later months

7. Select real-session verification
- open existing session link
- restore existing submission
- submit update flow
- extra prints / extra retouch totals
- success screen / invoice number / drive link confirmation

8. Mail content cleanup
- reduce repeated text across pending / confirmed / follow-up mails
- unify Korean / English / German tone
- verify pre-wedding / passport infant / dol guide content balance

## Later

9. Corporate / Event product redesign
- split photo vs video more clearly
- separate wedding / registry wedding / dol / corporate use cases if needed
- improve consultation payload structure without exposing pricing

10. Final design pass
- booking success screen polish
- select design alignment with booking
- spacing / typography consistency review
- mobile safe-area and in-app browser polish

11. Ops checklist refresh
- deployment notes
- known caveats
- regression checklist
- admin dirty-file warning

12. Optional finance expansion
- decide whether instant card sales also create Lexware documents
- if needed, add SumUp or bank CSV import path
- otherwise keep those flows as local-ledger + summary export only

## Done Recently

- booking/select split to Netlify
- booking wizard flow rebuilt
- month/day slot split
- product-specific guides added
- follow-up mails automated
- review + instagram links wired
- passport multi-country per person support
- passport single-product auto-open
- booking/select success screens rebuilt
- Lexware API key integration
- Lexware settings / connection test / invoice send / payment sync
- accounting summaries, DATEV/summary CSV, German export labels
- Lexware import diagnostics confirming `contacts exist but invoices/vouchers are currently 0`
