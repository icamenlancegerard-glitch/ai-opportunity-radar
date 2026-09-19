// Shared CRON_SECRET authentication boundary for scheduled endpoints.
function isAuthorizedCron(req) {
  const configured = typeof process.env.CRON_SECRET === 'string' && process.env.CRON_SECRET.length > 0;
  const presented = req.headers?.authorization || req.headers?.Authorization || '';
  return configured && presented === `Bearer ${process.env.CRON_SECRET}`;
}

module.exports = { isAuthorizedCron };
