const assert = require('node:assert/strict');
const { normalizeSavedSearch, validateSavedSearch, matchesSavedSearch, MAX_SAVED_SEARCHES } = require('../lib/saved-searches');

assert.equal(MAX_SAVED_SEARCHES, 10);
const search = validateSavedSearch({
  name: 'Remote evaluator',
  query: 'AI evaluation',
  type: 'Evaluator',
  mode: 'Remote',
  location: 'Philippines'
});
assert.equal(search.name, 'Remote evaluator');

const opportunity = {
  company: 'Example AI',
  title: 'AI Evaluation Specialist',
  type: 'Evaluator',
  mode: 'Remote',
  location: 'Philippines',
  tags: ['AI evaluation']
};
assert.equal(matchesSavedSearch(opportunity, search), true);
assert.equal(matchesSavedSearch({ ...opportunity, mode: 'Hybrid' }, search), false);
assert.equal(matchesSavedSearch({ ...opportunity, location: 'Singapore' }, search), false);
assert.equal(matchesSavedSearch(opportunity, { ...search, query: 'security' }), false);

assert.deepEqual(
  normalizeSavedSearch({ name: '  Test  ', query: '  AI  ' }),
  { name: 'Test', query: 'AI', type: 'All types', mode: 'All work modes', location: '' }
);

assert.throws(() => validateSavedSearch({ name: '' }), /name is required/);
console.log('saved-searches.test.js: PASS');
