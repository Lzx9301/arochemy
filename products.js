async function loadProducts() {
  const res = await fetch("/arochemy/products.json", { cache: "no-store" });
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

const CAT_LABEL = {
  all: "全部商品",
  "single-oil": "單方精油",
  blend: "複方精油",
  spray: "噴霧",
  massage: "按摩油",
  eyemask: "眼罩"
};

function getCategoryFromURL() {
  const params = new URLSearchParams(window.location.search);
  return params.get("category") || "all";
}

function updateURL(cat) {
  const url = new URL(window.location.href);
  if (cat === "all") {
    url.searchParams.delete("category");
  } else {
    url.searchParams.set("category", cat);
  }
  history.replaceState(null, "", url.toString());
}

function filterProducts(products, cat) {
  if (cat === "all") return products;
  return products.filter(p => p.category === cat);
}

(async function initProductsPage() {
  const grid = document.getElementById("productGrid");
  const catToggle = document.getElementById("catToggle");
  const catMenu = document.getElementById("catMenu");
  const currentCat = document.getElementById("currentCat");
  const totalCount = document.getElementById("totalCount");
  const catItems = document.querySelectorAll(".cat-item");

  if (!grid) return;

  let allProducts = [];

  try {
    allProducts = await loadProducts();

    let activeCat = getCategoryFromURL();
    let filtered = filterProducts(allProducts, activeCat);

    currentCat.textContent = CAT_LABEL[activeCat] || "全部商品";
    totalCount.textContent = filtered.length;
    grid.innerHTML = filtered.map(cardHTML).join("");

    // 開關選單
    catToggle?.addEventListener("click", (e) => {
  e.preventDefault();
  e.stopPropagation();

  const willOpen = !catMenu.classList.contains("open");
  catMenu.classList.toggle("open", willOpen);
  catToggle.setAttribute("aria-expanded", willOpen ? "true" : "false");
});

    // 點分類
    catItems.forEach(item => {
      item.addEventListener("click", () => {
        const cat = item.dataset.cat || "all";
        const filtered = filterProducts(allProducts, cat);

        currentCat.textContent = CAT_LABEL[cat] || "全部商品";
        totalCount.textContent = filtered.length;
        grid.innerHTML = filtered.map(cardHTML).join("");

        updateURL(cat);

        catMenu.classList.remove("open");
        catToggle.setAttribute("aria-expanded", "false");
      });
    });

catMenu?.addEventListener("click", (e) => {
  e.stopPropagation();
});
    
    // 點外面關閉
document.addEventListener("click", (e) => {
  if (!catMenu.classList.contains("open")) return;

  const insideMenu = catMenu.contains(e.target);
  const insideToggle = catToggle.contains(e.target);

  if (!insideMenu && !insideToggle) {
    catMenu.classList.remove("open");
    catToggle.setAttribute("aria-expanded", "false");
  }
});

    // ESC 關閉
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        catMenu.classList.remove("open");
        catToggle.setAttribute("aria-expanded", "false");
      }
    });

  } catch (err) {
    console.error(err);
    grid.innerHTML = `<p class="muted">商品載入失敗：${err.message}</p>`;
  }
})();
