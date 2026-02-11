// product.js — 單一商品頁（對應你目前 HTML 的 id）
const slug = new URLSearchParams(location.search).get("slug") || "taiwania";

const product = {
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
    "臺灣杉目前仍是唯一以臺灣（Taiwania）為屬名的物種，也是臺灣第一高樹……",
    "更令人驚嘆的是，台灣杉也是著名的「活化石」……",
    "臺灣杉木材精油成分大多是倍半萜類化合物……",
    "近期研究以電腦模擬探索可能的生理調節潛力……",
  ],
  storage: [
    "放置於陰涼處，避免陽光直射。",
    "保存於孩童、寵物不可及之處。",
  ],
  usage: [
    "可搭配擴香工具使用，如擴香石、水氧機等。",
    "可與酒精調和，製作空間或衣物芳香噴霧。",
    "個人護理用途需以植物油稀釋，建議低濃度使用。",
  ],
  caution: [
    "不建議嬰幼兒、孕婦使用。",
    "體質敏感者，使用前務必先進行測試。",
    "切勿直接塗抹於皮膚、黏膜、眼睛、耳道等部位。",
    "如有刺激反應，先以大量植物油稀釋再清洗，必要時就醫。",
  ],
  images: ["img1", "img2", "img3"], // placeholder
};

let selectedVariantIndex = 2; // 預設 30 ml
let qty = 1;

function $(id) {
  const node = document.getElementById(id);
  if (!node) console.warn(`找不到 #${id}`);
  return node;
}

function formatPrice(n) {
  return `NT$ ${n.toLocaleString("zh-Hant-TW")}`;
}

function mountBasic() {
  $("bcName").textContent = product.name;
  $("pName").textContent = product.name;
  $("pEn").textContent = product.en;
  $("pLatin").textContent = product.latin;

  $("btnCOA").href = product.docs.coa;
  $("btnSDS").href = product.docs.sds;
  $("btnEU").href = product.docs.eu;
}

function updatePrice() {
  const base = product.variants[selectedVariantIndex]?.price ?? product.variants[0].price;
  $("pPrice").textContent = formatPrice(base);
}

function mountVariants() {
  const wrap = $("variantPills");
  wrap.innerHTML = "";

  product.variants.forEach((v, idx) => {
    const btn = document.createElement("button");
    btn.className = "p-pill" + (idx === selectedVariantIndex ? " active" : "");
    btn.type = "button";
    btn.textContent = v.label;

    btn.addEventListener("click", () => {
      selectedVariantIndex = idx;
      wrap.querySelectorAll(".p-pill").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      updatePrice();
    });

    wrap.appendChild(btn);
  });

  updatePrice();
}

function mountQty() {
  const input = $("qtyInput");
  input.value = String(qty);

  $("qtyMinus").addEventListener("click", () => {
    qty = Math.max(1, qty - 1);
    input.value = String(qty);
  });

  $("qtyPlus").addEventListener("click", () => {
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
  const dl = $("overviewKV");
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
  const root = $("compBars");
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
  $("descText").innerHTML = product.description.map(t => `<p>${t}</p>`).join("");

  const fillList = (id, arr) => {
    const ul = $(id);
    ul.innerHTML = arr.map(t => `<li>${t}</li>`).join("");
  };

  fillList("storageList", product.storage);
  fillList("usageList", product.usage);
  fillList("cautionList", product.caution);
}

function mountGallery() {
  const main = $("mainImg");
  const thumbs = $("thumbs");

  const setMain = (idx) => {
    main.dataset.index = String(idx); // 先用 placeholder
  };

  thumbs.innerHTML = "";
  product.images.forEach((_, idx) => {
    const t = document.createElement("div");
    t.className = "p-thumb" + (idx === 0 ? " active" : "");
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
  $("btnFav").addEventListener("click", () => alert("（測試）已收藏"));

  $("btnCart").addEventListener("click", () => {
    const v = product.variants[selectedVariantIndex];
    alert(`（測試）加入購物車：${product.name} ${v.label} x ${qty}`);
  });

  $("btnBuy").addEventListener("click", () => {
    const v = product.variants[selectedVariantIndex];
    alert(`（測試）立即購買：${product.name} ${v.label} x ${qty}`);
  });
}

// init
mountBasic();
mountGallery();
mountVariants();
mountQty();
mountOverview();
mountComposition();
mountLongText();
mountActions();


