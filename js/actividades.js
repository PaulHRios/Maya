/* ============ Maya — ideas de vínculo y juego ============
   Sugerencias generales organizadas por edad. No se adaptan a condiciones
   médicas y siempre requieren supervisión de un adulto. */

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
    return {
      etapa,
      tareas: [...base, ...extras],
      aviso: 'Ideas generales de juego, siempre con supervisión. Si nació prematura o tiene indicaciones especiales, consulta primero a su profesional de salud.',
    };
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
      { emoji: '🌱', nombre: 'Primer reto', desc: 'Completaron su primera actividad', ganada: total >= 1 },
      { emoji: '⭐', nombre: 'Buen ritmo', desc: '10 actividades completadas', ganada: total >= 10 },
      { emoji: '🔥', nombre: 'Racha de 3', desc: '3 días seguidos con retos', ganada: rachaActual >= 3 },
      { emoji: '🏆', nombre: 'Racha de 7', desc: 'Una semana entera, ¡wow!', ganada: rachaActual >= 7 },
      { emoji: '💎', nombre: 'Día perfecto', desc: '5+ retos en un solo día', ganada: diasPerfectos >= 1 },
      { emoji: '📸', nombre: 'Su primer retrato', desc: 'Primera foto semanal', ganada: fotosSemanales >= 1 },
      { emoji: '🎞️', nombre: 'Coleccionistas', desc: '4 fotos semanales', ganada: fotosSemanales >= 4 },
      { emoji: '👑', nombre: 'Mes dorado', desc: '30 días de racha', ganada: rachaActual >= 30 },
    ];
  }

  return { tareasDeHoy, etapaDe, racha, medallas, hechasEnFecha };
})();
