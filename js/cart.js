
import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore, doc, getDoc }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { getCart as storeGetCart, saveCart as storeSaveCart, ownerReady, onOwnerChange } from './cart-store.js';

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

const cartListEl   = document.getElementById('cartList');
const cartTotalEl  = document.getElementById('cartTotal');
const checkoutBtn  = document.getElementById('checkoutBtn');
const cartMsgEl    = document.getElementById('cartMsg');

if (new URLSearchParams(window.location.search).get('paymentFailed') === '1') {
  if (cartMsgEl) {
    cartMsgEl.textContent = '付款未完成或失敗，訂單尚未成立，請重新結帳';
    cartMsgEl.style.color = '#b94a48';
  }
  window.history.replaceState({}, '', window.location.pathname);
}

let appliedCoupon   = null;
let couponDiscount  = 0;

const SHIPPING_FREE_THRESHOLD = 3000;
const SHIPPING_FEE = { home: 100, store: 70 };

function getSelectedShip() {
  return document.querySelector('input[name="ship"]:checked')?.value || '宅配到府';
}

function calcShippingFee(ship, subtotal) {
  if (subtotal >= SHIPPING_FREE_THRESHOLD) return 0;
  return ship.includes('超商') ? SHIPPING_FEE.store : SHIPPING_FEE.home;
}

const ZERO_TOTAL_MESSAGE = '優惠折抵後應付金額為 NT$0，目前無法線上結帳，請聯絡客服協助處理';

function computeCouponDiscount(coupon, base) {
  if (!coupon) return 0;
  const amount = Math.max(0, Number(base) || 0);
  let discount = 0;
  if (coupon.type === 'percent') {
    discount = Math.floor(amount * (Number(coupon.value) / 100));
    if (coupon.maxDiscount != null && Number(coupon.maxDiscount) > 0) {
      discount = Math.min(discount, Number(coupon.maxDiscount));
    }
  } else {
    discount = Number(coupon.value) || 0;
  }
  return Math.max(0, Math.min(discount, amount));
}

function calcTotals(ship) {
  const subtotal    = getCartTotal();
  const shippingFee = calcShippingFee(ship, subtotal);
  const base        = subtotal + shippingFee;
  const discount    = computeCouponDiscount(appliedCoupon, base);
  return { subtotal, shippingFee, discount, finalTotal: Math.max(0, base - discount) };
}

let currentUser = null;
let authReady   = false;
onAuthStateChanged(auth, user => {
  currentUser = user;
  authReady   = true;
  updateCheckoutBtn();
  const userEmailEl = document.getElementById('userEmail');
  if (userEmailEl) userEmailEl.textContent = (user && user.emailVerified) ? user.email : '';
});

let stockState    = 'loading';
let outOfStockKeys = new Set();
let stockSeq       = 0;

const cartKey = item => `${item.id}_${item.size}`;
function hasOutOfStock() { return getCart().some(item => outOfStockKeys.has(cartKey(item))); }

async function checkCartStock() {
  const seq  = ++stockSeq;
  const cart = getCart();
  if (!cart.length) { stockState = 'success'; outOfStockKeys = new Set(); renderCart(); return; }
  stockState = 'loading';
  updateCheckoutBtn();
  try {
    const ids   = [...new Set(cart.map(item => item.id).filter(Boolean))];
    const snaps = await Promise.all(ids.map(id => getDoc(doc(db, 'products', id))));
    if (seq !== stockSeq) return;
    const products = new Map(snaps.map(s => [s.id, s.exists() ? s.data() : null]));
    const oos = new Set();
    cart.forEach(item => {
      const p = products.get(item.id);
      if (!p) return;
      const stock = Number(p.specs?.[item.size]?.stock) || 0;
      if (stock <= 0) oos.add(cartKey(item));
    });
    outOfStockKeys = oos;
    stockState = 'success';
  } catch (e) {
    if (seq !== stockSeq) return;
    console.warn('[Cart] 讀取庫存失敗：', e.message);
    outOfStockKeys = new Set();
    stockState = 'error';
  }
  renderCart();
}

function updateCheckoutBtn() {
  if (!checkoutBtn) return;
  if (!authReady || stockState === 'loading') {
    checkoutBtn.disabled    = true;
    checkoutBtn.textContent = '載入中...';
    return;
  }
  checkoutBtn.textContent = '前往結帳';
  checkoutBtn.disabled    = !getCart().length || hasOutOfStock();
}

let checkoutModalSeq = 0;
let checkoutPending  = 0;

let zeroTotal = false;

function refreshSubmitBtn() {
  const btn = document.getElementById('co-submit');
  if (!btn) return;
  btn.disabled    = checkoutPending > 0 || zeroTotal;
  btn.textContent = checkoutPending > 0 ? '載入中...' : '確認送出訂單';
}

async function trackPending(task) {
  const seq = checkoutModalSeq;
  checkoutPending++;
  refreshSubmitBtn();
  try {
    return await task(() => seq === checkoutModalSeq);
  } finally {
    if (seq === checkoutModalSeq) {
      checkoutPending = Math.max(0, checkoutPending - 1);
      refreshSubmitBtn();
    }
  }
}

async function getAuthHeader() {
  if (currentUser && currentUser.emailVerified) {
    try {
      const token = await currentUser.getIdToken();
      return { Authorization: `Bearer ${token}` };
    } catch (e) {
      console.warn('[Cart] 取得登入憑證失敗：', e.message);
    }
  }
  return {};
}

function getCart()      { return storeGetCart(); }
function saveCart(c)    { storeSaveCart(c); }

function updateCartBadge(cart) {
  if (typeof window.updateCartBadge === 'function') window.updateCartBadge();
}

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
    updateCheckoutBtn();
    return;
  }

  updateCheckoutBtn();

  const total = cart.reduce((s, item) => s + item.price * item.qty, 0);
  if (cartTotalEl) cartTotalEl.textContent = `NT$ ${total.toLocaleString()}`;

  const oosNotice = hasOutOfStock()
    ? `<p style="color:#b94a48;font-size:13px;margin:0 0 8px">購物車內有缺貨商品，請先移除後再結帳</p>`
    : '';

  cartListEl.innerHTML = oosNotice + cart.map((item, i) => `
    <div class="cart-item" data-i="${i}">
      <div class="cart-item-img">
        ${item.img
          ? `<img src="${esc(item.img)}" alt="${esc(item.name)}" loading="lazy">`
          : `<div class="cart-img-placeholder">🌿</div>`}
      </div>

      <div class="cart-item-info">
        <div class="cart-item-name">${esc(item.name)}</div>
        <div class="cart-item-spec muted">${esc(item.size || '')}</div>
        ${outOfStockKeys.has(cartKey(item)) ? '<div class="cart-item-spec" style="color:#b94a48">缺貨</div>' : ''}
        <div class="cart-item-price">NT$ ${Number(item.price).toLocaleString()}</div>
      </div>

      <div class="cart-item-qty">
        <button class="p-qty-btn qty-minus" data-i="${i}" type="button" aria-label="減少">−</button>
        <input class="qty-val" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="3" autocomplete="off" aria-label="數量" data-i="${i}" value="${item.qty}">
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

  cartListEl.querySelectorAll('.qty-minus').forEach(btn =>
    btn.addEventListener('click', () => changeQty(Number(btn.dataset.i), -1))
  );
  cartListEl.querySelectorAll('input.qty-val').forEach(input => {
    input.addEventListener('input', () => {
      const digits = input.value.replace(/[^0-9]/g, '');
      if (digits !== input.value) input.value = digits;
    });
    input.addEventListener('keydown', e => { if (e.key === 'Enter') input.blur(); });
    input.addEventListener('change', () => setQty(Number(input.dataset.i), input.value));
  });
  cartListEl.querySelectorAll('.qty-plus').forEach(btn =>
    btn.addEventListener('click', () => changeQty(Number(btn.dataset.i), +1))
  );
  cartListEl.querySelectorAll('.cart-remove').forEach(btn =>
    btn.addEventListener('click', () => removeItem(Number(btn.dataset.i)))
  );
}

const MAX_QTY_PER_ITEM = 999;

function setQty(i, raw) {
  const cart = getCart();
  if (!cart[i]) return;
  const n = parseInt(String(raw).replace(/[^0-9]/g, ''), 10);
  if (Number.isInteger(n) && n >= 1) cart[i].qty = Math.min(n, MAX_QTY_PER_ITEM);
  saveCart(cart);
  renderCart();
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

function openCheckoutModal() {
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

        <div class="co-field" id="co-addr-field">
          <label>收件地址 <span class="req">*</span></label>
          <input id="co-address" type="text" placeholder="縣市、鄉鎮市區、路段門號">
        </div>
        <div class="co-field" id="co-store-field" style="display:none">
          <label>門市名稱 / 門市編號 <span class="req">*</span></label>
          <input id="co-store" type="text" placeholder="e.g. 台中文心門市 123456">
        </div>

        <div class="co-section-label">優惠券</div>
        <div class="co-coupon-row">
          <input id="co-coupon-code" type="text" placeholder="輸入優惠碼" style="text-transform:uppercase">
          <button class="btn" id="co-coupon-apply" type="button">套用</button>
        </div>
        <div id="co-coupon-msg" class="co-coupon-msg" style="display:none"></div>
        <div id="co-coupon-applied" class="co-coupon-applied" style="display:none"></div>
        <button type="button" id="co-coupon-toggle" class="co-coupon-toggle">查看可用優惠券 ▾</button>
        <div id="co-coupon-list" class="co-coupon-list" style="display:none">
          <div class="co-coupon-list-loading">載入中...</div>
        </div>

        <div class="co-summary">
          <div class="co-summary-row">
            <span>商品小計</span>
            <span id="co-summary-subtotal">NT$ 0</span>
          </div>
          <div class="co-summary-row" id="co-summary-discount-row" style="display:none">
            <span>優惠折抵</span>
            <span id="co-summary-discount" class="co-summary-discount-val">-NT$ 0</span>
          </div>
          <div class="co-summary-row">
            <span>運費</span>
            <span id="co-summary-shipping">NT$ 0</span>
          </div>
          <div class="co-summary-row co-summary-total">
            <span>應付總額</span>
            <span id="co-summary-total">NT$ 0</span>
          </div>
        </div>

        <div class="co-field">
          <label>訂單備註</label>
          <textarea id="co-note" rows="2" placeholder="特殊需求、禮盒包裝等…"></textarea>
        </div>

        <div class="co-field">
          <label class="co-agree-label">
            <input type="checkbox" id="co-agree-policy">
            <span>我已閱讀並同意<a href="shopping-guide.html" target="_blank" rel="noopener">購物須知</a>、<a href="return-policy.html" target="_blank" rel="noopener">退換貨政策</a>、<a href="terms.html" target="_blank" rel="noopener">網站服務條款</a>及<a href="privacy.html" target="_blank" rel="noopener">隱私權政策</a></span>
          </label>
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

  checkoutModalSeq++;
  checkoutPending = 0;

  if (currentUser) {
    const emailEl = document.getElementById('co-email');
    if (emailEl) emailEl.value = currentUser.email;

    const uid     = currentUser.uid;
    const nameEl  = document.getElementById('co-name');
    const phoneEl = document.getElementById('co-phone');
    const origPlaceholders = [nameEl?.placeholder, phoneEl?.placeholder];
    if (nameEl)  nameEl.placeholder  = '載入中...';
    if (phoneEl) phoneEl.placeholder = '載入中...';

    trackPending(async isCurrent => {
      try {
        const snap = await getDoc(doc(db, 'members', uid));
        if (!isCurrent() || currentUser?.uid !== uid || !snap.exists()) return;
        const d = snap.data();
        if (nameEl  && d.name  && !nameEl.value)  nameEl.value  = d.name;
        if (phoneEl && d.phone && !phoneEl.value) phoneEl.value = d.phone;
      } catch (e) {
      } finally {
        if (nameEl)  nameEl.placeholder  = origPlaceholders[0] || '';
        if (phoneEl) phoneEl.placeholder = origPlaceholders[1] || '';
      }
    });
  }

  modal.querySelectorAll('input[name="ship"]').forEach(radio => {
    radio.addEventListener('change', () => {
      const isConvStore = radio.value.includes('超商');
      document.getElementById('co-addr-field').style.display  = isConvStore ? 'none' : '';
      document.getElementById('co-store-field').style.display = isConvStore ? ''     : 'none';
      renderCouponSummary();
    });
  });

  appliedCoupon  = null;
  couponDiscount = 0;
  renderCouponSummary();
  initCouponUI();

  const closeModal = () => { modal.remove(); document.body.style.overflow = ''; };
  modal.querySelector('.checkout-close')?.addEventListener('click', closeModal);
  document.getElementById('co-cancel')?.addEventListener('click', closeModal);
  modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });

  document.getElementById('co-submit')?.addEventListener('click', submitOrder);
}

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

  const totals = calcTotals(getSelectedShip());
  couponDiscount = totals.discount;

  if (appliedCoupon && couponDiscount > 0) {
    discountRow.style.display = '';
    discountEl.textContent = `-NT$ ${couponDiscount.toLocaleString()}`;
  } else {
    discountRow.style.display = 'none';
  }

  const shippingFee   = totals.shippingFee;
  const shippingEl    = document.getElementById('co-summary-shipping');
  if (shippingEl) {
    shippingEl.textContent = shippingFee > 0 ? `NT$ ${shippingFee.toLocaleString()}` : '免運';
  }
  totalEl.textContent = `NT$ ${totals.finalTotal.toLocaleString()}`;

  zeroTotal = totals.finalTotal <= 0;
  const errorEl = document.getElementById('co-error');
  if (errorEl) {
    if (zeroTotal) {
      errorEl.textContent   = ZERO_TOTAL_MESSAGE;
      errorEl.style.display = '';
    } else if (errorEl.textContent === ZERO_TOTAL_MESSAGE) {
      errorEl.textContent   = '';
      errorEl.style.display = 'none';
    }
  }
  refreshSubmitBtn();

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

  return trackPending(async isCurrent => {
  try {
    const authHeader = await getAuthHeader();
    const res = await fetch(`${COUPON_API}/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader },
      body: JSON.stringify({
        code,
        cartTotal: getCartTotal(),
      }),
    });

    if (!isCurrent()) return;

    if (res.status === 401) {
      msgEl.textContent = '登入狀態可能已失效，請重新登入後再試一次';
      msgEl.style.color = '#b94a48';
      msgEl.style.display = '';
      return;
    }

    const data = await res.json();
    if (!isCurrent()) return;

    if (!data.valid) {
      msgEl.textContent = data.reason || '此優惠碼無法使用';
      msgEl.style.color = '#b94a48';
      msgEl.style.display = '';
      return;
    }

    appliedCoupon  = data.coupon;
    document.getElementById('co-coupon-code').value = '';
    renderCouponSummary();

  } catch (e) {
    if (!isCurrent()) return;
    msgEl.textContent = '優惠券驗證失敗，請稍後再試';
    msgEl.style.color = '#b94a48';
    msgEl.style.display = '';
  }
  });
}

async function loadEligibleCoupons() {
  const listEl = document.getElementById('co-coupon-list');
  if (!listEl) return;
  const seq = checkoutModalSeq;
  listEl.innerHTML = `<div class="co-coupon-list-loading">載入中...</div>`;

  try {
    const authHeader = await getAuthHeader();
    const params = new URLSearchParams({
      cartTotal: getCartTotal(),
    });
    const res  = await fetch(`${COUPON_API}/eligible?${params}`, { headers: authHeader });
    const data = await res.json();
    if (seq !== checkoutModalSeq) return;
    if (!res.ok || !Array.isArray(data.coupons)) throw new Error(data.error || 'load failed');
    const coupons = data.coupons;

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
    if (seq !== checkoutModalSeq) return;
    listEl.innerHTML = `<div class="co-coupon-list-empty">資料載入失敗，請稍後再試</div>`;
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

async function submitOrder() {
  if (checkoutPending > 0 || zeroTotal) return;
  const submitBtn = document.getElementById('co-submit');
  const errorEl  = document.getElementById('co-error');

  const name    = document.getElementById('co-name')?.value.trim();
  const phone   = document.getElementById('co-phone')?.value.trim();
  const email   = document.getElementById('co-email')?.value.trim();
  const ship    = getSelectedShip();
  const isStore = ship.includes('超商');
  const address = isStore
    ? document.getElementById('co-store')?.value.trim()
    : document.getElementById('co-address')?.value.trim();
  const note    = document.getElementById('co-note')?.value.trim();

  const errors = [];
  if (!name)    errors.push('請填寫姓名');
  if (!phone)   errors.push('請填寫電話');
  if (!address) errors.push(isStore ? '請填寫門市資訊' : '請填寫收件地址');
  if (!document.getElementById('co-agree-policy')?.checked) {
    errors.push('請先閱讀並同意購物與網站政策');
  }

  if (errors.length) {
    errorEl.textContent  = errors.join('、');
    errorEl.style.display = '';
    return;
  }

  errorEl.style.display = 'none';
  submitBtn.disabled    = true;
  submitBtn.textContent = '送出中…';

  const cart  = getCart();
  const { finalTotal } = calcTotals(ship);

  try {
    const authHeader = await getAuthHeader();
    const res = await fetch('https://arochemy-backend-production.up.railway.app/api/orders', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader },
      body: JSON.stringify({
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

    if (res.status === 401) {
      errorEl.textContent  = '登入狀態可能已失效，請重新登入後再試一次';
      errorEl.style.display = '';
      submitBtn.disabled    = false;
      submitBtn.textContent = '確認送出訂單';
      return;
    }

    if (res.status === 403) {
      const errData = await res.json().catch(() => ({}));
      errorEl.textContent  = errData.message || '請先完成 Email 驗證後再使用會員功能';
      errorEl.style.display = '';
      submitBtn.disabled    = false;
      submitBtn.textContent = '確認送出訂單';
      return;
    }

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '送出失敗');


    redirectToPayment({
      orderId: data.orderId,
      total: data.total ?? finalTotal,
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

checkoutBtn?.addEventListener('click', () => {
  if (!authReady || stockState === 'loading' || hasOutOfStock()) return;
  if (!currentUser) {
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

function esc(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

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
  .co-agree-label {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    font-size: 13px;
    font-weight: 400;
    line-height: 1.6;
    cursor: pointer;
  }
  .co-agree-label input[type="checkbox"] {
    width: 16px;
    height: 16px;
    margin-top: 2px;
    flex-shrink: 0;
    cursor: pointer;
  }
  .co-agree-label a {
    color: #111;
    text-decoration: underline;
  }
  .co-agree-label a:hover { color: #555; }
  .co-ship-options { display: flex; flex-direction: column; gap: 8px; }
  .co-radio { display: flex; align-items: center; gap: 8px; font-size: 14px; cursor: pointer; }
  .co-radio input { accent-color: #111; }
  .req { color: #e55; }

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
  input.qty-val {
    width: 40px; padding: 2px 0; border: none; border-radius: 6px;
    background: transparent; color: inherit; font-family: inherit;
    outline: none;
  }
  input.qty-val:focus { background: #fff; box-shadow: 0 0 0 1px #ccc; }
  .cart-item-subtotal { font-size: 14px; font-weight: 700; white-space: nowrap; }
  .cart-remove {
    background: none; border: none; cursor: pointer;
    color: #bbb; padding: 4px;
    transition: color 0.15s;
  }
  .cart-remove:hover { color: #e55; }

  @media (max-width: 600px) {
    input.qty-val { font-size: 16px; }
    .cart-head .btn { white-space: nowrap; flex-shrink: 0; }
    .cart-item { flex-wrap: wrap; row-gap: 10px; }
    .cart-remove { order: 1; align-self: flex-start; margin-left: auto; }
    .cart-item-info { order: 2; flex: 1 1 100%; }
    .cart-item-qty, .cart-item-subtotal { order: 3; }
    .cart-item-subtotal { margin-left: auto; }
  }
`;
document.head.appendChild(style);

ownerReady.then(() => {
  renderCart();
  checkCartStock();
});

onOwnerChange(() => {
  if (document.getElementById('checkout-modal')) {
    document.getElementById('checkout-modal').remove();
    document.body.style.overflow = '';
  }
  renderCart();
  checkCartStock();
});
