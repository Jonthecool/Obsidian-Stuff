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

const pages = [];
let hubFM   = {};

for (const cfg of PAGE_CONFIG) {
  const filePath = join(VAULT, cfg.file);
  try {
    const raw       = readFileSync(filePath, 'utf8');
    const { fm, body } = parseFM(raw);
    if (cfg.id === 'hub') hubFM = fm;
    const html = marked.parse(cleanObsidian(body));
    pages.push({ ...cfg, html, ok: true });
  } catch {
    pages.push({ ...cfg, html: `<p class="md-err">⚠ Could not load <code>${cfg.file}</code></p>`, ok: false });
  }
}

// Also pick up any extra .md files not in PAGE_CONFIG and put them in Other
const knownFiles = new Set(PAGE_CONFIG.map(p => p.file));
try {
  for (const f of readdirSync(VAULT)) {
    if (!f.endsWith('.md') || knownFiles.has(f)) continue;
    const raw  = readFileSync(join(VAULT, f), 'utf8');
    const { body } = parseFM(raw);
    const id   = f.replace(/\.md$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const label = f.replace(/\.md$/, '');
    pages.push({ file: f, id, label, icon: '📄', section: 'Other', html: marked.parse(cleanObsidian(body)), ok: true });
  }
} catch { /* VAULT dir missing — handled by page-level errors above */ }

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
    <div class="nav-section">${sec}</div>
    ${ps.map(p => `
    <div class="nav-item" id="nav-${p.id}" onclick="show('${p.id}')">
      <span class="nav-icon">${p.icon}</span>${p.label}
    </div>`).join('')}`).join('');

const pagesHTML = pages.map(p => `
  <div class="page" id="page-${p.id}">
    <div class="page-header">
      <div>
        <h2>${p.icon} ${p.label}</h2>
        <p class="page-subtitle">Last rebuilt from notes on ${buildStr}</p>
      </div>
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
<style>
:root {
  --bg:      #0f1117;
  --surf:    #1a1d27;
  --surf2:   #222636;
  --border:  #2d3148;
  --accent:  #6c8cff;
  --accent2: #a78bfa;
  --green:   #34d399;
  --yellow:  #fbbf24;
  --red:     #f87171;
  --text:    #e2e8f0;
  --text2:   #94a3b8;
  --text3:   #64748b;
  --sw: 248px;
}
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;background:var(--bg);color:var(--text);font-family:'Segoe UI',system-ui,sans-serif}
a{color:var(--accent);text-decoration:none}
a:hover{text-decoration:underline}

/* ── Sidebar ── */
#sidebar{
  position:fixed;top:0;left:0;width:var(--sw);height:100vh;
  background:var(--surf);border-right:1px solid var(--border);
  display:flex;flex-direction:column;overflow-y:auto;z-index:100;
}
.brand{padding:18px 16px 14px;border-bottom:1px solid var(--border)}
.brand h1{font-size:15px;font-weight:800;color:var(--accent);letter-spacing:.4px}
.brand p{font-size:11px;color:var(--text3);margin-top:2px}

.score-widget{margin:12px 14px;background:var(--surf2);border:1px solid var(--border);border-radius:9px;padding:12px}
.sw-row{display:flex;justify-content:space-between;align-items:center;margin-bottom:5px}
.sw-label{font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.5px}
.sw-val{font-size:14px;font-weight:800}
.sw-cur{color:var(--yellow)}
.sw-tgt{color:var(--green)}
.sw-date{font-size:10px;color:var(--text3);margin-bottom:7px}
.pb{height:5px;background:var(--border);border-radius:3px;overflow:hidden;margin-top:2px}
.pb-fill{height:100%;background:linear-gradient(90deg,var(--accent),var(--accent2));border-radius:3px;transition:width .4s}

nav{padding:6px 0;flex:1}
.nav-section{padding:10px 16px 3px;font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;font-weight:600}
.nav-item{
  display:flex;align-items:center;gap:8px;
  padding:7px 16px;font-size:13px;color:var(--text2);
  cursor:pointer;border-left:3px solid transparent;transition:all .12s;
}
.nav-item:hover{color:var(--text);background:var(--surf2)}
.nav-item.active{color:var(--accent);border-left-color:var(--accent);background:rgba(108,140,255,.09)}
.nav-icon{font-size:13px;width:18px;text-align:center}

/* ── Main ── */
#main{margin-left:var(--sw);min-height:100vh}
.page{display:none}
.page.active{display:block}

.page-header{
  padding:22px 32px 16px;
  border-bottom:1px solid var(--border);
  position:sticky;top:0;background:var(--bg);z-index:10;
}
.page-header h2{font-size:21px;font-weight:800}
.page-subtitle{font-size:11px;color:var(--text3);margin-top:3px}

.page-body{padding:28px 32px;max-width:860px}

/* ── Markdown styles ── */
.md h1{font-size:22px;font-weight:800;margin:0 0 14px;padding-bottom:10px;border-bottom:1px solid var(--border);color:var(--text)}
.md h2{font-size:18px;font-weight:700;margin:24px 0 10px;padding-bottom:6px;border-bottom:1px solid var(--border);color:var(--text)}
.md h2:first-child{margin-top:0}
.md h3{font-size:15px;font-weight:700;margin:20px 0 8px;color:var(--accent)}
.md h4{font-size:12px;font-weight:700;margin:14px 0 6px;color:var(--accent2);text-transform:uppercase;letter-spacing:.5px}
.md p{font-size:14px;color:var(--text2);line-height:1.75;margin-bottom:10px}
.md ul,.md ol{font-size:14px;color:var(--text2);padding-left:22px;line-height:1.85;margin-bottom:12px}
.md li{margin-bottom:3px}
.md li::marker{color:var(--accent)}
.md strong{color:var(--text)}
.md em{color:var(--text2)}
.md code{
  background:var(--surf2);border:1px solid var(--border);
  padding:1px 6px;border-radius:4px;font-family:monospace;font-size:12px;color:var(--accent);
}
.md pre{background:var(--surf2);border:1px solid var(--border);border-radius:8px;padding:14px;margin-bottom:14px;overflow-x:auto}
.md pre code{background:none;border:none;padding:0;font-size:13px;color:var(--text);letter-spacing:.3px}
.md blockquote{
  border-left:3px solid var(--accent);padding:10px 14px;margin:12px 0;
  background:rgba(108,140,255,.06);border-radius:0 6px 6px 0;
}
.md blockquote p{margin:0;font-size:13px;color:var(--text2)}
.md table{width:100%;border-collapse:collapse;font-size:13px;margin-bottom:16px}
.md th{
  text-align:left;padding:8px 10px;font-size:11px;color:var(--text3);
  text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid var(--border);
  font-weight:600;background:var(--surf2);
}
.md td{padding:8px 10px;border-bottom:1px solid rgba(45,49,72,.5);color:var(--text2);vertical-align:top}
.md tr:last-child td{border-bottom:none}
.md tr:hover td{background:rgba(255,255,255,.02)}
.md hr{border:none;border-top:1px solid var(--border);margin:22px 0}
.md input[type="checkbox"]{
  accent-color:var(--accent);width:14px;height:14px;
  margin-right:6px;cursor:pointer;vertical-align:middle;
}
.md .task-list-item{list-style:none;margin-left:-22px;padding-left:4px;display:flex;align-items:baseline;gap:6px}
.md .task-list-item input{flex-shrink:0;margin-top:3px}
.md-err{color:var(--red);font-size:13px}

@media(max-width:760px){
  :root{--sw:0px}
  #sidebar{transform:translateX(-100%);transition:transform .2s}
  #sidebar.open{transform:translateX(0)}
  #main{margin-left:0}
  .page-body{padding:16px}
  .page-header{padding:14px 16px 12px}
  #menu-btn{display:flex}
}
#menu-btn{
  display:none;position:fixed;top:14px;right:14px;z-index:200;
  width:38px;height:38px;background:var(--surf);border:1px solid var(--border);
  border-radius:8px;align-items:center;justify-content:center;
  cursor:pointer;font-size:18px;
}
</style>
</head>
<body>

<div id="sidebar">
  <div class="brand">
    <h1>LSAT Prep</h1>
    <p>Jon · Target: ${testDate}</p>
  </div>

  <div class="score-widget">
    <div class="sw-row">
      <span class="sw-label">Current</span>
      <span class="sw-val sw-cur">${curScore ?? '—'}</span>
    </div>
    <div class="sw-row">
      <span class="sw-label">Target</span>
      <span class="sw-val sw-tgt">${tgtScore}</span>
    </div>
    <div class="sw-date">+${curScore ? tgtScore - curScore : '?'} points to go</div>
    <div class="pb"><div class="pb-fill" style="width:${fillPct}%"></div></div>
  </div>

  <nav>${navHTML}
  </nav>
</div>

<div id="menu-btn" onclick="document.getElementById('sidebar').classList.toggle('open')">☰</div>

<div id="main">
${pagesHTML}
</div>

<script>
  const DEFAULT = '${defaultPage}';

  function show(id) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const page = document.getElementById('page-' + id);
    const nav  = document.getElementById('nav-'  + id);
    if (page) { page.classList.add('active'); window.scrollTo(0, 0); }
    if (nav)    nav.classList.add('active');
    history.replaceState(null, '', '#' + id);
    // Close mobile sidebar
    document.getElementById('sidebar').classList.remove('open');
  }

  // Persist checkbox state in localStorage
  function saveBoxes() {
    const state = {};
    document.querySelectorAll('.md input[type="checkbox"]').forEach((cb, i) => {
      state[i] = cb.checked;
    });
    try { localStorage.setItem('lsat-checks', JSON.stringify(state)); } catch(_) {}
  }

  function loadBoxes() {
    try {
      const state = JSON.parse(localStorage.getItem('lsat-checks') || '{}');
      document.querySelectorAll('.md input[type="checkbox"]').forEach((cb, i) => {
        if (state[i] !== undefined) cb.checked = state[i];
        cb.removeAttribute('disabled');
        cb.addEventListener('change', saveBoxes);
      });
    } catch(_) {}
  }

  // Init
  const hash = location.hash.slice(1);
  show(hash || DEFAULT);
  loadBoxes();
</script>
</body>
</html>`;

// ─── Write output ─────────────────────────────────────────────────────────────

mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'index.html'), HTML, 'utf8');
console.log(`✅  Built ${join(OUT, 'index.html')} at ${buildStr}`);
