const CART_KEY = "arochemy_cart";

function updateCartBadge() {
  const el = document.getElementById("cartCount");
  if (!el) return;

  const cart = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
  const count = cart.reduce((sum, item) => sum + Number(item.qty || 0), 0);

  el.textContent = String(count);
  el.style.display = count > 0 ? "block" : "none";
}
const firebaseConfig = {
  apiKey:            'AIzaSyAgRq-fVWsQuyO2odbfVEjgOZoHyACEApI',
  authDomain:        'trying-89dc6.firebaseapp.com',
  projectId:         'trying-89dc6',
  storageBucket:     'trying-89dc6.firebasestorage.app',
  messagingSenderId: '115559148124',
  appId:             '1:115559148124:web:ac37b9c249183a919b5499',
};
window.updateCartBadge = updateCartBadge;

updateCartBadge();

window.addEventListener("storage", updateCartBadge);
