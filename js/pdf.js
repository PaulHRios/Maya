/* ============ Maya — generación del PDF de resumen ============ */

const PDFResumen = (() => {

  const ROSA = [240, 106, 155];
  const fmtFecha = d => new Date(d).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
  const fmtFechaHora = d => new Date(d).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const fmtHora = d => new Date(d).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

  function diasEnRango(desde, hasta) {
    const dias = [];
    const d = new Date(desde); d.setHours(0, 0, 0, 0);
    const fin = new Date(hasta);
    while (d <= fin) { dias.push(new Date(d)); d.setDate(d.getDate() + 1); }
    return dias;
  }
  const mismoDia = (a, b) => new Date(a).toDateString() === b.toDateString();

  /* Dibuja una gráfica con Chart.js en el canvas oculto y regresa la imagen */
  async function chartImg(cfg) {
    const canvas = document.getElementById('pdf-canvas');
    const prev = Chart.getChart(canvas);
    if (prev) prev.destroy();
    cfg.options = Object.assign({ responsive: false, animation: false, devicePixelRatio: 2 }, cfg.options || {});
    cfg.options.plugins = Object.assign({ legend: { labels: { font: { size: 16 } } } }, cfg.options.plugins || {});
    const chart = new Chart(canvas.getContext('2d'), cfg);
    await new Promise(r => setTimeout(r, 60));
    // exportar como JPEG con fondo blanco: el PDF pesa mucho menos que con PNG
    const out = document.createElement('canvas');
    out.width = canvas.width; out.height = canvas.height;
    const ctx = out.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(canvas, 0, 0);
    const img = out.toDataURL('image/jpeg', 0.85);
    chart.destroy();
    return img;
  }

  function encabezadoSeccion(doc, y, titulo) {
    if (y > 250) { doc.addPage(); y = 20; }
    doc.setFontSize(15);
    doc.setTextColor(...ROSA);
    doc.setFont(undefined, 'bold');
    doc.text(titulo, 14, y);
    doc.setTextColor(40, 35, 45);
    doc.setFont(undefined, 'normal');
    return y + 4;
  }

  function tabla(doc, y, head, body) {
    doc.autoTable({
      startY: y, head: [head], body,
      headStyles: { fillColor: ROSA, fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      alternateRowStyles: { fillColor: [255, 240, 246] },
      margin: { left: 14, right: 14 },
    });
    return doc.lastAutoTable.finalY + 12;
  }

  async function generar({ desde, hasta, secciones }) {
    const d = Store.data;
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const dias = diasEnRango(desde, hasta);
    const enRango = f => { const t = new Date(f); return t >= desde && t <= hasta; };

    /* portada / encabezado */
    doc.setFillColor(255, 227, 238);
    doc.rect(0, 0, 210, 48, 'F');
    doc.setFontSize(26);
    doc.setTextColor(217, 79, 132);
    doc.setFont(undefined, 'bold');
    doc.text(`Resumen de ${d.bebe.nombre || 'Maya'} 💗`.replace(' 💗', ''), 14, 20);
    doc.setFontSize(11);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(120, 100, 115);
    doc.text(`Del ${desde.toLocaleDateString('es-MX', { dateStyle: 'long' })} al ${hasta.toLocaleDateString('es-MX', { dateStyle: 'long' })}`, 14, 29);
    if (d.bebe.nacimiento) {
      const nacio = new Date(`${d.bebe.nacimiento}T${d.bebe.hora || '12:00'}`);
      const edadDias = Math.floor((hasta - nacio) / 86400000);
      const horaTxt = d.bebe.hora ? ` a las ${nacio.toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' })}` : '';
      doc.text(`Nació el ${nacio.toLocaleDateString('es-MX', { dateStyle: 'long' })}${horaTxt} · ${edadDias} días de vida`, 14, 36);
    }
    if (d.bebe.mama || d.bebe.papa) {
      const papas = [d.bebe.mama && `Mamá: ${d.bebe.mama}`, d.bebe.papa && `Papá: ${d.bebe.papa}`].filter(Boolean).join(' · ');
      doc.text(papas, 14, 43);
    }
    let y = 60;

    /* ---- Alimentación ---- */
    if (secciones.tomas) {
      const tomas = d.tomas.filter(t => enRango(t.inicio)).sort((a, b) => a.inicio.localeCompare(b.inicio));
      y = encabezadoSeccion(doc, y, 'Alimentación');
      if (tomas.length) {
        const porDia = dias.map(dia => {
          const del = tomas.filter(t => mismoDia(t.inicio, dia));
          return {
            ml: del.reduce((s, t) => s + (Number(t.ml) || 0), 0),
            min: Math.round(del.reduce((s, t) => s + (t.duracionSeg || 0), 0) / 60),
            n: del.length,
          };
        });
        const img = await chartImg({
          type: 'bar',
          data: {
            labels: dias.map(fmtFecha),
            datasets: [
              { label: 'Mililitros por día', data: porDia.map(p => p.ml), backgroundColor: '#f06a9b', borderRadius: 8 },
              { label: 'Minutos al pecho', data: porDia.map(p => p.min), backgroundColor: '#b39df5', borderRadius: 8 },
            ],
          },
        });
        doc.addImage(img, 'JPEG', 14, y, 182, 91);
        y += 100;
        const nombreTipo = { materno: 'Materna', donante: 'Donante', formula: 'Fórmula' };
        y = tabla(doc, y, ['Fecha y hora', 'Tipo', 'Lado', 'Duración', 'ml', 'Notas'],
          tomas.map(t => [
            fmtFechaHora(t.inicio),
            nombreTipo[t.tipo] || t.tipo,
            t.lado === 'izq' ? 'Izquierda' : t.lado === 'der' ? 'Derecha' : '—',
            t.duracionSeg ? `${Math.round(t.duracionSeg / 60)} min` : '—',
            t.ml || '—',
            t.notas || '',
          ]));
      } else { doc.setFontSize(10); doc.text('Sin registros en este periodo.', 14, y + 6); y += 16; }
    }

    /* ---- Pañales ---- */
    if (secciones.panales) {
      const pan = d.panales.filter(p => enRango(p.hora)).sort((a, b) => a.hora.localeCompare(b.hora));
      y = encabezadoSeccion(doc, y, 'Pañales (pipí y popó)');
      if (pan.length) {
        const cuenta = tipo => dias.map(dia => pan.filter(p => mismoDia(p.hora, dia) && (p.tipo === tipo || p.tipo === 'mixto')).length);
        const img = await chartImg({
          type: 'bar',
          data: {
            labels: dias.map(fmtFecha),
            datasets: [
              { label: 'Pipí', data: cuenta('pipi'), backgroundColor: '#74b9f0', borderRadius: 8 },
              { label: 'Popó', data: cuenta('popo'), backgroundColor: '#c79a6b', borderRadius: 8 },
            ],
          },
          options: { scales: { y: { ticks: { stepSize: 1 } } } },
        });
        doc.addImage(img, 'JPEG', 14, y, 182, 91);
        y += 100;
        const nombre = { pipi: 'Pipí', popo: 'Popó', mixto: 'Pipí + Popó' };
        y = tabla(doc, y, ['Fecha', 'Hora', 'Tipo', 'Notas'],
          pan.map(p => [fmtFecha(p.hora), fmtHora(p.hora), nombre[p.tipo] || p.tipo, p.notas || '']));
      } else { doc.setFontSize(10); doc.text('Sin registros en este periodo.', 14, y + 6); y += 16; }
    }

    /* ---- Sueño ---- */
    if (secciones.suenos) {
      const sue = d.suenos.filter(s => enRango(s.inicio) && s.fin).sort((a, b) => a.inicio.localeCompare(b.inicio));
      y = encabezadoSeccion(doc, y, 'Sueño');
      if (sue.length) {
        const horasPorDia = dias.map(dia =>
          Math.round(sue.filter(s => mismoDia(s.inicio, dia))
            .reduce((t, s) => t + (new Date(s.fin) - new Date(s.inicio)), 0) / 36000) / 100);
        const img = await chartImg({
          type: 'bar',
          data: {
            labels: dias.map(fmtFecha),
            datasets: [{ label: 'Horas de sueño por día', data: horasPorDia, backgroundColor: '#9b87e8', borderRadius: 8 }],
          },
        });
        doc.addImage(img, 'JPEG', 14, y, 182, 91);
        y += 100;
        y = tabla(doc, y, ['Se durmió', 'Despertó', 'Duración', 'Notas'],
          sue.map(s => {
            const min = Math.round((new Date(s.fin) - new Date(s.inicio)) / 60000);
            return [fmtFechaHora(s.inicio), fmtFechaHora(s.fin), `${Math.floor(min / 60)}h ${min % 60}m`, s.notas || ''];
          }));
      } else { doc.setFontSize(10); doc.text('Sin registros en este periodo.', 14, y + 6); y += 16; }
    }

    /* ---- Condiciones médicas ---- */
    if (secciones.condiciones && d.condiciones.length) {
      y = encabezadoSeccion(doc, y, 'Condiciones médicas');
      for (const c of d.condiciones) {
        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        if (y > 240) { doc.addPage(); y = 20; }
        doc.text(c.nombre, 14, y + 6);
        doc.setFont(undefined, 'normal');
        y += 10;
        const meds = [...(c.mediciones || [])].sort((a, b) => a.fecha.localeCompare(b.fecha));
        const conValor = meds.filter(m => m.valor !== null && m.valor !== '');
        if (conValor.length >= 2) {
          const img = await chartImg({
            type: 'line',
            data: {
              labels: conValor.map(m => fmtFechaHora(m.fecha)),
              datasets: [{
                label: `${c.nombre}${c.unidad ? ` (${c.unidad})` : ''}`,
                data: conValor.map(m => Number(m.valor)),
                borderColor: '#f06a9b', backgroundColor: '#f06a9b33',
                fill: true, tension: .35, pointRadius: 5,
              }],
            },
          });
          if (y > 180) { doc.addPage(); y = 20; }
          doc.addImage(img, 'JPEG', 14, y, 182, 91);
          y += 100;
        }
        if (meds.length) {
          y = tabla(doc, y, ['Fecha y hora', `Valor${c.unidad ? ` (${c.unidad})` : ''}`, 'Nota'],
            meds.map(m => [fmtFechaHora(m.fecha), (m.valor === null || m.valor === '') ? 'Pendiente' : m.valor, m.nota || '']));
        }
      }
    }

    /* ---- Intervenciones ---- */
    if (secciones.intervenciones) {
      const ints = d.intervenciones.filter(i => enRango(i.fecha)).sort((a, b) => a.fecha.localeCompare(b.fecha));
      if (ints.length) {
        y = encabezadoSeccion(doc, y, 'Intervenciones y procedimientos');
        y = tabla(doc, y, ['Fecha y hora', 'Intervención', 'Categoría', 'Notas'],
          ints.map(i => [fmtFechaHora(i.fecha), i.titulo, i.categoria || '', i.notas || '']));
      }
    }

    /* ---- Medicamentos ---- */
    if (secciones.medicamentos && d.medicamentos.length) {
      y = encabezadoSeccion(doc, y, 'Medicamentos y tratamientos');
      y = tabla(doc, y, ['Medicamento', 'Dosis', 'Frecuencia', 'Inicio', 'Estado', 'Notas'],
        d.medicamentos.map(m => [m.nombre, m.dosis || '', m.frecuencia || '',
          m.inicio ? fmtFecha(m.inicio) : '', m.activo ? 'Activo' : 'Terminado', m.notas || '']));
    }

    /* ---- Crecimiento ---- */
    if (secciones.crecimiento && d.crecimiento.length) {
      const cre = [...d.crecimiento].sort((a, b) => a.fecha.localeCompare(b.fecha));
      y = encabezadoSeccion(doc, y, 'Crecimiento');
      const img = await chartImg({
        type: 'line',
        data: {
          labels: cre.map(c => fmtFecha(c.fecha)),
          datasets: [{
            label: 'Peso (kg)', data: cre.map(c => c.pesoKg || null),
            borderColor: '#4cc38a', backgroundColor: '#4cc38a33', fill: true, tension: .35, pointRadius: 5,
          }],
        },
      });
      if (y > 180) { doc.addPage(); y = 20; }
      doc.addImage(img, 'JPEG', 14, y, 182, 91);
      y += 100;
      y = tabla(doc, y, ['Fecha', 'Peso (kg)', 'Talla (cm)', 'P. cefálico (cm)'],
        cre.map(c => [fmtFecha(c.fecha), c.pesoKg || '—', c.tallaCm || '—', c.perimetroCm || '—']));
    }

    /* pie de página */
    const pages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(170, 150, 160);
      doc.text(`Diario de ${d.bebe.nombre || 'Maya'} · generado el ${new Date().toLocaleString('es-MX')} · página ${i} de ${pages}`, 14, 290);
    }

    doc.save(`Resumen-${d.bebe.nombre || 'Maya'}-${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  return { generar };
})();
