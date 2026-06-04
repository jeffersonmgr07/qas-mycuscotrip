(function () {
  const MOBILE_BREAKPOINT = 768;

  function getAccordions(root = document) {
    return Array.from(root.querySelectorAll(".footer-accordion"));
  }

  function applyFooterAccordionMode() {
    const accordions = getAccordions();
    if (!accordions.length) return;

    const isMobile = window.innerWidth <= MOBILE_BREAKPOINT;

    accordions.forEach((accordion) => {
      const previousMode = accordion.dataset.footerMode || "";
      const nextMode = isMobile ? "mobile" : "desktop";

      if (nextMode === "desktop") {
        accordion.setAttribute("open", "");
      } else if (previousMode !== "mobile") {
        accordion.removeAttribute("open");
      }

      accordion.dataset.footerMode = nextMode;
    });
  }

  function initFooterAccordions() {
    applyFooterAccordionMode();
  }

  let resizeTimer = null;
  function handleResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(applyFooterAccordionMode, 120);
  }

  window.MyCuscoTripFooter = {
    initFooterAccordions,
    applyFooterAccordionMode
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initFooterAccordions);
  } else {
    initFooterAccordions();
  }

  window.addEventListener("resize", handleResize);

  const observer = new MutationObserver((mutations) => {
    const hasFooterUpdate = mutations.some((mutation) =>
      Array.from(mutation.addedNodes).some((node) =>
        node.nodeType === 1 &&
        (node.matches?.(".footer") || node.querySelector?.(".footer"))
      )
    );

    if (hasFooterUpdate) {
      initFooterAccordions();
    }
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });
})();
