import cityTimezones from 'city-timezones'
import { IANAZone } from 'luxon'

const entries = new Map()
const ignoredSingleWords = new Set([
  'am', 'pm', 'at', 'to', 'in', 'on', 'ma', 'time', 'today', 'tomorrow',
  'yesterday', 'next', 'this', 'last', 'from', 'until', 'january', 'february',
  'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october',
  'november', 'december', 'jan', 'feb', 'mar', 'apr', 'jun', 'jul', 'aug',
  'sep', 'sept', 'oct', 'nov', 'dec', 'sunday', 'monday', 'tuesday', 'wednesday', 'thursday',
  'friday', 'saturday', 'baje', 'bajda', 'kati', 'bajcha', 'boli', 'bata',
  'current', 'now', 'local', 'my', 'our', 'here', 'for', 'into', 'convert',
])

export function normalizeWords(value) {
  return value.normalize('NFKD').replace(/\p{Diacritic}/gu, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ')
}

function add(key, entry) {
  key = normalizeWords(key)
  if (!key || (key.length < 3 && !['uk', 'la'].includes(key))) return
  if (!entries.has(key)) entries.set(key, [])
  entries.get(key).push(entry)
}

for (const city of cityTimezones.cityMapping) {
  const entry = {
    zone: city.timezone,
    label: `${city.city}, ${city.province}, ${city.country}`,
    population: city.pop,
    qualifier: normalizeWords(`${city.province} ${city.country}`),
  }
  add(city.city, entry)
  if (city.city_ascii && city.city_ascii !== city.city) add(city.city_ascii, entry)
  add(`${city.city} ${city.province}`, entry)
  add(`${city.city} ${city.country}`, entry)
  if (city.state_ansi) add(`${city.city} ${city.state_ansi}`, entry)
}

const countryZones = new Map()
const countryNames = new Map()
const countryDefaults = new Map()
const regionNames = new Intl.DisplayNames(['en'], { type: 'region' })
for (const city of cityTimezones.cityMapping) {
  if (!validZone(city.timezone)) continue
  const key = normalizeWords(city.country)
  if (!countryZones.has(key)) countryZones.set(key, new Set())
  countryZones.get(key).add(city.timezone)
  if (!countryNames.has(key)) countryNames.set(key, new Set([key]))
  if (/^[A-Z]{2}$/.test(city.iso2)) countryNames.get(key).add(normalizeWords(regionNames.of(city.iso2)))
  const previous = countryDefaults.get(key)
  if (!previous || city.pop > previous.pop) countryDefaults.set(key, city)
}
for (const [country, zones] of countryZones) {
  const mainCity = countryDefaults.get(country)
  for (const name of countryNames.get(country)) {
    for (const zone of zones) add(name, {
      zone, label: `${mainCity.country} (${zone})`, country: true,
      defaultCity: zone === mainCity.timezone ? mainCity.city : undefined,
    })
  }
}

for (const zone of Intl.supportedValuesOf('timeZone')) {
  add(zone, { zone, label: zone, exact: true })
}

const aliases = new Map(Object.entries({
  nepal: 'Asia/Kathmandu', nepali: 'Asia/Kathmandu',
  kathmandu: 'Asia/Kathmandu', london: 'Europe/London',
  'london time': 'Europe/London', uk: 'Europe/London',
  england: 'Europe/London', britain: 'Europe/London',
  india: 'Asia/Kolkata', 'new york': 'America/New_York',
  nyc: 'America/New_York', la: 'America/Los_Angeles',
  sf: 'America/Los_Angeles', sfo: 'America/Los_Angeles',
  dc: 'America/New_York', hk: 'Asia/Hong_Kong',
  kl: 'Asia/Kuala_Lumpur',
  uae: 'Asia/Dubai',
  utc: 'UTC', gmt: 'UTC',
}))

const abbreviations = new Map(Object.entries({
  est: [
    { zone: 'America/New_York', label: 'Eastern Time, New York (DST aware)' },
    { zone: 'America/Panama', label: 'Eastern Standard Time, Panama (UTC−05:00 year-round)' },
  ],
  pst: [
    { zone: 'America/Los_Angeles', label: 'Pacific Time, Los Angeles (DST aware)' },
    { zone: 'Asia/Manila', label: 'Philippine Standard Time, Manila' },
  ],
  ist: [
    { zone: 'Asia/Kolkata', label: 'India Standard Time' },
    { zone: 'Europe/Dublin', label: 'Irish Standard Time' },
    { zone: 'Asia/Jerusalem', label: 'Israel Standard Time' },
  ],
  cst: [
    { zone: 'America/Chicago', label: 'Central Time, Chicago (DST aware)' },
    { zone: 'Asia/Shanghai', label: 'China Standard Time' },
    { zone: 'America/Havana', label: 'Cuba Standard Time' },
  ],
}))

export function validZone(zone) {
  return typeof zone === 'string' && IANAZone.isValidZone(zone)
}

function candidatesFor(key) {
  if (key === 'us' || key === 'usa') return entries.get('united states') || []
  if (aliases.has(key)) {
    const zone = aliases.get(key)
    return [{ zone, label: `${key} (${zone})` }]
  }
  if (abbreviations.has(key)) return abbreviations.get(key)
  return entries.get(key) || []
}

export function findPlaces(text) {
  const explicit = new Map()
  for (const match of text.matchAll(/\b[A-Za-z_]+\/[A-Za-z_0-9+-]+(?:\/[A-Za-z_0-9+-]+)?\b/g)) {
    if (validZone(match[0])) explicit.set(normalizeWords(match[0]), { zone: match[0], label: match[0], exact: true, raw: match[0] })
  }
  // Keep original spans so accented and punctuated names can be removed exactly.
  const tokens = [...text.matchAll(/[\p{L}\p{N}]+/gu)].flatMap(match =>
    normalizeWords(match[0]).split(' ').filter(Boolean).map(word => ({ word, start: match.index, end: match.index + match[0].length })))
  const words = tokens.map(token => token.word)
  const found = []
  for (let index = 0; index < words.length;) {
    let match = null
    for (let length = Math.min(7, words.length - index); length >= 1; length--) {
      const key = words.slice(index, index + length).join(' ')
      if (length === 1 && ignoredSingleWords.has(key)) continue
      const candidates = explicit.has(key) ? [explicit.get(key)] : candidatesFor(key)
      if (candidates.length) {
        match = { key, start: index, end: index + length, candidates, raw: text.slice(tokens[index].start, tokens[index + length - 1].end) }
        break
      }
    }
    if (match) {
      found.push(match)
      index = match.end
    } else {
      index++
    }
  }
  return { words, found }
}

export function zoneChoices(mention) {
  const byZone = new Map()
  for (const candidate of mention.candidates) {
    if (validZone(candidate.zone) && !byZone.has(candidate.zone)) {
      byZone.set(candidate.zone, { value: candidate.zone, label: candidate.label })
    }
  }
  return [...byZone.values()]
}

export function dominantCity(mention) {
  const byZone = new Map()
  for (const candidate of mention.candidates) {
    if (validZone(candidate.zone) && candidate.population > (byZone.get(candidate.zone)?.population ?? 0)) {
      byZone.set(candidate.zone, candidate)
    }
  }
  const [largest, next] = [...byZone.values()].sort((a, b) => b.population - a.population)
  // Keep similarly sized names ambiguous, but recognize major global cities.
  return largest?.population >= 1_000_000 && largest.population >= 10 * (next?.population ?? 0) ? largest : null
}

export function resolveZoneText(text) {
  if (validZone(text)) return text
  const { found, words } = findPlaces(text)
  if (found.length === 1 && found[0].start === 0 && found[0].end === words.length) {
    const choices = zoneChoices(found[0])
    if (choices.length === 1) return choices[0].value
  }
  return null
}
