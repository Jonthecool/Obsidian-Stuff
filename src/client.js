/**
 * client.js — LSAT Prep site browser runtime
 *
 * This file is read by build.js at build time. The four %%PLACEHOLDER%%
 * tokens below are replaced with generated JSON before writing docs/index.html.
 * Do not edit the placeholder lines manually.
 */

/* ─── Build-time data (replaced by build.js) ─────────────────────────────── */

const DEFAULT = '%%DEFAULT%%';
const IDS     = %%IDS%%;
const INDEX   = %%INDEX%%;
const FCDATA  = %%FCDATA%%;

/* ─── Module-level state ─────────────────────────────────────────────────── */

let currentId = null;

/* ─── Navigation ─────────────────────────────────────────────────────────── */

function show(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.s-nav-item').forEach(n => n.classList.remove('active'));

  const page = document.getElementById('page-' + id);
  const nav  = document.getElementById('nav-'  + id);

  if (page) { page.classList.add('active'); window.scrollTo(0, 0); }
  if (nav)  { nav.classList.add('active');  nav.scrollIntoView({ block: 'nearest' }); }

  history.replaceState(null, '', '#' + id);

  const label = nav ? nav.querySelector('.s-nav-label-text').textContent.trim() : 'LSAT Prep';
  document.getElementById('topbar-title').textContent = label;

  currentId = id;
  closeSidebar();

  try { localStorage.setItem('lsat-last', id); } catch (_) {}
}

/* ─── Sidebar ────────────────────────────────────────────────────────────── */

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
  document.getElementById('sidebar').classList.contains('open')
    ? closeSidebar()
    : openSidebar();
}

/* ─── Swipe gesture (mobile) ─────────────────────────────────────────────── */

let _touchStartX = 0;

document.addEventListener('touchstart', e => {
  _touchStartX = e.touches[0].clientX;
}, { passive: true });

document.addEventListener('touchend', e => {
  const dx = e.changedTouches[0].clientX - _touchStartX;
  const sb = document.getElementById('sidebar');
  if (dx >  60 && _touchStartX < 24 && !sb.classList.contains('open')) openSidebar();
  if (dx < -60 && sb.classList.contains('open'))                        closeSidebar();
}, { passive: true });

/* ─── Theme ──────────────────────────────────────────────────────────────── */

function toggleTheme() {
  const html  = document.documentElement;
  const light = html.getAttribute('data-theme') === 'light';
  html.setAttribute('data-theme', light ? 'dark' : 'light');
  document.getElementById('theme-btn').textContent = light ? '🌙' : '☀️';
  try { localStorage.setItem('lsat-theme', light ? 'dark' : 'light'); } catch (_) {}
}

// Script is at the bottom of <body> — DOM is ready; no DOMContentLoaded needed.
(function applyStoredTheme() {
  const t = localStorage.getItem('lsat-theme');
  if (!t) return;
  document.documentElement.setAttribute('data-theme', t);
  const btn = document.getElementById('theme-btn');
  if (btn) btn.textContent = t === 'light' ? '☀️' : '🌙';
}());

/* ─── Reading progress bar ───────────────────────────────────────────────── */

window.addEventListener('scroll', () => {
  const bar = document.getElementById('progress-bar');
  if (!bar) return;
  const h   = document.documentElement;
  const pct = (h.scrollTop / (h.scrollHeight - h.clientHeight)) * 100;
  bar.style.width = Math.min(100, pct) + '%';
}, { passive: true });

/* ─── Search ─────────────────────────────────────────────────────────────── */

let _searchFocusIdx = 0;

function openSearch() {
  document.getElementById('search-modal').classList.add('open');
  const inp = document.getElementById('search-input');
  inp.value = '';
  renderResults('');
  inp.focus();
}

function closeSearch() {
  document.getElementById('search-modal').classList.remove('open');
}

/** Escapes a string for safe injection into innerHTML. */
function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderResults(query) {
  const box  = document.getElementById('search-results');
  const term = query.trim().toLowerCase();

  if (!term) {
    box.innerHTML = '<div class="sr-empty">Type to search notes…</div>';
    _searchFocusIdx = 0;
    return;
  }

  const hits = INDEX
    .filter(p =>
      p.label.toLowerCase().includes(term)   ||
      p.section.toLowerCase().includes(term) ||
      p.text.toLowerCase().includes(term)
    )
    .slice(0, 12);

  if (!hits.length) {
    box.innerHTML = `<div class="sr-empty">No results for "${escHtml(query)}"</div>`;
    return;
  }

  box.innerHTML = hits.map((p, i) => {
    const matchIdx = p.text.toLowerCase().indexOf(term);
    const excerpt  = matchIdx >= 0
      ? escHtml('…' + p.text.slice(Math.max(0, matchIdx - 30), matchIdx + 60) + '…')
      : '';
    const focused  = i === _searchFocusIdx ? ' focused' : '';

    return `
      <div class="sr-item${focused}" onclick="show('${escHtml(p.id)}'); closeSearch()">
        <span class="sr-icon">${p.icon}</span>
        <div style="flex:1;min-width:0">
          <div class="sr-label">${escHtml(p.label)}</div>
          ${excerpt ? `<div class="sr-excerpt">${excerpt}</div>` : ''}
        </div>
        <span class="sr-section">${escHtml(p.section)}</span>
      </div>`;
  }).join('');
}

document.getElementById('search-input').addEventListener('input', e => {
  _searchFocusIdx = 0;
  renderResults(e.target.value);
});

document.getElementById('search-input').addEventListener('keydown', e => {
  const items = document.querySelectorAll('.sr-item');
  const inp   = document.getElementById('search-input');
  if (e.key === 'ArrowDown') { e.preventDefault(); _searchFocusIdx = Math.min(_searchFocusIdx + 1, items.length - 1); renderResults(inp.value); }
  if (e.key === 'ArrowUp')   { e.preventDefault(); _searchFocusIdx = Math.max(_searchFocusIdx - 1, 0);               renderResults(inp.value); }
  if (e.key === 'Enter')     { items[_searchFocusIdx]?.click(); }
  if (e.key === 'Escape')    { closeSearch(); }
});

document.getElementById('search-modal').addEventListener('click', e => {
  if (e.target === document.getElementById('search-modal')) closeSearch();
});

/* ─── Flashcards ─────────────────────────────────────────────────────────── */

const _fc = { cards: [], idx: 0, flipped: false, know: 0, idk: 0 };

function openFlash(id) {
  const cards = FCDATA[id];
  if (!cards?.length) return;
  Object.assign(_fc, { cards: [...cards], idx: 0, flipped: false, know: 0, idk: 0 });
  document.getElementById('flash-modal').classList.add('open');
  document.body.style.overflow = 'hidden';
  renderCard();
}

function closeFlash() {
  document.getElementById('flash-modal').classList.remove('open');
  document.body.style.overflow = '';
}

function renderCard() {
  if (!_fc.cards.length) return;
  const c = _fc.cards[_fc.idx];

  document.getElementById('flash-counter').textContent    = `${_fc.idx + 1} / ${_fc.cards.length}`;
  document.getElementById('flash-front').textContent      = c.front;
  document.getElementById('flash-back').textContent       = c.back;
  document.getElementById('flash-flipper').classList.toggle('flipped', _fc.flipped);
  document.getElementById('flash-hint').style.visibility  = _fc.flipped ? 'hidden' : 'visible';
  document.getElementById('flash-track-fill').style.width = `${((_fc.idx + 1) / _fc.cards.length) * 100}%`;
  document.getElementById('fc-know').textContent          = _fc.know;
  document.getElementById('fc-idk').textContent           = _fc.idk;
}

function flipCard() {
  _fc.flipped = !_fc.flipped;
  renderCard();
}

function fcNav(delta) {
  _fc.idx     = (_fc.idx + delta + _fc.cards.length) % _fc.cards.length;
  _fc.flipped = false;
  renderCard();
}

function markCard(knew) {
  if (knew) _fc.know++; else _fc.idk++;
  renderCard();
  setTimeout(() => fcNav(1), 320);
}

function shuffleCards() {
  for (let i = _fc.cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [_fc.cards[i], _fc.cards[j]] = [_fc.cards[j], _fc.cards[i]];
  }
  _fc.idx     = 0;
  _fc.flipped = false;
  renderCard();
}

/* ─── Checkboxes ─────────────────────────────────────────────────────────── */

function saveBoxes() {
  const state = {};
  document.querySelectorAll('.md input[type="checkbox"]').forEach((cb, i) => {
    state[i] = cb.checked;
  });
  try { localStorage.setItem('lsat-checks', JSON.stringify(state)); } catch (_) {}
}

function loadBoxes() {
  try {
    const state = JSON.parse(localStorage.getItem('lsat-checks') || '{}');
    document.querySelectorAll('.md input[type="checkbox"]').forEach((cb, i) => {
      if (state[i] !== undefined) cb.checked = state[i];
      cb.removeAttribute('disabled');
      cb.addEventListener('change', saveBoxes);
    });
  } catch (_) {}
}

/* ─── Mastery tracker ────────────────────────────────────────────────────── */

function setMastery(id, level) {
  try {
    const map = JSON.parse(localStorage.getItem('lsat-mastery') || '{}');
    map[id]   = map[id] === level ? 0 : level;  // toggle off if same level tapped again
    localStorage.setItem('lsat-mastery', JSON.stringify(map));
  } catch (_) {}
  renderMastery();
}

function renderMastery() {
  try {
    const map = JSON.parse(localStorage.getItem('lsat-mastery') || '{}');

    document.querySelectorAll('.m-btn').forEach(btn => {
      btn.classList.toggle('active', map[btn.dataset.id] === parseInt(btn.dataset.level));
    });

    document.querySelectorAll('.s-nav-item[id^="nav-"]').forEach(item => {
      const id  = item.id.slice(4);
      const lv  = map[id] || 0;
      let dot   = item.querySelector('.mastery-sidedot');
      if (!dot) {
        dot           = document.createElement('span');
        dot.className = 'mastery-sidedot';
        dot.style.cssText = 'font-size:8px;flex-shrink:0;margin-left:auto';
        item.appendChild(dot);
      }
      dot.textContent = lv === 1 ? '🔴' : lv === 2 ? '🟡' : lv === 3 ? '🟢' : '';
    });
  } catch (_) {}
}

/* ─── Daily confidence poll ──────────────────────────────────────────────── */

/**
 * Returns today's date as a zero-padded YYYY-MM-DD string so that
 * lexicographic sort on keys is always chronologically correct.
 */
function todayKey() {
  const d  = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function setMood(v) {
  try {
    const history = JSON.parse(localStorage.getItem('lsat-mood') || '{}');
    history[todayKey()] = v;
    // Keep only the last 30 days
    const keys = Object.keys(history).sort();
    keys.slice(0, Math.max(0, keys.length - 30)).forEach(k => delete history[k]);
    localStorage.setItem('lsat-mood', JSON.stringify(history));
  } catch (_) {}
  renderMood();
}

function renderMood() {
  try {
    const history  = JSON.parse(localStorage.getItem('lsat-mood') || '{}');
    const today    = todayKey();
    const todayVal = history[today] || 0;

    // Highlight the selected emoji
    document.querySelectorAll('.mood-opt').forEach(el => {
      const v = parseInt(el.dataset.v);
      el.style.opacity   = todayVal === v ? '1' : (todayVal && v < todayVal) ? '0.6' : '0.4';
      el.style.transform = todayVal === v ? 'scale(1.3)' : 'scale(1)';
    });

    // Render a 7-day sparkline
    const keys    = Object.keys(history).sort().slice(-7);
    const histDiv = document.getElementById('mood-history');
    if (histDiv && keys.length > 1) {
      histDiv.innerHTML = keys.map(k => {
        const val     = history[k] || 0;
        const height  = Math.round((val / 5) * 24);
        const isToday = k === today;
        return `
          <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px">
            <div style="width:100%;height:${height}px;background:${isToday ? 'var(--accent)' : 'var(--border)'};border-radius:2px;transition:height .3s"></div>
            <span style="font-size:8px;color:var(--text3)">${k.slice(5)}</span>
          </div>`;
      }).join('');
    }

    const banner = document.getElementById('mood-banner');
    if (banner) banner.style.display = 'block';
  } catch (_) {}
}

/* ─── Keyboard shortcuts ─────────────────────────────────────────────────── */

document.addEventListener('keydown', e => {
  const searchOpen = document.getElementById('search-modal').classList.contains('open');
  const flashOpen  = document.getElementById('flash-modal').classList.contains('open');

  if (flashOpen) {
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); flipCard(); }
    if (e.key === 'ArrowRight' || e.key === 'n') fcNav(1);
    if (e.key === 'ArrowLeft'  || e.key === 'p') fcNav(-1);
    if (e.key === 'k') markCard(true);
    if (e.key === 'r') markCard(false);
    if (e.key === 's') shuffleCards();
    if (e.key === 'Escape') closeFlash();
    return;
  }

  if (searchOpen)                    return;
  if (e.target.tagName === 'INPUT')  return;

  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
    openSearch();
    return;
  }

  const i = IDS.indexOf(currentId);
  if (e.key === ']' && i < IDS.length - 1) show(IDS[i + 1]);
  if (e.key === '[' && i > 0)               show(IDS[i - 1]);
});

/* ─── Initialisation ─────────────────────────────────────────────────────── */

(function init() {
  const hash = location.hash.slice(1);
  const last = localStorage.getItem('lsat-last');
  const startId = IDS.includes(hash) ? hash : IDS.includes(last) ? last : DEFAULT;
  show(startId);
  loadBoxes();
  renderMastery();
  renderMood();
}());
