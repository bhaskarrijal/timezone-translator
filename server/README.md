# Timezone Translator API

Express API running with Bun. No API key is needed.

```bash
bun install --frozen-lockfile
bun run dev
```

`POST /api/translate` accepts a JSON body with `prompt`, optional `deviceTimeZone` (IANA name), and optional `answers` (string values keyed by clarification field). The endpoint is stateless: send the original prompt again with each new answer. It returns `status: "ok"`, `"needs_clarification"`, or `"invalid"`. Successful results retain offset-bearing ISO values and include `timeFormat` plus formatted `display` times that follow the request's 12-hour or 24-hour notation. For a single-place current-time query such as `UK time`, `mode` is `current` and `target` is `null`. Invalid requests use HTTP 400. `GET /api/health` returns `{ "status": "ok" }`.

Run `bun test` to check parsing, conversions, clarifications, and API response shapes.

Destination-only conversions such as `5pm to Tokyo` and `5pm in London` use `deviceTimeZone` as their source. `5pm London to my time` uses it as the destination. If that timezone is unavailable or invalid, the API asks for it. `current time to Dubai time` and `now London to Tokyo` convert the current instant without asking for a clock time.

Place detection uses the bundled worldwide city dataset and IANA timezone names, including accented names, city/country qualifiers, US city/state abbreviations, and common country names. For countries with multiple timezones, the largest listed city supplies a default and the response identifies the selected city with a `country_timezone_default` assumption. Explicit cities and valid clarification answers take precedence. For repeated city names, a city with at least one million listed residents and at least ten times the population of alternatives in other timezones is selected with a visible assumption. Other ambiguous city names still require clarification; unrecognized places are not guessed. Coverage is limited to the bundled dataset and recognized timezone names.
