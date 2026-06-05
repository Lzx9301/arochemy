import {
    initializeApp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
    getFirestore,
    doc,
    setDoc,
    getDoc,
    collection,
    getDocs,
    query,
    orderBy,
    updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
    getAuth,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
    getStorage,
    ref,
    uploadBytes,
    getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

/* 主專案：Firestore / Auth */
const firebaseConfig = {
    apiKey: "AIzaSyAgRq-fVWsQuyO2odbfVEjgOZoHyACEApI",
    authDomain: "trying-89dc6.firebaseapp.com",
    projectId: "trying-89dc6",
    storageBucket: "trying-89dc6.firebasestorage.app",
    messagingSenderId: "115559148124",
    appId: "1:115559148124:web:ac37b9c249183a919b5499",
    measurementId: "G-KHR4PVKJCK"
};

/* 舊專案：暫時放商品圖片 */
const storageConfig = {
    apiKey: "AIzaSyAdS--elaCvzQOAPhMDPByLoTRXGibC9Rc",
    authDomain: "octo-7c190.firebaseapp.com",
    projectId: "octo-7c190",
    storageBucket: "octo-7c190.firebasestorage.app",
    messagingSenderId: "351002657731",
    appId: "1:351002657731:web:9db320ed4723e74a2a7376"
};

const app = initializeApp(firebaseConfig);
const storageApp = initializeApp(storageConfig, "storageApp");

const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(storageApp);

const ADMIN_EMAIL = "nicoliu930226@gmail.com";
const $ = (id) => document.getElementById(id);

let currentImages = [];
let usersLoaded = false;
let ordersLoaded = false;
let allOrders = [];
let currentOrderFilter = "all";
let currentOrderSearch = "";

const PAYMENT_STATUS_LABELS = {
    pending: "未付款",
    paid: "已付款",
    refunding: "退款中",
    refunded: "已退款"
};

const ORDER_STATUS_LABELS = {
    pending: "處理中",
    shipped: "已出貨",
    completed: "已完成",
    cancelled: "已取消"
};

/* 管理員登入 */
const loginBox = $("loginBox");
const adminBox = $("adminBox");
const loginBtn = $("loginBtn");
const logoutBtn = $("logoutBtn");
const loginMsg = $("loginMsg");

loginBtn?.addEventListener("click", async () => {
    loginMsg.textContent = "登入中...";

    try {
        await signInWithEmailAndPassword(
            auth,
            $("adminEmail").value.trim(),
            $("adminPassword").value
        );
    } catch (err) {
        console.error(err);
        loginMsg.textContent = "登入失敗，請確認 Email 或密碼";
    }
});

logoutBtn?.addEventListener("click", async () => {
    await signOut(auth);
});

onAuthStateChanged(auth, (user) => {
    if (user && user.email === ADMIN_EMAIL) {
        loginBox.style.display = "none";
        adminBox.style.display = "block";
        loginMsg.textContent = "";
    } else {
        loginBox.style.display = "block";
        adminBox.style.display = "none";

        if (user && user.email !== ADMIN_EMAIL) {
            loginMsg.textContent = "此帳號沒有管理員權限";
            signOut(auth);
        }
    }
});

/* 後台切換：商品 / 會員 / 訂單 */
document.querySelectorAll(".admin-tab").forEach((tab) => {
    tab.addEventListener("click", async (e) => {
        e.preventDefault();

        const target = tab.dataset.panel;

        document.querySelectorAll(".admin-tab").forEach((btn) => {
            btn.classList.remove("active");
        });

        document.querySelectorAll(".admin-panel").forEach((panel) => {
            panel.classList.remove("active");
        });

        tab.classList.add("active");
        document.getElementById(target)?.classList.add("active");

        if (target === "usersPanel" && !usersLoaded) {
            await loadUsers();
            usersLoaded = true;
        }

        if (target === "ordersPanel" && !ordersLoaded) {
            await loadOrders();
            ordersLoaded = true;
        }
    });
});

/* 工具函式 */
function toNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n: 0;
}

function splitLines(text) {
    return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseComposition(text) {
    return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
        const [name, value] = line.split(",").map((x) => x.trim());

        return {
            name: name || "",
            value: Number(value) || 0
        };
    })
    .filter((item) => item.name);
}

function makeVariants() {
    const variants = [];

    const price5 = $("price5").value;
    const price10 = $("price10").value;
    const price30 = $("price30").value;

    if (price5 !== "") {
        variants.push({
            label: "5 ml", price: toNumber(price5)
        });
    }

    if (price10 !== "") {
        variants.push({
            label: "10 ml", price: toNumber(price10)
        });
    }

    if (price30 !== "") {
        variants.push({
            label: "30 ml", price: toNumber(price30)
        });
    }

    return variants;
}

function updatePreviewImage(url) {
    const preview = $("previewImage");
    if (!preview) return;

    if (url) {
        preview.src = url;
        preview.style.display = "block";
    } else {
        preview.removeAttribute("src");
        preview.style.display = "none";
    }
}

/* 選擇圖片後，立即顯示本機預覽 */
$("productImage")?.addEventListener("change", (e) => {
    const file = e.target.files?.[0];

    if (!file) {
        updatePreviewImage("");
        return;
    }

    const previewUrl = URL.createObjectURL(file);
    updatePreviewImage(previewUrl);
});

/* 上傳商品圖片到 Storage */
async function uploadProductImage(slug) {
    const fileInput = $("productImage");
    const file = fileInput?.files?.[0];

    if (!file) return "";

    const ext = file.name.split(".").pop();
    const safeSlug = slug.replace(/[^\w-]/g, "-");
    const filePath = `products/${safeSlug}-${Date.now()}.${ext}`;

    const storageRef = ref(storage, filePath);
    await uploadBytes(storageRef, file);

    return await getDownloadURL(storageRef);
}

/* 會員資料 */
async function loadUsers() {
    const box = $("usersList");
    box.innerHTML = `<p class="muted">載入中...</p>`;

    try {
        const snapshot = await getDocs(collection(db, "users"));

        if (snapshot.empty) {
            box.innerHTML = `<p class="muted">目前沒有會員資料。</p>`;
            return;
        }

        box.innerHTML = snapshot.docs.map((docSnap) => {
            const u = docSnap.data();

            return `
            <div class="admin-data-card">
            <h3>${u.name || "未填姓名"}</h3>
            <p>Email：${u.email || ""}</p>
            <p>電話：${u.phone || ""}</p>
            <p>電子報：${u.newsletterSubscribed ? "已訂閱": "未訂閱"}</p>
            <p>角色：${u.role || "customer"}</p>
            </div>
            `;
        }).join("");
    } catch (err) {
        console.error(err);
        box.innerHTML = `<p class="muted">會員資料載入失敗：${err.message}</p>`;
    }
}

$("loadUsersBtn")?.addEventListener("click", async () => {
    await loadUsers();
    usersLoaded = true;
});

/* 訂單資料 */
function matchOrderFilter(order, filter) {
    const paymentStatus = order.payment?.status || "pending";
    const orderStatus = order.status || "pending";

    if (filter === "all") return true;
    if (filter === "pending") return orderStatus === "pending";
    if (filter === "paid_not_shipped") {
        return paymentStatus === "paid" && orderStatus === "pending";
    }
    if (filter === "shipped") return orderStatus === "shipped";
    if (filter === "completed") return orderStatus === "completed";
    if (filter === "cancelled") return orderStatus === "cancelled";

    return true;
}

function matchOrderSearch(orderItem, keyword) {
    if (!keyword) return true;

    const order = orderItem.data;
    const text = [
        orderItem.id,
        order.customer?.name,
        order.customer?.phone,
        order.customer?.email,
        order.shipping?.methodLabel,
        order.shipping?.address
    ].join(" ").toLowerCase();

    return text.includes(keyword.toLowerCase());
}

function renderOrders() {
    const box = $("ordersList");

    const filtered = allOrders.filter((orderItem) => {
        return (
            matchOrderFilter(orderItem.data, currentOrderFilter) &&
            matchOrderSearch(orderItem, currentOrderSearch)
        );
    });

    if (!filtered.length) {
        box.innerHTML = `<p class="muted">目前沒有符合條件的訂單。</p>`;
        return;
    }

    box.innerHTML = filtered.map((orderItem) => {
        const docId = orderItem.id;
        const o = orderItem.data;
        const items = o.items || [];

        return `
        <div class="admin-data-card">
        <h3>訂單：${docId}</h3>

        <p>姓名：${o.customer?.name || ""}</p>
        <p>電話：${o.customer?.phone || ""}</p>
        <p>Email：${o.customer?.email || ""}</p>
        <p>配送方式：${o.shipping?.methodLabel || ""}</p>
        <p>收件資訊：${o.shipping?.address || ""}</p>
        <p>總金額：NT$ ${Number(o.total || 0).toLocaleString("zh-Hant-TW")}</p>

        <div class="admin-status-row">
        <label>
        付款狀態
        <select class="payment-status-select" data-order-id="${docId}">
        ${Object.entries(PAYMENT_STATUS_LABELS).map(([value, label]) => `
            <option value="${value}" ${o.payment?.status === value ? "selected": ""}>
            ${label}
            </option>
            `).join("")}
        </select>
        </label>

        <label>
        訂單狀態
        <select class="order-status-select" data-order-id="${docId}">
        ${Object.entries(ORDER_STATUS_LABELS).map(([value, label]) => `
            <option value="${value}" ${o.status === value ? "selected": ""}>
            ${label}
            </option>
            `).join("")}
        </select>
        </label>

        <button class="admin-btn save-order-status-btn" type="button" data-order-id="${docId}">
        儲存狀態
        </button>
        </div>

        <p>商品：</p>
        <ul>
        ${items.map((item) => `
            <li>${item.name}｜${item.variantLabel} × ${item.qty}</li>
            `).join("")}
        </ul>

        <p class="admin-msg" id="orderMsg-${docId}"></p>
        </div>
        `;
    }).join("");
}

async function loadOrders() {
    const box = $("ordersList");
    box.innerHTML = `<p class="muted">載入中...</p>`;

    try {
        const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);

        allOrders = snapshot.docs.map((docSnap) => {
            return {
                id: docSnap.id,
                data: docSnap.data()
            };
        });

        renderOrders();
    } catch (err) {
        console.error(err);
        box.innerHTML = `<p class="muted">訂單資料載入失敗：${err.message}</p>`;
    }
}

$("loadOrdersBtn")?.addEventListener("click", async () => {
    await loadOrders();
    ordersLoaded = true;
});
document.querySelectorAll(".order-filter").forEach((btn) => {
    btn.addEventListener("click", () => {
        document.querySelectorAll(".order-filter").forEach((item) => {
            item.classList.remove("active");
        });

        btn.classList.add("active");
        currentOrderFilter = btn.dataset.filter || "all";

        renderOrders();
    });
});

$("orderSearch")?.addEventListener("input", (e) => {
    currentOrderSearch = e.target.value.trim();
    renderOrders();
});

/* 儲存訂單狀態 */
document.addEventListener("click", async (e) => {
    const btn = e.target.closest(".save-order-status-btn");
    if (!btn) return;

    const orderId = btn.dataset.orderId;
    const msg = document.getElementById(`orderMsg-${orderId}`);

    const paymentSelect = document.querySelector(
        `.payment-status-select[data-order-id="${orderId}"]`
    );

    const orderSelect = document.querySelector(
        `.order-status-select[data-order-id="${orderId}"]`
    );

    if (!paymentSelect || !orderSelect) return;

    msg.textContent = "儲存中...";

    try {
        await updateDoc(doc(db, "orders", orderId), {
            "payment.status": paymentSelect.value,
            status: orderSelect.value
        });
        const targetOrder = allOrders.find((item) => item.id === orderId);

        if (targetOrder) {
            targetOrder.data.payment = {
                ...(targetOrder.data.payment || {}),
                status: paymentSelect.value
            };

            targetOrder.data.status = orderSelect.value;
        }
        msg.textContent = "狀態已更新";
    } catch (err) {
        console.error(err);
        msg.textContent = `更新失敗：${err.message}`;
    }
});


/* 載入商品資料 */
$("loadProductBtn")?.addEventListener("click", async () => {
    const slug = $("editSlug").value.trim();
    const editMsg = $("editMsg");

    if (!slug) {
        editMsg.textContent = "請輸入商品 slug";
        return;
    }

    editMsg.textContent = "載入中...";

    try {
        const productRef = doc(db, "products", slug);
        const snap = await getDoc(productRef);

        if (!snap.exists()) {
            editMsg.textContent = "找不到這個商品";
            return;
        }

        const p = snap.data();

        currentImages = p.images || [];
        updatePreviewImage(currentImages[0] || "");

        $("name").value = p.name || "";
        $("en").value = p.en || "";
        $("slug").value = p.slug || slug;
        $("category").value = p.category || "single-oil";
        $("latin").value = p.latin || "";

        $("price5").value =
        p.variants?.find((v) => v.label === "5 ml")?.price ?? "";

        $("price10").value =
        p.variants?.find((v) => v.label === "10 ml")?.price ?? "";

        $("price30").value =
        p.variants?.find((v) => v.label === "30 ml")?.price ?? "";

        $("family").value = p.overview?.["科屬"] || "";
        $("extractPart").value = p.overview?.["萃取部位"] || "";
        $("extractMethod").value = p.overview?.["萃取方法"] || "";
        $("plantOrigin").value = p.overview?.["植物產地"] || "";
        $("aroma").value = p.overview?.["香氣概述"] || "";
        $("usageOverview").value = p.overview?.["建議用途"] || "";

        $("compositionText").value = (p.composition || [])
        .map((c) => `${c.name},${c.value}`)
        .join("\n");

        $("description").value = (p.description || []).join("\n");

        $("featured").checked = p.featured === true;

        editMsg.textContent = "商品資料已載入，可以修改後儲存";
    } catch (err) {
        console.error(err);
        editMsg.textContent = `載入失敗：${err.message}`;
    }
});

/* 新增或更新商品 */
$("productForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const msg = $("msg");
    msg.textContent = "儲存中...";

    const slug = $("slug").value.trim();

    if (!slug) {
        msg.textContent = "請填寫 slug";
        return;
    }

    try {
        const uploadedImageUrl = await uploadProductImage(slug);
        const images = uploadedImageUrl ? [uploadedImageUrl]: currentImages;

        const product = {
            slug,
            name: $("name").value.trim(),
            en: $("en").value.trim(),
            latin: $("latin").value.trim(),
            category: $("category").value,

            status: "active",
            featured: $("featured").checked,
            salesCount: 0,

            images,

            variants: makeVariants(),

            overview: {
                "科屬": $("family").value.trim(),
                "萃取部位": $("extractPart").value.trim(),
                "萃取方法": $("extractMethod").value.trim(),
                "植物產地": $("plantOrigin").value.trim(),
                "香氣概述": $("aroma").value.trim(),
                "建議用途": $("usageOverview").value.trim()
            },

            composition: parseComposition($("compositionText").value),

            docs: {
                coa: "",
                sds: "",
                eu: ""
            },

            description: splitLines($("description").value)
        };

        await setDoc(doc(db, "products", slug), product);

        currentImages = images;

        msg.textContent = `儲存成功：${product.name}`;
        e.target.reset();
        $("featured").checked = true;
        currentImages = [];
        updatePreviewImage("");
    } catch (err) {
        console.error(err);
        msg.textContent = `儲存失敗：${err.message}`;
    }
});
