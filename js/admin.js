import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getFirestore,
  doc,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyAgRq-fVWsQuyO2odbfVEjgOZoHyACEApI",
  authDomain: "trying-89dc6.firebaseapp.com",
  projectId: "trying-89dc6",
  storageBucket: "trying-89dc6.firebasestorage.app",
  messagingSenderId: "115559148124",
  appId: "1:115559148124:web:ac37b9c249183a919b5499",
  measurementId: "G-KHR4PVKJCK"
};

const app = initializeApp(firebaseConfig);
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

$("productForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const msg = $("msg");
  msg.textContent = "新增中...";

  const slug = $("slug").value.trim();

  if (!slug) {
    msg.textContent = "請填寫 slug";
    return;
  }

  const imageUrl = $("imageUrl").value.trim();

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
