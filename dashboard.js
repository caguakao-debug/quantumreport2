/* ============================================
   QUANTUMREPORT — Dashboard
   Conectado a Supabase (REST API directa)
   ============================================ */

const supabase = window.__supabase;

// --- Estado global ---
let miConsultorio = null;

// --- Auth check ---
async function checkAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    window.location.href = '/login.html';
    return;
  }
  await cargarConsultorio();
}

// --- Cargar datos del consultorio desde Supabase ---
async function cargarConsultorio() {
  const { data, error } = await supabase
    .from('consultorios')
    .select('*')
    .limit(1)
    .single();

  if (error) {
    console.error('Error cargando consultorio:', error);
    return;
  }

  miConsultorio = data;

  // Aplicar datos al perfil
  if (data.nombre) document.getElementById('profileName').value = data.nombre;
  if (data.slogan) document.getElementById('profileSlogan').value = data.slogan;
  if (data.whatsapp) document.getElementById('profileWhatsapp').value = data.whatsapp;
  if (data.logo_url) {
    document.getElementById('logoPreview').innerHTML = `<img src="${data.logo_url}" alt="Logo">`;
  }

  // Mostrar nombre en dashboard
  document.getElementById('clinicaNombre').textContent = data.nombre || 'Mi Consultorio';
}

// --- Logout ---
document.getElementById('logoutBtn')?.addEventListener('click', async () => {
  await supabase.auth.signOut();
  window.location.href = '/login.html';
});

// --- Navegación entre Inicio y Mi Perfil ---
const navLinks = document.querySelectorAll('.topbar__link');
const sections = {
  inicio: document.getElementById('inicio'),
  perfil: document.getElementById('perfil'),
};

navLinks.forEach((link) => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    const target = link.getAttribute('href').replace('#', '');

    navLinks.forEach((l) => l.classList.remove('topbar__link--active'));
    link.classList.add('topbar__link--active');

    Object.entries(sections).forEach(([key, section]) => {
      if (key === target) {
        section.style.display = 'block';
        section.classList.remove('dash__section--hidden');
      } else {
        section.style.display = 'none';
        section.classList.add('dash__section--hidden');
      }
    });
  });
});

// --- Upload zone ---
const uploadZone = document.getElementById('uploadZone');
const fileInput = document.getElementById('fileInput');
const uploadPreview = document.getElementById('uploadPreview');
const fileName = document.getElementById('fileName');
const analyzeBtn = document.getElementById('analyzeBtn');

uploadZone.addEventListener('click', () => fileInput.click());

uploadZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  uploadZone.classList.add('upload-zone--active');
});
uploadZone.addEventListener('dragleave', () => {
  uploadZone.classList.remove('upload-zone--active');
});
uploadZone.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadZone.classList.remove('upload-zone--active');
  if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
});

fileInput.addEventListener('change', () => {
  if (fileInput.files.length) handleFile(fileInput.files[0]);
});

let archivoSubido = null;
function handleFile(file) {
  archivoSubido = file;
  fileName.textContent = file.name;
  uploadZone.style.display = 'none';
  uploadPreview.style.display = 'flex';
}

// --- Analizar (sube archivo a Supabase Storage y llama a la Edge Function) ---
analyzeBtn.addEventListener('click', async () => {
  if (!archivoSubido) return;

  const btn = analyzeBtn;
  btn.textContent = 'Subiendo archivo…';
  btn.disabled = true;

  try {
    // Subir archivo a Supabase Storage
    const fileExt = archivoSubido.name.split('.').pop();
    const filePath = `${miConsultorio.id}/${Date.now()}.${fileExt}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('informes')
      .upload(filePath, archivoSubido);

    if (uploadError) throw uploadError;

    // Guardar metadata en la tabla informes
    const { data: insertData, error: insertError } = await supabase
      .from('informes')
      .insert({
        consultorio_id: miConsultorio.id,
        paciente_nombre: document.getElementById('pacienteNombre')?.value || '',
        paciente_telefono: document.getElementById('pacienteTelefono')?.value || '',
        archivo_original: archivoSubido.name,
        archivo_storage_path: filePath,
      });

    if (insertError) throw insertError;

    // Invocar Edge Function para realizar el análisis e interpretación con Gemini
    btn.textContent = 'Analizando con IA…';
    const { data: functionData, error: functionError } = await supabase.functions.invoke(
      'analizar-informe',
      {
        body: { informeId: insertData.id }
      }
    );

    if (functionError) throw functionError;

    // Restaurar estado
    btn.textContent = 'Analizar con IA';
    btn.disabled = false;
    uploadZone.style.display = '';
    uploadPreview.style.display = 'none';
    archivoSubido = null;

    // Aplicar branding del consultorio al bloque de resultados
    const resultLogo = document.getElementById('resultLogo');
    if (resultLogo) {
      if (miConsultorio.logo_url) {
        resultLogo.src = miConsultorio.logo_url;
        resultLogo.style.display = '';
      } else {
        resultLogo.style.display = 'none';
      }
    }
    document.getElementById('resultClinica').textContent = miConsultorio.nombre || 'Mi Consultorio';
    document.getElementById('resultSlogan').textContent = miConsultorio.slogan || '';

    // Formatear y mostrar el análisis generado por la IA
    const formattedHtml = functionData.analysis
      .replace(/\n/g, '<br>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/###\s*(.*?)(<br>|$)/g, '<h3>$1</h3>')
      .replace(/##\s*(.*?)(<br>|$)/g, '<h2>$1</h2>');
    
    document.getElementById('resultBody').innerHTML = formattedHtml;

    // Habilitar botón de descarga de PDF generado
    const downloadBtn = document.getElementById('downloadPdf');
    if (downloadBtn) {
      const newDownloadBtn = downloadBtn.cloneNode(true);
      downloadBtn.parentNode.replaceChild(newDownloadBtn, downloadBtn);
      newDownloadBtn.addEventListener('click', () => {
        window.open(functionData.pdfUrl, '_blank');
      });
    }

    // Mostrar panel de resultados
    document.getElementById('resultEmpty').style.display = 'none';
    document.getElementById('resultContent').style.display = 'block';

  } catch (error) {
    console.error('Error:', error);
    btn.textContent = 'Analizar con IA';
    btn.disabled = false;
    const errorMsg = error.message || (typeof error === 'object' ? JSON.stringify(error) : error);
    alert('Error al procesar el análisis: ' + errorMsg);
  }
});


// --- WhatsApp ---
document.getElementById('sendWhatsapp')?.addEventListener('click', () => {
  const telefono = miConsultorio?.whatsapp || '';
  const nombre = miConsultorio?.nombre || 'Mi consultorio';
  const body = encodeURIComponent(
    `🩺 *${nombre}* te comparte tu resumen de biorresonancia:\n\n` +
    document.getElementById('resultBody').innerText
  );
  const url = telefono
    ? `https://wa.me/${telefono.replace(/[^0-9]/g, '')}?text=${body}`
    : `https://wa.me/?text=${body}`;
  window.open(url, '_blank');
});

// --- Profile: subir logo a Supabase Storage ---
document.getElementById('uploadLogoBtn')?.addEventListener('click', () => {
  document.getElementById('logoInput').click();
});

document.getElementById('logoInput')?.addEventListener('change', async (e) => {
  if (!e.target.files.length || !miConsultorio) return;

  const logoFile = e.target.files[0];
  const logoPath = `logos/${miConsultorio.id}/logo.${logoFile.name.split('.').pop()}`;

  const { data, error } = await supabase.storage
    .from('informes')
    .upload(logoPath, logoFile, { upsert: true });

  if (error) {
    console.error('Error subiendo logo:', error);
    alert('Error al subir el logo');
    return;
  }

  // Obtener URL pública
  const { data: { publicUrl } } = supabase.storage
    .from('informes')
    .getPublicUrl(logoPath);

  // Guardar URL en la base de datos
  await supabase
    .from('consultorios')
    .update({ logo_url: publicUrl })
    .eq('id', miConsultorio.id);

  miConsultorio.logo_url = publicUrl;
  document.getElementById('logoPreview').innerHTML = `<img src="${publicUrl}" alt="Logo">`;
});

// --- Profile: guardar en Supabase ---
document.getElementById('profileForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!miConsultorio) return;

  const nombre = document.getElementById('profileName').value;
  const slogan = document.getElementById('profileSlogan').value;
  const whatsapp = document.getElementById('profileWhatsapp').value;

  const { error } = await supabase
    .from('consultorios')
    .update({ nombre, slogan, whatsapp })
    .eq('id', miConsultorio.id);

  if (error) {
    alert('Error al guardar: ' + error.message);
    return;
  }

  miConsultorio = { ...miConsultorio, nombre, slogan, whatsapp };

  const btn = e.target.querySelector('.btn--primary');
  const orig = btn.textContent;
  btn.textContent = '✅ Guardado';
  btn.style.pointerEvents = 'none';
  setTimeout(() => {
    btn.textContent = orig;
    btn.style.pointerEvents = '';
  }, 2000);
});

// --- Iniciar ---
checkAuth();
