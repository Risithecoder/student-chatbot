/**
 * OliveBot — Application Entry Point
 * Wires together all modules: sidebar, chat, stats engine, prompt builder, and quiz.
 * Handles global event listeners and intent filtering.
 */

import { preComputeStats } from './stats-engine.js';
import { buildSystemPrompt } from './prompt-builder.js';
import { sendChatMessage, sendSilentMessage, resetConversation, displayBotMessage, displayRejection, displayUserBubble, isBusy, setMockRecommendationFn } from './chat.js';
import { initFileUpload, populateSidebar, buildWelcomeMessage } from './sidebar.js';
import { initQuiz, startQuiz, onQuizComplete } from './quiz.js';
import { getRecommendedMocks } from './mock-catalog.js';

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

  if (!mockData) {
    displayBotMessage('⚠️ Please upload your mock test JSON file first using the panel on the left.');
    return;
  }

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
  try {
    mockData = data;
    preComputedStats = preComputeStats(data);
    populateSidebar(data, preComputedStats);
    document.getElementById('welcome-screen').style.display = 'none';
    resetConversation();

    // Register mock recommendation fallback so chat.js can append cards
    setMockRecommendationFn(() => getRecommendedMocks(preComputedStats, 2));

    const welcomeMsg = buildWelcomeMessage(data, preComputedStats);
    displayBotMessage(welcomeMsg);
  } catch (err) {
    console.error('[OliveBot] File load error:', err);
    displayBotMessage(`❌ Error loading data: ${err.message}. Please check your JSON file matches the expected format.`);
  }
}

/* ── Quiz Complete Handler ───────────────────────────────── */

async function handleQuizComplete(result) {
  if (!result || !mockData) return;

  const { mockName, difficulty, total, correct, wrong, questions, timeTaken } = result;
  const accuracy = Math.round((correct / total) * 100);
  const negMarks = (wrong * 0.25).toFixed(2);
  const netScore = (correct - wrong * 0.25).toFixed(1);
  const totalSec = Math.round(timeTaken / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = String(totalSec % 60).padStart(2, '0');

  // Build per-topic breakdown with historical comparison
  const topicMap = {};
  for (const q of questions) {
    if (!topicMap[q.topic]) topicMap[q.topic] = { correct: 0, total: 0 };
    topicMap[q.topic].total++;
    if (q.is_correct) topicMap[q.topic].correct++;
  }

  // Compare quiz topics against historical stats
  const ta = preComputedStats.topic_analysis || {};
  const sa = preComputedStats.section_analysis || {};
  const topicRows = Object.entries(topicMap)
    .map(([topic, d]) => {
      const quizAcc = Math.round((d.correct / d.total) * 100);
      // Find historical accuracy for this topic
      let histAcc = null;
      if (ta[topic] && typeof ta[topic].accuracy === 'number') {
        histAcc = Math.round(ta[topic].accuracy);
      } else if (sa[topic] && typeof sa[topic].avg_accuracy === 'number') {
        histAcc = Math.round(sa[topic].avg_accuracy);
      }
      const histCol = histAcc !== null ? `${histAcc}%` : 'N/A';
      const delta = histAcc !== null ? `${quizAcc >= histAcc ? '+' : ''}${quizAcc - histAcc}%` : '—';
      return `| ${topic} | ${d.correct}/${d.total} | ${quizAcc}% | ${histCol} | ${delta} |`;
    })
    .join('\n');

  // Identify strongest and weakest topics from this quiz
  const topicAccuracies = Object.entries(topicMap).map(([topic, d]) => ({
    topic,
    accuracy: Math.round((d.correct / d.total) * 100),
  }));
  topicAccuracies.sort((a, b) => a.accuracy - b.accuracy);
  const weakest = topicAccuracies.filter(t => t.accuracy < 60);
  const strongest = topicAccuracies.filter(t => t.accuracy >= 70);

  const weakSummary = weakest.length > 0
    ? weakest.map(t => `${t.topic} (${t.accuracy}%)`).join(', ')
    : 'none — all topics above 60%';
  const strongSummary = strongest.length > 0
    ? strongest.map(t => `${t.topic} (${t.accuracy}%)`).join(', ')
    : 'none above 70%';

  // Overall stats context
  const s = preComputedStats.summary;

  const quizSummary =
`I just completed the mini mock **${mockName}** (${difficulty}, ${total} questions) in ${min}:${sec}.

**My quiz results:**
- Accuracy: ${accuracy}% | Correct: ${correct}/${total} | Wrong: ${wrong} | Negative Marks: -${negMarks} | Net Score: ${netScore}

**Topic breakdown (quiz vs my historical performance):**
| Topic | Quiz Score | Quiz Acc | Historical Acc | Change |
|---|---|---|---|---|
${topicRows}

**Where I struggled:** ${weakSummary}
**Where I did well:** ${strongSummary}

**My overall profile for context:**
- Average score across ${s.total_mocks} mocks: ${s.avg_score} | Average percentile: ${s.avg_percentile}%
- Improvement so far: ${s.improvement_points > 0 ? '+' : ''}${s.improvement_points} points

Based on this quiz result AND my overall mock history, please give me a personalized analysis:
1. **Where I stand right now** — compare my quiz accuracy against exam cutoff requirements. Am I on track or behind? Be honest and specific with numbers.
2. **What went wrong** — for each topic where I scored below 60%, tell me exactly what concept or pattern I'm likely struggling with and give me 2-3 concrete actions (not generic "practice more")
3. **What went right** — acknowledge my strong topics briefly
4. **What to do next** — give me a specific 3-day action plan based on my weaknesses from this quiz
5. **Next mock recommendation** — ONLY if there's a mock in the catalog that directly targets my weak topics from this quiz, recommend it using MOCK_LINK. If no mock matches my specific weaknesses, don't recommend any — just tell me what topics to focus on independently.`;

  const systemPrompt = buildSystemPrompt(mockData, preComputedStats);
  await sendSilentMessage(quizSummary, systemPrompt);
}

/* ── Initialisation ──────────────────────────────────────── */

function init() {
  initFileUpload(handleFileLoaded, (msg) => displayBotMessage(msg));

  document.getElementById('send-btn').addEventListener('click', handleSend);

  const chatInput = document.getElementById('chat-input');
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });

  chatInput.addEventListener('input', function () {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 140) + 'px';
  });

  // Quiz system
  initQuiz();
  onQuizComplete(handleQuizComplete);

  // Expose globals for HTML onclick attributes
  window.quickPrompt = handleQuickPrompt;
  window.startQuiz = startQuiz;
}

document.addEventListener('DOMContentLoaded', init);
