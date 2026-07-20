/* ============ Maya — retos y actividades de estimulación ============
   Genera la lista de actividades del día según la edad de la bebé
   (en semanas/meses) y sus condiciones médicas activas. Basado en
   guías de estimulación temprana (AAP, CDC) para cada etapa. */

const Actividades = (() => {

  /* Actividades por etapa de edad (en semanas de vida).
     min = duración sugerida con timer; sin min = solo palomita. */
  const ETAPAS = [
    {
      desde: 0, hasta: 4, nombre: 'Recién nacida',
      tareas: [
        { key: 'tummy', emoji: '🐢', titulo: 'Tummy time', min: 3, desc: 'Boca abajo despierta y vigilada, sobre tu pecho o una manta. Fortalece cuello y espalda. 2–3 veces al día, sesiones cortitas.' },
        { key: 'piel', emoji: '🤍', titulo: 'Piel con piel', min: 15, desc: 'Contacto directo con el pecho de mamá o papá. Regula su temperatura, su corazón y la llena de amor.' },
        { key: 'hablar', emoji: '💬', titulo: 'Platicarle y cantarle', min: 5, desc: 'Tu voz es su sonido favorito. Cuéntale tu día, cántale bajito mientras la cambias o la alimentas.' },
        { key: 'caritas', emoji: '😊', titulo: 'Verla cara a cara', min: 3, desc: 'A 20–30 cm de su carita (la distancia a la que ve mejor). Haz gestos suaves: es su primer "juguete".' },
        { key: 'masaje', emoji: '👐', titulo: 'Masaje suave', min: 5, desc: 'Caricias firmes y lentas en bracitos, piernas y espalda después del baño o cambio de pañal.' },
        { key: 'lectura', emoji: '📖', titulo: 'Leerle un cuento', min: 5, desc: 'Nunca es muy pronto: el ritmo de la lectura construye su cerebro y su vínculo contigo.' },
      ],
    },
    {
      desde: 4, hasta: 9, nombre: '1–2 meses',
      tareas: [
        { key: 'tummy', emoji: '🐢', titulo: 'Tummy time', min: 5, desc: 'Ya aguanta un poco más. Ponte a su altura y háblale para motivarla a levantar la cabecita.' },
        { key: 'contraste', emoji: '🎯', titulo: 'Seguir objetos con la vista', min: 3, desc: 'Mueve lento un objeto de colores contrastantes (o tu cara) de lado a lado para que lo siga.' },
        { key: 'hablar', emoji: '💬', titulo: 'Conversar y responder', min: 5, desc: 'Cuando haga sonidos, respóndele como plática. Estás enseñándole cómo funciona conversar.' },
        { key: 'sonidos', emoji: '🔔', titulo: 'Sonidos a los lados', min: 3, desc: 'Sonaja o tu voz a un lado y al otro: que busque de dónde viene el sonido.' },
        { key: 'masaje', emoji: '👐', titulo: 'Masaje y estiramientos', min: 5, desc: 'Masaje suave y "bicicleta" con sus piernitas. Ayuda también con los gases.' },
        { key: 'lectura', emoji: '📖', titulo: 'Leerle un cuento', min: 5, desc: 'Libros de alto contraste o cualquier cuento con tu voz suave.' },
        { key: 'piel', emoji: '🤍', titulo: 'Piel con piel', min: 15, desc: 'Sigue siendo oro puro para su desarrollo y el apego.' },
      ],
    },
    {
      desde: 9, hasta: 17, nombre: '2–4 meses',
      tareas: [
        { key: 'tummy', emoji: '🐢', titulo: 'Tummy time', min: 10, desc: 'Varias veces al día. Pon un juguete enfrente para que levante la cabeza y empuje con los brazos.' },
        { key: 'alcanzar', emoji: '🧸', titulo: 'Alcanzar juguetes', min: 5, desc: 'Cuelga o acerca juguetes a su alcance para que intente golpearlos o tomarlos.' },
        { key: 'espejo', emoji: '🪞', titulo: 'Jugar con el espejo', min: 3, desc: 'Que se vea en un espejo de bebé: le fascina y trabaja su atención visual.' },
        { key: 'risas', emoji: '😄', titulo: 'Hacerla sonreír', min: 5, desc: 'Gestos exagerados, sonidos chistosos, besitos en la panza. Su sonrisa social está floreciendo.' },
        { key: 'hablar', emoji: '💬', titulo: 'Imitar sus balbuceos', min: 5, desc: 'Repite sus "agú" y espera su respuesta. Turnos de conversación de verdad.' },
        { key: 'lectura', emoji: '📖', titulo: 'Leerle un cuento', min: 5, desc: 'Señala los dibujos y ponle voces a los personajes.' },
      ],
    },
    {
      desde: 17, hasta: 26, nombre: '4–6 meses',
      tareas: [
        { key: 'tummy', emoji: '🐢', titulo: 'Tummy time y rodar', min: 10, desc: 'Anímala a rodar poniendo juguetes a su lado. Celebra cada intento.' },
        { key: 'sentada', emoji: '🧘', titulo: 'Práctica de sentarse', min: 5, desc: 'Siéntala con apoyo (tus manos o cojines) para que fortalezca el tronco.' },
        { key: 'texturas', emoji: '🪶', titulo: 'Explorar texturas', min: 5, desc: 'Telas, juguetes rugosos, suaves, fríos: que toque de todo (siempre vigilada).' },
        { key: 'hablar', emoji: '💬', titulo: 'Nombrar las cosas', min: 5, desc: 'Di el nombre de lo que ve y toca: "manzana", "perro", "agua". Su cerebro lo guarda todo.' },
        { key: 'risas', emoji: '😄', titulo: 'Juegos de anticipación', min: 5, desc: '"Aquí viene el avioncito…": la espera y la sorpresa la hacen reír y aprender.' },
        { key: 'lectura', emoji: '📖', titulo: 'Leerle un cuento', min: 8, desc: 'Deja que toque y manotee las páginas. Libros de tela o cartón grueso.' },
      ],
    },
    {
      desde: 26, hasta: 39, nombre: '6–9 meses',
      tareas: [
        { key: 'peekaboo', emoji: '🙈', titulo: 'Jugar peekaboo', min: 5, desc: '¿Dónde está mamá? ¡Aquí está! Está aprendiendo que las cosas existen aunque no las vea.' },
        { key: 'sentada', emoji: '🧘', titulo: 'Sentarse y alcanzar', min: 10, desc: 'Sentada, pon juguetes un poquito lejos para que se estire y haga equilibrio.' },
        { key: 'gateo', emoji: '🚼', titulo: 'Motivar el gateo', min: 10, desc: 'Juguetes fuera de alcance en el piso, tú gateando junto a ella como ejemplo.' },
        { key: 'objetos', emoji: '🥄', titulo: 'Pasar objetos de mano', min: 5, desc: 'Dale objetos seguros para pasar de una mano a otra, golpear y soltar.' },
        { key: 'hablar', emoji: '💬', titulo: 'Sonidos y nombres', min: 5, desc: 'Repite "ma-má", "pa-pá". Nombra a las personas en fotos.' },
        { key: 'lectura', emoji: '📖', titulo: 'Leerle un cuento', min: 8, desc: 'Pregúntale "¿dónde está el gato?" y señala. Pronto lo hará ella.' },
      ],
    },
    {
      desde: 39, hasta: 53, nombre: '9–12 meses',
      tareas: [
        { key: 'caminar', emoji: '🚶', titulo: 'Práctica de pararse', min: 10, desc: 'Que se apoye en muebles firmes para pararse y dar pasitos laterales.' },
        { key: 'pinza', emoji: '🤏', titulo: 'Pinza fina', min: 5, desc: 'Cereales o trocitos suaves para tomar con dedito índice y pulgar (vigilada).' },
        { key: 'apilar', emoji: '🧱', titulo: 'Apilar y meter', min: 8, desc: 'Cubos para apilar, meter y sacar cosas de un bote: ciencia pura para ella.' },
        { key: 'imitar', emoji: '👋', titulo: 'Imitar gestos', min: 5, desc: 'Aplaudir, decir adiós, mandar besitos. La imitación es su superpoder ahorita.' },
        { key: 'hablar', emoji: '💬', titulo: 'Primeras palabras', min: 5, desc: 'Habla despacio y claro. Celebra cualquier intento de palabra como gol del mundial.' },
        { key: 'lectura', emoji: '📖', titulo: 'Leerle un cuento', min: 10, desc: 'Deja que ella pase las páginas y "lea" contigo.' },
      ],
    },
  ];

  /* Actividades extra generadas por condiciones médicas activas */
  const POR_CONDICION = [
    {
      claves: ['icteri', 'bilirrub'],
      tareas: [
        { key: 'luz', emoji: '☀️', titulo: 'Baño de luz indirecta', min: 10, desc: 'Cerca de una ventana con luz natural indirecta (nunca sol directo). Ayuda a bajar la bilirrubina.', porCondicion: 'Ictericia' },
        { key: 'tomas-frec', emoji: '🍼', titulo: 'Vigilar tomas frecuentes', desc: 'Comer seguido (8–12 veces al día) ayuda a eliminar la bilirrubina. Revisa que las tomas del día vayan al corriente.', porCondicion: 'Ictericia' },
      ],
    },
    {
      claves: ['colico', 'cólico', 'gases'],
      tareas: [
        { key: 'bici', emoji: '🚲', titulo: 'Bicicleta y masaje de pancita', min: 5, desc: 'Movimientos de bicicleta con sus piernas y masaje en el abdomen en círculos, para los gases.', porCondicion: 'Cólicos' },
      ],
    },
    {
      claves: ['reflujo'],
      tareas: [
        { key: 'erguida', emoji: '🫂', titulo: 'Mantenerla erguida tras comer', min: 20, desc: 'Sostenla vertical 20–30 min después de las tomas para que la leche se asiente.', porCondicion: 'Reflujo' },
      ],
    },
  ];


  /* ---------- traduccion EN (aplicada al cargar; cambiar idioma recarga) ---------- */
  if (typeof I18N !== 'undefined' && I18N.lang === 'en') {
    const NOMBRES_EN = ['Newborn', '1-2 months', '2-4 months', '4-6 months', '6-9 months', '9-12 months'];
    const T_EN = {
      '0:tummy': ['Tummy time', 'On her belly, awake and supervised, on your chest or a blanket. Builds neck and back strength. 2-3 short sessions a day.'],
      '0:piel': ['Skin-to-skin', "Direct contact on mom's or dad's chest. Regulates her temperature and heartbeat - and fills her with love."],
      '0:hablar': ['Talk & sing to her', 'Your voice is her favorite sound. Tell her about your day, sing softly while changing or feeding her.'],
      '0:caritas': ['Face time', "8-12 inches from her face (her best focus range). Make gentle faces - you are her first toy."],
      '0:masaje': ['Gentle massage', 'Slow, firm strokes on her arms, legs and back after bath or diaper change.'],
      '0:lectura': ['Read her a story', 'Never too early: the rhythm of reading builds her brain and your bond.'],
      '1:tummy': ['Tummy time', 'She can hold it a bit longer now. Get down to her level and talk to encourage her to lift her head.'],
      '1:contraste': ['Visual tracking', 'Slowly move a high-contrast object (or your face) side to side so she follows it.'],
      '1:hablar': ['Chat & respond', 'When she makes sounds, answer like a conversation. You are teaching her how talking works.'],
      '1:sonidos': ['Sounds to the sides', 'A rattle or your voice on one side, then the other: let her find where it comes from.'],
      '1:masaje': ['Massage & stretches', 'Gentle massage plus "bicycle" legs. Helps with gas too.'],
      '1:lectura': ['Read her a story', 'High-contrast books or any story in your soft voice.'],
      '1:piel': ['Skin-to-skin', 'Still pure gold for development and bonding.'],
      '2:tummy': ['Tummy time', 'Several times a day. Put a toy in front so she lifts her head and pushes up on her arms.'],
      '2:alcanzar': ['Reaching for toys', 'Hang or hold toys within reach so she tries to bat or grab them.'],
      '2:espejo': ['Mirror play', 'Let her see herself in a baby mirror - fascinating, and great for visual attention.'],
      '2:risas': ['Make her smile', 'Big expressions, funny sounds, tummy kisses. Her social smile is blooming.'],
      '2:hablar': ['Echo her babbles', 'Repeat her "agoo" and wait for a reply. Real conversational turns.'],
      '2:lectura': ['Read her a story', 'Point at pictures and give the characters voices.'],
      '3:tummy': ['Tummy time & rolling', 'Encourage rolling by placing toys at her side. Celebrate every try.'],
      '3:sentada': ['Sitting practice', 'Sit her with support (your hands or cushions) to strengthen her core.'],
      '3:texturas': ['Explore textures', 'Fabrics, bumpy toys, soft, cool: let her touch everything (always supervised).'],
      '3:hablar': ['Name the world', 'Say the names of what she sees and touches: "apple", "dog", "water". Her brain stores it all.'],
      '3:risas': ['Anticipation games', '"Here comes the airplane...": the wait and the surprise make her laugh and learn.'],
      '3:lectura': ['Read her a story', 'Let her touch and swat the pages. Cloth or thick board books.'],
      '4:peekaboo': ['Play peekaboo', 'Where is mommy? Here she is! She is learning things exist even when unseen.'],
      '4:sentada': ['Sit & reach', 'While sitting, place toys slightly out of reach so she stretches and balances.'],
      '4:gateo': ['Encourage crawling', 'Toys just out of reach on the floor - and you crawling next to her as the example.'],
      '4:objetos': ['Hand-to-hand', 'Give her safe objects to pass between hands, bang and drop.'],
      '4:hablar': ['Sounds & names', 'Repeat "ma-ma", "da-da". Name the people in photos.'],
      '4:lectura': ['Read her a story', 'Ask "where is the cat?" and point. Soon she will do it herself.'],
      '5:caminar': ['Standing practice', 'Let her pull up on sturdy furniture and cruise sideways.'],
      '5:pinza': ['Pincer grasp', 'Cereal puffs or soft bits to pick up with finger and thumb (supervised).'],
      '5:apilar': ['Stack & dump', 'Blocks to stack, things to put in and out of a bin: pure science for her.'],
      '5:imitar': ['Imitate gestures', 'Clapping, waving bye-bye, blowing kisses. Imitation is her superpower right now.'],
      '5:hablar': ['First words', 'Speak slowly and clearly. Celebrate any word attempt like a World Cup goal.'],
      '5:lectura': ['Read her a story', 'Let her turn the pages and "read" along with you.'],
    };
    ETAPAS.forEach((e, i) => {
      e.nombre = NOMBRES_EN[i] || e.nombre;
      e.tareas.forEach(t => { const tr = T_EN[i + ':' + t.key]; if (tr) { t.titulo = tr[0]; t.desc = tr[1]; } });
    });
    const C_EN = {
      luz: ['Indirect light bath', 'Near a window with natural indirect light (never direct sun). Helps bring bilirubin down.', 'Jaundice'],
      'tomas-frec': ['Keep feeds frequent', 'Eating often (8-12 times a day) helps clear bilirubin. Check that today\'s feeds are on track.', 'Jaundice'],
      bici: ['Bicycle legs & tummy massage', 'Bicycle motions with her legs and clockwise belly massage, for gas.', 'Colic'],
      erguida: ['Keep her upright after feeds', 'Hold her vertical 20-30 min after feeding so the milk settles.', 'Reflux'],
    };
    POR_CONDICION.forEach(g => g.tareas.forEach(t => {
      const tr = C_EN[t.key];
      if (tr) { t.titulo = tr[0]; t.desc = tr[1]; if (t.porCondicion) t.porCondicion = tr[2]; }
    }));
  }

  const normalizar = s => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  function etapaDe(edadDias) {
    const sem = Math.floor(edadDias / 7);
    return ETAPAS.find(e => sem >= e.desde && sem < e.hasta) || ETAPAS[ETAPAS.length - 1];
  }

  /* Lista de tareas de hoy: base de la etapa + extras por condición.
     Día con todas las fijas (tummy, hablar, lectura) y 2 rotativas
     para que no sea siempre lo mismo. */
  function tareasDeHoy(edadDias, condiciones, fecha) {
    const etapa = etapaDe(edadDias);
    const fijas = ['tummy', 'hablar', 'lectura', 'piel'];
    const base = etapa.tareas.filter(t => fijas.includes(t.key));
    const rotativas = etapa.tareas.filter(t => !fijas.includes(t.key));
    // rotación determinística por fecha: ambos celulares ven lo mismo
    const dia = Math.floor(new Date(fecha + 'T12:00').getTime() / 86400000);
    const extras = [];
    if (rotativas.length) {
      for (let i = 0; i < Math.min(2, rotativas.length); i++) {
        extras.push(rotativas[(dia + i) % rotativas.length]);
      }
    }
    const porCond = [];
    for (const c of (condiciones || [])) {
      const n = normalizar(c.nombre);
      for (const grupo of POR_CONDICION) {
        if (grupo.claves.some(k => n.includes(normalizar(k)))) porCond.push(...grupo.tareas);
      }
    }
    return { etapa, tareas: [...porCond, ...base, ...extras] };
  }

  /* ---------- progreso, racha y medallas ---------- */

  const hechasEnFecha = (registros, fecha) =>
    registros.filter(a => a.fecha === fecha && a.hecha).length;

  function racha(registros, hoyStr) {
    let dias = 0;
    const d = new Date(hoyStr + 'T12:00');
    // hoy cuenta si ya hay al menos una hecha; si no, la racha se mide desde ayer
    if (!hechasEnFecha(registros, hoyStr)) d.setDate(d.getDate() - 1);
    while (true) {
      const f = d.toISOString().slice(0, 10);
      if (hechasEnFecha(registros, f) >= 1) { dias++; d.setDate(d.getDate() - 1); }
      else break;
    }
    return dias;
  }

  function medallas(registros, fotosSemanales, rachaActual) {
    const total = registros.filter(a => a.hecha).length;
    const porDia = {};
    registros.filter(a => a.hecha).forEach(a => porDia[a.fecha] = (porDia[a.fecha] || 0) + 1);
    const diasPerfectos = Object.values(porDia).filter(n => n >= 5).length;
    return [
      { emoji: '🌱', nombre: I18N.lang === 'en' ? 'First goal' : 'Primer reto', desc: I18N.lang === 'en' ? 'Completed their first activity' : 'Completaron su primera actividad', ganada: total >= 1 },
      { emoji: '⭐', nombre: I18N.lang === 'en' ? 'Good rhythm' : 'Buen ritmo', desc: I18N.lang === 'en' ? '10 activities completed' : '10 actividades completadas', ganada: total >= 10 },
      { emoji: '🔥', nombre: I18N.lang === 'en' ? '3-day streak' : 'Racha de 3', desc: I18N.lang === 'en' ? '3 days in a row with goals' : '3 días seguidos con retos', ganada: rachaActual >= 3 },
      { emoji: '🏆', nombre: I18N.lang === 'en' ? '7-day streak' : 'Racha de 7', desc: I18N.lang === 'en' ? 'A whole week — wow!' : 'Una semana entera, ¡wow!', ganada: rachaActual >= 7 },
      { emoji: '💎', nombre: I18N.lang === 'en' ? 'Perfect day' : 'Día perfecto', desc: I18N.lang === 'en' ? '5+ goals in a single day' : '5+ retos en un solo día', ganada: diasPerfectos >= 1 },
      { emoji: '📸', nombre: I18N.lang === 'en' ? 'Her first portrait' : 'Su primer retrato', desc: I18N.lang === 'en' ? 'First weekly photo' : 'Primera foto semanal', ganada: fotosSemanales >= 1 },
      { emoji: '🎞️', nombre: I18N.lang === 'en' ? 'Collectors' : 'Coleccionistas', desc: I18N.lang === 'en' ? '4 weekly photos' : '4 fotos semanales', ganada: fotosSemanales >= 4 },
      { emoji: '👑', nombre: I18N.lang === 'en' ? 'Golden month' : 'Mes dorado', desc: I18N.lang === 'en' ? '30-day streak' : '30 días de racha', ganada: rachaActual >= 30 },
    ];
  }

  return { tareasDeHoy, etapaDe, racha, medallas, hechasEnFecha };
})();
