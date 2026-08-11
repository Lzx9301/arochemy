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

/* ── 優惠券狀態(結帳彈窗內設定，套用時會更新這兩個值) ────────── */
let appliedCoupon   = null;
let couponDiscount  = 0;

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

        <!-- 優惠券 -->
        <div class="co-section-label">優惠券</div>
        <div class="co-coupon-row">
          <input id="co-coupon-code" type="text" placeholder="輸入優惠碼" style="text-transform:uppercase">
          <button class="btn" id="co-coupon-apply" type="button">套用</button>
        </div>
        <div id="co-coupon-msg" class="co-coupon-msg" style="display:none"></div>
        <div id="co-coupon-applied" class="co-coupon-applied" style="display:none"></div>
        <button type="button" id="co-coupon-toggle" class="co-coupon-toggle">查看可用優惠券 ▾</button>
        <div id="co-coupon-list" class="co-coupon-list" style="display:none">
          <div class="co-coupon-list-loading">載入中…</div>
        </div>

        <!-- 訂單金額摘要 -->
        <div class="co-summary">
          <div class="co-summary-row">
            <span>商品小計</span>
            <span id="co-summary-subtotal">NT$ 0</span>
          </div>
          <div class="co-summary-row" id="co-summary-discount-row" style="display:none">
            <span>優惠折抵</span>
            <span id="co-summary-discount" class="co-summary-discount-val">-NT$ 0</span>
          </div>
          <div class="co-summary-row co-summary-total">
            <span>應付總額</span>
            <span id="co-summary-total">NT$ 0</span>
          </div>
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

  // 每次開啟結帳彈窗都重置優惠券狀態，避免帶到上次殘留的折扣
  appliedCoupon  = null;
  couponDiscount = 0;
  renderCouponSummary();
  initCouponUI();

  // 關閉
  const closeModal = () => { modal.remove(); document.body.style.overflow = ''; };
  modal.querySelector('.checkout-close')?.addEventListener('click', closeModal);
  document.getElementById('co-cancel')?.addEventListener('click', closeModal);
  modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });

  // 送出
  document.getElementById('co-submit')?.addEventListener('click', submitOrder);
}

/* ══════════════════════════════════════════════════════════════
   優惠券：套用、清單、金額摘要
══════════════════════════════════════════════════════════════ */
const COUPON_API = 'https://arochemy-backend-production.up.railway.app/api/coupons';

function getCartTotal() {
  return getCart().reduce((s, c) => s + c.price * c.qty, 0);
}

function renderCouponSummary() {
  const subtotal = getCartTotal();
  const subtotalEl = document.getElementById('co-summary-subtotal');
  const discountRow = document.getElementById('co-summary-discount-row');
  const discountEl = document.getElementById('co-summary-discount');
  const totalEl = document.getElementById('co-summary-total');
  if (!subtotalEl) return;

  subtotalEl.textContent = `NT$ ${subtotal.toLocaleString()}`;

  if (appliedCoupon && couponDiscount > 0) {
    discountRow.style.display = '';
    discountEl.textContent = `-NT$ ${couponDiscount.toLocaleString()}`;
  } else {
    discountRow.style.display = 'none';
  }

  const finalTotal = Math.max(0, subtotal - couponDiscount);
  totalEl.textContent = `NT$ ${finalTotal.toLocaleString()}`;

  // 已套用的優惠券顯示區
  const appliedEl = document.getElementById('co-coupon-applied');
  if (appliedCoupon) {
    const discountText = appliedCoupon.type === 'percent'
      ? `${appliedCoupon.value}% 折扣`
      : `折抵 NT$${Number(appliedCoupon.value).toLocaleString()}`;
    appliedEl.style.display = 'flex';
    appliedEl.innerHTML = `
      <span>✓ 已套用「${escHtmlCart(appliedCoupon.code)}」（${discountText}）</span>
      <button type="button" id="co-coupon-remove">移除</button>
    `;
    document.getElementById('co-coupon-remove')?.addEventListener('click', () => {
      appliedCoupon = null;
      couponDiscount = 0;
      renderCouponSummary();
    });
  } else {
    appliedEl.style.display = 'none';
    appliedEl.innerHTML = '';
  }
}

function escHtmlCart(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

async function applyCouponCode(code) {
  const msgEl = document.getElementById('co-coupon-msg');
  if (!code) return;

  msgEl.style.display = 'none';

  try {
    const res = await fetch(`${COUPON_API}/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        cartTotal: getCartTotal(),
        customerId: currentUser?.uid || '',
      }),
    });
    const data = await res.json();

    if (!data.valid) {
      msgEl.textContent = data.reason || '此優惠碼無法使用';
      msgEl.style.color = '#b94a48';
      msgEl.style.display = '';
      return;
    }

    appliedCoupon  = data.coupon;
    couponDiscount = data.discount;
    document.getElementById('co-coupon-code').value = '';
    renderCouponSummary();

  } catch (e) {
    msgEl.textContent = '優惠券驗證失敗，請稍後再試';
    msgEl.style.color = '#b94a48';
    msgEl.style.display = '';
  }
}

async function loadEligibleCoupons() {
  const listEl = document.getElementById('co-coupon-list');
  if (!listEl) return;

  try {
    const params = new URLSearchParams({
      cartTotal: getCartTotal(),
      customerId: currentUser?.uid || '',
    });
    const res  = await fetch(`${COUPON_API}/eligible?${params}`);
    const data = await res.json();
    const coupons = data.coupons || [];

    if (!coupons.length) {
      listEl.innerHTML = `<div class="co-coupon-list-empty">目前沒有可以使用的優惠券</div>`;
      return;
    }

    listEl.innerHTML = coupons.map(c => {
      const discountText = c.type === 'percent' ? `${c.value}% 折扣` : `折抵 NT$${Number(c.value).toLocaleString()}`;
      return `
        <button type="button" class="co-coupon-chip" data-code="${escHtmlCart(c.code)}">
          <span class="co-coupon-chip-code">${escHtmlCart(c.code)}</span>
          <span class="co-coupon-chip-desc">${escHtmlCart(c.description || discountText)}</span>
        </button>
      `;
    }).join('');

    listEl.querySelectorAll('.co-coupon-chip').forEach(btn => {
      btn.addEventListener('click', () => applyCouponCode(btn.dataset.code));
    });

  } catch (e) {
    listEl.innerHTML = `<div class="co-coupon-list-empty">優惠券載入失敗</div>`;
  }
}

function initCouponUI() {
  document.getElementById('co-coupon-apply')?.addEventListener('click', () => {
    const code = document.getElementById('co-coupon-code')?.value.trim().toUpperCase();
    applyCouponCode(code);
  });

  document.getElementById('co-coupon-code')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const code = e.target.value.trim().toUpperCase();
      applyCouponCode(code);
    }
  });

  let listLoaded = false;
  document.getElementById('co-coupon-toggle')?.addEventListener('click', (e) => {
    const listEl = document.getElementById('co-coupon-list');
    const willShow = listEl.style.display === 'none';
    listEl.style.display = willShow ? '' : 'none';
    e.target.textContent = willShow ? '收合可用優惠券 ▴' : '查看可用優惠券 ▾';
    if (willShow && !listLoaded) {
      listLoaded = true;
      loadEligibleCoupons();
    }
  });
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
  const finalTotal = Math.max(0, total - couponDiscount);

  try {
    // 寫入 orders collection
    // 呼叫後端 API 建立訂單（自動寄確認信 + 扣庫存）
    const res = await fetch('https://arochemy-backend-production.up.railway.app/api/orders', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerId:     currentUser?.uid || '',
        customerName:   name,
        customerPhone:  phone,
        customerEmail:  email || (currentUser?.email || ''),
        shippingMethod: ship,
        address:        isStore ? '' : address,
        storeInfo:      isStore ? address : '',
        note:           note || '',
        coupon:         appliedCoupon ? {
          code:     appliedCoupon.code,
          type:     appliedCoupon.type,
          value:    appliedCoupon.value,
          discount: couponDiscount,
        } : null,
        items: cart.map(c => ({
          productId: c.id    || '',
          name:      c.name  || '',
          spec:      c.size  || c.spec || '',
          price:     Number(c.price)  || 0,
          qty:       Number(c.qty)    || 1,
          image:     c.img   || c.image || '',
        })),
        total: finalTotal,
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

  /* 優惠券 */
  .co-coupon-row { display: flex; gap: 8px; }
  .co-coupon-row input {
    flex: 1;
    padding: 10px 14px;
    border: 1px solid #ddd;
    border-radius: 10px;
    font-size: 14px;
    outline: none;
  }
  .co-coupon-row input:focus { border-color: #111; }
  .co-coupon-row .btn { flex: 0 0 auto; padding: 10px 16px; font-size: 13px; }
  .co-coupon-msg { font-size: 12px; }
  .co-coupon-applied {
    display: flex; align-items: center; justify-content: space-between;
    background: #f4f8f4; border: 1px solid #cde3cd;
    border-radius: 10px; padding: 10px 14px;
    font-size: 13px; color: #2f6b2f; font-weight: 600;
  }
  .co-coupon-applied button {
    background: none; border: none; color: #888;
    font-size: 12px; text-decoration: underline; cursor: pointer;
  }
  .co-coupon-toggle {
    background: none; border: none; text-align: left;
    font-size: 12px; color: #666; text-decoration: underline;
    cursor: pointer; padding: 0; width: fit-content;
  }
  .co-coupon-list {
    display: flex; flex-direction: column; gap: 8px;
    max-height: 200px; overflow-y: auto;
    padding: 4px 0;
  }
  .co-coupon-list-loading, .co-coupon-list-empty {
    font-size: 12px; color: #999; padding: 8px 0;
  }
  .co-coupon-chip {
    display: flex; flex-direction: column; gap: 2px;
    text-align: left;
    border: 1px dashed #ccc; border-radius: 10px;
    padding: 8px 12px; background: #fafafa;
    cursor: pointer; transition: border-color 0.15s, background 0.15s;
  }
  .co-coupon-chip:hover { border-color: #111; background: #f2f2f2; }
  .co-coupon-chip-code { font-size: 13px; font-weight: 800; letter-spacing: 0.04em; }
  .co-coupon-chip-desc { font-size: 12px; color: #777; }

  /* 訂單金額摘要 */
  .co-summary {
    display: flex; flex-direction: column; gap: 6px;
    background: #fafafa; border-radius: 10px;
    padding: 12px 14px;
  }
  .co-summary-row { display: flex; justify-content: space-between; font-size: 13px; color: #555; }
  .co-summary-discount-val { color: #c44; font-weight: 700; }
  .co-summary-total {
    border-top: 1px solid #e5e5e5; margin-top: 4px; padding-top: 8px;
    font-size: 15px; font-weight: 800; color: #111;
  }

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
