const nodemailer = require('nodemailer');

async function sendReportEmail(pdfBuffer, summaryText, reportDate) {
  const dateStr = reportDate.toLocaleDateString('es-ES', { timezone: 'Europe/Madrid', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const statusLine = summaryText.split('\n').find(l => l.includes('Rojo') || l.includes('Amarillo') || l.includes('Verde') || l.includes('🔴') || l.includes('🟡') || l.includes('🟢')) || '';
  const emoji = statusLine.includes('Rojo') || statusLine.includes('🔴') ? '🔴' : statusLine.includes('Amarillo') || statusLine.includes('🟡') ? '🟡' : '🟢';
  const subject = `${emoji} CaaS Log Report — ${dateStr.charAt(0).toUpperCase() + dateStr.slice(1)}`;

  const html = `
    <div style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;color:#1a1a2e">
      <div style="background:#1a1a2e;padding:24px 32px;border-radius:8px 8px 0 0">
        <h1 style="color:#fff;margin:0;font-size:20px">CaaS · Informe Nocturno</h1>
        <p style="color:#9ca3af;margin:4px 0 0;font-size:13px">Solidus Capital · 20:00 → 08:00h (Barcelona)</p>
      </div>
      <div style="background:#f9fafb;padding:24px 32px;border-radius:0 0 8px 8px;border:1px solid #e5e7eb">
        <p style="font-size:14px;color:#374151;margin:0 0 16px">Hola Mario,</p>
        <p style="font-size:14px;color:#374151;margin:0 0 16px">Adjunto el resumen de logs de esta noche:</p>
        <div style="background:#f3f4f6;border-left:4px solid #6B21A8;padding:12px 16px;border-radius:0 4px 4px 0;margin:0 0 16px">
          <pre style="font-family:monospace;font-size:12px;color:#374151;white-space:pre-wrap;margin:0">${summaryText}</pre>
        </div>
        <p style="font-size:13px;color:#6b7280;margin:16px 0 0">Informe completo adjunto en PDF.<br>— CaaS Log Reporter</p>
      </div>
    </div>
  `;

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD
    }
  });

  const pdfName = `caas-logs-${reportDate.toISOString().split('T')[0]}.pdf`;

  await transporter.sendMail({
    from: `CaaS Log Reporter <${process.env.GMAIL_USER}>`,
    to: process.env.REPORT_EMAIL || 'mam@soliduscapital.io',
    subject,
    html,
    attachments: [
      {
        filename: pdfName,
        content: pdfBuffer,
        contentType: 'application/pdf'
      }
    ]
  });

  console.log(`Email sent to ${process.env.REPORT_EMAIL} (${pdfName})`);
}

module.exports = { sendReportEmail };
