# OliveBot — Oliveboard Performance Analyst

AI-powered competitive exam study coach for Banking, SSC, MBA, and UPSC aspirants. Analyses mock test data and delivers personalised performance insights, study roadmaps, and exam strategy using GPT-4o.

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure your API key (already set in .env)
#    Edit .env if needed:  OPENAI_API_KEY=sk-...

# 3. Start the server
npm start

# 4. Open in browser
#    → http://localhost:3000
```

## Project Structure

```
├── server/
│   └── index.js              # Express server + OpenAI API proxy
├── public/
│   ├── index.html            # Frontend HTML
│   ├── css/
│   │   └── styles.css        # Stylesheet (dark theme, olive accents)
│   └── js/
│       ├── app.js            # Entry point, event wiring
│       ├── stats-engine.js   # Pre-compute analytics from mock data
│       ├── prompt-builder.js # System prompt builder (MP.md spec)
│       ├── renderer.js       # STATS/CHART/ROADMAP/markdown → HTML
│       ├── chat.js           # Chat logic, API calls, conversation
│       └── sidebar.js        # Sidebar, file upload, charts
├── .env                      # API key (never committed)
├── .gitignore
├── package.json
└── README.md
```

## How It Works

1. User uploads a mock test JSON file (see `mock_test_data.json` for format)
2. Client-side JS pre-computes statistics (scores, accuracy, time sinks, errors)
3. System prompt is built with student context + pre-computed stats
4. User queries are sent to the Express backend → proxied to OpenAI GPT-4o
5. AI responses are rendered with rich formatting (stat cards, charts, roadmaps)

## API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/chat` | POST | Proxy to OpenAI Chat Completions |
| `/api/health` | GET | Server health check |

### `POST /api/chat`

```json
{
  "system": "You are OliveBot...",
  "messages": [
    { "role": "user", "content": "Full analysis" }
  ]
}
```

## JSON Schema

Upload files must contain:

- `user` — student info (name, target_exam, exam_date)
- `metadata` — date range, mock count
- `mock_tests[]` — array of mocks, each with `questions[]`

See `mock_test_data.json` for a complete example.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENAI_API_KEY` | — | OpenAI API key (required) |
| `OPENAI_MODEL` | `gpt-4o` | Model to use |
| `PORT` | `3000` | Server port |

## Tech Stack

- **Backend**: Node.js + Express
- **AI**: OpenAI GPT-4o
- **Frontend**: Vanilla HTML/CSS/JS (ES modules)
- **Charts**: Chart.js
- **Fonts**: DM Sans + DM Serif Display
