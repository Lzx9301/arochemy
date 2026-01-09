(() => {
  const burgerBtn = document.getElementById("burgerBtn");
  const drawer = document.getElementById("mobileDrawer");

  const isOpen = () => drawer?.classList.contains("open");

  const setDrawerOpen = (open) => {
    if (!drawer || !burgerBtn) return;
    drawer.classList.toggle("open", open);
    drawer.setAttribute("aria-hidden", String(!open));
    burgerBtn.setAttribute("aria-expanded", String(open));
    document.body.style.overflow = open ? "hidden" : "";
  };

  // 漢堡：開/關切換
  burgerBtn?.addEventListener("click", () => {
    setDrawerOpen(!isOpen());
  });

  // 點到遮罩（非選單內容）就關
  drawer?.addEventListener("click", (e) => {
    if (e.target === drawer) setDrawerOpen(false);
  });

  // 點選單連結後關閉
  drawer?.querySelectorAll("a").forEach((a) => {
    a.addEventListener("click", () => setDrawerOpen(false));
  });

  // ESC 關閉
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") setDrawerOpen(false);
  });

  // Footer 年份
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());
})();
