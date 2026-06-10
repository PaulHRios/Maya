/* ============ Maya — información de condiciones médicas ============
   Al agregar una condición, busca un resumen en internet (Wikipedia en
   español) y lo combina con una guía local de cuidados para recién
   nacidos. Todo se presenta ya resumido, con enlaces para leer más. */

const InfoMedica = (() => {

  // Guía local de cuidados para condiciones comunes del recién nacido
  const GUIA = {
    ictericia: {
      claves: ['ictericia', 'bilirrubina'],
      titulo: 'Ictericia neonatal',
      resumen: 'La ictericia es el color amarillento de la piel y los ojos por exceso de bilirrubina. Es muy común en recién nacidos y casi siempre desaparece sola en 1–2 semanas, pero los niveles altos requieren vigilancia médica (a veces fototerapia).',
      cuidados: [
        'Alimentar con frecuencia (8–12 veces al día): comer ayuda a eliminar la bilirrubina.',
        'Dar luz natural indirecta cerca de una ventana (nunca sol directo).',
        'Vigilar que el amarillo no avance hacia abdomen, brazos o piernas.',
        'Acudir a los controles de bilirrubina que indique el pediatra.',
        'Urgencia si: está muy somnolienta, no quiere comer, llanto agudo o fiebre.',
      ],
    },
    colico: {
      claves: ['colico', 'cólico', 'gases'],
      titulo: 'Cólicos del lactante',
      resumen: 'Episodios de llanto intenso e inconsolable en un bebé sano, frecuentes por la tarde-noche. Suelen empezar a las 2–3 semanas y mejorar hacia los 3–4 meses.',
      cuidados: [
        'Sacar el aire después de cada toma (palmaditas suaves en la espalda).',
        'Mecer, pasear, ruido blanco o baño tibio pueden calmar.',
        'Masaje suave en el abdomen en sentido de las manecillas del reloj.',
        'Posición boca abajo sobre el antebrazo ("posición avión") mientras está despierta y vigilada.',
        'Consultar si hay vómito, fiebre, sangre en popó o no sube de peso.',
      ],
    },
    reflujo: {
      claves: ['reflujo', 'regurgitacion', 'regurgitación'],
      titulo: 'Reflujo del lactante',
      resumen: 'Devolver pequeñas cantidades de leche después de comer es normal en los primeros meses. Se considera enfermedad solo si afecta el peso o causa mucho malestar.',
      cuidados: [
        'Mantenerla erguida 20–30 minutos después de cada toma.',
        'Tomas más pequeñas y frecuentes.',
        'Sacar el aire a mitad y al final de la toma.',
        'Consultar si vomita con fuerza, hay sangre, o no gana peso.',
      ],
    },
    dermatitis: {
      claves: ['dermatitis', 'rozadura', 'pañalitis'],
      titulo: 'Dermatitis del pañal',
      resumen: 'Irritación de la piel en la zona del pañal por humedad y roce. Es muy común y suele mejorar en pocos días con cuidados básicos.',
      cuidados: [
        'Cambiar el pañal con frecuencia y en cuanto haga popó.',
        'Limpiar con agua tibia y secar con toques suaves, sin tallar.',
        'Aplicar crema con óxido de zinc en cada cambio.',
        'Dejarla un rato sin pañal para que se airee la piel.',
        'Consultar si hay ampollas, pus o no mejora en 3 días.',
      ],
    },
    fiebre: {
      claves: ['fiebre', 'temperatura'],
      titulo: 'Fiebre en el recién nacido',
      resumen: 'En un bebé menor de 3 meses, una temperatura rectal de 38 °C o más se considera urgencia y debe valorarla un médico de inmediato.',
      cuidados: [
        'Medir la temperatura con termómetro confiable.',
        'NO dar medicamentos sin indicación del pediatra.',
        'No abrigar de más; mantener un ambiente fresco.',
        'Acudir a urgencias si tiene menos de 3 meses y 38 °C o más.',
      ],
    },
    costra: {
      claves: ['costra lactea', 'costra láctea', 'dermatitis seborreica'],
      titulo: 'Costra láctea',
      resumen: 'Escamas amarillentas y grasosas en el cuero cabelludo. Es inofensiva y suele desaparecer sola en algunos meses.',
      cuidados: [
        'Lavar el cabello con shampoo suave para bebé.',
        'Aceite mineral o de bebé 15 min antes del baño y cepillar suave.',
        'No rascar ni arrancar las escamas.',
      ],
    },
  };

  function normalizar(s) {
    return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  function guiaLocal(nombre) {
    const n = normalizar(nombre);
    for (const k of Object.keys(GUIA)) {
      if (GUIA[k].claves.some(c => n.includes(normalizar(c)))) return GUIA[k];
    }
    return null;
  }

  // fetch con límite de tiempo para no dejar la pantalla esperando
  function fetchConTimeout(url, ms = 7000) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    return fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(t));
  }

  async function buscarWikipedia(nombre) {
    try {
      let res = await fetchConTimeout(`https://es.wikipedia.org/w/rest.php/v1/search/title?q=${encodeURIComponent(nombre)}&limit=1`);
      if (!res.ok) return null;
      const search = await res.json();
      if (!search.pages || !search.pages.length) return null;
      const title = search.pages[0].key;
      res = await fetchConTimeout(`https://es.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`);
      if (!res.ok) return null;
      const sum = await res.json();
      return {
        titulo: sum.title,
        extracto: sum.extract,
        url: (sum.content_urls && sum.content_urls.desktop.page) || `https://es.wikipedia.org/wiki/${title}`,
      };
    } catch (e) {
      console.error('Búsqueda no disponible', e);
      return null;
    }
  }

  function enlaces(nombre) {
    const q = encodeURIComponent(nombre + ' bebé recién nacido');
    return [
      { texto: 'MedlinePlus (en español)', url: `https://medlineplus.gov/spanish/search.html?query=${encodeURIComponent(nombre)}` },
      { texto: 'KidsHealth (en español)', url: `https://kidshealth.org/es/search/?q=${encodeURIComponent(nombre)}` },
      { texto: 'Buscar en Google', url: `https://www.google.com/search?q=${q}` },
    ];
  }

  /* Busca y resume todo: guía local + Wikipedia + enlaces confiables */
  async function investigar(nombre) {
    const local = guiaLocal(nombre);
    const wiki = await buscarWikipedia(nombre);
    return {
      resumen: (local && local.resumen) || (wiki && wiki.extracto) || null,
      extraWiki: local && wiki ? wiki.extracto : null,
      cuidados: local ? local.cuidados : null,
      enlaces: [
        ...(wiki ? [{ texto: `Wikipedia: ${wiki.titulo}`, url: wiki.url }] : []),
        ...enlaces(nombre),
      ],
      consultado: new Date().toISOString(),
    };
  }

  return { investigar };
})();
