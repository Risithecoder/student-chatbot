/**
 * OliveBot — Message Renderer
 * Transforms AI-generated text (with special STATS/CHART/ROADMAP tags + markdown)
 * into rich HTML for display in the chat interface.
 */

/**
 * Render a raw AI response into rich HTML.
 * @param {string} raw - Raw text from LLM (may include special tags and markdown)
 * @returns {string} - Rendered HTML string
 */
export function renderMessage(raw) {
  let html = raw;

  html = renderStatBlocks(html);
  html = renderChartBlocks(html);
  html = renderRoadmapBlocks(html);
  html = renderMockLinkBlocks(html);
  html = renderMarkdownTables(html);
  html = renderMarkdown(html);

  return html;
}

/* ── STATS Block ─────────────────────────────────────────── */

function renderStatBlocks(html) {
  return html.replace(/<STATS items='([^']+)'\/>/g, (_, json) => {
    try {
      const items = JSON.parse(json);
      const cards = items
        .map(
          item => `
          <div class="stat-card">
            <div class="stat-card-val ${item.color}">${item.val}</div>
            <div class="stat-card-lbl">${item.label}</div>
          </div>`
        )
        .join('');
      return `<div class="stat-grid">${cards}</div>`;
    } catch {
      return '';
    }
  });
}

/* ── CHART Block ─────────────────────────────────────────── */

function renderChartBlocks(html) {
  return html.replace(
    /<CHART type="([^"]+)" title="([^"]+)" labels='([^']+)' data='([^']+)' colors='([^']+)'\/>/g,
    (_, type, title, labels, data, colors) => {
      const chartId = 'chart-' + Math.random().toString(36).slice(2, 10);
      // Defer chart rendering until the DOM element exists
      setTimeout(() => renderInlineChart(chartId, type, labels, data, colors), 100);
      return `
        <div class="inline-chart">
          <div class="chart-title">${title}</div>
          <canvas id="${chartId}"></canvas>
        </div>`;
    }
  );
}

/**
 * Renders a Chart.js chart into a canvas element.
 * Called asynchronously after the DOM element is inserted.
 */
function renderInlineChart(id, type, labelsJson, dataJson, colorsJson) {
  const canvas = document.getElementById(id);
  if (!canvas) return;

  try {
    const labels = JSON.parse(labelsJson);
    const data = JSON.parse(dataJson);
    const colors = JSON.parse(colorsJson);
    const isBar = type === 'bar';

    // eslint-disable-next-line no-undef
    new Chart(canvas.getContext('2d'), {
      type: isBar ? 'bar' : 'line',
      data: {
        labels,
        datasets: [
          {
            data,
            backgroundColor: colors.map(c => c + '33'),
            borderColor: colors,
            borderWidth: 2,
            borderRadius: isBar ? 6 : 0,
            pointBackgroundColor: colors,
            pointRadius: isBar ? 0 : 4,
            tension: 0.4,
            fill: !isBar,
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
          x: {
            ticks: { color: '#9ea5b4', font: { size: 11 } },
            grid: { color: 'rgba(255,255,255,0.04)' },
          },
          y: {
            ticks: { color: '#9ea5b4', font: { size: 11 } },
            grid: { color: 'rgba(255,255,255,0.04)' },
          },
        },
      },
    });
  } catch (err) {
    console.error('[OliveBot] Chart render error:', err);
  }
}

/* ── ROADMAP Block ───────────────────────────────────────── */

function renderRoadmapBlocks(html) {
  return html.replace(/<ROADMAP weeks='([^']+)'\/>/g, (_, json) => {
    try {
      const weeks = JSON.parse(json);
      const cards = weeks
        .map(w => {
          const priorityClass =
            w.priority === 'critical' ? 'critical' : w.priority === 'attention' ? 'attention' : '';
          const tags = (w.tags || []).map(t => `<span class="week-tag">${t}</span>`).join('');
          return `
            <div class="week-card ${priorityClass}">
              <div class="week-title">Week ${w.week}: ${w.theme}</div>
              ${w.focus ? `<div class="week-focus">${w.focus}</div>` : ''}
              <div class="week-tags">${tags}</div>
            </div>`;
        })
        .join('');
      return `<div class="roadmap">${cards}</div>`;
    } catch {
      return '';
    }
  });
}

/* ── MOCK_LINK Block ─────────────────────────────────────── */

function renderMockLinkBlocks(html) {
  // Flexible regex: matches <MOCK_LINK ... /> with attributes in ANY order
  return html.replace(
    /<MOCK_LINK\s+([^>]*?)\/>/g,
    (_, attrs) => {
      const get = (key) => {
        const m = attrs.match(new RegExp(`${key}\\s*=\\s*"([^"]*?)"`));
        return m ? m[1] : '';
      };
      const id = get('id');
      const name = get('name');
      const difficulty = get('difficulty') || 'Medium';
      const questions = get('questions') || '10';
      const topics = get('topics') || '';
      const reason = get('reason') || 'Recommended based on your performance data';

      if (!id && !name) return '';

      const diffClass =
        difficulty === 'Hard' ? 'diff-hard' : difficulty === 'Easy' ? 'diff-easy' : 'diff-medium';
      const quizId = id || name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
      return `
        <div class="mock-rec-card" onclick="window.startQuiz('${quizId}')">
          <div class="mock-rec-header">
            <div class="mock-rec-name">${name || id}</div>
            <span class="mock-rec-diff ${diffClass}">${difficulty}</span>
          </div>
          ${topics ? `<div class="mock-rec-topics">📚 ${topics}</div>` : ''}
          <div class="mock-rec-reason">💡 ${reason}</div>
          <div class="mock-rec-footer">
            <span class="mock-rec-count">🎯 ${questions} questions</span>
            <button class="mock-rec-btn">Start Mini Quiz →</button>
          </div>
        </div>`;
    }
  );
}

/* ── Markdown Tables ─────────────────────────────────────── */

function renderMarkdownTables(html) {
  return html.replace(
    /(?:^|\n)(\|.+\|)\n(\|[-:| ]+\|)\n((?:\|.+\|\n?)+)/g,
    (_match, headerRow, _sepRow, bodyRows) => {
      const headers = headerRow
        .split('|')
        .filter(c => c.trim())
        .map(c => `<th>${c.trim()}</th>`)
        .join('');
      const rows = bodyRows
        .trim()
        .split('\n')
        .map(row => {
          const cells = row
            .split('|')
            .filter(c => c.trim())
            .map(c => `<td>${c.trim()}</td>`)
            .join('');
          return `<tr>${cells}</tr>`;
        })
        .join('');
      return `<table><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table>`;
    }
  );
}

/* ── Markdown Formatting ─────────────────────────────────── */

function renderMarkdown(html) {
  // Headers
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');

  // Inline formatting
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/`(.+?)`/g, '<code>$1</code>');

  // Lists
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/^(\d+)\. (.+)$/gm, '<li>$2</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, match => `<ul>${match}</ul>`);

  // Paragraphs and line breaks
  html = html.replace(/\n\n/g, '</p><p>');
  html = html.replace(/\n/g, '<br/>');
  html = `<p>${html}</p>`;

  // Clean up: remove empty paragraphs and fix nesting
  html = html.replace(/<p><\/p>/g, '');
  html = html.replace(/<p>(<h[23]>)/g, '$1');
  html = html.replace(/(<\/h[23]>)<\/p>/g, '$1');
  html = html.replace(/<p>(<ul>)/g, '$1');
  html = html.replace(/(<\/ul>)<\/p>/g, '$1');
  html = html.replace(/<p>(<div)/g, '$1');
  html = html.replace(/(<\/div>)<\/p>/g, '$1');
  html = html.replace(/<p>(<table)/g, '$1');
  html = html.replace(/(<\/table>)<\/p>/g, '$1');

  return html;
}
