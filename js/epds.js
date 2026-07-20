/* ============ Maya — bienestar de mamá (Escala de Edimburgo) ============
   EPDS: tamizaje validado de depresión posparto (Cox et al., 1987;
   versión validada en español). Es un tamizaje, NO un diagnóstico.
   Resultados: solo se guardan en el teléfono de mamá, nunca en la nube.
   Calendario (guías ACOG/AAP): cada 2 semanas hasta las 8 semanas
   posparto, luego mensual hasta el año; después queda disponible manual. */

const EPDS = (() => {

  const LS_RESULTADOS = 'maya.epds.v1';
  const LS_SNOOZE = 'maya.epds-luego.v1';

  // En los últimos 7 días… (cada opción con su puntaje oficial)
  const PREGUNTAS = [
    { texto: 'He podido reír y ver el lado bueno de las cosas', ops: [['Igual que siempre', 0], ['Ahora, no tanto como siempre', 1], ['Ahora, mucho menos', 2], ['No, nada en absoluto', 3]] },
    { texto: 'He mirado el futuro con placer e ilusión', ops: [['Igual que siempre', 0], ['Algo menos de lo que solía', 1], ['Mucho menos que antes', 2], ['No, nada en absoluto', 3]] },
    { texto: 'Me he culpado sin necesidad cuando las cosas no salían bien', ops: [['Sí, la mayoría de las veces', 3], ['Sí, algunas veces', 2], ['No muy a menudo', 1], ['No, nunca', 0]] },
    { texto: 'He estado ansiosa y preocupada sin motivo', ops: [['No, para nada', 0], ['Casi nada', 1], ['Sí, a veces', 2], ['Sí, muy a menudo', 3]] },
    { texto: 'He sentido miedo o pánico sin motivo alguno', ops: [['Sí, bastante', 3], ['Sí, a veces', 2], ['No, no mucho', 1], ['No, nada', 0]] },
    { texto: 'Las cosas me han estado agobiando', ops: [['Sí, la mayoría de las veces no he podido con todo', 3], ['Sí, a veces no he podido tan bien como siempre', 2], ['No, casi siempre he podido bien', 1], ['No, he podido con todo igual que siempre', 0]] },
    { texto: 'Me he sentido tan infeliz que he tenido dificultad para dormir', ops: [['Sí, la mayoría de las veces', 3], ['Sí, a veces', 2], ['No muy a menudo', 1], ['No, nada', 0]] },
    { texto: 'Me he sentido triste o desdichada', ops: [['Sí, casi siempre', 3], ['Sí, bastante a menudo', 2], ['No muy a menudo', 1], ['No, nada', 0]] },
    { texto: 'He estado tan infeliz que he llorado', ops: [['Sí, casi siempre', 3], ['Sí, bastante a menudo', 2], ['Solo en ocasiones', 1], ['No, nunca', 0]] },
    { texto: 'He pensado en hacerme daño a mí misma', ops: [['Sí, bastante a menudo', 3], ['A veces', 2], ['Casi nunca', 1], ['No, nunca', 0]] },
  ];


  function resultados() {
    try { return JSON.parse(localStorage.getItem(LS_RESULTADOS)) || []; }
    catch { return []; }
  }

  function guardarResultado(total, q10) {
    const lista = resultados();
    lista.push({ fecha: new Date().toISOString(), total, q10 });
    localStorage.setItem(LS_RESULTADOS, JSON.stringify(lista.slice(-40)));
  }

  /* ¿toca el chequeo? según días posparto y último resultado */
  function tocaChequeo(diasPosparto) {
    if (diasPosparto === null || diasPosparto < 7) return false;   // primera semana: aterrizar
    if (diasPosparto > 365) return false;                          // después del año: solo manual
    const snooze = localStorage.getItem(LS_SNOOZE);
    if (snooze && Date.now() < Number(snooze)) return false;
    const lista = resultados();
    if (!lista.length) return true;
    const ultimo = lista[lista.length - 1];
    const diasDesde = (Date.now() - new Date(ultimo.fecha)) / 86400000;
    if (ultimo.total >= 9 && ultimo.total <= 12) return diasDesde >= 7;   // zona media: revisar antes
    if (diasPosparto <= 56) return diasDesde >= 14;                        // cada 2 semanas hasta las 8 sem
    return diasDesde >= 30;                                                // mensual hasta el año
  }

  function posponer(dias = 2) {
    localStorage.setItem(LS_SNOOZE, String(Date.now() + dias * 86400000));
  }

  /* interpretación estándar del puntaje */
  function interpretar(total, q10) {
    if (q10 > 0) return 'urgente';
    if (total >= 13) return 'alto';
    if (total >= 9) return 'medio';
    return 'bien';
  }

  const RECURSOS = [
    { emoji: '📍', texto: 'Especialistas en depresión posparto cerca de ti', url: 'https://www.google.com/maps/search/psic%C3%B3logo+perinatal+depresi%C3%B3n+posparto' },
    { emoji: '☎️', texto: 'Línea de la Vida (México, 24/7 y gratuita): 800 911 2000', url: 'tel:8009112000' },
    { emoji: '💬', texto: 'SAPTEL, apoyo emocional 24/7: 55 5259 8121', url: 'tel:5552598121' },
    { emoji: '🌎', texto: 'Postpartum Support International (en español)', url: 'https://www.postpartum.net/en-espanol/' },
  ];

  /* version oficial en ingles (Cox, Holden & Sagovsky, 1987), aplicada al cargar */
  if (typeof I18N !== 'undefined' && I18N.lang === 'en') {
    const Q = [
      ['I have been able to laugh and see the funny side of things', [['As much as I always could', 0], ['Not quite so much now', 1], ['Definitely not so much now', 2], ['Not at all', 3]]],
      ['I have looked forward with enjoyment to things', [['As much as I ever did', 0], ['Rather less than I used to', 1], ['Definitely less than I used to', 2], ['Hardly at all', 3]]],
      ['I have blamed myself unnecessarily when things went wrong', [['Yes, most of the time', 3], ['Yes, some of the time', 2], ['Not very often', 1], ['No, never', 0]]],
      ['I have been anxious or worried for no good reason', [['No, not at all', 0], ['Hardly ever', 1], ['Yes, sometimes', 2], ['Yes, very often', 3]]],
      ['I have felt scared or panicky for no very good reason', [['Yes, quite a lot', 3], ['Yes, sometimes', 2], ['No, not much', 1], ['No, not at all', 0]]],
      ['Things have been getting on top of me', [['Yes, most of the time I have not been able to cope at all', 3], ['Yes, sometimes I have not been coping as well as usual', 2], ['No, most of the time I have coped quite well', 1], ['No, I have been coping as well as ever', 0]]],
      ['I have been so unhappy that I have had difficulty sleeping', [['Yes, most of the time', 3], ['Yes, sometimes', 2], ['Not very often', 1], ['No, not at all', 0]]],
      ['I have felt sad or miserable', [['Yes, most of the time', 3], ['Yes, quite often', 2], ['Not very often', 1], ['No, not at all', 0]]],
      ['I have been so unhappy that I have been crying', [['Yes, most of the time', 3], ['Yes, quite often', 2], ['Only occasionally', 1], ['No, never', 0]]],
      ['The thought of harming myself has occurred to me', [['Yes, quite often', 3], ['Sometimes', 2], ['Hardly ever', 1], ['Never', 0]]],
    ];
    PREGUNTAS.forEach((p, i) => { p.texto = Q[i][0]; p.ops = Q[i][1]; });
    RECURSOS[0].texto = 'Postpartum depression specialists near you';
    RECURSOS[1].texto = 'Linea de la Vida (Mexico, 24/7, free): 800 911 2000';
    RECURSOS[2].texto = 'SAPTEL emotional support 24/7: 55 5259 8121';
    RECURSOS[3].texto = 'Postpartum Support International: 1-800-944-4773 (EN/ES)';
  }


  return { PREGUNTAS, resultados, guardarResultado, tocaChequeo, posponer, interpretar, RECURSOS };
})();
