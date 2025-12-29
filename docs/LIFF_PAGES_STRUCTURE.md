# LIFF Pages Structure (Static + Firebase Hosting)

This folder contains standalone LIFF pages (no `index.html` routing). Each page loads its own CDN scripts (Tailwind, LIFF SDK, dayjs) and its own page module.

## Entry pages

- `public/pages/register.html`
- `public/pages/forget-time.html`

## Centralized JS

- `public/config/app.config.js` — central runtime config (LIFF ID, API base URL, endpoints)
- `public/assets/js/core/`
  - `config.js` — merges query params + `window.APP_CONFIG`
  - `liff.js` — init/login/profile/accessToken/sendMessages
  - `api.js` — centralized fetch wrapper
  - `validation.js` — Joi-like client-side validation rules
  - `ui.js` — banner/loading/form error helpers

## Configuration

Edit `public/config/app.config.js`:

- `liffId`: your LIFF ID
- `apiBaseUrl`: backend base URL
- `endpoints.register` and `endpoints.forgetTime`: your API paths

Or override by query params:

- `?liffId=...&apiBaseUrl=...`
- `?debug=1`
- `?requireLogin=0`
