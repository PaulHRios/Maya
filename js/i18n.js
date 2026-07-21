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

    // ---- inventario exhaustivo (formularios, placeholders, toasts, párrafos) ----
    // comida
    'Materna': 'Breast', 'Extraída': 'Expressed', 'Donante': 'Donor',
    'Aún sin registros': 'No entries yet', 'izquierda': 'left', 'derecha': 'right',
    'Toma cancelada': 'Feed canceled', 'Toma en pausa ⏸': 'Feed paused ⏸',
    'Toma reanudada ▶': 'Feed resumed ▶', 'Toma guardada 🍼': 'Feed saved 🍼',
    'Ya hay una toma en curso': 'A feed is already running',
    '⏱️ Toma en curso — usa la barra rosa de arriba para terminarla.': '⏱️ Feed in progress — use the pink bar above to finish it.',
    'Esto registra lo que Maya': 'This logs what',
    'se tomó': 'drank', 'en biberón (se resta del banco de leche). Para agregar leche que extrajiste, usa el': 'from a bottle (it is deducted from the milk bank). To add milk you pumped, use the',
    // sueño
    'Sueño registrado 🌙': 'Sleep logged 🌙', 'Dulces sueños 😴': 'Sweet dreams 😴',
    'Ya hay un sueño en curso': 'A sleep is already running', 'Ya hay una vigilia en curso': 'A wake window is already running',
    'La hora de fin debe ser después': 'The end time must be later',
    '☀️ Despertó': '☀️ Woke up', '😴 Terminó': '😴 Ended',
    'antes de la siguiente siesta.': 'before the next nap.',
    'Agregar nota a la bitácora…': 'Add a note to the logbook…',
    'Comió bien, se quedó dormida…': 'Fed well, fell asleep…',
    'Siesta en su cuna, muy despierta y tranquila…': 'Nap in her crib, wide awake and calm…',
    'Ve anotando qué pasa: "llora por cólicos", "la cargamos y se calmó", "pusimos música"…': 'Jot down what happens: "crying from colic", "we held her and she calmed", "we played music"…',
    'Llora por cólicos, la cargué y se calmó…': 'Crying from colic, I held her and she calmed…',
    'Basado en guías de sueño infantil y sus propios registros de la semana.': "Based on infant-sleep guidelines and her own logs from the week.",
    'Consejo: siempre el mismo orden, empezando 30–45 min antes de la hora objetivo, y terminando en la cuna somnolienta pero despierta.': 'Tip: always the same order, starting 30–45 min before the target time, and ending in the crib drowsy but awake.',
    '✨ Rutina completa — ahora sí, a dormir': '✨ Routine complete — now, off to sleep',
    '🌙 Rutina iniciada — palomea cada paso': '🌙 Routine started — check off each step',
    'Ojitos bien abiertos 👁️ · ve anotando en la bitácora': 'Eyes wide open 👁️ · keep notes in the logbook',
    'Escribe el paso': 'Write the step', 'Agrega al menos un paso': 'Add at least one step',
    'Ya hay una actividad en curso': 'An activity is already running',
    // vigilia / autor
    'Dónde, quién, cómo reaccionó…': 'Where, who, how she reacted…',
    'Lado izquierdo, en la mañana…': 'Left side, in the morning…',
    'Así cada nota que escriban llevará una etiquetita\n      de quién la escribió. Se pregunta una sola vez por teléfono (se puede cambiar en Ajustes).': "That way every note you write carries a little tag of who wrote it. You're asked once per phone (you can change it in Settings).",
    '¿De quién es este teléfono? 📱': "Whose phone is this? 📱",
    // pañal
    'Pipí 💧 registrado': 'Pee 💧 logged', 'Análisis guardado 🔍': 'Analysis saved 🔍',
    '🔍 Analizando la foto…': '🔍 Analyzing the photo…', 'No se pudo leer la foto': "Couldn't read the photo",
    'Archivo no válido': 'Invalid file', 'Aguada, con semillitas, abundante…': 'Runny, seedy, plentiful…',
    'Notas (consistencia, cantidad…)': 'Notes (consistency, amount…)',
    'Análisis aproximado hecho en el teléfono; no sustituye la valoración del pediatra.': "Rough analysis done on the phone; it doesn't replace the pediatrician's assessment.",
    'La lectura es orientativa. Si agregan foto, se analiza aquí en el teléfono y se guarda en su repositorio privado.': 'The reading is a guide. If you add a photo, it is analyzed here on the phone and saved to your private repository.',
    '💡 Ese color vale la pena comentarlo al pediatra': '💡 That color is worth mentioning to the pediatrician',
    '¿Borrar la foto? El registro del pañal se conserva.': 'Delete the photo? The diaper entry is kept.',
    '¿Borrar esta foto del registro?': 'Delete this photo from the entry?',
    // banco de leche
    'Extracción cancelada': 'Pumping canceled', 'Sesión descartada': 'Session discarded',
    'Ya hay una extracción en curso': 'A pumping session is already running',
    'Pon los mililitros': 'Enter the milliliters', 'Pon los mililitros (o descarta la sesión)': 'Enter the milliliters (or discard the session)',
    '⏱️ Extracción en curso — usa la barra azul de arriba': '⏱️ Pumping in progress — use the blue bar above',
    'Cuenten lo que hay físicamente y pongan los totales reales; la app ajusta la diferencia.': 'Count what you physically have and enter the real totals; the app adjusts the difference.',
    'Registra una extracción para empezar su banco de leche': 'Log a pumping session to start the milk bank',
    // producción coach
    'Sal a la luz del día 15 min, aunque sea al patio con la bebé.': 'Get 15 min of daylight, even in the yard with the baby.',
    // condiciones / análisis
    'Ictericia, reflujo, cólicos…': 'Jaundice, reflux, colic…',
    'Escribe el nombre': 'Write the name', 'Escribe el motivo': 'Write the reason',
    'Escribe qué le hicieron': 'Write what was done', '¿Qué le hicieron?': 'What was done?',
    'Categoría': 'Category', 'Condición borrada': 'Condition deleted', 'Condición reabierta': 'Condition reopened',
    'Medición borrada': 'Reading deleted', 'Intervención guardada': 'Procedure saved',
    'Análisis guardado': 'Analysis saved',
    'Al guardarla, la app buscará un resumen y cuidados sugeridos automáticamente.': 'When you save it, the app will look up a summary and suggested care automatically.',
    'Esta información es orientativa y no sustituye la valoración de su pediatra.': "This information is a guide and doesn't replace your pediatrician's assessment.",
    '¿Borrar esta condición y todas sus mediciones?': 'Delete this condition and all its readings?',
    '¿Borrar este registro?': 'Delete this entry?',
    'Registra tomas y pañales para que pueda analizar cómo va.': 'Log feeds and diapers so it can analyze how she is doing.',
    'ℹ️ Hay pocos registros en las últimas 24 h, así que el análisis es parcial — entre más registren, más fino se pone.': 'ℹ️ There are few entries in the last 24 h, so the analysis is partial — the more you log, the sharper it gets.',
    '💡 Para reducir las molestias': '💡 To ease the discomfort', '🛍️ Consejo de compras': '🛍️ Shopping tip',
    'muy común': 'very common', 'nuevo, por ejemplo': 'new, for example',
    // citas / meds / crecimiento
    'Agenda su siguiente consulta, vacunas o laboratorio': 'Schedule her next visit, vaccines or lab',
    'Control del mes, vacunas, laboratorio…': 'Monthly check-up, vaccines, lab…',
    'Lugar (opcional)': 'Place (optional)', 'Llevar cartilla, preguntas para el doctor…': 'Bring the health record, questions for the doctor…',
    'Próximas': 'Upcoming', 'El 🔔 la agrega al calendario del teléfono con alarma (1 día y 1 hora antes)': "The 🔔 adds it to the phone calendar with an alarm (1 day and 1 hour before)",
    '📅 Ábrelo para agregarlo a tu calendario con alarma': '📅 Open it to add it to your calendar with an alarm',
    'Vitaminas, tratamientos y medicamentos de Maya': "Vitamins, treatments and medications",
    'Registra el peso y talla de cada consulta': 'Log the weight and height at each visit',
    'Le sacaron sangre para bilirrubina': 'They drew blood for bilirubin',
    'Lab del hospital, esperando resultado…': 'Hospital lab, waiting for the result…',
    'Llora por cólicos, la cargué y se calmó': 'Crying from colic, I held her and she calmed',
    '＋ Registrar intervención': '＋ Log a procedure',
    // fotos
    'Guarda fotos de momentos especiales o de cosas que quieras enseñarle al pediatra': "Save photos of special moments or of things you want to show the pediatrician",
    'Su retrato semanal para ver su progreso. ¡La de esta semana aún no está!': "Her weekly portrait to see her progress. This week's isn't here yet!",
    'Foto de perfil actualizada 📷': 'Profile photo updated 📷', '¡Qué carita! 📷💗': 'What a face! 📷💗',
    'No se pudo generar el PDF': "Couldn't generate the PDF",
    // retos
    'Retos de hoy': "Today's goals", '¡Van muy bien!': 'Doing great!',
    // sincronización / ajustes
    'Configura la sincronización en Ajustes': 'Set up sync in Settings',
    'Copia el token y pégalo aquí en los dos celulares.': 'Copy the token and paste it here on both phones.',
    'En GitHub crea un repositorio': 'On GitHub create a repository',
    'Usa un repositorio PRIVADO': 'Use a PRIVATE repository',
    'para que los datos\n          de la bebé no sean públicos.': "so the baby's data isn't public.",
    'Para que los dos celulares vean los mismos datos, la app los guarda en un\n          repositorio de GitHub.': 'So both phones see the same data, the app stores it in a GitHub repository.',
    'Sincronización configurada ✅': 'Sync configured ✅',
    'Más → Ajustes': 'More → Settings',
    'Para sugerirle actividades a su medida, pon la fecha de nacimiento de Maya en': 'To suggest activities tailored to her, set the birth date in',
    'Cada teléfono puede tener el suyo, y se puede cambiar cuando quieran en Ajustes.': 'Each phone can have its own, and you can change it whenever you like in Settings.',
    // cuentas / familias
    'Nombre del bebé': "Baby's name", 'Ponle nombre a tu bebé': 'Name your baby',
    'Máximo 5 bebés': 'Up to 5 babies', 'Sin cuentas locales': 'No local accounts',
    'La nueva cuenta entra a ESTA familia con acceso a los mismos datos, y lo que registre quedará firmado con su nombre. (La cuenta vive en este dispositivo; en otro teléfono se crea igual y se conecta la misma nube en Ajustes.)': "The new account joins THIS family with access to the same data, and whatever they log is signed with their name. (The account lives on this device; on another phone you create it the same way and connect the same cloud in Settings.)",
    'Se crea una familia nueva con su propio bebé y registro completo. Los datos viven en este dispositivo; en Ajustes podrás conectar tu propia nube (repositorio privado de GitHub) para sincronizar con tu pareja.': 'A new family is created with its own baby and full journal. The data lives on this device; in Settings you can connect your own cloud (private GitHub repository) to sync with your partner.',
    'Cada bebé tiene su propio registro completo (tomas, pañales, retos, banco de leche…) y podrán cambiar entre ellos con las pestañitas de arriba. Hasta 5.': 'Each baby has their own full journal (feeds, diapers, goals, milk bank…) and you can switch between them with the little tabs at the top. Up to 5.',
    // temas
    '¿De qué color la quieren? 🎨': 'Pick your color 🎨',
    // EPDS / bienestar
    'La depresión posparto es': 'Postpartum depression is',
    'Indicaste pensamientos de hacerte daño. Eso merece atención HOY, no mañana.': 'You noted thoughts of harming yourself. That deserves attention TODAY, not tomorrow.',
    '💚 Esta semana, con intención': '💚 This week, on purpose',
    'Duerme cuando Maya duerma al menos una vez al día; los pendientes esperan.': 'Sleep when the baby sleeps at least once a day; the to-dos can wait.',
    'Volveremos a preguntarte en una semana. Si esto crece, busca apoyo — abajo hay opciones.': "We'll check in again in a week. If this grows, seek support — there are options below.",
    'Gracias por tomarte estos 2 minutos. Cuidarte a ti también es cuidar a Maya. Te volveremos a preguntar más adelante — y si un día te sientes distinta, el test siempre está en Más → Bienestar de mamá.': "Thanks for taking these 2 minutes. Caring for yourself is also caring for the baby. We'll ask again later — and if one day you feel different, the test is always in More → Mom's wellbeing.",
    'La Escala de Edimburgo es un tamizaje validado, no un diagnóstico; solo un profesional puede diagnosticar. Resultados guardados únicamente en tu teléfono.': 'The Edinburgh Scale is a validated screening, not a diagnosis; only a professional can diagnose. Results saved only on your phone.',
    'Tus respuestas solo se guardan en TU teléfono; no se suben a la nube ni las ve nadie más.': 'Your answers are saved only on YOUR phone; they are never uploaded and no one else sees them.',
    'Esta app cuida a Maya, pero Maya te necesita bien a ti. Cada cierto tiempo te haremos\n        un chequeo cortito (2 minutos, 10 preguntas) que usan los médicos de todo el mundo\n        para cuidar el ánimo de las mamás. Es privado: solo tú ves las respuestas.': "This app cares for the baby, but the baby needs you well too. Every so often we'll do a quick check-in (2 minutes, 10 questions) that doctors worldwide use to look after moms' mood. It's private: only you see the answers.",
    'Sí, va — 2 minutos 💚': 'Sure — 2 minutes 💚', 'Ahora no, en unos días': 'Not now, in a few days',
    'Te pregunto en un par de días 💚': "I'll ask again in a couple of days 💚",
    'Sobre ti 💚': 'About you 💚', 'Sí': 'Yes',
    // confirmaciones genéricas
    '¿Cancelar la toma sin guardar?': 'Cancel the feed without saving?',
    '¿Cancelar la extracción sin guardar?': 'Cancel the pumping session without saving?',
    '¿Cancelar la actividad sin marcarla?': 'Cancel the activity without marking it?',
    '¿Cancelar la rutina de esta noche?': "Cancel tonight's routine?",
    '¿Cancelar sin guardar?': 'Cancel without saving?',
    // placeholders del banco
    'Pasó de los 4 días…': 'Past the 4 days…', 'Extracción de la mañana…': 'Morning pumping session…',
    // otros
    'Con la primera toma de la mañana': 'With the first morning feed',
    '1 vez al día': 'Once a day',
    // subtítulos del menú Más
    'Consultas, vacunas y laboratorios': 'Visits, vaccines and labs',
    'Un chequeo para ti, no solo para la bebé': 'A check-in for you, not just baby',
    // checkboxes del PDF (¿Qué incluir?)
    '🍼 Alimentación': '🍼 Feeding', '💧 Pañales (con gráfica)': '💧 Diapers (with chart)',
    '🌙 Sueño': '🌙 Sleep', '🩺 Condiciones médicas': '🩺 Medical conditions',
    '💉 Intervenciones': '💉 Procedures', '💊 Medicamentos': '💊 Medications',
    '📏 Crecimiento': '📏 Growth',
    // otros checkboxes / labels
    'Ya fuimos ✅': 'Already went ✅', 'Tratamiento activo': 'Active treatment',
    'Sincronizar automáticamente': 'Sync automatically',
    // toasts que faltaban (traducidos automáticamente por toast()→I18N.t)
    'Rutina guardada 🌙': 'Routine saved 🌙', 'Rutina cancelada': 'Routine canceled',
    'Nota agregada 📝': 'Note added 📝', 'Registro cancelado': 'Entry canceled',
    'Vigilia registrada 👁️': 'Wake window logged 👁️', 'Este registro no tiene foto': "This entry has no photo",
    'Foto borrada': 'Photo deleted', 'Actividad cancelada': 'Activity canceled',
    'Movimiento guardado 🥛': 'Movement saved 🥛', 'Medicamento guardado': 'Medication saved',
    'Medidas guardadas 📏': 'Measurements saved 📏', 'Foto guardada 📸': 'Photo saved 📸',
    'Guardado 💗': 'Saved 💗', 'Llena usuario, repo y token': 'Fill in user, repo and token',
    'Sincronizando…': 'Syncing…', 'Respaldo importado ✅': 'Backup imported ✅',
    'Cuenta agregada 👪': 'Account added 👪', 'Registro borrado': 'Entry deleted',
    'Ponle nombre': 'Give it a name', 'Cita guardada 📅': 'Appointment saved 📅',
    'Actualizando… 💗': 'Refreshing… 💗',

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
    [/^Foto de la semana (\d+) 📸$/, 'Photo of week $1 📸'],
    [/^(\d+) día(?:s)? de racha$/, '$1-day streak'],
    [/^(\d+) punto(?:s)? en su análisis de hoy · toca para ver$/, "$1 point(s) in today's check · tap to view"],
    [/^Etapa: (.+) · semana (\d+) de vida$/, 'Stage: $1 · week $2 of life'],
    [/^promedio\/día$/, 'avg/day'], [/^récord día$/, 'best day'], [/^récord sesión$/, 'best session'],
    [/^terminado$/, 'finished'], [/^pendiente$/, 'pending'], [/^activos$/, 'active'],
    [/^(\d+) ml congelados · meta (\d+) ml \(~2 días\)$/, '$1 ml frozen · goal $2 ml (~2 days)'],
    [/^Superada el (.+)$/, 'Resolved on $1'],
    [/^En los últimos 7 días… · pregunta (\d+) de 10$/, 'In the past 7 days… · question $1 of 10'],
    [/^Puntaje (\d+)\/30 — (.+)$/, 'Score $1/30 — $2'],
    [/^Aviso por su edad \((\d+) semanas\)\. Guía general — su pediatra siempre manda\.$/, 'Heads-up for her age ($1 weeks). General guidance — her pediatrician always has the final say.'],
    [/^Teléfono de (.+) 💗$/, "$1's phone 💗"],
    [/^Durmió (.+)$/, 'Slept $1'], [/^Vigilia (.+)$/, 'Awake $1'],
    [/^Último chequeo: (.+)$/, 'Last check-in: $1'],
    [/^(\d+) ml listos · (\d+) ml congelados$/, '$1 ml ready · $2 ml frozen'],
    [/^Próxima: (.+)$/, 'Next: $1'], [/^Próximo: (.+)$/, 'Next: $1'],
    [/^Actual: (.+)$/, 'Current: $1'],
    [/^(\d+) registradas$/, '$1 logged'], [/^(\d+) recuerdos$/, '$1 memories'],
    [/^(\d+) activos$/, '$1 active'],
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
