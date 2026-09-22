// AI Opportunity Radar MVP 3.5 — provider readiness gate.
// Safe preflight only: checks configuration shape and never prints secrets.
// It does not contact providers and does not claim durability.
const REQUIRED = [
  'RADAR_SUPABASE_URL',
  'RADAR_SUPABASE_SERVICE_ROLE_KEY',
  'RESEND_API_KEY',
  'RADAR_ALERT_FROM',
  'RADAR_ALERT_TO'
];

function getReadiness(env = process.env) {
  const configured = Object.fromEntries(
    REQUIRED.map((key) => [key, Boolean(typeof env[key] === 'string' && env[key].trim())])
  );

  const httpsSupabase = (() => {
    try {
      return new URL(env.RADAR_SUPABASE_URL || '').protocol === 'https:';
    } catch (_) {
      return false;
    }
  })();

  const historyReady = configured.RADAR_SUPABASE_URL &&
    configured.RADAR_SUPABASE_SERVICE_ROLE_KEY &&
    httpsSupabase;

  const deliveryReady = configured.RESEND_API_KEY &&
    configured.RADAR_ALERT_FROM &&
    configured.RADAR_ALERT_TO;

  return {
    historyProviderConfigured: historyReady,
    alertOutboxConfigured: historyReady,
    emailDeliveryConfigured: Boolean(deliveryReady),
    allProviderConfigPresent: Boolean(historyReady && deliveryReady),
    checks: {
      httpsSupabaseUrl: httpsSupabase,
      requiredVariablesPresent: configured
    },
    verification: {
      durableHistory: historyReady ? 'configured_only' : 'not_verified',
      durableAlertOutbox: historyReady ? 'configured_only' : 'not_verified',
      externalEmailDelivery: deliveryReady ? 'configured_only' : 'not_verified'
    },
    note: 'Configuration is not the same as provider exercise. Run scripts/provider-exercise.js with explicit confirmation only after the real providers are intentionally configured.'
  };
}

if (require.main === module) {
  const result = getReadiness();
  console.log(JSON.stringify(result, null, 2));
}

module.exports = { REQUIRED, getReadiness };
