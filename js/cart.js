/**
 * Arochemy — js/cart.js
 * 購物車頁面：讀取 localStorage → 顯示商品 → 調整數量 → 前往結帳
 * 結帳時需要登入，訂單寫入 Firestore orders collection
 */

import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore, doc, getDoc }
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

const app  = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

/* ── DOM ───────────────────────────────────────────────────── */
const cartListEl   = document.getElementById('cartList');
const cartTotalEl  = document.getElementById('cartTotal');
const checkoutBtn  = document.getElementById('checkoutBtn');
const cartMsgEl    = document.getElementById('cartMsg');

/* ── 從藍新付款失敗/取消導回時，顯示提示訊息 ──────────────── */
if (new URLSearchParams(window.location.search).get('paymentFailed') === '1') {
  if (cartMsgEl) {
    cartMsgEl.textContent = '付款未完成或失敗，訂單尚未成立，請重新結帳';
    cartMsgEl.style.color = '#b94a48';
  }
  // 清掉網址上的參數，避免重新整理時又看到同一則訊息
  window.history.replaceState({}, '', window.location.pathname);
}

/* ── 當前登入使用者 ────────────────────────────────────────── */
let currentUser = null;
onAuthStateChanged(auth, user => {
  currentUser = user;
  // 更新 header 登入狀態
  const userEmailEl = document.getElementById('userEmail');
  if (userEmailEl && user) userEmailEl.textContent = user.email;
});

/* ══════════════════════════════════════════════════════════════
   購物車資料（localStorage）
══════════════════════════════════════════════════════════════ */
function getCart()      { try { return JSON.parse(localStorage.getItem('arochemy_cart') || '[]'); } catch { return []; } }
function saveCart(c)    { localStorage.setItem('arochemy_cart', JSON.stringify(c)); }

function updateCartBadge(cart) {
  const total = cart.reduce((s, c) => s + c.qty, 0);
  const badge = document.getElementById('cartCount');
  if (badge) badge.textContent = total;
}

/* ══════════════════════════════════════════════════════════════
   渲染購物車列表
══════════════════════════════════════════════════════════════ */
function renderCart() {
  const cart = getCart();
  updateCartBadge(cart);

  if (!cart.length) {
    cartListEl.innerHTML = `
      <div class="cart-empty">
        <div style="font-size:48px;margin-bottom:12px">🛒</div>
        <p class="muted">購物車是空的</p>
        <a class="btn" href="products.html" style="margin-top:16px">開始選購</a>
      </div>`;
    if (cartTotalEl) cartTotalEl.textContent = 'NT$ 0';
    if (checkoutBtn) checkoutBtn.disabled = true;
    return;
  }

  if (checkoutBtn) checkoutBtn.disabled = false;

  // 計算總計
  const total = cart.reduce((s, item) => s + item.price * item.qty, 0);
  if (cartTotalEl) cartTotalEl.textContent = `NT$ ${total.toLocaleString()}`;

  // 渲染列表
  cartListEl.innerHTML = cart.map((item, i) => `
    <div class="cart-item" data-i="${i}">
      <div class="cart-item-img">
        ${item.img
          ? `<img src="${esc(item.img)}" alt="${esc(item.name)}" loading="lazy">`
          : `<div class="cart-img-placeholder">🌿</div>`}
      </div>

      <div class="cart-item-info">
        <div class="cart-item-name">${esc(item.name)}</div>
        <div class="cart-item-spec muted">${esc(item.size || '')}</div>
        <div class="cart-item-price">NT$ ${Number(item.price).toLocaleString()}</div>
      </div>

      <div class="cart-item-qty">
        <button class="p-qty-btn qty-minus" data-i="${i}" type="button" aria-label="減少">−</button>
        <span class="qty-val">${item.qty}</span>
        <button class="p-qty-btn qty-plus" data-i="${i}" type="button" aria-label="增加">＋</button>
      </div>

      <div class="cart-item-subtotal">
        NT$ ${(item.price * item.qty).toLocaleString()}
      </div>

      <button class="cart-remove" data-i="${i}" type="button" aria-label="移除">
        <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  `).join('');

  // 綁定數量和刪除事件
  cartListEl.querySelectorAll('.qty-minus').forEach(btn =>
    btn.addEventListener('click', () => changeQty(Number(btn.dataset.i), -1))
  );
  cartListEl.querySelectorAll('.qty-plus').forEach(btn =>
    btn.addEventListener('click', () => changeQty(Number(btn.dataset.i), +1))
  );
  cartListEl.querySelectorAll('.cart-remove').forEach(btn =>
    btn.addEventListener('click', () => removeItem(Number(btn.dataset.i)))
  );
}

function changeQty(i, delta) {
  const cart = getCart();
  if (!cart[i]) return;
  cart[i].qty = Math.max(1, cart[i].qty + delta);
  saveCart(cart);
  renderCart();
}

function removeItem(i) {
  const cart = getCart();
  cart.splice(i, 1);
  saveCart(cart);
  renderCart();
}

/* ══════════════════════════════════════════════════════════════
   結帳 Modal（收集配送資訊）
══════════════════════════════════════════════════════════════ */
function openCheckoutModal() {
  // 若已有 modal 就移除重建
  document.getElementById('checkout-modal')?.remove();

  const modal = document.createElement('div');
  modal.id        = 'checkout-modal';
  modal.className = 'checkout-modal-overlay';
  modal.innerHTML = `
    <div class="checkout-modal">
      <div class="checkout-modal-header">
        <h2>結帳資訊</h2>
        <button class="checkout-close" type="button" aria-label="關閉">×</button>
      </div>

      <div class="checkout-modal-body">
        <!-- 客戶資訊（若已登入自動帶入） -->
        <div class="co-section-label">收件人資訊</div>
        <div class="co-field">
          <label>姓名 <span class="req">*</span></label>
          <input id="co-name" type="text" placeholder="請輸入姓名">
        </div>
        <div class="co-field">
          <label>電話 <span class="req">*</span></label>
          <input id="co-phone" type="tel" placeholder="請輸入聯絡電話">
        </div>
        <div class="co-field">
          <label>Email</label>
          <input id="co-email" type="email" placeholder="用於訂單通知">
        </div>

        <!-- 配送方式 -->
        <div class="co-section-label">配送方式</div>
        <div class="co-ship-options">
          <label class="co-radio">
            <input type="radio" name="ship" value="宅配到府" checked> 宅配到府
          </label>
          <label class="co-radio">
            <input type="radio" name="ship" value="超商取貨（7-11）"> 超商取貨（7-11）
          </label>
          <label class="co-radio">
            <input type="radio" name="ship" value="超商取貨（全家）"> 超商取貨（全家）
          </label>
        </div>

        <!-- 地址 / 門市 -->
        <div class="co-field" id="co-addr-field">
          <label>收件地址 <span class="req">*</span></label>
          <input id="co-address" type="text" placeholder="縣市、鄉鎮市區、路段門號">
        </div>
        <div class="co-field" id="co-store-field" style="display:none">
          <label>門市名稱 / 門市編號 <span class="req">*</span></label>
          <input id="co-store" type="text" placeholder="e.g. 台中文心門市 123456">
        </div>

        <!-- 訂單備註 -->
        <div class="co-field">
          <label>訂單備註</label>
          <textarea id="co-note" rows="2" placeholder="特殊需求、禮盒包裝等…"></textarea>
        </div>

        <div id="co-error" class="co-error" style="display:none"></div>
      </div>

      <div class="checkout-modal-footer">
        <button class="btn" id="co-cancel" type="button">取消</button>
        <button class="btn primary" id="co-submit" type="button">確認送出訂單</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  document.body.style.overflow = 'hidden';

  // 若已登入，帶入 email
  if (currentUser) {
    const emailEl = document.getElementById('co-email');
    if (emailEl) emailEl.value = currentUser.email;

    // 嘗試從 members 帶入姓名電話
    getDoc(doc(db, 'members', currentUser.uid)).then(snap => {
      if (!snap.exists()) return;
      const d = snap.data();
      const nameEl  = document.getElementById('co-name');
      const phoneEl = document.getElementById('co-phone');
      if (nameEl  && d.name)  nameEl.value  = d.name;
      if (phoneEl && d.phone) phoneEl.value = d.phone;
    }).catch(() => {});
  }

  // 配送方式切換
  modal.querySelectorAll('input[name="ship"]').forEach(radio => {
    radio.addEventListener('change', () => {
      const isConvStore = radio.value.includes('超商');
      document.getElementById('co-addr-field').style.display  = isConvStore ? 'none' : '';
      document.getElementById('co-store-field').style.display = isConvStore ? ''     : 'none';
    });
  });

  // 關閉
  const closeModal = () => { modal.remove(); document.body.style.overflow = ''; };
  modal.querySelector('.checkout-close')?.addEventListener('click', closeModal);
  document.getElementById('co-cancel')?.addEventListener('click', closeModal);
  modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });

  // 送出
  document.getElementById('co-submit')?.addEventListener('click', submitOrder);
}

/* ══════════════════════════════════════════════════════════════
   送出訂單 → 寫入 Firestore orders collection
══════════════════════════════════════════════════════════════ */
async function submitOrder() {
  const submitBtn = document.getElementById('co-submit');
  const errorEl  = document.getElementById('co-error');

  const name    = document.getElementById('co-name')?.value.trim();
  const phone   = document.getElementById('co-phone')?.value.trim();
  const email   = document.getElementById('co-email')?.value.trim();
  const ship    = document.querySelector('input[name="ship"]:checked')?.value || '宅配到府';
  const isStore = ship.includes('超商');
  const address = isStore
    ? document.getElementById('co-store')?.value.trim()
    : document.getElementById('co-address')?.value.trim();
  const note    = document.getElementById('co-note')?.value.trim();

  // 驗證
  const errors = [];
  if (!name)    errors.push('請填寫姓名');
  if (!phone)   errors.push('請填寫電話');
  if (!address) errors.push(isStore ? '請填寫門市資訊' : '請填寫收件地址');

  if (errors.length) {
    errorEl.textContent  = errors.join('、');
    errorEl.style.display = '';
    return;
  }

  errorEl.style.display = 'none';
  submitBtn.disabled    = true;
  submitBtn.textContent = '送出中…';

  const cart  = getCart();
  const total = cart.reduce((s, c) => s + c.price * c.qty, 0);

  try {
    // 寫入 orders collection
    // 呼叫後端 API 建立訂單（自動寄確認信 + 扣庫存）
    const res = await fetch('https://arochemy-backend-production.up.railway.app/api/orders', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName:   name,
        customerPhone:  phone,
        customerEmail:  email || (currentUser?.email || ''),
        shippingMethod: ship,
        address:        isStore ? '' : address,
        storeInfo:      isStore ? address : '',
        note:           note || '',
        items: cart.map(c => ({
          productId: c.id    || '',
          name:      c.name  || '',
          spec:      c.size  || c.spec || '',
          price:     Number(c.price)  || 0,
          qty:       Number(c.qty)    || 1,
          image:     c.img   || c.image || '',
        })),
        total,
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '送出失敗');

    // 注意：這裡先不清空購物車！要等真的付款成功、抵達「訂單完成」頁
    // (order-success.html) 才清空，避免付款失敗被導回購物車時商品也不見了

    // 導向藍新收銀台付款（真正的 POST 導頁，不是 fetch，
    // 因為後端回傳的是一整頁會自動送出去藍新的 HTML）
    redirectToPayment({
      orderId: data.orderId,
      total,
      items: cart,
      customerEmail: email || (currentUser?.email || ''),
    });

  } catch (e) {
    errorEl.textContent   = '送出失敗：' + e.message;
    errorEl.style.display = '';
    submitBtn.disabled    = false;
    submitBtn.textContent = '確認送出訂單';
  }
}

/* ══════════════════════════════════════════════════════════════
   導向藍新金流付款頁：用真正的表單 POST 導頁（不是 fetch），
   因為 /api/payment/create 回傳的是一整頁「自動送出去藍新」的 HTML，
   瀏覽器要整頁導過去才能繼續往下跑那段自動送出的 script
══════════════════════════════════════════════════════════════ */
function redirectToPayment({ orderId, total, items, customerEmail }) {
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = 'https://arochemy-backend-production.up.railway.app/api/payment/create';

  const fields = {
    orderId,
    total,
    items: JSON.stringify(items),
    customerEmail,
  };

  Object.entries(fields).forEach(([name, value]) => {
    const input = document.createElement('input');
    input.type  = 'hidden';
    input.name  = name;
    input.value = value ?? '';
    form.appendChild(input);
  });

  document.body.appendChild(form);
  form.submit();
}

/* ──────────────────────────────────────────────────────────────
   訂單成功頁
────────────────────────────────────────────────────────────── */
function showSuccess(orderId) {
  const shortId = orderId.slice(-6).toUpperCase();
  const main    = document.querySelector('main');
  if (!main) return;
  main.innerHTML = `
    <div style="text-align:center;padding:80px 20px;max-width:480px;margin:0 auto">
      <div style="font-size:56px;margin-bottom:16px">✅</div>
      <h2 style="font-size:24px;margin-bottom:8px">訂單送出成功！</h2>
      <p class="muted" style="margin-bottom:8px">訂單編號：<strong>#${shortId}</strong></p>
      <p class="muted" style="margin-bottom:32px;line-height:1.7">
        我們會盡快處理您的訂單，<br>如有問題歡迎透過 Email 或 LINE 聯繫。
      </p>
      <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
        <a class="btn" href="products.html">繼續購物</a>
        <a class="btn primary" href="index.html">回首頁</a>
      </div>
    </div>
  `;
}

/* ──────────────────────────────────────────────────────────────
   結帳按鈕事件
────────────────────────────────────────────────────────────── */
checkoutBtn?.addEventListener('click', () => {
  if (!currentUser) {
    // 未登入 → 記住目標頁，跳轉登入
    sessionStorage.setItem('loginRedirect', 'cart.html');
    if (cartMsgEl) {
      cartMsgEl.textContent = '請先登入會員再結帳';
      cartMsgEl.style.color = '#b94a48';
    }
    setTimeout(() => { window.location.href = 'login.html'; }, 1000);
    return;
  }
  openCheckoutModal();
});

/* ──────────────────────────────────────────────────────────────
   工具
────────────────────────────────────────────────────────────── */
function esc(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ── CSS：結帳 Modal 樣式（注入到 <head>） ── */
const style = document.createElement('style');
style.textContent = `
  .checkout-modal-overlay {
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.5);
    backdrop-filter: blur(4px);
    display: flex; align-items: center; justify-content: center;
    z-index: 9000; padding: 20px;
  }
  .checkout-modal {
    background: #fff;
    border-radius: 20px;
    width: min(100%, 520px);
    max-height: 88vh;
    overflow-y: auto;
    box-shadow: 0 24px 60px rgba(0,0,0,0.18);
  }
  .checkout-modal-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 20px 24px 16px;
    border-bottom: 1px solid #eee;
  }
  .checkout-modal-header h2 { font-size: 20px; margin: 0; }
  .checkout-close {
    background: none; border: none; font-size: 24px;
    cursor: pointer; color: #999; line-height: 1; padding: 0;
  }
  .checkout-modal-body { padding: 20px 24px; display: flex; flex-direction: column; gap: 14px; }
  .co-section-label {
    font-size: 11px; font-weight: 700; letter-spacing: 0.12em;
    text-transform: uppercase; color: #999; margin-top: 4px;
  }
  .co-field { display: flex; flex-direction: column; gap: 6px; }
  .co-field label { font-size: 13px; font-weight: 600; }
  .co-field input, .co-field textarea {
    padding: 10px 14px;
    border: 1px solid #ddd;
    border-radius: 10px;
    font-size: 14px;
    outline: none;
    font-family: inherit;
    transition: border-color 0.15s;
  }
  .co-field input:focus, .co-field textarea:focus { border-color: #111; }
  .co-field textarea { resize: vertical; min-height: 60px; }
  .co-ship-options { display: flex; flex-direction: column; gap: 8px; }
  .co-radio { display: flex; align-items: center; gap: 8px; font-size: 14px; cursor: pointer; }
  .co-radio input { accent-color: #111; }
  .req { color: #e55; }
  .co-error {
    background: #fff0f0; border: 1px solid #fcc;
    border-radius: 8px; padding: 10px 14px;
    font-size: 13px; color: #c44;
  }
  .checkout-modal-footer {
    display: flex; gap: 10px; justify-content: flex-end;
    padding: 16px 24px;
    border-top: 1px solid #eee;
  }

  /* 購物車頁樣式補充 */
  .cart-empty { text-align: center; padding: 60px 20px; }
  .cart-item {
    display: flex; align-items: center; gap: 14px;
    padding: 16px 0;
    border-bottom: 1px solid #f0f0f0;
  }
  .cart-item:last-child { border-bottom: none; }
  .cart-item-img {
    width: 72px; height: 72px; flex-shrink: 0;
    border-radius: 10px; overflow: hidden;
    background: #f5f5f5;
    display: flex; align-items: center; justify-content: center;
  }
  .cart-item-img img { width: 100%; height: 100%; object-fit: cover; }
  .cart-img-placeholder { font-size: 28px; }
  .cart-item-info { flex: 1; min-width: 0; }
  .cart-item-name { font-weight: 600; font-size: 14px; margin-bottom: 2px; }
  .cart-item-spec { font-size: 12px; margin-bottom: 4px; }
  .cart-item-price { font-size: 13px; color: #555; }
  .cart-item-qty {
    display: flex; align-items: center; gap: 8px;
    background: #f5f5f5; border-radius: 999px;
    padding: 4px 10px;
  }
  .qty-val { font-size: 14px; font-weight: 600; min-width: 20px; text-align: center; }
  .cart-item-subtotal { font-size: 14px; font-weight: 700; white-space: nowrap; }
  .cart-remove {
    background: none; border: none; cursor: pointer;
    color: #bbb; padding: 4px;
    transition: color 0.15s;
  }
  .cart-remove:hover { color: #e55; }
`;
document.head.appendChild(style);

/* ── 啟動 ── */
renderCart();
