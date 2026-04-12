# Public API Spec

Base URL:

`https://script.google.com/macros/s/AKfycbxnHuB2u4-pDD23JDdFDpHB0ZIzGxLWm15Xgc7_-qkyOTctNpGlYDMIcQyq4KB7QC6X8w/exec`

Apps Script web app path routing uses `/exec/api/...`.

## Response shape

Success:

```json
{
  "ok": true,
  "data": {}
}
```

Error:

```json
{
  "ok": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message"
  }
}
```

## GET /api/init

Returns:

- `products`
- `settings`
- `serverTime`

## GET /api/calendar-batch

Query params:

- `year`
- `month`
- `totalDur`
- `itemGroup`

Returns up to three months keyed by `YYYY_M`.

Each month payload includes:

- `unavail`
- `slotCounts`
- `slotsByDate`

## POST /api/booking

Request:

```json
{
  "requestId": "booking_123",
  "data": {
    "itemId": "pb",
    "date": "2026-04-20",
    "time": "10:00",
    "people": 1,
    "name": "Customer name",
    "phone": "+49...",
    "email": "customer@example.com",
    "address": "Street 1",
    "memo": "",
    "lang": "ko",
    "website": ""
  }
}
```

Notes:

- `requestId` is required for duplicate submission protection
- `website` is the honeypot field and must stay empty
- existing booking business logic is still handled by `processForm()`

## GET /api/select-session

Query params:

- `id`

Returns the existing `getSelectSession(sessionId)` payload.

## POST /api/select-submit

Request:

```json
{
  "requestId": "select_submit_123",
  "data": {
    "sessionId": "SESSION_ID",
    "submission": {}
  }
}
```

Internally maps to `submitPhotoSelection(sessionId, submission)`.

## POST /api/select-update

Request:

```json
{
  "requestId": "select_update_123",
  "data": {
    "sessionId": "SESSION_ID",
    "submission": {}
  }
}
```

Internally maps to `updatePhotoSelection(sessionId, submission)`.

## Allowed origins

- `https://booking.studio-mean.com`
- `https://select.studio-mean.com`
- `http://localhost:5173`
- `http://127.0.0.1:5173`

Note:

Apps Script origin/header behavior should still be verified on the deployed web app, because browser CORS handling on Apps Script web apps is more constrained than a conventional server.
