const { createSocialResolver } = require('./socialProvider');

const resolveFacebook = createSocialResolver({
  platform: 'facebook',
  label: 'Facebook',
  defaultCreator: 'Facebook User'
});

module.exports = { resolveFacebook };
