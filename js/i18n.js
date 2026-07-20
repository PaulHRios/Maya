/* ============ Maya — idioma (Español / English) ============
   El español es el idioma fuente de la interfaz; este módulo traduce
   la capa visible al inglés con un diccionario de textos exactos y
   cambia el formato de fechas. Se guarda por dispositivo. */

const I18N = (() => {

  const LS = 'maya.idioma.v1';
  let lang = localStorage.getItem(LS) || '';
  if (!lang) {
    // visitantes sin sesión (demo público) arrancan en inglés; la familia, en español
    const esDemo = new URLSearchParams(location.search).has('demo')
      || (localStorage.getItem('maya.session.v1') !== 'ok' && sessionStorage.getItem('maya.ir-login') !== '1');
    lang = esDemo ? 'en' : 'es';
  }

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
    // hojas y formularios
    'Editar toma': 'Edit feed', 'Toma de pecho 🤱': 'Breastfeed 🤱', 'Toma de leche extraída 🥛': 'Expressed-milk feed 🥛',
    'Fórmula 🍼': 'Formula 🍼', 'Lado': 'Side', 'Minutos': 'Minutes', 'Hora de la toma': 'Feed time',
    '¿Qué traía el biberón? 🍼': 'What was in the bottle? 🍼', 'Leche extraída': 'Expressed milk', 'Fórmula': 'Formula',
    '＋ Registrar toma de pecho sin timer': '＋ Log a breastfeed without the timer',
    '＋ Registrar toma de leche extraída (biberón)': '＋ Log an expressed-milk feed (bottle)',
    '＋ Registrar toma de fórmula': '＋ Log a formula feed',
    '🥛 ¿Extrajiste leche? Agrégala en el Banco de leche': '🥛 Pumped milk? Add it in the Milk bank',
    // sueño
    'Se durmió ahora': 'Fell asleep now', 'Registro manual 🌙': 'Manual entry 🌙', 'Editar registro': 'Edit entry',
    '😴 Sueño': '😴 Sleep', '👁️ Vigilia (despierta)': '👁️ Wake window (awake)', 'Comenzó': 'Started', 'Terminó': 'Ended',
    '＋ Registrar sueño o vigilia con horario manual': '＋ Log sleep or wake window manually',
    '¿Quién está despierto con ella?': 'Who is up with her?', '¿Quién estuvo despierto con ella?': 'Who was up with her?',
    'Bitácora': 'Logbook', '¿Qué está pasando?': "What's happening?", 'Nota de la vigilia 📝': 'Wake-window note 📝',
    'Agregar a la bitácora': 'Add to logbook', '👁️ Vigilia en curso · bitácora': '👁️ Wake window · live logbook',
    'Dormida': 'Asleep', 'usa la barra de arriba': 'use the bar above', 'bitácora aquí abajo ↓': 'logbook below ↓',
    'Crear nuestra rutina': 'Create our routine', '✏️ Editar': '✏️ Edit', '🌙 Rutina en curso': '🌙 Routine running',
    'Hora objetivo para dormir (misma cada noche)': 'Target bedtime (same every night)', 'Nuevo paso': 'New step',
    '＋ Agregar paso': '＋ Add step', 'Guardar rutina': 'Save routine', 'Emoji': 'Emoji', 'Min': 'Min',
    '😴 ¡Se durmió! Iniciar timer de sueño': '😴 She fell asleep! Start sleep timer',
    // pañal
    'Registrar pañal': 'Log a diaper', 'Editar pañal': 'Edit diaper', 'Tipo': 'Type', '💧 Pipí': '💧 Pee',
    '💩 Popó': '💩 Poop', '🌊 Ambos': '🌊 Both', 'Color de la popó': 'Poop color', 'Consistencia': 'Consistency',
    'Consistencia (opcional)': 'Consistency (optional)', 'Guardar sin color': 'Save without color',
    '＋ Registrar con otra hora': '＋ Log with another time', '📷 Tomar foto': '📷 Take photo', '🖼️ Del carrete': '🖼️ From library',
    'Análisis del pañal 🔍': 'Diaper analysis 🔍', '🗑️ Borrar la foto de este registro': "🗑️ Delete this entry's photo",
    'Pipí se registra al instante; popó pregunta color y consistencia ✨': 'Pee logs instantly; poop asks color & consistency ✨',
    'Notas (consistencia, cantidad…)': 'Notes (consistency, amount…)',
    // banco de leche
    'Agregar extracción 🥛': 'Add pumped milk 🥛', 'Agregar sin timer': 'Add without timer', 'Descongelar': 'Thaw',
    'Congelar del refri': 'Freeze from fridge', 'Descartar': 'Discard', 'Descongelar 🧊': 'Thaw 🧊',
    'Congelar del refri ❄️': 'Freeze from fridge ❄️', 'Descartar leche 🗑️': 'Discard milk 🗑️',
    'Corregir inventario ✏️': 'Fix inventory ✏️', '✏️ Corregir inventario (contar lo que hay)': '✏️ Fix inventory (count what you have)',
    '¿Dónde se guarda?': 'Where does it go?', '¿De dónde se descarta?': 'Discard from where?', '🥛 Refri': '🥛 Fridge',
    '🧊 Congelador': '🧊 Freezer', 'En el refri (ml)': 'In the fridge (ml)', 'Congelados (ml)': 'Frozen (ml)',
    'Guardar corrección': 'Save correction', 'listos para calentar y usar': 'ready to warm & use',
    '🥛 En el refri': '🥛 In the fridge', '🧊 Congelados': '🧊 Frozen', 'desde la toma': 'from the feed',
    '⏱️ Iniciar extracción · elegir método': '⏱️ Start pumping · choose method', '¿Qué método hoy? 🥛': 'Which method today? 🥛',
    '¿Cuánto salió? 🥛': 'How much did you get? 🥛', 'Guardar extracción': 'Save session',
    'Descartar sesión (no salió leche)': 'Discard session (no milk)', 'hoy': 'today', 'promedio/día': 'avg/day',
    'récord día': 'best day', 'récord sesión': 'best session', '🤖 Entrenadora de producción': '🤖 Production coach',
    // condiciones
    '＋ Agregar condición': '＋ Add condition', 'Nueva condición 🩺': 'New condition 🩺',
    'Nombre de la condición': 'Condition name', 'Unidad de medición (opcional)': 'Measurement unit (optional)',
    'Agregar y buscar información ✨': 'Add & look up info ✨', '＋ Medición': '＋ Reading', 'pendiente': 'pending',
    '📖 Información': '📖 Information', '💚 Cuidados sugeridos': '💚 Suggested care', 'Ya se curó 🎉': 'All better 🎉',
    'Superada': 'Resolved', 'Sin mediciones todavía.': 'No readings yet.',
    'Valor': 'Value', 'Nota (opcional)': 'Note (optional)', 'Fecha y hora': 'Date & time', 'Borrar medición': 'Delete reading',
    // citas / meds / crecimiento / fotos
    '＋ Agendar cita': '＋ Book appointment', 'Nueva cita 📅': 'New appointment 📅', 'Editar cita': 'Edit appointment',
    'Lugar (opcional)': 'Place (optional)', '⏰ Agregar al calendario del teléfono (.ics con alarma)': "⏰ Add to phone calendar (.ics with alarm)",
    '＋ Agregar medicamento': '＋ Add medication', 'Dosis': 'Dose', 'Frecuencia': 'Frequency',
    'Tratamiento activo': 'Active treatment', 'terminado': 'finished', 'Tomas de hoy': "Today's doses",
    '＋ Registrar medidas': '＋ Log measurements', 'Peso (kg)': 'Weight (kg)', 'Talla (cm)': 'Height (cm)',
    'Perímetro cefálico (cm, opcional)': 'Head circumference (cm, optional)',
    '📷 Tomar foto': '📷 Take photo', '🖼️ Subir foto': '🖼️ Upload photo', 'Borrar': 'Delete',
    // resumen pdf
    'Generando… ⏳': 'Generating… ⏳', 'PDF descargado 📄': 'PDF downloaded 📄',
    // retos
    'Foto de la semana': 'Photo of the week', 'Tomarla': 'Take it', 'de hoy': 'today',
    'Su retrato semanal para ver cómo crece': 'Her weekly portrait to watch her grow',
    '¡Día perfecto! 🌟': 'Perfect day! 🌟', '¡Van muy bien!': 'Doing great!', 'Retos de hoy': "Today's goals",
    'Etapa:': 'Stage:', '⏱️ tocar para iniciar': '⏱️ tap to start',
    // ajustes / cuentas
    'Hora': 'Time', 'Sin definir': 'Not set', 'Última sincronización:': 'Last sync:',
    'Aún no se ha sincronizado.': 'Not synced yet.', '¿Cómo configurarlo? (una sola vez)': 'How to set it up (one time)',
    'Usuario u organización': 'User or organization', 'Repositorio': 'Repository',
    'Token de acceso (fine-grained, con permiso Contents)': 'Access token (fine-grained, Contents permission)',
    '＋ Agregar cuenta de familiar': '＋ Add a family member account', 'Agregar cuenta de familiar 👪': 'Add family member 👪',
    'Correo del familiar': "Family member's email", 'Contraseña (mínimo 8 caracteres)': 'Password (min. 8 characters)',
    'Es': 'They are', '👩 Mamá': '👩 Mom', '👨 Papá': '👨 Dad', 'Agregar cuenta': 'Add account',
    'Crear cuenta nueva ✨': 'Create new account ✨', 'Tu correo': 'Your email', 'Nombre de tu bebé': "Your baby's name",
    'Tú eres': 'You are', 'Crear mi cuenta': 'Create my account',
    '👶 ＋ Agregar otro bebé (gemelos, el que viene…)': '👶 ＋ Add another baby (twins, the next one…)',
    'Agregar otro bebé 👶': 'Add another baby 👶', 'Crear su registro': 'Create their journal',
    '📷 Foto de perfil del bebé': "📷 Baby's profile photo", '¿De qué color la quieren? 🎨': 'Pick your color 🎨',
    'Tema de color 🎨': 'Color theme 🎨', 'Actual:': 'Current:',
    // bienestar
    'Sobre ti 💚': 'About you 💚', 'Entendido 💗': 'Got it 💗', 'Cerrar': 'Close',
    // misc
    'Salir del demo': 'Exit demo', 'Notas': 'Notes', 'Sí': 'Yes',
    'Leche materna': 'Breast milk', 'Leche donante': 'Donor milk', '‹ Más': '‹ Back',
    'PRÓXIMAS': 'UPCOMING', 'PASADAS': 'PAST', 'Dosis de hoy': "Today's doses",
    'En esta etapa es común 🗓️': 'Common at this stage 🗓️', '🔍 Lectura': '🔍 Reading',
    'Registra una condición (por ejemplo, ictericia) y la app buscará información y cuidados sugeridos.': 'Log a condition (jaundice, for example) and the app will look up info and suggested care.',
    'Aquí aparecerán las tomas de Maya': "Feeds will appear here", 'Aquí aparecerán los cambios de pañal': 'Diaper changes will appear here',
    'Aquí aparecerán los sueños y vigilias de Maya': 'Sleep and wake windows will appear here',
    'Registra una extracción para empezar su banco de leche': 'Log a pumping session to start the milk bank',
    'Estás en el demo con datos sintéticos: la sincronización está deshabilitada y nada se guarda en ningún servidor. Crea tu cuenta para tener tu propio registro.': 'You are in the demo with synthetic data: sync is disabled and nothing is saved to any server. Create an account to start your own journal.',
    'Español': 'Español', 'English': 'English',
    'La leche materna dura ~4 días en el refri y ~6 meses en el congelador. Usen primero la más antigua.': 'Breast milk keeps ~4 days in the fridge and ~6 months in the freezer. Use the oldest first.',
    'Consejos generales de lactancia; una asesora certificada siempre es la mejor guía.': 'General lactation tips; a certified consultant is always the best guide.',
    'Análisis hecho aquí en el teléfono con sus propios registros y guías generales de pediatría. Orienta, pero nunca sustituye a su pediatra.': "Analysis done right on this phone from her own logs plus general pediatric guidance. It informs — it never replaces her pediatrician.",
    'Peso, talla y perímetro': 'Weight, height & head circ.',
    'Actividades sugeridas según su edad (guías de estimulación temprana AAP/CDC). Siempre con supervisión; cada bebé lleva su propio ritmo. 💗': 'Age-based activity ideas (AAP/CDC early-stimulation guidance). Always supervised; every baby has her own pace. 💗',

  };


  /* patrones dinámicos (con números) para lang=en */
  const REGLAS = [
    [/^Hoy · (\d+) pañal(?:es)? 🧷$/, 'Today · $1 diaper(s) 🧷'],
    [/^Ayer · (\d+) pañal(?:es)? 🧷$/, 'Yesterday · $1 diaper(s) 🧷'],
    [/ · (\d+) pañal(?:es)? 🧷$/, ' · $1 diaper(s) 🧷'],
    [/^(\d+) tomas$/, '$1 feeds'], [/^(\d+) pañal(?:es)?$/, '$1 diaper(s)'],
    [/^(\d+) pipí$/, '$1 pee'], [/^(\d+) popó$/, '$1 poop'],
    [/^gastados hoy$/, 'used today'], [/^(\d+) popó hoy$/, '$1 poop today'],
    [/^última (.+)$/, 'last $1'], [/^último (.+)$/, 'last $1'],
    [/^(\d+) ml listos en el refri$/, '$1 ml ready in the fridge'],
    [/^🧊 (\d+) ml congelados · meta (\d+) ml \(~2 días\)$/, '🧊 $1 ml frozen · goal $2 ml (~2 days)'],
    [/^Meta sugerida: $/, 'Suggested goal: '],
    [/^(\d+) sesiones\/día · promedio (\d+) ml\/día(.*)$/, '$1 sessions/day · avg $2 ml/day$3'],
    [/^semana (\d+) de vida$/, 'week $1 of life'], [/^Semana (\d+)$/, 'Week $1'],
    [/^(\d+) días? de racha$/, '$1-day streak'], [/^(\d+) día de racha$/, '$1-day streak'],
    [/^(\d+) min$/, '$1 min'], [/^~(\d+) min$/, '~$1 min'],
    [/^Durmió (.+)$/, 'Slept $1'], [/^Vigilia (.+)$/, 'Awake $1'],
    [/^(\d+) h (\d+) min$/, '$1 h $2 min'],
    [/^despierta$/, 'awake'], [/^de sueño hoy$/, 'of sleep today'],
    [/^(\d+) puntos? en su análisis de hoy · toca para ver$/, "$1 point(s) in today's check · tap to view"],
    [/^(\d+) pasos · ~(\d+) min(.*)$/, '$1 steps · ~$2 min$3'],
    [/ · hora objetivo /, ' · target time '],
    [/^falta (\d+:\d+)$/, '$1 left'],
    [/^(\d+)\/(\d+) de hoy$/, "$1/$2 today"],
    [/^Viendo a (.+) 💗$/, 'Now viewing $1 💗'],
    [/^En biberón$/, 'Bottle-fed'],
    [/^(\d+) imágenes?$/, '$1 image(s)'],
    [/^(\d+) recuerdos$/, '$1 memories'], [/^(\d+) registradas$/, '$1 logged'], [/^(\d+) activos$/, '$1 active'],
    [/^(\d+) ml$/, '$1 ml'],
    [/^Foto de la semana (\d+)$/, 'Photo of week $1'],
    [/^en (\d+) días?$/, 'in $1 day(s)'], [/^(\d+) ve(?:z|ces) al día$/, '$1x per day'],
    [/Agregar al calendario del teléfono/, 'Add to phone calendar'],
    [/^Su retrato semanal.*$/, 'Her weekly portrait — this week\'s is still missing!'],
    [/^Meta sugerida: (\d+) ml — unos 2 días de lo que suele tomar en biberón\.$/, 'Suggested goal: $1 ml — about 2 days of her usual bottle intake.'],
    [/^(\d+(?:\.\d+)?) (h|kg|cm|g)$/, '$1 $2'],
  ];

  const loc = () => lang === 'en' ? 'en-US' : 'es-MX';
  const t = s => lang === 'en' ? (EN[s] || s) : s;

  /* recorre un nodo y traduce los textos exactos del diccionario */
  function aplicar(raiz) {
    if (lang !== 'en' || !raiz) return;
    const walker = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walker.nextNode())) {
      const txt = n.textContent.trim();
      if (!txt) continue;
      if (EN[txt]) { n.textContent = n.textContent.replace(txt, EN[txt]); continue; }
      for (const [re, rep] of REGLAS) {
        if (re.test(txt)) { n.textContent = n.textContent.replace(txt, txt.replace(re, rep)); break; }
      }
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
