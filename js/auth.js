/**
 * Arochemy — js/auth.js
 * 功能：登入、註冊、登出、自動偵測登入狀態
 * 寫入 Firestore：members collection（含姓名、電話、email、訂閱電子報）
 */

import { initializeApp }          from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth,
         createUserWithEmailAndPassword,
         signInWithEmailAndPassword,
         signOut,
         onAuthStateChanged }     from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore,
         doc,
         getDoc,
         setDoc,
         serverTimestamp }        from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

/* ── Firebase 設定 ────────────────────────────────────── */
const firebaseConfig = {
  apiKey:            'AIzaSyAgRq-fVWsQuyO2odbfVEjgOZoHyACEApI',
  authDomain:        'trying-89dc6.firebaseapp.com',
  projectId:         'trying-89dc6',
  storageBucket:     'trying-89dc6.firebasestorage.app',
  messagingSenderId: '115559148124',
  appId:             '1:115559148124:web:ac37b9c249183a919b5499',
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

/* ── DOM 元素 ─────────────────────────────────────────── */
const nameInput     = document.getElementById('name');
const phoneInput    = document.getElementById('phone');
const emailInput    = document.getElementById('email');
const passwordInput = document.getElementById('password');
const newsletter    = document.getElementById('newsletterSubscribed');
const loginBtn      = document.getElementById('loginBtn');
const registerBtn   = document.getElementById('registerBtn');
const logoutBtn     = document.getElementById('logoutBtn');
const msgEl         = document.getElementById('msg');

/* ── 顯示訊息 ──────────────────────────────────────────── */
function showMsg(text, isError = false) {
  msgEl.textContent   = text;
  msgEl.style.color   = isError ? '#b94a48' : '#456b55';
}

function clearMsg() { msgEl.textContent = ''; }

/* ── 錯誤碼翻譯 ────────────────────────────────────────── */
function friendlyError(code) {
  const map = {
    'auth/user-not-found':         '找不到此帳號，請先註冊。',
    'auth/wrong-password':         '密碼錯誤，請再試一次。',
    'auth/invalid-credential':     '帳號或密碼錯誤，請再試一次。',
    'auth/email-already-in-use':   '此 Email 已被註冊，請直接登入。',
    'auth/weak-password':          '密碼至少需要 6 個字元。',
    'auth/invalid-email':          'Email 格式不正確。',
    'auth/too-many-requests':      '嘗試次數過多，請稍後再試。',
    'auth/network-request-failed': '網路連線異常，請確認後再試。',
  };
  return map[code] || '發生錯誤，請稍後再試。';
}

/* ── 按鈕 loading 狀態 ─────────────────────────────────── */
function setLoading(btn, loading, originalText) {
  btn.disabled    = loading;
  btn.textContent = loading ? '處理中…' : originalText;
}

/* ── 登入後更新頁面顯示 ────────────────────────────────── */
function updateUIForUser(user) {
  // 隱藏不必要欄位、顯示登出按鈕
  nameInput.closest('.auth-field').style.display     = 'none';
  phoneInput.closest('.auth-field').style.display    = 'none';
  newsletter.closest('.auth-check').style.display    = 'none';
  loginBtn.style.display    = 'none';
  registerBtn.style.display = 'none';
  logoutBtn.style.display   = 'block';

  emailInput.value    = user.email;
  emailInput.disabled = true;
  passwordInput.value = '';
  passwordInput.closest('.auth-field').style.display = 'none';

  showMsg(`已登入：${user.email}`);

  // 更新 header 顯示 email（如果頁面有這個元素）
  const userEmailEl = document.getElementById('userEmail');
  if (userEmailEl) userEmailEl.textContent = user.email;

  const userAreaEl = document.getElementById('userArea');
  if (userAreaEl) userAreaEl.href = 'login.html';
}

function updateUIForGuest() {
  nameInput.closest('.auth-field').style.display     = '';
  phoneInput.closest('.auth-field').style.display    = '';
  newsletter.closest('.auth-check').style.display    = '';
  loginBtn.style.display    = '';
  registerBtn.style.display = '';
  logoutBtn.style.display   = 'none';
  emailInput.disabled       = false;
  passwordInput.closest('.auth-field').style.display = '';
  clearMsg();
}

/* ── 自動偵測登入狀態 ──────────────────────────────────── */
onAuthStateChanged(auth, (user) => {
  if (user) {
    updateUIForUser(user);
  } else {
    updateUIForGuest();
  }
});

/* ── 登入 ──────────────────────────────────────────────── */
loginBtn.addEventListener('click', async () => {
  const email    = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    showMsg('請填寫 Email 與密碼。', true);
    return;
  }

  setLoading(loginBtn, true, '會員登入');
  clearMsg();

  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);

    // 登入成功後更新 Firestore 的 lastLoginAt
    await setDoc(
      doc(db, 'members', cred.user.uid),
      { lastLoginAt: serverTimestamp() },
      { merge: true }
    );

    showMsg('登入成功！正在跳轉…');
    setTimeout(() => {
      // 登入後回到前一頁，若無則回首頁
      const redirect = sessionStorage.getItem('loginRedirect') || 'index.html';
      sessionStorage.removeItem('loginRedirect');
      window.location.href = redirect;
    }, 800);

  } catch (err) {
    showMsg(friendlyError(err.code), true);
  } finally {
    setLoading(loginBtn, false, '會員登入');
  }
});

/* ── 註冊 ──────────────────────────────────────────────── */
registerBtn.addEventListener('click', async () => {
  const name       = nameInput.value.trim();
  const phone      = phoneInput.value.trim();
  const email      = emailInput.value.trim();
  const password   = passwordInput.value;
  const subscribed = newsletter.checked;

  // 驗證
  if (!email || !password) {
    showMsg('請至少填寫 Email 與密碼。', true);
    return;
  }
  if (password.length < 6) {
    showMsg('密碼至少需要 6 個字元。', true);
    return;
  }

  setLoading(registerBtn, true, '註冊會員');
  clearMsg();

  try {
    // 1. 建立 Firebase Auth 帳號
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const uid  = cred.user.uid;

    // 2. 寫入 Firestore members collection
    //    後台 admin.js 的 loadMembers() 讀取這個 collection
    await setDoc(doc(db, 'members', uid), {
      uid,
      name:        name  || '',
      phone:       phone || '',
      email,
      subscribed,          // 電子報訂閱狀態（布林值）
      createdAt:   serverTimestamp(),
      lastLoginAt: serverTimestamp(),
    });

    showMsg('註冊成功！歡迎加入 Arochemy 🌿');
    updateUIForUser(cred.user);

    // 3. 若有勾選電子報，在本機留一個記號（可供其他頁面判斷）
    if (subscribed) {
      localStorage.setItem('arochemy_subscribed', '1');
    }

  } catch (err) {
    showMsg(friendlyError(err.code), true);
  } finally {
    setLoading(registerBtn, false, '註冊會員');
  }
});

/* ── 登出 ──────────────────────────────────────────────── */
logoutBtn.addEventListener('click', async () => {
  try {
    await signOut(auth);
    showMsg('已成功登出。');
    localStorage.removeItem('arochemy_subscribed');
    updateUIForGuest();
  } catch (err) {
    showMsg('登出失敗，請再試一次。', true);
  }
});

/* ── 提供給其他頁面使用的輔助函式 ─────────────────────────
   其他頁面（如 cart.html、checkout.html）可以這樣使用：

   import { getCurrentUser } from './auth.js';
   const user = await getCurrentUser();
   if (!user) { window.location.href = 'login.html'; }
──────────────────────────────────────────────────────── */
export function getCurrentUser() {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    });
  });
}

export { auth, db };
