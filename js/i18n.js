/* ============ Maya — idioma (Español / English) ============
   El español es el idioma fuente de la interfaz; este módulo traduce
   la capa visible al inglés con un diccionario de textos exactos y
   cambia el formato de fechas. Se guarda por dispositivo. */

const I18N = (() => {

  const LS = 'maya.idioma.v1';
  let lang = localStorage.getItem(LS) || 'es';

  const EN = {
    // navegación y encabezado
    'Inicio': 'Home', 'Comida': 'Feeding', 'Sueño': 'Sleep', 'Pañal': 'Diaper', 'Retos': 'Goals', 'Más': 'More',
    'El diario de nuestra bebé': "Our baby's journal",
    // acciones rápidas
    'Pecho izq.': 'Left breast', 'Pecho der.': 'Right breast', 'A dormir': 'To sleep',
    'Pipí': 'Pee', 'Popó': 'Poop', 'Biberón': 'Bottle', 'Ambos': 'Both',
    // genéricos
    'Guardar': 'Save', 'Cerrar': 'Close', 'Cancelar': 'Cancel', 'Editar': 'Edit', 'Borrar': 'Delete',
    'Entrar': 'Sign in', 'Cerrar sesión': 'Sign out', 'Salir del demo': 'Exit demo',
    'Guardar registro': 'Save entry', 'Notas (opcional)': 'Notes (optional)', 'Hora': 'Time', 'Fecha': 'Date',
    '✨ Crear cuenta nueva': '✨ Create new account', '🧪 Ver el demo': '🧪 View the demo',
    // secciones
    'Alimentación': 'Feeding', 'Sueño y vigilia': 'Sleep & wake', 'Pañales': 'Diapers',
    'Retos del día 🏆': "Today's goals 🏆", 'Medallero 🏅': 'Medals 🏅',
    'Banco de leche 🥛': 'Milk bank 🥛', 'Producción 📈': 'Production 📈',
    'Análisis general 🤖': 'Health check 🤖', 'Condiciones médicas 🩺': 'Medical conditions 🩺',
    'Intervenciones 💉': 'Procedures 💉', 'Medicamentos 💊': 'Medications 💊',
    'Crecimiento 📏': 'Growth 📏', 'Fotos 📸': 'Photos 📸', 'Resumen en PDF 📄': 'PDF report 📄',
    'Ajustes ⚙️': 'Settings ⚙️', 'Citas médicas 📅': 'Appointments 📅',
    // menú Más
    'Análisis general': 'Health check', 'Cómo va y qué observar, según sus datos': 'How things are going, from the data',
    'Banco de leche': 'Milk bank', 'Condiciones médicas': 'Medical conditions',
    'Intervenciones': 'Procedures', 'Medicamentos': 'Medications', 'Crecimiento': 'Growth',
    'Fotos': 'Photos', 'Resumen PDF': 'PDF report', 'Ajustes': 'Settings',
    'Citas médicas': 'Appointments', 'Bienestar de mamá': "Mom's wellbeing",
    'Tema de color': 'Color theme', 'Un chequeo para ti, no solo para la bebé': 'A check-in for you, not just baby',
    'Descarga un reporte con gráficas': 'Download a charted report',
    'Sincronización, respaldo y sesión': 'Sync, backup & session',
    'Ictericia, seguimiento de labs…': 'Jaundice, lab tracking…',
    'Toma de sangre, vacunas, estudios…': 'Blood draws, vaccines, tests…',
    'Tratamientos y vitaminas': 'Treatments & vitamins',
    'Registra peso y talla': 'Log weight & height', 'Momentos especiales': 'Special moments',
    // inicio
    'Última toma': 'Last feed', 'de sueño hoy': 'sleep today', 'gastados hoy': 'used today',
    'hoy': 'today', 'tomas': 'feeds', 'pañales': 'diapers', 'pañal': 'diaper',
    'listos en el refri': 'ready in the fridge', 'Seguimiento médico': 'Medical tracking',
    // comida
    '🤱 Materna': '🤱 Breast', '🥛 Extraída': '🥛 Expressed', '🍼 Fórmula': '🍼 Formula',
    'Izquierda': 'Left', 'Derecha': 'Right', '▶ tocar para iniciar': '▶ tap to start',
    // sueño
    'Se durmió': 'Fell asleep', 'En vigilia': 'Wake window', 'iniciar timer': 'start timer',
    'despierta y alerta': 'awake & alert', '⏳ Ventana de despierta': '⏳ Awake window',
    '🌙 Rutina de dormir': '🌙 Bedtime routine', '▶ Empezar rutina de esta noche': "▶ Start tonight's routine",
    '💤 Dormir mejor — consejos de esta semana': "💤 Sleep better — this week's tips",
    // ajustes
    '👶 Bebé': '👶 Baby', 'Nombre': 'Name', 'Fecha de nacimiento': 'Birth date',
    'Mamá': 'Mom', 'Papá': 'Dad', 'Este teléfono lo usa': 'This phone belongs to',
    '☁️ Sincronización con GitHub': '☁️ GitHub sync', '💾 Respaldo': '💾 Backup',
    'Exportar JSON': 'Export JSON', 'Importar JSON': 'Import JSON',
    '👪 Cuentas de la familia': '👪 Family accounts', '🌐 Idioma / Language': '🌐 Language / Idioma',
    '🎨 Cambiar tema de color': '🎨 Change color theme', 'Probar conexión': 'Test connection',
    'Sincronizar ahora': 'Sync now', 'Sincronizar automáticamente': 'Sync automatically',
    '📷 Foto de perfil del bebé': "📷 Baby's profile photo",
    // demo / login
    'Correo': 'Email', 'Contraseña': 'Password',
    'Usuario o contraseña incorrectos': 'Wrong email or password',
    '🧪 Modo demo': '🧪 Demo mode',
    // pdf y otros títulos
    'Periodo': 'Date range', '¿Qué incluir?': 'What to include?', '⬇️ Descargar PDF': '⬇️ Download PDF',
    'Todo': 'All', 'Hoy': 'Today', 'Ayer': 'Yesterday', '7 días': '7 days', '30 días': '30 days',
  };

  const loc = () => lang === 'en' ? 'en-US' : 'es-MX';
  const t = s => lang === 'en' ? (EN[s] || s) : s;

  /* recorre un nodo y traduce los textos exactos del diccionario */
  function aplicar(raiz) {
    if (lang !== 'en' || !raiz) return;
    const walker = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walker.nextNode())) {
      const txt = n.textContent.trim();
      if (txt && EN[txt]) n.textContent = n.textContent.replace(txt, EN[txt]);
    }
    raiz.querySelectorAll('input[placeholder]').forEach(inp => {
      if (EN[inp.placeholder]) inp.placeholder = EN[inp.placeholder];
    });
  }

  function set(l) {
    lang = l === 'en' ? 'en' : 'es';
    localStorage.setItem(LS, lang);
  }

  return { get lang() { return lang; }, set, t, loc, aplicar };
})();
