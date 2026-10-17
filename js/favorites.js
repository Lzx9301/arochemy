/**
 * Arochemy — js/favorites.js
 * 購物車頁的「我的收藏」區塊。
 *
 * 收藏資料沿用商品頁既有的機制：瀏覽器 localStorage 的 'arochemy_favs'（商品 ID 陣列）。
 * - 商品頁按愛心 → 寫入／移除 ID（js/product-page.js，未修改）
 * - 這裡讀取同一份 ID，從 Firestore 取得商品圖片、名稱、價格後顯示
 * - 在這裡取消收藏 → 從同一份資料移除，回到商品頁時愛心狀態會一致
 * 注意：資料存在使用者自己的瀏覽器，重新整理不會消失，但換裝置或清除瀏覽資料後不會保留。
 */

import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getFirestore, doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

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

const FAV_KEY    = 'arochemy_favs';           // 與 js/product-page.js 相同
const SPEC_SIZES = ['5ml', '10ml', '30ml', '50ml', '100ml'];

const esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

function getFavs() {
  try { const v = JSON.parse(localStorage.getItem(FAV_KEY) || '[]'); return Array.isArray(v) ? v : []; }
  catch { return []; }
}
function saveFavs(ids) {
  try { localStorage.setItem(FAV_KEY, JSON.stringify(ids)); } catch {}
}

/* 價格：取已啟用規格的價格；有多種價格時顯示最低價「起」 */
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
const cache   = new Map();   // 商品資料快取，取消收藏時不用重新讀取

async function loadProduct(id) {
  if (cache.has(id)) return cache.get(id);
  let data = null;
  try {
    const snap = await getDoc(doc(db, 'products', id));
    data = snap.exists() ? { id: snap.id, ...snap.data() } : null;
  } catch (e) {
    console.warn('[favorites] 讀取商品失敗：', id, e.message);
    data = undefined; // 讀取失敗（不是商品不存在），不要從收藏移除
  }
  cache.set(id, data);
  return data;
}

async function render() {
  if (!gridEl) return;
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

  gridEl.innerHTML = `<p class="muted fav-loading">收藏商品載入中…</p>`;
  const list = await Promise.all(ids.map(loadProduct));

  // 已經被刪除的商品自動從收藏移除
  const missing = ids.filter((id, i) => list[i] === null);
  if (missing.length) saveFavs(ids.filter(id => !missing.includes(id)));

  const items = list.filter(Boolean);
  if (countEl) countEl.textContent = items.length ? `${items.length} 件` : '';

  if (!items.length) {
    gridEl.innerHTML = `
      <div class="fav-empty">
        <p>收藏的商品暫時無法顯示，請稍後再試。</p>
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

// 其他分頁（例如另開的商品頁）改了收藏，這裡同步更新
window.addEventListener('storage', e => { if (e.key === FAV_KEY) render(); });

render();
