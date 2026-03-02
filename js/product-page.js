function getSlug() {
  const p = new URLSearchParams(location.search);
  return p.get("slug");
}

async function loadData() {
  const res = await fetch("/arochemy/products.json", { cache: "no-store" });
  if (!res.ok) throw new Error("products.json 讀取失敗");
  return await res.json(); // ✅回傳整包物件
}

function fmtPrice(n) {
  return `NT$ ${Number(n).toLocaleString("zh-Hant-TW")}`;
}

let product = null;
let selectedVariantIndex = 0;
let qty = 1;
let siteDefaults = null;

function mountBasic() {
  document.getElementById("bcName").textContent = product.name;
  document.getElementById("pName").textContent = product.name;
  document.getElementById("pEn").textContent = product.en || "";
  document.getElementById("pLatin").textContent = product.latin || "";

  document.getElementById("btnCOA").href = product.docs?.coa || "#";
  document.getElementById("btnSDS").href = product.docs?.sds || "#";
  document.getElementById("btnEU").href  = product.docs?.eu  || "#";
}

function mountVariants() {
  const wrap = document.getElementById("variantPills");
  wrap.innerHTML = "";

  product.variants.forEach((v, idx) => {
    const btn = document.createElement("button");
    btn.className = "p-pill" + (idx === selectedVariantIndex ? " active" : "");
    btn.type = "button";
    btn.textContent = v.label;

    btn.addEventListener("click", () => {
      selectedVariantIndex = idx;
      updatePrice();
      mountVariants();
    });

    wrap.appendChild(btn);
  });

  updatePrice();
}

function updatePrice() {
  const base = product.variants[selectedVariantIndex].price;
  document.getElementById("pPrice").textContent = fmtPrice(base);
}

function mountQty() {
  const input = document.getElementById("qtyInput");
  input.value = String(qty);

  document.getElementById("qtyMinus").addEventListener("click", () => {
    qty = Math.max(1, qty - 1);
    input.value = String(qty);
  });

  document.getElementById("qtyPlus").addEventListener("click", () => {
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
  const dl = document.getElementById("overview");
  dl.innerHTML = "";

  const ov = product.overview;

  // ✅ 情況 A：overview 是陣列 [{k,v}, ...]
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

  // ✅ 情況 B：overview 是物件 {"科屬":"...", ...}
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

  // ✅ 情況 C：overview 不存在或是字串 → 顯示提示（不中斷頁面）
  const dt = document.createElement("dt");
  dt.textContent = "產品概述";
  const dd = document.createElement("dd");
  dd.textContent = "（尚未填寫）";
  dl.appendChild(dt);
  dl.appendChild(dd);
}

function mountComposition() {
  const root = document.getElementById("compBars");
  root.innerHTML = "";

  (product.composition || []).forEach((c) => {
    const row = document.createElement("div");
    row.className = "p-bar";

    const left = document.createElement("div");

    const name = document.createElement("div");
    name.className = "p-bar-name";
    name.textContent = c.name;

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
    val.textContent = `${Number(c.value).toFixed(2)}%`;

    row.appendChild(left);
    row.appendChild(val);
    root.appendChild(row);

    requestAnimationFrame(() => {
      fill.style.width = `${Math.max(0, Math.min(100, Number(c.value)))}%`;
    });
  });
}

const DEFAULT_STORAGE = [
  "放置於陰涼處，避免陽光直射。",
  "保存於孩童、寵物不可及之處。",
];

const DEFAULT_USAGE = [
  "純精油可搭配擴香工具使用，如擴香石、水氧機等。",
  "若作個人護理用途，請先以植物油稀釋後再使用。",
];

const DEFAULT_CAUTION = [
  "不建議嬰幼兒、孕婦使用。",
  "體質敏感者使用前請先做局部測試。",
  "避免接觸眼睛、黏膜與傷口。",
];

function mountLongText() {
  // 個別精油說明（每個精油自己寫）
  const desc = document.getElementById("descText");
  desc.innerHTML = (product.description || []).map(t => `<p>${t}</p>`).join("");

  // 固定模板（全站共用）
  const fillList = (id, arr) => {
    const ul = document.getElementById(id);
    ul.innerHTML = (arr || []).map(t => `<li>${t}</li>`).join("");
  };

fillList("storageList", (product.storage && product.storage.length) ? product.storage : DEFAULT_STORAGE);
fillList("usageList", (product.usage && product.usage.length) ? product.usage : DEFAULT_USAGE);
fillList("cautionList", (product.caution && product.caution.length) ? product.caution : DEFAULT_CAUTION);
}

function mountGallery() {
  const main = document.getElementById("mainImg");
  const thumbs = document.getElementById("thumbs");
  const imgs = product.images || [];

  const setMain = (idx) => {
    const url = imgs[idx];
    if (url) {
      main.innerHTML = `<img src="${url}" alt="${product.name}" style="width:100%;height:100%;object-fit:cover;display:block;">`;
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

function mountActions() {
  document.getElementById("btnFav").addEventListener("click", () => alert("（測試）已收藏"));
  document.getElementById("btnCart").addEventListener("click", () => {
    const v = product.variants[selectedVariantIndex];
    alert(`（測試）加入購物車：${product.name} ${v.label} x ${qty}`);
  });
  document.getElementById("btnBuy").addEventListener("click", () => {
    const v = product.variants[selectedVariantIndex];
    alert(`（測試）立即購買：${product.name} ${v.label} x ${qty}`);
  });
}

(async function init() {
  try {
    const slug = getSlug();

    const data = await loadData();         // ✅ data 是物件
    siteDefaults = data.siteDefaults || null;

    const products = data.products || [];  // ✅ products 是陣列
    product = products.find(p => p.slug === slug) || products[0];
    if (!product) throw new Error("找不到任何商品資料");

    selectedVariantIndex = 0;

    mountBasic();
    mountGallery();
    mountVariants();
    mountQty();
    mountOverview();     // ✅改這裡（不是 mountOverviewKV）
    mountComposition();
    mountLongText();
    mountActions();
  } catch (err) {
    console.error(err);
    document.querySelector("main").innerHTML =
      `<p class="muted">商品載入失敗：${err.message}</p>`;
  }
})();
