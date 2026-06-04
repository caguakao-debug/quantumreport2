/* ============================================
   QUANTUMREPORT — Auth (Login / Register)
   Con Supabase Auth real (REST API directa)
   ============================================ */

const supabase = window.__supabase;

// --- Toggle password visibility ---
document.querySelectorAll('.auth__toggle-pass').forEach((btn) => {
  btn.addEventListener('click', () => {
    const input = btn.closest('.auth__password-wrap').querySelector('input');
    const isPass = input.getAttribute('type') === 'password';
    input.setAttribute('type', isPass ? 'text' : 'password');
    btn.innerHTML = isPass
      ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22"/></svg>`
      : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
  });
});

// --- Login form ---
const loginForm = document.getElementById('loginForm');
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const btn = loginForm.querySelector('.auth__submit');
    const errorEl = document.getElementById('loginError');

    btn.textContent = 'Ingresando…';
    btn.disabled = true;
    if (errorEl) errorEl.style.display = 'none';

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      btn.textContent = 'Ingresar';
      btn.disabled = false;
      if (errorEl) {
        errorEl.textContent = error.message === 'Invalid login credentials'
          ? 'Usuario o contraseña incorrectos.'
          : error.message;
        errorEl.style.display = 'block';
      } else {
        alert(error.message);
      }
      return;
    }

    // Redirigir según el rol (por ahora todos a dashboard)
    window.location.href = '/dashboard.html';
  });
}

// --- Register form ---
const registerForm = document.getElementById('registerForm');
if (registerForm) {
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const confirm = document.getElementById('confirmar').value;
    const nombre = document.getElementById('nombre')?.value || '';
    const btn = registerForm.querySelector('.auth__submit');
    const errorEl = document.getElementById('registerError');

    if (password !== confirm) {
      if (errorEl) {
        errorEl.textContent = 'Las contraseñas no coinciden.';
        errorEl.style.display = 'block';
      } else {
        alert('Las contraseñas no coinciden.');
      }
      return;
    }

    btn.textContent = 'Creando cuenta…';
    btn.disabled = true;
    if (errorEl) errorEl.style.display = 'none';

    const { data, error } = await supabase.auth.signUp({
      email: email,
      password: password,
      options: {
        data: {
          nombre_consultorio: nombre,
        },
      },
    });

    if (error) {
      btn.textContent = 'Crear cuenta';
      btn.disabled = false;
      if (errorEl) {
        errorEl.textContent = error.message;
        errorEl.style.display = 'block';
      } else {
        alert(error.message);
      }
      return;
    }

    // Registro exitoso
    btn.textContent = '✅ Cuenta creada';
    setTimeout(() => {
      window.location.href = '/dashboard.html';
    }, 1500);
  });
}
