/**
 * OliveBot — Sidebar Controller
 * Manages file upload, student info display, mini-stats,
 * score trend chart, and quick prompt buttons.
 */

/* ── State ───────────────────────────────────────────────── */

let sidebarChart = null;

/* ── Public API ──────────────────────────────────────────── */

/**
 * Populate all sidebar sections with data from the parsed JSON and stats.
 * @param {Object} mockData - Parsed mock test JSON
 * @param {Object} stats    - Pre-computed stats from stats-engine.js
 */
export function populateSidebar(mockData, stats) {
  populateStudentCard(mockData);
  populateMiniStats(stats);
  populateScoreTrendChart(stats);
  showSidebarSections();
  updateExamBadge(mockData.user.target_exam);
}

/**
 * Build the initial welcome message shown after data upload.
 * @param {Object} mockData - Parsed mock test JSON
 * @param {Object} stats    - Pre-computed stats
 * @returns {string}
 */
export function buildWelcomeMessage(mockData, stats) {
  const s = stats.summary;
  const firstName = mockData.user.name.split(' ')[0];
  const daysLeft = getDaysLeft(mockData.user.exam_date);
  const weakTopics = Object.entries(stats.topic_analysis)
    .filter(([, v]) => v.accuracy < 60)
    .map(([k]) => k);

  const pctColor = s.avg_percentile >= 70 ? 'green' : s.avg_percentile >= 60 ? 'amber' : 'red';
  const impColor = s.improvement_points > 0 ? 'green' : 'red';
  const impSign = s.improvement_points > 0 ? '+' : '';

  return `<STATS items='[{"val":"${s.avg_score}","label":"Avg Score","color":"olive"},{"val":"${s.avg_percentile}%","label":"Avg Percentile","color":"${pctColor}"},{"val":"${impSign}${s.improvement_points}","label":"Improvement","color":"${impColor}"},{"val":"${daysLeft}","label":"Days Left","color":"amber"}]'/>

Hey **${firstName}!** 👋 I've loaded your **${mockData.metadata.total_mocks_attempted} mock tests** for **${mockData.user.target_exam}**.

Here's your instant snapshot:

- 📈 You've improved by **${impSign}${s.improvement_points} points** from Mock 1 to Mock ${s.total_mocks}
- 🎯 Your average percentile is **${s.avg_percentile}%** — ${s.avg_percentile >= 70 ? '✅ on track for the cutoff' : '⚠️ needs to reach 70%+ for most banking exams'}
- 🔴 Focus areas: **${weakTopics.length > 0 ? weakTopics.join(', ') : 'looking good across the board!'}**

What would you like to dive into? Use the quick prompts on the left, or ask me anything.`;
}

/**
 * Set up file upload and drag-and-drop listeners.
 * @param {Function} onFileLoaded - Callback receiving parsed JSON data
 */
export function initFileUpload(onFileLoaded) {
  const fileInput = document.getElementById('file-input');
  const uploadZone = document.getElementById('upload-zone');

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) readJsonFile(file, onFileLoaded);
  });

  uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadZone.classList.add('drag-active');
  });

  uploadZone.addEventListener('dragleave', () => {
    uploadZone.classList.remove('drag-active');
  });

  uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.classList.remove('drag-active');
    const file = e.dataTransfer.files[0];
    if (file) readJsonFile(file, onFileLoaded);
  });
}

/* ── Internal Functions ──────────────────────────────────── */

function readJsonFile(file, callback) {
  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const data = JSON.parse(event.target.result);
      if (!data.user || !data.mock_tests || !data.metadata) {
        alert('Invalid JSON structure. File must contain "user", "metadata", and "mock_tests".');
        return;
      }
      document.getElementById('upload-status').style.display = 'block';
      callback(data);
    } catch (err) {
      alert('Failed to parse JSON: ' + err.message);
    }
  };
  reader.readAsText(file);
}

function populateStudentCard(data) {
  const daysLeft = getDaysLeft(data.user.exam_date);
  document.getElementById('s-name').textContent = data.user.name;
  document.getElementById('s-exam').textContent = data.user.target_exam;
  document.getElementById('s-mocks').textContent = `${data.metadata.total_mocks_attempted} mocks`;
  document.getElementById('s-days').textContent = daysLeft > 0 ? `${daysLeft}d left` : 'Exam passed';
}

function populateMiniStats(stats) {
  const s = stats.summary;
  document.getElementById('avg-score').textContent = s.avg_score;
  document.getElementById('avg-pct').textContent = s.avg_percentile + '%';
  document.getElementById('best-score').textContent = s.best_score;
  document.getElementById('improvement').textContent = (s.improvement_points > 0 ? '+' : '') + s.improvement_points;

  // Score trend badge
  const scoreTrendEl = document.getElementById('score-trend');
  const trendPositive = s.rolling_trend_vs_first3 > 0;
  scoreTrendEl.textContent = trendPositive
    ? `📈 +${s.rolling_trend_vs_first3} vs early`
    : `📉 ${s.rolling_trend_vs_first3} vs early`;
  scoreTrendEl.className = 'mini-stat-trend ' + (trendPositive ? 'trend-up' : 'trend-dn');

  // Percentile trend badge
  const pctTrendEl = document.getElementById('pct-trend');
  const pcts = stats.score_progression.map(p => p.percentile);
  const pctDiff = (pcts[pcts.length - 1] - pcts[0]).toFixed(1);
  const pctPositive = pctDiff > 0;
  pctTrendEl.textContent = pctPositive ? `📈 +${pctDiff}%` : `📉 ${pctDiff}%`;
  pctTrendEl.className = 'mini-stat-trend ' + (pctPositive ? 'trend-up' : 'trend-dn');
}

function populateScoreTrendChart(stats) {
  const ctx = document.getElementById('sidebar-chart').getContext('2d');
  if (sidebarChart) sidebarChart.destroy();

  const labels = stats.score_progression.map((_, i) => `M${i + 1}`);
  const scores = stats.score_progression.map(s => s.score);

  // eslint-disable-next-line no-undef
  sidebarChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          data: scores,
          borderColor: '#8db840',
          backgroundColor: 'rgba(141,184,64,0.06)',
          borderWidth: 2,
          pointBackgroundColor: '#8db840',
          pointRadius: 3,
          pointHoverRadius: 5,
          fill: true,
          tension: 0.4,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1e232e',
          titleColor: '#8db840',
          bodyColor: '#e8ebf2',
          borderColor: 'rgba(141,184,64,0.3)',
          borderWidth: 1,
        },
      },
      scales: {
        x: { ticks: { color: '#5a6170', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.03)' } },
        y: { ticks: { color: '#5a6170', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.03)' } },
      },
    },
  });
}

function showSidebarSections() {
  document.getElementById('student-section').style.display = '';
  document.getElementById('stats-section').style.display = '';
  document.getElementById('chart-section').style.display = '';
  document.getElementById('quick-prompts').style.display = '';
}

function updateExamBadge(examName) {
  document.getElementById('exam-badge-text').textContent = examName;
}

function getDaysLeft(examDateStr) {
  return Math.ceil((new Date(examDateStr) - new Date()) / 86400000);
}
