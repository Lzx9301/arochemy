import {
  initializeApp,
  getApps,
  getApp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getAuth,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

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
    userArea.classList.add("logged-in");
    userEmail.textContent = user.email;

    userArea.onclick = async (e) => {
      e.preventDefault();
      const confirmLogout = confirm("要登出嗎？");
      if (confirmLogout) {
        await signOut(auth);
        location.reload();
      }
    };
  } else {
    userArea.classList.remove("logged-in");
    userEmail.textContent = "";

    userArea.onclick = (e) => {
      e.preventDefault();
      window.location.href = "login.html";
    };
  }
});
