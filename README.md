# Timezone Translator

A deterministic time converter for common English and romanized Nepali requests. React powers the interface, Express serves the API, and Bun manages both projects. No AI service or API key is required.

## Run locally

Install [Bun](https://bun.com/docs/installation), then run these in separate terminals:

```bash
bun install --frozen-lockfile
bun run dev
```

```bash
cd server
bun install --frozen-lockfile
bun run dev
```

The frontend runs at Vite's local URL and calls `http://localhost:3001`. Set `VITE_API_URL` to a different backend origin when needed. Build with `bun run build`; lint with `bun run lint`. Run server tests with `cd server && bun test`.

## Supported requests

- `5pm Nepal time to London time`
- `nepal ma 5 bajda london ma kati bajcha` (asks whether 5 is AM or PM)
- `tomorrow 3–5pm from Nepal to London`
- `2026-10-25 1:30am London to Nepal` (asks which repeated DST occurrence)
- `UK time`, `what time is it in London`, or `Nepal ma kati bajcha` (shows the current time in one place)

English dates and time ranges are parsed with Chrono. City names come from city-timezones; explicit IANA timezones and common aliases such as `SF`, `NYC`, and `LA` work too. Ambiguous city names, abbreviations, numeric dates, and repeated local times require a selection. Missing dates use today in the source timezone. Missing sources use the browser timezone and appear as an assumption. Unrecognized wording returns a structured correction message.

Romanized Nepali also accepts common spelling variants and nearby typos for time words, such as `bajxa`, `bajx`, `bajch`, `bazx`, `bajey`, `bihna`, `belka`, and `hunxa`. This matching is limited to recognized time vocabulary so unrelated words still produce a correction instead of a guessed conversion.

## API

`POST /api/translate` accepts `{ "prompt": "5pm Nepal time to London", "deviceTimeZone": "Asia/Kathmandu", "answers": {} }`. The browser sends its IANA timezone. For a clarification, resubmit the same prompt with an answer keyed by the returned `field`, such as `{ "startPeriod": "PM" }`. No session is stored.

Responses have one of three statuses: `ok` (a `mode` of `conversion` or `current`, source and nullable destination zones, offset-bearing ISO `start` and nullable `end`, `timeFormat`, formatted `display` times, and assumptions), `needs_clarification` (field, English question, and choice options or text input), or `invalid` (code and message). A request like `5pm` displays results with AM/PM; `17:00` uses 24-hour time. Add `in 12-hour format` or `in 24-hour format` to choose explicitly. Single-place current-time requests default to 12-hour format. `GET /api/health` returns server health.
