// MVP 2.4 — canonical monitored source list.
// Keep the scheduled monitor and public status surfaces on the same source set.

const MONITORED_SOURCES = Object.freeze([
  'https://ph.indeed.com/viewjob?jk=03a8507824d49250',
  'https://ph.indeed.com/viewjob?jk=a7d4a2a28797af71',
  'https://ph.jobstreet.com/job/94200540',
  'https://ph.jobstreet.com/job/94235501',
  'https://jobs.telusdigital.com/search/cfm5/customer-experience-cx/jobs/in/country/philippines?ns_category=artificial-intelligence'
]);

module.exports = { MONITORED_SOURCES };
