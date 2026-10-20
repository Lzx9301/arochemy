
import { initializeApp, getApps, getApp }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth, verifyPasswordResetCode, confirmPasswordReset, applyActionCode }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';

const cfg = {
  apiKey: 'AIzaSyAgRq-fVWsQuyO2odbfVEjgOZoHyACEApI',
  authDomain: 'trying-89dc6.firebaseapp.com',
  projectId: 'trying-89dc6',
  storageBucket: 'trying-89dc6.firebasestorage.app',
  messagingSenderId: '115559148124',
  appId: '1:115559148124:web:ac37b9c249183a919b5499',
};

const app  = getApps().length ? getApp() : initializeApp(cfg);
const auth = getAuth(app);
const $    = id => document.getElementById(id);

function showView(id) {
  document.querySelectorAll('.auth-view').forEach(el => el.classList.remove('active'));
  $(id)?.classList.add('active');
}

function showError(title, text) {
  $('errorTitle').textContent = title;
  $('errorText').textContent  = text;
  showView('viewError');
}

function friendlyErrorText(code) {
  return ({
    'auth/expired-action-code': '此連結已過期，請重新申請。',
    'auth/invalid-action-code': '此連結已失效或已被使用過，請重新申請。',
    'auth/user-disabled':       '此帳號已被停用，請聯絡客服協助處理。',
    'auth/user-not-found':      '找不到對應的會員帳號，請確認連結是否正確。',
    'auth/weak-password':       '密碼強度不足，請設定至少 6 個字元的密碼。',
    'auth/network-request-failed': '網路連線異常，請檢查網路連線後再試一次。',
  })[code] || '發生未知錯誤，請稍後再試，或重新申請一次。';
}

async function init() {
  const params  = new URLSearchParams(window.location.search);
  const mode    = params.get('mode');
  const oobCode = params.get('oobCode');

  if (!oobCode) {
    showError('連結不完整', '此連結不完整，請重新由 Email 中開啟完整連結。');
    return;
  }

  if (mode === 'resetPassword') {
    await handleResetPassword(oobCode);
  } else if (mode === 'verifyEmail') {
    await handleVerifyEmail(oobCode);
  } else {
    showError('不支援的操作', '此連結的操作類型不受支援。');
  }
}

async function handleResetPassword(oobCode) {
  try {
    await verifyPasswordResetCode(auth, oobCode);
  } catch (e) {
    showError('此密碼重設連結已失效', friendlyErrorText(e.code));
    return;
  }

  showView('viewResetForm');

  const msgEl = $('resetFormMsg');
  const btn   = $('confirmResetBtn');
  let submitting = false;

  btn.addEventListener('click', async () => {
    if (submitting) return;

    msgEl.textContent = '';
    msgEl.className = 'auth-msg';

    const pw1 = $('newPassword').value;
    const pw2 = $('newPasswordConfirm').value;

    if (!pw1 || !pw2) {
      msgEl.textContent = '請輸入新密碼並再次確認。';
      msgEl.className = 'auth-msg error';
      return;
    }
    if (pw1.length < 6) {
      msgEl.textContent = '密碼至少需要 6 個字元。';
      msgEl.className = 'auth-msg error';
      return;
    }
    if (pw1 !== pw2) {
      msgEl.textContent = '兩次輸入的密碼不一致，請重新確認。';
      msgEl.className = 'auth-msg error';
      return;
    }

    submitting = true;
    btn.disabled = true;
    btn.textContent = '更新中…';

    try {
      await confirmPasswordReset(auth, oobCode, pw1);
      showView('viewResetSuccess');
    } catch (e) {
      msgEl.textContent = friendlyErrorText(e.code);
      msgEl.className = 'auth-msg error';
      submitting = false;
      btn.disabled = false;
      btn.textContent = '確認修改';
    }
  });
}

async function handleVerifyEmail(oobCode) {
  try {
    await applyActionCode(auth, oobCode);
    showView('viewVerifySuccess');
  } catch (e) {
    showError('此驗證連結已失效', friendlyErrorText(e.code));
  }
}

init();
