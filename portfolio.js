
// =========================
//  Portfolio: ProgressBar 애니메이션
//  (portfolio.html 안의 .progress-bar)
// =========================
export const PortfolioPage = (() => {
  function init(root) {
    const bars = root.querySelectorAll(".progress-bar");
    if (!bars.length) return null;

    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const bar = entry.target;
          const skill = bar.getAttribute("data-skill") || "0%";
          bar.style.width = skill;
          observer.unobserve(bar);
        }
      });
    }, { threshold: 0.5 });

    bars.forEach(bar => observer.observe(bar));
    return () => observer.disconnect();
  }

  return { init };
})();
