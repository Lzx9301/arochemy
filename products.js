/**
 * Arochemy — js/products.js
 * 從 Firestore 讀取產品，渲染商品卡片，支援分類篩選、規格選擇、加入購物車
 */

import { initializeApp }   from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getFirestore,
         collection,
         getDocs }         from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

/* ── Firebase ──────────────────────────────────────────────── */
const firebaseConfig = {
  apiKey:            'AIzaSyAgRq-fVWsQuyO2odbfVEjgOZoHyACEApI',
  authDomain:        'trying-89dc6.firebaseapp.com',
  projectId:         'trying-89dc6',
  storageBucket:     'trying-89dc6.firebasestorage.app',
  messagingSenderId: '115559148124',
  appId:             '1:115559148124:web:ac37b9c249183a919b5499',
};

// 避免重複初始化（auth.js 可能已初始化同一個 app）
import { getApps, initializeApp as fbInit } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
const app = getApps().length ? getApps()[0] : fbInit(firebaseConfig);
const db  = getFirestore(app);

/* ── 分類對照表（前台 data-cat ↔ Firestore category 值）────── */
const CAT_MAP = {
  'all':        null,          // 全部
  'single-oil': 'single',      // 單方精油
  'blend-oil':  'compound',    // 複方精油
  'spray':      'spray',       // 噴霧
  'massage':    'massage',     // 按摩油
  'eyemask':    'eye-mask',    // 眼罩
};

const CAT_LABEL = {
  single:    '單方精油',
  compound:  '複方精油',
  spray:     '噴霧',
  massage:   '按摩油',
  'eye-mask':'眼罩',
};

const SPEC_SIZES = ['5ml', '10ml', '30ml'];

/* ── 全域暫存 ──────────────────────────────────────────────── */
let allProducts     = [];
let currentCatKey   = 'all';

/* ── DOM ───────────────────────────────────────────────────── */
const grid        = document.getElementById('productGrid');
const totalCount  = document.getElementById('totalCount');
const currentCat  = document.getElementById('currentCat');
const catToggle   = document.getElementById('catToggle');
const catMenu     = document.getElementById('catMenu');
const catDropdown = document.getElementById('catDropdown');

/* ── 初始化 ────────────────────────────────────────────────── */
async function init() {
  await loadProducts();
  initCategoryFilter();
  initDropdownClose();
}

/* ── 讀取產品 ──────────────────────────────────────────────── */
async function loadProducts() {
  grid.innerHTML = renderSkeletons(6);

  try {
    const snap = await getDocs(collection(db, 'products'));
    allProducts = [];
    snap.forEach(d => {
      const p = { id: d.id, ...d.data() };
      // 只顯示上架中的商品
      if (p.status === 'active') allProducts.push(p);
    });

    // 前端排序：createdAt 新到舊
    allProducts.sort((a, b) => {
      const ta = a.createdAt?.seconds || 0;
      const tb = b.createdAt?.seconds || 0;
      return tb - ta;
    });

    renderProducts(allProducts);
  } catch (e) {
    grid.innerHTML = `<p style="color:#888;padding:40px 0">商品載入失敗，請重新整理頁面。</p>`;
    console.error('loadProducts error:', e);
  }
}

/* ── 渲染商品列表 ──────────────────────────────────────────── */
function renderProducts(list) {
  totalCount.textContent = list.length;

  if (!list.length) {
    grid.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:60px 0;color:#999">
        <div style="font-size:36px;margin-bottom:12px">🌿</div>
        <p>此分類目前沒有商品</p>
      </div>`;
    return;
  }

  grid.innerHTML = list.map(p => productCard(p)).join('');

  // 綁定每張卡片的規格切換 & 加入購物車
  list.forEach(p => bindCardEvents(p));
}

/* ── 商品卡片 HTML ─────────────────────────────────────────── */
function productCard(p) {
  const specs   = p.specs || {};
  const enabled = SPEC_SIZES.filter(s => specs[s]?.enabled && specs[s]?.stock > 0);
  const defaultSpec = enabled[0] || null;
  const defaultPrice = defaultSpec ? specs[defaultSpec].price : 0;
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

        <!-- 規格選擇 -->
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
            NT$ ${Number(defaultPrice).toLocaleString()}
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
            : `<span class="sold-out-tag">已售完</span>`}
        </div>
      </div>
    </div>
  `;
}

/* ── 綁定卡片互動 ──────────────────────────────────────────── */
function bindCardEvents(p) {
  const card    = document.querySelector(`.product-card[data-id="${p.id}"]`);
  if (!card) return;
  const specs   = p.specs || {};
  const cartBtn = card.querySelector('.add-cart-btn');

  // 規格按鈕切換
  card.querySelectorAll('.spec-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      card.querySelectorAll('.spec-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const size  = btn.dataset.size;
      const price = btn.dataset.price;

      // 更新價格顯示
      const priceEl = card.querySelector('.product-price');
      if (priceEl) priceEl.textContent = `NT$ ${Number(price).toLocaleString()}`;

      // 更新購物車按鈕 data 屬性
      if (cartBtn) {
        cartBtn.dataset.size  = size;
        cartBtn.dataset.price = price;
      }
    });
  });

  // 加入購物車
  cartBtn?.addEventListener('click', () => {
    const size  = cartBtn.dataset.size;
    const price = Number(cartBtn.dataset.price);
    const name  = cartBtn.dataset.name;
    const img   = cartBtn.dataset.img;
    const id    = cartBtn.dataset.id;

    addToCart({ id, name, size, price, img, qty: 1 });

    // 視覺回饋
    const orig = cartBtn.textContent;
    cartBtn.textContent = '✓ 已加入';
    cartBtn.disabled = true;
    setTimeout(() => {
      cartBtn.textContent = orig;
      cartBtn.disabled = false;
    }, 1200);
  });
}

/* ── 購物車（localStorage）─────────────────────────────────── */
function addToCart(item) {
  const cart = getCart();
  // 同商品同規格 → 數量 +1
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
  const total = cart.reduce((s, c) => s + c.qty, 0);
  const badge = document.getElementById('cartCount');
  if (badge) badge.textContent = total;
}

/* ── 分類篩選 ──────────────────────────────────────────────── */
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

      // 篩選
      const firestoreCat = CAT_MAP[currentCatKey];
      const filtered = firestoreCat
        ? allProducts.filter(p => p.category === firestoreCat)
        : allProducts;
      renderProducts(filtered);
    });
  });
}

/* ── 點外側關閉下拉 ────────────────────────────────────────── */
function initDropdownClose() {
  document.addEventListener('click', e => {
    if (catDropdown && !catDropdown.contains(e.target)) {
      catToggle?.setAttribute('aria-expanded', 'false');
      catMenu?.classList.remove('open');
    }
  });
}

/* ── Skeleton 骨架 ─────────────────────────────────────────── */
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

/* ── 工具 ──────────────────────────────────────────────────── */
function esc(str) {
  return String(str || '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ── 初始化購物車數量 ──────────────────────────────────────── */
updateCartBadge(getCart());

/* ── 啟動 ──────────────────────────────────────────────────── */
init();
