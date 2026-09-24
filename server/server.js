import express from 'express'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { translate } from './translator.js'

const app = express()
const port = process.env.PORT || 3001

app.use('/api/', rateLimit({ windowMs: 15 * 60 * 1000, limit: 100, standardHeaders: 'draft-8', legacyHeaders: false }))
app.use(cors({
  origin: ['https://tt.bhaskarrijal.me', 'https://www.tt.bhaskarrijal.me', /^http:\/\/(?:localhost|127\.0\.0\.1):517\d$/],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
}))
app.use(express.json({ limit: '10kb' }))

const requestSchema = z.object({
  prompt: z.string().min(1).max(500),
  deviceTimeZone: z.string().optional(),
  answers: z.record(z.string(), z.string()).optional(),
}).strict()

app.post('/api/translate', (req, res) => {
  const parsed = requestSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ status: 'invalid', code: 'invalid_request', message: 'Send a prompt, deviceTimeZone, and optional text answers.' })
  }
  try {
    const result = translate(parsed.data)
    return res.status(result.status === 'invalid' ? 400 : 200).json(result)
  } catch (error) {
    console.error('Translation error:', error)
    return res.status(500).json({ status: 'invalid', code: 'server_error', message: 'Could not translate this request.' })
  }
})

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }))

if (process.env.NODE_ENV !== 'test') app.listen(port, () => console.log(`Server running on port ${port}`))

export default app
