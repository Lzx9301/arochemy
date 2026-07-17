/**
 * Arochemy — index.js
 * 首頁動態化：從 Firestore 讀取精選產品、首頁設定、最新文章
 */

import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getFirestore,
         doc, getDoc,
         collection, getDocs,
         query, where, orderBy, limit }
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

/* ══════════════════════════════════════════════════════════════
   主入口
══════════════════════════════════════════════════════════════ */
async function init() {
  await Promise.all([
    loadHomepageSettings(),
    loadFeaturedProducts(),
    loadLatestArticles(),
  ]);
}

/* ══════════════════════════════════════════════════════════════
   首頁設定（Hero 文字、品牌故事、FAQ、社群連結）
══════════════════════════════════════════════════════════════ */
async function loadHomepageSettings() {
  try {
    const [homeSnap, siteSnap] = await Promise.all([
      getDoc(doc(db, 'settings', 'homepage')),
      getDoc(doc(db, 'settings', 'site')),
    ]);

    const home = homeSnap.exists() ? homeSnap.data() : {};
    const site = siteSnap.exists() ? siteSnap.data() : {};

    /* ── Hero 文字 ── */
    if (home.heroTitle)    { const el = document.getElementById('heroTitle');    if (el) el.textContent = home.heroTitle; }
    if (home.heroSubtitle) { const el = document.getElementById('heroSubtitle'); if (el) el.textContent = home.heroSubtitle; }
    if (home.heroKicker)   { const el = document.getElementById('heroKicker');   if (el) el.textContent = home.heroKicker; }
    if (home.heroBtnText)  { const el = document.getElementById('heroBtnPrimary'); if (el) { el.textContent = home.heroBtnText; if (home.heroBtnLink) el.href = home.heroBtnLink; } }

    /* ── Hero 媒體（圖片或影片）── */
    const mediaEl = document.getElementById('heroMedia');
    if (mediaEl && home.heroMedia) {
      const m = home.heroMedia;
      if (m.type === 'video' && m.url) {
        mediaEl.innerHTML = `
          <video autoplay muted loop playsinline preload="auto"
                 style="width:100%;height:100%;object-fit:cover">
            <source src="${esc(m.url)}" type="video/mp4">
          </video>`;
      } else if (m.url) {
        mediaEl.innerHTML = `
          <img src="${esc(m.url)}" alt="Arochemy" loading="eager"
               style="width:100%;height:100%;object-fit:cover">`;
      }
    } else if (mediaEl) {
      // 預設：嘗試載入 hero-oil.jpg
      mediaEl.innerHTML = `<img src="images/hero-oil.jpg" alt="Arochemy" loading="eager"
        style="width:100%;height:100%;object-fit:cover"
        onerror="this.parentElement.style.background='linear-gradient(135deg,#2d2417,#1a1208)'">`;
    }

    /* ── 品牌故事 ── */
    if (home.brandTitle) {
      const el = document.querySelector('#story .section-head h2');
      if (el) el.textContent = home.brandTitle;
    }
    if (home.brandBody) {
      // 把品牌故事文字放進第一個 story card
      const el = document.querySelector('#story .story-grid .card:first-child p');
      if (el) el.textContent = home.brandBody;
    }

    /* ── FAQ ── */
    if (home.faqs && home.faqs.length) {
      const container = document.querySelector('#contact .card:last-child');
      if (container) {
        const h3 = container.querySelector('h3');
        const faqHtml = home.faqs.map(f => `
          <details>
            <summary>Q：${esc(f.q)}</summary>
            <p class="muted">A：${esc(f.a)}</p>
          </details>
        `).join('');
        container.innerHTML = (h3 ? h3.outerHTML : '<h3>FAQ</h3>') + faqHtml;
      }
    }

    /* ── 聯絡資訊 ── */
    if (site.contactEmail || site.contactPhone) {
      const contactCard = document.querySelector('#contact .card:first-child');
      if (contactCard) {
        const lines = [];
        if (site.contactEmail) lines.push(`Email：${site.contactEmail}`);
        if (site.contactPhone) lines.push(`電話：${site.contactPhone}`);
        if (site.contactAddress) lines.push(`地址：${site.contactAddress}`);
        const paras = contactCard.querySelectorAll('p.muted');
        lines.forEach((line, i) => {
          if (paras[i]) paras[i].textContent = line;
        });
      }
    }

    /* ── 社群連結（Floating Button）── */
    if (site.socialIG) {
      const igBtn = document.querySelector('.fab.ig');
      if (igBtn) igBtn.href = site.socialIG;
    }
    if (site.socialLine) {
      const lineBtn = document.querySelector('.fab.line');
      if (lineBtn) lineBtn.href = site.socialLine;
      // 也更新 contact 區塊的 LINE 按鈕
      const lineContactBtn = document.querySelector('#contact .btn.primary[href*="line"]');
      if (lineContactBtn) lineContactBtn.href = site.socialLine;
    }

  } catch (e) {
    console.warn('[index] loadHomepageSettings error:', e.message);
  }
}

/* ══════════════════════════════════════════════════════════════
   精選產品（featured: true 的商品，最多 3 個）
══════════════════════════════════════════════════════════════ */
async function loadFeaturedProducts() {
  const grid = document.getElementById('featuredGrid');
  if (!grid) return;

  // 先顯示 skeleton
  grid.innerHTML = [1,2,3].map(() => `
    <div class="article-card" style="animation:pulse 1.4s infinite">
      <div style="height:180px;background:#f0f0f0;border-radius:8px;margin-bottom:12px"></div>
      <div style="height:16px;background:#f0f0f0;border-radius:4px;width:80%;margin-bottom:8px"></div>
      <div style="height:14px;background:#f0f0f0;border-radius:4px;width:50%"></div>
    </div>
  `).join('');

  try {
    // 先嘗試讀 featured:true 的商品
    let products = [];

    // 抓 homepage settings 裡儲存的 featuredProductIds
    const homeSnap = await getDoc(doc(db, 'settings', 'homepage'));
    const featuredIds = homeSnap.exists() ? (homeSnap.data().featuredProductIds || []) : [];

    if (featuredIds.length) {
      // 用 id 直接抓（最精準）
      const snaps = await Promise.all(
        featuredIds.slice(0,5).map(id => getDoc(doc(db, 'products', id)))
      );
      products = snaps
        .filter(s => s.exists() && s.data().status === 'active')
        .map(s => ({ id: s.id, ...s.data() }));
    }

    // 若沒有設定 featuredProductIds，fallback 到讀全部 active 取前3
    if (!products.length) {
      const snap = await getDocs(collection(db, 'products'));
      const all = [];
      snap.forEach(d => {
        const p = d.data();
        if (p.status === 'active') all.push({ id: d.id, ...p });
      });
      // 優先 featured:true，否則按時間排序取前3
      all.sort((a, b) => {
        if (a.featured && !b.featured) return -1;
        if (!a.featured && b.featured) return 1;
        return toDate(b.createdAt) - toDate(a.createdAt);
      });
      products = all.slice(0, 5);
    }

    if (!products.length) {
      grid.innerHTML = `<p class="muted" style="grid-column:1/-1;text-align:center;padding:40px 0">精選產品即將上線</p>`;
      return;
    }

    grid.innerHTML = products.map(p => featuredCard(p)).join('');
  initFeaturedSlider();

  } catch (e) {
    console.warn('[index] loadFeaturedProducts error:', e.message);
    grid.innerHTML = '<div style="padding:40px 20px;color:#999;text-align:center">產品載入中…</div>';
  }
}

/* ── 精選產品卡片 ── */
function featuredCard(p) {
  const specs    = p.specs || {};
  const SIZES    = ['5ml','10ml','30ml'];
  const enabled  = SIZES.filter(s => specs[s]?.enabled && specs[s]?.price);
  const minPrice = enabled.length ? Math.min(...enabled.map(s => Number(specs[s].price))) : 0;
  const img      = p.images?.[0] || '';
  const CAT      = { single:'單方精油', compound:'複方精油', spray:'噴霧', massage:'按摩油', 'eye-mask':'眼罩' };

  return `
    <a class="featured-card" href="product.html?id=${esc(p.id)}">
      <div class="featured-card-img">
        ${img
          ? `<img src="${esc(img)}" alt="${esc(p.name)}" loading="lazy">`
          : '🌿'}
      </div>
      <div class="featured-card-body">
        ${p.category ? `<div class="featured-card-cat">${esc(CAT[p.category] || p.category)}</div>` : ''}
        <div class="featured-card-name">${esc(p.name)}</div>
        ${minPrice ? `<div class="featured-card-price">NT$ ${minPrice.toLocaleString()} 起</div>` : ''}
      </div>
    </a>`;
}

/* ── 精選產品輪播 ── */
function initFeaturedSlider() {
  const track   = document.getElementById('featuredGrid');
  const prevBtn = document.getElementById('featuredPrev');
  const nextBtn = document.getElementById('featuredNext');
  if (!track) return;

  const cardWidth = 240; // card + gap
  let current = 0;
  const cards = track.querySelectorAll('.featured-card');
  const max   = Math.max(0, cards.length - 3);

  function slideTo(idx) {
    current = Math.max(0, Math.min(idx, max));
    track.style.transform = `translateX(-${current * cardWidth}px)`;
  }

  prevBtn?.addEventListener('click', () => slideTo(current - 1));
  nextBtn?.addEventListener('click', () => slideTo(current + 1));

  // 觸控滑動支援
  let startX = 0;
  track.addEventListener('touchstart', e => { startX = e.touches[0].clientX; }, { passive: true });
  track.addEventListener('touchend',   e => {
    const diff = startX - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) slideTo(current + (diff > 0 ? 1 : -1));
  }, { passive: true });
}

/* ══════════════════════════════════════════════════════════════
   最新文章（取最新 2 篇 published）
══════════════════════════════════════════════════════════════ */
async function loadLatestArticles() {
  const grid = document.querySelector('#articles .grid-2');
  if (!grid) return;

  try {
    const snap = await getDocs(collection(db, 'articles'));
    const articles = [];
    snap.forEach(d => {
      const a = d.data();
      if (a.status === 'published') articles.push({ id: d.id, ...a });
    });

    // 前端排序，避免 Firestore index 問題
    articles.sort((a, b) => toDate(b.createdAt) - toDate(a.createdAt));
    const latest = articles.slice(0, 2);

    if (!latest.length) return; // 沒有文章就保留靜態內容

    grid.innerHTML = latest.map(a => `
      <a class="article-card" href="article.html?id=${a.id}" style="text-decoration:none;display:block">
        ${a.coverImage ? `
          <div style="height:160px;border-radius:8px;overflow:hidden;margin-bottom:12px">
            <img src="${esc(a.coverImage)}" alt="${esc(a.title)}" style="width:100%;height:100%;object-fit:cover" loading="lazy">
          </div>` : ''}
        <div class="article-title">${esc(a.title || '（無標題）')}</div>
        <div class="article-meta muted">
          ${toDate(a.createdAt).toLocaleDateString('zh-TW')}
          ${a.category ? `｜${esc(a.category)}` : ''}
        </div>
        <p class="article-excerpt muted">${esc(a.excerpt || '').slice(0, 80)}${(a.excerpt||'').length > 80 ? '…' : ''}</p>
      </a>
    `).join('');

  } catch (e) {
    console.warn('[index] loadLatestArticles error:', e.message);
    // 保留靜態內容，不顯示錯誤
  }
}

/* ── 注入精選產品卡片樣式 ── */
const style = document.createElement('style');
style.textContent = `
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
  .featured-product-card { color: inherit; cursor: pointer; }
  .featured-product-card:hover { text-decoration: none; }
  .featured-product-card:hover .article-title { color: #8a6a30; }
  .featured-img-wrap {
    width: 100%;
    aspect-ratio: 4/3;
    border-radius: 10px;
    overflow: hidden;
    background: #f7f5f0;
    margin-bottom: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 40px;
    color: #ccc;
  }
  .featured-img-wrap img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 0.3s;
  }
  .featured-product-card:hover .featured-img-wrap img {
    transform: scale(1.04);
  }
`;
document.head.appendChild(style);

/* ── 啟動 ── */
init();
