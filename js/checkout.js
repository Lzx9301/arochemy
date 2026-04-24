import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getFirestore,
  collection,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
  getAuth,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyAgRq-fVWsQuyO2odbfVEjgOZoHyACEApI",
  authDomain: "trying-89dc6.firebaseapp.com",
  projectId: "trying-89dc6",
  storageBucket: "trying-89dc6.firebasestorage.app",
  messagingSenderId: "115559148124",
  appId: "1:115559148124:web:ac37b9c249183a919b5499",
  measurementId: "G-KHR4PVKJCK"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const CART_KEY = "arochemy_cart";
let currentUser = null;

const $ = (id) => document.getElementById(id);

function fmtPrice(n) {
  return `NT$ ${Number(n).toLocaleString("zh-Hant-TW")}`;
}

function getCart() {
  return JSON.parse(localStorage.getItem(CART_KEY) || "[]");
}

function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

function getTotal(cart) {
  return cart.reduce((sum, item) => {
    return sum + Number(item.price || 0) * Number(item.qty || 0);
  }, 0);
}

function renderCheckout() {
  const cart = getCart();
  const itemsEl = $("checkoutItems");
  const totalEl = $("checkoutTotal");

  if (!cart.length) {
    itemsEl.innerHTML = `<p class="muted">購物車是空的。</p>`;
    totalEl.textContent = "NT$ 0";
    $("placeOrderBtn").disabled = true;
    return;
  }

  itemsEl.innerHTML = cart.map((item) => {
    const subtotal = Number(item.price) * Number(item.qty);

    return `
      <div class="checkout-item">
        <div class="checkout-item-title">${item.name}</div>
        <div class="checkout-item-meta">
          ${item.variantLabel} × ${item.qty}
        </div>
        <div>${fmtPrice(subtotal)}</div>
      </div>
    `;
  }).join("");

  totalEl.textContent = fmtPrice(getTotal(cart));
}

function getShippingLabel(value) {
  const map = {
    "711-cod": "7-11 貨到付款",
    "711-card": "7-11 刷卡付款",
    "family-cod": "全家 貨到付款",
    "family-card": "全家 刷卡付款",
    "home-card": "宅配 刷卡付款"
  };

  return map[value] || value;
}

onAuthStateChanged(auth, (user) => {
  currentUser = user;

  if (user) {
    $("buyerEmail").value = user.email || "";
  }
});

$("placeOrderBtn")?.addEventListener("click", async () => {
  const msg = $("checkoutMsg");
  const cart = getCart();

  if (!cart.length) {
    msg.textContent = "購物車是空的，無法建立訂單。";
    return;
  }

  const name = $("buyerName").value.trim();
  const phone = $("buyerPhone").value.trim();
  const email = $("buyerEmail").value.trim();
  const shippingMethod = $("shippingMethod").value;
  const address = $("address").value.trim();
  const note = $("note").value.trim();

  if (!name || !phone || !email || !address) {
    msg.textContent = "請填寫姓名、電話、Email 與收件地址 / 門市資訊。";
    return;
  }

  const order = {
    userId: currentUser?.uid || null,
    userEmail: currentUser?.email || email,

    customer: {
      name,
      phone,
      email
    },

    shipping: {
      method: shippingMethod,
      methodLabel: getShippingLabel(shippingMethod),
      address
    },

    payment: {
      provider: "ecpay",
      status: "pending",
      method:
        shippingMethod.includes("cod")
          ? "cod"
          : "credit-card"
    },

    items: cart,
    total: getTotal(cart),
    status: "pending",
    note,

    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  try {
    msg.textContent = "訂單建立中...";

    const docRef = await addDoc(collection(db, "orders"), order);

    saveCart([]);
    window.updateCartBadge?.();

    msg.textContent = `訂單已建立，訂單編號：${docRef.id}`;

    setTimeout(() => {
      window.location.href = `order-success.html?orderId=${docRef.id}`;
    }, 800);
  } catch (err) {
    console.error(err);
    msg.textContent = `訂單建立失敗：${err.message}`;
  }
});

renderCheckout();
