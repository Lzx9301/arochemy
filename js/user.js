import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  initializeApp,
  getApps,
  getApp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

const firebaseConfig = {
  apiKey: "AIzaSyAgRq-fVWsQuyO2odbfVEjgOZoHyACEApI",
  authDomain: "trying-89dc6.firebaseapp.com",
  projectId: "trying-89dc6",
  storageBucket: "trying-89dc6.firebasestorage.app",
  messagingSenderId: "115559148124",
  appId: "1:115559148124:web:ac37b9c249183a919b5499"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);

const userArea = document.getElementById("userArea");
const userEmail = document.getElementById("userEmail");

onAuthStateChanged(auth, (user) => {
  if (!userArea) return;

  if (user) {
    // 已登入
    userEmail.textContent = user.email;
    userEmail.style.display = "inline";

    userArea.onclick = async () => {
      const confirmLogout = confirm("要登出嗎？");
      if (confirmLogout) {
        await signOut(auth);
        location.reload();
      }
    };

  } else {
    // 未登入
    userEmail.style.display = "none";

    userArea.onclick = () => {
      window.location.href = "login.html";
    };
  }
});
