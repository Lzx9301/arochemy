/**
 * Arochemy — js/articles.js
 * 文章列表頁：從 Firestore 讀取 published 文章，支援分類篩選
 */

import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getFirestore, collection, getDocs }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

/* ── Firebase ──────────────────────────────────────────────── */
const firebaseConfig = {
  apiKey:            'AIzaSyAgRq-fVWsQuyO2odbfVEjgOZoHyACEApI',
  authDomain:        'trying-89dc6.firebaseapp.com',
  projectId:         'trying-89dc6',
  storageBucket:     'trying-89dc6.firebasestorage.app',
  messagingSenderId: '115559148124',
  appId:             '1:115559148124:web:ac37b9c249183a919b5499',
};

const app = getApps().find(a => a.name === '[DEFAULT]') || initializeApp(firebaseConfig);
const db  = getFirestore(app);

/* ── 工具 ──────────────────────────────────────────────────── */
const esc = s => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

function toDate(ts) {
  if (!ts) return new Date(0);
  if (ts.toDate) return ts.toDate();
  if (ts.seconds) return new Date(ts.seconds * 1000);
  return new Date(ts);
}

const CAT_LABELS = {
  knowledge:    '精油知識',
  lifestyle:    '生活應用',
  diy:          'DIY 教學',
  'brand-story':'品牌故事',
  news:         '最新消息',
};

/* ── 全域資料 ──────────────────────────────────────────────── */
let allArticles   = [];
let currentCat    = 'all';

/* ── DOM ───────────────────────────────────────────────────── */
const grid = document.querySelector('.grid-3');

/* ══════════════════════════════════════════════════════════════
   初始化
══════════════════════════════════════════════════════════════ */
async function init() {
  injectStyles();
  buildFilterBar();
  await loadArticles();
}

/* ══════════════════════════════════════════════════════════════
   讀取文章
══════════════════════════════════════════════════════════════ */
async function loadArticles() {
  if (!grid) return;
  grid.innerHTML = skeletons(6);

  try {
    const snap = await getDocs(collection(db, 'articles'));
    allArticles = [];
    snap.forEach(d => {
      const a = d.data();
      if (a.status === 'published') allArticles.push({ id: d.id, ...a });
    });

    // 前端排序：新到舊
    allArticles.sort((a, b) => toDate(b.createdAt) - toDate(a.createdAt));

    renderArticles(allArticles);
  } catch (e) {
    console.warn('[articles] load error:', e.message);
    // 若讀取失敗，保留靜態內容
    grid.innerHTML = '';
  }
}

/* ══════════════════════════════════════════════════════════════
   渲染文章列表
══════════════════════════════════════════════════════════════ */
function renderArticles(list) {
  if (!grid) return;

  // 更新文章數量
  const countEl = document.getElementById('articles-count');
  if (countEl) countEl.textContent = list.length;

  if (!list.length) {
    grid.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:60px 20px;color:#999">
        <div style="font-size:40px;margin-bottom:12px">📝</div>
        <p>此分類目前沒有文章</p>
      </div>`;
    return;
  }

  grid.innerHTML = list.map(a => articleCard(a)).join('');
}

/* ── 文章卡片 ── */
function articleCard(a) {
  const date    = toDate(a.createdAt);
  const dateStr = date.getTime() ? date.toLocaleDateString('zh-TW', { year:'numeric', month:'2-digit', day:'2-digit' }) : '';
  const catStr  = CAT_LABELS[a.category] || a.category || '';
  const tags    = (a.tags || []).slice(0, 3);

  return `
    <a class="article-card dyn-article-card" href="article.html?id=${a.id}">
      ${a.coverImage ? `
        <div class="article-cover">
          <img src="${esc(a.coverImage)}" alt="${esc(a.title)}" loading="lazy">
        </div>` : `
        <div class="article-cover article-cover-placeholder">🌿</div>`}
      <div class="article-body">
        ${catStr ? `<div class="article-cat">${esc(catStr)}</div>` : ''}
        <div class="article-title">${esc(a.title || '（無標題）')}</div>
        <div class="article-meta muted">
          ${dateStr}${catStr && dateStr ? '｜' : ''}${esc(catStr)}
        </div>
        ${a.excerpt ? `<p class="article-excerpt muted">${esc(a.excerpt).slice(0, 80)}${a.excerpt.length > 80 ? '…' : ''}</p>` : ''}
        ${tags.length ? `
          <div class="article-tags">
            ${tags.map(t => `<span class="article-tag">${esc(t)}</span>`).join('')}
          </div>` : ''}
      </div>
    </a>
  `;
}

/* ══════════════════════════════════════════════════════════════
   分類篩選列
══════════════════════════════════════════════════════════════ */
function buildFilterBar() {
  const sectionHead = document.querySelector('.section .section-head');
  if (!sectionHead) return;

  // 建立篩選列 + 文章計數
  const bar = document.createElement('div');
  bar.className = 'articles-filter-bar';
  bar.innerHTML = `
    <div class="articles-filter-chips">
      <button class="a-chip active" data-cat="all">全部 <span id="articles-count">—</span></button>
      ${Object.entries(CAT_LABELS).map(([k,v]) => `
        <button class="a-chip" data-cat="${k}">${v}</button>
      `).join('')}
    </div>
  `;

  sectionHead.after(bar);

  bar.querySelectorAll('.a-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      bar.querySelectorAll('.a-chip').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentCat = btn.dataset.cat;

      const filtered = currentCat === 'all'
        ? allArticles
        : allArticles.filter(a => a.category === currentCat);
      renderArticles(filtered);
    });
  });
}

/* ── Skeleton ── */
function skeletons(n) {
  return Array(n).fill(0).map(() => `
    <div class="article-card" style="animation:pulse 1.4s infinite">
      <div style="height:160px;background:#f0f0f0;border-radius:8px;margin-bottom:12px"></div>
      <div style="height:14px;background:#f0f0f0;border-radius:4px;width:30%;margin-bottom:8px"></div>
      <div style="height:18px;background:#f0f0f0;border-radius:4px;width:90%;margin-bottom:8px"></div>
      <div style="height:14px;background:#f0f0f0;border-radius:4px;width:70%"></div>
    </div>
  `).join('');
}

/* ── 注入樣式 ── */
function injectStyles() {
  if (document.getElementById('articles-dyn-style')) return;
  const s = document.createElement('style');
  s.id = 'articles-dyn-style';
  s.textContent = `
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50%       { opacity: 0.5; }
    }

    /* 篩選列 */
    .articles-filter-bar {
      margin-bottom: 28px;
    }
    .articles-filter-chips {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .a-chip {
      padding: 6px 16px;
      border-radius: 999px;
      border: 1.5px solid #ddd;
      background: #fff;
      font-size: 13px;
      font-weight: 500;
      color: #555;
      cursor: pointer;
      transition: all 0.15s;
      font-family: inherit;
    }
    .a-chip:hover { border-color: #b8975a; color: #b8975a; }
    .a-chip.active {
      background: #111;
      border-color: #111;
      color: #fff;
    }

    /* 動態文章卡片 */
    .dyn-article-card {
      display: flex;
      flex-direction: column;
      text-decoration: none;
      color: inherit;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .dyn-article-card:hover {
      transform: translateY(-3px);
      box-shadow: 0 8px 28px rgba(0,0,0,0.09);
      text-decoration: none;
    }
    .article-cover {
      width: 100%;
      aspect-ratio: 16/9;
      border-radius: 10px;
      overflow: hidden;
      background: #f7f5f0;
      margin-bottom: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 36px;
      color: #ccc;
    }
    .article-cover img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transition: transform 0.3s;
    }
    .dyn-article-card:hover .article-cover img {
      transform: scale(1.04);
    }
    .article-body { flex: 1; display: flex; flex-direction: column; gap: 5px; }
    .article-cat {
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: #b8975a;
    }
    .article-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 5px;
      margin-top: 6px;
    }
    .article-tag {
      font-size: 11px;
      padding: 2px 8px;
      background: #f5f5f5;
      border-radius: 999px;
      color: #777;
    }

    /* 讓 section-head 的說明文字隱藏（改用動態內容） */
    .section .section-head > p.muted:last-child {
      display: none;
    }

    @media (max-width: 640px) {
      .a-chip { font-size: 12px; padding: 5px 12px; }
    }
  `;
  document.head.appendChild(s);
}

/* ── 啟動 ── */
init();
