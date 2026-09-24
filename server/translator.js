import * as chrono from 'chrono-node'
import { DateTime } from 'luxon'
import { dominantCity, findPlaces, resolveZoneText, validZone, zoneChoices } from './zones.js'
import { normalizeNepaliWords } from './nepali.js'

const invalid = (code, message) => ({ status: 'invalid', code, message })
const choice = (field, question, options) => ({ status: 'needs_clarification', field, question, inputKind: 'choice', options })
const textQuestion = (field, question) => ({ status: 'needs_clarification', field, question, inputKind: 'text', options: [] })
const formatDirective = /\b(12|24)\s*-?\s*(?:hours?|hrs?|h)(?:\s+format)?\b/i
const localTimePhrase = /\b(?:(?:my|our)\s+(?:local\s+)?(?:time|timezone)|local\s+(?:time|timezone)|here)\b/gi

function requestedTimeFormat(prompt, answers, defaultFormat = '24h') {
  const explicit = prompt.match(formatDirective)
  if (explicit) return explicit[1] === '12' ? '12h' : '24h'
  if (/\b(?:bihana|beluka|sanjha|rati|diuso)\b|\d(?:\d|:\d{2})?\s*[ap]m\b/i.test(normalizeNepaliWords(prompt)) ||
    answers.startPeriod || answers.endPeriod || /[ap]m\b/i.test(answers.startTime || '') || /[ap]m\b/i.test(answers.endTime || '')) return '12h'
  return defaultFormat
}

function normalizePrompt(prompt) {
  return normalizeNepaliWords(prompt)
    .replace(/[–—−]/g, '-')
    .replace(/\baaja\b/g, 'today')
    .replace(/\bbholi\b/g, 'tomorrow')
    .replace(/\bhijo\b/g, 'yesterday')
    .replace(/\bbihana\b/g, 'am')
    .replace(/\b(beluka|sanjha|rati|diuso)\b/g, 'pm')
    .replace(/\bdekhi\b/g, '-')
    .replace(/\bsamma\b/g, '')
    .replace(/\b(\d{1,2})\s*(?:baje|bajda|bajcha|bajyo)\s*(\d{1,2})\b/g, (_, hour, minute) => `${hour}:${minute.padStart(2, '0')}`)
    .replace(/\b(\d{1,2}:\d{1,2})\s*(?:baje|bajda|bajcha|bajyo)\b/g, '$1')
    .replace(/\b(\d{1,2})\s*(?:baje|bajda|bajcha|bajyo)\b/g, '$1:00')
    .replace(/\b(am|pm)\s+(\d{1,2}:\d{2})\b/g, '$2$1')
    .replace(/\bkati\s+(?:bajcha|bajyo|baje|huncha)\b/g, '')
    .replace(/\b(?:kati|bajcha|bajyo|huncha)\b/g, '')
    .replace(/[?。।]/g, ' ')
    .replace(/\s+/g, ' ').trim()
}

function withoutPlaces(prompt, found) {
  let expression = prompt
  for (const item of found) {
    const pattern = item.raw
      ? item.raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      : `\\b${item.key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '[\\s,_\\/]+')}\\b`
    expression = expression.replace(new RegExp(pattern, 'i'), ' ')
  }
  return normalizePrompt(expression)
}

function isCurrentTimeQuery(prompt, mention) {
  const remainder = withoutPlaces(prompt, [mention]).replace(formatDirective, ' ')
    .replace(/\b(?:what|is|it|the|current|local|time|now|in|at|for|please|tell|me|ma|ko|bata|baje|today|yesterday|tomorrow)\b|[\s,.!?]/g, '')
  return remainder === ''
}

function isCurrentInstantQuery(prompt, mentions) {
  const expression = withoutPlaces(prompt, mentions).replace(formatDirective, ' ')
  if (!/\b(?:current|now)\b/.test(expression)) return false
  return expression.replace(/\b(?:what|is|it|the|current|local|time|timezone|right|now|my|our|here|from|to|into|in|at|for|please|tell|me|convert|show)\b|[\s,.!?]/g, '') === ''
}

function placeLabel(mention, zone) {
  if (validZone(mention.raw)) return zone.split('/').at(-1).replaceAll('_', ' ')
  const name = mention.key.replace(/ time$/, '')
  if (['uk', 'sf', 'sfo', 'nyc', 'la', 'dc', 'hk', 'kl', 'utc', 'gmt'].includes(name)) return name.toUpperCase()
  return name.replace(/\b\w/g, letter => letter.toUpperCase())
}

function selectZone(field, mention, answer, assumptions) {
  if (answer !== undefined) {
    const resolved = resolveZoneText(answer)
    if (resolved) {
      if (mention && !zoneChoices(mention).some(item => item.value === resolved)) {
        return invalid('invalid_answer', `The selected ${field === 'sourceZone' ? 'source' : 'destination'} timezone does not match the request.`)
      }
      return resolved
    }
    return invalid('invalid_answer', `Enter a valid city or IANA timezone for ${field === 'sourceZone' ? 'source' : 'destination'}.`)
  }
  if (!mention) return null
  const options = zoneChoices(mention)
  if (options.length === 1) return options[0].value
  const countryDefault = mention.candidates.find(candidate => candidate.country && candidate.defaultCity)
  if (countryDefault) {
    assumptions.push({ code: 'country_timezone_default', message: `Using ${countryDefault.defaultCity} time (${countryDefault.zone}) for ${mention.key}. Specify a city for a different timezone.` })
    return countryDefault.zone
  }
  const cityDefault = dominantCity(mention)
  if (cityDefault) {
    assumptions.push({ code: 'city_timezone_default', message: `Using ${cityDefault.label} (${cityDefault.zone}) for ${mention.key}.` })
    return cityDefault.zone
  }
  if (options.length === 0) return invalid('unknown_timezone', `I couldn't resolve ${mention.key} to a timezone.`)
  if (options.length > 12) return textQuestion(field, `Which city or IANA timezone do you mean by “${mention.key}”?`)
  return choice(field, `Which timezone do you mean by “${mention.key}”?`, options)
}

function getZones(prompt, deviceTimeZone, answers, assumptions) {
  const { words, found } = findPlaces(prompt)
  if (found.length > 2) return invalid('too_many_places', 'Use one source and one destination timezone.')
  let sourceMention = null
  let targetMention = null
  let localTarget = false
  if (found.length === 2) {
    [sourceMention, targetMention] = found
    const between = words.slice(found[0].end, found[1].start)
    if (!between.includes('to') && !between.includes('into')) {
      const timeIndex = words.findIndex((word, index) => /^\d{1,2}(?::\d{1,2})?(?:am|pm)?$/.test(word) &&
        (index === 0 || !/^\d{4}$/.test(words[index - 1])))
      if (timeIndex >= 0 && Math.abs(timeIndex - found[1].start) < Math.abs(timeIndex - found[0].end)) {
        [sourceMention, targetMention] = [found[1], found[0]]
      }
    }
  }
  if (found.length === 1) {
    const mention = found[0]
    const before = words.slice(0, mention.start)
    const after = words.slice(mention.end).join(' ')
    localTarget = /\b(?:to|into|in)\s+(?:(?:my|our)\s+(?:local\s+)?(?:time|timezone)|local\s+(?:time|timezone)|here)\b/.test(after)
    if (!localTarget && ['to', 'into', 'in', 'for'].includes(before.at(-1))) targetMention = mention
    else sourceMention = mention
  }
  const source = selectZone('sourceZone', sourceMention, answers.sourceZone, assumptions)
  if (typeof source === 'object' && source) return source
  let sourceZone = source
  if (!sourceZone) {
    if (!validZone(deviceTimeZone)) return textQuestion('sourceZone', 'What is the source city or IANA timezone?')
    sourceZone = deviceTimeZone
    assumptions.push({ code: 'device_source_timezone', message: `Source timezone assumed from your device: ${sourceZone}.` })
  }
  let target = selectZone('targetZone', targetMention, answers.targetZone, assumptions)
  if (typeof target === 'object' && target) return target
  if (!target && localTarget) {
    if (!validZone(deviceTimeZone)) return textQuestion('targetZone', 'What is your local city or IANA timezone?')
    target = deviceTimeZone
    assumptions.push({ code: 'device_target_timezone', message: `Destination timezone taken from your device: ${target}.` })
  }
  if (!target) return textQuestion('targetZone', 'What is the destination city or IANA timezone?')
  return { sourceZone, targetZone: target, found, words }
}

function componentDate(component, fallback) {
  return {
    year: component.isCertain('year') ? component.get('year') : fallback.year,
    month: component.isCertain('month') ? component.get('month') : fallback.month,
    day: component.isCertain('day') ? component.get('day') : fallback.day,
    hour: component.get('hour'),
    minute: component.get('minute') ?? 0,
  }
}

function wallTime(values, zone, field, answers) {
  const dt = DateTime.fromObject(values, { zone })
  if (!dt.isValid || ['year', 'month', 'day', 'hour', 'minute'].some(key => dt[key] !== values[key])) {
    return textQuestion(field === 'startOccurrence' ? 'startTime' : 'endTime', `This local time does not exist in ${zone}. Enter another time (for example, 2:30am).`)
  }
  const possible = dt.getPossibleOffsets()
  if (possible.length <= 1) return dt
  const options = possible.sort((a, b) => a.toMillis() - b.toMillis()).map(item => ({
    value: String(item.offset),
    label: `${item.toFormat('yyyy-MM-dd HH:mm')} at UTC${item.toFormat('ZZ')} (${zone})`,
  }))
  if (answers[field] !== undefined) {
    const selected = possible.find(item => String(item.offset) === answers[field])
    return selected || invalid('invalid_answer', 'Select one of the offered UTC offsets.')
  }
  return choice(field, `This time happens twice in ${zone}. Which occurrence do you mean?`, options)
}

function hasExplicitPeriod(text, hour) {
  return /\b(?:am|pm)\b|(?:\d)(?:am|pm)\b/i.test(text) || hour > 12 || /\b(?:0\d|1[3-9]|2[0-3]):\d{2}\b/.test(text)
}

function applyTimeAnswer(values, answer, now, sourceZone) {
  if (answer === undefined) return null
  const parsed = chrono.parse(answer, { instant: new Date(now.toMillis()), timezone: sourceZone })
  if (parsed.length !== 1 || !parsed[0].start.isCertain('hour') ||
    (parsed[0].start.get('hour') <= 12 && !parsed[0].start.isCertain('meridiem') && !/^\s*(?:0\d|1[3-9]|2[0-3]):\d{2}\s*$/.test(answer))) {
    return invalid('invalid_answer', 'Enter a clear time such as 2:30am or 14:30.')
  }
  values.hour = parsed[0].start.get('hour')
  values.minute = parsed[0].start.get('minute') ?? 0
  return null
}

export function translate({ prompt, deviceTimeZone, answers = {} }, now = DateTime.utc()) {
  if (typeof prompt !== 'string' || !prompt.trim()) return invalid('missing_prompt', 'Enter a time conversion request.')
  if (prompt.length > 500) return invalid('prompt_too_long', 'Keep the request under 500 characters.')
  if (!answers || typeof answers !== 'object' || Array.isArray(answers) || Object.values(answers).some(value => typeof value !== 'string')) {
    return invalid('invalid_answers', 'Clarification answers must be text values.')
  }
  const assumptions = []
  const mentions = findPlaces(prompt).found
  const currentInstant = isCurrentInstantQuery(prompt, mentions)
  const currentConversion = currentInstant && /\b(?:to|into|convert)\b/.test(withoutPlaces(prompt, mentions))
  if (!currentConversion && mentions.length === 1 && isCurrentTimeQuery(prompt, mentions[0])) {
    const zone = selectZone('sourceZone', mentions[0], answers.sourceZone, assumptions)
    if (typeof zone === 'object' && zone) return zone
    if (!zone) return invalid('unknown_timezone', 'Enter a city or IANA timezone.')
    const current = now.setZone(zone).startOf('second')
    const timeFormat = requestedTimeFormat(prompt, answers, '12h')
    return {
      status: 'ok',
      mode: 'current',
      place: placeLabel(mentions[0], zone),
      source: { zone, start: current.toISO({ suppressMilliseconds: true }).replace(/Z$/, '+00:00'), end: null },
      target: null,
      timeFormat,
      display: { source: { start: current.toFormat(timeFormat === '12h' ? 'h:mm a' : 'HH:mm'), end: null }, target: null },
      assumptions,
    }
  }
  const timeFormat = requestedTimeFormat(prompt, answers, currentInstant ? '12h' : '24h')
  const zoneResult = getZones(prompt, deviceTimeZone, answers, assumptions)
  if (zoneResult.status) return zoneResult
  const { sourceZone, targetZone, found } = zoneResult
  if (currentInstant) {
    return conversionResult(now.setZone(sourceZone).startOf('second'), null, sourceZone, targetZone, timeFormat, assumptions)
  }

  // Remove recognized place names before passing the date expression to Chrono.
  let expression = withoutPlaces(prompt, found)
  expression = expression.replace(localTimePhrase, ' ')
  expression = expression.replace(formatDirective, ' ')
  expression = expression.replace(/(\d(?::\d{2})?(?:am|pm)?)\s+(?:to|until|through)\s+(\d)/g, '$1-$2')
  expression = expression.replace(/\b(?:ma|bata|from|to|into|in|at|time|ko)\b/g, ' ').replace(/\s+/g, ' ').trim()

  const numeric = expression.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/)
  if (numeric && +numeric[1] <= 12 && +numeric[2] <= 12 && +numeric[1] !== +numeric[2]) {
    if (!answers.dateOrder) return choice('dateOrder', `Does “${numeric[0]}” mean month/day or day/month?`, [
      { value: 'MDY', label: 'Month / day' }, { value: 'DMY', label: 'Day / month' },
    ])
    if (!['MDY', 'DMY'].includes(answers.dateOrder)) return invalid('invalid_answer', 'Select month/day or day/month.')
    if (answers.dateOrder === 'DMY') expression = expression.replace(numeric[0], `${numeric[2]}/${numeric[1]}${numeric[3] ? `/${numeric[3]}` : ''}`)
  }
  if (numeric && +numeric[1] > 12 && +numeric[2] <= 12) {
    expression = expression.replace(numeric[0], `${numeric[2]}/${numeric[1]}${numeric[3] ? `/${numeric[3]}` : ''}`)
  }
  const today = now.setZone(sourceZone)
  const parsed = chrono.parse(expression, { instant: new Date(now.toMillis()), timezone: sourceZone }, { forwardDate: true })
  if (parsed.length !== 1 || !parsed[0].start.isCertain('hour')) {
    return invalid('unsupported_request', 'I could not read the time. Try “5pm Nepal time to London time” or “nepal ma 5 bajda london ma kati bajcha”.')
  }
  const result = parsed[0]
  const leftovers = (expression.slice(0, result.index) + ' ' + expression.slice(result.index + result.text.length))
    .replace(/\b(?:please|convert|what|is|the|when|it|would|be|and|for|on|today|tomorrow|show|give|display|return|respond|result|output|me|answer|translation|translated)\b|[\s,.!?]/g, '')
  if (leftovers) return invalid('unsupported_request', 'I could not read part of the request. Try a time, date, source, and destination.')
  if (!result.start.isCertain('day') && !result.start.isCertain('month') && !result.start.isCertain('year')) {
    assumptions.push({ code: 'source_today', message: `Date assumed to be today in ${sourceZone}: ${today.toISODate()}.` })
  }
  const fallback = { year: today.year, month: today.month, day: today.day }
  const startValues = componentDate(result.start, fallback)
  const startAnswerError = applyTimeAnswer(startValues, answers.startTime, now, sourceZone)
  if (startAnswerError) return startAnswerError
  if (!answers.startTime && startValues.hour > 0 && startValues.hour <= 12 && !result.start.isCertain('meridiem') && !hasExplicitPeriod(result.text, startValues.hour)) {
    if (!answers.startPeriod) return choice('startPeriod', `Is ${startValues.hour}:${String(startValues.minute).padStart(2, '0')} in the morning or evening?`, [
      { value: 'AM', label: 'AM' }, { value: 'PM', label: 'PM' },
    ])
    if (!['AM', 'PM'].includes(answers.startPeriod)) return invalid('invalid_answer', 'Select AM or PM.')
    startValues.hour = startValues.hour % 12 + (answers.startPeriod === 'PM' ? 12 : 0)
  }
  let endValues = null
  if (result.end) {
    endValues = componentDate(result.end, { year: startValues.year, month: startValues.month, day: startValues.day })
    const endAnswerError = applyTimeAnswer(endValues, answers.endTime, now, sourceZone)
    if (endAnswerError) return endAnswerError
    if (!answers.endTime && endValues.hour > 0 && endValues.hour <= 12 && !result.end.isCertain('meridiem') && !hasExplicitPeriod(result.text, endValues.hour)) {
      if (!answers.endPeriod) return choice('endPeriod', `Is the range end in the morning or evening?`, [
        { value: 'AM', label: 'AM' }, { value: 'PM', label: 'PM' },
      ])
      if (!['AM', 'PM'].includes(answers.endPeriod)) return invalid('invalid_answer', 'Select AM or PM.')
      endValues.hour = endValues.hour % 12 + (answers.endPeriod === 'PM' ? 12 : 0)
    }
    const startCalendar = DateTime.fromObject(startValues, { zone: 'UTC' })
    const endCalendar = DateTime.fromObject(endValues, { zone: 'UTC' })
    if (!result.end.isCertain('day') && endCalendar.toMillis() < startCalendar.toMillis()) {
      const next = endCalendar.plus({ days: 1 })
      Object.assign(endValues, { year: next.year, month: next.month, day: next.day })
      assumptions.push({ code: 'overnight_range', message: 'Range end assumed to be on the next day.' })
    } else if (endCalendar.toMillis() === startCalendar.toMillis()) {
      return textQuestion('endTime', 'The range start and end are equal. What end time did you mean?')
    }
  }
  const start = wallTime(startValues, sourceZone, 'startOccurrence', answers)
  if (start.status) return start
  const end = endValues ? wallTime(endValues, sourceZone, 'endOccurrence', answers) : null
  if (end?.status) return end
  if (end && end.toMillis() <= start.toMillis()) return invalid('invalid_range', 'The range end must be after the start.')
  return conversionResult(start, end, sourceZone, targetZone, timeFormat, assumptions)
}

function conversionResult(start, end, sourceZone, targetZone, timeFormat, assumptions) {
  const iso = value => value ? value.toISO({ suppressMilliseconds: true }).replace(/Z$/, '+00:00') : null
  const formatted = value => value ? value.toFormat(timeFormat === '12h' ? 'h:mm a' : 'HH:mm') : null
  const targetStart = start.setZone(targetZone)
  const targetEnd = end?.setZone(targetZone)
  return {
    status: 'ok',
    mode: 'conversion',
    source: { zone: sourceZone, start: iso(start), end: iso(end) },
    target: { zone: targetZone, start: iso(targetStart), end: iso(targetEnd) },
    timeFormat,
    display: {
      source: { start: formatted(start), end: formatted(end) },
      target: { start: formatted(targetStart), end: formatted(targetEnd) },
    },
    assumptions,
  }
}
