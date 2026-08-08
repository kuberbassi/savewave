/**
 * Automatic Quality Selection Algorithm for Savewave
 * Prioritizes direct availability, compatibility, and avoiding unnecessary transcoding.
 */

function selectAutomaticQuality(info, requestedMode = 'video') {
  const formats = info.formats || [];
  
  if (requestedMode === 'audio') {
    // Select best audio stream
    const audioFormats = formats.filter(f => f.acodec && f.acodec !== 'none');
    if (audioFormats.length > 0) {
      audioFormats.sort((a, b) => (b.abr || b.tbr || 0) - (a.abr || a.tbr || 0));
      return {
        formatId: audioFormats[0].format_id,
        extension: 'mp3',
        qualityLabel: 'Best available quality (Audio)',
        mode: 'audio',
        selectedFormat: audioFormats[0]
      };
    }
  }

  // Video Mode: Select highest practical progressive format or best video format
  const progressiveFormats = formats.filter(f => f.vcodec !== 'none' && f.acodec !== 'none');
  if (progressiveFormats.length > 0) {
    progressiveFormats.sort((a, b) => (b.height || 0) - (a.height || 0));
    const best = progressiveFormats[0];
    return {
      formatId: best.format_id,
      extension: best.ext || 'mp4',
      qualityLabel: 'Best available quality',
      mode: 'video',
      selectedFormat: best
    };
  }

  // Separate streams (requires format selection or top-level URL)
  return {
    formatId: 'best',
    extension: 'mp4',
    qualityLabel: 'Best available quality',
    mode: 'video',
    selectedFormat: formats.find(f => f.url) || null
  };
}

module.exports = { selectAutomaticQuality };
