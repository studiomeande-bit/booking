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

## Next

4. Calendar performance follow-up
- measure current month / next month / third month load gap
- tune month-summary cache TTL
- refine background prefetch order
- reduce visual confusion while loading later months

5. Select real-session verification
- open existing session link
- restore existing submission
- submit update flow
- extra prints / extra retouch totals
- success screen / invoice number / drive link confirmation

6. Mail content cleanup
- reduce repeated text across pending / confirmed / follow-up mails
- unify Korean / English / German tone
- verify pre-wedding / passport infant / dol guide content balance

## Later

7. Corporate / Event product redesign
- split photo vs video more clearly
- separate wedding / registry wedding / dol / corporate use cases if needed
- improve consultation payload structure without exposing pricing

8. Final design pass
- booking success screen polish
- select design alignment with booking
- spacing / typography consistency review
- mobile safe-area and in-app browser polish

9. Ops checklist refresh
- deployment notes
- known caveats
- regression checklist
- admin dirty-file warning

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
