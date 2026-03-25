const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

async function sendReportEmail(pdfBuffer, summaryText, reportDate) {
  const dateStr = reportDate.toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid', weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  const statusLine = summaryText.split('\n').find(l => l.includes('Rojo') || l.includes('Amarillo') || l.includes('Verde')) || '';
  const emoji = statusLine.includes('Rojo') ? '🔴' : statusLine.includes('Amarillo') ? '🟡' : '🟢';
  const subject = `${emoji} CaaS Log Report — ${dateStr.charAt(0).toUpperCase() + dateStr.slice(1)}`;

  const html = `
    <div style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;color:#1a1a2e">
      <div style="background:#1a1a2e;padding:24px 32px;border-radius:8px 8px 0 0">
        <h1 style="color:#fff;margin:0;font-size:20px">CaaS · Informe Nocturno</h1>
        <p style="color:#9ca3af;margin:4px 0 0;font-size:13px">Solidus Capital · 20:00 → 08:00h (Barcelona)</p>
      </div>
      <div style="background:#f9fafb;padding:24px 32px;border-radius:0 0 8px 8px;border:1px solid #e5e7eb;border-top:none">
        <p style="font-size:14px;color:#374151;margin:0 0 16px">Hola Mario,</p>
        <p style="font-size:14px;color:#374151;margin:0 0 16px">Adjunto el resumen de logs de esta noche para los 8 servicios de CaaS.</p>
        <div style="background:#f3f4f6;border-left:4px solid #6B21A8;padding:12px 16px;border-radius:4px;margin:16px 0">
          <pre style="font-family:monospace;font-size:12px;color:#374151;white-space:pre-wrap;margin:0">${summaryText.substring(0, 600)}${summaryText.length > 600 ? '\n...' : ''}</pre>
        </div>
        <p style="font-size:13px;color:#6b7280;margin:16px 0 0">Informe completo adjunto en PDF.<br>— Sistema automatico CaaS Log Reporter</p>
      </div>
    </div>`;

  const { data, error } = await resend.emails.send({
    from: 'CaaS Log Reporter <logs@soliduscapital.io>',
    to: [process.env.REPORT_EMAIL || 'mam@soliduscapital.io'],
    subject,
    html,
    attachments: [{ filename: `caas-logs-${reportDate.toISOString().split('T')[0]}.pdf`, content: pdfBuffer }],
  });

  if (error) throw new Error(`Resend error: ${JSON.stringify(error)}`);
  console.log(`Email sent. ID: ${data.id}`);
  return data;
}

module.exports = { sendReportEmail };
