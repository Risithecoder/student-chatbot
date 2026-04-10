/**
 * OliveBot — Chat Controller
 * Handles sending messages, conversation history, typing indicators,
 * and communication with the backend API proxy.
 */

import { renderMessage } from './renderer.js';

/* ── State ───────────────────────────────────────────────── */

let conversationHistory = [];
let isWaiting = false;

/* ── Public API ──────────────────────────────────────────── */

/**
 * Reset conversation history (e.g. when new data is loaded).
 */
export function resetConversation() {
  conversationHistory = [];
}

/**
 * Send a message to the OliveBot backend.
 * @param {string} text         - User's message text
 * @param {string} systemPrompt - Full system prompt with student context
 * @returns {Promise<void>}
 */
export async function sendChatMessage(text, systemPrompt) {
  if (isWaiting) return;

  appendUserMessage(text);

  isWaiting = true;
  setSendButtonState(true);
  showTypingIndicator();

  try {
    conversationHistory.push({ role: 'user', content: text });
    const reply = await callApi(systemPrompt);

    removeTypingIndicator();
    appendBotMessage(reply);
    conversationHistory.push({ role: 'assistant', content: reply });
  } catch (err) {
    // Remove the user message that has no matching assistant response
    if (conversationHistory.length > 0 && conversationHistory[conversationHistory.length - 1].role === 'user') {
      conversationHistory.pop();
    }
    removeTypingIndicator();
    appendBotMessage(`⚠️ Error: ${err.message}`, true);
    console.error('[OliveBot] API error:', err);
  }

  isWaiting = false;
  setSendButtonState(false);
}

/**
 * Display a bot message without going through the API (e.g. welcome message).
 * @param {string} text
 */
export function displayBotMessage(text) {
  appendBotMessage(text);
}

/**
 * Display a rejection message when the user asks something out of scope.
 * @param {string} text
 */
export function displayRejection(text) {
  appendBotMessage(text, true);
}

/**
 * Display a user message bubble.
 * @param {string} text
 */
export function displayUserBubble(text) {
  appendUserMessage(text);
}

/**
 * Send a message silently (no user bubble shown in UI).
 * Used after quiz completion to inject results into conversation context.
 * @param {string} content      - Message content (not shown in UI)
 * @param {string} systemPrompt - Full system prompt with student context
 * @returns {Promise<void>}
 */
export async function sendSilentMessage(content, systemPrompt) {
  if (isWaiting) return;

  isWaiting = true;
  setSendButtonState(true);
  showTypingIndicator();

  try {
    conversationHistory.push({ role: 'user', content });
    const reply = await callApi(systemPrompt);

    removeTypingIndicator();
    appendBotMessage(reply);
    conversationHistory.push({ role: 'assistant', content: reply });
  } catch (err) {
    // Remove the user message that has no matching assistant response
    if (conversationHistory.length > 0 && conversationHistory[conversationHistory.length - 1].role === 'user') {
      conversationHistory.pop();
    }
    removeTypingIndicator();
    appendBotMessage(`⚠️ Error: ${err.message}`, true);
    console.error('[OliveBot] API error:', err);
  }

  isWaiting = false;
  setSendButtonState(false);
}

/**
 * Check if a message send is currently in progress.
 * @returns {boolean}
 */
export function isBusy() {
  return isWaiting;
}

/* ── API Call ────────────────────────────────────────────── */

async function callApi(systemPrompt) {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      max_tokens: 3500,
      temperature: 0.7,
      messages: [
        { role: 'system', content: systemPrompt },
        ...conversationHistory,
      ],
    }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error?.message || `API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || 'Sorry, I could not generate a response. Please try again.';
}

/* ── DOM Manipulation ────────────────────────────────────── */

function appendUserMessage(text) {
  const container = document.getElementById('messages');
  const div = document.createElement('div');
  div.className = 'msg user';
  div.innerHTML = `
    <div class="msg-body">
      <div class="msg-name">You</div>
      <div class="msg-bubble">${escapeHtml(text)}</div>
    </div>
    <div class="msg-avatar user">U</div>`;
  container.appendChild(div);
  scrollToBottom();
}

function appendBotMessage(text, isRejection = false) {
  const container = document.getElementById('messages');
  const div = document.createElement('div');
  div.className = 'msg';
  const bubbleClass = isRejection ? 'msg-bubble rejection' : 'msg-bubble';
  div.innerHTML = `
    <div class="msg-avatar bot">O</div>
    <div class="msg-body">
      <div class="msg-name">OliveBot</div>
      <div class="${bubbleClass}">${renderMessage(text)}</div>
    </div>`;
  container.appendChild(div);
  scrollToBottom();
}

function showTypingIndicator() {
  const container = document.getElementById('messages');
  const div = document.createElement('div');
  div.className = 'msg';
  div.id = 'typing-indicator';
  div.innerHTML = `
    <div class="msg-avatar bot">O</div>
    <div class="msg-body">
      <div class="msg-name">OliveBot</div>
      <div class="msg-bubble">
        <div class="typing"><span></span><span></span><span></span></div>
      </div>
    </div>`;
  container.appendChild(div);
  scrollToBottom();
}

function removeTypingIndicator() {
  document.getElementById('typing-indicator')?.remove();
}

function setSendButtonState(disabled) {
  document.getElementById('send-btn').disabled = disabled;
}

function scrollToBottom() {
  const messages = document.getElementById('messages');
  messages.scrollTop = messages.scrollHeight;
}

function escapeHtml(str) {
  return str.replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
