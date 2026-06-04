/* ============================================
   QUANTUMREPORT — Scripts
   ============================================ */

// --- Scroll Reveal ---
const revealEls = document.querySelectorAll('[data-reveal]');

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
        observer.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
);

revealEls.forEach((el) => observer.observe(el));

// --- Animated Counters ---
const counterEls = document.querySelectorAll('[data-count]');

const counterObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const el = entry.target;
        const target = parseInt(el.getAttribute('data-count'), 10);
        animateCounter(el, target);
        counterObserver.unobserve(el);
      }
    });
  },
  { threshold: 0.5 }
);

counterEls.forEach((el) => counterObserver.observe(el));

function animateCounter(el, target) {
  let current = 0;
  const duration = 1500;
  const increment = target / (duration / 16);

  function tick() {
    current += increment;
    if (current >= target) {
      const label = el.closest('.hero__stat')?.querySelector('.hero__stat-label')?.textContent || '';
      const suffix = label.includes('%') ? '%' : label.includes('Mil') ? 'k' : '';
      el.textContent = target + suffix;
      return;
    }
    const label = el.closest('.hero__stat')?.querySelector('.hero__stat-label')?.textContent || '';
    const suffix = label.includes('%') ? '%' : label.includes('Mil') ? 'k' : '';
    el.textContent = Math.floor(current) + suffix;
    requestAnimationFrame(tick);
  }
  tick();
}

// --- Register Form (landing page) ---
const registerLanding = document.getElementById('registerFormLanding');
if (registerLanding) {
  registerLanding.addEventListener('submit', (e) => {
    e.preventDefault();
    window.location.href = '/register.html';
  });
}
