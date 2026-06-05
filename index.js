import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  getDocs
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

async function loadProducts() {
  const snapshot = await getDocs(collection(db, "products"));

  const products = [];

  snapshot.forEach((doc) => {
    products.push({
      id: doc.id,
      ...doc.data()
    });
  });
  .filter((p) => p.status === "active");
  return products;
}

function fmtPrice(n) {
  return `NT$ ${Number(n).toLocaleString("zh-Hant-TW")}`;
}

function getMinPrice(product) {
  const prices = (product.variants || [])
    .map((v) => Number(v.price))
    .filter((n) => !Number.isNaN(n));

  return prices.length ? Math.min(...prices) : 0;
}

function getFeaturedProducts(products) {
  return products
    .filter((p) => p.status === "active" && p.featured === true)
    .slice(0, 3);
}

function getFeaturedDesc(product) {
  if (product.overview && product.overview["香氣概述"]) {
    return product.overview["香氣概述"];
  }

  if (Array.isArray(product.description) && product.description.length > 0) {
    return product.description[0].slice(0, 42) + "…";
  }

  return "探索這款來自植物的天然香氣。";
}

function cardHTML(product) {
  const img = product.images && product.images[0] ? product.images[0] : "";
  const minPrice = getMinPrice(product);
  const desc = getFeaturedDesc(product);

  return `
    <a class="product-card" href="product.html?slug=${encodeURIComponent(product.slug)}" aria-label="${product.name}">
      <div class="product-image">
        ${
          img
            ? `<img src="${img}" alt="${product.name}" loading="lazy">`
            : `<div class="product-image-fallback"></div>`
        }
      </div>
      <div class="product-body">
        <div class="product-title">${product.name}</div>
        <div class="product-desc muted">${desc}</div>
        <div class="product-price muted">${minPrice ? `${fmtPrice(minPrice)} 起` : ""}</div>
      </div>
    </a>
  `;
}

document.addEventListener("DOMContentLoaded", async () => {
  const featuredGrid = document.getElementById("featuredGrid");
  if (!featuredGrid) return;

  try {
    const products = await loadProducts();
    const featuredProducts = getFeaturedProducts(products);

    if (!featuredProducts.length) {
      featuredGrid.innerHTML = `<p class="muted">目前尚無精選產品。</p>`;
      return;
    }

    featuredGrid.innerHTML = featuredProducts.map(cardHTML).join("");
  } catch (err) {
    console.error(err);
    featuredGrid.innerHTML = `<p class="muted">精選產品載入失敗。</p>`;
  }
});
