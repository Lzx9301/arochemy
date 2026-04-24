import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  doc,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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

const $ = (id) => document.getElementById(id);

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

    composition: [],

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
