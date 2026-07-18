/* Information boundary for health tracking.
   The tracker records what a licensed professional has said; it does not
   diagnose, triage, prescribe, or scrape condition-specific advice. */
const InfoMedica = (() => {
  'use strict';

  function texto(value, max = 120) {
    return String(value || '').replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, max);
  }

  function enlaces(nombre) {
    const query = encodeURIComponent(texto(nombre));
    return [
      { texto: 'MedlinePlus en español', url: `https://medlineplus.gov/spanish/search.html?query=${query}` },
      { texto: 'HealthyChildren en español', url: `https://www.healthychildren.org/Spanish/search/Pages/results.aspx?query=${query}` },
    ];
  }

  async function investigar(nombre) {
    const condicion = texto(nombre) || 'esta condición';
    return {
      resumen: `Este espacio organiza las mediciones y las indicaciones que reciban sobre ${condicion}. La interpretación y el plan de atención corresponden a su profesional de salud.`,
      cuidados: [
        'Anota la fecha, unidad, método de medición y la indicación exacta recibida.',
        'Lleva el resumen de registros a la siguiente consulta para revisarlo en conjunto.',
        'Ante una preocupación sobre el estado del bebé, contacta a su profesional o a los servicios locales de emergencia.',
      ],
      enlaces: enlaces(condicion),
      consultado: new Date().toISOString(),
      tipo: 'registro_no_medico',
    };
  }

  return Object.freeze({ investigar });
})();
