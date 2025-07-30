# Timezone Translator Backend

Simple Node.js backend for the timezone translator application.

## Setup

1. Install dependencies:

```bash
cd server
npm install
```

2. Set up environment variables:
   Create a `.env` file in the server directory with:

```
GOOGLE_GENERATIVE_AI_API_KEY=your_api_key_here
```

3. Start the server:

```bash
npm run dev
```

The server will run on port 3001 by default.

## API Endpoints

- `POST /api/translate` - Translate timezone prompts
- `GET /api/health` - Health check endpoint

## Development

- `npm run dev` - Start with auto-reload
- `npm start` - Start production server
