(function () {
  const sidebarEl = document.getElementById('sidebar');
  if (!sidebarEl) return;

  const isAuthenticated = () =>
    !!(localStorage.getItem('authToken') || sessionStorage.getItem('authToken') ||  localStorage.getItem('idToken'));

  // Mostrar sólo con sesión
  const applyVisibility = () => {
    sidebarEl.style.display = isAuthenticated() ? '' : 'none';
  };

  // Marcar activo por hash
  const markActive = () => {
    const hash = (location.hash || '').toLowerCase();
    document.querySelectorAll('#sidebar .nav-link-sidebar').forEach(a => {
      const href = (a.getAttribute('href') || '').toLowerCase();
      const active =
        (hash.startsWith('#/dashboard') && href === '#/dashboard') ||
        (hash.startsWith('#/home') && href === '#/home');
      a.classList.toggle('active', active);
    });
  };

  // Cerrar offcanvas en móvil al navegar
  document.querySelectorAll('#sidebar .nav-link-sidebar').forEach(a => {
    a.addEventListener('click', () => {
      try {
        const oc = bootstrap.Offcanvas.getOrCreateInstance(sidebarEl);
        if (window.innerWidth < 992) oc.hide();
      } catch {}
    });
  });

  applyVisibility();
  markActive();
  window.addEventListener('hashchange', () => { applyVisibility(); markActive(); });
  window.addEventListener('resize', applyVisibility);
  window.addEventListener('storage', (e) => {
    if (['authToken','idToken'].includes(e.key)) applyVisibility();
  });
})();
