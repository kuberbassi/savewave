'use strict';

const path = require('path');
const packagedYtDlp = require('yt-dlp-exec');

const binaryPath = process.env.YTDLP_BINARY_PATH || require('yt-dlp-exec/src/constants').YOUTUBE_DL_PATH;

const ytdlp = process.env.YTDLP_BINARY_PATH
  ? packagedYtDlp.create(binaryPath)
  : packagedYtDlp;

module.exports = { ytdlp, binaryPath };
