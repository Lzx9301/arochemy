// products.js — 由資料自動生成商品卡（純前端）
// 之後接 Strapi/Firestore：把這個 PRODUCTS 換成 API 取得即可

const PRODUCTS = [
  {
    slug: "taiwania",
    name: "臺灣杉",
    en: "Taiwania",
    priceFrom: 666,
    tags: ["合科", "建議另計"],
  },
  {
    slug: "lavender",
    name: "薰衣草",
    en: "Lavender",
    priceFrom: 520,
    tags: ["花香", "熱銷"],
  },
];

function formatPrice(n) {
  return `NT$ ${Number(n).toLocaleString("zh-Hant-TW")} 起`;
}

function mountProducts() {
  const grid = document.getElementById("productGrid");
  if (!grid) return;

  grid.innerHTML = PRODUCTS.map((p) => {
    const tags = (p.tags || []).map(t => `<span class="p-chip">${t}</span>`).join("");
    return `
      <a class="p-card2" href="product.html?slug=${encodeURIComponent(p.slug)}">
        <div class="p-card2-media" aria-label="${p.name} image"></div>
        <div class="p-card2-body">
          <div class="p-card2-title">${p.name}</div>
          <div class="p-card2-sub">${p.en}</div>
          <div class="p-card2-bottom">
            <div class="p-card2-price">${formatPrice(p.priceFrom)}</div>
            <div class="p-card2-tags">${tags}</div>
          </div>
        </div>
      </a>
    `;
  }).join("");
}

mountProducts();
