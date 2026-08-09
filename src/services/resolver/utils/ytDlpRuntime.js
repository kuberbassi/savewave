'use strict';

const path = require('path');
const packagedYtDlp = require('yt-dlp-exec');

const binaryPath = process.env.YTDLP_BINARY_PATH || (
  process.env.VERCEL
    ? path.join(process.cwd(), '.runtime', 'yt-dlp')
    : require('yt-dlp-exec/src/constants').YOUTUBE_DL_PATH
);

const ytdlp = process.env.VERCEL || process.env.YTDLP_BINARY_PATH
  ? packagedYtDlp.create(binaryPath)
  : packagedYtDlp;

module.exports = { ytdlp, binaryPath };
