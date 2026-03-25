const Anthropic = require('@anthropic-ai/sdk');
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function prepareLogsForSummary(logsData) {
  const lines = [];
  for (const [serviceName, logs] of Object.entries(logsData.services)) {
    if (!logs.length) { lines.push(`\n### ${serviceName}: (sin logs en este periodo)`); continue; }
    lines.push(`\n### ${serviceName} (${logs.length} lineas)`);
    const notable = logs.filter((l) => {
      const msg = (l.message || '').toLowerCase();
      const sev = (l.severity || '').toUpperCase();
      return sev === 'ERROR' || sev === 'FATAL' || sev === 'WARN' || sev === 'WARNING' ||
        msg.includes('error') || msg.includes('exception') || msg.includes('fail') ||
        msg.includes('crash') || msg.includes('timeout') || msg.includes('warn') ||
        msg.includes('critical') || msg.includes('alert') || msg.includes('restart');
    });
    const sample = notable.length > 0 ? notable : logs.slice(0, 30);
    sample.slice(0, 80).forEach((l) => {
      const ts = l.timestamp ? new Date(l.timestamp).toLocaleTimeString('es-ES', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit' }) : '??:??';
      lines.push(`  [${ts}] [${l.severity || 'INFO'}] ${l.message}`);
    });
    if (notable.length > 80) lines.push(`  ... y ${notable.length - 80} eventos mas`);
  }
  return lines.join('\n');
}

async function summarizeLogs(logsData, startDate, endDate) {
  const logText = prepareLogsForSummary(logsData);
  const dateStr = startDate.toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid', day: '2-digit', month: '2-digit', year: 'numeric' });

  const prompt = `Eres un ingeniero de DevOps senior analizando los logs nocturnos del sistema CaaS (plataforma financiera de Solidus Capital) para el periodo ${dateStr} de 20:00 a 08:00h (hora Barcelona).

Logs de los servicios:
${logText}

Genera un resumen ejecutivo que:
1. Quepa en UNA PAGINA A4
2. Empiece con STATUS GLOBAL: Verde Todo OK / Amarillo Atencion requerida / Rojo Incidente critico
3. Secciones: RESUMEN EJECUTIVO (2-3 frases) | INCIDENCIAS (si las hay) | ALERTAS/ADVERTENCIAS | ACTIVIDAD NORMAL | ACCION REQUERIDA (si aplica)
4. Si no hay incidencias, dilo brevemente
5. Lenguaje tecnico pero directo. Maximo 400 palabras.

Responde SOLO con el contenido del informe.`;

  const message = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 800,
    messages: [{ role: 'user', content: prompt }],
  });
  return message.content[0].text;
}

module.exports = { summarizeLogs };
