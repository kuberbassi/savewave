const { createSocialResolver } = require('./socialProvider');

const resolveTwitter = createSocialResolver({
  platform: 'twitter',
  label: 'X / Twitter',
  defaultCreator: 'X User'
});

module.exports = { resolveTwitter };
