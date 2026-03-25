const PDFDocument = require('pdfkit');
const DARK = '#1a1a2e'; const GRAY = '#6b7280'; const RED = '#dc2626'; const YELLOW = '#d97706'; const GREEN = '#16a34a'; const PURPLE = '#6B21A8';

function getStatusColor(text) {
  if (text.includes('Rojo') || /critico|error/i.test(text)) return RED;
  if (text.includes('Amarillo') || /atencion|warn/i.test(text)) return YELLOW;
  return GREEN;
}

function generatePdf(summaryText, startDate) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const doc = new PDFDocument({ size: 'A4', margin: 40, info: { Title: 'CaaS Informe Nocturno', Author: 'Solidus Capital' } });
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    const W = doc.page.width - 80;

    // Header
    doc.rect(0, 0, doc.page.width, 52).fill(DARK);
    doc.fontSize(18).fillColor('#fff').font('Helvetica-Bold').text('CaaS · Informe Nocturno de Logs', 40, 16, { width: W - 100 });
    doc.fontSize(8).fillColor('#9ca3af').font('Helvetica').text(`Solidus Capital · Generado ${new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })}`, 40, 38, { width: W });

    // Period bar
    const dateLabel = startDate.toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid', weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
    doc.rect(0, 52, doc.page.width, 22).fill('#2d2d44');
    doc.fontSize(9).fillColor('#d1d5db').font('Helvetica').text(`📅  ${dateLabel}  ·  20:00 → 08:00h (Barcelona)`, 40, 59, { width: W });

    doc.y = 90;

    // Body
    for (const rawLine of summaryText.split('\n')) {
      const line = rawLine.trimEnd();
      if (/^(STATUS|RESUMEN|INCIDENCIAS|ALERTAS|ACTIVIDAD|ACCION|ACCIÓN)/.test(line.trim())) {
        if (doc.y > doc.page.height - 100) doc.addPage();
        doc.moveDown(0.4);
        const color = line.includes('STATUS') ? getStatusColor(summaryText) : line.includes('INCIDENCIAS') ? RED : line.includes('ALERTAS') ? YELLOW : line.includes('ACTIVIDAD') ? GREEN : line.includes('ACCION') || line.includes('ACCIÓN') ? '#2563eb' : PURPLE;
        doc.fontSize(10).fillColor(color).font('Helvetica-Bold').text(line.trim(), { width: W });
        const y = doc.y;
        doc.moveTo(40, y).lineTo(40 + W, y).strokeColor(color).lineWidth(0.5).stroke();
        doc.moveDown(0.2);
      } else if (line.trim() === '') {
        doc.moveDown(0.3);
      } else {
        if (doc.y > doc.page.height - 80) doc.addPage();
        const isErr = /error|fail|crash|critico/i.test(line);
        const isWrn = /warn|atencion|timeout/i.test(line);
        doc.fontSize(9).fillColor(isErr ? RED : isWrn ? YELLOW : DARK).font(isErr || isWrn ? 'Helvetica-Bold' : 'Helvetica').text(line, { width: W, lineGap: 1 });
      }
    }

    // Footer
    const fy = doc.page.height - 30;
    doc.rect(0, fy - 8, doc.page.width, 38).fill('#f3f4f6');
    doc.fontSize(7.5).fillColor(GRAY).font('Helvetica').text('Generado automaticamente por caas-log-reporter · Solidus Capital · mam@soliduscapital.io', 40, fy, { width: W, align: 'center' });
    doc.end();
  });
}

module.exports = { generatePdf };
