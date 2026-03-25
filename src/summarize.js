const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function prepareLogsForSummary(logsData) {
  const lines = [];

  for (const [serviceName, logs] of Object.entries(logsData.services)) {
    if (!logs.length) {
      lines.push(`\n### ${serviceName}: (sin logs en este periodo)`);
      continue;
    }

    lines.push(`\n### ${serviceName} (${logs.length} lineas totales)`);

    // Separate errors/warnings from info logs
    const errors = logs.filter((l) => {
      const msg = (l.message || '').toLowerCase();
      const sev = (l.severity || '').toUpperCase();
      return ['ERROR', 'FATAL', 'WARN', 'WARNING'].includes(sev) ||
        msg.includes('error') || msg.includes('fail') || msg.includes('crash') ||
        msg.includes('timeout') || msg.includes('exception');
    });

    const infoLogs = logs.filter((l) => !errors.includes(l));

    // Take a spread sample of info logs to show operational volume
    const sampleStep = Math.max(1, Math.floor(infoLogs.length / 25));
    const infoSample = infoLogs.filter((_, i) => i % sampleStep === 0).slice(0, 25);

    // Combine spread sample + all errors (up to 60 total), sorted by time
    const combined = [...infoSample, ...errors].slice(0, 60);
    combined.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    combined.forEach((l) => {
      const ts = l.timestamp
        ? new Date(l.timestamp).toLocaleTimeString('es-ES', {
            timeZone: 'Europe/Madrid',
            hour: '2-digit',
            minute: '2-digit',
          })
        : '??:??';
      lines.push(` [${ts}] [${l.severity || 'INFO'}] ${l.message}`);
    });

    if (errors.length > 0) {
      lines.push(` >> ${errors.length} eventos error/warn de ${logs.length} totales`);
    }
  }

  return lines.join('\n');
}

async function summarizeLogs(logsData, startDate, endDate) {
  const logText = prepareLogsForSummary(logsData);
  const dateStr = startDate.toLocaleDateString('es-ES', {
    timeZone: 'Europe/Madrid',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const prompt = `Eres un ingeniero de DevOps senior analizando los logs nocturnos del sistema CaaS (plataforma financiera de Solidus Capital) para el periodo ${dateStr} de 20:00 a 08:00h (hora Barcelona).

LOGS ANALIZADOS:
${logText}

Genera un informe operacional. IMPORTANTE: sin emojis, sin markdown (no uses ##, **, ni \`), solo texto plano con las etiquetas exactas indicadas abajo.

Formato exacto a usar:

STATUS GLOBAL: [VERDE - Todo OK / AMARILLO - Atencion requerida / ROJO - Incidente critico]

RESUMEN EJECUTIVO
[2-3 frases con cifras concretas: cuantas peticiones procesadas por servicio, cuantos checks ejecutados, cuantas alertas enviadas a Telegram, cualquier actividad de usuario identificable con hora. Nada de frases vagas.]

INCIDENCIAS
[Lista numerada de incidencias criticas con hora exacta. Si no hay: "Ninguna incidencia critica durante el periodo monitorizado."]

ALERTAS / ADVERTENCIAS
| Severidad | Servicio | Detalle |
|-----------|----------|---------|
[Fila por alerta real con hora y detalle. Si no hay: fila con "Sin alertas".]

ACTIVIDAD NORMAL
[Un punto por servicio activo, con cifras concretas: N requests, N checks, N notificaciones, horario de actividad, usuarios si los hay. Ejemplo: "- caas-blacklist-monitor: 32 iteraciones cada 15 min (02:08-08:08h), 0 errores."]

ACCION REQUERIDA
[Lista numerada con prioridad y accion especifica. Si no aplica: "Ninguna accion requerida."]`;

  const message = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }],
  });

  return message.content[0].text;
}

module.exports = { summarizeLogs };
