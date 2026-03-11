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
  const prices = (p.variants || [])
    .map(v => Number(v.price))
    .filter(n => !Number.isNaN(n));

  const minPrice = prices.length ? Math.min(...prices) : 0;
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
        <div class="p-name">${p.name || ""}</div>
        <div class="p-meta">${p.en || ""}</div>
        <div class="p-meta">${minPrice ? `${fmtPrice(minPrice)} 起` : ""}</div>
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

function renderProducts(allProducts, activeCat, grid, currentCat, totalCount) {
  const filtered = filterProducts(allProducts, activeCat);

  if (currentCat) {
    currentCat.textContent = CAT_LABEL[activeCat] || "全部商品";
  }

  if (totalCount) {
    totalCount.textContent = String(filtered.length);
  }

  if (grid) {
    grid.innerHTML = filtered.length
      ? filtered.map(cardHTML).join("")
      : `<p class="muted">此分類目前沒有商品</p>`;
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const grid = document.getElementById("productGrid");
  const catToggle = document.getElementById("catToggle");
  const catMenu = document.getElementById("catMenu");
  const currentCat = document.getElementById("currentCat");
  const totalCount = document.getElementById("totalCount");
  const catItems = document.querySelectorAll(".cat-item");

  if (!grid || !catToggle || !catMenu) return;

  let allProducts = [];
  let activeCat = getCategoryFromURL();

  // 點一下開關選單
  catToggle.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    const willOpen = !catMenu.classList.contains("open");
    catMenu.classList.toggle("open", willOpen);
    catToggle.setAttribute("aria-expanded", willOpen ? "true" : "false");
  });

  // 點選單內部不要冒泡出去
  catMenu.addEventListener("click", (e) => {
    e.stopPropagation();
    e.stopImmediatePropagation();
  });

  // 點分類
  catItems.forEach((item) => {
    item.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      activeCat = item.dataset.cat || "all";
      renderProducts(allProducts, activeCat, grid, currentCat, totalCount);
      updateURL(activeCat);

      catMenu.classList.remove("open");
      catToggle.setAttribute("aria-expanded", "false");
    });
  });

  // 延後綁定外部點擊，避免同一次 click 立刻把選單關掉
  setTimeout(() => {
    document.addEventListener("click", (e) => {
      const insideMenu = catMenu.contains(e.target);
      const insideToggle = catToggle.contains(e.target);

      if (!insideMenu && !insideToggle) {
        catMenu.classList.remove("open");
        catToggle.setAttribute("aria-expanded", "false");
      }
    });
  }, 0);

  // ESC 關閉選單
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      catMenu.classList.remove("open");
      catToggle.setAttribute("aria-expanded", "false");
    }
  });

  try {
    allProducts = await loadProducts();
    renderProducts(allProducts, activeCat, grid, currentCat, totalCount);
  } catch (err) {
    console.error(err);
    grid.innerHTML = `<p class="muted">商品載入失敗：${err.message}</p>`;
  }
});
