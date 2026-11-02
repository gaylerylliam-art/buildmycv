(() => {
  if (window.BuildMyCVMascots) return;
  const entries = new Map();
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const selector = '[data-mascot]';
  const supportsObserver = typeof IntersectionObserver !== 'undefined';
  const update = (element, entry) => {
    const staticImage = reduced.matches || !supportsObserver || element.dataset.mascotStatic === 'true';
    element.dataset.mascotReduced = String(staticImage);
    element.dataset.mascotActive = String(!staticImage && entry.visible && document.visibilityState !== 'hidden' && !element.closest('[data-mascot-paused="true"]'));
    if (staticImage) {
      element.dataset.mascotEntered = 'true';
      delete element.dataset.mascotReveal;
      entry.seen = true;
    }
  };
  const intersection = supportsObserver ? new IntersectionObserver(records => {
    for (const record of records) {
      const entry = entries.get(record.target);
      if (!entry) continue;
      entry.visible = record.isIntersecting && record.intersectionRatio > 0;
      if (entry.visible && !entry.seen) {
        entry.seen = true;
        record.target.dataset.mascotEntered = 'true';
        record.target.dataset.mascotReveal = 'true';
      }
      update(record.target, entry);
    }
  }, { threshold: [0, 0.15] }) : null;
  const register = element => {
    if (entries.has(element)) return;
    const entry = { visible: false, seen: false };
    entries.set(element, entry);
    element.dataset.mascotReady = 'true';
    update(element, entry);
    intersection?.observe(element);
  };
  const scan = root => {
    if (root.nodeType !== 1 && root !== document) return;
    if (root.matches?.(selector)) register(root);
    root.querySelectorAll(selector).forEach(register);
  };
  const sync = () => {
    for (const [element, entry] of entries) {
      if (!element.isConnected) {
        intersection?.unobserve(element);
        entries.delete(element);
      } else update(element, entry);
    }
  };
  const mutations = new MutationObserver(records => {
    let removed = false, paused = false;
    for (const record of records) {
      if (record.type === 'attributes') paused = true;
      for (const node of record.addedNodes) scan(node);
      removed ||= record.removedNodes.length > 0;
    }
    if (removed || paused) sync();
  });
  const ended = event => {
    if (event.animationName === 'mascot-reveal') delete event.target.closest(selector)?.dataset.mascotReveal;
  };
  scan(document);
  mutations.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-mascot-paused', 'data-mascot-static'] });
  document.addEventListener('visibilitychange', sync);
  document.addEventListener('animationend', ended);
  reduced.addEventListener('change', sync);
  window.BuildMyCVMascots = {
    refresh: () => { scan(document); sync(); },
    count: () => entries.size,
    destroy: () => {
      mutations.disconnect(); intersection?.disconnect();
      document.removeEventListener('visibilitychange', sync);
      document.removeEventListener('animationend', ended);
      reduced.removeEventListener('change', sync);
      for (const element of entries.keys()) {
        delete element.dataset.mascotReady;
        delete element.dataset.mascotReveal;
        element.dataset.mascotActive = 'false';
      }
      entries.clear(); delete window.BuildMyCVMascots;
    },
  };
})();
