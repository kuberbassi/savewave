const { createSocialResolver } = require('./socialProvider');

const resolveThreads = createSocialResolver({
  platform: 'threads',
  label: 'Threads',
  defaultCreator: 'Threads User'
});

module.exports = { resolveThreads };
