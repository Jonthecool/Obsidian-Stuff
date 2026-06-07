/**
 * build.js — LSAT Prep static site generator
 *
 * Reads every .md file from the "LSAT Prep" folder, converts them to HTML,
 * and writes a single self-contained docs/index.html file.
 *
 * Usage:
 *   node build.js          (local)
 *   npm run build          (via package.json script)
 *
 * GitHub Actions runs this automatically on every push to main/master.
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'fs';
import { join } from 'path';
import { marked } from 'marked';

// ─── Configuration ────────────────────────────────────────────────────────────

const VAULT = 'LSAT Prep';
const OUT   = 'docs';

/** Display order for sidebar sections. */
const SECTION_ORDER = [
  'Overview',
  'Logical Reasoning',
  'Reading Comprehension',
  'Progress',
  'Other',
];

/**
 * Sections containing organisational notes (logs, hub, checklists).
 * Flashcard extraction is skipped for these — they don't contain study content.
 */
const NO_FLASH_SECTIONS = new Set(['Overview', 'Progress']);

/**
 * Rules evaluated top-to-bottom against the note filename (without extension).
 * The first matching rule wins.
 */
const CATEGORY_RULES = [
  { pattern: /LSAT Prep Hub/i,           section: 'Overview',              icon: '🏠' },
  { pattern: /Daily/i,                   section: 'Overview',              icon: '📝' },
  { pattern: /^LR\b.*Argument/i,         section: 'Logical Reasoning',     icon: '🧩' },
  { pattern: /^LR\b.*Question/i,         section: 'Logical Reasoning',     icon: '📋' },
  { pattern: /^LR\b.*(Flaw|Error)/i,     section: 'Logical Reasoning',     icon: '⚠️' },
  { pattern: /^LR\b.*Conditional/i,      section: 'Logical Reasoning',     icon: '🔀' },
  { pattern: /^LR\b.*Assumption/i,       section: 'Logical Reasoning',     icon: '🔍' },
  { pattern: /^LR\b.*Strengthen/i,       section: 'Logical Reasoning',     icon: '💪' },
  { pattern: /^LR\b.*Weaken/i,           section: 'Logical Reasoning',     icon: '🪓' },
  { pattern: /^LR\b.*Parallel/i,         section: 'Logical Reasoning',     icon: '🔁' },
  { pattern: /^LR\b/i,                   section: 'Logical Reasoning',     icon: '🧠' },
  { pattern: /^RC\b.*Passage/i,          section: 'Reading Comprehension', icon: '📖' },
  { pattern: /^RC\b.*Question/i,         section: 'Reading Comprehension', icon: '📋' },
  { pattern: /^RC\b.*Strategy/i,         section: 'Reading Comprehension', icon: '🗺️' },
  { pattern: /^RC\b.*Vocab/i,            section: 'Reading Comprehension', icon: '📝' },
  { pattern: /^RC\b/i,                   section: 'Reading Comprehension', icon: '📚' },
  { pattern: /Practice Test/i,           section: 'Progress',              icon: '📊' },
  { pattern: /Error Log/i,               section: 'Progress',              icon: '❌' },
  { pattern: /Weekly Review/i,           section: 'Progress',              icon: '🗓️' },
  { pattern: /Monthly Review/i,          section: 'Progress',              icon: '📅' },
  { pattern: /Score/i,                   section: 'Progress',              icon: '📈' },
  { pattern: /Log/i,                     section: 'Progress',              icon: '📋' },
  { pattern: /Review/i,                  section: 'Progress',              icon: '🔄' },
  { pattern: /AI|Cowork|Opinion/i,       section: 'Other',                 icon: '🤖' },
  { pattern: /Test Day|Checklist/i,      section: 'Other',                 icon: '✅' },
  { pattern: /Update|Changelog/i,        section: 'Other',                 icon: '📝' },
  { pattern: /Resource|Link|Tool/i,      section: 'Other',                 icon: '🔗' },
  { pattern: /Goal|Target/i,             section: 'Other',                 icon: '🎯' },
  { pattern: /.*/,                       section: 'Other',                 icon: '📄' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const labelFromFile = f  => f.replace(/\.md$/i, '');
const slugify       = s  => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
const scorePct      = s  => Math.min(100, Math.max(0, Math.round(((s - 120) / 60) * 100)));

/** Returns the first matching category rule for a given filename. */
function categorize(filename) {
  const name = filename.replace(/\.md$/i, '');
  for (const rule of CATEGORY_RULES) {
    if (rule.pattern.test(name)) return { section: rule.section, icon: rule.icon };
  }
  return { section: 'Other', icon: '📄' };
}

/** Reads the vault directory and returns a page descriptor for each .md file. */
function discoverPages() {
  let files;
  try {
    files = readdirSync(VAULT).filter(f => f.endsWith('.md'));
  } catch {
    console.error(`ERROR: Cannot read "${VAULT}/". Run build.js from the repo root.`);
    process.exit(1);
  }
  return files.map(file => {
    const { section, icon } = categorize(file);
    const label = labelFromFile(file);
    return { file, id: slugify(label), label, icon, section };
  });
}

/**
 * Parses YAML frontmatter from a markdown string.
 * Returns { fm: Record<string, string>, body: string }.
 */
function parseFM(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) return { fm: {}, body: content };
  const fm = {};
  for (const line of match[1].split('\n')) {
    const colon = line.indexOf(':');
    if (colon > 0) {
      fm[line.slice(0, colon).trim()] = line.slice(colon + 1).trim().replace(/^["']|["']$/g, '');
    }
  }
  return { fm, body: content.slice(match[0].length) };
}

/**
 * Cleans Obsidian-specific syntax from markdown before passing to marked:
 *  - Removes ![[embed]] directives
 *  - Converts [[wiki links]] to in-app navigation anchors
 *  - Removes "Back to …" callout lines
 *
 * @param {string} md       - raw markdown content
 * @param {Record<string,string>} wikiMap - maps lower-cased note names to page IDs
 */
function cleanObsidian(md, wikiMap = {}) {
  return md
    .replace(/!\[\[[^\]]+\]\]/g, '')
    .replace(/\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]/g, (_, target, alias) => {
      const display = alias || target;
      const id      = wikiMap[target.trim().toLowerCase()];
      return id
        ? `<a href="#${id}" onclick="event.preventDefault(); show('${id}')">${display}</a>`
        : display;
    })
    .replace(/^>?\s*.*Back to.*\n/gm, '')
    .trim();
}

marked.use({ gfm: true, breaks: false });

/**
 * Extracts question/answer pairs from rendered HTML using three heuristics:
 *  A) `**Bold term**: definition` in list items
 *  B) `**Bold term**: definition` in paragraphs
 *  C) h3/h4 heading followed by a paragraph
 *
 * A content quality filter rejects cards that look like logistical text
 * (section lead-ins, location headers, URL leaks).
 */
function extractFlashcards(html) {
  const cards  = [];
  const seen   = new Set();

  function addCard(front, back) {
    const f   = front.trim();
    const b   = back.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    const key = f.toLowerCase();

    if (b.endsWith(':'))                          return; // section intro, not an answer
    if (/^Near\s/i.test(f))                       return; // location header
    if (f.includes('http') || b.includes('http')) return; // URL leaked into text
    if (/,\s*[A-Z]{2}$/.test(f))                 return; // "City, ST" pattern

    if (f.length >= 2 && b.length >= 4 && !seen.has(key)) {
      seen.add(key);
      cards.push({ front: f, back: b });
    }
  }

  const reA = /<li[^>]*>(?:<p>)?(?:<[^>]+>)*<strong>([^<]{2,80})<\/strong>(?:<\/[^>]+>)*\s*[:—–\-]+\s*([\s\S]{4,300}?)(?=<\/(?:li|p)>)/g;
  const reB = /<p>(?:<[^>]+>)*<strong>([^<]{2,80})<\/strong>(?:<\/[^>]+>)*\s*[:—–\-]+\s*([^<]{4,300})/g;
  const reC = /<h[34][^>]*>([^<]{5,120})<\/h[34]>\s*(?:<[^/][^>]*>)*<p>([^<]{10,400})<\/p>/g;

  let m;
  while ((m = reA.exec(html)) !== null) addCard(m[1], m[2]);
  while ((m = reB.exec(html)) !== null) addCard(m[1], m[2]);
  while ((m = reC.exec(html)) !== null) addCard(m[1].replace(/<[^>]+>/g, ''), m[2]);

  return cards;
}

// ─── Page loading ─────────────────────────────────────────────────────────────

const PAGE_CONFIG = discoverPages();

// Build the wiki-link map before iterating so all pages can reference each other.
const wikiMap = {};
for (const cfg of PAGE_CONFIG) {
  wikiMap[cfg.label.toLowerCase()] = cfg.id;
  wikiMap[cfg.file.replace(/\.md$/i, '').toLowerCase()] = cfg.id;
}

const pages = [];
let   hubFM = {};

for (const cfg of PAGE_CONFIG) {
  try {
    const raw         = readFileSync(join(VAULT, cfg.file), 'utf8');
    const { fm, body} = parseFM(raw);
    if (/LSAT Prep Hub/i.test(cfg.file)) hubFM = fm;

    const html       = marked.parse(cleanObsidian(body, wikiMap));
    const text       = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 3000);
    const difficulty = (fm.difficulty || '').toLowerCase();
    const flashcards = NO_FLASH_SECTIONS.has(cfg.section) ? [] : extractFlashcards(html);

    pages.push({ ...cfg, html, text, difficulty, flashcards, ok: true });
  } catch {
    const errHtml = `<p class="md-err">⚠ Could not load <code>${cfg.file}</code></p>`;
    pages.push({ ...cfg, html: errHtml, text: '', difficulty: '', flashcards: [], ok: false });
  }
}

// Hub first within Overview; everything else alphabetical within its section.
pages.sort((a, b) => {
  const sectionDiff = SECTION_ORDER.indexOf(a.section) - SECTION_ORDER.indexOf(b.section);
  if (sectionDiff !== 0) return sectionDiff;
  if (/LSAT Prep Hub/i.test(a.file)) return -1;
  if (/LSAT Prep Hub/i.test(b.file)) return  1;
  return a.label.localeCompare(b.label);
});

// ─── Score & meta (read from hub frontmatter) ─────────────────────────────────

const curScore = parseFloat(hubFM.current_score) || null;
const tgtScore = parseFloat(hubFM.target_score)  || 170;
const testDate = hubFM.test_date                 || 'November 2026';

const practiceScores = hubFM.practice_scores
  ? String(hubFM.practice_scores).split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n))
  : (curScore ? [curScore] : []);

const curPct  = curScore ? scorePct(curScore) : 0;
const tgtPct  = scorePct(tgtScore);
const fillPct = curScore ? Math.min(100, Math.round((curPct / tgtPct) * 100)) : 0;

/** Returns days remaining until a date string, or null if unparseable. */
function daysUntil(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return isNaN(d) ? null : Math.ceil((d - Date.now()) / 86_400_000);
}

/** Returns a { num, lbl } display object for the countdown widget. */
function countdownDisplay(days) {
  if (days === null)  return null;
  if (days > 0)       return { num: days,             lbl: 'days until test' };
  if (days === 0)     return { num: '🎯',             lbl: 'Test day!'       };
  return              { num: Math.abs(days),           lbl: 'days since test' };
}

const daysLeft  = daysUntil(hubFM.test_date);
const countdown = countdownDisplay(daysLeft);

// ─── Score chart SVG ──────────────────────────────────────────────────────────

function makeScoreChart(scores) {
  if (scores.length < 2) return '';

  const W = 224, H = 64, P = 10;
  const allVals = [...scores, tgtScore];
  const lo      = Math.min(...allVals) - 2;
  const hi      = Math.max(...allVals) + 2;
  const range   = hi - lo || 10;

  const px  = i => (P + (i / (scores.length - 1)) * (W - P * 2)).toFixed(1);
  const py  = s => (H - P - ((s - lo) / range) * (H - P * 2)).toFixed(1);
  const tyc = py(tgtScore);

  const polyline = scores.map((s, i) => `${px(i)},${py(s)}`).join(' ');
  const dots     = scores.map((s, i) => `<circle cx="${px(i)}" cy="${py(s)}" r="2.5" fill="var(--accent)"/>`).join('');
  const labels   = scores.length <= 6
    ? scores.map((s, i) => `<text x="${px(i)}" y="${(parseFloat(py(s)) - 5).toFixed(1)}" text-anchor="middle" font-size="8" fill="var(--text2)">${s}</text>`).join('')
    : '';

  return `<svg class="score-chart" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <line x1="${P}" y1="${tyc}" x2="${W - P}" y2="${tyc}" stroke="var(--green)" stroke-width="1" stroke-dasharray="4,3" opacity=".5"/>
  <polyline points="${polyline}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
  ${dots}${labels}
  <text x="${W - P}" y="${(parseFloat(tyc) - 3).toFixed(1)}" text-anchor="end" font-size="8" fill="var(--green)" opacity=".8">target ${tgtScore}</text>
</svg>`;
}

// ─── HTML fragment builders ───────────────────────────────────────────────────

const buildTimestamp = new Date().toLocaleString('en-US', {
  month: 'short', day: 'numeric', year: 'numeric',
  hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
});

const DIFF_BADGE = { easy: '🟢', medium: '🟡', hard: '🔴' };

/** Groups pages by section and builds the sidebar navigation HTML. */
function buildNavHtml(pages) {
  const sections = {};
  for (const p of pages) {
    (sections[p.section] ??= []).push(p);
  }

  return Object.entries(sections).map(([sec, ps]) => {
    const items = ps.map(p => {
      const badge = DIFF_BADGE[p.difficulty]
        ? `<span class="diff-dot" title="${p.difficulty}">${DIFF_BADGE[p.difficulty]}</span>`
        : '';
      return `<div class="s-nav-item" id="nav-${p.id}" onclick="show('${p.id}')">` +
             `<span class="s-nav-icon">${p.icon}</span>` +
             `<span class="s-nav-label-text">${p.label}</span>${badge}</div>`;
    }).join('\n      ');

    return `
    <div class="s-nav-group">
      <div class="s-nav-label">${sec}</div>
      ${items}
    </div>`;
  }).join('');
}

/** Builds the full HTML block for all pages (the #main content area). */
function buildPagesHtml(pages) {
  return pages.map(p => {
    const diffLabel = p.difficulty
      ? `<span class="diff-pill diff-${p.difficulty}">${p.difficulty}</span>`
      : '';
    const fcBtn = p.flashcards.length
      ? `<button class="hdr-btn" onclick="openFlash('${p.id}')" title="Flashcards (${p.flashcards.length})">🃏 ${p.flashcards.length}</button>`
      : '';

    return `
  <div class="page" id="page-${p.id}">
    <div class="page-header">
      <div class="ph-left">
        <h2>${p.icon} ${p.label} ${diffLabel}</h2>
        <p class="page-meta">Updated ${buildTimestamp}</p>
      </div>
      <div class="ph-right">
        <div class="mastery-widget" id="mastery-${p.id}" title="Rate your mastery of this topic">
          <span class="mastery-lbl">Mastery</span>
          <button class="m-btn" data-id="${p.id}" data-level="1" onclick="setMastery('${p.id}',1)" title="Need to review">🔴</button>
          <button class="m-btn" data-id="${p.id}" data-level="2" onclick="setMastery('${p.id}',2)" title="Still learning">🟡</button>
          <button class="m-btn" data-id="${p.id}" data-level="3" onclick="setMastery('${p.id}',3)" title="Got it">🟢</button>
        </div>
        ${fcBtn}
        <button class="hdr-btn" onclick="window.print()" title="Print">⎙</button>
      </div>
    </div>
    <div class="page-body md" id="body-${p.id}">
      ${p.html}
    </div>
  </div>`;
  }).join('\n');
}

/** Builds the countdown widget HTML, handling past/present/future states. */
function buildCountdownHtml(countdown, daysLeft) {
  if (!countdown) return '';
  const pastClass = daysLeft !== null && daysLeft <= 0 ? ' past' : '';
  const icon      = daysLeft !== null && daysLeft <= 0 ? '🎓' : '⏳';
  return `
  <div class="s-countdown${pastClass}">
    <div>
      <div class="s-countdown-num">${countdown.num}</div>
      <div class="s-countdown-lbl">${countdown.lbl}</div>
    </div>
    <div style="font-size:24px">${icon}</div>
  </div>`;
}

/** Builds the mood banner emoji row. */
function buildMoodEmojis() {
  const emojis  = ['😰', '😐', '🙂', '💪', '🔥'];
  const labels  = ['Struggling', 'Unsure', 'Okay', 'Confident', 'On fire!'];
  return emojis.map((e, i) =>
    `<span class="mood-opt" data-v="${i + 1}" onclick="setMood(${i + 1})" title="${labels[i]}" ` +
    `style="font-size:22px;cursor:pointer;opacity:.4;transition:opacity .1s,transform .1s">${e}</span>`
  ).join('');
}

// ─── Template assembly ────────────────────────────────────────────────────────

const css       = readFileSync(join('src', 'style.css'), 'utf8');
const defaultId = pages[0]?.id || 'hub';

const clientJs  = readFileSync(join('src', 'client.js'), 'utf8')
  .replace("'%%DEFAULT%%'", JSON.stringify(defaultId))
  .replace('%%IDS%%',       JSON.stringify(pages.map(p => p.id)))
  .replace('%%INDEX%%',     JSON.stringify(pages.map(p => ({ id: p.id, label: p.label, icon: p.icon, section: p.section, text: p.text }))))
  .replace('%%FCDATA%%',    JSON.stringify(Object.fromEntries(pages.filter(p => p.flashcards.length).map(p => [p.id, p.flashcards]))));

const navHtml       = buildNavHtml(pages);
const pagesHtml     = buildPagesHtml(pages);
const countdownHtml = buildCountdownHtml(countdown, daysLeft);
const moodEmojis    = buildMoodEmojis();
const chartHtml     = makeScoreChart(practiceScores);

const HTML = `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>LSAT Prep — Jon</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>${css}</style>
</head>
<body>

<div id="progress-bar"></div>
<div id="overlay" onclick="closeSidebar()"></div>

<div id="topbar">
  <div id="menu-btn" onclick="toggleSidebar()">☰</div>
  <span id="topbar-title">LSAT Prep</span>
</div>

<div id="sidebar">
  <div class="s-brand">
    <div class="s-brand-row">
      <div class="s-logo">L</div>
      <div class="s-brand-text">
        <h1>LSAT Prep</h1>
        <p>Jon &middot; ${testDate}</p>
      </div>
    </div>
    <div class="s-brand-actions">
      <div class="icon-btn" onclick="openSearch()" title="Search (Ctrl+K)">🔍</div>
      <div class="icon-btn" onclick="toggleTheme()" id="theme-btn" title="Toggle theme">🌙</div>
    </div>
  </div>

  <div class="s-score">
    <div class="s-score-nums">
      <span class="s-cur">${curScore ?? '—'}</span>
      <span class="s-sep">/</span>
      <span class="s-tgt">${tgtScore}</span>
    </div>
    <div class="s-lbl">+${curScore ? tgtScore - curScore : '?'} points to target</div>
    <div class="s-bar"><div class="s-bar-fill" style="width:${fillPct}%"></div></div>
    ${chartHtml}
  </div>

  ${countdownHtml}

  <div class="s-links">
    <div class="s-links-label">Quick Links</div>
    <a class="s-link-item" href="https://lawhub.org" target="_blank" rel="noopener noreferrer">
      <span class="s-nav-icon">⚖️</span>
      <span>LawHub</span>
      <span class="s-link-arrow">↗</span>
    </a>
    <a class="s-link-item" href="https://7sage.com" target="_blank" rel="noopener noreferrer">
      <span class="s-nav-icon">🎯</span>
      <span>7Sage</span>
      <span class="s-link-arrow">↗</span>
    </a>
    <a class="s-link-item" href="https://lsatdemon.com" target="_blank" rel="noopener noreferrer">
      <span class="s-nav-icon">😈</span>
      <span>LSAT Demon</span>
      <span class="s-link-arrow">↗</span>
    </a>
  </div>

  <div class="s-nav">${navHtml}
  </div>
</div>

<div id="search-modal">
  <div id="search-box">
    <input id="search-input" placeholder="Search notes…" autocomplete="off" spellcheck="false">
    <div id="search-results"></div>
    <div class="sr-hint">
      <span><kbd>↑↓</kbd> navigate</span>
      <span><kbd>↵</kbd> open</span>
      <span><kbd>Esc</kbd> close</span>
    </div>
  </div>
</div>

<div id="flash-modal" onclick="if(event.target===this) closeFlash()">
  <div id="flash-box">
    <div class="flash-topbar">
      <span class="flash-title">Flashcards</span>
      <span class="flash-meta" id="flash-counter"></span>
      <button id="flash-close" onclick="closeFlash()">×</button>
    </div>
    <div class="flash-track"><div class="flash-track-fill" id="flash-track-fill"></div></div>
    <div class="flash-scene" onclick="flipCard()">
      <div class="flash-flipper" id="flash-flipper">
        <div class="flash-face">
          <div class="flash-side-label">Question</div>
          <div class="flash-text" id="flash-front"></div>
        </div>
        <div class="flash-face-back">
          <div class="flash-side-label">Answer</div>
          <div class="flash-text" id="flash-back"></div>
        </div>
      </div>
    </div>
    <div class="flash-hint" id="flash-hint">
      tap card or press <kbd style="font-size:10px;padding:1px 4px;border:1px solid var(--border);border-radius:3px;font-family:monospace">Space</kbd> to flip
    </div>
    <div class="flash-session">
      <span class="know-c">✅ Know it: <b id="fc-know">0</b></span>
      <span class="idk-c">🔁 Review: <b id="fc-idk">0</b></span>
    </div>
    <div class="flash-controls">
      <button class="flash-btn" onclick="fcNav(-1)">← Prev</button>
      <button class="flash-btn know" onclick="markCard(true)">✅ Know it</button>
      <button class="flash-btn idk"  onclick="markCard(false)">🔁 Review</button>
      <button class="flash-btn" onclick="shuffleCards()">⇄ Shuffle</button>
      <button class="flash-btn" onclick="fcNav(1)">Next →</button>
    </div>
  </div>
</div>

<div id="mood-banner" style="display:none;position:fixed;bottom:0;left:0;width:var(--sw);padding:10px 12px;background:var(--surf);border-top:1px solid var(--border);z-index:201">
  <div style="font-size:11px;color:var(--text3);margin-bottom:6px;font-weight:500">How's your study confidence today?</div>
  <div style="display:flex;justify-content:space-between">${moodEmojis}</div>
  <div id="mood-history" style="margin-top:8px;display:flex;gap:3px;align-items:flex-end;height:24px"></div>
</div>

<div id="main">
${pagesHtml}
</div>

<script>${clientJs}</script>
</body>
</html>`;

// ─── Write output ─────────────────────────────────────────────────────────────

mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'index.html'), HTML, 'utf8');
console.log(`✅  Built ${join(OUT, 'index.html')} — ${pages.length} pages — ${buildTimestamp}`);
