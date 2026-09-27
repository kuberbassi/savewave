const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');

describe('public supported-source list', () => {
  it('advertises only enabled providers', () => {
    const window = {};
    runInNewContext(readFileSync('public/config.js', 'utf8'), { window });
    const names = Array.from(window.SavewaveConfig.platforms, (platform) => platform.name);
    expect(names).toEqual(['YOUTUBE', 'INSTAGRAM', 'SOUNDCLOUD', 'SPOTIFY', 'DIRECT']);
  });
});
