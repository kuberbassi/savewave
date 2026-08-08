const { createSocialResolver } = require('./socialProvider');

const resolveInstagram = createSocialResolver({
  platform: 'instagram',
  label: 'Instagram',
  defaultCreator: 'Instagram User'
});

module.exports = { resolveInstagram };
