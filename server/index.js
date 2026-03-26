/**
 * OliveBot — Server
 * Express backend that proxies OpenAI API calls and serves the frontend.
 * API key is kept server-side only.
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import OpenAI from 'openai';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ──────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.static(join(__dirname, '..', 'public')));

// ── OpenAI Client ──────────────────────────────────────────
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o';

// ── Chat Endpoint ──────────────────────────────────────────
app.post('/api/chat', async (req, res) => {
  try {
    const { system, messages } = req.body;

    if (!system || !messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Invalid request. Requires "system" and "messages".' });
    }

    const completion = await openai.chat.completions.create({
      model: MODEL,
      max_tokens: 3500,
      temperature: 0.7,
      messages: [
        { role: 'system', content: system },
        ...messages,
      ],
    });

    const content = completion.choices?.[0]?.message?.content || '';
    res.json({ content });
  } catch (err) {
    console.error('[OliveBot API Error]', err.message);
    const status = err.status || 500;
    res.status(status).json({ error: err.message || 'Internal server error' });
  }
});

// ── Health Check ───────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', model: MODEL, timestamp: new Date().toISOString() });
});

// ── SPA Fallback ───────────────────────────────────────────
app.get('*', (_req, res) => {
  res.sendFile(join(__dirname, '..', 'public', 'index.html'));
});

// ── Start ──────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n  🫒 OliveBot server running at http://localhost:${PORT}\n`);
});
