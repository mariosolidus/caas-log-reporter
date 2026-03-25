require('dotenv').config();
const cron = require('node-cron');
const { fetchAllLogs } = require('./src/fetchLogs');
const { summarizeLogs } = require('./src/summarize');
const { generatePdf } = require('./src/generatePdf');
const { sendReportEmail } = require('./src/sendEmail');

const REQUIRED_ENV = ['RAILWAY_API_TOKEN', 'ANTHROPIC_API_KEY', 'RESEND_API_KEY'];
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`Missing required env var: ${key}`);
    process.exit(1);
  }
}

async function runDailyReport() {
  const now = new Date();
  console.log(`\n Starting CaaS nightly log report - ${now.toISOString()}`);
  const endDate = new Date(now);
  const startDate = new Date(now.getTime() - 12 * 60 * 60 * 1000);
  try {
    console.log('Fetching logs from Railway...');
    const logsData = await fetchAllLogs(startDate, endDate);
    const totalLines = Object.values(logsData.services).reduce((s, l) => s + l.length, 0);
    console.log(`Total log lines: ${totalLines}`);
    console.log('Summarizing with Claude...');
    const summary = await summarizeLogs(logsData, startDate, endDate);
    console.log('Generating PDF...');
    const pdfBuffer = await generatePdf(summary, startDate, endDate);
    console.log(`PDF size: ${(pdfBuffer.length / 1024).toFixed(1)} KB`);
    console.log('Sending email...');
    await sendReportEmail(pdfBuffer, summary, now);
    console.log('Daily report completed successfully.');
  } catch (err) {
    console.error('Report failed:', err);
    try {
      const { Resend } = require('resend');
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from: 'CaaS Log Reporter <logs@soliduscapital.io>',
        to: [process.env.REPORT_EMAIL || 'mam@soliduscapital.io'],
        subject: 'CaaS Log Reporter - ERROR en el informe diario',
        html: `<p>El informe automatico ha fallado:</p><pre>${err.message}\n${err.stack}</pre>`,
      });
    } catch (_) {}
  }
}

cron.schedule('0 8 * * *', runDailyReport, { timezone: 'Europe/Madrid' });
console.log('CaaS Log Reporter started. Scheduled: every day at 08:00 (Europe/Madrid)');

if (process.env.RUN_NOW === 'true') {
  console.log('RUN_NOW=true - running immediately...');
  runDailyReport();
}
