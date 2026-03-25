/**
 * OliveBot — Application Entry Point
 * Wires together all modules: sidebar, chat, stats engine, and prompt builder.
 * Handles global event listeners and intent filtering.
 */

import { preComputeStats } from './stats-engine.js';
import { buildSystemPrompt } from './prompt-builder.js';
import { sendChatMessage, resetConversation, displayBotMessage, displayRejection, displayUserBubble, isBusy } from './chat.js';
import { initFileUpload, populateSidebar, buildWelcomeMessage } from './sidebar.js';

/* ── State ───────────────────────────────────────────────── */

let mockData = null;
let preComputedStats = null;

/* ── Out-of-Scope Detector ───────────────────────────────── */

const OUT_OF_SCOPE_PATTERNS = [
  /\b(code|programming|python|javascript|sql|html|css|react|java\b)/i,
  /\b(recipe|cook|food|restaurant|movie|music|song|game|sport|ipl|cricket match)\b/i,
  /\b(weather|forecast|temperature)\b/i,
  /\b(joke|funny|meme)\b/i,
  /\b(relationship|girlfriend|boyfriend|family issue)\b/i,
  /\b(college assignment|homework|thesis|dissertation)\b/i,
  /\b(stock market|crypto|bitcoin|investment advice)\b/i,
];

const EXAM_KEYWORDS = /(exam|mock|score|study|preparation|percentile|syllabus|banking|ssc|upsc|mba|cat|ibps|sbi|rbi)/i;

function isOutOfScope(message) {
  return OUT_OF_SCOPE_PATTERNS.some(p => p.test(message)) && !EXAM_KEYWORDS.test(message);
}

/* ── Send Handler ────────────────────────────────────────── */

async function handleSend() {
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (!text || isBusy()) return;

  // Guard: no data loaded
  if (!mockData) {
    displayBotMessage('⚠️ Please upload your mock test JSON file first using the panel on the left.');
    return;
  }

  // Guard: out of scope
  if (isOutOfScope(text)) {
    displayUserBubble(text);
    input.value = '';
    displayRejection(
      "I'm your exam performance coach — I can only help with your preparation, scores, study plans, and exam strategy. What would you like to know about your performance?"
    );
    return;
  }

  input.value = '';
  input.style.height = 'auto';

  const systemPrompt = buildSystemPrompt(mockData, preComputedStats);
  await sendChatMessage(text, systemPrompt);
}

/* ── Quick Prompt Handler ────────────────────────────────── */

function handleQuickPrompt(text) {
  if (!mockData) {
    displayBotMessage('⚠️ Please upload your mock test JSON first.');
    return;
  }
  document.getElementById('chat-input').value = text;
  handleSend();
}

/* ── File Load Handler ───────────────────────────────────── */

function handleFileLoaded(data) {
  mockData = data;
  preComputedStats = preComputeStats(data);

  populateSidebar(data, preComputedStats);
  document.getElementById('welcome-screen').style.display = 'none';
  resetConversation();

  const welcomeMsg = buildWelcomeMessage(data, preComputedStats);
  displayBotMessage(welcomeMsg);
}

/* ── Initialisation ──────────────────────────────────────── */

function init() {
  // File upload
  initFileUpload(handleFileLoaded);

  // Send button
  document.getElementById('send-btn').addEventListener('click', handleSend);

  // Enter to send (Shift+Enter for new line)
  const chatInput = document.getElementById('chat-input');
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });

  // Auto-resize textarea
  chatInput.addEventListener('input', function () {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 140) + 'px';
  });

  // Quick prompt buttons — expose handler globally for onclick attributes
  window.quickPrompt = handleQuickPrompt;
}

// Run on DOM ready
document.addEventListener('DOMContentLoaded', init);
