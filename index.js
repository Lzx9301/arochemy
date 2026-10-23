
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

const CAT = { single:'單方精油', compound:'複方精油', spray:'噴霧', massage:'按摩油', 'eye-mask':'眼罩', diffuser:'擴香瓶' };

const FALLBACK_HTML = {
  heroMedia:     `<video autoplay muted loop playsinline preload="auto">
          <source src="images/hero-bg.mp4" type="video/mp4">
        </video>`,
  heroTitle:     '把臺灣森林，帶進你的日常',
  heroSubtitle:  `真正動人的香氣，<br>
          不需要來自遙遠的國度，<br>
          它一直共存在這座島嶼。`,
  featuredTitle: '臺灣森林系列',
  featuredDesc:  `小小多山的島嶼，<br>
          不只住著 2300 萬的人類，<br>
          更滋養了上萬種的植物。<br><br>
          我們把植物能量保留於瓶中，<br>
          陪伴您的每一個呼吸。`,
  brandTitle:    '以植物香氣，認識臺灣',
  brandBody:     `AROCHEMY 希望讓臺灣的植物，不再只是圖鑑裡叫得出名字的物種，
而是能被聞見、被理解，也被記得的存在。
我們從氣味出發，重新靠近植物，也重新認識腳下的這座島嶼。`,
};

let homepagePromise = null;
function getHomepage() {
  if (!homepagePromise) homepagePromise = getDoc(doc(db, 'settings', 'homepage'));
  return homepagePromise;
}

function setFallback(id) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = FALLBACK_HTML[id];
}

async function init() {
  await Promise.all([
    loadSettings(),
    loadFeaturedProducts(),
    loadLatestArticles(),
  ]);
  initFeaturedSlider();
  initSocialLinks();
}

async function loadSettings() {
  try {
    const homeSnap = await getHomepage();

    const home = homeSnap.exists() ? homeSnap.data() : {};

    if (home.heroTitle)    setText('heroTitle',     home.heroTitle);
    else                   setFallback('heroTitle');
    if (home.heroSubtitle) setText('heroSubtitle',  home.heroSubtitle);
    else                   setFallback('heroSubtitle');

    if (home.heroMedia?.url) {
      const media = document.getElementById('heroMedia');
      if (media) {
        media.innerHTML = home.heroMedia.type === 'video'
          ? `<video autoplay muted loop playsinline preload="auto" style="width:100%;height:100%;object-fit:cover">
               <source src="${esc(home.heroMedia.url)}" type="video/mp4">
             </video>`
          : `<img src="${esc(home.heroMedia.url)}" alt="" style="width:100%;height:100%;object-fit:cover">`;
      }
    } else {
      setFallback('heroMedia');
    }

    if (home.brandTitle)    setText('featuredTitle', home.brandTitle);
    else                    setFallback('featuredTitle');
    if (home.featuredDesc)  setText('featuredDesc',  home.featuredDesc);
    else                    setFallback('featuredDesc');

    if (home.brandTitle) setText('brandTitle', home.brandTitle);
    else                 setFallback('brandTitle');
    if (home.brandBody)  setText('brandBody',  home.brandBody);
    else                 setFallback('brandBody');

  } catch (e) {
    console.warn('[index] loadSettings error:', e.message);
    ['heroMedia', 'heroTitle', 'heroSubtitle', 'featuredTitle', 'featuredDesc', 'brandTitle', 'brandBody'].forEach(setFallback);
  }
}

async function loadFeaturedProducts() {
  const track = document.getElementById('featuredGrid');
  if (!track) return;

  track.innerHTML = '<div style="padding:40px;color:#999">載入中...</div>';

  try {
    let products = [];

    const homeSnap = await getHomepage();
    const featuredIds = homeSnap.exists() ? (homeSnap.data().featuredProductIds || []) : [];

    if (featuredIds.length) {
      const snaps = await Promise.all(
        featuredIds.slice(0, 5).map(id => getDoc(doc(db, 'products', id)))
      );
      products = snaps
        .filter(s => s.exists() && s.data().status === 'active')
        .map(s => ({ id: s.id, ...s.data() }));
    }

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
      const img      = p.images?.[0] || '';

      return `
        <a class="hp-prod-card" href="product.html?id=${esc(p.id)}">
          <div class="hp-prod-card-img">
            ${img ? `<img src="${esc(img)}" alt="${esc(p.name)}" loading="lazy">` : '🌿'}
          </div>
          <div class="hp-prod-card-body">
            ${p.category ? `<div class="hp-prod-card-cat">${esc(CAT[p.category] || p.category)}</div>` : ''}
            <div class="hp-prod-card-name">${esc(p.name)}</div>
          </div>
        </a>`;
    }).join('');

  } catch (e) {
    console.warn('[index] loadFeaturedProducts error:', e.message);
    track.innerHTML = '<div style="padding:40px;color:#999">資料載入失敗，請稍後再試</div>';
  }
}

function initFeaturedSlider() {
  const section = document.getElementById('featured');
  const track   = document.getElementById('featuredGrid');
  const left    = document.getElementById('featuredLeft');
  const prevBtn = document.getElementById('featuredPrev');
  const nextBtn = document.getElementById('featuredNext');
  if (!track || !section) return;

  const TRACK_PAD = 64 + 120;

  let collapsed = false;
  let offset    = 0;
  let leftW     = 320;

  function measureLeftWidth() {
    if (left && !left.classList.contains('collapsed') && left.offsetWidth > 0) {
      leftW = left.offsetWidth;
    }
  }
  measureLeftWidth();

  function getCardW() {
    const card = track.querySelector('.hp-prod-card');
    if (!card) return 220;
    return card.offsetWidth + 20;
  }

  function getMaxOffset(willCollapse) {
    const cards  = track.querySelectorAll('.hp-prod-card');
    const cardW  = getCardW();
    const viewW  = section.offsetWidth - (willCollapse ? 0 : leftW) - TRACK_PAD;
    const visible = Math.max(1, Math.floor(viewW / cardW));
    return Math.max(0, cards.length - visible);
  }

  function render() {
    const cardW = getCardW();
    track.style.transform = `translateX(-${(collapsed ? offset : 0) * cardW}px)`;

    if (left)    left.classList.toggle('collapsed', collapsed);
    if (prevBtn) prevBtn.classList.toggle('visible', collapsed);

    const maxOffset = getMaxOffset(collapsed);
    track.classList.toggle('fit-all', collapsed && maxOffset === 0);

    if (nextBtn) {
      const atEnd = collapsed && offset >= maxOffset;
      nextBtn.style.opacity = atEnd ? '0.3' : '1';
      nextBtn.style.pointerEvents = atEnd ? 'none' : '';
    }
  }

  function next() {
    collapsed = true;
    const max = getMaxOffset(true);
    offset = Math.min(offset + 1, max);
    render();
  }

  function prev() {
    if (collapsed && offset > 0) {
      offset -= 1;
    } else if (collapsed) {
      collapsed = false;
      offset = 0;
    }
    render();
  }

  prevBtn?.addEventListener('click', prev);
  nextBtn?.addEventListener('click', next);

  let startX = 0;
  track.addEventListener('touchstart', e => { startX = e.touches[0].clientX; }, { passive: true });
  track.addEventListener('touchend', e => {
    const diff = startX - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) (diff > 0 ? next() : prev());
  }, { passive: true });

  let isDragging = false, dragStartX = 0;
  track.addEventListener('mousedown', e => {
    isDragging = true; dragStartX = e.clientX;
    track.style.transition = 'none';
  });
  window.addEventListener('mouseup', e => {
    if (!isDragging) return;
    isDragging = false;
    track.style.transition = '';
    const diff = dragStartX - e.clientX;
    if (Math.abs(diff) > 60) (diff > 0 ? next() : prev());
  });

  window.addEventListener('resize', () => {
    if (!collapsed) measureLeftWidth();
    if (collapsed) offset = Math.min(offset, getMaxOffset(true));
    render();
  });
}

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

    if (!latest.length) {
      grid.innerHTML = '<p class="muted">目前沒有文章</p>';
      return;
    }

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
    grid.innerHTML = '<p class="muted">資料載入失敗，請稍後再試</p>';
  }
}

function initSocialLinks() {}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

init();
