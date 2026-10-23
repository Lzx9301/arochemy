
import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getFirestore,
         collection,
         getDocs }         from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey:            'AIzaSyAgRq-fVWsQuyO2odbfVEjgOZoHyACEApI',
  authDomain:        'trying-89dc6.firebaseapp.com',
  projectId:         'trying-89dc6',
  storageBucket:     'trying-89dc6.firebasestorage.app',
  messagingSenderId: '115559148124',
  appId:             '1:115559148124:web:ac37b9c249183a919b5499',
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db  = getFirestore(app);

const CAT_MAP = {
  'all':        null,
  'single-oil': 'single',
  'blend-oil':  'compound',
  'spray':      'spray',
  'massage':    'massage',
  'eyemask':    'eye-mask',
  'diffuser':   'diffuser',
};

const CAT_LABEL = {
  single:    '單方精油',
  compound:  '複方精油',
  spray:     '噴霧',
  massage:   '按摩油',
  'eye-mask':'眼罩',
  diffuser:  '擴香瓶',
};

const SPEC_SIZES = ['5ml', '10ml', '30ml', '50ml', '100ml'];

let allProducts     = [];
let loadState       = 'loading';
let currentCatKey   = 'all';
let currentSortKey  = 'default';

const grid         = document.getElementById('productGrid');
const totalCount   = document.getElementById('totalCount');
const currentCat   = document.getElementById('currentCat');
const catToggle    = document.getElementById('catToggle');
const catMenu      = document.getElementById('catMenu');
const catDropdown  = document.getElementById('catDropdown');
const currentSort  = document.getElementById('currentSort');
const sortToggle   = document.getElementById('sortToggle');
const sortMenu     = document.getElementById('sortMenu');
const sortDropdown = document.getElementById('sortDropdown');

async function init() {
  await loadProducts();
  initCategoryFilter();
  initSortFilter();
  initDropdownClose();
  applyCatFromURL();
}

function applyCatFromURL() {
  const params = new URLSearchParams(window.location.search);
  const catKey = params.get('cat');
  if (!catKey || !(catKey in CAT_MAP)) return;

  const item = catMenu?.querySelector(`.cat-item[data-cat="${catKey}"]`);
  if (!item) return;

  currentCatKey = catKey;
  if (currentCat) currentCat.textContent = item.textContent;

  renderProducts(getFilteredSortedList());
}

function getRepresentativePrice(p) {
  const specs   = p.specs || {};
  const enabled = SPEC_SIZES.filter(s => specs[s]?.enabled && specs[s]?.stock > 0);
  const first   = enabled[0];
  return first ? Number(specs[first].price) || 0 : 0;
}

function applySort(list, sortKey) {
  const sorted = list.slice();
  switch (sortKey) {
    case 'name-asc':
      sorted.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'zh-Hant'));
      break;
    case 'price-asc':
      sorted.sort((a, b) => getRepresentativePrice(a) - getRepresentativePrice(b));
      break;
    case 'price-desc':
      sorted.sort((a, b) => getRepresentativePrice(b) - getRepresentativePrice(a));
      break;
    case 'popular':
      sorted.sort((a, b) => (Number(b.salesCount) || 0) - (Number(a.salesCount) || 0));
      break;
    default:
      break;
  }
  return sorted;
}

function getFilteredSortedList() {
  const firestoreCat = CAT_MAP[currentCatKey];
  const filtered = firestoreCat
    ? allProducts.filter(p => p.category === firestoreCat)
    : allProducts;
  return applySort(filtered, currentSortKey);
}

function initSortFilter() {
  sortToggle?.addEventListener('click', () => {
    const open = sortToggle.getAttribute('aria-expanded') === 'true';
    sortToggle.setAttribute('aria-expanded', !open);
    sortMenu?.classList.toggle('open', !open);
  });

  sortMenu?.querySelectorAll('.cat-item').forEach(item => {
    item.addEventListener('click', () => {
      currentSortKey = item.dataset.sort;
      if (currentSort) currentSort.textContent = item.textContent;
      sortToggle?.setAttribute('aria-expanded', 'false');
      sortMenu?.classList.remove('open');
      renderProducts(getFilteredSortedList());
    });
  });
}

async function loadProducts() {
  loadState = 'loading';
  grid.innerHTML = statusBlock('載入中...');
  if (totalCount) totalCount.textContent = '載入中...';

  try {
    const snap = await getDocs(collection(db, 'products'));
    allProducts = [];
    snap.forEach(d => {
      const p = { id: d.id, ...d.data() };
      if (p.status === 'active') allProducts.push(p);
    });

    allProducts.sort((a, b) => {
      const ta = a.createdAt?.seconds || 0;
      const tb = b.createdAt?.seconds || 0;
      return tb - ta;
    });

    loadState = 'success';
    renderProducts(allProducts);
  } catch (e) {
    loadState = 'error';
    grid.innerHTML = statusBlock('資料載入失敗，請稍後再試');
    if (totalCount) totalCount.textContent = '';
    console.error('loadProducts error:', e);
  }
}

function renderProducts(list) {
  if (loadState !== 'success') return;
  totalCount.textContent = `${list.length} items`;

  if (!list.length) {
    grid.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:60px 0;color:#999">
        <div style="font-size:36px;margin-bottom:12px">🌿</div>
        <p>此分類目前沒有商品</p>
      </div>`;
    return;
  }

  grid.innerHTML = list.map(p => productCard(p)).join('');

  list.forEach(p => bindCardEvents(p));
}

function productCard(p) {
  const specs   = p.specs || {};
  const enabled = SPEC_SIZES.filter(s => specs[s]?.enabled && specs[s]?.stock > 0);
  const defaultSpec = enabled[0] || null;
  const priceSpec   = defaultSpec || SPEC_SIZES.find(s => specs[s]?.enabled) || null;
  const defaultPrice = priceSpec ? specs[priceSpec].price : null;
  const img = p.images?.[0] || '';
  const catName = CAT_LABEL[p.category] || '';

  return `
    <div class="product-card" data-id="${p.id}">
      <a class="product-img-wrap" href="product.html?id=${p.id}" aria-label="${esc(p.name)}">
        ${img
          ? `<img src="${esc(img)}" alt="${esc(p.name)}" class="product-img" loading="lazy">`
          : `<div class="product-img-placeholder">🌿</div>`}
        ${p.featured ? `<span class="product-badge">精選</span>` : ''}
      </a>

      <div class="product-info">
        ${catName ? `<div class="product-cat muted">${catName}</div>` : ''}
        <h3 class="product-name">
          <a href="product.html?id=${p.id}">${esc(p.name)}</a>
        </h3>

        ${p.description
          ? `<p class="product-desc muted">${esc(p.description).slice(0, 60)}${p.description.length > 60 ? '…' : ''}</p>`
          : ''}

        ${enabled.length > 1 ? `
        <div class="spec-selector" data-id="${p.id}">
          ${enabled.map(s => `
            <button
              class="spec-btn ${s === defaultSpec ? 'active' : ''}"
              data-size="${s}"
              data-price="${specs[s].price}"
              data-stock="${specs[s].stock}"
              type="button"
            >${s}</button>
          `).join('')}
        </div>` : enabled.length === 1 ? `
        <div class="spec-single muted">${enabled[0]}</div>
        ` : ''}

        <div class="product-footer">
          <div class="product-price" data-id="${p.id}">
            ${defaultPrice === null || defaultPrice === undefined ? '' : `NT$ ${Number(defaultPrice).toLocaleString()}`}
          </div>
          ${enabled.length
            ? `<button class="btn primary add-cart-btn"
                data-id="${p.id}"
                data-name="${esc(p.name)}"
                data-size="${defaultSpec}"
                data-price="${defaultPrice}"
                data-img="${esc(img)}"
                type="button">
                加入購物車
              </button>`
            : `<span class="sold-out-tag">缺貨</span>`}
        </div>
      </div>
    </div>
  `;
}

function bindCardEvents(p) {
  const card    = document.querySelector(`.product-card[data-id="${p.id}"]`);
  if (!card) return;
  const specs   = p.specs || {};
  const cartBtn = card.querySelector('.add-cart-btn');

  card.querySelectorAll('.spec-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      card.querySelectorAll('.spec-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const size  = btn.dataset.size;
      const price = btn.dataset.price;

      const priceEl = card.querySelector('.product-price');
      if (priceEl) priceEl.textContent = `NT$ ${Number(price).toLocaleString()}`;

      if (cartBtn) {
        cartBtn.dataset.size  = size;
        cartBtn.dataset.price = price;
      }
    });
  });

  cartBtn?.addEventListener('click', () => {
    const size  = cartBtn.dataset.size;
    const price = Number(cartBtn.dataset.price);
    const name  = cartBtn.dataset.name;
    const img   = cartBtn.dataset.img;
    const id    = cartBtn.dataset.id;

    addToCart({ id, name, size, price, img, qty: 1 });

    showCartToast(name, size);

    const orig = cartBtn.textContent;
    cartBtn.textContent = '✓ 已加入';
    cartBtn.disabled = true;
    setTimeout(() => {
      cartBtn.textContent = orig;
      cartBtn.disabled = false;
    }, 1200);
  });
}

function addToCart(item) {
  const cart = getCart();
  const key   = `${item.id}_${item.size}`;
  const exist = cart.find(c => `${c.id}_${c.size}` === key);
  if (exist) {
    exist.qty += 1;
  } else {
    cart.push({ ...item });
  }
  saveCart(cart);
  updateCartBadge(cart);
}

function getCart() {
  try { return JSON.parse(localStorage.getItem('arochemy_cart') || '[]'); }
  catch { return []; }
}

function saveCart(cart) {
  localStorage.setItem('arochemy_cart', JSON.stringify(cart));
}

function updateCartBadge(cart) {
  if (typeof window.updateCartBadge === 'function') {
    window.updateCartBadge();
    return;
  }
  const total = cart.reduce((s, c) => s + c.qty, 0);
  const badge = document.getElementById('cartCount');
  if (badge) badge.textContent = total;
}

function showCartToast(name, size) {
  let toast = document.getElementById('products-cart-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'products-cart-toast';
    toast.style.cssText = `
      position:fixed;right:24px;top:96px;
      width:280px;padding:18px 20px;
      border-radius:20px;background:#fff;color:#333;
      border:1px solid #e8e8e8;
      box-shadow:0 18px 50px rgba(0,0,0,.12);
      z-index:9999;opacity:0;
      transform:translateY(-12px);
      transition:opacity 0.25s ease,transform 0.25s ease;
      pointer-events:none;
    `;
    document.body.appendChild(toast);
  }

  const label = size ? `${name}（${size}）` : name;
  toast.innerHTML = `
    <div style="font-size:14px;font-weight:500;color:#111;margin-bottom:6px">
      <span style="color:#5a8c6a">✓</span> ${esc(label)} 已加入購物車
    </div>
    <a href="cart.html" style="color:#111;font-weight:700;text-decoration:none;font-size:13px;display:inline-block">查看購物車</a>
  `;

  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
    toast.style.pointerEvents = 'auto';
  });

  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-12px)';
    toast.style.pointerEvents = 'none';
  }, 2800);
}

function initCategoryFilter() {
  catToggle?.addEventListener('click', () => {
    const open = catToggle.getAttribute('aria-expanded') === 'true';
    catToggle.setAttribute('aria-expanded', !open);
    catMenu?.classList.toggle('open', !open);
  });

  catMenu?.querySelectorAll('.cat-item').forEach(item => {
    item.addEventListener('click', () => {
      currentCatKey = item.dataset.cat;
      if (currentCat) currentCat.textContent = item.textContent;
      catToggle?.setAttribute('aria-expanded', 'false');
      catMenu?.classList.remove('open');

      renderProducts(getFilteredSortedList());
    });
  });
}

function initDropdownClose() {
  document.addEventListener('click', e => {
    if (catDropdown && !catDropdown.contains(e.target)) {
      catToggle?.setAttribute('aria-expanded', 'false');
      catMenu?.classList.remove('open');
    }
    if (sortDropdown && !sortDropdown.contains(e.target)) {
      sortToggle?.setAttribute('aria-expanded', 'false');
      sortMenu?.classList.remove('open');
    }
  });
}

function statusBlock(text) {
  return `<div style="grid-column:1/-1;text-align:center;padding:60px 0;color:#999"><p>${esc(text)}</p></div>`;
}

function renderSkeletons(n) {
  return Array(n).fill(0).map(() => `
    <div class="product-card skeleton-card">
      <div class="skeleton" style="height:220px;border-radius:12px;margin-bottom:14px"></div>
      <div class="skeleton" style="height:14px;width:40%;margin-bottom:8px"></div>
      <div class="skeleton" style="height:18px;width:80%;margin-bottom:8px"></div>
      <div class="skeleton" style="height:14px;margin-bottom:16px"></div>
      <div class="skeleton" style="height:40px;border-radius:999px"></div>
    </div>
  `).join('');
}

function esc(str) {
  return String(str || '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

updateCartBadge(getCart());

(function injectProductStyles() {
  if (document.getElementById('arochemy-product-styles')) return;
  const style = document.createElement('style');
  style.id = 'arochemy-product-styles';
  style.textContent = `
    .product-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
      gap: 24px;
      padding: 24px 0;
    }
    .product-card {
      background: #fff;
      border: 1px solid #eee;
      border-radius: 16px;
      overflow: hidden;
      transition: box-shadow 0.2s, transform 0.2s;
      display: flex;
      flex-direction: column;
    }
    .product-card:hover {
      box-shadow: 0 8px 32px rgba(0,0,0,0.10);
      transform: translateY(-2px);
    }
    .product-img-wrap {
      display: block;
      position: relative;
      aspect-ratio: 1 / 1;
      overflow: hidden;
      background: #f7f5f0;
      text-decoration: none;
    }
    .product-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transition: transform 0.3s;
    }
    .product-card:hover .product-img {
      transform: scale(1.04);
    }
    .product-img-placeholder {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 48px;
      color: #ccc;
    }
    .product-badge {
      position: absolute;
      top: 10px;
      left: 10px;
      background: #b8975a;
      color: #fff;
      font-size: 11px;
      font-weight: 700;
      padding: 3px 10px;
      border-radius: 999px;
      letter-spacing: 0.05em;
    }
    .product-info {
      padding: 16px;
      display: flex;
      flex-direction: column;
      flex: 1;
      gap: 6px;
    }
    .product-cat {
      font-size: 11px;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: #999;
    }
    .product-name {
      font-size: 16px;
      font-weight: 600;
      margin: 0;
      line-height: 1.4;
    }
    .product-name a {
      color: inherit;
      text-decoration: none;
    }
    .product-name a:hover { color: #b8975a; }
    .product-desc {
      font-size: 13px;
      color: #888;
      margin: 0;
      line-height: 1.5;
    }
    .spec-selector {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      margin: 4px 0;
    }
    .spec-btn {
      padding: 4px 12px;
      border: 1px solid #ddd;
      border-radius: 999px;
      background: #fff;
      font-size: 12px;
      cursor: pointer;
      transition: all 0.15s;
      font-family: inherit;
    }
    .spec-btn.active, .spec-btn:hover {
      border-color: #111;
      background: #111;
      color: #fff;
    }
    .spec-single { font-size: 12px; color: #999; }
    .product-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-top: auto;
      padding-top: 12px;
      border-top: 1px solid #f0f0f0;
    }
    .product-price {
      font-size: 17px;
      font-weight: 700;
      color: #111;
      letter-spacing: 0.02em;
    }
    .add-cart-btn {
      padding: 8px 16px;
      font-size: 13px;
      font-weight: 600;
      border: none;
      border-radius: 999px;
      background: #111;
      color: #fff;
      cursor: pointer;
      transition: background 0.15s;
      white-space: nowrap;
      font-family: inherit;
    }
    .add-cart-btn:hover { background: #b8975a; }
    .add-cart-btn:disabled { opacity: 0.6; cursor: default; }
    .sold-out-tag {
      font-size: 12px;
      color: #bbb;
      border: 1px solid #eee;
      border-radius: 999px;
      padding: 6px 14px;
    }
    .skeleton-card { border-radius: 16px; overflow: hidden; }
    @media (max-width: 600px) {
      .product-grid {
        grid-template-columns: repeat(2, 1fr);
        gap: 12px;
      }
      .product-info { padding: 12px; }
      .product-name { font-size: 14px; }
      .add-cart-btn { padding: 7px 12px; font-size: 12px; }
    }
  `;
  document.head.appendChild(style);
})();

init();
