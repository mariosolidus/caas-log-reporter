const PDFDocument = require('pdfkit');

const DARK = '#1a1a2e';
const GRAY = '#6b7280';
const RED = '#dc2626';
const YELLOW = '#d97706';
const GREEN = '#16a34a';
const BLUE = '#2563eb';
const PURPLE = '#6B21A8';

// Strip emojis and markdown syntax for clean PDF rendering
function cleanText(text) {
  return text
    .replace(/[\u{1F000}-\u{1FFFF}]|[\u{2600}-\u{27BF}]|[\u{FE00}-\u{FEFF}]/gu, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^#{1,4}\s*/, '')
    .trim();
}

function isSectionHeader(line) {
  const clean = cleanText(line).trim().toUpperCase();
  return /^(STATUS\s*GLOBAL|RESUMEN\s*EJECUTIVO|INCIDENCIAS|ALERTAS|ACTIVIDAD\s*NORMAL|ACCION|ACCION\s*REQUERIDA)/.test(clean);
}

function getSectionColor(line) {
  const clean = cleanText(line).toUpperCase();
  if (clean.includes('INCIDENCIAS')) return RED;
  if (clean.includes('ALERTAS') || clean.includes('ADVERTENCIAS')) return YELLOW;
  if (clean.includes('ACTIVIDAD')) return GREEN;
  if (clean.includes('ACCION')) return BLUE;
  if (clean.includes('STATUS')) {
    if (clean.includes('VERDE')) return GREEN;
    if (clean.includes('AMARILLO')) return YELLOW;
    if (clean.includes('ROJO')) return RED;
    return GREEN;
  }
  return PURPLE;
}

function isTableRow(line) {
  return line.trim().startsWith('|') && line.trim().endsWith('|');
}

function isSeparatorRow(line) {
  return /^\|[\s\-|:]+\|$/.test(line.trim());
}

function generatePdf(summaryText, startDate) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const doc = new PDFDocument({
      size: 'A4',
      margin: 40,
      info: { Title: 'CaaS Informe Nocturno', Author: 'Solidus Capital' }
    });
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const W = doc.page.width - 80;

    // Header
    doc.rect(0, 0, doc.page.width, 52).fill(DARK);
    doc.fontSize(18).fillColor('#fff').font('Helvetica-Bold')
      .text('CaaS - Informe Nocturno de Logs', 40, 16, { width: W - 100 });
    doc.fontSize(8).fillColor('#9ca3af').font('Helvetica')
      .text('Solidus Capital - Generado ' + new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' }), 40, 38, { width: W });

    // Period bar
    const dateLabel = startDate.toLocaleDateString('es-ES', {
      timeZone: 'Europe/Madrid', weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
    });
    doc.rect(0, 52, doc.page.width, 22).fill('#2d2d44');
    doc.fontSize(9).fillColor('#d1d5db').font('Helvetica')
      .text(dateLabel + ' - 20:00 a 08:00h (Barcelona)', 40, 59, { width: W });

    doc.y = 90;

    const lines = summaryText.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i];
      const line = cleanText(raw);

      // Skip horizontal rules and empty lines
      if (/^---+$/.test(line) || line === '') {
        if (line === '') doc.moveDown(0.25);
        continue;
      }

      // Skip table separator rows
      if (isSeparatorRow(raw)) continue;

      // Check available space
      if (doc.y > doc.page.height - 90) doc.addPage();

      // Section headers
      if (isSectionHeader(raw)) {
        doc.moveDown(0.5);
        const color = getSectionColor(raw);
        doc.fontSize(10).fillColor(color).font('Helvetica-Bold').text(line, { width: W });
        const y = doc.y;
        doc.moveTo(40, y).lineTo(40 + W, y).strokeColor(color).lineWidth(0.5).stroke();
        doc.moveDown(0.3);
        continue;
      }

      // Table rows
      if (isTableRow(raw)) {
        const cells = raw.split('|').map(c => cleanText(c)).filter(Boolean);
        if (cells.length > 0) {
          const cellW = W / cells.length;
          const startX = 40;
          const startY = doc.y;
          cells.forEach((cell, idx) => {
            const isErr = /error|fail|critico/i.test(cell);
            const isWrn = /baja|warn|info/i.test(cell);
            doc.fontSize(8)
              .fillColor(isErr ? RED : isWrn ? YELLOW : DARK)
              .font(idx === 0 ? 'Helvetica-Bold' : 'Helvetica')
              .text(cell, startX + idx * cellW, startY, { width: cellW - 4, lineBreak: false });
          });
          doc.moveDown(0.7);
        }
        continue;
      }

      // Bullet points and normal text
      const isBullet = /^[-*]\s/.test(line);
      const content = isBullet ? line.replace(/^[-*]\s+/, '') : line;
      const isErr = /\berror\b|\bfail\b|\bcritico\b/i.test(content);
      const isWrn = /\bwarn\b|\batencion\b|\btimeout\b/i.test(content);

      doc.fontSize(9)
        .fillColor(isErr ? RED : isWrn ? YELLOW : DARK)
        .font(isErr ? 'Helvetica-Bold' : 'Helvetica')
        .text((isBullet ? '  - ' : '') + content, { width: W, lineGap: 1.5 });
    }

    // Footer
    const fy = doc.page.height - 30;
    doc.rect(0, fy - 8, doc.page.width, 38).fill('#f3f4f6');
    doc.fontSize(7.5).fillColor(GRAY).font('Helvetica')
      .text('Generado automaticamente por caas-log-reporter - Solidus Capital - mam@soliduscapital.io',
        40, fy, { width: W, align: 'center' });

    doc.end();
  });
}

module.exports = { generatePdf };
