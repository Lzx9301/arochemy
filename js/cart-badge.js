const CART_KEY = "arochemy_cart";

function updateCartBadge() {
  const el = document.getElementById("cartCount");
  if (!el) return;

  const cart = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
  const count = cart.reduce((sum, item) => sum + Number(item.qty || 0), 0);

  el.textContent = String(count);
  el.style.display = count > 0 ? "block" : "none";
}

window.updateCartBadge = updateCartBadge;

updateCartBadge();

window.addEventListener("storage", updateCartBadge);
