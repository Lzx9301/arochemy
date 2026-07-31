/**
 * Arochemy — js/product-page.js
 * 單一商品詳細頁：從 URL ?id= 讀取 Firestore 產品資料
 * 對應 product.html 的所有 DOM 元素
 */

import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getFirestore, doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

/* ── Firebase ──────────────────────────────────────────────── */
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

/* ── 規格尺寸 ──────────────────────────────────────────────── */
const SPEC_SIZES = ['5ml', '10ml', '30ml'];

/* ── 狀態 ──────────────────────────────────────────────────── */
let currentSize  = null;
let currentPrice = 0;
let product      = null;

/* ── DOM 快捷 ──────────────────────────────────────────────── */
const $  = id => document.getElementById(id);
const esc = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

/* ══════════════════════════════════════════════════════════════
   初始化
══════════════════════════════════════════════════════════════ */
async function init() {
  const params = new URLSearchParams(location.search);
  // 優先用 ?id=（Firestore document ID），其次支援舊版 ?slug=
  const id   = params.get('id')   || null;
  const slug = params.get('slug') || null;

  if (!id && !slug) {
    showError('找不到商品資訊，請回到產品列表重新選擇。');
    return;
  }

  try {
    let snap = null;

    if (id) {
      // 直接用 document ID 查詢（最快）
      snap = await getDoc(doc(db, 'products', id));
      if (!snap.exists()) snap = null;
    }

    if (!snap && slug) {
      // 用 slug 欄位查詢（舊連結相容）
      const { getDocs, collection, query, where } = await import(
        'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js'
      );
      const q = query(collection(db, 'products'), where('slug', '==', slug));
      const result = await getDocs(q);
      if (!result.empty) snap = result.docs[0];
    }

    if (!snap || !snap.exists()) {
      showError('此商品不存在或已下架。');
      return;
    }

    product = { id: snap.id, ...snap.data() };
    render(product);
  } catch (e) {
    showError('商品資料載入失敗，請稍後再試。<br><small style="color:#bbb">' + e.message + '</small>');
    console.error(e);
  }
}

/* ══════════════════════════════════════════════════════════════
   渲染全頁
══════════════════════════════════════════════════════════════ */
function render(p) {
  /* ── 頁面標題 & breadcrumb ── */
  document.title = `${p.name}｜Arochemy`;
  setText('bcName', p.name);
  setText('pName',  p.name);

  /* ── 英文名 / 學名（若有存） ── */
  setText('pEn',    p.nameEn    || '');
  setText('pLatin', p.nameLatin || '');
  if (!p.nameEn)    $('pEn')?.closest?.('.p-sub')    && ($('pEn').style.display    = 'none');
  if (!p.nameLatin) $('pLatin')?.closest?.('.p-latin') && ($('pLatin').style.display = 'none');

  /* ── 圖片 ── */
  renderGallery(p.images || []);

  /* ── 規格藥丸 ── */
  renderVariantPills(p);

  /* ── 數量控制 ── */
  initQty();

  /* ── 按鈕 ── */
  $('btnCart')?.addEventListener('click', () => addToCart(false));
  $('btnBuy')?.addEventListener('click',  () => addToCart(true));
  $('btnFav')?.addEventListener('click',  toggleFav);

  /* ── 收藏狀態初始化 ── */
  updateFavUI(isFaved(p.id));

  /* ── 產品概述 kv ── */
  renderOverview(p);

  /* ── 成分條狀圖 ── */
  renderComposition(p.composition || []);

  /* ── 文件下載 ── */
  renderDocs(p);

  /* ── 長文說明 ── */
  setHTML('descText',   p.description || '<p class="muted">暫無說明</p>');
  renderList('storageList', p.storage || []);
  renderList('usageList',   p.usage   || []);
  renderList('cautionList', p.caution || []);

  /* ── 備注 ── */
  const noteEl = document.querySelector('.p-note');
  if (noteEl) noteEl.style.display = 'none'; // 隱藏測試備注
}

/* ──────────────────────────────────────────────────────────────
   圖片 Gallery
────────────────────────────────────────────────────────────── */
function renderGallery(images) {
  const mainEl  = $('mainImg');
  const thumbEl = $('thumbs');
  if (!mainEl) return;

  const imgs = images.filter(Boolean);

  if (!imgs.length) {
    mainEl.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;font-size:64px;">🌿</div>`;
    return;
  }

  // 主圖
  const setMain = src => {
    mainEl.innerHTML = `<img src="${esc(src)}" alt="product" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;">`;
  };
  setMain(imgs[0]);

  // 縮圖列
  if (thumbEl && imgs.length > 1) {
    thumbEl.innerHTML = imgs.map((src, i) => `
      <div class="p-thumb ${i===0?'active':''}" data-i="${i}">
        <img src="${esc(src)}" alt="thumb ${i+1}" loading="lazy">
      </div>
    `).join('');

    thumbEl.querySelectorAll('.p-thumb').forEach(th => {
      th.addEventListener('click', () => {
        thumbEl.querySelectorAll('.p-thumb').forEach(t => t.classList.remove('active'));
        th.classList.add('active');
        setMain(imgs[Number(th.dataset.i)]);
      });
    });
  }
}

/* ──────────────────────────────────────────────────────────────
   規格藥丸
────────────────────────────────────────────────────────────── */
function renderVariantPills(p) {
  const pills  = $('variantPills');
  const priceEl = $('pPrice');
  if (!pills) return;

  const specs   = p.specs || {};
  const enabled = SPEC_SIZES.filter(s => specs[s]?.enabled);

  if (!enabled.length) {
    pills.innerHTML = '<span class="muted">無規格資訊</span>';
    if (priceEl) priceEl.textContent = '—';
    return;
  }

  // 預設選第一個有庫存的，若都無庫存則選第一個
  const firstInStock = enabled.find(s => (specs[s]?.stock || 0) > 0) || enabled[0];
  currentSize  = firstInStock;
  currentPrice = specs[firstInStock]?.price || 0;
  if (priceEl) priceEl.textContent = `NT$ ${Number(currentPrice).toLocaleString()}`;

  pills.innerHTML = enabled.map(s => {
    const inStock = (specs[s]?.stock || 0) > 0;
    return `
      <button
        class="p-pill ${s === firstInStock ? 'active' : ''} ${!inStock ? 'sold-out' : ''}"
        data-size="${s}"
        data-price="${specs[s]?.price || 0}"
        data-stock="${specs[s]?.stock || 0}"
        type="button"
        ${!inStock ? 'title="已售完"' : ''}
      >
        ${s}${!inStock ? ' <span class="pill-sold">售完</span>' : ''}
      </button>
    `;
  }).join('');

  pills.querySelectorAll('.p-pill:not(.sold-out)').forEach(btn => {
    btn.addEventListener('click', () => {
      pills.querySelectorAll('.p-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentSize  = btn.dataset.size;
      currentPrice = Number(btn.dataset.price);
      if (priceEl) priceEl.textContent = `NT$ ${currentPrice.toLocaleString()}`;
    });
  });
}

/* ──────────────────────────────────────────────────────────────
   數量
────────────────────────────────────────────────────────────── */
function initQty() {
  const input  = $('qtyInput');
  const minus  = $('qtyMinus');
  const plus   = $('qtyPlus');
  if (!input) return;

  minus?.addEventListener('click', () => {
    const v = Math.max(1, Number(input.value) - 1);
    input.value = v;
  });
  plus?.addEventListener('click', () => {
    input.value = Number(input.value) + 1;
  });
  input.addEventListener('change', () => {
    input.value = Math.max(1, parseInt(input.value) || 1);
  });
}

/* ──────────────────────────────────────────────────────────────
   加入購物車 / 立即購買
────────────────────────────────────────────────────────────── */
function addToCart(buyNow = false) {
  if (!currentSize) { showToast('請先選擇規格'); return; }

  const qty  = Math.max(1, parseInt($('qtyInput')?.value) || 1);
  const item = {
    id:    product.id,
    name:  product.name,
    size:  currentSize,
    price: currentPrice,
    img:   product.images?.[0] || '',
    qty,
  };

  // 寫入 localStorage
  const cart = getCart();
  const key  = `${item.id}_${item.size}`;
  const exist = cart.find(c => `${c.id}_${c.size}` === key);
  if (exist) exist.qty += qty;
  else cart.push(item);
  saveCart(cart);

  // 更新購物車數量徽章
  updateCartBadge(cart);

  if (buyNow) {
    window.location.href = 'cart.html';
  } else {
    showToast(`${product.name}（${currentSize}）已加入購物車`);
  }
}

/* ──────────────────────────────────────────────────────────────
   Toast 提示
────────────────────────────────────────────────────────────── */
function showToast(msg) {
  const toast   = $('cartToast');
  const textEl  = $('cartToastText');
  if (!toast) return;
  if (textEl) textEl.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2800);
}

/* ──────────────────────────────────────────────────────────────
   收藏（localStorage）
────────────────────────────────────────────────────────────── */
function getFavs()     { try { return JSON.parse(localStorage.getItem('arochemy_favs')||'[]'); } catch { return []; } }
function isFaved(id)   { return getFavs().includes(id); }

function toggleFav() {
  const favs = getFavs();
  const idx  = favs.indexOf(product.id);
  if (idx > -1) favs.splice(idx, 1);
  else favs.push(product.id);
  localStorage.setItem('arochemy_favs', JSON.stringify(favs));
  updateFavUI(idx === -1);
}

function updateFavUI(faved) {
  const btn  = $('btnFav');
  if (!btn) return;
  const span = btn.querySelector('span');
  const path = btn.querySelector('path');
  if (span) span.textContent = faved ? '已收藏' : '收藏';
  if (path) path.setAttribute('fill', faved ? 'currentColor' : 'none');
  btn.classList.toggle('faved', faved);
}

/* ──────────────────────────────────────────────────────────────
   產品概述 key-value
────────────────────────────────────────────────────────────── */
function renderOverview(p) {
  const el = $('overviewKV');
  if (!el) return;

  const CAT = { single:'單方精油', compound:'複方精油', spray:'噴霧', massage:'按摩油', 'eye-mask':'眼罩' };

  const rows = [
    ['分類',     CAT[p.category] || p.category || '—'],
    ['科屬',     p.family       || '—'],
    ['產地來源', p.origin       || '—'],
    ['萃取方式', p.extraction   || '—'],
    ['植物部位', p.plantPart    || '—'],
    ['香調',     p.scentNote    || '—'],
    ['建議用途', p.skinType     || '—'],
  ].filter(([, v]) => v && v !== '—');

  if (!rows.length) { el.innerHTML = '<div class="muted">暫無資料</div>'; return; }

  el.innerHTML = rows.map(([k, v]) => `
    <div class="p-kv-row">
      <dt class="p-kv-key muted">${esc(k)}</dt>
      <dd class="p-kv-val">${esc(v)}</dd>
    </div>
  `).join('');
}

/* ──────────────────────────────────────────────────────────────
   成分條狀圖
   composition 格式：[{ name: '沉香醇', pct: 42 }, ...]
────────────────────────────────────────────────────────────── */
function renderComposition(comp) {
  const el = $('compBars');
  if (!el) return;

  if (!comp || !comp.length) {
    el.innerHTML = '<div class="muted" style="padding:16px">暫無成分資料</div>';
    return;
  }

  // 相容多種格式：pct / percent / percentage
  const normalized = comp.map(c => ({
    name: c.name || c.ingredient || '—',
    pct:  Number(c.pct ?? c.percent ?? c.percentage ?? 0),
  })).filter(c => c.name && c.name !== '—');

  if (!normalized.length) {
    el.innerHTML = '<div class="muted" style="padding:16px">暫無成分資料</div>';
    return;
  }

  const max = Math.max(...normalized.map(c => c.pct), 1);

  el.innerHTML = normalized.map(c => `
    <div class="comp-row">
      <div class="comp-name">${esc(c.name)}</div>
      <div class="comp-bar-wrap">
        <div class="comp-bar" style="width:${Math.round((c.pct / max) * 100)}%"></div>
      </div>
      <div class="comp-pct">${c.pct > 0 ? c.pct + '%' : '—'}</div>
    </div>
  `).join('');
}

/* ──────────────────────────────────────────────────────────────
   文件下載
────────────────────────────────────────────────────────────── */
function renderDocs(p) {
  const setDoc = (id, url) => {
    const el = $(id);
    if (!el) return;
    if (url) { el.href = url; el.style.opacity = '1'; }
    else { el.style.opacity = '0.35'; el.removeAttribute('href'); el.style.cursor = 'default'; }
  };
  setDoc('btnCOA', p.docCOA);
  setDoc('btnSDS', p.docSDS);
  setDoc('btnEU',  p.docEU);
}

/* ──────────────────────────────────────────────────────────────
   清單渲染
────────────────────────────────────────────────────────────── */
function renderList(elId, items) {
  const el = $(elId);
  if (!el) return;
  if (!items?.length) { el.innerHTML = '<li class="muted">暫無資料</li>'; return; }
  el.innerHTML = items.map(t => `<li>${esc(t)}</li>`).join('');
}

/* ──────────────────────────────────────────────────────────────
   錯誤頁
────────────────────────────────────────────────────────────── */
function showError(msg) {
  const main = document.querySelector('main');
  if (main) main.innerHTML = `
    <div style="text-align:center;padding:80px 20px;color:#999">
      <div style="font-size:48px;margin-bottom:16px">🌿</div>
      <p style="font-size:16px;margin-bottom:24px">${esc(msg)}</p>
      <a href="products.html" class="btn">回到產品列表</a>
    </div>
  `;
}

/* ──────────────────────────────────────────────────────────────
   購物車 localStorage 工具
────────────────────────────────────────────────────────────── */
function getCart()      { try { return JSON.parse(localStorage.getItem('arochemy_cart')||'[]'); } catch { return []; } }
function saveCart(cart) { localStorage.setItem('arochemy_cart', JSON.stringify(cart)); }
function updateCartBadge(cart) {
  const total  = cart.reduce((s, c) => s + c.qty, 0);
  const badge  = document.getElementById('cartCount');
  if (badge) badge.textContent = total;
}

/* ──────────────────────────────────────────────────────────────
   DOM 工具
────────────────────────────────────────────────────────────── */
function setText(id, val) { const el = $(id); if (el) el.textContent = val; }
function setHTML(id, val) { const el = $(id); if (el) el.innerHTML  = val;  }

/* ── 初始化購物車數量 ── */
updateCartBadge(getCart());

/* ── 啟動 ── */
init();
