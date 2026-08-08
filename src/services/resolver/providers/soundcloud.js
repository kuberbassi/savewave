const { createSocialResolver } = require('./socialProvider');

const resolveSoundCloud = createSocialResolver({
  platform: 'soundcloud',
  label: 'SoundCloud',
  defaultCreator: 'SoundCloud Artist',
  forceAudio: true
});

module.exports = { resolveSoundCloud };
