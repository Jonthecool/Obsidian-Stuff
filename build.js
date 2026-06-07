/**
 * build.js — reads "LSAT Prep/*.md" and generates docs/index.html
 * Run locally:  node build.js
 * Run in CI:    triggered automatically by GitHub Actions on every push
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'fs';
import { join } from 'path';
import { marked } from 'marked';

// ─── Config ──────────────────────────────────────────────────────────────────

const VAULT = 'LSAT Prep';
const OUT   = 'docs';

const SECTION_ORDER = ['Overview', 'Logical Reasoning', 'Reading Comprehension', 'Progress', 'Other'];

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

function labelFromFile(f) { return f.replace(/\.md$/i, ''); }
function slugify(s)       { return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''); }

function categorize(filename) {
  const name = filename.replace(/\.md$/i, '');
  for (const rule of CATEGORY_RULES) {
    if (rule.pattern.test(name)) return { section: rule.section, icon: rule.icon };
  }
  return { section: 'Other', icon: '📄' };
}

function discoverPages() {
  let files;
  try {
    files = readdirSync(VAULT).filter(f => f.endsWith('.md'));
  } catch {
    console.error(`ERROR: Could not read folder "${VAULT}". Run build.js from the repo root.`);
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

// Resolve [[wiki links]] to in-app navigation; wikiMap: lower-case-name → page-id
function cleanObsidian(md, wikiMap = {}) {
  return md
    .replace(/!\[\[[^\]]+\]\]/g, '')   // strip embeds first
    .replace(/\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]/g, (_, t, a) => {
      const display = a || t;
      const id = wikiMap[t.trim().toLowerCase()];
      return id
        ? `<a href="#${id}" onclick="event.preventDefault();show('${id}')">${display}</a>`
        : display;
    })
    .replace(/^>?\s*.*Back to.*\n/gm, '')
    .trim();
}

marked.use({ gfm: true, breaks: false });

// ─── Flashcard extraction helper (defined once, not inside the loop) ──────────

function extractFlashcards(html) {
  const flashcards = [];
  const fcSeen = new Set();

  function addCard(front, back) {
    const f = front.trim();
    const b = back.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    const key = f.toLowerCase();
    if (f.length >= 2 && b.length >= 4 && !fcSeen.has(key)) {
      fcSeen.add(key);
      flashcards.push({ front: f, back: b });
    }
  }

  // Pattern A: list item with **bold**: rest  or  **bold** — rest
  const reA = /<li[^>]*>(?:<p>)?(?:<[^>]+>)*<strong>([^<]{2,80})<\/strong>(?:<\/[^>]+>)*\s*[:—–\-]+\s*([\s\S]{4,300}?)(?=<\/(?:li|p)>)/g;
  let m;
  while ((m = reA.exec(html)) !== null) addCard(m[1], m[2]);

  // Pattern B: paragraph starting with **bold**: rest
  const reB = /<p>(?:<[^>]+>)*<strong>([^<]{2,80})<\/strong>(?:<\/[^>]+>)*\s*[:—–\-]+\s*([^<]{4,300})/g;
  while ((m = reB.exec(html)) !== null) addCard(m[1], m[2]);

  // Pattern C: h3/h4 question → next paragraph answer
  const reC = /<h[34][^>]*>([^<]{5,120})<\/h[34]>\s*(?:<[^/][^>]*>)*<p>([^<]{10,400})<\/p>/g;
  while ((m = reC.exec(html)) !== null) addCard(m[1].replace(/<[^>]+>/g, ''), m[2]);

  return flashcards;
}

// ─── Load pages ───────────────────────────────────────────────────────────────

const PAGE_CONFIG = discoverPages();

// Build wiki-link resolution map before the loading loop
const wikiMap = {};
for (const cfg of PAGE_CONFIG) {
  wikiMap[cfg.label.toLowerCase()] = cfg.id;
  wikiMap[cfg.file.replace(/\.md$/i, '').toLowerCase()] = cfg.id;
}

const pages = [];
let hubFM   = {};

for (const cfg of PAGE_CONFIG) {
  const filePath = join(VAULT, cfg.file);
  try {
    const raw          = readFileSync(filePath, 'utf8');
    const { fm, body } = parseFM(raw);
    if (/LSAT Prep Hub/i.test(cfg.file)) hubFM = fm;

    const html        = marked.parse(cleanObsidian(body, wikiMap));
    const text        = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 3000);
    const difficulty  = (fm.difficulty || '').toLowerCase();
    const flashcards  = extractFlashcards(html);

    pages.push({ ...cfg, html, text, difficulty, flashcards, ok: true });
  } catch {
    pages.push({ ...cfg, html: `<p class="md-err">⚠ Could not load <code>${cfg.file}</code></p>`, text: '', difficulty: '', flashcards: [], ok: false });
  }
}

// Sort: hub first in Overview, then alphabetical within each section
pages.sort((a, b) => {
  const si = SECTION_ORDER.indexOf(a.section) - SECTION_ORDER.indexOf(b.section);
  if (si !== 0) return si;
  if (/LSAT Prep Hub/i.test(a.file)) return -1;
  if (/LSAT Prep Hub/i.test(b.file)) return  1;
  return a.label.localeCompare(b.label);
});

// ─── Score / meta from hub frontmatter ───────────────────────────────────────

const curScore = parseFloat(hubFM.current_score) || null;
const tgtScore = parseFloat(hubFM.target_score)  || 170;
const testDate = hubFM.test_date                 || 'November 2026';

// practice_scores: comma-separated list in frontmatter, e.g. "155, 157, 160"
const practiceScores = hubFM.practice_scores
  ? String(hubFM.practice_scores).split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n))
  : (curScore ? [curScore] : []);

function scorePct(s) { return Math.min(100, Math.max(0, Math.round(((s - 120) / 60) * 100))); }
const curPct  = curScore ? scorePct(curScore) : 0;
const tgtPct  = scorePct(tgtScore);
// FIX: clamp fillPct to 100 so the bar never overflows (e.g. when curScore > tgtScore)
const fillPct = curScore ? Math.min(100, Math.round((curPct / tgtPct) * 100)) : 0;

// Days until test — null if unparseable; negative if date has passed
function daysUntil(ds) {
  if (!ds) return null;
  const d = new Date(ds);
  return isNaN(d) ? null : Math.ceil((d - Date.now()) / 86400000);
}
const daysLeft = daysUntil(hubFM.test_date);

// Human-readable countdown label: handles future, today, and past
function countdownDisplay(days) {
  if (days === null) return null;
  if (days > 0)  return { num: days,  lbl: 'days until test' };
  if (days === 0) return { num: '🎯', lbl: 'Test day!' };
  return { num: Math.abs(days), lbl: 'days since test' };
}
const countdown = countdownDisplay(daysLeft);

// ─── Score chart SVG (generated at build time) ────────────────────────────────

function makeScoreChart(scores) {
  if (scores.length < 2) return '';
  const W = 224, H = 64, P = 10;
  const allVals = [...scores, tgtScore];
  const lo = Math.min(...allVals) - 2;
  const hi = Math.max(...allVals) + 2;
  const range = hi - lo || 10;
  const px = (i) => (P + (i / (scores.length - 1)) * (W - P * 2)).toFixed(1);
  const py = (s) => (H - P - ((s - lo) / range) * (H - P * 2)).toFixed(1);
  const pts = scores.map((s, i) => `${px(i)},${py(s)}`).join(' ');
  const tyc = py(tgtScore);
  const dots = scores.map((s, i) => `<circle cx="${px(i)}" cy="${py(s)}" r="2.5" fill="var(--accent)"/>`).join('');
  const labels = scores.length <= 6
    ? scores.map((s, i) => `<text x="${px(i)}" y="${(parseFloat(py(s)) - 5).toFixed(1)}" text-anchor="middle" font-size="8" fill="var(--text2)">${s}</text>`).join('')
    : '';
  return `<svg class="score-chart" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <line x1="${P}" y1="${tyc}" x2="${W-P}" y2="${tyc}" stroke="var(--green)" stroke-width="1" stroke-dasharray="4,3" opacity=".5"/>
  <polyline points="${pts}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
  ${dots}${labels}
  <text x="${W-P}" y="${parseFloat(tyc)-3}" text-anchor="end" font-size="8" fill="var(--green)" opacity=".8">target ${tgtScore}</text>
</svg>`;
}

const chartHTML = makeScoreChart(practiceScores);

// ─── Build HTML pieces ────────────────────────────────────────────────────────

const sections = {};
for (const p of pages) (sections[p.section] = sections[p.section] || []).push(p);

const defaultPage = pages[0]?.id || 'hub';
const buildStr    = new Date().toLocaleString('en-US', {
  month: 'short', day: 'numeric', year: 'numeric',
  hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
});

const DIFF_BADGE = { easy: '🟢', medium: '🟡', hard: '🔴' };

const navHTML = Object.entries(sections).map(([sec, ps]) => `
    <div class="s-nav-group">
      <div class="s-nav-label">${sec}</div>
      ${ps.map(p => {
        const badge = DIFF_BADGE[p.difficulty] ? `<span class="diff-dot" title="${p.difficulty}">${DIFF_BADGE[p.difficulty]}</span>` : '';
        return `<div class="s-nav-item" id="nav-${p.id}" onclick="show('${p.id}')"><span class="s-nav-icon">${p.icon}</span><span class="s-nav-label-text">${p.label}</span>${badge}</div>`;
      }).join('\n      ')}
    </div>`).join('');

const pagesHTML = pages.map(p => {
  const hasFC    = p.flashcards.length > 0;
  const fcBtn    = hasFC ? `<button class="hdr-btn" onclick="openFlash('${p.id}')" title="Flashcards (${p.flashcards.length})">🃏 ${p.flashcards.length}</button>` : '';
  const diffLabel = p.difficulty ? `<span class="diff-pill diff-${p.difficulty}">${p.difficulty}</span>` : '';
  return `
  <div class="page" id="page-${p.id}">
    <div class="page-header">
      <div class="ph-left">
        <h2>${p.icon} ${p.label} ${diffLabel}</h2>
        <p class="page-meta">Updated ${buildStr}</p>
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

// Embed search index and flashcard data in JS
const searchIndex = JSON.stringify(pages.map(p => ({ id: p.id, label: p.label, icon: p.icon, section: p.section, text: p.text })));
const flashData   = JSON.stringify(Object.fromEntries(pages.filter(p => p.flashcards.length).map(p => [p.id, p.flashcards])));

// ─── Full HTML output ─────────────────────────────────────────────────────────

const HTML = `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>LSAT Prep — Jon</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
/* ── Tokens ── */
:root {
  --bg:       #0f0f10; --surf:    #161618; --surf2:   #1c1c1f;
  --surf3:    #232327; --border:  #2a2a2e; --border-s:#232327;
  --accent:   #4f7eff; --accent-d:rgba(79,126,255,.1);
  --green:    #30d158; --green-d: rgba(48,209,88,.1);
  --yellow:   #f5a623; --yellow-d:rgba(245,166,35,.1);
  --red:      #ff453a;
  --text:     #f2f2f7; --text2:   #8e8e93; --text3:   #48484a;
  --sw:258px; --topbar:52px; --radius:8px;
  --font:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
}
[data-theme="light"] {
  --bg:#f5f5f7; --surf:#ffffff; --surf2:#f0f0f2; --surf3:#e8e8eb;
  --border:#d8d8dc; --border-s:#e8e8eb;
  --text:#1c1c1e; --text2:#3a3a3c; --text3:#8e8e93;
  --accent-d:rgba(79,126,255,.08);
}

/* ── Reset ── */
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{font-size:15px;-webkit-font-smoothing:antialiased}
body{background:var(--bg);color:var(--text);font-family:var(--font);line-height:1.5}
a{color:var(--accent);text-decoration:none}
a:hover{text-decoration:underline}

/* ── Reading progress bar ── */
#progress-bar{
  position:fixed;top:0;left:0;height:2px;width:0%;
  background:var(--accent);z-index:9999;transition:width .1s linear;
}

/* ── Sidebar ── */
#sidebar{
  position:fixed;top:0;left:0;width:var(--sw);height:100vh;
  background:var(--surf);border-right:1px solid var(--border);
  display:flex;flex-direction:column;overflow-y:auto;z-index:200;
  scrollbar-width:thin;scrollbar-color:var(--border) transparent;
}
.s-brand{padding:16px 14px 14px;border-bottom:1px solid var(--border-s);flex-shrink:0}
.s-brand-row{display:flex;align-items:center;gap:9px}
.s-logo{
  width:28px;height:28px;border-radius:7px;background:var(--accent);
  display:flex;align-items:center;justify-content:center;
  font-size:13px;font-weight:700;color:#fff;flex-shrink:0;
}
.s-brand-text h1{font-size:14px;font-weight:600;letter-spacing:-.2px}
.s-brand-text p{font-size:11px;color:var(--text3);margin-top:1px}
.s-brand-actions{display:flex;gap:6px;margin-top:10px}
.icon-btn{
  display:flex;align-items:center;justify-content:center;
  width:30px;height:30px;border-radius:7px;border:1px solid var(--border);
  background:var(--surf2);cursor:pointer;font-size:14px;color:var(--text2);
  transition:background .1s,color .1s;user-select:none;
}
.icon-btn:hover{background:var(--surf3);color:var(--text)}

/* Score card */
.s-score{
  margin:10px 10px 4px;background:var(--surf2);border:1px solid var(--border);
  border-radius:var(--radius);padding:12px 14px;flex-shrink:0;
}
.s-score-nums{display:flex;align-items:baseline;gap:6px;margin-bottom:6px}
.s-cur{font-size:26px;font-weight:700;letter-spacing:-1px;color:var(--yellow)}
.s-sep{font-size:14px;color:var(--text3)}
.s-tgt{font-size:16px;font-weight:600;color:var(--text2)}
.s-lbl{font-size:11px;color:var(--text3);margin-bottom:6px}
.s-bar{height:3px;background:var(--border);border-radius:99px;overflow:hidden;margin-bottom:8px}
.s-bar-fill{height:100%;background:var(--accent);border-radius:99px}
.score-chart{display:block;width:100%;height:auto;margin-top:4px}

/* Countdown */
.s-countdown{
  margin:0 10px 4px;padding:9px 14px;
  background:var(--surf2);border:1px solid var(--border);border-radius:var(--radius);
  display:flex;align-items:center;justify-content:space-between;flex-shrink:0;
}
.s-countdown-num{font-size:20px;font-weight:700;color:var(--accent);letter-spacing:-1px}
.s-countdown-lbl{font-size:11px;color:var(--text3)}
.s-countdown.past .s-countdown-num{color:var(--text2)}

/* Nav */
.s-nav{padding:6px 0 80px;flex:1}
.s-nav-group{margin-top:2px}
.s-nav-label{
  padding:10px 16px 3px;font-size:10.5px;font-weight:600;
  color:var(--text3);text-transform:uppercase;letter-spacing:.8px;
}
.s-nav-item{
  display:flex;align-items:center;gap:9px;
  padding:5px 14px;margin:1px 8px;border-radius:6px;
  font-size:13px;color:var(--text2);
  cursor:pointer;transition:background .1s,color .1s;user-select:none;
}
.s-nav-item:hover{background:var(--surf2);color:var(--text)}
.s-nav-item.active{background:var(--accent-d);color:var(--accent);font-weight:500}
.s-nav-icon{font-size:13px;width:18px;text-align:center;flex-shrink:0;opacity:.85}
.s-nav-label-text{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.diff-dot{font-size:9px;flex-shrink:0;opacity:.8}

/* ── Overlay ── */
#overlay{display:none;position:fixed;inset:0;z-index:199;background:rgba(0,0,0,.55);backdrop-filter:blur(2px)}
#overlay.vis{display:block}

/* ── Mobile topbar ── */
#topbar{
  display:none;position:fixed;top:0;left:0;right:0;height:var(--topbar);
  background:var(--surf);border-bottom:1px solid var(--border);
  align-items:center;padding:0 14px;gap:10px;z-index:198;
}
#topbar-title{font-size:14px;font-weight:600;flex:1;color:var(--text)}
#menu-btn{
  width:34px;height:34px;border-radius:7px;border:1px solid var(--border);
  background:var(--surf2);display:flex;align-items:center;justify-content:center;
  cursor:pointer;flex-shrink:0;color:var(--text2);font-size:16px;
}
#menu-btn:hover{background:var(--surf3);color:var(--text)}

/* ── Main ── */
#main{margin-left:var(--sw);min-height:100vh}
.page{display:none}
.page.active{display:block}

.page-header{
  padding:24px 36px 16px;border-bottom:1px solid var(--border);
  position:sticky;top:0;background:var(--bg);z-index:10;
  display:flex;align-items:flex-start;justify-content:space-between;gap:12px;
}
.ph-left h2{font-size:20px;font-weight:600;letter-spacing:-.3px;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.page-meta{font-size:11px;color:var(--text3);margin-top:3px}
.ph-right{display:flex;gap:6px;flex-shrink:0;align-items:flex-start;padding-top:2px}
.hdr-btn{
  display:flex;align-items:center;gap:4px;padding:5px 9px;
  border-radius:6px;border:1px solid var(--border);background:var(--surf2);
  font-size:12px;color:var(--text2);cursor:pointer;font-family:var(--font);
  transition:background .1s,color .1s;white-space:nowrap;
}
.hdr-btn:hover{background:var(--surf3);color:var(--text)}

/* Difficulty pill */
.diff-pill{
  font-size:10px;font-weight:600;letter-spacing:.4px;text-transform:uppercase;
  padding:2px 7px;border-radius:99px;
}
.diff-easy  {background:var(--green-d);color:var(--green)}
.diff-medium{background:var(--yellow-d);color:var(--yellow)}
.diff-hard  {background:rgba(255,69,58,.1);color:var(--red)}

.page-body{padding:28px 36px;max-width:820px}

/* ── Markdown ── */
.md h1{font-size:20px;font-weight:700;letter-spacing:-.4px;margin:0 0 16px;padding-bottom:12px;border-bottom:1px solid var(--border);color:var(--text)}
.md h2{font-size:16px;font-weight:600;letter-spacing:-.2px;margin:28px 0 10px;padding-bottom:8px;border-bottom:1px solid var(--border-s);color:var(--text)}
.md h2:first-child{margin-top:0}
.md h3{font-size:14px;font-weight:600;margin:20px 0 8px;color:var(--text)}
.md h4{font-size:11px;font-weight:600;margin:16px 0 6px;color:var(--text3);text-transform:uppercase;letter-spacing:.8px}
.md p{font-size:14px;color:var(--text2);line-height:1.72;margin-bottom:10px}
.md ul,.md ol{font-size:14px;color:var(--text2);padding-left:22px;line-height:1.8;margin-bottom:12px}
.md li{margin-bottom:4px}
.md li::marker{color:var(--text3)}
.md strong{color:var(--text);font-weight:600}
.md em{color:var(--text2);font-style:italic}
.md code{background:var(--surf2);border:1px solid var(--border);padding:1px 5px;border-radius:4px;font-family:'SF Mono','Fira Code',Consolas,monospace;font-size:12.5px;color:var(--accent)}
.md pre{background:var(--surf2);border:1px solid var(--border);border-radius:var(--radius);padding:16px;margin-bottom:16px;overflow-x:auto}
.md pre code{background:none;border:none;padding:0;font-size:13px;color:var(--text);line-height:1.6}
.md blockquote{border-left:2px solid var(--accent);padding:10px 16px;margin:14px 0;background:var(--accent-d);border-radius:0 var(--radius) var(--radius) 0}
.md blockquote p{margin:0;font-size:13.5px;color:var(--text2)}
.md table{width:100%;border-collapse:collapse;font-size:13.5px;margin-bottom:18px;border:1px solid var(--border);border-radius:var(--radius);overflow:hidden}
.md thead{background:var(--surf2)}
.md th{text-align:left;padding:9px 12px;font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:.7px;font-weight:600;border-bottom:1px solid var(--border)}
.md td{padding:9px 12px;border-bottom:1px solid var(--border-s);color:var(--text2);vertical-align:top;line-height:1.5}
.md tr:last-child td{border-bottom:none}
.md tr:hover td{background:var(--surf2)}
.md hr{border:none;border-top:1px solid var(--border);margin:24px 0}
.md input[type="checkbox"]{accent-color:var(--accent);width:14px;height:14px;margin-right:7px;cursor:pointer;vertical-align:middle;flex-shrink:0}
.md .task-list-item{list-style:none;margin-left:-22px;padding-left:4px;display:flex;align-items:flex-start;gap:4px}
.md .task-list-item input{margin-top:3px}
.md-err{color:var(--red);font-size:13px}

/* ── Search modal ── */
#search-modal{
  display:none;position:fixed;inset:0;z-index:500;
  background:rgba(0,0,0,.6);backdrop-filter:blur(4px);
  align-items:flex-start;justify-content:center;padding-top:80px;
}
#search-modal.open{display:flex}
#search-box{
  width:100%;max-width:560px;background:var(--surf);border:1px solid var(--border);
  border-radius:12px;overflow:hidden;box-shadow:0 24px 80px rgba(0,0,0,.5);
}
#search-input{
  width:100%;padding:14px 18px;font-size:15px;font-family:var(--font);
  background:transparent;border:none;color:var(--text);outline:none;border-bottom:1px solid var(--border);
}
#search-input::placeholder{color:var(--text3)}
#search-results{max-height:380px;overflow-y:auto}
.sr-item{
  display:flex;align-items:center;gap:12px;padding:10px 18px;
  cursor:pointer;transition:background .1s;font-size:13.5px;
}
.sr-item:hover,.sr-item.focused{background:var(--surf2)}
.sr-icon{font-size:16px;width:22px;text-align:center;flex-shrink:0}
.sr-label{font-weight:500;color:var(--text)}
.sr-section{font-size:11px;color:var(--text3);margin-left:auto;flex-shrink:0}
.sr-excerpt{font-size:12px;color:var(--text3);margin-top:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sr-empty{padding:20px 18px;font-size:13px;color:var(--text3);text-align:center}
.sr-hint{padding:8px 18px;font-size:11px;color:var(--text3);border-top:1px solid var(--border-s);display:flex;gap:14px}
.sr-hint kbd{
  display:inline-block;padding:1px 5px;border:1px solid var(--border);
  border-radius:4px;font-size:10px;font-family:monospace;
}

/* ── Mastery widget ── */
.mastery-widget{
  display:flex;align-items:center;gap:4px;padding:4px 8px;
  border-radius:7px;border:1px solid var(--border);background:var(--surf2);
}
.mastery-lbl{font-size:10px;color:var(--text3);margin-right:2px;white-space:nowrap}
.m-btn{
  background:none;border:none;font-size:14px;cursor:pointer;
  padding:2px 3px;border-radius:4px;opacity:.35;transition:opacity .1s,transform .1s;
  line-height:1;
}
.m-btn:hover{opacity:.75;transform:scale(1.15)}
.m-btn.active{opacity:1;transform:scale(1.2)}

/* ── Flashcard modal ── */
#flash-modal{
  display:none;position:fixed;inset:0;z-index:500;
  background:rgba(0,0,0,.65);backdrop-filter:blur(4px);
  align-items:center;justify-content:center;
}
#flash-modal.open{display:flex}
#flash-box{
  width:100%;max-width:500px;margin:16px;background:var(--surf);
  border:1px solid var(--border);border-radius:16px;
  box-shadow:0 24px 80px rgba(0,0,0,.5);overflow:hidden;position:relative;
}
.flash-topbar{
  display:flex;align-items:center;justify-content:space-between;
  padding:12px 16px;border-bottom:1px solid var(--border-s);
}
.flash-title{font-size:12px;font-weight:600;color:var(--text2)}
.flash-meta{font-size:11px;color:var(--text3)}
#flash-close{
  background:none;border:none;font-size:18px;color:var(--text3);
  cursor:pointer;line-height:1;font-family:var(--font);padding:0;
}
.flash-track{height:2px;background:var(--border)}
.flash-track-fill{height:100%;background:var(--accent);transition:width .3s}
.flash-scene{
  perspective:1000px;padding:28px 28px 20px;cursor:pointer;min-height:180px;
  display:flex;align-items:center;justify-content:center;
}
.flash-flipper{
  position:relative;width:100%;transition:transform .45s cubic-bezier(.4,0,.2,1);
  transform-style:preserve-3d;
}
.flash-flipper.flipped{transform:rotateY(180deg)}
.flash-face{
  backface-visibility:hidden;-webkit-backface-visibility:hidden;
  display:flex;flex-direction:column;align-items:center;justify-content:center;
  min-height:130px;text-align:center;gap:8px;
}
.flash-face-back{
  position:absolute;inset:0;transform:rotateY(180deg);
  backface-visibility:hidden;-webkit-backface-visibility:hidden;
  display:flex;flex-direction:column;align-items:center;justify-content:center;
  min-height:130px;text-align:center;gap:8px;
}
.flash-side-label{font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--text3)}
.flash-face-back .flash-side-label{color:var(--accent)}
.flash-text{font-size:15px;color:var(--text);line-height:1.6;padding:0 4px}
.flash-hint{font-size:11px;color:var(--text3);text-align:center;padding:0 28px 8px}
.flash-controls{
  display:flex;gap:8px;padding:12px 16px 16px;
  border-top:1px solid var(--border-s);align-items:center;
}
.flash-btn{
  flex:1;padding:8px 12px;border-radius:8px;border:1px solid var(--border);
  background:var(--surf2);color:var(--text2);font-size:12.5px;
  font-family:var(--font);cursor:pointer;transition:background .1s;font-weight:500;
}
.flash-btn:hover{background:var(--surf3);color:var(--text)}
.flash-btn.know{background:var(--green-d);color:var(--green);border-color:transparent}
.flash-btn.idk {background:rgba(255,69,58,.1);color:var(--red);border-color:transparent}
.flash-session{
  display:flex;gap:12px;justify-content:center;padding:0 16px 10px;
  font-size:11px;color:var(--text3);
}
.flash-session span b{font-weight:600}
.flash-session .know-c b{color:var(--green)}
.flash-session .idk-c  b{color:var(--red)}

/* ── Responsive ── */
@media(max-width:768px){
  #sidebar{width:280px;transform:translateX(-100%);transition:transform .25s cubic-bezier(.4,0,.2,1)}
  #sidebar.open{transform:translateX(0);box-shadow:8px 0 40px rgba(0,0,0,.4)}
  #topbar{display:flex}
  #main{margin-left:0;padding-top:var(--topbar)}
  .page-header{top:var(--topbar);padding:16px 16px 12px;flex-wrap:wrap}
  .page-body{padding:16px 16px 32px}
  #search-modal{padding-top:24px;align-items:flex-start}
  /* FIX: mood banner full-width on mobile so it doesn't overlap content */
  #mood-banner{width:100%!important}
}

/* ── Print ── */
@media print{
  #sidebar,#topbar,#overlay,#progress-bar,.page-header .ph-right{display:none!important}
  #main{margin-left:0}
  .page-header{position:static;border:none;padding:0 0 16px}
  .page-body{padding:0;max-width:100%}
  body{background:#fff;color:#000;font-size:12pt}
  .md p,.md li{color:#333}
  .md h1,.md h2,.md h3{color:#000}
  .md blockquote{border-left:2pt solid #999;background:none}
  a[href]::after{content:" (" attr(href) ")";font-size:9pt;color:#888}
}
</style>
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
    ${chartHTML}
  </div>

  ${countdown !== null ? `
  <div class="s-countdown${daysLeft !== null && daysLeft <= 0 ? ' past' : ''}">
    <div>
      <div class="s-countdown-num">${countdown.num}</div>
      <div class="s-countdown-lbl">${countdown.lbl}</div>
    </div>
    <div style="font-size:24px">${daysLeft !== null && daysLeft <= 0 ? '🎓' : '⏳'}</div>
  </div>` : ''}

  <div class="s-nav">${navHTML}
  </div>
</div>

<!-- Search modal: backdrop click handled by addEventListener below, not inline onclick -->
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

<!-- Flashcard modal -->
<div id="flash-modal" onclick="if(event.target===this)closeFlash()">
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
    <div class="flash-hint" id="flash-hint">tap card or press <kbd style="font-size:10px;padding:1px 4px;border:1px solid var(--border);border-radius:3px;font-family:monospace">Space</kbd> to flip</div>
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

<!-- Confidence poll — fixed to sidebar bottom -->
<div id="mood-banner" style="display:none;position:fixed;bottom:0;left:0;width:var(--sw);padding:10px 12px;background:var(--surf);border-top:1px solid var(--border);z-index:201">
  <div style="font-size:11px;color:var(--text3);margin-bottom:6px;font-weight:500">How's your study confidence today?</div>
  <div style="display:flex;justify-content:space-between">
    ${['😰','😐','🙂','💪','🔥'].map((e,i)=>`<span class="mood-opt" data-v="${i+1}" onclick="setMood(${i+1})" title="${['Struggling','Unsure','Okay','Confident','On fire!'][i]}" style="font-size:22px;cursor:pointer;opacity:.4;transition:opacity .1s,transform .1s">${e}</span>`).join('')}
  </div>
  <div id="mood-history" style="margin-top:8px;display:flex;gap:3px;align-items:flex-end;height:24px"></div>
</div>

<div id="main">
${pagesHTML}
</div>

<script>
const DEFAULT = '${defaultPage}';
const IDS     = ${JSON.stringify(pages.map(p => p.id))};
const INDEX   = ${searchIndex};
const FCDATA  = ${flashData};
let currentId = null;

// ── Navigation ──
function show(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.s-nav-item').forEach(n => n.classList.remove('active'));
  const page = document.getElementById('page-' + id);
  const nav  = document.getElementById('nav-'  + id);
  if (page) { page.classList.add('active'); window.scrollTo(0,0); }
  if (nav)  { nav.classList.add('active'); nav.scrollIntoView({block:'nearest'}); }
  history.replaceState(null,'','#'+id);
  const txt = nav ? nav.querySelector('.s-nav-label-text').textContent.trim() : 'LSAT Prep';
  document.getElementById('topbar-title').textContent = txt;
  currentId = id;
  closeSidebar();
  try { localStorage.setItem('lsat-last',id); } catch(_){}
}

// ── Sidebar ──
function openSidebar()   { document.getElementById('sidebar').classList.add('open'); document.getElementById('overlay').classList.add('vis'); document.body.style.overflow='hidden'; }
function closeSidebar()  { document.getElementById('sidebar').classList.remove('open'); document.getElementById('overlay').classList.remove('vis'); document.body.style.overflow=''; }
function toggleSidebar() { document.getElementById('sidebar').classList.contains('open') ? closeSidebar() : openSidebar(); }

// ── Swipe ──
let _tx=0;
document.addEventListener('touchstart',e=>{ _tx=e.touches[0].clientX; },{passive:true});
document.addEventListener('touchend',e=>{
  const dx=e.changedTouches[0].clientX-_tx;
  const sb=document.getElementById('sidebar');
  if(dx> 60&&_tx<24&&!sb.classList.contains('open')) openSidebar();
  if(dx<-60&&sb.classList.contains('open'))           closeSidebar();
},{passive:true});

// ── Theme toggle ──
function toggleTheme() {
  const html=document.documentElement;
  const light=html.getAttribute('data-theme')==='light';
  html.setAttribute('data-theme', light?'dark':'light');
  document.getElementById('theme-btn').textContent=light?'🌙':'☀️';
  try{ localStorage.setItem('lsat-theme', light?'dark':'light'); }catch(_){}
}
// FIX: script runs at bottom of body — DOM is ready, no DOMContentLoaded needed
(function(){
  const t=localStorage.getItem('lsat-theme');
  if(!t) return;
  document.documentElement.setAttribute('data-theme',t);
  const b=document.getElementById('theme-btn');
  if(b) b.textContent=t==='light'?'☀️':'🌙';
})();

// ── Reading progress bar ──
window.addEventListener('scroll',()=>{
  const el=document.getElementById('progress-bar');
  if(!el) return;
  const h=document.documentElement;
  const pct=h.scrollTop/(h.scrollHeight-h.clientHeight)*100;
  el.style.width=Math.min(100,pct)+'%';
},{passive:true});

// ── Search ──
let _sfocus=0;
function openSearch(){
  document.getElementById('search-modal').classList.add('open');
  const inp=document.getElementById('search-input');
  inp.value=''; renderResults(''); inp.focus();
}
function closeSearch(){
  document.getElementById('search-modal').classList.remove('open');
}
function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function renderResults(q){
  const box=document.getElementById('search-results');
  const term=q.trim().toLowerCase();
  if(!term){ box.innerHTML='<div class="sr-empty">Type to search notes…</div>'; _sfocus=0; return; }
  const hits=INDEX.filter(p=>
    p.label.toLowerCase().includes(term)||
    p.section.toLowerCase().includes(term)||
    p.text.toLowerCase().includes(term)
  ).slice(0,12);
  if(!hits.length){ box.innerHTML='<div class="sr-empty">No results for "'+esc(q)+'"</div>'; return; }
  box.innerHTML=hits.map((p,i)=>{
    const idx=p.text.toLowerCase().indexOf(term);
    const raw=idx>=0?'…'+p.text.slice(Math.max(0,idx-30),idx+60)+'…':'';
    const excerpt=esc(raw);
    return \`<div class="sr-item\${i===_sfocus?' focused':''}" onclick="show('\${esc(p.id)}');closeSearch()">
      <span class="sr-icon">\${p.icon}</span>
      <div style="flex:1;min-width:0"><div class="sr-label">\${esc(p.label)}</div>\${excerpt?'<div class="sr-excerpt">'+excerpt+'</div>':''}</div>
      <span class="sr-section">\${esc(p.section)}</span>
    </div>\`;
  }).join('');
}
document.getElementById('search-input').addEventListener('input',e=>{ _sfocus=0; renderResults(e.target.value); });
document.getElementById('search-input').addEventListener('keydown',e=>{
  const items=document.querySelectorAll('.sr-item');
  if(e.key==='ArrowDown'){ e.preventDefault(); _sfocus=Math.min(_sfocus+1,items.length-1); renderResults(document.getElementById('search-input').value); }
  if(e.key==='ArrowUp')  { e.preventDefault(); _sfocus=Math.max(_sfocus-1,0); renderResults(document.getElementById('search-input').value); }
  if(e.key==='Enter'     ){ if(items[_sfocus]) items[_sfocus].click(); }
  if(e.key==='Escape'    ){ closeSearch(); }
});
// FIX: single, correct click-outside handler — no broken inline onclick on the element
document.getElementById('search-modal').addEventListener('click',e=>{
  if(e.target===document.getElementById('search-modal')) closeSearch();
});

// ── Flashcards ──
let _fc={cards:[],idx:0,flipped:false,know:0,idk:0};
function openFlash(id){
  const cards=FCDATA[id];
  if(!cards||!cards.length) return;
  _fc={cards:[...cards],idx:0,flipped:false,know:0,idk:0};
  document.getElementById('flash-modal').classList.add('open');
  document.body.style.overflow='hidden';
  renderCard();
}
function closeFlash(){
  document.getElementById('flash-modal').classList.remove('open');
  document.body.style.overflow='';
}
function renderCard(){
  // FIX: guard against empty deck — should never happen via openFlash, but defensive
  if(!_fc.cards.length) return;
  const c=_fc.cards[_fc.idx];
  document.getElementById('flash-counter').textContent=(_fc.idx+1)+' / '+_fc.cards.length;
  document.getElementById('flash-front').textContent=c.front;
  document.getElementById('flash-back').textContent=c.back;
  document.getElementById('flash-flipper').classList.toggle('flipped',_fc.flipped);
  document.getElementById('flash-hint').style.visibility=_fc.flipped?'hidden':'visible';
  document.getElementById('flash-track-fill').style.width=((_fc.idx+1)/_fc.cards.length*100)+'%';
  document.getElementById('fc-know').textContent=_fc.know;
  document.getElementById('fc-idk').textContent=_fc.idk;
}
function flipCard(){ _fc.flipped=!_fc.flipped; renderCard(); }
function fcNav(d){
  _fc.idx=(_fc.idx+d+_fc.cards.length)%_fc.cards.length;
  _fc.flipped=false; renderCard();
}
function markCard(knew){
  if(knew) _fc.know++; else _fc.idk++;
  renderCard();
  setTimeout(()=>fcNav(1),320);
}
function shuffleCards(){
  for(let i=_fc.cards.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [_fc.cards[i],_fc.cards[j]]=[_fc.cards[j],_fc.cards[i]];
  }
  _fc.idx=0; _fc.flipped=false; renderCard();
}

// ── Checkboxes ──
function saveBoxes(){
  const s={};
  document.querySelectorAll('.md input[type="checkbox"]').forEach((cb,i)=>{ s[i]=cb.checked; });
  try{ localStorage.setItem('lsat-checks',JSON.stringify(s)); }catch(_){}
}
function loadBoxes(){
  try{
    const s=JSON.parse(localStorage.getItem('lsat-checks')||'{}');
    document.querySelectorAll('.md input[type="checkbox"]').forEach((cb,i)=>{
      if(s[i]!==undefined) cb.checked=s[i];
      cb.removeAttribute('disabled');
      cb.addEventListener('change',saveBoxes);
    });
  }catch(_){}
}

// ── Mastery tracker ──
function setMastery(id,level){
  try{
    const m=JSON.parse(localStorage.getItem('lsat-mastery')||'{}');
    m[id]=m[id]===level?0:level;
    localStorage.setItem('lsat-mastery',JSON.stringify(m));
  }catch(_){}
  renderMastery();
}
function renderMastery(){
  try{
    const m=JSON.parse(localStorage.getItem('lsat-mastery')||'{}');
    document.querySelectorAll('.m-btn').forEach(btn=>{
      const id=btn.dataset.id, lv=parseInt(btn.dataset.level);
      btn.classList.toggle('active', m[id]===lv);
    });
    document.querySelectorAll('.s-nav-item[id^="nav-"]').forEach(item=>{
      const id=item.id.slice(4);
      const lv=m[id]||0;
      let dot=item.querySelector('.mastery-sidedot');
      if(!dot){ dot=document.createElement('span'); dot.className='mastery-sidedot'; dot.style.cssText='font-size:8px;flex-shrink:0;margin-left:auto'; item.appendChild(dot); }
      dot.textContent=lv===1?'🔴':lv===2?'🟡':lv===3?'🟢':'';
    });
  }catch(_){}
}

// ── Mood / confidence poll ──
// FIX: zero-pad month and day so ISO-style string sort is chronologically correct
function todayKey(){
  const d=new Date();
  const mm=String(d.getMonth()+1).padStart(2,'0');
  const dd=String(d.getDate()).padStart(2,'0');
  return d.getFullYear()+'-'+mm+'-'+dd;
}
function setMood(v){
  try{
    const h=JSON.parse(localStorage.getItem('lsat-mood')||'{}');
    h[todayKey()]=v;
    const keys=Object.keys(h).sort();
    if(keys.length>30) keys.slice(0,-30).forEach(k=>delete h[k]);
    localStorage.setItem('lsat-mood',JSON.stringify(h));
  }catch(_){}
  renderMood();
}
function renderMood(){
  try{
    const h=JSON.parse(localStorage.getItem('lsat-mood')||'{}');
    const today=todayKey();
    const todayVal=h[today]||0;
    document.querySelectorAll('.mood-opt').forEach(el=>{
      const v=parseInt(el.dataset.v);
      el.style.opacity=todayVal===v?'1':todayVal&&v<todayVal?'0.6':'0.4';
      el.style.transform=todayVal===v?'scale(1.3)':'scale(1)';
    });
    const keys=Object.keys(h).sort().slice(-7);
    const hist=document.getElementById('mood-history');
    if(hist&&keys.length>1){
      hist.innerHTML=keys.map(k=>{
        const val=h[k]||0;
        const ht=Math.round((val/5)*24);
        const isToday=k===today;
        return \`<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px">
          <div style="width:100%;height:\${ht}px;background:\${isToday?'var(--accent)':'var(--border)'};border-radius:2px;transition:height .3s"></div>
          <span style="font-size:8px;color:var(--text3)">\${k.slice(5)}</span>
        </div>\`;
      }).join('');
    }
    const banner=document.getElementById('mood-banner');
    if(banner) banner.style.display='block';
  }catch(_){}
}

// ── Keyboard shortcuts ──
document.addEventListener('keydown',e=>{
  const searchOpen=document.getElementById('search-modal').classList.contains('open');
  const flashOpen =document.getElementById('flash-modal').classList.contains('open');
  if(flashOpen){
    if(e.key===' '||e.key==='Enter'){ e.preventDefault(); flipCard(); }
    if(e.key==='ArrowRight'||e.key==='n') fcNav(1);
    if(e.key==='ArrowLeft' ||e.key==='p') fcNav(-1);
    if(e.key==='k') markCard(true);
    if(e.key==='r') markCard(false);
    if(e.key==='s') shuffleCards();
    if(e.key==='Escape') closeFlash();
    return;
  }
  if(searchOpen) return;
  if(e.target.tagName==='INPUT') return;
  if((e.ctrlKey||e.metaKey)&&e.key==='k'){ e.preventDefault(); openSearch(); return; }
  const i=IDS.indexOf(currentId);
  if(e.key===']'&&i<IDS.length-1) show(IDS[i+1]);
  if(e.key==='['&&i>0)            show(IDS[i-1]);
});

// ── Init ──
const hash=location.hash.slice(1);
const last=localStorage.getItem('lsat-last');
show(IDS.includes(hash)?hash : IDS.includes(last)?last : DEFAULT);
loadBoxes();
renderMastery();
renderMood();
</script>
</body>
</html>`;

// ─── Write output ─────────────────────────────────────────────────────────────

mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'index.html'), HTML, 'utf8');
console.log(`✅  Built ${join(OUT, 'index.html')} at ${buildStr}`);
