/**
 * OliveBot — Stats Engine
 * Pre-computes all analytics from raw mock test JSON data.
 * These stats are injected into the system prompt for the LLM.
 */

/**
 * @param {Object} data - Raw mock test data matching the OliveBot JSON schema
 * @returns {Object} Pre-computed statistics object
 */
export function preComputeStats(data) {
  const mocks = data.mock_tests;
  const allQuestions = mocks.flatMap(mock =>
    mock.questions.map(q => ({ ...q, mock_id: mock.mock_id, mock_date: mock.attempted_on }))
  );

  const scoreProgression = buildScoreProgression(mocks);
  const summary = buildSummary(scoreProgression);
  const topicAnalysis = buildTopicAnalysis(allQuestions);
  const perMockTopics = buildPerMockTopics(mocks);
  const errorAnalysis = buildErrorAnalysis(allQuestions);
  const slowSubtopics = buildTimeAnalysis(allQuestions);

  return {
    score_progression: scoreProgression,
    summary,
    topic_analysis: topicAnalysis,
    per_mock_topic_breakdown: perMockTopics,
    error_analysis: errorAnalysis,
    slow_subtopics: slowSubtopics,
    total_questions_analyzed: allQuestions.length,
  };
}

/* ── Score Progression ───────────────────────────────────── */

function buildScoreProgression(mocks) {
  return mocks.map(m => ({
    id: m.mock_id,
    score: m.total_score,
    percentile: m.percentile,
    date: m.attempted_on.slice(0, 10),
    name: m.mock_name,
  }));
}

/* ── Summary Stats ───────────────────────────────────────── */

function buildSummary(progression) {
  const scores = progression.map(s => s.score);
  const percentiles = progression.map(s => s.percentile);

  const avg = arr => arr.reduce((a, b) => a + b, 0) / arr.length;
  const last3 = scores.slice(-3);
  const first3 = scores.slice(0, 3);

  return {
    avg_score: round(avg(scores)),
    avg_percentile: round(avg(percentiles)),
    best_score: Math.max(...scores),
    lowest_score: Math.min(...scores),
    improvement_points: scores[scores.length - 1] - scores[0],
    rolling_trend_vs_first3: round(avg(last3) - avg(first3)),
    total_mocks: scores.length,
    score_variance: Math.max(...scores) - Math.min(...scores),
  };
}

/* ── Topic Analysis ──────────────────────────────────────── */

function buildTopicAnalysis(questions) {
  const topics = {};

  for (const q of questions) {
    if (!topics[q.topic]) {
      topics[q.topic] = { correct: 0, total: 0, times: [], subtopics: {} };
    }
    const topic = topics[q.topic];
    topic.total++;
    if (q.is_correct) topic.correct++;
    topic.times.push(q.time_taken_seconds);

    if (!topic.subtopics[q.subtopic]) {
      topic.subtopics[q.subtopic] = { correct: 0, total: 0, times: [] };
    }
    const sub = topic.subtopics[q.subtopic];
    sub.total++;
    if (q.is_correct) sub.correct++;
    sub.times.push(q.time_taken_seconds);
  }

  const result = {};
  for (const [name, data] of Object.entries(topics)) {
    const accuracy = round((data.correct / data.total) * 100);
    const subtopics = {};

    for (const [subName, subData] of Object.entries(data.subtopics)) {
      const subAcc = round((subData.correct / subData.total) * 100);
      subtopics[subName] = {
        accuracy: subAcc,
        avg_time_sec: Math.round(avg(subData.times)),
        attempts: subData.total,
        classification: classify(subAcc),
      };
    }

    result[name] = {
      accuracy,
      avg_time_sec: Math.round(avg(data.times)),
      total_attempts: data.total,
      subtopics,
    };
  }
  return result;
}

/* ── Per-Mock Topic Breakdown ────────────────────────────── */

function buildPerMockTopics(mocks) {
  return mocks.map(mock => {
    const byTopic = {};
    for (const q of mock.questions) {
      if (!byTopic[q.topic]) byTopic[q.topic] = { correct: 0, total: 0 };
      byTopic[q.topic].total++;
      if (q.is_correct) byTopic[q.topic].correct++;
    }
    const topics = {};
    for (const [t, v] of Object.entries(byTopic)) {
      topics[t] = round((v.correct / v.total) * 100);
    }
    return { mock_id: mock.mock_id, topics };
  });
}

/* ── Error Analysis ──────────────────────────────────────── */

function buildErrorAnalysis(questions) {
  const wrong = questions.filter(q => !q.is_correct);
  const totalNeg = wrong.reduce((sum, q) => sum + Math.abs(q.negative_marks), 0);

  // Conceptual: wrong + spent > 180s thinking about it
  const conceptual = wrong.filter(q => q.time_taken_seconds > 180).length;
  // Careless: wrong + rushed in < 60s
  const careless = wrong.filter(q => q.time_taken_seconds < 60).length;

  // Most-errored subtopics
  const freq = {};
  for (const q of wrong) {
    freq[q.subtopic] = (freq[q.subtopic] || 0) + 1;
  }
  const topErrors = Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([subtopic, errors]) => ({ subtopic, errors }));

  return {
    total_wrong: wrong.length,
    total_negative_marks: round(totalNeg),
    conceptual_errors: conceptual,
    careless_errors: careless,
    error_rate_pct: round((wrong.length / questions.length) * 100),
    fast_wrong_rate_pct: round((careless / questions.length) * 100),
    top_error_subtopics: topErrors,
  };
}

/* ── Time Analysis ───────────────────────────────────────── */

function buildTimeAnalysis(questions) {
  const bySubtopic = {};
  for (const q of questions) {
    if (!bySubtopic[q.subtopic]) bySubtopic[q.subtopic] = [];
    bySubtopic[q.subtopic].push(q.time_taken_seconds);
  }
  return Object.entries(bySubtopic)
    .map(([subtopic, times]) => ({ subtopic, avg_time: Math.round(avg(times)) }))
    .filter(s => s.avg_time > 150)
    .sort((a, b) => b.avg_time - a.avg_time);
}

/* ── Helpers ─────────────────────────────────────────────── */

function avg(arr) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function round(n) {
  return parseFloat(n.toFixed(1));
}

function classify(accuracy) {
  if (accuracy >= 70) return 'STRENGTH';
  if (accuracy >= 50) return 'AVERAGE';
  if (accuracy >= 35) return 'WEAK';
  return 'CRITICAL_WEAK';
}
