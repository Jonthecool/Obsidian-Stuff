/**
 * build.js — reads "LSAT Prep/*.md" and generates docs/index.html
 * Run locally:  node build.js
 * Run in CI:    triggered automatically by GitHub Actions on every push
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'fs';
import { join, basename } from 'path';
import { marked } from 'marked';

// ─── Config ──────────────────────────────────────────────────────────────────

const VAULT = 'LSAT Prep';   // path to your Obsidian folder in the repo root
const OUT   = 'docs';        // GitHub Pages will serve from here

// Section display order in the sidebar
const SECTION_ORDER = ['Overview', 'Logical Reasoning', 'Reading Comprehension', 'Progress', 'Other'];

// Rules evaluated top-to-bottom — first match wins.
// Add new rules here if you want a new note to land in a specific section/icon.
const CATEGORY_RULES = [
  // ── Overview ──────────────────────────────────────────────────────────────
  { pattern: /LSAT Prep Hub/i,           section: 'Overview',              icon: '🏠' },
  { pattern: /Daily/i,                   section: 'Overview',              icon: '📝' },

  // ── Logical Reasoning ─────────────────────────────────────────────────────
  { pattern: /^LR\b.*Argument/i,         section: 'Logical Reasoning',     icon: '🧩' },
  { pattern: /^LR\b.*Question/i,         section: 'Logical Reasoning',     icon: '📋' },
  { pattern: /^LR\b.*(Flaw|Error)/i,     section: 'Logical Reasoning',     icon: '⚠️' },
  { pattern: /^LR\b.*Conditional/i,      section: 'Logical Reasoning',     icon: '🔀' },
  { pattern: /^LR\b.*Assumption/i,       section: 'Logical Reasoning',     icon: '🔍' },
  { pattern: /^LR\b.*Strengthen/i,       section: 'Logical Reasoning',     icon: '💪' },
  { pattern: /^LR\b.*Weaken/i,           section: 'Logical Reasoning',     icon: '🪓' },
  { pattern: /^LR\b.*Parallel/i,         section: 'Logical Reasoning',     icon: '🔁' },
  { pattern: /^LR\b/i,                   section: 'Logical Reasoning',     icon: '🧠' }, // any other LR note

  // ── Reading Comprehension ─────────────────────────────────────────────────
  { pattern: /^RC\b.*Passage/i,          section: 'Reading Comprehension', icon: '📖' },
  { pattern: /^RC\b.*Question/i,         section: 'Reading Comprehension', icon: '📋' },
  { pattern: /^RC\b.*Strategy/i,         section: 'Reading Comprehension', icon: '🗺️' },
  { pattern: /^RC\b.*Vocab/i,            section: 'Reading Comprehension', icon: '📝' },
  { pattern: /^RC\b/i,                   section: 'Reading Comprehension', icon: '📚' }, // any other RC note

  // ── Progress ──────────────────────────────────────────────────────────────
  { pattern: /Practice Test/i,           section: 'Progress',              icon: '📊' },
  { pattern: /Error Log/i,               section: 'Progress',              icon: '❌' },
  { pattern: /Weekly Review/i,           section: 'Progress',              icon: '🗓️' },
  { pattern: /Monthly Review/i,          section: 'Progress',              icon: '📅' },
  { pattern: /Score/i,                   section: 'Progress',              icon: '📈' },
  { pattern: /Log/i,                     section: 'Progress',              icon: '📋' },
  { pattern: /Review/i,                  section: 'Progress',              icon: '🔄' },

  // ── Other ─────────────────────────────────────────────────────────────────
  { pattern: /AI|Cowork|Opinion/i,       section: 'Other',                 icon: '🤖' },
  { pattern: /Test Day|Checklist/i,      section: 'Other',                 icon: '✅' },
  { pattern: /Update|Changelog/i,        section: 'Other',                 icon: '📝' },
  { pattern: /Resource|Link|Tool/i,      section: 'Other',                 icon: '🔗' },
  { pattern: /Goal|Target/i,             section: 'Other',                 icon: '🎯' },
  { pattern: /.*/,                       section: 'Other',                 icon: '📄' }, // catch-all
];

// Derive label from filename: strip extension, strip "LR - "/"RC - " prefix for display
function labelFromFile(filename) {
  return filename.replace(/\.md$/i, '');
}

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function categorize(filename) {
  const name = filename.replace(/\.md$/i, '');
  for (const rule of CATEGORY_RULES) {
    if (rule.pattern.test(name)) {
      return { section: rule.section, icon: rule.icon };
    }
  }
  return { section: 'Other', icon: '📄' };
}

// ─── Auto-discover all .md files in LSAT Prep ────────────────────────────────

function discoverPages() {
  let files;
  try {
    files = readdirSync(VAULT).filter(f => f.endsWith('.md'));
  } catch {
    console.error(`ERROR: Could not read folder "${VAULT}". Make sure build.js runs from the repo root.`);
    process.exit(1);
  }

  return files.map(file => {
    const { section, icon } = categorize(file);
    const label = labelFromFile(file);
    const id    = slugify(label);
    return { file, id, label, icon, section };
  });
}

// ─── Markdown helpers ─────────────────────────────────────────────────────────

function parseFM(content) {
  const m = content.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m) return { fm: {}, body: content };
  const fm = {};
  for (const line of m[1].split('\n')) {
    const i = line.indexOf(':');
    if (i > 0) fm[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
  }
  return { fm, body: content.slice(m[0].length) };
}

function cleanObsidian(md) {
  return md
    .replace(/\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]/g, (_, t, a) => a || t)  // [[link]] or [[link|alias]]
    .replace(/!\[\[[^\]]+\]\]/g, '')                                          // ![[embed]]
    .replace(/^>?\s*.*Back to.*\n/gm, '')                                    // "Back to hub" footer lines
    .trim();
}

marked.use({ gfm: true, breaks: false });

// ─── Load pages ───────────────────────────────────────────────────────────────

const PAGE_CONFIG = discoverPages();  // auto-discovered from LSAT Prep folder

const pages = [];
let hubFM   = {};

for (const cfg of PAGE_CONFIG) {
  const filePath = join(VAULT, cfg.file);
  try {
    const raw          = readFileSync(filePath, 'utf8');
    const { fm, body } = parseFM(raw);
    // Use the hub file for score/meta regardless of its exact name
    if (/LSAT Prep Hub/i.test(cfg.file)) hubFM = fm;
    pages.push({ ...cfg, html: marked.parse(cleanObsidian(body)), ok: true });
  } catch {
    pages.push({ ...cfg, html: `<p class="md-err">⚠ Could not load <code>${cfg.file}</code></p>`, ok: false });
  }
}

// Sort: within each section, keep Hub first, then alphabetically
pages.sort((a, b) => {
  const si = SECTION_ORDER.indexOf(a.section) - SECTION_ORDER.indexOf(b.section);
  if (si !== 0) return si;
  // Hub always first in Overview
  if (/LSAT Prep Hub/i.test(a.file)) return -1;
  if (/LSAT Prep Hub/i.test(b.file)) return  1;
  return a.label.localeCompare(b.label);
});

// ─── Score / meta from hub frontmatter ───────────────────────────────────────

const curScore  = parseFloat(hubFM.current_score)   || null;
const tgtScore  = parseFloat(hubFM.target_score)    || 170;
const testDate  = hubFM.test_date                   || 'November 2026';

function scorePct(s) { return Math.min(100, Math.max(0, Math.round(((s - 120) / 60) * 100))); }
const curPct   = curScore ? scorePct(curScore) : 0;
const tgtPct   = scorePct(tgtScore);
const fillPct  = curScore ? Math.round((curPct / tgtPct) * 100) : 0;

// ─── Build HTML ───────────────────────────────────────────────────────────────

// Group pages by section for sidebar
const sections = {};
for (const p of pages) (sections[p.section] = sections[p.section] || []).push(p);

const defaultPage = pages[0]?.id || 'hub';
const buildISO    = new Date().toISOString();
const buildStr    = new Date().toLocaleString('en-US', {
  month: 'short', day: 'numeric', year: 'numeric',
  hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
});

const navHTML = Object.entries(sections).map(([sec, ps]) => `
    <div class="s-nav-group">
      <div class="s-nav-label">${sec}</div>
      ${ps.map(p => `<div class="s-nav-item" id="nav-${p.id}" onclick="show('${p.id}')"><span class="s-nav-icon">${p.icon}</span>${p.label}</div>`).join('\n      ')}
    </div>`).join('');

const pagesHTML = pages.map(p => `
  <div class="page" id="page-${p.id}">
    <div class="page-header">
      <h2>${p.icon} ${p.label}</h2>
      <p class="page-meta">Updated ${buildStr}</p>
    </div>
    <div class="page-body md">
      ${p.html}
    </div>
  </div>`).join('\n');

// ─── Full HTML output ─────────────────────────────────────────────────────────

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>LSAT Prep — Jon</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
/* ── Tokens ───────────────────────────────────────────────────────────────── */
:root {
  --bg:        #0f0f10;
  --surf:      #161618;
  --surf2:     #1c1c1f;
  --surf3:     #232327;
  --border:    #2a2a2e;
  --border-s:  #232327;
  --accent:    #4f7eff;
  --accent-d:  rgba(79,126,255,.1);
  --green:     #30d158;
  --green-d:   rgba(48,209,88,.1);
  --yellow:    #f5a623;
  --yellow-d:  rgba(245,166,35,.1);
  --red:       #ff453a;
  --text:      #f2f2f7;
  --text2:     #8e8e93;
  --text3:     #48484a;
  --sw:        258px;
  --topbar:    52px;
  --radius:    8px;
  --font:      'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

/* ── Reset ────────────────────────────────────────────────────────────────── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { font-size: 15px; -webkit-font-smoothing: antialiased; }
body { background: var(--bg); color: var(--text); font-family: var(--font); line-height: 1.5; }
a { color: var(--accent); text-decoration: none; }
a:hover { text-decoration: underline; }

/* ── Sidebar ──────────────────────────────────────────────────────────────── */
#sidebar {
  position: fixed; top: 0; left: 0; width: var(--sw); height: 100vh;
  background: var(--surf); border-right: 1px solid var(--border);
  display: flex; flex-direction: column; overflow-y: auto; z-index: 200;
  scrollbar-width: thin; scrollbar-color: var(--border) transparent;
}

.s-brand {
  padding: 20px 16px 16px;
  border-bottom: 1px solid var(--border-s);
  flex-shrink: 0;
}
.s-brand-row { display: flex; align-items: center; gap: 9px; }
.s-logo {
  width: 28px; height: 28px; border-radius: 7px;
  background: var(--accent); display: flex; align-items: center; justify-content: center;
  font-size: 13px; font-weight: 700; color: #fff; flex-shrink: 0;
  letter-spacing: -.5px;
}
.s-brand-text h1 { font-size: 14px; font-weight: 600; letter-spacing: -.2px; color: var(--text); }
.s-brand-text p  { font-size: 11px; color: var(--text3); margin-top: 1px; }

/* Score card */
.s-score {
  margin: 12px 12px 4px;
  background: var(--surf2);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 12px 14px;
  flex-shrink: 0;
}
.s-score-nums { display: flex; align-items: baseline; gap: 6px; margin-bottom: 8px; }
.s-cur { font-size: 26px; font-weight: 700; letter-spacing: -1px; color: var(--yellow); }
.s-sep { font-size: 14px; color: var(--text3); }
.s-tgt { font-size: 16px; font-weight: 600; color: var(--text2); }
.s-lbl { font-size: 11px; color: var(--text3); margin-bottom: 6px; }
.s-bar { height: 3px; background: var(--border); border-radius: 99px; overflow: hidden; }
.s-bar-fill { height: 100%; background: var(--accent); border-radius: 99px; }

/* Nav */
.s-nav { padding: 8px 0 16px; flex: 1; }
.s-nav-group { margin-top: 4px; }
.s-nav-label {
  padding: 12px 16px 4px;
  font-size: 10.5px; font-weight: 600; color: var(--text3);
  text-transform: uppercase; letter-spacing: .8px;
}
.s-nav-item {
  display: flex; align-items: center; gap: 9px;
  padding: 6px 16px; margin: 1px 8px; border-radius: 6px;
  font-size: 13.5px; color: var(--text2);
  cursor: pointer; transition: background .1s, color .1s;
  user-select: none;
}
.s-nav-item:hover  { background: var(--surf2); color: var(--text); }
.s-nav-item.active { background: var(--accent-d); color: var(--accent); font-weight: 500; }
.s-nav-icon { font-size: 14px; width: 18px; text-align: center; flex-shrink: 0; opacity: .85; }

/* ── Overlay (mobile) ─────────────────────────────────────────────────────── */
#overlay {
  display: none; position: fixed; inset: 0; z-index: 199;
  background: rgba(0,0,0,.55); backdrop-filter: blur(2px);
}
#overlay.vis { display: block; }

/* ── Mobile top bar ───────────────────────────────────────────────────────── */
#topbar {
  display: none; position: fixed; top: 0; left: 0; right: 0; height: var(--topbar);
  background: var(--surf); border-bottom: 1px solid var(--border);
  align-items: center; padding: 0 16px; gap: 12px; z-index: 198;
}
#topbar-title { font-size: 14px; font-weight: 600; flex: 1; color: var(--text); }
#menu-btn {
  width: 34px; height: 34px; border-radius: 7px; border: 1px solid var(--border);
  background: var(--surf2); display: flex; align-items: center; justify-content: center;
  cursor: pointer; flex-shrink: 0; color: var(--text2); font-size: 16px;
}
#menu-btn:hover { background: var(--surf3); color: var(--text); }

/* ── Main content ─────────────────────────────────────────────────────────── */
#main { margin-left: var(--sw); min-height: 100vh; }
.page { display: none; }
.page.active { display: block; }

.page-header {
  padding: 28px 36px 20px;
  border-bottom: 1px solid var(--border);
  position: sticky; top: 0; background: var(--bg); z-index: 10;
}
.page-header h2 { font-size: 20px; font-weight: 600; letter-spacing: -.3px; color: var(--text); }
.page-meta { font-size: 11.5px; color: var(--text3); margin-top: 3px; }
.page-body { padding: 28px 36px; max-width: 820px; }

/* ── Markdown ─────────────────────────────────────────────────────────────── */
.md h1 {
  font-size: 20px; font-weight: 700; letter-spacing: -.4px;
  margin: 0 0 16px; padding-bottom: 12px;
  border-bottom: 1px solid var(--border); color: var(--text);
}
.md h2 {
  font-size: 16px; font-weight: 600; letter-spacing: -.2px;
  margin: 28px 0 10px; padding-bottom: 8px;
  border-bottom: 1px solid var(--border-s); color: var(--text);
}
.md h2:first-child { margin-top: 0; }
.md h3 {
  font-size: 14px; font-weight: 600;
  margin: 20px 0 8px; color: var(--text);
}
.md h4 {
  font-size: 11px; font-weight: 600; margin: 16px 0 6px;
  color: var(--text3); text-transform: uppercase; letter-spacing: .8px;
}
.md p  { font-size: 14px; color: var(--text2); line-height: 1.72; margin-bottom: 10px; }
.md ul, .md ol { font-size: 14px; color: var(--text2); padding-left: 22px; line-height: 1.8; margin-bottom: 12px; }
.md li { margin-bottom: 4px; }
.md li::marker { color: var(--text3); }
.md strong { color: var(--text); font-weight: 600; }
.md em     { color: var(--text2); font-style: italic; }

.md code {
  background: var(--surf2); border: 1px solid var(--border);
  padding: 1px 5px; border-radius: 4px;
  font-family: 'SF Mono', 'Fira Code', Consolas, monospace;
  font-size: 12.5px; color: var(--accent);
}
.md pre {
  background: var(--surf2); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 16px; margin-bottom: 16px; overflow-x: auto;
}
.md pre code {
  background: none; border: none; padding: 0;
  font-size: 13px; color: var(--text); letter-spacing: .2px; line-height: 1.6;
}

.md blockquote {
  border-left: 2px solid var(--accent); padding: 10px 16px; margin: 14px 0;
  background: var(--accent-d); border-radius: 0 var(--radius) var(--radius) 0;
}
.md blockquote p { margin: 0; font-size: 13.5px; color: var(--text2); }

.md table { width: 100%; border-collapse: collapse; font-size: 13.5px; margin-bottom: 18px; }
.md thead { background: var(--surf2); }
.md th {
  text-align: left; padding: 9px 12px; font-size: 11px; color: var(--text3);
  text-transform: uppercase; letter-spacing: .7px; font-weight: 600;
  border-bottom: 1px solid var(--border);
}
.md td {
  padding: 9px 12px; border-bottom: 1px solid var(--border-s);
  color: var(--text2); vertical-align: top; line-height: 1.5;
}
.md tr:last-child td { border-bottom: none; }
.md tr:hover td { background: var(--surf2); }
.md table { border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; }

.md hr { border: none; border-top: 1px solid var(--border); margin: 24px 0; }

.md input[type="checkbox"] {
  accent-color: var(--accent); width: 14px; height: 14px;
  margin-right: 7px; cursor: pointer; vertical-align: middle; flex-shrink: 0;
}
.md .task-list-item {
  list-style: none; margin-left: -22px; padding-left: 4px;
  display: flex; align-items: flex-start; gap: 4px;
}
.md .task-list-item input { margin-top: 3px; }
.md-err { color: var(--red); font-size: 13px; }

/* ── Responsive ───────────────────────────────────────────────────────────── */
@media (max-width: 768px) {
  #sidebar {
    width: 280px;
    transform: translateX(-100%);
    transition: transform .25s cubic-bezier(.4,0,.2,1);
    box-shadow: none;
  }
  #sidebar.open {
    transform: translateX(0);
    box-shadow: 8px 0 40px rgba(0,0,0,.4);
  }
  #topbar   { display: flex; }
  #main     { margin-left: 0; padding-top: var(--topbar); }
  .page-header { top: var(--topbar); padding: 18px 18px 14px; }
  .page-body   { padding: 18px 18px 32px; }
}
</style>
</head>
<body>

<div id="overlay" onclick="closeSidebar()"></div>

<div id="topbar">
  <div id="menu-btn" onclick="toggleSidebar()" aria-label="Open menu">☰</div>
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
  </div>

  <div class="s-score">
    <div class="s-score-nums">
      <span class="s-cur">${curScore ?? '—'}</span>
      <span class="s-sep">/</span>
      <span class="s-tgt">${tgtScore}</span>
    </div>
    <div class="s-lbl">+${curScore ? tgtScore - curScore : '?'} points to target</div>
    <div class="s-bar"><div class="s-bar-fill" style="width:${fillPct}%"></div></div>
  </div>

  <div class="s-nav">${navHTML}
  </div>
</div>

<div id="main">
${pagesHTML}
</div>

<script>
  const DEFAULT = '${defaultPage}';
  let currentId = null;

  function show(id) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.s-nav-item').forEach(n => n.classList.remove('active'));
    const page = document.getElementById('page-' + id);
    const nav  = document.getElementById('nav-'  + id);
    if (page) { page.classList.add('active'); window.scrollTo(0, 0); }
    if (nav)  { nav.classList.add('active'); nav.scrollIntoView({ block: 'nearest' }); }
    history.replaceState(null, '', '#' + id);
    document.getElementById('topbar-title').textContent =
      nav ? nav.querySelector('.s-nav-icon').nextSibling.textContent.trim() : 'LSAT Prep';
    currentId = id;
    closeSidebar();
  }

  function openSidebar() {
    document.getElementById('sidebar').classList.add('open');
    document.getElementById('overlay').classList.add('vis');
    document.body.style.overflow = 'hidden';
  }
  function closeSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('overlay').classList.remove('vis');
    document.body.style.overflow = '';
  }
  function toggleSidebar() {
    document.getElementById('sidebar').classList.contains('open') ? closeSidebar() : openSidebar();
  }

  // Swipe to open / close sidebar on touch devices
  let tx = 0;
  document.addEventListener('touchstart', e => { tx = e.touches[0].clientX; }, { passive: true });
  document.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - tx;
    if (dx >  60 && tx < 24) openSidebar();   // swipe right from left edge
    if (dx < -60)             closeSidebar();   // swipe left anywhere
  }, { passive: true });

  // Persist checkbox state
  function saveBoxes() {
    const s = {};
    document.querySelectorAll('.md input[type="checkbox"]').forEach((cb, i) => { s[i] = cb.checked; });
    try { localStorage.setItem('lsat-checks', JSON.stringify(s)); } catch(_) {}
  }
  function loadBoxes() {
    try {
      const s = JSON.parse(localStorage.getItem('lsat-checks') || '{}');
      document.querySelectorAll('.md input[type="checkbox"]').forEach((cb, i) => {
        if (s[i] !== undefined) cb.checked = s[i];
        cb.removeAttribute('disabled');
        cb.addEventListener('change', saveBoxes);
      });
    } catch(_) {}
  }

  // Keyboard shortcut: [ and ] to prev/next page
  const ids = ${JSON.stringify(pages.map(p => p.id))};
  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT') return;
    const i = ids.indexOf(currentId);
    if (e.key === ']' && i < ids.length - 1) show(ids[i + 1]);
    if (e.key === '[' && i > 0)              show(ids[i - 1]);
  });

  // Init
  const hash = location.hash.slice(1);
  show(ids.includes(hash) ? hash : DEFAULT);
  loadBoxes();
</script>
</body>
</html>`;

// ─── Write output ─────────────────────────────────────────────────────────────

mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'index.html'), HTML, 'utf8');
console.log(`✅  Built ${join(OUT, 'index.html')} at ${buildStr}`);
