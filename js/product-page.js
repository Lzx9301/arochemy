// product-page.js (final)

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  getDocs,
  query,
  where,
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAgRq-fVWsQuyO2odbfVEjgOZoHyACEApI",
  authDomain: "trying-89dc6.firebaseapp.com",
  projectId: "trying-89dc6",
  storageBucket: "trying-89dc6.firebasestorage.app",
  messagingSenderId: "115559148124",
  appId: "1:115559148124:web:ac37b9c249183a919b5499",
  measurementId: "G-KHR4PVKJCK"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

function getSlug() {
  return new URLSearchParams(location.search).get("slug");
}

async function loadProductBySlug(slug) {
  const q = query(
    collection(db, "products"),
    where("slug", "==", slug)
  );

  const snapshot = await getDocs(q);

  if (snapshot.empty) return null;

  const doc = snapshot.docs[0];

  return {
    id: doc.id,
    ...doc.data()
  };
}

async function loadProductDefaults() {
  const ref = doc(db, "site_settings", "product_defaults");
  const snap = await getDoc(ref);

  if (!snap.exists()) return null;

  return snap.data();
}

function fmtPrice(n) {
  return `NT$ ${Number(n).toLocaleString("zh-Hant-TW")}`;
}

// ===== state =====
let product = null;
let selectedVariantIndex = 0;
let qty = 1;
let siteDefaults = null;

// ===== mount =====
function mountBasic() {
  document.getElementById("bcName").textContent = product.name || "";
  document.getElementById("pName").textContent = product.name || "";
  document.getElementById("pEn").textContent = product.en || "";
  document.getElementById("pLatin").textContent = product.latin || "";

  document.getElementById("btnCOA").href = product.docs?.coa || "#";
  document.getElementById("btnSDS").href = product.docs?.sds || "#";
  document.getElementById("btnEU").href  = product.docs?.eu  || "#";
}

function updatePrice() {
  const base = product.variants?.[selectedVariantIndex]?.price ?? 0;
  document.getElementById("pPrice").textContent = fmtPrice(base);
}

function mountVariants() {
  const wrap = document.getElementById("variantPills");
  if (!wrap) return;

  wrap.innerHTML = "";

  (product.variants || []).forEach((v, idx) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "p-pill" + (idx === selectedVariantIndex ? " active" : "");
    btn.textContent = v.label || "";

    btn.addEventListener("click", () => {
      selectedVariantIndex = idx;
      mountVariants(); // 重新畫 active 狀態
      updatePrice();
    });

    wrap.appendChild(btn);
  });

  updatePrice();
}

function mountQty() {
  const input = document.getElementById("qtyInput");
  if (!input) return;

  const minus = document.getElementById("qtyMinus");
  const plus  = document.getElementById("qtyPlus");

  input.value = String(qty);

  minus?.addEventListener("click", () => {
    qty = Math.max(1, qty - 1);
    input.value = String(qty);
  });

  plus?.addEventListener("click", () => {
    qty = Math.min(99, qty + 1);
    input.value = String(qty);
  });

  input.addEventListener("input", () => {
    const n = parseInt(input.value, 10);
    qty = Number.isFinite(n) ? Math.min(99, Math.max(1, n)) : 1;
    input.value = String(qty);
  });
}

function mountOverview() {
  // ✅你的 HTML 原本是 id="overviewKV"
  // 如果你 HTML 是 id="overview"，改成 const dl = document.getElementById("overview");
  const dl = document.getElementById("overviewKV");
  if (!dl) return;

  dl.innerHTML = "";

  const ov = product.overview;

  if (Array.isArray(ov)) {
    ov.forEach(({ k, v }) => {
      const dt = document.createElement("dt");
      dt.textContent = k ?? "";
      const dd = document.createElement("dd");
      dd.textContent = v ?? "";
      dl.appendChild(dt);
      dl.appendChild(dd);
    });
    return;
  }

  if (ov && typeof ov === "object") {
    Object.entries(ov).forEach(([k, v]) => {
      const dt = document.createElement("dt");
      dt.textContent = k;
      const dd = document.createElement("dd");
      dd.textContent = String(v ?? "");
      dl.appendChild(dt);
      dl.appendChild(dd);
    });
    return;
  }

  // 沒資料也不要讓頁面壞掉
  const dt = document.createElement("dt");
  dt.textContent = "產品概述";
  const dd = document.createElement("dd");
  dd.textContent = "（尚未填寫）";
  dl.appendChild(dt);
  dl.appendChild(dd);
}

function mountComposition() {
  const root = document.getElementById("compBars");
  if (!root) return;

  root.innerHTML = "";

  (product.composition || []).forEach((c) => {
    const row = document.createElement("div");
    row.className = "p-bar";

    const left = document.createElement("div");

    const name = document.createElement("div");
    name.className = "p-bar-name";
    name.textContent = c.name || "";

    const track = document.createElement("div");
    track.className = "p-bar-track";

    const fill = document.createElement("div");
    fill.className = "p-bar-fill";
    fill.style.width = "0%";

    track.appendChild(fill);
    left.appendChild(name);
    left.appendChild(track);

    const val = document.createElement("div");
    val.className = "p-bar-val";
    val.textContent = `${Number(c.value || 0).toFixed(2)}%`;

    row.appendChild(left);
    row.appendChild(val);
    root.appendChild(row);

    requestAnimationFrame(() => {
      fill.style.width = `${Math.max(0, Math.min(100, Number(c.value || 0)))}%`;
    });
  });
}

function mountGallery() {
  const main = document.getElementById("mainImg");
  const thumbs = document.getElementById("thumbs");
  if (!main || !thumbs) return;

  const imgs = product.images || [];

  const setMain = (idx) => {
    const url = imgs[idx];
    if (url) {
      main.innerHTML = `<img src="${url}" alt="${product.name || ""}" style="width:100%;height:100%;object-fit:cover;display:block;">`;
    } else {
      main.innerHTML = "";
    }
  };

  thumbs.innerHTML = "";
  imgs.forEach((url, idx) => {
    const t = document.createElement("button");
    t.type = "button";
    t.className = "p-thumb" + (idx === 0 ? " active" : "");
    t.innerHTML = `<img src="${url}" alt="" style="width:100%;height:100%;object-fit:cover;display:block;">`;

    t.addEventListener("click", () => {
      [...thumbs.children].forEach(el => el.classList.remove("active"));
      t.classList.add("active");
      setMain(idx);
    });

    thumbs.appendChild(t);
  });

  setMain(0);
}

function mountLongText() {
  const desc = document.getElementById("descText");
  if (desc) {
    desc.innerHTML = (product.description || []).map(t => `<p>${t}</p>`).join("");
  }

  const defaults = siteDefaults || {};
  const storage = (product.storage?.length) ? product.storage : (defaults.storage || []);
  const usage   = (product.usage?.length)   ? product.usage   : (defaults.usage || []);
  const caution = (product.caution?.length) ? product.caution : (defaults.caution || []);

  const fillList = (id, arr) => {
    const ul = document.getElementById(id);
    if (!ul) return;
    ul.innerHTML = (arr || []).map(t => `<li>${t}</li>`).join("");
  };

  fillList("storageList", storage);
  fillList("usageList", usage);
  fillList("cautionList", caution);
}

function mountActions() {
  document.getElementById("btnFav")?.addEventListener("click", () => alert("（測試）已收藏"));

document.getElementById("btnCart")?.addEventListener("click", () => {
  const v = product.variants?.[selectedVariantIndex];
  if (!v) return;

  const CART_KEY = "arochemy_cart";
  const cart = JSON.parse(localStorage.getItem(CART_KEY) || "[]");

  const itemKey = `${product.slug}_${v.label}`;

  const existing = cart.find((item) => item.key === itemKey);

  if (existing) {
    existing.qty += qty;
  } else {
    cart.push({
      key: itemKey,
      slug: product.slug,
      name: product.name,
      variantLabel: v.label,
      price: Number(v.price),
      qty,
      image: product.images?.[0] || ""
    });
  }

  localStorage.setItem(CART_KEY, JSON.stringify(cart));

  alert(`已加入購物車：${product.name} ${v.label} x ${qty}`);
});;

  document.getElementById("btnBuy")?.addEventListener("click", () => {
    const v = product.variants?.[selectedVariantIndex];
    alert(`（測試）立即購買：${product.name} ${v?.label || ""} x ${qty}`);
  });
}

// ===== init =====
(async function init() {
  try {
    const slug = getSlug();

if (!slug) {
  throw new Error("網址缺少 slug");
}

product = await loadProductBySlug(slug);

if (!product) {
  throw new Error("找不到商品");
}

siteDefaults = await loadProductDefaults();
    if (!product) throw new Error("找不到任何商品資料");

    selectedVariantIndex = 0;

    mountBasic();
    mountGallery();
    mountVariants();
    mountQty();
    mountOverview();
    mountComposition();
    mountLongText();
    mountActions();
  } catch (err) {
    console.error(err);
    document.querySelector("main").innerHTML =
      `<p class="muted">商品載入失敗：${err.message}</p>`;
  }
})();
