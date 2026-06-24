/**
 * Arochemy — js/article-page.js
 * 單篇文章頁：從 Firestore 讀取文章內容、渲染、相關文章、分享功能
 */

import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getFirestore, doc, getDoc, collection, getDocs }
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
const $   = id => document.getElementById(id);
const esc = s  => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

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

/* ══════════════════════════════════════════════════════════════
   初始化
══════════════════════════════════════════════════════════════ */
async function init() {
  injectStyles();

  const id = new URLSearchParams(location.search).get('id');
  if (!id) { showError('找不到文章 ID，請從文章列表進入。'); return; }

  try {
    const snap = await getDoc(doc(db, 'articles', id));
    if (!snap.exists()) { showError('此文章不存在或已下架。'); return; }

    const article = { id: snap.id, ...snap.data() };
    renderArticle(article);
    loadRelated(article);
  } catch (e) {
    showError('文章載入失敗，請稍後再試。');
    console.error(e);
  }
}

/* ══════════════════════════════════════════════════════════════
   渲染文章
══════════════════════════════════════════════════════════════ */
function renderArticle(a) {
  /* ── 頁面標題 & SEO ── */
  document.title = `${a.title || '文章'}｜Arochemy`;
  const metaDesc = document.getElementById('metaDesc');
  if (metaDesc) metaDesc.content = a.excerpt || a.title || '';

  /* ── 分類麵包屑 ── */
  const catLabel = CAT_LABELS[a.category] || a.category || '文章';
  const crumb    = $('art-cat-crumb');
  if (crumb) crumb.textContent = catLabel;

  /* ── 分類標籤 ── */
  const catEl = $('art-category');
  if (catEl && catLabel) catEl.textContent = catLabel;

  /* ── 標題 ── */
  const titleEl = $('art-title');
  if (titleEl) titleEl.textContent = a.title || '';

  /* ── 日期 & 標籤 ── */
  const dateEl = $('art-date');
  if (dateEl) {
    const d = toDate(a.createdAt);
    dateEl.textContent = d.getTime()
      ? d.toLocaleDateString('zh-TW', { year:'numeric', month:'long', day:'numeric' })
      : '';
  }

  const tagsEl = $('art-tags');
  if (tagsEl && a.tags?.length) {
    tagsEl.innerHTML = a.tags.map(t =>
      `<span class="art-tag-chip">${esc(t)}</span>`
    ).join('');
  }

  /* ── 封面圖 ── */
  if (a.coverImage) {
    const wrap = $('art-cover-wrap');
    const img  = $('art-cover');
    if (wrap && img) {
      img.src = a.coverImage;
      img.alt = a.title || '';
      wrap.style.display = '';
    }
  }

  /* ── 文章本文（富文字 HTML）── */
  const prose = $('art-prose');
  if (prose) {
    prose.innerHTML = a.content || '<p class="muted">（本文暫無內容）</p>';
  }

  /* ── 分享按鈕 ── */
  initShareButtons(a.title);

  /* ── 顯示內容，隱藏 skeleton ── */
  $('article-skeleton').style.display = 'none';
  $('article-content').style.display  = '';
}

/* ══════════════════════════════════════════════════════════════
   相關文章（同分類，最多 3 篇）
══════════════════════════════════════════════════════════════ */
async function loadRelated(current) {
  try {
    const snap = await getDocs(collection(db, 'articles'));
    const related = [];

    snap.forEach(d => {
      if (d.id === current.id) return;
      const a = d.data();
      if (a.status !== 'published') return;
      // 優先同分類
      if (a.category === current.category) related.push({ id: d.id, ...a });
    });

    // 若同分類不夠，補其他文章
    if (related.length < 3) {
      snap.forEach(d => {
        if (d.id === current.id) return;
        const a = d.data();
        if (a.status !== 'published') return;
        if (a.category !== current.category && !related.find(r => r.id === d.id)) {
          related.push({ id: d.id, ...a });
        }
      });
    }

    const top3 = related
      .sort((a, b) => toDate(b.createdAt) - toDate(a.createdAt))
      .slice(0, 3);

    if (!top3.length) return;

    const section = $('related-section');
    const grid    = $('related-grid');
    if (!section || !grid) return;

    grid.innerHTML = top3.map(a => {
      const dateStr = toDate(a.createdAt).toLocaleDateString('zh-TW');
      const cat     = CAT_LABELS[a.category] || '';
      return `
        <a class="article-card" href="article.html?id=${a.id}" style="text-decoration:none;display:block;color:inherit">
          ${a.coverImage ? `
            <div style="height:140px;border-radius:8px;overflow:hidden;margin-bottom:12px">
              <img src="${esc(a.coverImage)}" alt="${esc(a.title)}" style="width:100%;height:100%;object-fit:cover" loading="lazy">
            </div>` : ''}
          ${cat ? `<div style="font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:#b8975a;margin-bottom:6px">${esc(cat)}</div>` : ''}
          <div class="article-title">${esc(a.title || '')}</div>
          <div class="article-meta muted">${dateStr}</div>
          ${a.excerpt ? `<p class="article-excerpt muted">${esc(a.excerpt).slice(0,60)}…</p>` : ''}
        </a>
      `;
    }).join('');

    section.style.display = '';
  } catch (e) {
    console.warn('[article-page] loadRelated error:', e.message);
  }
}

/* ══════════════════════════════════════════════════════════════
   分享按鈕
══════════════════════════════════════════════════════════════ */
function initShareButtons(title) {
  const url      = encodeURIComponent(location.href);
  const text     = encodeURIComponent(title || 'Arochemy 文章');

  const lineBtn  = $('shareLineBtn');
  const fbBtn    = $('shareFbBtn');
  const copyBtn  = $('shareCopyBtn');

  lineBtn?.addEventListener('click', () => {
    window.open(`https://social-plugins.line.me/lineit/share?url=${url}`, '_blank', 'noopener');
  });

  fbBtn?.addEventListener('click', () => {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, '_blank', 'noopener');
  });

  copyBtn?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      copyBtn.textContent = '已複製 ✓';
      setTimeout(() => { copyBtn.textContent = '複製連結'; }, 2000);
    } catch {
      copyBtn.textContent = location.href;
    }
  });
}

/* ══════════════════════════════════════════════════════════════
   錯誤狀態
══════════════════════════════════════════════════════════════ */
function showError(msg) {
  $('article-skeleton').style.display = 'none';
  $('article-content').style.display  = 'none';
  const errEl = $('article-error');
  const msgEl = $('article-error-msg');
  if (errEl) errEl.style.display = '';
  if (msgEl) msgEl.textContent   = msg;
}

/* ══════════════════════════════════════════════════════════════
   注入樣式
══════════════════════════════════════════════════════════════ */
function injectStyles() {
  if (document.getElementById('article-page-style')) return;
  const s = document.createElement('style');
  s.id = 'article-page-style';
  s.textContent = `
    /* ── Skeleton ── */
    .skel-line {
      background: linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%);
      background-size: 200% 100%;
      animation: skel-shimmer 1.4s infinite;
      border-radius: 4px;
      margin-bottom: 12px;
    }
    @keyframes skel-shimmer {
      0%   { background-position: -200% 0; }
      100% { background-position:  200% 0; }
    }

    /* ── Breadcrumb ── */
    .art-breadcrumb {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      margin-bottom: 28px;
      color: #999;
    }
    .art-breadcrumb a { color: #b8975a; text-decoration: none; }
    .art-breadcrumb a:hover { text-decoration: underline; }
    .art-sep { color: #ccc; }

    /* ── 文章頭部 ── */
    .art-header {
      padding-top: 8px;
      padding-bottom: 32px;
      max-width: 760px;
    }
    .art-kicker {
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: #b8975a;
      margin-bottom: 14px;
    }
    .art-title {
      font-size: clamp(26px, 4vw, 40px);
      font-weight: 700;
      line-height: 1.25;
      letter-spacing: -0.01em;
      color: #111;
      margin: 0 0 18px;
    }
    .art-meta {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 10px;
      font-size: 14px;
      color: #888;
    }
    .art-tag-row {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .art-tag-chip {
      font-size: 12px;
      padding: 3px 10px;
      background: #f5f5f5;
      border-radius: 999px;
      color: #666;
    }

    /* ── 封面圖 ── */
    .art-cover-wrap {
      max-width: 900px;
      margin-bottom: 48px;
    }
    .art-cover-img {
      width: 100%;
      max-height: 480px;
      object-fit: cover;
      border-radius: 16px;
      display: block;
    }

    /* ── 文章本文 ── */
    .art-body { max-width: 720px; margin-bottom: 48px; }

    .art-prose {
      font-size: 17px;
      line-height: 1.85;
      color: #333;
    }
    .art-prose h2 {
      font-size: 24px;
      font-weight: 700;
      margin: 40px 0 16px;
      color: #111;
      padding-bottom: 8px;
      border-bottom: 2px solid #f0ede8;
    }
    .art-prose h3 {
      font-size: 20px;
      font-weight: 600;
      margin: 32px 0 12px;
      color: #222;
    }
    .art-prose p { margin-bottom: 20px; }
    .art-prose ul, .art-prose ol {
      padding-left: 24px;
      margin-bottom: 20px;
    }
    .art-prose li { margin-bottom: 8px; }
    .art-prose blockquote {
      border-left: 3px solid #b8975a;
      padding: 12px 20px;
      margin: 24px 0;
      background: #fdf9f5;
      border-radius: 0 8px 8px 0;
      color: #555;
      font-style: italic;
    }
    .art-prose a { color: #b8975a; text-decoration: underline; }
    .art-prose a:hover { color: #8a6a30; }
    .art-prose img {
      max-width: 100%;
      border-radius: 10px;
      margin: 16px 0;
    }
    .art-prose strong { color: #111; font-weight: 700; }
    .art-prose hr {
      border: none;
      border-top: 1px solid #eee;
      margin: 36px 0;
    }
    .art-prose code {
      background: #f5f5f5;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 14px;
    }

    /* ── 分享列 ── */
    .art-share {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      max-width: 720px;
      padding-bottom: 40px;
    }
    .art-share-btn {
      padding: 7px 18px;
      border-radius: 999px;
      border: 1.5px solid #ddd;
      background: #fff;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s;
      font-family: inherit;
      color: #444;
    }
    .art-share-btn:hover {
      border-color: #b8975a;
      color: #b8975a;
    }

    /* ── 手機版 ── */
    @media (max-width: 640px) {
      .art-title { font-size: 24px; }
      .art-prose { font-size: 16px; }
      .art-cover-img { border-radius: 10px; max-height: 240px; }
    }
  `;
  document.head.appendChild(s);
}

/* ── 啟動 ── */
init();
