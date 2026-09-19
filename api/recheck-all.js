const SOURCES = [
  'https://ph.indeed.com/viewjob?jk=03a8507824d49250',
  'https://ph.indeed.com/viewjob?jk=a7d4a2a28797af71',
  'https://ph.jobstreet.com/job/94200540',
  'https://ph.jobstreet.com/job/94235501',
  'https://jobs.telusdigital.com/search/cfm5/customer-experience-cx/jobs/in/country/philippines?ns_category=artificial-intelligence'
];

const { recheckAndRecord } = require('../lib/recheck-pipeline');
const { getHistoryStorageStatus } = require('../lib/history-store');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const results = await Promise.all(SOURCES.map(async (url) => {
    try {
      return await recheckAndRecord(url);
    } catch (error) {
      return {
        snapshot: {
          url,
          reachable: false,
          status: null,
          checkedAt: new Date().toISOString(),
          availabilityEvidence: { status: 'NOT_VERIFIED', source: 'recheck_failed', matchedSignals: [] },
          eligibilityEvidence: { status: 'NOT_VERIFIED', source: 'recheck_failed', matchedSignals: [] }
        },
        error: error instanceof Error ? error.message : 'recheck failed'
      };
    }
  }));

  const storage = getHistoryStorageStatus();
  const reachable = results.filter(x => x.snapshot?.reachable === true).length;
  const changed = results.filter(x => x.history?.changed === true).length;
  const availability = {
    open: results.filter(x => x.opportunityStatus?.availability === 'OPEN_EVIDENCE').length,
    closed: results.filter(x => x.opportunityStatus?.availability === 'CLOSED_EVIDENCE').length,
    conflicting: results.filter(x => x.opportunityStatus?.availability === 'CONFLICTING_EVIDENCE').length
  };
  const phEligibility = {
    eligible: results.filter(x => x.opportunityStatus?.eligibility === 'PH_ELIGIBLE_EVIDENCE').length,
    excluded: results.filter(x => x.opportunityStatus?.eligibility === 'PH_EXCLUDED_EVIDENCE').length,
    conflicting: results.filter(x => x.opportunityStatus?.eligibility === 'CONFLICTING_EVIDENCE').length
  };

  return res.status(200).json({
    ok: true,
    version: '1.7',
    storage: storage.storage,
    durable: storage.durable,
    count: results.length,
    reachable,
    changed,
    availabilityEvidence: availability,
    phEligibilityEvidence: phEligibility,
    results,
    note: 'Scheduled checks use the same canonical pipeline. Evidence states come from bounded source text and do not guarantee hiring, eligibility, compensation, or continued availability.'
  });
};
