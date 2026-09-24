import { describe, expect, test, beforeAll, afterAll } from 'bun:test'
import { DateTime } from 'luxon'
import app from './server.js'
import { translate } from './translator.js'

const now = DateTime.fromISO('2026-09-25T00:00:00Z')
const request = (prompt, answers = {}, deviceTimeZone = 'Asia/Kathmandu') => translate({ prompt, answers, deviceTimeZone }, now)
let listener
let base
beforeAll(async () => {
  listener = app.listen(0)
  await new Promise(resolve => listener.once('listening', resolve))
  base = `http://127.0.0.1:${listener.address().port}`
})
afterAll(() => listener?.close())
async function post(body) {
  const response = await fetch(`${base}/api/translate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  return { response, body: await response.json() }
}

describe('translation', () => {
  test('English example has structured ISO values', () => {
    const result = request('5pm Nepal time to London time')
    expect(result.status).toBe('ok')
    expect(result.source).toEqual({ zone: 'Asia/Kathmandu', start: '2026-09-25T17:00:00+05:45', end: null })
    expect(result.target).toEqual({ zone: 'Europe/London', start: '2026-09-25T12:15:00+01:00', end: null })
    expect(result.timeFormat).toBe('12h')
    expect(result.display).toEqual({ source: { start: '5:00 PM', end: null }, target: { start: '12:15 PM', end: null } })
    expect(result.assumptions.map(x => x.code)).toContain('source_today')
  })
  test('response follows the requested 12-hour or 24-hour format', () => {
    expect(request('17:00 Nepal to London')).toMatchObject({ timeFormat: '24h', display: { source: { start: '17:00' }, target: { start: '12:15' } } })
    expect(request('17:00 Nepal to London in 12-hour format')).toMatchObject({ timeFormat: '12h', display: { source: { start: '5:00 PM' }, target: { start: '12:15 PM' } } })
    expect(request('what time is 5pm Nepal time in London? Give me the answer in 12-hour format').display.target.start).toBe('12:15 PM')
    expect(request('5pm Nepal to London in 24hr format')).toMatchObject({ timeFormat: '24h', display: { source: { start: '17:00' } } })
    expect(request('3–5pm Nepal to London').display.target.end).toBe('12:15 PM')
    expect(request('nepal ma 5 bajda london ma kati bajcha', { startPeriod: 'PM' }).display.source.start).toBe('5:00 PM')
  })
  test('romanized Nepali asks AM/PM and understands morning/evening', () => {
    expect(request('nepal ma 5 bajda london ma kati bajcha').field).toBe('startPeriod')
    expect(request('nepal ma 5 bajda london ma kati bajcha', { startPeriod: 'PM' }).source.start).toContain('T17:00:00')
    expect(request('aaja bihana 5 bajda nepal ma london ma kati bajcha').source.start).toContain('T05:00:00')
    expect(request('beluka 5 bajda nepal ma london ma kati bajcha').source.start).toContain('T17:00:00')
  })
  test('common spellings of the Nepali time question keep the same clarification flow', () => {
    for (const verb of ['bajxa', 'bajx', 'bajch', 'bazx', 'bajchha', 'bazcha', 'bajchxa', 'bajyo', 'bajyoo', 'bajcah', 'huncha', 'hunchha', 'hunxa', 'hunx', 'hunca']) {
      const prompt = `nepal ma 5 bajda london ma kati ${verb}`
      expect(request(prompt)).toMatchObject({ status: 'needs_clarification', field: 'startPeriod' })
      expect(request(prompt, { startPeriod: 'PM' })).toMatchObject({
        status: 'ok', source: { zone: 'Asia/Kathmandu', start: '2026-09-25T17:00:00+05:45' },
        target: { zone: 'Europe/London', start: '2026-09-25T12:15:00+01:00' },
      })
      expect(request(`UK ma kati ${verb}`)).toMatchObject({ status: 'ok', mode: 'current', source: { zone: 'Europe/London' } })
    }
  })
  test('other Nepali time words tolerate familiar spellings and one-letter errors', () => {
    for (const marker of ['baje', 'bajey', 'bajee', 'bje', 'bajda', 'bajdaa', 'bjda', 'bajed']) {
      expect(request(`nepal ma 5 ${marker} london ma kati bajxa`).field).toBe('startPeriod')
    }
    for (const morning of ['bihana', 'bihna', 'bihan', 'bihani', 'bihanaa', 'bihsna']) {
      expect(request(`${morning} 5 baje nepal ma london ma kati bajxa`)).toMatchObject({
        status: 'ok', timeFormat: '12h', display: { source: { start: '5:00 AM' } },
      })
    }
    for (const evening of ['beluka', 'belka', 'belukaa', 'sanjh', 'sajha', 'rati', 'deuso']) {
      expect(request(`${evening} 5 baje nepal ma london ma kati bajxa`)).toMatchObject({
        status: 'ok', timeFormat: '12h', display: { source: { start: '5:00 PM' } },
      })
    }
    for (const tomorrow of ['bholi', 'voli', 'boli', 'bholii', 'bholi']) {
      expect(request(`${tomorrow} belka 5 bajey nepal ma london ma kati bajxa`).source.start).toBe('2026-09-26T17:00:00+05:45')
    }
    expect(request('aaj bihna 5 baje nepal ma london ma kati bajxa').source.start).toBe('2026-09-25T05:00:00+05:45')
    expect(request('hijo bihana 5 baje nepal ma london ma kati bajxa').source.start).toBe('2026-09-24T05:00:00+05:45')
  })
  test('Nepali ordering, compact times, and ranges preserve source and minutes', () => {
    expect(request('london ma kati bajxa nepal ma 5 bajda', { startPeriod: 'PM' })).toMatchObject({
      status: 'ok', source: { zone: 'Asia/Kathmandu' }, target: { zone: 'Europe/London' },
    })
    expect(request('nepal ma 5baje london ma kati bajxa', { startPeriod: 'AM' }).source.start).toContain('T05:00:00')
    expect(request('nepal ma 5 baje 5 london ma kati bajxa', { startPeriod: 'PM' }).source.start).toContain('T17:05:00')
    expect(request('nepal ma 5:30 bajey london ma kati bajxa', { startPeriod: 'PM' }).source.start).toContain('T17:30:00')
    expect(request('nepal ma 5 bajxa london ma kati hunxa', { startPeriod: 'PM' }).source.start).toContain('T17:00:00')
    expect(request('nepal ko 5 baje london ko katti hunxa', { startPeriod: 'PM' }).target.start).toContain('T12:15:00')
    expect(request('5pm nepal bata london ma kati hunxa').source.zone).toBe('Asia/Kathmandu')
    expect(request('nepal ma beluka 11 bajey dekhee bihana 1 baje samma london ma kati bajxa').source.end).toContain('2026-09-26T01:00:00')
  })
  test('unsupported text and place names are not silently corrected', () => {
    expect(request('nepal ma 5 bajda london ma gibberish').status).toBe('invalid')
    expect(request('5pm Santa Fe to London').field).toBe('sourceZone')
    expect(request('5pm Santa Fe to London', { sourceZone: 'America/Denver' }).source.zone).toBe('America/Denver')
    expect(request('May 5, 2026 5pm Nepal to London').source.start).toContain('2026-05-05')
    expect(request('5pm Nepal to London').source.zone).toBe('Asia/Kathmandu')
  })
  test('source and destination defaults', () => {
    const result = request('5pm to London')
    expect(result.assumptions.map(x => x.code)).toContain('device_source_timezone')
    expect(request('5pm Nepal time').field).toBe('targetZone')
    expect(request('5pm Nepal time', { targetZone: 'Europe/London' }).status).toBe('ok')
    expect(request('5pm to London', {}, '').field).toBe('sourceZone')
    expect(request('5pm America/New_York to Europe/London').source.start).toContain('2026-09-24')
  })
  test('country defaults preserve the actual device source timezone', () => {
    const result = request('5pm to brazil time')
    expect(result).toMatchObject({ status: 'ok', source: { zone: 'Asia/Kathmandu', start: '2026-09-25T17:00:00+05:45' }, target: { zone: 'America/Sao_Paulo', start: '2026-09-25T08:15:00-03:00' } })
    expect(result.assumptions.map(x => x.code)).toContain('device_source_timezone')
    expect(result.assumptions.map(x => x.code)).toContain('country_timezone_default')
    expect(request('5pm to Brazil', {}, 'America/New_York')).toMatchObject({ status: 'ok', source: { start: '2026-09-24T17:00:00-04:00' }, target: { start: '2026-09-24T18:00:00-03:00' } })
    expect(request('5pm to Brazil', {}, '')).toMatchObject({ status: 'needs_clarification', field: 'sourceZone' })
    expect(request('5pm to Brazil', {}, 'Invalid/Zone').field).toBe('sourceZone')
  })
  test('local-time wording and destination prepositions avoid redundant questions', () => {
    for (const prompt of ['5pm my time to Brazil', '5pm local time to Brazil', '5pm from my time to Brazil', '5pm here to Brazil', 'convert 5pm into Brazil time', '5pm for Brazil', '5pm in Brazil']) {
      expect(request(prompt)).toMatchObject({ status: 'ok', source: { zone: 'Asia/Kathmandu' }, target: { zone: 'America/Sao_Paulo' } })
    }
    expect(request('what is 5pm in London')).toMatchObject({ status: 'ok', source: { zone: 'Asia/Kathmandu' }, target: { zone: 'Europe/London' } })
    expect(request('3 to 5pm in London')).toMatchObject({ status: 'ok', source: { start: '2026-09-25T15:00:00+05:45', end: '2026-09-25T17:00:00+05:45' } })
    for (const prompt of ['5pm London to my time', '5pm London in local time', '5pm from London to here']) {
      expect(request(prompt)).toMatchObject({ status: 'ok', source: { zone: 'Europe/London' }, target: { zone: 'Asia/Kathmandu', start: '2026-09-25T21:45:00+05:45' } })
    }
    expect(request('5pm London to my time', {}, '').field).toBe('targetZone')
    expect(request('5pm from London').field).toBe('targetZone')
  })
  test('explicit Brazilian cities and clarification answers override the country default', () => {
    expect(request('5pm to Manaus Brazil')).toMatchObject({ status: 'ok', target: { zone: 'America/Manaus', start: '2026-09-25T07:15:00-04:00' } })
    const overridden = request('5pm to Brazil', { targetZone: 'America/Manaus' })
    expect(overridden).toMatchObject({ status: 'ok', target: { zone: 'America/Manaus' } })
    expect(overridden.assumptions.map(x => x.code)).not.toContain('country_timezone_default')
    expect(request('Brazil time')).toMatchObject({ status: 'ok', mode: 'current', source: { zone: 'America/Sao_Paulo' }, assumptions: [{ code: 'country_timezone_default' }] })
    expect(request('5pm to Brazil', { sourceZone: 'Europe/London' })).toMatchObject({ status: 'ok', source: { zone: 'Europe/London' } })
    expect(request('5pm to Springfield').field).toBe('targetZone')
    expect(request('5pm to Brazil', { targetZone: 'Europe/London' }).status).toBe('invalid')
  })
  test('ambiguous city, abbreviation, and numeric date', () => {
    expect(request('5pm Springfield to Nepal').field).toBe('sourceZone')
    expect(request('5pm IST to Nepal').field).toBe('sourceZone')
    expect(request('5pm EST to Nepal', { sourceZone: 'America/Panama' }).source.zone).toBe('America/Panama')
    expect(request('5pm Springfield to Nepal', { sourceZone: 'America/Chicago' }).status).toBe('ok')
    expect(request('03/04 5pm Nepal to London').field).toBe('dateOrder')
    expect(request('03/04 5pm Nepal to London', { dateOrder: 'DMY' }).source.start).toContain('2026-04-03')
    expect(request('03/04 5pm Nepal to London', { dateOrder: 'MDY' }).source.start).toContain('2026-03-04')
    expect(request('13/04 5pm Nepal to London').source.start).toContain('2026-04-13')
  })
  test('current-time conversions use one instant across cities worldwide', () => {
    const destinations = {
      Dubai: 'Asia/Dubai', Tokyo: 'Asia/Tokyo', Paris: 'Europe/Paris', Nairobi: 'Africa/Nairobi',
      Auckland: 'Pacific/Auckland', Lima: 'America/Lima', Sydney: 'Australia/Sydney',
      'São Paulo': 'America/Sao_Paulo', Zürich: 'Europe/Zurich', 'Springfield MO': 'America/Chicago',
      'America/Argentina/Buenos_Aires': 'America/Argentina/Buenos_Aires',
    }
    for (const [place, zone] of Object.entries(destinations)) {
      const result = request(`current time to ${place} time`)
      expect(result).toMatchObject({ status: 'ok', mode: 'conversion', source: { zone: 'Asia/Kathmandu' }, target: { zone, end: null } })
      expect(DateTime.fromISO(result.source.start).toMillis()).toBe(now.toMillis())
      expect(DateTime.fromISO(result.target.start).toMillis()).toBe(now.toMillis())
      expect(result.assumptions.map(x => x.code)).not.toContain('source_today')
    }
    expect(request('current time to Dubai time').display).toEqual({ source: { start: '5:45 AM', end: null }, target: { start: '4:00 AM', end: null } })
    expect(request('convert my current time to Dubai in 24-hour format').display.target.start).toBe('04:00')
    expect(request('now London to Tokyo')).toMatchObject({ status: 'ok', source: { start: '2026-09-25T01:00:00+01:00' }, target: { start: '2026-09-25T09:00:00+09:00' } })
    expect(request('current time in Dubai')).toMatchObject({ status: 'ok', mode: 'current', source: { zone: 'Asia/Dubai' } })
    expect(request('now to Dubai', {}, '').field).toBe('sourceZone')
    expect(request('current time to Atlantis time').status).not.toBe('ok')
    expect(request('current nonsense to Dubai time').status).toBe('invalid')
  })
  test('country defaults apply globally and explicit cities take precedence', () => {
    for (const [country, zone] of Object.entries({ Brazil: 'America/Sao_Paulo', 'United States': 'America/New_York', Canada: 'America/Toronto', Russia: 'Europe/Moscow', Australia: 'Australia/Sydney' })) {
      const result = request(`5pm to ${country}`)
      expect(result).toMatchObject({ status: 'ok', target: { zone } })
      expect(result.assumptions.map(x => x.code)).toContain('country_timezone_default')
    }
    expect(request('5pm to Perth Australia')).toMatchObject({ status: 'ok', target: { zone: 'Australia/Perth' } })
    expect(request('5pm to Australia', { targetZone: 'Australia/Perth' })).toMatchObject({ status: 'ok', target: { zone: 'Australia/Perth' } })
    expect(request('5pm to Australia', { targetZone: 'Europe/London' }).status).toBe('invalid')
    expect(request('5pm to São Paulo')).toMatchObject({ status: 'ok', target: { zone: 'America/Sao_Paulo' } })
    expect(request('5pm to Zürich')).toMatchObject({ status: 'ok', target: { zone: 'Europe/Zurich' } })
    expect(request('5pm to Springfield').field).toBe('targetZone')
  })
  test('common city acronyms resolve in timezone positions', () => {
    expect(request('5pm SF to London').source.zone).toBe('America/Los_Angeles')
    expect(request('5pm Nepal to SF').target.zone).toBe('America/Los_Angeles')
    expect(request('5pm NYC to HK').target.zone).toBe('Asia/Hong_Kong')
  })
  test('single-place requests return the current local time', () => {
    expect(request('UK time')).toMatchObject({ status: 'ok', mode: 'current', place: 'UK', source: { zone: 'Europe/London', start: '2026-09-25T01:00:00+01:00' }, target: null, timeFormat: '12h', display: { source: { start: '1:00 AM' }, target: null } })
    expect(request('what time is it in London').mode).toBe('current')
    expect(request('Nepal ma kati bajcha').source.start).toBe('2026-09-25T05:45:00+05:45')
    expect(request('SF time').place).toBe('SF')
    expect(request('time in HK in 24-hour format').display.source.start).toBe('08:00')
    expect(request('Springfield time').field).toBe('sourceZone')
    expect(request('5pm Nepal').field).toBe('targetZone')
  })
  test('time-only, explicit and relative dates', () => {
    expect(request('5pm Nepal to London').source.start).toContain('2026-09-25')
    expect(request('2026-12-01 5pm Nepal to London').source.start).toContain('2026-12-01')
    expect(request('bholi 5 bajda nepal ma london ma kati bajcha', { startPeriod: 'PM' }).source.start).toContain('2026-09-26')
  })
  test('ranges inherit PM and can cross midnight', () => {
    const afternoon = request('3–5pm Nepal to London')
    expect(afternoon.source.start).toContain('T15:00:00')
    expect(afternoon.source.end).toContain('T17:00:00')
    expect(request('3 to 5pm Nepal to London').source.end).toContain('T17:00:00')
    const overnight = request('11pm-1am Nepal to London')
    expect(overnight.source.end).toContain('2026-09-26T01:00:00')
    expect(overnight.assumptions.map(x => x.code)).toContain('overnight_range')
    expect(request('5pm-5pm Nepal to London').field).toBe('endTime')
  })
  test('London summer/winter and DST gap/fold', () => {
    expect(request('2026-07-01 5pm London to Nepal').source.start).toEndWith('+01:00')
    expect(request('2026-01-01 5pm London to Nepal').source.start).toEndWith('+00:00')
    expect(request('2026-03-29 1:30am London to Nepal').field).toBe('startTime')
    expect(request('2026-03-29 1:30am London to Nepal', { startTime: '2:30am' }).source.start).toContain('T02:30:00+01:00')
    const fold = request('2026-10-25 1:30am London to Nepal')
    expect(fold.field).toBe('startOccurrence')
    expect(fold.options.map(x => x.value)).toEqual(['60', '0'])
    expect(request('2026-10-25 1:30am London to Nepal', { startOccurrence: '0' }).source.start).toEndWith('+00:00')
  })
  test('unsupported wording and invalid answers', () => {
    expect(request('hello Nepal to London').status).toBe('invalid')
    expect(request('nepal ma 5 bajda london ma kati bajcha', { startPeriod: 'maybe' }).status).toBe('invalid')
    expect(request('5pm Etc/GMT+5 to Nepal').source.zone).toBe('Etc/GMT+5')
    expect(request('5pm UTC to GMT').source.start).toEndWith('+00:00')
  })
})

describe('API shapes', () => {
  test('local-to-Brazil conversion succeeds in one request', async () => {
    const { response, body } = await post({ prompt: '5pm to brazil time', deviceTimeZone: 'Asia/Kathmandu' })
    expect(response.status).toBe(200)
    expect(body).toMatchObject({ status: 'ok', mode: 'conversion', source: { zone: 'Asia/Kathmandu' }, target: { zone: 'America/Sao_Paulo' }, display: { source: { start: '5:00 PM' }, target: { start: '8:15 AM' } } })
  })
  test('ok', async () => {
    const { response, body } = await post({ prompt: '5pm Nepal to London', deviceTimeZone: 'Asia/Kathmandu' })
    expect(response.status).toBe(200)
    expect(body).toMatchObject({ status: 'ok', source: { zone: 'Asia/Kathmandu', end: null }, target: { zone: 'Europe/London', end: null }, timeFormat: '12h', display: { source: { start: '5:00 PM' }, target: { start: expect.any(String) } }, assumptions: expect.any(Array) })
    expect(body.source.start).toMatch(/[+-]\d\d:\d\d$/)
  })
  test('clarification', async () => {
    const { response, body } = await post({ prompt: '5pm Nepal' })
    expect(response.status).toBe(200)
    expect(body).toEqual({ status: 'needs_clarification', field: 'targetZone', question: expect.any(String), inputKind: 'text', options: [] })
  })
  test('typo phrasing can be answered without a stored session', async () => {
    const prompt = 'nepal ma 5 bajey london ma kati bazx'
    const first = await post({ prompt, deviceTimeZone: 'Asia/Kathmandu' })
    expect(first.body).toMatchObject({ status: 'needs_clarification', field: 'startPeriod', options: [{ value: 'AM' }, { value: 'PM' }] })
    const second = await post({ prompt, deviceTimeZone: 'Asia/Kathmandu', answers: { startPeriod: 'PM' } })
    expect(second.body).toMatchObject({ status: 'ok', source: { zone: 'Asia/Kathmandu' }, target: { zone: 'Europe/London' } })
  })
  test('current-time branch', async () => {
    const { response, body } = await post({ prompt: 'UK time' })
    expect(response.status).toBe(200)
    expect(body).toMatchObject({ status: 'ok', mode: 'current', place: 'UK', source: { zone: 'Europe/London', end: null }, target: null, display: { source: { start: expect.any(String) }, target: null } })
    expect(body.source.start).toMatch(/T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/)
  })
  test('invalid', async () => {
    const { response, body } = await post({ prompt: '' })
    expect(response.status).toBe(400)
    expect(body).toEqual({ status: 'invalid', code: 'invalid_request', message: expect.any(String) })
  })
})
