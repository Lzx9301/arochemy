/**
 * Arochemy — js/articles.js
 * 文章列表頁（芳香科學堂）：
 *   1. 從 Firestore 讀取 published 文章（新到舊）
 *   2. 「最新文章」區塊顯示最新一篇
 *   3. 「全部文章」區塊：分類篩選 + 分頁（超過 15 篇才出現分頁）
 *   4. 「從哪裡開始閱讀？」主題卡片點擊後，直接套用該分類並捲到全部文章
 *   5. 支援網址參數 ?cat=分類代碼（例：articles.html?cat=taiwan-plants）
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

/* ── 設定 ──────────────────────────────────────────────────── */
const PAGE_SIZE = 15;                                   // 每頁篇數，超過才顯示分頁
const PLACEHOLDER_IMG = 'images/articles-placeholder.jpg'; // 文章沒有封面時使用

/* 文章頁的篩選按鈕（順序即顯示順序）。
   代碼必須跟後台 admin.html「文章分類」下拉選單的 value 一致。 */
const FILTER_CATS = {
  'taiwan-plants': '臺灣植物',
  'scent-science': '氣味科學',
  blending:        '調香與應用',
  knowledge:       '精油知識',
  news:            '最新消息',
};

/* 舊分類：沒有篩選按鈕，但舊文章仍要能顯示正確的分類名稱 */
const CAT_LABELS = {
  ...FILTER_CATS,
  lifestyle:     '生活應用',
  diy:           'DIY 教學',
  'brand-story': '品牌故事',
};

/* ── 工具 ──────────────────────────────────────────────────── */
const esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

function toDate(ts) {
  if (!ts) return new Date(0);
  if (ts.toDate) return ts.toDate();
  if (ts.seconds) return new Date(ts.seconds * 1000);
  return new Date(ts);
}

/* 2026.10.12 這種格式 */
function fmtDate(ts) {
  const d = toDate(ts);
  if (!d.getTime()) return '';
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}`;
}

const catLabel = key => CAT_LABELS[key] || key || '';

/* ── 狀態 ──────────────────────────────────────────────────── */
let allArticles = [];
let currentCat  = 'all';
let currentPage = 1;

/* ── DOM ───────────────────────────────────────────────────── */
const featureEl = document.getElementById('arFeature');
const chipsEl   = document.getElementById('arChips');
const gridEl    = document.getElementById('arGrid');
const pagerEl   = document.getElementById('arPager');
const allSect   = document.getElementById('ar-all');

/* ══════════════════════════════════════════════════════════════
   初始化
══════════════════════════════════════════════════════════════ */
async function init() {
  const urlCat = new URLSearchParams(location.search).get('cat');
  if (urlCat && FILTER_CATS[urlCat]) currentCat = urlCat;

  buildChips();
  bindTopics();
  if (gridEl) gridEl.innerHTML = skeletons(3);

  try {
    const snap = await getDocs(collection(db, 'articles'));
    allArticles = [];
    snap.forEach(d => {
      const a = d.data();
      if (a.status === 'published') allArticles.push({ id: d.id, ...a });
    });
    allArticles.sort((a, b) => toDate(b.createdAt) - toDate(a.createdAt));
  } catch (e) {
    console.warn('[articles] load error:', e.message);
    allArticles = [];
  }

  renderFeature();
  renderList();
}

/* ══════════════════════════════════════════════════════════════
   最新文章（最新一篇）
══════════════════════════════════════════════════════════════ */
function renderFeature() {
  if (!featureEl) return;
  const a = allArticles[0];

  if (!a) {
    featureEl.innerHTML = `<p class="ar-empty">文章即將上線，敬請期待。</p>`;
    return;
  }

  const href = `article.html?id=${encodeURIComponent(a.id)}`;
  featureEl.innerHTML = `
    <a class="ar-feature-img" href="${href}" tabindex="-1" aria-hidden="true">
      <img src="${esc(a.coverImage || PLACEHOLDER_IMG)}" alt="">
    </a>
    <div class="ar-feature-body">
      <p class="ar-meta">
        ${a.category ? `<span>${esc(catLabel(a.category))}</span>` : ''}
        <span>${fmtDate(a.createdAt)}</span>
      </p>
      <h3><a href="${href}">${esc(a.title || '（無標題）')}</a></h3>
      ${a.excerpt ? `<p class="ar-feature-excerpt">${esc(a.excerpt)}</p>` : ''}
      <a class="ar-btn-outline" href="${href}">閱讀文章</a>
    </div>`;
}

/* ══════════════════════════════════════════════════════════════
   分類按鈕
══════════════════════════════════════════════════════════════ */
function buildChips() {
  if (!chipsEl) return;
  const entries = [['all', '全部文章'], ...Object.entries(FILTER_CATS)];
  chipsEl.innerHTML = entries.map(([k, v]) => `
    <button type="button" class="ar-chip${k === currentCat ? ' active' : ''}" data-cat="${k}"
      role="tab" aria-selected="${k === currentCat}">${v}</button>`).join('');

  chipsEl.querySelectorAll('.ar-chip').forEach(btn => {
    btn.addEventListener('click', () => setCategory(btn.dataset.cat, false));
  });
}

function setCategory(cat, scroll) {
  currentCat  = cat;
  currentPage = 1;
  chipsEl?.querySelectorAll('.ar-chip').forEach(b => {
    const on = b.dataset.cat === cat;
    b.classList.toggle('active', on);
    b.setAttribute('aria-selected', String(on));
  });

  // 網址同步（方便分享、重新整理後維持同一分類），不會新增瀏覽紀錄
  const url = new URL(location.href);
  if (cat === 'all') url.searchParams.delete('cat'); else url.searchParams.set('cat', cat);
  history.replaceState(null, '', url);

  renderList();
  if (scroll) allSect?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* 「從哪裡開始閱讀？」四個主題 → 套用分類並捲到全部文章 */
function bindTopics() {
  document.querySelectorAll('.ar-topic[data-cat]').forEach(btn => {
    btn.addEventListener('click', () => setCategory(btn.dataset.cat, true));
  });
}

/* ══════════════════════════════════════════════════════════════
   全部文章：篩選 + 分頁
══════════════════════════════════════════════════════════════ */
function filtered() {
  return currentCat === 'all' ? allArticles : allArticles.filter(a => a.category === currentCat);
}

function renderList() {
  if (!gridEl) return;
  const list  = filtered();
  const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  currentPage = Math.min(Math.max(1, currentPage), pages);

  if (!list.length) {
    gridEl.innerHTML = `<p class="ar-empty">${allArticles.length ? '此分類目前沒有文章' : '文章即將上線，敬請期待。'}</p>`;
    renderPager(0);
    return;
  }

  const start = (currentPage - 1) * PAGE_SIZE;
  gridEl.innerHTML = list.slice(start, start + PAGE_SIZE).map(articleCard).join('');
  renderPager(pages);
}

function articleCard(a) {
  const href = `article.html?id=${encodeURIComponent(a.id)}`;
  const tags = (Array.isArray(a.tags) ? a.tags : []).slice(0, 3);
  return `
    <article class="ar-card">
      <a class="ar-card-img" href="${href}" tabindex="-1" aria-hidden="true">
        <img src="${esc(a.coverImage || PLACEHOLDER_IMG)}" alt="" loading="lazy">
      </a>
      <p class="ar-meta">
        ${a.category ? `<span>${esc(catLabel(a.category))}</span>` : ''}
        <span>${fmtDate(a.createdAt)}</span>
      </p>
      <h3><a href="${href}">${esc(a.title || '（無標題）')}</a></h3>
      ${a.excerpt ? `<p class="ar-card-excerpt">${esc(a.excerpt)}</p>` : ''}
      ${tags.length ? `<div class="ar-tags">${tags.map(t => `<span>${esc(t)}</span>`).join('')}</div>` : ''}
      <a class="ar-more" href="${href}">繼續閱讀</a>
    </article>`;
}

/* 分頁：只有 1 頁時整個隱藏 */
function renderPager(pages) {
  if (!pagerEl) return;
  if (pages <= 1) { pagerEl.hidden = true; pagerEl.innerHTML = ''; return; }

  pagerEl.hidden = false;
  const nums = Array.from({ length: pages }, (_, i) => i + 1);
  pagerEl.innerHTML = `
    <button type="button" class="ar-page-arrow" data-page="${currentPage - 1}" aria-label="上一頁" ${currentPage === 1 ? 'disabled' : ''}>←</button>
    ${nums.map(n => `
      <button type="button" class="ar-page-num${n === currentPage ? ' active' : ''}" data-page="${n}"
        ${n === currentPage ? 'aria-current="page"' : ''}>${n}</button>`).join('')}
    <button type="button" class="ar-page-arrow" data-page="${currentPage + 1}" aria-label="下一頁" ${currentPage === pages ? 'disabled' : ''}>→</button>`;

  pagerEl.querySelectorAll('button[data-page]').forEach(btn => {
    btn.addEventListener('click', () => {
      const n = Number(btn.dataset.page);
      if (!n || n === currentPage) return;
      currentPage = n;
      renderList();
      allSect?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

/* ── Skeleton ── */
function skeletons(n) {
  return Array(n).fill(0).map(() => `
    <div class="ar-card">
      <div class="ar-card-img ar-skel"></div>
      <div class="ar-skel" style="height:12px;width:40%;margin:20px 0 14px"></div>
      <div class="ar-skel" style="height:22px;width:80%;margin-bottom:14px"></div>
      <div class="ar-skel" style="height:12px;width:90%"></div>
    </div>`).join('');
}

/* ── 啟動 ── */
init();
