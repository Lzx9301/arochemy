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

  burgerBtn?.addEventListener("click", () => {
    setDrawerOpen(!isOpen());
  });

  drawer?.addEventListener("click", (e) => {
    if (e.target === drawer) setDrawerOpen(false);
  });

  drawer?.querySelectorAll("a").forEach((a) => {
    a.addEventListener("click", () => setDrawerOpen(false));
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") setDrawerOpen(false);
  });

  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  (function initNavDropdown() {
    const isFineHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const dropdownItems = document.querySelectorAll(".nav-item.has-dropdown");
    if (!dropdownItems.length) return;

    if (!isFineHover) {
      dropdownItems.forEach((item) => {
        const trigger = item.querySelector(":scope > a");
        trigger?.addEventListener("click", (e) => {
          const alreadyOpen = item.classList.contains("open");
          if (!alreadyOpen) {
            e.preventDefault();
            dropdownItems.forEach((other) => other.classList.remove("open"));
            item.classList.add("open");
          }
        });
      });

      document.addEventListener("click", (e) => {
        dropdownItems.forEach((item) => {
          if (!item.contains(e.target)) item.classList.remove("open");
        });
      });
    }
  })();

  (function initMobileNavAccordion() {
    document.querySelectorAll(".mnav-item").forEach((item) => {
      const toggle = item.querySelector(".mnav-toggle");
      toggle?.addEventListener("click", () => {
        const isOpenNow = item.classList.contains("open");
        document.querySelectorAll(".mnav-item").forEach((other) => other.classList.remove("open"));
        if (!isOpenNow) item.classList.add("open");
      });
    });
  })();

  (function initSearch() {
    function bindSearchForm(formId, inputId) {
      const form  = document.getElementById(formId);
      const input = document.getElementById(inputId);
      if (!form) return;
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const q = (input?.value || "").trim();
        if (!q) return;
        window.location.href = "search.html?q=" + encodeURIComponent(q);
      });
    }
    bindSearchForm("searchForm", "searchInput");
    bindSearchForm("mobileSearchForm", "mobileSearchInput");
  })();

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
