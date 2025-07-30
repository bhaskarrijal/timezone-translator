import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { generateObject } from 'ai'
import { z } from 'zod'
import { DateTime } from 'luxon'

const app = express()
const PORT = process.env.PORT || 3001

// middleware 
app.use(cors({
  origin: [
    'https://tt.bhaskarrijal.me',
    'https://www.tt.bhaskarrijal.me'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}))
app.use(express.json())

// user prompt lai JSON ma parse garne schema
const parseSchema = z.object({
  datetime: z.object({
    date: z.string(),
    time: z.string(),
    range_end: z.string().nullable(),
  }),
  from_timezone: z.string(),
  to_timezone: z.string(),
})

// gAI init
const googleAI = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
})

// translation endpoint
app.post('/api/translate', async (req, res) => {
  try {
    const { prompt } = req.body

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' })
    }



    // phase 1 -- parsing
    const { object: parsed } = await generateObject({
      model: googleAI("gemini-2.0-flash"),
      schema: parseSchema,
      system: `You are a JSON parser that extracts date-time translation details.
Return only a JSON object with the following structure:
{
  "datetime": { "date": "YYYY-MM-DD", "time": "HH:mm", "range_end": null },
  "from_timezone": "IANA_TIMEZONE",
  "to_timezone": "IANA_TIMEZONE"
}
Do not include any explanations or extra keys.`,
      prompt: prompt,
    })



    // phase 2 -- conversion
    const { date, time } = parsed.datetime
    const sourceDT = DateTime.fromISO(`${date}T${time}`, { zone: parsed.from_timezone })
    const targetDT = sourceDT.setZone(parsed.to_timezone)

    // timezone le daylight saving time support garcha gardeina check 
    const year = sourceDT.year
    const hour = sourceDT.hour
    const minute = sourceDT.minute
    const zone = parsed.from_timezone
    const targetZone = parsed.to_timezone

    const winterDT = DateTime.fromObject({ year, month: 1, day: 1, hour, minute }, { zone })
    const summerDT = DateTime.fromObject({ year, month: 7, day: 1, hour, minute }, { zone })
    const winterTarget = winterDT.setZone(targetZone)
    const summerTarget = summerDT.setZone(targetZone)


    const supportsDST = winterDT.offset !== summerDT.offset

    let translation
    if (supportsDST) {
      const winterAbbr = winterDT.offsetNameShort
      const summerAbbr = summerDT.offsetNameShort
      const winterTargetAbbr = winterTarget.offsetNameShort
      const summerTargetAbbr = summerTarget.offsetNameShort

      const fmtWinter = `${winterDT.toFormat("h:mm a")} ${zone} (${winterAbbr}) → ${winterTarget.toFormat("h:mm a")} ${targetZone} (${winterTargetAbbr})`
      const fmtSummer = `${summerDT.toFormat("h:mm a")} ${zone} (${summerAbbr}) → ${summerTarget.toFormat("h:mm a")} ${targetZone} (${summerTargetAbbr})`

      translation = `Timezone supports DST —\n${fmtWinter}\n${fmtSummer}`
    } else {
      // no DST -- only actual conversion with abbrs
      const sourceAbbr = sourceDT.offsetNameShort
      const targetAbbr = targetDT.offsetNameShort
      translation = `${sourceDT.toFormat("h:mm a")} ${zone} (${sourceAbbr}) → ${targetDT.toFormat("h:mm a")} ${targetZone} (${targetAbbr})`
    }


    res.json({ translation })
  } catch (error) {
    console.error('Translation error:', error)
    res.status(500).json({ error: error.message || 'An error occurred during translation' })
  }
})

// health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' })
})

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
  console.log(`Key loaded: ${process.env.GOOGLE_GENERATIVE_AI_API_KEY ? 'Yes' : 'No'}`)
}) 