"use strict";
var SavewaveCore = (() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __commonJS = (cb, mod) => function __require() {
    try {
      return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
    } catch (e) {
      throw mod = 0, e;
    }
  };
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/core/spotify/matcher.js
  var require_matcher = __commonJS({
    "src/core/spotify/matcher.js"(exports, module) {
      "use strict";
      var VERSION_PATTERNS = Object.freeze({
        remix: /\bremix\b/u,
        live: /\blive\b|\bconcert\b/u,
        acoustic: /\bacoustic\b/u,
        remaster: /\bremaster(?:ed)?\b/u,
        cover: /\bcover\b/u,
        instrumental: /\binstrumental\b/u,
        karaoke: /\bkaraoke\b/u,
        slowed: /\bslowed\b/u,
        "sped-up": /\bsped\s*up\b|\bspeed\s*up\b/u,
        nightcore: /\bnightcore\b/u,
        "8d": /\b8d\b/u,
        clean: /\bclean(?:\s+version)?\b/u,
        demo: /\bdemo\b/u,
        extended: /\bextended\b/u,
        edit: /\b(?:radio\s+)?edit\b/u
      });
      var NON_SONG_PATTERNS = /\b(reaction|tutorial|interview|documentary|review|behind the scenes)\b/u;
      var GENERIC_WORDS = /* @__PURE__ */ new Set(["official", "audio", "video", "lyrics", "lyric", "visualizer", "hd", "hq"]);
      function normalize2(value) {
        return String(value || "").normalize("NFKD").toLowerCase().replace(/[\u0300-\u036f]/g, "").replace(/[’']/g, "").replace(/[-–—_/|]+/g, " ").replace(/[^\p{L}\p{N} ]/gu, " ").replace(/\s+/g, " ").trim();
      }
      function stripCatalogQualifier(value) {
        return String(value || "").replace(/\s*-\s*from\s+["“][^"”]+["”]\s*$/giu, " ").replace(/\s*[\[(]\s*from\s+["“][^"”]+["”]\s*[\])]\s*$/giu, " ").trim();
      }
      function versionMarkers2(value) {
        const text = normalize2(value);
        return Object.entries(VERSION_PATTERNS).filter(([, pattern]) => pattern.test(text)).map(([marker]) => marker);
      }
      function canonicalTitle2(value, creditedArtists = []) {
        let title = stripCatalogQualifier(value);
        const credits = title.match(/\s*[\[(](?:feat(?:uring)?\.?|ft\.?|with)\s+([^\])]+)[\])]/iu);
        if (credits) {
          const credit = normalize2(credits[1]);
          const known = creditedArtists.map(normalize2).some((artist) => artist && (credit.includes(artist) || artist.includes(credit)));
          if (known) title = title.replace(credits[0], " ");
        }
        return title.trim();
      }
      function editSimilarity(first, second) {
        if (first === second) return 1;
        if (!first || !second) return 0;
        let row = Array.from({ length: second.length + 1 }, (_, index) => index);
        for (let i = 1; i <= first.length; i += 1) {
          const next = [i];
          for (let j = 1; j <= second.length; j += 1) {
            next[j] = Math.min(next[j - 1] + 1, row[j] + 1, row[j - 1] + (first[i - 1] === second[j - 1] ? 0 : 1));
          }
          row = next;
        }
        return 1 - row[second.length] / Math.max(first.length, second.length);
      }
      function tokens(value) {
        return [...new Set(normalize2(value).split(" ").filter((token) => token && !GENERIC_WORDS.has(token)))];
      }
      function tokenSimilarity(first, second) {
        const left = tokens(first);
        const right = tokens(second);
        if (!left.length || !right.length) return 0;
        const overlap = left.filter((token) => right.includes(token)).length;
        return (overlap / left.length + overlap / right.length) / 2;
      }
      function textSimilarity2(first, second) {
        const left = normalize2(first);
        const right = normalize2(second);
        return Math.max(tokenSimilarity(left, right), editSimilarity(left, right));
      }
      function candidateArtists(candidate) {
        const values = Array.isArray(candidate.artists) && candidate.artists.length ? candidate.artists : [candidate.artist, candidate.author, candidate.uploader, candidate.title];
        return [...new Set(values.map(normalize2).filter(Boolean))];
      }
      function artistSimilarity(track, candidate) {
        const expected = [...new Set([track.primaryArtist, ...track.artists || []].map(normalize2).filter(Boolean))];
        const actual = candidateArtists(candidate);
        if (!expected.length || !actual.length) return 0;
        const bestFor = (artist) => Math.max(...actual.map((value) => value.includes(artist) || artist.includes(value) ? 1 : textSimilarity2(artist, value)), 0);
        const primary = bestFor(expected[0]);
        const credited = expected.reduce((sum, artist) => sum + bestFor(artist), 0) / expected.length;
        return 0.7 * primary + 0.3 * credited;
      }
      function durationSimilarity2(expected, actual) {
        if (!Number.isFinite(expected) || !Number.isFinite(actual) || expected <= 0 || actual <= 0) return null;
        return Math.exp(-0.1 * Math.abs(expected - actual));
      }
      function incompatibleVersions(track, candidate) {
        const expected = new Set(versionMarkers2(track.title));
        return versionMarkers2(candidate.title).filter((marker) => !expected.has(marker));
      }
      function authoritativeOwner(track, candidate) {
        const owner = normalize2(candidate.uploader || candidate.author || candidate.artist || "");
        return [...new Set([track.primaryArtist, ...track.artists || []].map(normalize2).filter(Boolean))].some((artist) => owner === artist || owner === `${artist} topic` || owner === `${artist} vevo`);
      }
      function evaluateCandidate2(track, candidate) {
        const rejectionReasons = [];
        const artists = candidateArtists(candidate);
        if (!candidate || !candidate.title || !artists.length) {
          rejectionReasons.push("MISSING_IDENTITY");
        }
        if (track.isrc && candidate.isrc && normalize2(track.isrc) !== normalize2(candidate.isrc)) rejectionReasons.push("ISRC_CONFLICT");
        if (incompatibleVersions(track, candidate).length) rejectionReasons.push("VERSION_CONFLICT");
        if (track.explicit === true && candidate.explicit === false) rejectionReasons.push("EXPLICIT_CONFLICT");
        const durationDiff = Number.isFinite(track.duration) && Number.isFinite(candidate.duration) ? Math.abs(track.duration - candidate.duration) : null;
        const durationLimit = Number.isFinite(track.duration) ? Math.max(12, track.duration * 0.08) : null;
        if (durationDiff !== null && durationLimit !== null && durationDiff > durationLimit) rejectionReasons.push("DURATION_MISMATCH");
        const expectedTitle = canonicalTitle2(track.title, track.artists || []);
        const actualTitle = canonicalTitle2(candidate.title, track.artists || []);
        const title = textSimilarity2(expectedTitle, actualTitle);
        const artist = artistSimilarity(track, candidate);
        if (title < 0.6) rejectionReasons.push("TITLE_MISMATCH");
        if (artist < 0.7) rejectionReasons.push("ARTIST_MISMATCH");
        if (candidate.resultType === "generic-video" && NON_SONG_PATTERNS.test(normalize2(candidate.title))) rejectionReasons.push("NON_SONG_CONTENT");
        const duration = durationSimilarity2(track.duration, candidate.duration);
        const album = track.album && candidate.album ? textSimilarity2(track.album, candidate.album) : null;
        const weighted = [
          [title, 0.42],
          [artist, 0.33],
          ...duration === null ? [] : [[duration, 0.2]],
          ...album === null ? [] : [[album, 0.05]]
        ];
        const weight = weighted.reduce((sum, item) => sum + item[1], 0);
        const identity = weight ? weighted.reduce((sum, item) => sum + item[0] * item[1], 0) / weight : 0;
        const isrcMatch = Boolean(track.isrc && candidate.isrc && normalize2(track.isrc) === normalize2(candidate.isrc));
        const sourceTieBreak = candidate.resultType === "song" ? 6e-3 : candidate.verified ? 3e-3 : 0;
        const score = Math.round(Math.min(1, identity + sourceTieBreak) * 1e3) / 10;
        return {
          candidate,
          score: isrcMatch && !rejectionReasons.length ? 100 : score,
          confidence: score >= 90 ? "very-high" : score >= 84 ? "high" : "low",
          accepted: rejectionReasons.length === 0,
          rejectionReasons,
          evidence: { title, artist, duration, album, isrcMatch, durationDiff }
        };
      }
      function sameRecording2(track, first, second) {
        if (!first || !second) return false;
        const firstOwner = normalize2(first.uploader || first.author || "");
        const secondOwner = normalize2(second.uploader || second.author || "");
        const structuredTypes = /* @__PURE__ */ new Set(["song", "video"]);
        const hasStructuredResult = structuredTypes.has(first.resultType) || structuredTypes.has(second.resultType);
        if (!hasStructuredResult && (!firstOwner || !secondOwner || firstOwner === secondOwner)) return false;
        const firstEval = evaluateCandidate2(track, first);
        const secondEval = evaluateCandidate2(track, second);
        if (!firstEval.accepted || !secondEval.accepted) return false;
        if (firstEval.evidence.title < 0.7 || secondEval.evidence.title < 0.7) return false;
        if (versionMarkers2(first.title).join("|") !== versionMarkers2(second.title).join("|")) return false;
        if (firstEval.evidence.artist < 0.8 || secondEval.evidence.artist < 0.8) return false;
        return !Number.isFinite(first.duration) || !Number.isFinite(second.duration) || Math.abs(first.duration - second.duration) <= 3;
      }
      function rankCandidates2(track, candidates) {
        return candidates.map((candidate, index) => ({ ...evaluateCandidate2(track, candidate), index })).filter((result) => result.accepted).sort((a, b) => b.score - a.score || a.index - b.index);
      }
      function confidentMatch2(track, candidates) {
        const ranked = rankCandidates2(track, candidates);
        const best = ranked[0];
        const runnerUp = ranked[1];
        if (!best || best.score < 84) return null;
        if (best.evidence.isrcMatch) return best;
        const structuredOrOwned = best.candidate.resultType === "song" || authoritativeOwner(track, best.candidate);
        if (!structuredOrOwned && !runnerUp) return null;
        if (!runnerUp || best.score - runnerUp.score >= 3 || sameRecording2(track, best.candidate, runnerUp.candidate)) return best;
        return null;
      }
      function scoreCandidate2(track, candidate) {
        const result = evaluateCandidate2(track, candidate);
        if (!result.accepted) return Math.min(result.score, 79.9);
        if (!candidate.resultType && !authoritativeOwner(track, candidate)) return Math.min(result.score, 79.9);
        return result.score;
      }
      module.exports = {
        canonicalTitle: canonicalTitle2,
        confidentMatch: confidentMatch2,
        durationSimilarity: durationSimilarity2,
        evaluateCandidate: evaluateCandidate2,
        normalize: normalize2,
        rankCandidates: rankCandidates2,
        sameRecording: sameRecording2,
        scoreCandidate: scoreCandidate2,
        textSimilarity: textSimilarity2,
        versionMarkers: versionMarkers2
      };
    }
  });

  // src/core/spotify/search-runtime.js
  var require_search_runtime = __commonJS({
    "src/core/spotify/search-runtime.js"(exports, module) {
      "use strict";
      var { confidentMatch: confidentMatch2, rankCandidates: rankCandidates2, sameRecording: sameRecording2 } = require_matcher();
      function identityQuery2(track, primaryOnly = false) {
        const artists = primaryOnly ? [track.primaryArtist] : track.artists?.length ? track.artists : [track.primaryArtist];
        return `${artists.filter(Boolean).join(", ")} - ${track.title}`.trim();
      }
      function searchStages2(track) {
        return [
          ...track.isrc ? [{ name: "isrc-song", query: track.isrc, filter: "songs" }] : [],
          { name: "all-artists-song", query: identityQuery2(track), filter: "songs" },
          ...(track.artists || []).filter(Boolean).length > 1 ? [{ name: "primary-artist-song", query: identityQuery2(track, true), filter: "songs" }] : [],
          { name: "music-video", query: identityQuery2(track), filter: "videos" },
          { name: "generic-video", query: identityQuery2(track), filter: "generic" }
        ];
      }
      function dedupeCandidates2(candidates) {
        const seen = /* @__PURE__ */ new Set();
        return candidates.filter((candidate) => {
          const key = candidate.videoId || candidate.id || candidate.url || candidate.sourceUrl;
          if (!key || seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      }
      async function resolveSpotifySource2(track, adapter) {
        const pool = [];
        let confident = null;
        for (const stage of searchStages2(track)) {
          const results = await adapter.search(stage, track);
          pool.push(...results.map((candidate) => ({ ...candidate, searchStage: stage.name })));
          const candidates = dedupeCandidates2(pool);
          const match = confidentMatch2(track, candidates);
          if (match) {
            confident = match;
            const alternatives = rankCandidates2(track, candidates).map((result) => result.candidate).filter((candidate) => candidate !== match.candidate && sameRecording2(track, match.candidate, candidate)).slice(0, 2);
            const enriched = { ...match, alternatives };
            if (match.evidence.isrcMatch || alternatives.length || stage.filter === "videos" || stage.filter === "generic") return enriched;
          }
          if (confident && stage.filter === "videos") return { ...confident, alternatives: [] };
        }
        return confident ? { ...confident, alternatives: [] } : confidentMatch2(track, dedupeCandidates2(pool));
      }
      module.exports = { dedupeCandidates: dedupeCandidates2, identityQuery: identityQuery2, resolveSpotifySource: resolveSpotifySource2, searchStages: searchStages2 };
    }
  });

  // src/core/spotify/youtubeMusic-runtime.js
  var require_youtubeMusic_runtime = __commonJS({
    "src/core/spotify/youtubeMusic-runtime.js"(exports, module) {
      "use strict";
      function textOf(value) {
        if (!value) return "";
        if (typeof value.simpleText === "string") return value.simpleText;
        return (value.runs || []).map((run) => run.text || "").join("").trim();
      }
      function durationSeconds2(value) {
        const parts = String(value || "").trim().split(":").map(Number);
        if (!parts.length || parts.some((part) => !Number.isFinite(part))) return void 0;
        return parts.reduce((seconds, part) => seconds * 60 + part, 0);
      }
      function collectRenderers(value, output = []) {
        if (!value || typeof value !== "object") return output;
        if (value.musicResponsiveListItemRenderer) output.push(value.musicResponsiveListItemRenderer);
        for (const child of Object.values(value)) collectRenderers(child, output);
        return output;
      }
      function subtitleGroups(runs) {
        const groups = [[]];
        for (const run of runs) {
          const value = String(run?.text || "");
          if (value.trim() === "\u2022") groups.push([]);
          else if (value) groups[groups.length - 1].push(value);
        }
        return groups.map((group) => group.join("").trim()).filter(Boolean);
      }
      function parseRenderer(renderer, resultType) {
        const columns = (renderer?.flexColumns || []).map((column) => column?.musicResponsiveListItemFlexColumnRenderer?.text).filter(Boolean);
        const titleRuns = columns[0]?.runs || [];
        const videoId = renderer?.playlistItemData?.videoId || renderer?.navigationEndpoint?.watchEndpoint?.videoId || titleRuns.find((run) => run?.navigationEndpoint?.watchEndpoint?.videoId)?.navigationEndpoint?.watchEndpoint?.videoId;
        const title = textOf(columns[0]);
        const runs = columns.slice(1).flatMap((column) => column.runs || []);
        const artistRuns = runs.filter((run) => {
          const id = run?.navigationEndpoint?.browseEndpoint?.browseId || "";
          const type = run?.navigationEndpoint?.browseEndpoint?.browseEndpointContextSupportedConfigs?.browseEndpointContextMusicConfig?.pageType || "";
          return id.startsWith("UC") || type.includes("ARTIST");
        });
        const albumRun = runs.find((run) => {
          const id = run?.navigationEndpoint?.browseEndpoint?.browseId || "";
          const type = run?.navigationEndpoint?.browseEndpoint?.browseEndpointContextSupportedConfigs?.browseEndpointContextMusicConfig?.pageType || "";
          return id.startsWith("MPRE") || type.includes("ALBUM");
        });
        const durationRun = runs.map((run) => run.text).find((text) => /^\d{1,2}:\d{2}(?::\d{2})?$/.test(text || ""));
        const groups = subtitleGroups(runs);
        const artists = artistRuns.map((run) => run.text?.trim()).filter(Boolean);
        if (!artists.length && groups[0] && !/^\d[\d,.]*\s*(?:plays|views)?$/iu.test(groups[0])) artists.push(groups[0]);
        if (!videoId || !title || !artists.length) return null;
        const badges = JSON.stringify(renderer.badges || []);
        const fallbackAlbum = resultType === "song" ? groups.find((group, index) => index > 0 && group !== durationRun) : void 0;
        return { videoId, url: `https://www.youtube.com/watch?v=${videoId}`, resultType, title, artists, artist: artists[0], album: albumRun?.text?.trim() || fallbackAlbum, duration: durationSeconds2(durationRun), explicit: badges.includes("MUSIC_EXPLICIT_BADGE") ? true : void 0, verified: resultType === "song" };
      }
      function parseYouTubeMusicResults2(payload, filter) {
        const type = filter === "songs" ? "song" : "video";
        const seen = /* @__PURE__ */ new Set();
        return collectRenderers(payload).map((renderer) => parseRenderer(renderer, type)).filter((candidate) => {
          if (!candidate || seen.has(candidate.videoId)) return false;
          seen.add(candidate.videoId);
          return true;
        }).slice(0, 20);
      }
      module.exports = { durationSeconds: durationSeconds2, parseYouTubeMusicResults: parseYouTubeMusicResults2 };
    }
  });

  // src/core/index.ts
  var index_exports = {};
  __export(index_exports, {
    ERROR_CODES: () => ERROR_CODES,
    MediaEngineError: () => MediaEngineError,
    addHistory: () => addHistory,
    automaticFormatArguments: () => automaticFormatArguments,
    canTransition: () => canTransition,
    canonicalTitle: () => canonicalTitle,
    capabilitiesFor: () => capabilitiesFor,
    clearHistory: () => clearHistory,
    confidentMatch: () => import_matcher.confidentMatch,
    createMediaEngine: () => createMediaEngine,
    dedupeCandidates: () => import_search_runtime.dedupeCandidates,
    detectRuntime: () => detectRuntime,
    detectSource: () => detectSource,
    durationSeconds: () => import_youtubeMusic_runtime.durationSeconds,
    durationSimilarity: () => import_matcher.durationSimilarity,
    equivalentToken: () => equivalentToken,
    evaluateCandidate: () => import_matcher.evaluateCandidate,
    identityQuery: () => import_search_runtime.identityQuery,
    listHistory: () => listHistory,
    mediaFilename: () => mediaFilename,
    normalize: () => normalize,
    normalizeError: () => normalizeError,
    normalizeUrl: () => normalizeUrl,
    openExternal: () => openExternal,
    parseYouTubeMusicResults: () => import_youtubeMusic_runtime.parseYouTubeMusicResults,
    rankCandidates: () => import_matcher.rankCandidates,
    removeHistory: () => removeHistory,
    resolveSpotifySource: () => import_search_runtime.resolveSpotifySource,
    sameRecording: () => import_matcher.sameRecording,
    sanitizeFilename: () => sanitizeFilename,
    scoreCandidate: () => import_matcher.scoreCandidate,
    searchStages: () => import_search_runtime.searchStages,
    supports: () => supports,
    textSimilarity: () => import_matcher.textSimilarity,
    transition: () => transition,
    versionMarkers: () => versionMarkers
  });

  // src/core/media/errors.ts
  var ERROR_CODES = [
    "UNSUPPORTED_PLATFORM",
    "UNSUPPORTED_SOURCE",
    "INVALID_URL",
    "SOURCE_UNAVAILABLE",
    "SOURCE_REJECTED",
    "NO_MEDIA_FOUND",
    "MATCH_CONFIDENCE_LOW",
    "DOWNLOAD_FAILED",
    "PROCESSING_FAILED",
    "PERMISSION_DENIED",
    "SAVE_FAILED",
    "ENGINE_UNAVAILABLE",
    "ENGINE_OUTDATED",
    "CANCELLED"
  ];
  var messages = {
    UNSUPPORTED_PLATFORM: "This platform is unsupported.",
    UNSUPPORTED_SOURCE: "This source is available in the Savewave app.",
    INVALID_URL: "Unsupported media link.",
    SOURCE_UNAVAILABLE: "This media is unavailable.",
    SOURCE_REJECTED: "The source temporarily rejected this request.",
    NO_MEDIA_FOUND: "No downloadable media was found.",
    MATCH_CONFIDENCE_LOW: "Could not confidently match this Spotify track.",
    DOWNLOAD_FAILED: "Download failed.",
    PROCESSING_FAILED: "Media processing failed.",
    PERMISSION_DENIED: "Storage permission was denied.",
    SAVE_FAILED: "The file could not be saved.",
    ENGINE_UNAVAILABLE: "The local media engine is unavailable.",
    ENGINE_OUTDATED: "A Savewave update is required.",
    CANCELLED: "Download cancelled."
  };
  var MediaEngineError = class extends Error {
    constructor(code, message = messages[code]) {
      super(message);
      this.code = code;
      this.name = "MediaEngineError";
    }
    code;
  };
  function normalizeError(error) {
    if (error instanceof MediaEngineError) return error;
    const candidate = error;
    const parts = typeof error === "string" ? [error] : [candidate?.code, candidate?.error, candidate?.message, (() => {
      try {
        return JSON.stringify(error);
      } catch {
        return "";
      }
    })()];
    const raw = parts.filter((value) => typeof value === "string").join(" ");
    const code = ERROR_CODES.find((value) => raw.includes(value)) || "DOWNLOAD_FAILED";
    return new MediaEngineError(code, messages[code]);
  }

  // src/core/media/filename.ts
  var RESERVED = /[<>:"/\\|?*\u0000-\u001f]/g;
  var WINDOWS_DEVICE = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;
  function sanitizeFilename(value, fallback = "media") {
    const clean = String(value || "").normalize("NFC").replace(RESERVED, "").replace(/\s+/g, " ").trim().replace(/[. ]+$/g, "").slice(0, 140);
    if (!clean) return fallback;
    return WINDOWS_DEVICE.test(clean) ? `_${clean}` : clean;
  }
  function mediaFilename(creator, title, extension) {
    return `${sanitizeFilename(`${creator} - ${title}`)}.${extension.replace(/[^a-z0-9]/gi, "").toLowerCase()}`;
  }

  // src/core/media/quality.ts
  function automaticFormatArguments(mode) {
    return mode === "audio" ? ["-f", "bestaudio/best", "--extract-audio", "--audio-format", "best"] : ["-f", "bestvideo+bestaudio/best", "--merge-output-format", "mp4/mkv"];
  }

  // src/core/media/state.ts
  var transitions = {
    idle: ["detecting", "resolving"],
    detecting: ["idle", "resolving", "error"],
    resolving: ["resolved", "error", "cancelled"],
    resolved: ["downloading", "idle", "error"],
    downloading: ["processing", "completed", "cancelled", "error"],
    processing: ["completed", "cancelled", "error"],
    completed: ["idle", "resolving"],
    cancelled: ["idle", "resolving"],
    error: ["idle", "resolving"]
  };
  function canTransition(from, to) {
    return transitions[from].includes(to);
  }
  function transition(from, to) {
    if (!canTransition(from, to)) throw new Error(`Invalid download transition: ${from} -> ${to}`);
    return to;
  }

  // src/core/sources/detectSource.ts
  var directExtensions = /\.(mp4|webm|mp3|m4a|aac|ogg|wav|flac|jpg|jpeg|png|webp)(?:$|[?#])/i;
  var isDomain = (host, domain) => host === domain || host.endsWith(`.${domain}`);
  function normalizeUrl(value) {
    try {
      const parsed = new URL(String(value || "").trim());
      return ["http:", "https:"].includes(parsed.protocol) ? parsed : null;
    } catch {
      return null;
    }
  }
  function detectSource(value) {
    const url = normalizeUrl(value);
    if (!url) return "unknown";
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    if (host === "youtu.be" || isDomain(host, "youtube.com")) return "youtube";
    if (isDomain(host, "instagram.com")) return "instagram";
    if (isDomain(host, "facebook.com") || host === "fb.watch") return "facebook";
    if (isDomain(host, "threads.net")) return "threads";
    if (isDomain(host, "twitter.com") || host === "x.com") return "twitter";
    if (isDomain(host, "soundcloud.com")) return "soundcloud";
    if (host === "open.spotify.com") return "spotify";
    return directExtensions.test(url.pathname) ? "direct" : "unknown";
  }

  // src/core/platform/capabilities.ts
  var none = {};
  var full = { video: true, audio: true, media: true };
  function capabilitiesFor(platform) {
    const native = platform !== "web";
    return { platform, sources: {
      youtube: native ? full : none,
      instagram: native ? { media: true } : none,
      facebook: native ? { media: true } : none,
      threads: native ? { media: true } : none,
      twitter: native ? { media: true } : none,
      soundcloud: native ? { audio: true } : none,
      spotify: native ? { audio: true, smartMatch: true } : none,
      direct: { video: true, audio: true, media: true },
      unknown: none
    } };
  }
  function supports(capabilities, source, mode) {
    const value = capabilities.sources[source];
    return Boolean(value && (value.media || value[mode] || mode === "audio" && value.smartMatch));
  }

  // node_modules/@tauri-apps/api/external/tslib/tslib.es6.js
  function __classPrivateFieldGet(receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
  }
  function __classPrivateFieldSet(receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value), value;
  }

  // node_modules/@tauri-apps/api/core.js
  var _Channel_onmessage;
  var _Channel_nextMessageIndex;
  var _Channel_pendingMessages;
  var _Channel_messageEndIndex;
  var _Resource_rid;
  var SERIALIZE_TO_IPC_FN = "__TAURI_TO_IPC_KEY__";
  function transformCallback(callback, once = false) {
    return window.__TAURI_INTERNALS__.transformCallback(callback, once);
  }
  var Channel = class {
    constructor(onmessage) {
      _Channel_onmessage.set(this, void 0);
      _Channel_nextMessageIndex.set(this, 0);
      _Channel_pendingMessages.set(this, []);
      _Channel_messageEndIndex.set(this, void 0);
      __classPrivateFieldSet(this, _Channel_onmessage, onmessage || (() => {
      }), "f");
      this.id = transformCallback((rawMessage) => {
        const index = rawMessage.index;
        if ("end" in rawMessage) {
          if (index == __classPrivateFieldGet(this, _Channel_nextMessageIndex, "f")) {
            this.cleanupCallback();
          } else {
            __classPrivateFieldSet(this, _Channel_messageEndIndex, index, "f");
          }
          return;
        }
        const message = rawMessage.message;
        if (index == __classPrivateFieldGet(this, _Channel_nextMessageIndex, "f")) {
          __classPrivateFieldGet(this, _Channel_onmessage, "f").call(this, message);
          __classPrivateFieldSet(this, _Channel_nextMessageIndex, __classPrivateFieldGet(this, _Channel_nextMessageIndex, "f") + 1, "f");
          while (__classPrivateFieldGet(this, _Channel_nextMessageIndex, "f") in __classPrivateFieldGet(this, _Channel_pendingMessages, "f")) {
            const message2 = __classPrivateFieldGet(this, _Channel_pendingMessages, "f")[__classPrivateFieldGet(this, _Channel_nextMessageIndex, "f")];
            __classPrivateFieldGet(this, _Channel_onmessage, "f").call(this, message2);
            delete __classPrivateFieldGet(this, _Channel_pendingMessages, "f")[__classPrivateFieldGet(this, _Channel_nextMessageIndex, "f")];
            __classPrivateFieldSet(this, _Channel_nextMessageIndex, __classPrivateFieldGet(this, _Channel_nextMessageIndex, "f") + 1, "f");
          }
          if (__classPrivateFieldGet(this, _Channel_nextMessageIndex, "f") === __classPrivateFieldGet(this, _Channel_messageEndIndex, "f")) {
            this.cleanupCallback();
          }
        } else {
          __classPrivateFieldGet(this, _Channel_pendingMessages, "f")[index] = message;
        }
      });
    }
    cleanupCallback() {
      window.__TAURI_INTERNALS__.unregisterCallback(this.id);
    }
    set onmessage(handler) {
      __classPrivateFieldSet(this, _Channel_onmessage, handler, "f");
    }
    get onmessage() {
      return __classPrivateFieldGet(this, _Channel_onmessage, "f");
    }
    [(_Channel_onmessage = /* @__PURE__ */ new WeakMap(), _Channel_nextMessageIndex = /* @__PURE__ */ new WeakMap(), _Channel_pendingMessages = /* @__PURE__ */ new WeakMap(), _Channel_messageEndIndex = /* @__PURE__ */ new WeakMap(), SERIALIZE_TO_IPC_FN)]() {
      return `__CHANNEL__:${this.id}`;
    }
    toJSON() {
      return this[SERIALIZE_TO_IPC_FN]();
    }
  };
  async function invoke(cmd, args = {}, options) {
    return window.__TAURI_INTERNALS__.invoke(cmd, args, options);
  }
  _Resource_rid = /* @__PURE__ */ new WeakMap();

  // src/core/spotify/search.ts
  var import_search_runtime = __toESM(require_search_runtime());

  // src/core/spotify/youtubeMusic.ts
  var import_youtubeMusic_runtime = __toESM(require_youtubeMusic_runtime());

  // src/core/platform/native.ts
  var NativeMediaEngine = class {
    constructor(platform) {
      this.platform = platform;
    }
    platform;
    getPlatform() {
      return this.platform;
    }
    getCapabilities() {
      return invoke("get_capabilities");
    }
    getEngineStatus() {
      return invoke("get_engine_status");
    }
    getReleaseInfo() {
      return invoke("get_release_info");
    }
    async resolveMedia(url, mode = "video") {
      if (detectSource(url) !== "spotify") return invoke("resolve_media", { request: { url, mode } });
      const track = await invoke("get_spotify_metadata", { url });
      const match = await (0, import_search_runtime.resolveSpotifySource)(track, { search: async (stage) => {
        if (stage.filter === "generic") return invoke("search_spotify_candidates", { query: stage.query });
        try {
          const payload = await invoke("search_youtube_music", { query: stage.query, filter: stage.filter });
          return (0, import_youtubeMusic_runtime.parseYouTubeMusicResults)(payload, stage.filter);
        } catch {
          return [];
        }
      } });
      if (!match) throw { code: "MATCH_CONFIDENCE_LOW" };
      const source = match.candidate;
      const sourceUrl = source.sourceUrl || source.url;
      if (!sourceUrl) throw { code: "MATCH_CONFIDENCE_LOW" };
      const fallbackSourceUrls = (match.alternatives || []).map((candidate) => candidate.sourceUrl || candidate.url).filter((value) => Boolean(value) && value !== sourceUrl);
      return { success: true, platform: "spotify", title: track.title, creator: track.artists.join(", "), thumbnail: track.thumbnail, duration: track.duration, type: "audio", qualityLabel: "Verified high-confidence match", sourceUrl, fallbackSourceUrls };
    }
    downloadMedia(request) {
      return invoke("download_media", { request });
    }
    cancelDownload(jobId) {
      return invoke("cancel_download", { jobId });
    }
    getDownloadProgress(jobId) {
      return invoke("get_download_progress", { jobId });
    }
  };

  // src/core/platform/android.ts
  var command = (name, payload = {}) => invoke(`plugin:savewave-media|${name}`, payload);
  var CURRENT_VERSION = "1.0.10";
  var RELEASE_MANIFEST = "https://raw.githubusercontent.com/kuberbassi/savewave/main/public/client-version.json";
  var TRUSTED_RELEASE_HOSTS = /* @__PURE__ */ new Set(["github.com", "raw.githubusercontent.com", "savewave.kuberbassi.com"]);
  var isNewerVersion = (candidate, installed) => {
    const parse = (value) => value.replace(/^v/, "").split(".").map(Number);
    const next = parse(candidate);
    const current = parse(installed);
    if (next.some(Number.isNaN) || current.some(Number.isNaN)) return false;
    for (let index = 0; index < Math.max(next.length, current.length); index += 1) {
      const difference = (next[index] || 0) - (current[index] || 0);
      if (difference !== 0) return difference > 0;
    }
    return false;
  };
  var AndroidMediaEngine = class {
    getPlatform() {
      return "android";
    }
    getCapabilities() {
      return command("getCapabilities");
    }
    getEngineStatus() {
      return command("getEngineStatus");
    }
    async getReleaseInfo() {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8e3);
      try {
        const response = await fetch(RELEASE_MANIFEST, { cache: "no-store", signal: controller.signal });
        if (!response.ok) return null;
        const release = await response.json();
        if (!release.androidDownloadUrl) return null;
        const urls = [release.androidDownloadUrl, release.releaseUrl, release.changelogUrl].map((value) => new URL(value));
        if (urls.some((url) => url.protocol !== "https:" || !TRUSTED_RELEASE_HOSTS.has(url.hostname))) return null;
        return {
          ...release,
          downloadUrl: release.androidDownloadUrl,
          updateAvailable: isNewerVersion(release.version, CURRENT_VERSION)
        };
      } catch {
        return null;
      } finally {
        clearTimeout(timeout);
      }
    }
    async resolveMedia(url, mode = "video") {
      if (detectSource(url) !== "spotify") return command("resolveMedia", { request: { url, mode } });
      const track = await command("getSpotifyMetadata", { url });
      console.info("[Savewave SmartMatch] Spotify metadata ready", { title: track.title, artists: track.artists, duration: track.duration });
      const match = await (0, import_search_runtime.resolveSpotifySource)(track, { search: async (stage) => {
        if (stage.filter === "generic") {
          const results = (await command("searchSpotifyCandidates", { query: stage.query })).results;
          console.info("[Savewave SmartMatch] Search stage complete", { stage: stage.name, candidates: results.length });
          return results;
        }
        try {
          const response = await command("searchYoutubeMusic", { query: stage.query, filter: stage.filter });
          const results = (0, import_youtubeMusic_runtime.parseYouTubeMusicResults)(response.payload, stage.filter);
          console.info("[Savewave SmartMatch] Search stage complete", { stage: stage.name, candidates: results.length });
          return results;
        } catch (error) {
          console.warn("[Savewave SmartMatch] YouTube Music stage failed", { stage: stage.name, error: String(error) });
          return [];
        }
      } });
      const sourceUrl = match?.candidate.sourceUrl || match?.candidate.url;
      console.info("[Savewave SmartMatch] Match decision", { matched: Boolean(match), videoId: match?.candidate.videoId, score: match?.score });
      if (!match || !sourceUrl) throw { code: "MATCH_CONFIDENCE_LOW" };
      const fallbackSourceUrls = (match.alternatives || []).map((candidate) => candidate.sourceUrl || candidate.url).filter((value) => Boolean(value) && value !== sourceUrl);
      return { success: true, platform: "spotify", title: track.title, creator: track.artists.join(", "), thumbnail: track.thumbnail, duration: track.duration, type: "audio", qualityLabel: "Verified high-confidence match", sourceUrl, fallbackSourceUrls };
    }
    downloadMedia(request) {
      return command("downloadMedia", { request });
    }
    cancelDownload(jobId) {
      return command("cancelDownload", { jobId });
    }
    getDownloadProgress(jobId) {
      return command("getDownloadProgress", { jobId });
    }
  };

  // src/core/platform/web.ts
  var WebMediaEngine = class {
    jobs = /* @__PURE__ */ new Map();
    getPlatform() {
      return "web";
    }
    async getCapabilities() {
      return capabilitiesFor("web");
    }
    async getEngineStatus() {
      return { available: true, version: "1.0.10" };
    }
    async getReleaseInfo() {
      return null;
    }
    async resolveMedia(value, mode = "video") {
      const url = normalizeUrl(value);
      if (!url) throw new MediaEngineError("INVALID_URL");
      if (detectSource(value) !== "direct") throw new MediaEngineError("UNSUPPORTED_SOURCE");
      const title = decodeURIComponent(url.pathname.split("/").pop() || "media").replace(/\.[^.]+$/, "");
      return { success: true, platform: "direct", title: sanitizeFilename(title), creator: url.hostname, type: mode, qualityLabel: "Original media", sourceUrl: url.href };
    }
    async downloadMedia(request) {
      await this.resolveMedia(request.url, request.mode);
      const jobId = crypto.randomUUID();
      const anchor = document.createElement("a");
      anchor.href = request.url;
      anchor.download = "";
      anchor.rel = "noopener";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      this.jobs.set(jobId, { jobId, state: "completed", percent: 100 });
      return { jobId, state: "completed" };
    }
    async cancelDownload(jobId) {
      if (!this.jobs.has(jobId)) throw new MediaEngineError("DOWNLOAD_FAILED");
      this.jobs.set(jobId, { jobId, state: "cancelled" });
    }
    async getDownloadProgress(jobId) {
      const job = this.jobs.get(jobId);
      if (!job) throw new MediaEngineError("DOWNLOAD_FAILED");
      return job;
    }
  };

  // src/core/platform/index.ts
  function detectRuntime() {
    if (!window.__TAURI_INTERNALS__) return "web";
    return /android/i.test(navigator.userAgent) ? "android" : "desktop";
  }
  function createMediaEngine() {
    const runtime = detectRuntime();
    return runtime === "web" ? new WebMediaEngine() : runtime === "android" ? new AndroidMediaEngine() : new NativeMediaEngine("desktop");
  }

  // node_modules/@tauri-apps/plugin-opener/dist-js/index.js
  async function openUrl(url, openWith) {
    await invoke("plugin:opener|open_url", {
      url,
      with: openWith
    });
  }

  // src/core/platform/external.ts
  var allowedExternalHosts = /* @__PURE__ */ new Set(["github.com", "kuberbassi.com", "www.kuberbassi.com"]);
  async function openExternal(value) {
    const url = new URL(value);
    if (url.protocol !== "https:" || !allowedExternalHosts.has(url.hostname.toLowerCase())) throw new Error("External link is not allowed.");
    await openUrl(url.toString());
  }

  // src/core/spotify/normalize.ts
  var versionWords = ["remix", "live", "slowed", "sped up", "nightcore", "cover", "karaoke", "instrumental", "reaction", "tutorial", "acoustic", "remastered", "lyrics", "lyric video", "8d", "acapella"];
  function canonicalTitle(value) {
    return String(value || "").replace(/\s*-\s*from\s+["“][^"”]+["”]\s*$/gi, " ").replace(/\s*[\[(]\s*from\s+["“][^"”]+["”]\s*[\])]\s*$/gi, " ").replace(/\s*\(\s*with\s+[^)]+\)\s*$/gi, " ").trim();
  }
  function equivalentToken(first, second) {
    if (first === second) return true;
    const longest = Math.max(first.length, second.length);
    if (longest < 4) return false;
    let row = Array.from({ length: second.length + 1 }, (_, index) => index);
    for (let i = 1; i <= first.length; i += 1) {
      const next = [i];
      for (let j = 1; j <= second.length; j += 1) next[j] = Math.min(next[j - 1] + 1, row[j] + 1, row[j - 1] + (first[i - 1] === second[j - 1] ? 0 : 1));
      row = next;
    }
    return row[second.length] <= (longest >= 9 ? 2 : 1);
  }
  function normalize(value) {
    return String(value || "").normalize("NFKD").toLowerCase().replace(/[’']/g, "").replace(/[-–—_/|]+/g, " ").replace(/\b(feat(?:uring)?|ft)\.?\b/g, " ").replace(/[^\p{L}\p{N} ]/gu, " ").replace(/\s+/g, " ").trim();
  }
  function versionMarkers(value) {
    const text = normalize(value);
    return versionWords.filter((word) => text.includes(word));
  }

  // src/core/spotify/score.ts
  var import_matcher = __toESM(require_matcher());

  // src/core/history/webHistory.ts
  var DATABASE = "savewave";
  var STORE = "history";
  var LIMIT = 50;
  function openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "id" });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  async function addHistory(entry) {
    const db = await openDatabase();
    const transaction = db.transaction(STORE, "readwrite");
    transaction.objectStore(STORE).put(entry);
    await new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    db.close();
    const entries = await listHistory();
    if (entries.length > LIMIT) await removeHistory(entries.slice(LIMIT).map((item) => item.id));
  }
  async function listHistory() {
    const db = await openDatabase();
    const request = db.transaction(STORE).objectStore(STORE).getAll();
    const result = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result.sort((a, b) => b.timestamp - a.timestamp));
      request.onerror = () => reject(request.error);
    });
    db.close();
    return result;
  }
  async function removeHistory(ids) {
    const db = await openDatabase();
    const transaction = db.transaction(STORE, "readwrite");
    ids.forEach((id) => transaction.objectStore(STORE).delete(id));
    await new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    db.close();
  }
  async function clearHistory() {
    const db = await openDatabase();
    const transaction = db.transaction(STORE, "readwrite");
    transaction.objectStore(STORE).clear();
    await new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    db.close();
  }
  return __toCommonJS(index_exports);
})();
