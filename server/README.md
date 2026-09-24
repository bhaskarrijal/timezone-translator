# Timezone Translator API

Express API running with Bun. No API key is needed.

```bash
bun install --frozen-lockfile
bun run dev
```

`POST /api/translate` accepts a JSON body with `prompt`, optional `deviceTimeZone` (IANA name), and optional `answers` (string values keyed by clarification field). The endpoint is stateless: send the original prompt again with each new answer. It returns `status: "ok"`, `"needs_clarification"`, or `"invalid"`. Successful results retain offset-bearing ISO values and include `timeFormat` plus formatted `display` times that follow the request's 12-hour or 24-hour notation. For a single-place current-time query such as `UK time`, `mode` is `current` and `target` is `null`. Invalid requests use HTTP 400. `GET /api/health` returns `{ "status": "ok" }`.

Run `bun test` to check parsing, conversions, clarifications, and API response shapes.
