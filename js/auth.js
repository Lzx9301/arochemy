import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  getFirestore,
  doc,
  setDoc,
  serverTimestamp
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
const auth = getAuth(app);
const db = getFirestore(app);

const $ = (id) => document.getElementById(id);

function getFormData() {
  return {
    name: $("name").value.trim(),
    phone: $("phone").value.trim(),
    email: $("email").value.trim(),
    password: $("password").value,
    newsletterSubscribed: $("newsletterSubscribed").checked
  };
}

$("registerBtn")?.addEventListener("click", async () => {
  const msg = $("msg");
  const data = getFormData();

  if (!data.name || !data.phone || !data.email || !data.password) {
    msg.textContent = "請填寫姓名、電話、Email 與密碼";
    return;
  }

  try {
    msg.textContent = "註冊中...";

    const userCredential = await createUserWithEmailAndPassword(
      auth,
      data.email,
      data.password
    );

    const user = userCredential.user;

    await setDoc(doc(db, "users", user.uid), {
      uid: user.uid,
      name: data.name,
      phone: data.phone,
      email: data.email,
      newsletterSubscribed: data.newsletterSubscribed,
      role: "customer",

      defaultAddress: "",
      defaultPaymentMethod: "",
      defaultShippingMethod: "",

      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    msg.textContent = "註冊成功，已登入";
    window.location.href = "index.html";
  } catch (err) {
    console.error(err);
    msg.textContent = `註冊失敗：${err.message}`;
  }
});

$("loginBtn")?.addEventListener("click", async () => {
  const msg = $("msg");
  const email = $("email").value.trim();
  const password = $("password").value;

  if (!email || !password) {
    msg.textContent = "請輸入 Email 與密碼";
    return;
  }

  try {
    msg.textContent = "登入中...";

    await signInWithEmailAndPassword(auth, email, password);

    msg.textContent = "登入成功";
    window.location.href = "index.html";
  } catch (err) {
    console.error(err);
    msg.textContent = "登入失敗，請確認 Email 或密碼";
  }
});

$("logoutBtn")?.addEventListener("click", async () => {
  await signOut(auth);
  $("msg").textContent = "已登出";
});

onAuthStateChanged(auth, (user) => {
  if (user) {
    $("logoutBtn").style.display = "inline-block";
  } else {
    $("logoutBtn").style.display = "none";
  }
});
