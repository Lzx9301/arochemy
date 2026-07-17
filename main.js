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

  // 漢堡：開 / 關切換
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

  // ===== Mobile auto image switch (no hover devices) =====
  if (window.matchMedia("(hover: none)").matches) {
    const cards = document.querySelectorAll(".product-image");

    cards.forEach((imgBox) => {
      const plant = imgBox.querySelector(".p-img.plant");
      const bottle = imgBox.querySelector(".p-img.bottle");
      if (!plant || !bottle) return;

      let showBottle = false;

      setInterval(() => {
        showBottle = !showBottle;
        plant.style.opacity = showBottle ? "0" : "1";
        bottle.style.opacity = showBottle ? "1" : "0";
      }, 2500);
    });
  }
})();


/* ── Header 透明/不透明切換 ────────────────────────────── */
(function initHeaderScroll() {
  const header = document.getElementById('top');
  if (!header) return;

  function updateHeader() {
    if (window.scrollY > 60) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  }

  updateHeader();
  window.addEventListener('scroll', updateHeader, { passive: true });
})();
