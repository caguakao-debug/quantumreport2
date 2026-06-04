/* ============================================
   QUANTUMREPORT — Admin Panel
   ============================================ */

// --- Credenciales (usando localStorage para persistencia) ---
function getAdminCreds() {
  const saved = localStorage.getItem('qr_admin_creds');
  if (saved) return JSON.parse(saved);
  return { user: 'admin', pass: 'admin123' };
}
function saveAdminCreds(user, pass) {
  localStorage.setItem('qr_admin_creds', JSON.stringify({ user, pass }));
}

// --- Datos de ejemplo ---
const consultorios = [
  { nombre: 'Centro de Salud Integral', email: 'contacto@csintegral.cl', whatsapp: '+56912345678', plan: 'Pro', usados: 30, limite: 50, registro: '12 Ene 2026' },
  { nombre: 'BioClínica del Maule', email: 'info@bioclinica.cl', whatsapp: '+56976543210', plan: 'Inicial', usados: 15, limite: 20, registro: '05 Feb 2026' },
  { nombre: 'QuantumCare Spa', email: 'admin@quantumcare.cl', whatsapp: '+56998765432', plan: 'Premium', usados: 80, limite: -1, registro: '20 Dic 2025' },
  { nombre: 'Centro Holístico Nueva Era', email: 'contacto@nuevaera.cl', whatsapp: '+56911223344', plan: 'Gratis', usados: 4, limite: 10, registro: '01 Mar 2026' },
  { nombre: 'Instituto de Biorresonancia', email: 'info@biorresonancia.cl', whatsapp: '+56955667788', plan: 'Pro', usados: 42, limite: 50, registro: '18 Ene 2026' },
  { nombre: 'Salud Vital', email: 'contacto@saludvital.cl', whatsapp: '+56999887766', plan: 'Inicial', usados: 20, limite: 20, registro: '22 Feb 2026' },
  { nombre: 'Terapias Alternativas del Sur', email: 'info@terapiasur.cl', whatsapp: '+56933445566', plan: 'Gratis', usados: 10, limite: 10, registro: '10 Mar 2026' },
  { nombre: 'Centro Médico Quántum', email: 'recepcion@cmquantum.cl', whatsapp: '+56977665544', plan: 'Pro', usados: 12, limite: 50, registro: '14 Feb 2026' },
  { nombre: 'BioWellness Chile', email: 'hola@biowellness.cl', whatsapp: '+56944332211', plan: 'Premium', usados: 150, limite: -1, registro: '02 Ene 2026' },
  { nombre: 'Armonía Corporal', email: 'contacto@armoniacorp.cl', whatsapp: '+56988776655', plan: 'Inicial', usados: 8, limite: 20, registro: '28 Feb 2026' },
  { nombre: 'Diagnóstico Energético', email: 'info@diagnosticoenergetico.cl', whatsapp: '+56966554433', plan: 'Pro', usados: 48, limite: 50, registro: '07 Mar 2026' },
  { nombre: 'Centro Vitalis', email: 'contacto@centrovitalis.cl', whatsapp: '+56922113344', plan: 'Inicial', usados: 3, limite: 20, registro: '15 Mar 2026' },
];

// --- Login ---
document.getElementById('adminLoginForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const creds = getAdminCreds();
  const user = document.getElementById('adminUser').value;
  const pass = document.getElementById('adminPass').value;

  if (user === creds.user && pass === creds.pass) {
    document.getElementById('adminLogin').style.display = 'none';
    document.getElementById('adminPanel').style.display = 'block';
    document.getElementById('adminError').style.display = 'none';
    renderTable();
    loadAdminProfile();
  } else {
    document.getElementById('adminError').style.display = 'block';
  }
});

// --- Logout ---
document.getElementById('logoutBtn').addEventListener('click', () => {
  document.getElementById('adminLogin').style.display = 'flex';
  document.getElementById('adminPanel').style.display = 'none';
  document.getElementById('adminUser').value = '';
  document.getElementById('adminPass').value = '';
});

// --- Renderizar tabla ---
function renderTable() {
  const tbody = document.getElementById('adminTableBody');
  tbody.innerHTML = '';

  let totalAnalisis = 0;
  let ingresoTotal = 0;

  consultorios.forEach((c) => {
    totalAnalisis += c.usados;

    // Calcular ingreso estimado
    switch (c.plan) {
      case 'Gratis': break;
      case 'Inicial': ingresoTotal += 19; break;
      case 'Pro': ingresoTotal += 49; break;
      case 'Premium': ingresoTotal += 99; break;
    }

    const planClass = `plan-badge--${c.plan.toLowerCase()}`;
    const limite = c.limite === -1 ? '∞' : c.limite;
    const usadosDisplay = c.limite === -1 ? `${c.usados}` : `${c.usados} / ${c.limite}`;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${c.nombre}</strong></td>
      <td>${c.email}</td>
      <td>${c.whatsapp}</td>
      <td><span class="plan-badge ${planClass}">${c.plan}</span></td>
      <td>${usadosDisplay}</td>
      <td>${limite}</td>
      <td>${c.registro}</td>
    `;
    tbody.appendChild(tr);
  });

  // Actualizar stats
  document.getElementById('totalConsultorios').textContent = consultorios.length;
  document.getElementById('ingresoEstimado').textContent = `$${ingresoTotal.toLocaleString()}`;
}

// --- Tabs ---
document.querySelectorAll('.admin-tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.admin-tab').forEach((t) => t.classList.remove('admin-tab--active'));
    document.querySelectorAll('.admin-tab-content').forEach((c) => c.classList.remove('admin-tab-content--active'));

    tab.classList.add('admin-tab--active');
    const targetId = `tab${tab.dataset.tab.charAt(0).toUpperCase() + tab.dataset.tab.slice(1)}`;
    document.getElementById(targetId).classList.add('admin-tab-content--active');

    // Scroll suave al inicio del contenido del tab
    document.getElementById(targetId).scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});

// --- Cargar perfil admin ---
function loadAdminProfile() {
  const creds = getAdminCreds();
  document.getElementById('adminNewUser').value = creds.user;
  document.getElementById('adminNewPass').value = '';
  document.getElementById('adminConfirmPass').value = '';
}

// --- Guardar perfil admin ---
document.getElementById('adminProfileForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const msg = document.getElementById('adminProfileMsg');
  const user = document.getElementById('adminNewUser').value.trim();
  const pass = document.getElementById('adminNewPass').value;
  const confirm = document.getElementById('adminConfirmPass').value;

  if (!user) {
    msg.style.display = 'block';
    msg.style.color = '#ef4444';
    msg.textContent = 'El usuario no puede estar vacío.';
    return;
  }
  if (pass.length < 6) {
    msg.style.display = 'block';
    msg.style.color = '#ef4444';
    msg.textContent = 'La contraseña debe tener al menos 6 caracteres.';
    return;
  }
  if (pass !== confirm) {
    msg.style.display = 'block';
    msg.style.color = '#ef4444';
    msg.textContent = 'Las contraseñas no coinciden.';
    return;
  }

  saveAdminCreds(user, pass);

  msg.style.display = 'block';
  msg.style.color = '#10b981';
  msg.textContent = '✅ Credenciales actualizadas correctamente.';

  document.getElementById('adminNewPass').value = '';
  document.getElementById('adminConfirmPass').value = '';

  setTimeout(() => { msg.style.display = 'none'; }, 3000);
});
