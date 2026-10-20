import { initializeApp, getApps, getApp }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth, onAuthStateChanged }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';

const firebaseConfig = {
  apiKey:            'AIzaSyAgRq-fVWsQuyO2odbfVEjgOZoHyACEApI',
  authDomain:        'trying-89dc6.firebaseapp.com',
  projectId:         'trying-89dc6',
  storageBucket:     'trying-89dc6.firebasestorage.app',
  messagingSenderId: '115559148124',
  appId:             '1:115559148124:web:ac37b9c249183a919b5499',
};

const app  = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);

onAuthStateChanged(auth, user => {
  const userArea    = document.getElementById('userArea');
  const userEmailEl = document.getElementById('userEmail');
  if (!userArea) return;

  userArea.href    = 'login.html';
  userArea.onclick = null;

  if (user && user.emailVerified) {
    if (userEmailEl) userEmailEl.textContent = user.email;
    userArea.title = '會員中心';

  } else if (user && !user.emailVerified) {
    if (userEmailEl) userEmailEl.textContent = '';
    userArea.title = '請完成 Email 驗證';

  } else {
    if (userEmailEl) userEmailEl.textContent = '';
    userArea.title = '會員登入';
  }
});
