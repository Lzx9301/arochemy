/**
 * Arochemy — index.js（重設計版）
 * 首頁動態化：精選產品、最新文章、設定讀取
 */

import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getFirestore, doc, getDoc, collection, getDocs }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

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

const esc = s => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

function toDate(ts) {
  if (!ts) return new Date(0);
  if (ts.toDate) return ts.toDate();
  if (ts.seconds) return new Date(ts.seconds * 1000);
  return new Date(ts);
}

const CAT = { single:'單方精油', compound:'複方精油', spray:'噴霧', massage:'按摩油', 'eye-mask':'眼罩' };

/* ══ 初始化 ════════════════════════════════════════════════ */
async function init() {
  await Promise.all([
    loadSettings(),
    loadFeaturedProducts(),
    loadLatestArticles(),
  ]);
  initFeaturedSlider();
  initSocialLinks();
}

/* ══ 讀取設定（Hero 文字、社群連結）══════════════════════ */
async function loadSettings() {
  try {
    const [homeSnap, siteSnap] = await Promise.all([
      getDoc(doc(db, 'settings', 'homepage')),
      getDoc(doc(db, 'settings', 'site')),
    ]);

    const home = homeSnap.exists() ? homeSnap.data() : {};
    const site = siteSnap.exists() ? siteSnap.data() : {};

    // Hero 文字
    if (home.heroKicker)   setText('heroKicker',   home.heroKicker);
    if (home.heroTitle)    setText('heroTitle',     home.heroTitle);
    if (home.heroSubtitle) setText('heroSubtitle',  home.heroSubtitle);
    if (home.heroBtnText)  { const el = document.getElementById('heroBtnPrimary'); if (el) el.textContent = home.heroBtnText; }

    // Hero 媒體
    if (home.heroMedia?.url) {
      const media = document.getElementById('heroMedia');
      if (media) {
        media.innerHTML = home.heroMedia.type === 'video'
          ? `<video autoplay muted loop playsinline preload="auto" style="width:100%;height:100%;object-fit:cover">
               <source src="${esc(home.heroMedia.url)}" type="video/mp4">
             </video>`
          : `<img src="${esc(home.heroMedia.url)}" alt="" style="width:100%;height:100%;object-fit:cover">`;
      }
    }

    // 精選系列文字
    if (home.brandTitle)    setText('featuredTitle', home.brandTitle);
    if (home.featuredDesc)  setText('featuredDesc',  home.featuredDesc);

    // 品牌故事
    if (home.brandTitle) setText('brandTitle', home.brandTitle);
    if (home.brandBody)  setText('brandBody',  home.brandBody);

    // 社群連結
    if (site.socialIG)   { const el = document.getElementById('social-ig-btn');   if (el) el.href = site.socialIG; }
    if (site.socialLine) { const el = document.getElementById('social-line-btn'); if (el) el.href = site.socialLine; }
    if (site.contactAddress) {
      const el = document.getElementById('footer-address');
      if (el) el.textContent = '地址：' + site.contactAddress;
    }

  } catch (e) {
    console.warn('[index] loadSettings error:', e.message);
  }
}

/* ══ 精選產品（最多 5 個）══════════════════════════════════ */
async function loadFeaturedProducts() {
  const track = document.getElementById('featuredGrid');
  if (!track) return;

  // skeleton
  track.innerHTML = [1,2,3,4,5].map(() => `
    <div class="hp-prod-card" style="opacity:0.4;animation:pulse 1.4s infinite">
      <div class="hp-prod-card-img"></div>
      <div class="hp-prod-card-body">
        <div style="height:10px;background:#ddd;border-radius:4px;width:50%;margin-bottom:8px"></div>
        <div style="height:14px;background:#ddd;border-radius:4px;width:80%"></div>
      </div>
    </div>`).join('');

  try {
    let products = [];

    // 嘗試讀後台設定的 featuredProductIds
    const homeSnap = await getDoc(doc(db, 'settings', 'homepage'));
    const featuredIds = homeSnap.exists() ? (homeSnap.data().featuredProductIds || []) : [];

    if (featuredIds.length) {
      const snaps = await Promise.all(
        featuredIds.slice(0, 5).map(id => getDoc(doc(db, 'products', id)))
      );
      products = snaps
        .filter(s => s.exists() && s.data().status === 'active')
        .map(s => ({ id: s.id, ...s.data() }));
    }

    // fallback：讀全部 active，優先 featured:true
    if (!products.length) {
      const snap = await getDocs(collection(db, 'products'));
      const all = [];
      snap.forEach(d => {
        if (d.data().status === 'active') all.push({ id: d.id, ...d.data() });
      });
      all.sort((a, b) => {
        if (a.featured && !b.featured) return -1;
        if (!a.featured && b.featured) return 1;
        return toDate(b.createdAt) - toDate(a.createdAt);
      });
      products = all.slice(0, 5);
    }

    if (!products.length) {
      track.innerHTML = '<div style="padding:40px;color:#999">精選產品即將上線</div>';
      return;
    }

    track.innerHTML = products.map(p => {
      const specs    = p.specs || {};
      const SIZES    = ['5ml','10ml','30ml'];
      const enabled  = SIZES.filter(s => specs[s]?.enabled && specs[s]?.price);
      const minPrice = enabled.length ? Math.min(...enabled.map(s => Number(specs[s].price))) : 0;
      const img      = p.images?.[0] || '';

      return `
        <a class="hp-prod-card" href="product.html?id=${esc(p.id)}">
          <div class="hp-prod-card-img">
            ${img ? `<img src="${esc(img)}" alt="${esc(p.name)}" loading="lazy">` : '🌿'}
          </div>
          <div class="hp-prod-card-body">
            ${p.category ? `<div class="hp-prod-card-cat">${esc(CAT[p.category] || p.category)}</div>` : ''}
            <div class="hp-prod-card-name">${esc(p.name)}</div>
            ${minPrice ? `<div class="hp-prod-card-price">NT$ ${minPrice.toLocaleString()} 起</div>` : ''}
          </div>
        </a>`;
    }).join('');

  } catch (e) {
    console.warn('[index] loadFeaturedProducts error:', e.message);
    track.innerHTML = '';
  }
}

/* ══ 精選產品輪播（滑動時左側文字淡出）══════════════════ */
function initFeaturedSlider() {
  const track   = document.getElementById('featuredGrid');
  const left    = document.getElementById('featuredLeft');
  const prevBtn = document.getElementById('featuredPrev');
  const nextBtn = document.getElementById('featuredNext');
  if (!track) return;

  const CARD_W = 220; // card width + gap
  let current  = 0;
  let maxSlide = 0;

  function updateMax() {
    const cards = track.querySelectorAll('.hp-prod-card');
    const visible = Math.floor(track.parentElement.offsetWidth / CARD_W);
    maxSlide = Math.max(0, cards.length - visible);
  }

  function slideTo(idx) {
    updateMax();
    current = Math.max(0, Math.min(idx, maxSlide));
    track.style.transform = `translateX(-${current * CARD_W}px)`;

    // 左側文字：滑動後淡出，回到原位時淡入
    if (left) {
      if (current > 0) {
        left.classList.add('hidden');
      } else {
        left.classList.remove('hidden');
      }
    }
  }

  prevBtn?.addEventListener('click', () => slideTo(current - 1));
  nextBtn?.addEventListener('click', () => slideTo(current + 1));

  // 觸控支援
  let startX = 0;
  track.addEventListener('touchstart', e => { startX = e.touches[0].clientX; }, { passive: true });
  track.addEventListener('touchend', e => {
    const diff = startX - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) slideTo(current + (diff > 0 ? 1 : -1));
  }, { passive: true });

  // 拖曳支援
  let isDragging = false, dragStartX = 0;
  track.addEventListener('mousedown', e => { isDragging = true; dragStartX = e.clientX; track.style.transition = 'none'; });
  window.addEventListener('mouseup', e => {
    if (!isDragging) return;
    isDragging = false;
    track.style.transition = '';
    const diff = dragStartX - e.clientX;
    if (Math.abs(diff) > 60) slideTo(current + (diff > 0 ? 1 : -1));
  });

  window.addEventListener('resize', () => slideTo(current));
}

/* ══ 最新文章 ══════════════════════════════════════════════ */
async function loadLatestArticles() {
  const grid = document.getElementById('latestArticles');
  if (!grid) return;

  try {
    const snap = await getDocs(collection(db, 'articles'));
    const articles = [];
    snap.forEach(d => {
      if (d.data().status === 'published') articles.push({ id: d.id, ...d.data() });
    });
    articles.sort((a, b) => toDate(b.createdAt) - toDate(a.createdAt));
    const latest = articles.slice(0, 2);

    if (!latest.length) return;

    grid.innerHTML = latest.map(a => `
      <a class="article-card" href="article.html?id=${esc(a.id)}" style="text-decoration:none;color:inherit;display:block">
        ${a.coverImage ? `
          <div style="height:160px;border-radius:10px;overflow:hidden;margin-bottom:14px">
            <img src="${esc(a.coverImage)}" alt="${esc(a.title)}" style="width:100%;height:100%;object-fit:cover" loading="lazy">
          </div>` : ''}
        <div class="article-title">${esc(a.title || '')}</div>
        <div class="article-meta muted">${toDate(a.createdAt).toLocaleDateString('zh-TW')}</div>
        ${a.excerpt ? `<p class="article-excerpt muted">${esc(a.excerpt).slice(0,80)}…</p>` : ''}
      </a>`).join('');
  } catch (e) {
    console.warn('[index] loadLatestArticles error:', e.message);
  }
}

/* ══ 社群連結（已在 loadSettings 處理，這裡備用）══════════ */
function initSocialLinks() {}

/* ── 工具 ── */
function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

/* ── 啟動 ── */
init();
