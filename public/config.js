(function () {
  'use strict';
  const platforms = [
    { name: 'YOUTUBE', label: 'YouTube', capability: 'VIDEO + AUDIO', title: 'YouTube videos, Shorts, and audio' },
    { name: 'INSTAGRAM', label: 'Instagram', capability: 'REELS + POSTS', title: 'Public Instagram Reels, posts, and carousels' },
    { name: 'FACEBOOK', label: 'Facebook', capability: 'VIDEO + REELS', title: 'Public Facebook videos, Reels, and post media' },
    { name: 'TWITTER', label: 'X', capability: 'VIDEO + IMAGES', title: 'X public videos and images' },
    { name: 'SOUNDCLOUD', label: 'SoundCloud', capability: 'AUDIO', title: 'SoundCloud public audio tracks' },
    { name: 'SPOTIFY', label: 'Spotify', capability: 'SMART MATCH', title: 'Spotify metadata matched to available audio' },
    { name: 'DIRECT', label: 'Direct Media', capability: 'MEDIA FILES', title: 'Direct public video, audio, and image links' }
  ];
  window.SavewaveConfig = Object.freeze({
    version: '1.0.10',
    websiteUrl: 'https://savewave.kuberbassi.com/',
    repositoryUrl: 'https://github.com/kuberbassi/savewave',
    releasesUrl: 'https://github.com/kuberbassi/savewave/releases',
    platforms: Object.freeze(platforms.map(Object.freeze)),
    tickerItems: Object.freeze(['BEST AVAILABLE QUALITY', 'LOCAL PROCESSING', 'ZERO DATABASE', 'NO MEDIA STORAGE', 'ON-DEVICE HISTORY', 'AUTOMATIC SOURCE DETECTION', 'DIRECT DOWNLOADS'])
  });
})();
