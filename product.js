function getSlug() {
    return new URLSearchParams(location.search).get("slug");
}

async function loadProducts() {
    const res = await fetch("./products.json", {
        cache: "no-store"
    });
    if (!res.ok) throw new Error("products.json 讀取失敗");
    const data = await res.json();
    return data.products || [];
}

function fmtPrice(n) {
    return `NT$ ${Number(n).toLocaleString("zh-Hant-TW")}`;
}

let product = null;
let selectedVariantIndex = 0;
let qty = 1;

function mountBasic() {
    document.getElementById("bcName").textContent = product.name;
    document.getElementById("pName").textContent = product.name;
    document.getElementById("pEn").textContent = product.en || "";
    document.getElementById("pLatin").textContent = product.latin || "";

    document.getElementById("btnCOA").href = product.docs?.coa || "#";
    document.getElementById("btnSDS").href = product.docs?.sds || "#";
    document.getElementById("btnEU").href = product.docs?.eu || "#";
}

function updatePrice() {
    const base = product.variants[selectedVariantIndex].price;
    document.getElementById("pPrice").textContent = fmtPrice(base);
}

function mountVariants() {
    const wrap = document.getElementById("variantPills");
    wrap.innerHTML = "";

    product.variants.forEach((v, idx) => {
        const btn = document.createElement("button");
        btn.className = "p-pill" + (idx === selectedVariantIndex ? " active": "");
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
        qty = Number.isFinite(n) ? Math.min(99, Math.max(1, n)): 1;
        input.value = String(qty);
    });
}

function mountOverview() {
    const dl = document.getElementById("overviewKV");
    dl.innerHTML = "";
    (product.overview || []).forEach(({
        k, v
    }) => {
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

function mountLongText() {
    const desc = document.getElementById("descText");
    desc.innerHTML = (product.description || []).map(t => `<p>${t}</p>`).join("");

    const fillList = (id, arr) => {
        const ul = document.getElementById(id);
        ul.innerHTML = (arr || []).map(t => `<li>${t}</li>`).join("");
    };

    fillList("storageList", product.storage);
    fillList("usageList", product.usage);
    fillList("cautionList", product.caution);
}

function mountGallery() {
    const main = document.getElementById("mainImg");
    const thumbs = document.getElementById("thumbs");
    const imgs = product.images || [];

    const setMain = (idx) => {
        const url = imgs[idx];
        if (url) {
            main.style.background = "none";
            main.innerHTML = `<img src="${url}" alt="${product.name}" style="width:100%;height:100%;object-fit:cover;display:block;">`;
        } else {
            main.innerHTML = "";
            main.style.backgroundImage =
            "radial-gradient(circle at 30% 25%, rgba(0,0,0,.08), transparent 45%), linear-gradient(180deg, rgba(0,0,0,.03), rgba(0,0,0,.01))";
        }
    };

    thumbs.innerHTML = "";
    imgs.forEach((url, idx) => {
        const t = document.createElement("button");
        t.type = "button";
        t.className = "p-thumb" + (idx === 0 ? " active": "");
        t.setAttribute("aria-label", `thumb ${idx + 1}`);
        t.innerHTML = url
        ? `<img src="${url}" alt="" style="width:100%;height:100%;object-fit:cover;display:block;">`: "";
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

(async function initProductPage() {
    // 不是 product.html 就不要跑
    if (!document.getElementById("variantPills")) return;

    try {
        const slug = getSlug();
        const products = await loadProducts();
        product = products.find(p => p.slug === slug) || products[0];
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
