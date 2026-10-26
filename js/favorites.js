
import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getFirestore, doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { getFavs as storeGetFavs, saveFavs as storeSaveFavs, favKey, ownerReady, onOwnerChange } from './cart-store.js';

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

const SPEC_SIZES = ['5ml', '10ml', '30ml', '50ml', '100ml'];

const esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

function getFavs() {
  return storeGetFavs();
}
function saveFavs(ids) {
  storeSaveFavs(ids);
}

function priceText(p) {
  const specs  = p.specs || {};
  const prices = SPEC_SIZES
    .filter(s => specs[s]?.enabled && Number(specs[s]?.price) > 0)
    .map(s => Number(specs[s].price));
  if (!prices.length) return '';
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return `NT$ ${min.toLocaleString()}${max > min ? ' 起' : ''}`;
}

const gridEl  = document.getElementById('favGrid');
const countEl = document.getElementById('favCount');
const cache   = new Map();

async function loadProduct(id) {
  if (cache.has(id)) return cache.get(id);
  let data = null;
  try {
    const snap = await getDoc(doc(db, 'products', id));
    data = snap.exists() ? { id: snap.id, ...snap.data() } : null;
  } catch (e) {
    console.warn('[favorites] 讀取商品失敗：', id, e.message);
    return undefined;
  }
  cache.set(id, data);
  return data;
}

let renderSeq = 0;

async function render() {
  if (!gridEl) return;
  const seq = ++renderSeq;
  const ids = getFavs();

  if (!ids.length) {
    if (countEl) countEl.textContent = '';
    gridEl.innerHTML = `
      <div class="fav-empty">
        <p>目前還沒有收藏的商品。</p>
        <p class="muted">在商品頁點選「♡ 收藏」，就會出現在這裡。</p>
        <a class="btn" href="products.html">去逛逛商品</a>
      </div>`;
    return;
  }

  gridEl.innerHTML = `<p class="muted fav-loading">載入中...</p>`;
  if (countEl) countEl.textContent = '';
  const list = await Promise.all(ids.map(loadProduct));
  if (seq !== renderSeq) return;

  const missing = ids.filter((id, i) => list[i] === null);
  if (missing.length) saveFavs(ids.filter(id => !missing.includes(id)));

  const items = list.filter(Boolean);
  if (countEl) countEl.textContent = items.length ? `${items.length} 件` : '';

  if (!items.length) {
    const failed = list.some(x => x === undefined);
    gridEl.innerHTML = failed
      ? `<div class="fav-empty"><p>資料載入失敗，請稍後再試</p></div>`
      : `<div class="fav-empty">
          <p>目前還沒有收藏的商品。</p>
          <p class="muted">在商品頁點選「♡ 收藏」，就會出現在這裡。</p>
          <a class="btn" href="products.html">去逛逛商品</a>
        </div>`;
    return;
  }

  gridEl.innerHTML = items.map(p => {
    const href   = `product.html?id=${encodeURIComponent(p.id)}`;
    const img    = Array.isArray(p.images) ? p.images[0] : '';
    const offline = p.status !== 'active';
    return `
      <article class="fav-card${offline ? ' is-offline' : ''}">
        <a class="fav-img" href="${href}" tabindex="-1" aria-hidden="true">
          ${img ? `<img src="${esc(img)}" alt="" loading="lazy">` : '<span>🌿</span>'}
        </a>
        <div class="fav-body">
          <a class="fav-name" href="${href}">${esc(p.name || '商品')}</a>
          <div class="fav-price">${offline ? '目前未販售' : esc(priceText(p))}</div>
          <a class="fav-view" href="${href}">查看商品</a>
        </div>
        <button type="button" class="fav-remove" data-id="${esc(p.id)}" aria-label="取消收藏「${esc(p.name || '商品')}」" title="取消收藏">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path d="M12 20.5 4.6 13.3a4.6 4.6 0 0 1 0-6.6 4.7 4.7 0 0 1 6.6 0l.8.8.8-.8a4.7 4.7 0 0 1 6.6 0 4.6 4.6 0 0 1 0 6.6z"
              fill="currentColor" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>
          </svg>
        </button>
      </article>`;
  }).join('');

  gridEl.querySelectorAll('.fav-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      saveFavs(getFavs().filter(id => id !== btn.dataset.id));
      render();
    });
  });
}

window.addEventListener('storage', e => { if (e.key && e.key === favKey()) render(); });

ownerReady.then(render);
onOwnerChange(render);
