/**
 * Safe Filename Sanitizer
 */

function sanitizeFilename(filename, defaultExt = 'bin') {
  if (!filename || typeof filename !== 'string') {
    return `media_file.${defaultExt}`;
  }

  // Remove dangerous control chars & unsafe path characters
  let clean = filename
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim();

  if (!clean || clean === '.' || clean === '..') {
    clean = 'media_file';
  }

  // Ensure extension exists
  if (!clean.includes('.')) {
    clean = `${clean}.${defaultExt}`;
  }

  return clean;
}

module.exports = { sanitizeFilename };
