// product.js (slug version) — 純前端假資料版（之後可換成後台 API）

/** 1) 讀 slug（沒有就預設 taiwania） */
const slug = new URLSearchParams(location.search).get("slug") || "taiwania";

/** 2) 多商品資料（之後接 Strapi/Firestore 就把這塊改成 API 取得） */
const PRODUCTS = {
  taiwania: {
    name: "臺灣杉",
    en: "Taiwania",
    latin: "Taiwania cryptomerioides Hayata",
    variants: [
      { label: "5 ml", price: 666 },
      { label: "10 ml", price: 1280 },
      { label: "30 ml", price: 2666 },
    ],
    overview: [
      { k: "科屬", v: "柏科臺灣杉屬" },
      { k: "萃取部位", v: "木材" },
      { k: "萃取方法", v: "蒸餾" },
      { k: "植物產地", v: "臺灣" },
      { k: "香氣概述", v: "油潤柔和的木質香調，略帶一絲堅果味" },
      { k: "建議用途", v: "芳香療法、製作香水噴霧、蠟燭" },
    ],
    composition: [
      { name: "倍半萜類-醇類", value: 51.2 },
      { name: "倍半萜類", value: 34.7 },
      { name: "其他", value: 14.1 },
    ],
    docs: {
      coa: "assets/COA-sample.pdf",
      sds: "assets/SDS-sample.pdf",
      eu: "assets/EU-allergen-sample.pdf",
    },
    description: [
      "臺灣杉目前仍是唯一以臺灣（Taiwania）為屬名的物種，也是臺灣第一高樹，現今最高紀錄被命名為「大安溪倚天劍」。",
      "臺灣杉也被稱為「活化石」，在漫長演化史中仍維持極相近的形態。",
      "精油氣味內斂沉穩，具有堅果般醇厚濃郁的底蘊。",
    ],
    storage: ["放置於陰涼處，避免陽光直射。", "保存於孩童、寵物不可及之處。"],
    usage: [
      "搭配擴香工具使用（擴香石/水氧機等）。",
      "可與酒精調和製作空間芳香噴霧。",
      "個人護理用途請先以植物油稀釋，低濃度使用。",
    ],
    caution: [
      "不建議嬰幼兒、孕婦使用。",
      "體質敏感者使用前務必先行測試。",
      "切勿直接塗抹於黏膜與眼鼻等部位。",
    ],
    images: ["img1", "img2", "img3"],
  },

  lavender: {
    name: "薰衣草",
    en: "Lavender",
    latin: "Lavandula angustifolia",
    variants: [
      { label: "5 ml", price: 520 },
      { label: "10 ml", price: 980 },
    ],
    overview: [
      { k: "科屬", v: "唇形科" },
      { k: "萃取部位", v: "花穗" },
      { k: "萃取方法", v: "蒸餾" },
      { k: "植物產地", v: "法國（示意）" },
      { k: "香氣概述", v: "清甜草本花香" },
      { k: "建議用途", v: "放鬆、睡前擴香" },
    ],
    composition: [
      { name: "芳樟醇", value: 32.4 },
      { name: "乙酸芳樟酯", value: 28.1 },
      { name: "其他", value: 39.5 },
    ],
    docs: { coa: "#", sds: "#", eu: "#" },
    description: ["薰衣草常用於放鬆與睡前氛圍…（示意）"],
    storage: ["避光、密封保存。"],
    usage: ["睡前擴香 2–3 滴（示意）。"],
    caution: ["敏感肌請先稀釋測試。"],
    images: ["img1", "img2"],
  },
};

/** 3) 取出對應商品（找不到就 fallback） */
const product = PRODUCTS[slug] || PRODUCTS.taiwania;

/** 4) 狀態 */
let selectedVariantIndex = 0;
let qty = 1;

/** utils */
function formatPrice(n) {
  return `NT$ ${Number(n).toLocaleString("zh-Hant-TW")}`;
}

/** ===== Mount ===== */
function mountBasic() {
  document.getElementById("bcName").textContent = product.name;
  document.getElementById("pName").textContent = product.name;
  document.getElementById("pEn").textContent = product.en;
  document.getElementById("pLatin").textContent = product.latin;

  document.getElementById("btnCOA").href = product.docs.coa;
  document.getElementById("btnSDS").href = product.docs.sds;
  document.getElementById("btnEU").href = product.docs.eu;
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
      mountVariants();
      updatePrice();
    });
    wrap.appendChild(btn);
  });

  updatePrice();
}

function updatePrice() {
  const v = product.variants[selectedVariantIndex];
  document.getElementById("pPrice").textContent = formatPrice(v.price);
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
  const dl = document.getElementById("overviewKV");
  dl.innerHTML = "";
  product.overview.forEach(({ k, v }) => {
    const dt = document.createElement("dt");
    dt.textContent = k;
    const dd = document.createElement("dd");
    dd.textContent = v;
    dl.appendChild(dt);
    dl.appendChild(dd);
  });
}

function mountComposition() {
  const root = document.getElementById("compBars");
  root.innerHTML = "";

  product.composition.forEach((c) => {
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
    val.textContent = `${c.value.toFixed(2)}%`;

    row.appendChild(left);
    row.appendChild(val);
    root.appendChild(row);

    requestAnimationFrame(() => {
      fill.style.width = `${Math.max(0, Math.min(100, c.value))}%`;
    });
  });
}

function mountLongText() {
  const desc = document.getElementById("descText");
  desc.innerHTML = (product.description || []).map((t) => `<p>${t}</p>`).join("");

  const fillList = (id, arr) => {
    const ul = document.getElementById(id);
    ul.innerHTML = (arr || []).map((t) => `<li>${t}</li>`).join("");
  };

  fillList("storageList", product.storage);
  fillList("usageList", product.usage);
  fillList("cautionList", product.caution);
}

function mountGallery() {
  // 先用 placeholder：只做「可點縮圖切換 active」
  const main = document.getElementById("mainImg");
  const thumbs = document.getElementById("thumbs");

  const setMain = (idx) => {
    main.dataset.index = String(idx);
  };

  thumbs.innerHTML = "";
  (product.images || []).forEach((_, idx) => {
    const t = document.createElement("div");
    t.className = "p-thumb" + (idx === 0 ? " active" : "");
    t.addEventListener("click", () => {
      [...thumbs.children].forEach((el) => el.classList.remove("active"));
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

/** Init */
mountBasic();
mountGallery();
mountVariants();
mountQty();
mountOverview();
mountComposition();
mountLongText();
mountActions();
