// Cada screen exporta render(root)
export async function render(root) {
  const htmlUrl = new URL('./home.html', import.meta.url);
  const html = await fetch(htmlUrl).then(r => r.text());
  root.innerHTML = html;
  mountLanding();
}

function hasSession() {
  return !!(
    localStorage.getItem('idToken') ||
    localStorage.getItem('authToken') ||
    sessionStorage.getItem('authToken')
  );
}

function mountLanding() {
  // Año footer
  const y = document.getElementById('landingYear');
  if (y) y.textContent = new Date().getFullYear();

  const nav = document.getElementById('landingNav');

  // Toggle CTA del navbar según sesión
  const cta = document.getElementById('authCtaBtn');
  const authed = hasSession();
  if (cta) {
    if (authed) {
      cta.textContent = 'Ir al Dashboard';
      cta.setAttribute('href', '#/dashboard');
      cta.classList.remove('btn-primary');
      cta.classList.add('btn-outline-light');
    } else {
      cta.textContent = 'Inicia sesión';
      cta.setAttribute('href', '#/login');
      cta.classList.remove('btn-outline-light');
      cta.classList.add('btn-primary');
    }
  }

  // ==== MÉTODO A: ScrollY en window ====
  const getScrollY = () =>
    window.pageYOffset ||
    document.documentElement.scrollTop ||
    document.body.scrollTop ||
    0;

  const applyNavStateByScroll = () => {
    if (!nav) return;
    const threshold = 8;
    if (getScrollY() > threshold) nav.classList.add('scrolled');
    else nav.classList.remove('scrolled');
  };

  window.addEventListener('scroll', applyNavStateByScroll, { passive: true });
  window.addEventListener('resize', applyNavStateByScroll, { passive: true });

  // ==== MÉTODO B: IntersectionObserver sobre el hero ====
  const hero = document.querySelector('.hero-landing');
  if (hero && 'IntersectionObserver' in window) {
    const sentinel = document.createElement('div');
    sentinel.style.position = 'absolute';
    sentinel.style.top = '0';
    sentinel.style.left = '0';
    sentinel.style.right = '0';
    sentinel.style.height = '1px';
    sentinel.setAttribute('data-sentinel', 'hero-top');
    hero.style.position = hero.style.position || 'relative';
    hero.prepend(sentinel);

    const io = new IntersectionObserver(
      (entries) => {
        const e = entries[0];
        if (e.isIntersecting) nav?.classList.remove('scrolled');
        else nav?.classList.add('scrolled');
      },
      { root: null, threshold: 0, rootMargin: '-1px 0px 0px 0px' }
    );
    io.observe(sentinel);
  }

  // Estado inicial
  applyNavStateByScroll();

  // Volver arriba
  const btt = document.getElementById('backToTop');
  const toggleBtt = () => {
    if (!btt) return;
    btt.style.display = getScrollY() > 400 ? 'inline-flex' : 'none';
  };
  window.addEventListener('scroll', toggleBtt, { passive: true });
  toggleBtt();
  if (btt) btt.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

  // Cerrar menú en móvil al dar click en un link del navbar
  const collapseEl = document.getElementById('landingNavCollapse');
  if (collapseEl) {
    collapseEl.querySelectorAll('a.nav-link').forEach(a => {
      a.addEventListener('click', () => {
        const bsCollapse = bootstrap.Collapse.getOrCreateInstance(collapseEl);
        bsCollapse.hide();
      });
    });
  }

  // Interceptar anclas internas (sin router)
  const landingRoot = document.querySelector('.landing');
  if (landingRoot) {
    landingRoot.querySelectorAll('a[href^="#"]:not([href^="#/"])').forEach(a => {
      a.addEventListener('click', ev => {
        const href = a.getAttribute('href');
        if (!href || href === '#') return;
        const targetEl = document.querySelector(href);
        if (!targetEl) return;
        ev.preventDefault();
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }

  // Asegurar brand → #/home
  const brand = document.querySelector('#landingNav .navbar-brand');
  if (brand && brand.getAttribute('href') !== '#/home') {
    brand.setAttribute('href', '#/home');
  }
}
