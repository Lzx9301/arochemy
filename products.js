async function loadProducts() {
  const res = await fetch("./products.json", { cache: "no-store" });
  if (!res.ok) throw new Error("products.json 讀取失敗");
  const data = await res.json();
  return data.products || [];
}

function fmtPrice(n) {
  return `NT$ ${Number(n).toLocaleString("zh-Hant-TW")}`;
}

function cardHTML(p) {
  const minPrice = Math.min(...(p.variants || []).map(v => v.price));
  const img = (p.images && p.images[0]) ? p.images[0] : "";

  return `
    <a class="p-card" href="product.html?slug=${encodeURIComponent(p.slug)}">
      <div class="p-media">
        ${
          img
            ? `<img src="${img}" alt="${p.name}" style="width:100%;height:100%;object-fit:cover;display:block;">`
            : `<div class="p-img plant"></div>`
        }
      </div>
      <div class="p-body">
        <div class="p-name">${p.name}</div>
        <div class="p-meta">${p.en || ""}</div>
        <div class="p-meta">${fmtPrice(minPrice)} 起</div>
      </div>
    </a>
  `;
}

(async function initProductsPage() {
  const grid = document.getElementById("productGrid");
  if (!grid) return; // 不是 products.html 就直接不做事

  try {
    const products = await loadProducts();
    grid.innerHTML = products.map(cardHTML).join("");
  } catch (err) {
    console.error(err);
    grid.innerHTML = `<p class="muted">商品載入失敗（請確認 products.json 路徑與 GitHub Pages 部署）</p>`;
  }
})();
