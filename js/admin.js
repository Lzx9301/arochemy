import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getFirestore,
  doc,
  setDoc,
  getDoc
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

const firebaseConfig = {
  apiKey: "AIzaSyAgRq-fVWsQuyO2odbfVEjgOZoHyACEApI",
  authDomain: "trying-89dc6.firebaseapp.com",
  projectId: "trying-89dc6",
  storageBucket: "trying-89dc6.firebasestorage.app",
  messagingSenderId: "115559148124",
  appId: "1:115559148124:web:ac37b9c249183a919b5499",
  measurementId: "G-KHR4PVKJCK"
};

const storageConfig = {
  apiKey: "AIzaSyAdS--elaCvzQOAPhMDPByLoTRXGibC9Rc",
  authDomain: "octo-7c190.firebaseapp.com",
  projectId: "octo-7c190",
  storageBucket: "octo-7c190.firebasestorage.app",
  messagingSenderId: "351002657731",
  appId: "1:351002657731:web:9db320ed4723e74a2a7376",
};

import { initializeApp } from
"https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";

const app = initializeApp(firebaseConfig);

const storageApp = initializeApp(
  storageConfig,
  "storageApp"
);

// const storage = getStorage(app);

import {
  getStorage
} from
"https://www.gstatic.com/firebasejs/12.3.0/firebase-storage.js";

const storage = getStorage(storageApp);

// const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const ADMIN_EMAIL = "nicoliu930226@gmail.com";

const $ = (id) => document.getElementById(id);

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

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
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
    variants.push({ label: "5 ml", price: toNumber(price5) });
  }

  if (price10 !== "") {
    variants.push({ label: "10 ml", price: toNumber(price10) });
  }

  if (price30 !== "") {
    variants.push({ label: "30 ml", price: toNumber(price30) });
  }

  return variants;
}

async function uploadProductImage(slug) {
  const fileInput = $("productImage");
  const file = fileInput?.files?.[0];

  if (!file) return "";

  const ext = file.name.split(".").pop();
  const filePath = `products/${slug}-${Date.now()}.${ext}`;

  const storageRef = ref(storage, filePath);
  await uploadBytes(storageRef, file);

  return await getDownloadURL(storageRef);
}

$("loadProductBtn")?.addEventListener("click", async () => {
  const slug = $("editSlug").value.trim();
  const editMsg = $("editMsg");

  if (!slug) {
    editMsg.textContent = "請輸入商品 slug";
    return;
  }

  editMsg.textContent = "載入中...";

  try {
    const ref = doc(db, "products", slug);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      editMsg.textContent = "找不到這個商品";
      return;
    }

    const p = snap.data();

    $("name").value = p.name || "";
    $("en").value = p.en || "";
    $("slug").value = p.slug || slug;
    $("category").value = p.category || "single-oil";
    $("latin").value = p.latin || "";

    $("price5").value = p.variants?.find(v => v.label === "5 ml")?.price ?? "";
    $("price10").value = p.variants?.find(v => v.label === "10 ml")?.price ?? "";
    $("price30").value = p.variants?.find(v => v.label === "30 ml")?.price ?? "";

    $("imageUrl").value = p.images?.[0] || "";

    $("family").value = p.overview?.["科屬"] || "";
    $("extractPart").value = p.overview?.["萃取部位"] || "";
    $("extractMethod").value = p.overview?.["萃取方法"] || "";
    $("plantOrigin").value = p.overview?.["植物產地"] || "";
    $("aroma").value = p.overview?.["香氣概述"] || "";
    $("usageOverview").value = p.overview?.["建議用途"] || "";

    $("compositionText").value = (p.composition || [])
      .map(c => `${c.name},${c.value}`)
      .join("\n");

    $("description").value = (p.description || []).join("\n");

    $("featured").checked = p.featured === true;

    editMsg.textContent = "商品資料已載入，可以修改後按下新增商品儲存";
  } catch (err) {
    console.error(err);
    editMsg.textContent = `載入失敗：${err.message}`;
  }
});

$("productForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const msg = $("msg");
  msg.textContent = "新增中...";

  const slug = $("slug").value.trim();

  if (!slug) {
    msg.textContent = "請填寫 slug";
    return;
  }

  const imageUrl = await uploadProductImage(slug);

  const product = {
    slug,
    name: $("name").value.trim(),
    en: $("en").value.trim(),
    latin: $("latin").value.trim(),
    category: $("category").value,
    status: "active",
    featured: $("featured").checked,
    salesCount: 0,

    images: imageUrl ? [imageUrl] : [],

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

  try {
    await setDoc(doc(db, "products", slug), product);

    msg.textContent = `新增成功：${product.name}`;
    e.target.reset();
    $("featured").checked = true;
  } catch (err) {
    console.error(err);
    msg.textContent = `新增失敗：${err.message}`;
  }
});
