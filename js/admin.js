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
    orderBy
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

/* 精油網站 Firebase：Firestore / Auth */
const firebaseConfig = {
    apiKey: "AIzaSyAgRq-fVWsQuyO2odbfVEjgOZoHyACEApI",
    authDomain: "trying-89dc6.firebaseapp.com",
    projectId: "trying-89dc6",
    storageBucket: "trying-89dc6.firebasestorage.app",
    messagingSenderId: "115559148124",
    appId: "1:115559148124:web:ac37b9c249183a919b5499",
    measurementId: "G-KHR4PVKJCK"
};

/* Firebase：只拿來放商品圖片 */
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

/* 編輯商品時，用來保留原本圖片 */
let currentImages = [];
let usersLoaded = false;
let ordersLoaded = false;

/* 登入相關 */
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

        // 切到會員資料時，自動載入會員
        if (target === "usersPanel" && !usersLoaded) {
            await loadUsers();
            usersLoaded = true;
        }

        // 切到訂單管理時，自動載入訂單
        if (target === "ordersPanel" && !ordersLoaded) {
            await loadOrders();
            ordersLoaded = true;
        }
    });
});

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
                    <p>電子報：${u.newsletterSubscribed ? "已訂閱" : "未訂閱"}</p>
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

async function loadOrders() {
    const box = $("ordersList");
    box.innerHTML = `<p class="muted">載入中...</p>`;

    try {
        const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            box.innerHTML = `<p class="muted">目前沒有訂單。</p>`;
            return;
        }

        box.innerHTML = snapshot.docs.map((docSnap) => {
            const o = docSnap.data();
            const items = o.items || [];

            return `
                <div class="admin-data-card">
                    <h3>訂單：${docSnap.id}</h3>
                    <p>姓名：${o.customer?.name || ""}</p>
                    <p>電話：${o.customer?.phone || ""}</p>
                    <p>Email：${o.customer?.email || ""}</p>
                    <p>配送方式：${o.shipping?.methodLabel || ""}</p>
                    <p>收件資訊：${o.shipping?.address || ""}</p>
                    <p>付款狀態：${o.payment?.status || ""}</p>
                    <p>訂單狀態：${o.status || ""}</p>
                    <p>總金額：NT$ ${Number(o.total || 0).toLocaleString("zh-Hant-TW")}</p>
                    <p>商品：</p>
                    <ul>
                        ${items.map((item) => `
                            <li>${item.name}｜${item.variantLabel} × ${item.qty}</li>
                        `).join("")}
                    </ul>
                </div>
            `;
        }).join("");
    } catch (err) {
        console.error(err);
        box.innerHTML = `<p class="muted">訂單資料載入失敗：${err.message}</p>`;
    }
}

$("loadOrdersBtn")?.addEventListener("click", async () => {
    await loadOrders();
    ordersLoaded = true;
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

/* 上傳商品圖片到舊專案 Storage */
async function uploadProductImage(slug) {
    const fileInput = $("productImage");
    const file = fileInput?.files?.[0];

    if (!file) return "";

    const ext = file.name.split(".").pop();
    const safeSlug = slug.replace(/[^\w-]/g, "-");
    const filePath = `products/${safeSlug}-${Date.now()}.${ext}`;

    const storageRef = ref(storage, filePath);

    await uploadBytes(storageRef, file);

    if(currentImages.length){
   $("previewImage").src = currentImages[0];
}
    
    return await getDownloadURL(storageRef);
}

/* 載入商品資料到表單 */
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

        /* 如果有新上傳圖片，就使用新圖片；沒有上傳就保留舊圖片 */
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
    } catch (err) {
        console.error(err);
        msg.textContent = `儲存失敗：${err.message}`;
    }
});
