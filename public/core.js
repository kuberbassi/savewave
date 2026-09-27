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
        edit: /\b(?:radio\s+)?edit\b/u,
        anniversary: /\banniversary\b/u
      });
      var NON_SONG_PATTERNS = /\b(reaction|tutorial|interview|documentary|review|behind the scenes)\b/u;
      var GENERIC_WORDS = /* @__PURE__ */ new Set(["official", "audio", "video", "lyrics", "lyric", "visualizer", "hd", "hq"]);
      function normalize2(value) {
        return String(value || "").normalize("NFKD").toLowerCase().replace(/[\u0300-\u036f]/g, "").replace(/[’']/g, "").replace(/[-–—_/|]+/g, " ").replace(/[^\p{L}\p{N} ]/gu, " ").replace(/\s+/g, " ").trim();
      }
      function stripCatalogQualifier(value) {
        return String(value || "").replace(/\s*-\s*from\s+(?:["“][^"”]+["”]|.+?)\s*$/giu, " ").replace(/\s*[\[(]\s*from\s+(?:["“][^"”]+["”]|[^\])]+)\s*[\])]\s*$/giu, " ").trim();
      }
      function versionMarkers2(value) {
        const text = normalize2(value);
        return Object.entries(VERSION_PATTERNS).filter(([, pattern]) => pattern.test(text)).map(([marker]) => marker);
      }
      function versionBaseTitle(value) {
        let title = String(value || "");
        for (const pattern of Object.values(VERSION_PATTERNS)) {
          title = title.replace(new RegExp(`\\s*[\\[(][^\\])]${pattern.source}[^\\])]*[\\])]\\s*$`, "iu"), " ").replace(new RegExp(`\\s*-\\s*[^-]*${pattern.source}.*$`, "iu"), " ");
        }
        return title.trim();
      }
      function canonicalTitle2(value, creditedArtists = []) {
        let title = stripCatalogQualifier(value);
        const credits = title.match(/\s*[\[(](?:feat(?:uring)?\.?|ft\.?|with)\s+([^\])]+)[\])]/iu);
        if (credits) {
          const credit = normalize2(credits[1]);
          const known = creditedArtists.map(normalize2).some((artist) => artist && (credit.includes(artist) || artist.includes(credit)));
          if (known) title = title.replace(credits[0], " ");
        }
        return stripCatalogQualifier(title).trim();
      }
      function featureAgnosticTitle(value) {
        return stripCatalogQualifier(value).replace(/\s*[\[(](?:feat(?:uring)?\.?|ft\.?)\s+[^\])]+[\])]/giu, " ").trim();
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
        const contained = left.length >= 3 && right.length >= 3 && (left.includes(right) || right.includes(left));
        return Math.max(contained ? 0.96 : 0, tokenSimilarity(left, right), editSimilarity(left, right));
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
        const actual = new Set(versionMarkers2(candidate.title));
        const unexpected = [...actual].filter((marker) => !expected.has(marker));
        const requiredMarkers = /* @__PURE__ */ new Set(["remix", "live", "acoustic", "cover", "instrumental", "karaoke", "slowed", "sped-up", "nightcore", "8d", "clean", "demo", "extended", "edit", "anniversary"]);
        const missing = [...expected].filter((marker) => requiredMarkers.has(marker) && !actual.has(marker));
        return [...unexpected, ...missing];
      }
      function authoritativeOwner(track, candidate) {
        const owner = normalize2(candidate.uploader || candidate.author || candidate.artist || "");
        return [...new Set([track.primaryArtist, ...track.artists || []].map(normalize2).filter(Boolean))].some((artist) => owner === artist || owner === `${artist} topic` || owner === `${artist} vevo` || owner === `${artist} official` || owner === `${artist} official channel`);
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
        const title = Math.max(
          textSimilarity2(expectedTitle, actualTitle),
          textSimilarity2(featureAgnosticTitle(track.title), featureAgnosticTitle(candidate.title)),
          ...versionMarkers2(track.title).some((marker) => versionMarkers2(candidate.title).includes(marker)) ? [textSimilarity2(versionBaseTitle(expectedTitle), versionBaseTitle(actualTitle))] : []
        );
        const measuredArtist = artistSimilarity(track, candidate);
        const localizedCatalogIdentity = candidate.resultType === "song" && title >= 0.82 && measuredArtist >= 0.45 && durationDiff !== null && durationDiff <= 3;
        const artist = authoritativeOwner(track, candidate) ? Math.max(measuredArtist, 0.9) : localizedCatalogIdentity ? Math.max(measuredArtist, 0.82) : measuredArtist;
        if (title < 0.6) rejectionReasons.push("TITLE_MISMATCH");
        if (artist < 0.7) rejectionReasons.push("ARTIST_MISMATCH");
        if (candidate.resultType === "generic-video" && NON_SONG_PATTERNS.test(normalize2(candidate.title))) rejectionReasons.push("NON_SONG_CONTENT");
        const measuredDuration = durationSimilarity2(track.duration, candidate.duration);
        const duration = candidate.resultType === "song" && title >= 0.95 && artist >= 0.9 && durationDiff !== null && durationLimit !== null && durationDiff <= durationLimit ? Math.max(measuredDuration || 0, 0.75) : measuredDuration;
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
      var MAX_STAGE_CANDIDATES = 50;
      var MAX_TOTAL_CANDIDATES = 120;
      function identityQuery2(track, primaryOnly = false) {
        const artists = primaryOnly ? [track.primaryArtist] : track.artists?.length ? track.artists : [track.primaryArtist];
        return `${artists.filter(Boolean).join(", ")} - ${track.title}`.trim();
      }
      function searchStages2(track) {
        const catalogEvidence = [track.album, track.releaseYear].filter(Boolean).join(" ");
        return [
          ...track.isrc ? [{ name: "isrc-song", query: track.isrc, filter: "songs" }] : [],
          { name: "all-artists-song", query: identityQuery2(track), filter: "songs" },
          ...(track.artists || []).filter(Boolean).length > 1 ? [{ name: "primary-artist-song", query: identityQuery2(track, true), filter: "songs" }] : [],
          ...catalogEvidence ? [{ name: "catalog-evidence-song", query: `${identityQuery2(track, true)} ${catalogEvidence}`.trim(), filter: "songs" }] : [],
          { name: "title-first-song", query: `${track.title} ${track.primaryArtist}`.trim(), filter: "songs" },
          { name: "title-only-song", query: track.title, filter: "songs" },
          { name: "music-video", query: identityQuery2(track), filter: "videos" },
          { name: "official-audio-generic", query: `${track.title} ${track.primaryArtist} official audio`.trim(), filter: "generic" },
          { name: "generic-video", query: identityQuery2(track), filter: "generic" },
          { name: "title-first-generic", query: `${track.title} ${track.primaryArtist}`.trim(), filter: "generic" }
        ];
      }
      function dedupeCandidates2(candidates) {
        const seen = /* @__PURE__ */ new Set();
        return candidates.filter((candidate) => {
          if (!candidate || typeof candidate !== "object" || typeof candidate.title !== "string" || !candidate.title.trim() || candidate.title.length > 300) return false;
          const key = candidate.videoId || candidate.id || candidate.url || candidate.sourceUrl;
          if (typeof key !== "string" || !key || key.length > 2048 || seen.has(key)) return false;
          if (candidate.duration !== void 0 && (!Number.isFinite(candidate.duration) || candidate.duration < 1 || candidate.duration > 7200)) return false;
          seen.add(key);
          return true;
        });
      }
      async function resolveSpotifyDecision2(track, adapter) {
        const pool = [];
        let confident = null;
        for (const stage of searchStages2(track)) {
          const response = await adapter.search(stage, track);
          const results = Array.isArray(response) ? response.slice(0, MAX_STAGE_CANDIDATES) : [];
          pool.push(...dedupeCandidates2(results).map((candidate) => ({ ...candidate, searchStage: stage.name })));
          if (pool.length > MAX_TOTAL_CANDIDATES) pool.splice(0, pool.length - MAX_TOTAL_CANDIDATES);
          const candidates = dedupeCandidates2(pool);
          const match = confidentMatch2(track, candidates);
          if (match) {
            confident = match;
            const alternatives = rankCandidates2(track, candidates).map((result) => result.candidate).filter((candidate) => candidate !== match.candidate && sameRecording2(track, match.candidate, candidate)).slice(0, 2);
            const enriched = { ...match, alternatives };
            if (match.evidence.isrcMatch || alternatives.length || stage.filter === "videos" || stage.filter === "generic") return { status: "matched", match: enriched };
          }
          if (confident && stage.filter === "videos") return { status: "matched", match: { ...confident, alternatives: [] } };
        }
        if (confident) return { status: "matched", match: { ...confident, alternatives: [] } };
        const finalCandidates = dedupeCandidates2(pool);
        const finalMatch = confidentMatch2(track, finalCandidates);
        if (finalMatch) return { status: "matched", match: finalMatch };
        const plausible = rankCandidates2(track, finalCandidates).filter((result) => result.score >= 80).slice(0, 2);
        if (plausible.length === 2 && plausible[0].score - plausible[1].score < 3) return { status: "ambiguous", candidates: plausible };
        return { status: "rejected", candidates: plausible };
      }
      async function resolveSpotifySource2(track, adapter) {
        const decision = await resolveSpotifyDecision2(track, adapter);
        return decision.status === "matched" ? decision.match : null;
      }
      module.exports = { dedupeCandidates: dedupeCandidates2, identityQuery: identityQuery2, resolveSpotifyDecision: resolveSpotifyDecision2, resolveSpotifySource: resolveSpotifySource2, searchStages: searchStages2, MAX_STAGE_CANDIDATES, MAX_TOTAL_CANDIDATES };
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
    canonicalMediaUrl: () => canonicalMediaUrl,
    canonicalTitle: () => canonicalTitle,
    capabilitiesFor: () => capabilitiesFor,
    classifyErrorText: () => classifyErrorText,
    clearHistory: () => clearHistory,
    confidentMatch: () => import_matcher.confidentMatch,
    createDownloadPolicy: () => createDownloadPolicy,
    createMediaEngine: () => createMediaEngine,
    dedupeCandidates: () => import_search_runtime.dedupeCandidates,
    detectRuntime: () => detectRuntime,
    detectSource: () => detectSource,
    durationSeconds: () => import_youtubeMusic_runtime.durationSeconds,
    durationSimilarity: () => import_matcher.durationSimilarity,
    equivalentToken: () => equivalentToken,
    evaluateCandidate: () => import_matcher.evaluateCandidate,
    identityQuery: () => import_search_runtime.identityQuery,
    isSupportedInstagramReelUrl: () => isSupportedInstagramReelUrl,
    isUnavailableSource: () => isUnavailableSource,
    listHistory: () => listHistory,
    mediaFilename: () => mediaFilename,
    messageForError: () => messageForError,
    normalize: () => normalize,
    normalizeError: () => normalizeError,
    normalizeUrl: () => normalizeUrl,
    openExternal: () => openExternal,
    parseCapabilities: () => parseCapabilities,
    parseDownloadJob: () => parseDownloadJob,
    parseDownloadProgress: () => parseDownloadProgress,
    parseDownloadRequest: () => parseDownloadRequest,
    parseEngineStatus: () => parseEngineStatus,
    parseJobId: () => parseJobId,
    parseMediaMode: () => parseMediaMode,
    parseReleaseInfo: () => parseReleaseInfo,
    parseRemoteUrl: () => parseRemoteUrl,
    parseResolvedMedia: () => parseResolvedMedia,
    parseYouTubeMusicResults: () => import_youtubeMusic_runtime.parseYouTubeMusicResults,
    rankCandidates: () => import_matcher.rankCandidates,
    recallSpotifyChoice: () => recallSpotifyChoice,
    rememberSpotifyChoice: () => rememberSpotifyChoice,
    removeHistory: () => removeHistory,
    resolveSpotifyDecision: () => import_search_runtime.resolveSpotifyDecision,
    resolveSpotifySource: () => import_search_runtime.resolveSpotifySource,
    runDownload: () => runDownload,
    sameRecording: () => import_matcher.sameRecording,
    sanitizeFilename: () => sanitizeFilename,
    scoreCandidate: () => import_matcher.scoreCandidate,
    searchStages: () => import_search_runtime.searchStages,
    spotifyResolvedMedia: () => spotifyResolvedMedia,
    spotifyTrackId: () => spotifyTrackId,
    supports: () => supports,
    textSimilarity: () => import_matcher.textSimilarity,
    transition: () => transition,
    versionMarkers: () => versionMarkers,
    withAbort: () => withAbort
  });

  // src/core/media/errors.ts
  var ERROR_CODES = [
    "UNSUPPORTED_PLATFORM",
    "UNSUPPORTED_SOURCE",
    "INVALID_URL",
    "SOURCE_UNAVAILABLE",
    "SOURCE_REJECTED",
    "SOURCE_FORBIDDEN",
    "SOURCE_NOT_FOUND",
    "RATE_LIMITED",
    "NETWORK_FAILED",
    "TIMEOUT",
    "NO_MEDIA_FOUND",
    "POST_IMAGES_UNSUPPORTED",
    "MATCH_CONFIDENCE_LOW",
    "DOWNLOAD_FAILED",
    "EXTRACTOR_FAILED",
    "FFMPEG_FAILED",
    "PROCESSING_FAILED",
    "PERMISSION_DENIED",
    "SAVE_FAILED",
    "STORAGE_FAILED",
    "ENGINE_UNAVAILABLE",
    "ENGINE_OUTDATED",
    "CANCELLED"
  ];
  var messages = {
    UNSUPPORTED_PLATFORM: "This platform is unsupported.",
    UNSUPPORTED_SOURCE: "This source is not currently supported by Savewave.",
    INVALID_URL: "Unsupported media link.",
    SOURCE_UNAVAILABLE: "This media is unavailable.",
    SOURCE_REJECTED: "The source temporarily rejected this request.",
    SOURCE_FORBIDDEN: "This source requires access Savewave does not have.",
    SOURCE_NOT_FOUND: "This media no longer exists or is unavailable.",
    RATE_LIMITED: "The source is busy. Please wait and try again.",
    NETWORK_FAILED: "Could not reach the source. Check your connection.",
    TIMEOUT: "The source took too long to respond.",
    NO_MEDIA_FOUND: "No downloadable media was found.",
    POST_IMAGES_UNSUPPORTED: "This photo post cannot be extracted by the current local engine.",
    MATCH_CONFIDENCE_LOW: "Could not confidently match this Spotify track.",
    DOWNLOAD_FAILED: "Download failed.",
    EXTRACTOR_FAILED: "The media source changed and needs an engine update.",
    FFMPEG_FAILED: "Media processing could not be completed.",
    PROCESSING_FAILED: "Media processing failed.",
    PERMISSION_DENIED: "Storage permission was denied.",
    SAVE_FAILED: "The file could not be saved.",
    STORAGE_FAILED: "The file could not be added to Downloads.",
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
  function messageForError(code) {
    return messages[code];
  }
  function classifyErrorText(value) {
    const text = value.toLowerCase();
    if (/cancel(?:led|ed|ation)/.test(text)) return "CANCELLED";
    if (/instagram/.test(text) && /no video formats found/.test(text)) return "POST_IMAGES_UNSUPPORTED";
    if (/\b429\b|too many requests|rate.?limit/.test(text)) return "RATE_LIMITED";
    if (/instagram sent an empty media response/.test(text)) return "SOURCE_REJECTED";
    if (/\b403\b|forbidden|login required|log in|sign in|private (?:post|video|media|account)/.test(text)) return "SOURCE_FORBIDDEN";
    if (/\b404\b|not found|removed|unavailable video/.test(text)) return "SOURCE_NOT_FOUND";
    if (/no video formats found|requested format is not available/.test(text)) return "NO_MEDIA_FOUND";
    if (/timed? out|timeout/.test(text)) return "TIMEOUT";
    if (/ffmpeg|postprocess|merge.*fail/.test(text)) return "FFMPEG_FAILED";
    if (/no space|disk full|mediastore|permission denied|access denied/.test(text)) return "STORAGE_FAILED";
    if (/dns|name resolution|network is unreachable|connection (?:failed|refused|reset)|offline/.test(text)) return "NETWORK_FAILED";
    if (/unsupported url|no suitable extractor|extractor error/.test(text)) return "EXTRACTOR_FAILED";
    return "DOWNLOAD_FAILED";
  }
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

  // src/core/media/contracts.ts
  var MODES = /* @__PURE__ */ new Set(["video", "audio"]);
  var SOURCES = /* @__PURE__ */ new Set(["youtube", "instagram", "facebook", "threads", "twitter", "soundcloud", "spotify", "direct", "unknown"]);
  var STATES = /* @__PURE__ */ new Set(["idle", "detecting", "resolving", "resolved", "downloading", "processing", "completed", "cancelled", "error"]);
  var JOB_ID = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/;
  function record(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new MediaEngineError("PROCESSING_FAILED");
    return value;
  }
  function boundedString(value, maximum, required = true) {
    if (value === void 0 || value === null) {
      if (required) throw new MediaEngineError("PROCESSING_FAILED");
      return void 0;
    }
    if (typeof value !== "string" || value.length > maximum || required && !value.trim()) throw new MediaEngineError("PROCESSING_FAILED");
    return value;
  }
  function parseRemoteUrl(value, required = true) {
    const text = boundedString(value, 4096, required);
    if (!text) return text;
    try {
      const parsed = new URL(text);
      if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("protocol");
      return parsed.toString();
    } catch {
      throw new MediaEngineError("INVALID_URL");
    }
  }
  function parseMediaMode(value, fallback) {
    if (value === void 0 && fallback) return fallback;
    if (!MODES.has(value)) throw new MediaEngineError("PROCESSING_FAILED");
    return value;
  }
  function parseJobId(value) {
    const jobId = boundedString(value, 128);
    if (!JOB_ID.test(jobId)) throw new MediaEngineError("PROCESSING_FAILED");
    return jobId;
  }
  function parseDownloadRequest(value) {
    const input = record(value);
    return {
      url: parseRemoteUrl(input.url),
      mode: parseMediaMode(input.mode),
      title: boundedString(input.title, 240, false),
      source: input.source === void 0 ? void 0 : (() => {
        if (!SOURCES.has(input.source)) throw new MediaEngineError("PROCESSING_FAILED");
        return input.source;
      })()
    };
  }
  function parseDownloadJob(value) {
    const input = record(value);
    const state = input.state;
    if (!STATES.has(state)) throw new MediaEngineError("PROCESSING_FAILED");
    return { jobId: parseJobId(input.jobId), state };
  }
  function parseDownloadProgress(value) {
    const input = record(value);
    const base = parseDownloadJob(input);
    const number = (field, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) => {
      const candidate = input[field];
      if (candidate === void 0 || candidate === null) return void 0;
      if (typeof candidate !== "number" || !Number.isFinite(candidate) || candidate < minimum || candidate > maximum) {
        throw new MediaEngineError("PROCESSING_FAILED");
      }
      return candidate;
    };
    return {
      ...base,
      percent: number("percent", 0, 100),
      downloadedBytes: number("downloadedBytes"),
      totalBytes: number("totalBytes"),
      speed: number("speed"),
      eta: number("eta"),
      filename: boundedString(input.filename, 260, false),
      filenames: input.filenames === void 0 ? void 0 : (() => {
        if (!Array.isArray(input.filenames) || input.filenames.length < 1 || input.filenames.length > 20) throw new MediaEngineError("PROCESSING_FAILED");
        return input.filenames.map((filename) => boundedString(filename, 260));
      })(),
      errorCode: boundedString(input.errorCode, 64, false),
      errorMessage: boundedString(input.errorMessage, 500, false)
    };
  }
  function parseEngineStatus(value) {
    const input = record(value);
    if (typeof input.available !== "boolean") throw new MediaEngineError("PROCESSING_FAILED");
    for (const flag of ["initializing", "updateAvailable"]) {
      if (input[flag] !== void 0 && typeof input[flag] !== "boolean") throw new MediaEngineError("PROCESSING_FAILED");
    }
    return {
      available: input.available,
      initializing: input.initializing,
      version: boundedString(input.version, 64),
      engineVersion: boundedString(input.engineVersion, 128, false),
      ffmpegVersion: boundedString(input.ffmpegVersion, 256, false),
      updateAvailable: input.updateAvailable,
      error: boundedString(input.error, 256, false)
    };
  }
  function parseCapabilities(value) {
    const input = record(value);
    if (!["web", "desktop", "android"].includes(String(input.platform))) throw new MediaEngineError("PROCESSING_FAILED");
    const rawSources = record(input.sources);
    const sources = {};
    for (const source of SOURCES) {
      const raw = record(rawSources[source]);
      const capability = {};
      for (const field of ["video", "audio", "media", "smartMatch"]) {
        if (raw[field] !== void 0 && typeof raw[field] !== "boolean") throw new MediaEngineError("PROCESSING_FAILED");
        if (raw[field] === true) capability[field] = true;
      }
      sources[source] = capability;
    }
    return { platform: input.platform, sources };
  }
  function parseReleaseInfo(value) {
    if (value === null || value === void 0) return null;
    const input = record(value);
    if (Object.keys(input).length === 0) return null;
    if (Object.keys(input).length === 0) return null;
    if (typeof input.updateAvailable !== "boolean") throw new MediaEngineError("PROCESSING_FAILED");
    return {
      version: boundedString(input.version, 64),
      downloadUrl: parseRemoteUrl(input.downloadUrl),
      windowsDownloadUrl: parseRemoteUrl(input.windowsDownloadUrl, false),
      androidDownloadUrl: parseRemoteUrl(input.androidDownloadUrl, false),
      releaseUrl: parseRemoteUrl(input.releaseUrl),
      changelogUrl: parseRemoteUrl(input.changelogUrl),
      summary: boundedString(input.summary, 2e3),
      updateAvailable: input.updateAvailable
    };
  }
  function parseResolvedMedia(value) {
    const input = record(value);
    if (input.success !== true || !SOURCES.has(input.platform)) throw new MediaEngineError("PROCESSING_FAILED");
    const type = input.type;
    if (type !== "image" && !MODES.has(type)) throw new MediaEngineError("PROCESSING_FAILED");
    const selectionRequired = input.selectionRequired === true;
    const options = input.matchOptions === void 0 || Array.isArray(input.matchOptions) && input.matchOptions.length === 0 && !selectionRequired ? void 0 : (() => {
      if (!Array.isArray(input.matchOptions) || input.matchOptions.length < 1 || input.matchOptions.length > 2) throw new MediaEngineError("PROCESSING_FAILED");
      return input.matchOptions.map((raw) => {
        const option = record(raw);
        const score = option.score;
        if (typeof score !== "number" || !Number.isFinite(score) || score < 0 || score > 100) throw new MediaEngineError("PROCESSING_FAILED");
        const duration2 = option.duration;
        if (duration2 !== void 0 && (typeof duration2 !== "number" || !Number.isFinite(duration2) || duration2 < 0)) throw new MediaEngineError("PROCESSING_FAILED");
        return {
          sourceUrl: parseRemoteUrl(option.sourceUrl),
          title: boundedString(option.title, 500),
          creator: boundedString(option.creator, 500),
          duration: duration2,
          score
        };
      });
    })();
    if (selectionRequired && !options) throw new MediaEngineError("PROCESSING_FAILED");
    const sourceUrl = selectionRequired && !input.sourceUrl ? "" : parseRemoteUrl(input.sourceUrl);
    const fallbackSourceUrls = input.fallbackSourceUrls === void 0 ? void 0 : (() => {
      if (!Array.isArray(input.fallbackSourceUrls) || input.fallbackSourceUrls.length > 5) throw new MediaEngineError("PROCESSING_FAILED");
      return input.fallbackSourceUrls.map((url) => parseRemoteUrl(url));
    })();
    const duration = input.duration;
    if (duration !== void 0 && duration !== null && (typeof duration !== "number" || !Number.isFinite(duration) || duration < 0)) throw new MediaEngineError("PROCESSING_FAILED");
    return {
      success: true,
      platform: input.platform,
      title: boundedString(input.title, 500),
      creator: boundedString(input.creator, 500),
      thumbnail: input.thumbnail === null ? null : parseRemoteUrl(input.thumbnail, false),
      duration,
      type,
      qualityLabel: boundedString(input.qualityLabel, 200),
      sourceUrl,
      fallbackSourceUrls,
      selectionRequired: selectionRequired || void 0,
      matchOptions: options
    };
  }

  // src/core/media/download.ts
  var TERMINAL_STATES = /* @__PURE__ */ new Set(["completed", "cancelled", "error"]);
  var RETRYABLE_CODES = /* @__PURE__ */ new Set(["SOURCE_UNAVAILABLE", "SOURCE_REJECTED", "DOWNLOAD_FAILED"]);
  function wait(milliseconds, signal) {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) {
        reject(new MediaEngineError("CANCELLED"));
        return;
      }
      const timer = setTimeout(done, milliseconds);
      function done() {
        signal?.removeEventListener("abort", abort);
        resolve();
      }
      function abort() {
        clearTimeout(timer);
        signal?.removeEventListener("abort", abort);
        reject(new MediaEngineError("CANCELLED"));
      }
      signal?.addEventListener("abort", abort, { once: true });
    });
  }
  function withAbort(operation, signal) {
    if (signal.aborted) return Promise.reject(new MediaEngineError("CANCELLED"));
    return new Promise((resolve, reject) => {
      const abort = () => reject(new MediaEngineError("CANCELLED"));
      signal.addEventListener("abort", abort, { once: true });
      operation.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
    });
  }
  function terminalError(progress) {
    if (progress.state === "cancelled") return new MediaEngineError("CANCELLED");
    const code = ERROR_CODES.includes(progress.errorCode) ? progress.errorCode : "DOWNLOAD_FAILED";
    return new MediaEngineError(code);
  }
  async function runDownload(options) {
    const urls = [.../* @__PURE__ */ new Set([options.media.sourceUrl || options.originalUrl, ...options.media.fallbackSourceUrls || []])].filter(Boolean).slice(0, 3);
    if (!urls.length) throw new MediaEngineError("NO_MEDIA_FOUND");
    const pollInterval = Math.max(50, Math.min(options.pollIntervalMs ?? 750, 1e4));
    const maximumPolls = Math.max(1, Math.min(options.maximumPolls ?? 19200, 2e4));
    let lastError = null;
    for (let index = 0; index < urls.length; index += 1) {
      let jobId = null;
      try {
        if (options.signal?.aborted) throw new MediaEngineError("CANCELLED");
        const job = await options.engine.downloadMedia({
          url: urls[index],
          mode: options.mode,
          title: options.media.title,
          source: options.media.platform
        });
        jobId = job.jobId;
        options.onJobChange?.(jobId);
        for (let poll = 0; poll < maximumPolls; poll += 1) {
          if (options.signal?.aborted) throw new MediaEngineError("CANCELLED");
          const progress = await options.engine.getDownloadProgress(jobId);
          options.onProgress?.(progress);
          if (TERMINAL_STATES.has(progress.state)) {
            if (progress.state === "completed") return progress;
            throw terminalError(progress);
          }
          await wait(pollInterval, options.signal);
        }
        throw new MediaEngineError("TIMEOUT");
      } catch (error) {
        const normalized = normalizeError(error);
        lastError = normalized;
        if (normalized.code === "CANCELLED" && jobId) {
          try {
            await options.engine.cancelDownload(jobId);
          } catch {
          }
        }
        if (!RETRYABLE_CODES.has(normalized.code) || index === urls.length - 1) throw normalized;
      } finally {
        options.onJobChange?.(null);
      }
    }
    throw lastError || new MediaEngineError("DOWNLOAD_FAILED");
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
  function createDownloadPolicy(mode, source) {
    const socialSource = source === "instagram" || source === "facebook" || source === "threads" || source === "twitter";
    const multiItemSource = socialSource && source !== "instagram";
    const reliability = {
      socketTimeoutSeconds: 20,
      retries: 5,
      fragmentRetries: 5,
      extractorRetries: 3,
      maxItems: multiItemSource ? 20 : 1
    };
    return mode === "audio" ? { ...reliability, formatSelector: "bestaudio/best", extractAudio: true, audioFormat: "best" } : socialSource ? { ...reliability, formatSelector: "best", extractAudio: false } : { ...reliability, formatSelector: "bestvideo+bestaudio/best", extractAudio: false, mergeOutputFormat: "mp4/mkv" };
  }
  function automaticFormatArguments(mode, source) {
    const policy = createDownloadPolicy(mode, source);
    return policy.extractAudio ? ["-f", policy.formatSelector, "--extract-audio", "--audio-format", policy.audioFormat || "best"] : ["-f", policy.formatSelector, ...policy.mergeOutputFormat ? ["--merge-output-format", policy.mergeOutputFormat] : []];
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
  function canonicalMediaUrl(value) {
    const url = normalizeUrl(value);
    if (!url || !isDomain(url.hostname.toLowerCase(), "youtube.com")) return value;
    const short = /^\/shorts\/([A-Za-z0-9_-]{11})\/?$/.exec(url.pathname);
    return short ? `https://www.youtube.com/watch?v=${short[1]}` : value;
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
  function isSupportedInstagramReelUrl(value) {
    const url = normalizeUrl(value);
    if (!url) return false;
    const host = url.hostname.toLowerCase();
    return isDomain(host, "instagram.com") && /^\/reels?\/[A-Za-z0-9_-]{5,}\/?$/.test(url.pathname);
  }
  function isUnavailableSource(source, url) {
    if (source === "instagram") return !url || !isSupportedInstagramReelUrl(url);
    return source === "facebook" || source === "twitter";
  }

  // src/core/platform/capabilities.ts
  var none = {};
  var full = { video: true, audio: true, media: true };
  function capabilitiesFor(platform) {
    const native = platform !== "web";
    return { platform, sources: {
      youtube: native ? full : none,
      instagram: native ? { video: true, audio: true } : none,
      facebook: none,
      threads: native ? { media: true } : none,
      twitter: none,
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

  // node_modules/@capacitor/core/dist/index.js
  var ExceptionCode;
  (function(ExceptionCode2) {
    ExceptionCode2["Unimplemented"] = "UNIMPLEMENTED";
    ExceptionCode2["Unavailable"] = "UNAVAILABLE";
  })(ExceptionCode || (ExceptionCode = {}));
  var CapacitorException = class extends Error {
    constructor(message, code, data) {
      super(message);
      this.message = message;
      this.code = code;
      this.data = data;
    }
  };
  var getPlatformId = (win) => {
    var _a, _b;
    if (win === null || win === void 0 ? void 0 : win.androidBridge) {
      return "android";
    } else if ((_b = (_a = win === null || win === void 0 ? void 0 : win.webkit) === null || _a === void 0 ? void 0 : _a.messageHandlers) === null || _b === void 0 ? void 0 : _b.bridge) {
      return "ios";
    } else {
      return "web";
    }
  };
  var createCapacitor = (win) => {
    const capCustomPlatform = win.CapacitorCustomPlatform || null;
    const cap = win.Capacitor || {};
    const Plugins = cap.Plugins = cap.Plugins || {};
    const getPlatform = () => {
      return capCustomPlatform !== null ? capCustomPlatform.name : getPlatformId(win);
    };
    const isNativePlatform = () => getPlatform() !== "web";
    const isPluginAvailable = (pluginName) => {
      const plugin = registeredPlugins.get(pluginName);
      if (plugin === null || plugin === void 0 ? void 0 : plugin.platforms.has(getPlatform())) {
        return true;
      }
      if (getPluginHeader(pluginName)) {
        return true;
      }
      return false;
    };
    const getPluginHeader = (pluginName) => {
      var _a;
      return (_a = cap.PluginHeaders) === null || _a === void 0 ? void 0 : _a.find((h) => h.name === pluginName);
    };
    const handleError = (err) => win.console.error(err);
    const registeredPlugins = /* @__PURE__ */ new Map();
    const registerPlugin2 = (pluginName, jsImplementations = {}) => {
      const registeredPlugin = registeredPlugins.get(pluginName);
      if (registeredPlugin) {
        console.warn(`Capacitor plugin "${pluginName}" already registered. Cannot register plugins twice.`);
        return registeredPlugin.proxy;
      }
      const platform = getPlatform();
      const pluginHeader = getPluginHeader(pluginName);
      let jsImplementation;
      const loadPluginImplementation = async () => {
        if (!jsImplementation && platform in jsImplementations) {
          jsImplementation = typeof jsImplementations[platform] === "function" ? jsImplementation = await jsImplementations[platform]() : jsImplementation = jsImplementations[platform];
        } else if (capCustomPlatform !== null && !jsImplementation && "web" in jsImplementations) {
          jsImplementation = typeof jsImplementations["web"] === "function" ? jsImplementation = await jsImplementations["web"]() : jsImplementation = jsImplementations["web"];
        }
        return jsImplementation;
      };
      const createPluginMethod = (impl, prop) => {
        var _a, _b;
        if (pluginHeader) {
          const methodHeader = pluginHeader === null || pluginHeader === void 0 ? void 0 : pluginHeader.methods.find((m) => prop === m.name);
          if (methodHeader) {
            if (methodHeader.rtype === "promise") {
              return (options) => cap.nativePromise(pluginName, prop.toString(), options);
            } else {
              return (options, callback) => cap.nativeCallback(pluginName, prop.toString(), options, callback);
            }
          } else if (impl) {
            return (_a = impl[prop]) === null || _a === void 0 ? void 0 : _a.bind(impl);
          }
        } else if (impl) {
          return (_b = impl[prop]) === null || _b === void 0 ? void 0 : _b.bind(impl);
        } else {
          throw new CapacitorException(`"${pluginName}" plugin is not implemented on ${platform}`, ExceptionCode.Unimplemented);
        }
      };
      const createPluginMethodWrapper = (prop) => {
        let remove;
        const wrapper = (...args) => {
          const p = loadPluginImplementation().then((impl) => {
            const fn = createPluginMethod(impl, prop);
            if (fn) {
              const p2 = fn(...args);
              remove = p2 === null || p2 === void 0 ? void 0 : p2.remove;
              return p2;
            } else {
              throw new CapacitorException(`"${pluginName}.${prop}()" is not implemented on ${platform}`, ExceptionCode.Unimplemented);
            }
          });
          if (prop === "addListener") {
            p.remove = async () => remove();
          }
          return p;
        };
        wrapper.toString = () => `${prop.toString()}() { [capacitor code] }`;
        Object.defineProperty(wrapper, "name", {
          value: prop,
          writable: false,
          configurable: false
        });
        return wrapper;
      };
      const addListener = createPluginMethodWrapper("addListener");
      const removeListener = createPluginMethodWrapper("removeListener");
      const addListenerNative = (eventName, callback) => {
        const call = addListener({ eventName }, callback);
        const remove = async () => {
          const callbackId = await call;
          removeListener({
            eventName,
            callbackId
          }, callback);
        };
        const p = new Promise((resolve) => call.then(() => resolve({ remove })));
        p.remove = async () => {
          console.warn(`Using addListener() without 'await' is deprecated.`);
          await remove();
        };
        return p;
      };
      const proxy = new Proxy({}, {
        get(_, prop) {
          switch (prop) {
            // https://github.com/facebook/react/issues/20030
            case "$$typeof":
              return void 0;
            case "toJSON":
              return () => ({});
            case "addListener":
              return pluginHeader ? addListenerNative : addListener;
            case "removeListener":
              return removeListener;
            default:
              return createPluginMethodWrapper(prop);
          }
        }
      });
      Plugins[pluginName] = proxy;
      registeredPlugins.set(pluginName, {
        name: pluginName,
        proxy,
        platforms: /* @__PURE__ */ new Set([...Object.keys(jsImplementations), ...pluginHeader ? [platform] : []])
      });
      return proxy;
    };
    if (!cap.convertFileSrc) {
      cap.convertFileSrc = (filePath) => filePath;
    }
    cap.getPlatform = getPlatform;
    cap.handleError = handleError;
    cap.isNativePlatform = isNativePlatform;
    cap.isPluginAvailable = isPluginAvailable;
    cap.registerPlugin = registerPlugin2;
    cap.Exception = CapacitorException;
    cap.DEBUG = !!cap.DEBUG;
    cap.isLoggingEnabled = !!cap.isLoggingEnabled;
    return cap;
  };
  var initCapacitorGlobal = (win) => win.Capacitor = createCapacitor(win);
  var Capacitor = /* @__PURE__ */ initCapacitorGlobal(typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : {});
  var registerPlugin = Capacitor.registerPlugin;
  var WebPlugin = class {
    constructor() {
      this.listeners = {};
      this.retainedEventArguments = {};
      this.windowListeners = {};
    }
    addListener(eventName, listenerFunc) {
      let firstListener = false;
      const listeners = this.listeners[eventName];
      if (!listeners) {
        this.listeners[eventName] = [];
        firstListener = true;
      }
      this.listeners[eventName].push(listenerFunc);
      const windowListener = this.windowListeners[eventName];
      if (windowListener && !windowListener.registered) {
        this.addWindowListener(windowListener);
      }
      if (firstListener) {
        this.sendRetainedArgumentsForEvent(eventName);
      }
      const remove = async () => this.removeListener(eventName, listenerFunc);
      const p = Promise.resolve({ remove });
      return p;
    }
    async removeAllListeners() {
      this.listeners = {};
      for (const listener in this.windowListeners) {
        this.removeWindowListener(this.windowListeners[listener]);
      }
      this.windowListeners = {};
    }
    notifyListeners(eventName, data, retainUntilConsumed) {
      const listeners = this.listeners[eventName];
      if (!listeners) {
        if (retainUntilConsumed) {
          let args = this.retainedEventArguments[eventName];
          if (!args) {
            args = [];
          }
          args.push(data);
          this.retainedEventArguments[eventName] = args;
        }
        return;
      }
      listeners.forEach((listener) => listener(data));
    }
    hasListeners(eventName) {
      var _a;
      return !!((_a = this.listeners[eventName]) === null || _a === void 0 ? void 0 : _a.length);
    }
    registerWindowListener(windowEventName, pluginEventName) {
      this.windowListeners[pluginEventName] = {
        registered: false,
        windowEventName,
        pluginEventName,
        handler: (event) => {
          this.notifyListeners(pluginEventName, event);
        }
      };
    }
    unimplemented(msg = "not implemented") {
      return new Capacitor.Exception(msg, ExceptionCode.Unimplemented);
    }
    unavailable(msg = "not available") {
      return new Capacitor.Exception(msg, ExceptionCode.Unavailable);
    }
    async removeListener(eventName, listenerFunc) {
      const listeners = this.listeners[eventName];
      if (!listeners) {
        return;
      }
      const index = listeners.indexOf(listenerFunc);
      if (index !== -1) {
        this.listeners[eventName].splice(index, 1);
      }
      if (!this.listeners[eventName].length) {
        this.removeWindowListener(this.windowListeners[eventName]);
      }
    }
    addWindowListener(handle) {
      window.addEventListener(handle.windowEventName, handle.handler);
      handle.registered = true;
    }
    removeWindowListener(handle) {
      if (!handle) {
        return;
      }
      window.removeEventListener(handle.windowEventName, handle.handler);
      handle.registered = false;
    }
    sendRetainedArgumentsForEvent(eventName) {
      const args = this.retainedEventArguments[eventName];
      if (!args) {
        return;
      }
      delete this.retainedEventArguments[eventName];
      args.forEach((arg) => {
        this.notifyListeners(eventName, arg);
      });
    }
  };
  var encode = (str) => encodeURIComponent(str).replace(/%(2[346B]|5E|60|7C)/g, decodeURIComponent).replace(/[()]/g, escape);
  var decode = (str) => str.replace(/(%[\dA-F]{2})+/gi, decodeURIComponent);
  var CapacitorCookiesPluginWeb = class extends WebPlugin {
    async getCookies() {
      const cookies = document.cookie;
      const cookieMap = {};
      cookies.split(";").forEach((cookie) => {
        if (cookie.length <= 0)
          return;
        let [key, value] = cookie.replace(/=/, "CAP_COOKIE").split("CAP_COOKIE");
        key = decode(key).trim();
        value = decode(value).trim();
        cookieMap[key] = value;
      });
      return cookieMap;
    }
    async setCookie(options) {
      try {
        const encodedKey = encode(options.key);
        const encodedValue = encode(options.value);
        const expires = options.expires ? `; expires=${options.expires.replace("expires=", "")}` : "";
        const path = (options.path || "/").replace("path=", "");
        const domain = options.url != null && options.url.length > 0 ? `domain=${options.url}` : "";
        document.cookie = `${encodedKey}=${encodedValue || ""}${expires}; path=${path}; ${domain};`;
      } catch (error) {
        return Promise.reject(error);
      }
    }
    async deleteCookie(options) {
      try {
        document.cookie = `${options.key}=; Max-Age=0`;
      } catch (error) {
        return Promise.reject(error);
      }
    }
    async clearCookies() {
      try {
        const cookies = document.cookie.split(";") || [];
        for (const cookie of cookies) {
          document.cookie = cookie.replace(/^ +/, "").replace(/=.*/, `=;expires=${(/* @__PURE__ */ new Date()).toUTCString()};path=/`);
        }
      } catch (error) {
        return Promise.reject(error);
      }
    }
    async clearAllCookies() {
      try {
        await this.clearCookies();
      } catch (error) {
        return Promise.reject(error);
      }
    }
  };
  var CapacitorCookies = registerPlugin("CapacitorCookies", {
    web: () => new CapacitorCookiesPluginWeb()
  });
  var readBlobAsBase64 = async (blob) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64String = reader.result;
      resolve(base64String.indexOf(",") >= 0 ? base64String.split(",")[1] : base64String);
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(blob);
  });
  var normalizeHttpHeaders = (headers = {}) => {
    const originalKeys = Object.keys(headers);
    const loweredKeys = Object.keys(headers).map((k) => k.toLocaleLowerCase());
    const normalized = loweredKeys.reduce((acc, key, index) => {
      acc[key] = headers[originalKeys[index]];
      return acc;
    }, {});
    return normalized;
  };
  var buildUrlParams = (params, shouldEncode = true) => {
    if (!params)
      return null;
    const output = Object.entries(params).reduce((accumulator, entry) => {
      const [key, value] = entry;
      let encodedValue;
      let item;
      if (Array.isArray(value)) {
        item = "";
        value.forEach((str) => {
          encodedValue = shouldEncode ? encodeURIComponent(str) : str;
          item += `${key}=${encodedValue}&`;
        });
        item.slice(0, -1);
      } else {
        encodedValue = shouldEncode ? encodeURIComponent(value) : value;
        item = `${key}=${encodedValue}`;
      }
      return `${accumulator}&${item}`;
    }, "");
    return output.substr(1);
  };
  var buildRequestInit = (options, extra = {}) => {
    const output = Object.assign({ method: options.method || "GET", headers: options.headers }, extra);
    const headers = normalizeHttpHeaders(options.headers);
    const type = headers["content-type"] || "";
    if (typeof options.data === "string") {
      output.body = options.data;
    } else if (type.includes("application/x-www-form-urlencoded")) {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(options.data || {})) {
        params.set(key, value);
      }
      output.body = params.toString();
    } else if (type.includes("multipart/form-data") || options.data instanceof FormData) {
      const form = new FormData();
      if (options.data instanceof FormData) {
        options.data.forEach((value, key) => {
          form.append(key, value);
        });
      } else {
        for (const key of Object.keys(options.data)) {
          form.append(key, options.data[key]);
        }
      }
      output.body = form;
      const headers2 = new Headers(output.headers);
      headers2.delete("content-type");
      output.headers = headers2;
    } else if (type.includes("application/json") || typeof options.data === "object") {
      output.body = JSON.stringify(options.data);
    }
    return output;
  };
  var CapacitorHttpPluginWeb = class extends WebPlugin {
    /**
     * Perform an Http request given a set of options
     * @param options Options to build the HTTP request
     */
    async request(options) {
      const requestInit = buildRequestInit(options, options.webFetchExtra);
      const urlParams = buildUrlParams(options.params, options.shouldEncodeUrlParams);
      const url = urlParams ? `${options.url}?${urlParams}` : options.url;
      const response = await fetch(url, requestInit);
      const contentType = response.headers.get("content-type") || "";
      let { responseType = "text" } = response.ok ? options : {};
      if (contentType.includes("application/json")) {
        responseType = "json";
      }
      let data;
      let blob;
      switch (responseType) {
        case "arraybuffer":
        case "blob":
          blob = await response.blob();
          data = await readBlobAsBase64(blob);
          break;
        case "json":
          data = await response.json();
          break;
        case "document":
        case "text":
        default:
          data = await response.text();
      }
      const headers = {};
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });
      return {
        data,
        headers,
        status: response.status,
        url: response.url
      };
    }
    /**
     * Perform an Http GET request given a set of options
     * @param options Options to build the HTTP request
     */
    async get(options) {
      return this.request(Object.assign(Object.assign({}, options), { method: "GET" }));
    }
    /**
     * Perform an Http POST request given a set of options
     * @param options Options to build the HTTP request
     */
    async post(options) {
      return this.request(Object.assign(Object.assign({}, options), { method: "POST" }));
    }
    /**
     * Perform an Http PUT request given a set of options
     * @param options Options to build the HTTP request
     */
    async put(options) {
      return this.request(Object.assign(Object.assign({}, options), { method: "PUT" }));
    }
    /**
     * Perform an Http PATCH request given a set of options
     * @param options Options to build the HTTP request
     */
    async patch(options) {
      return this.request(Object.assign(Object.assign({}, options), { method: "PATCH" }));
    }
    /**
     * Perform an Http DELETE request given a set of options
     * @param options Options to build the HTTP request
     */
    async delete(options) {
      return this.request(Object.assign(Object.assign({}, options), { method: "DELETE" }));
    }
  };
  var CapacitorHttp = registerPlugin("CapacitorHttp", {
    web: () => new CapacitorHttpPluginWeb()
  });
  var SystemBarsStyle;
  (function(SystemBarsStyle2) {
    SystemBarsStyle2["Dark"] = "DARK";
    SystemBarsStyle2["Light"] = "LIGHT";
    SystemBarsStyle2["Default"] = "DEFAULT";
  })(SystemBarsStyle || (SystemBarsStyle = {}));
  var SystemBarType;
  (function(SystemBarType2) {
    SystemBarType2["StatusBar"] = "StatusBar";
    SystemBarType2["NavigationBar"] = "NavigationBar";
  })(SystemBarType || (SystemBarType = {}));
  var SystemBarsPluginWeb = class extends WebPlugin {
    async setStyle() {
      this.unavailable("not available for web");
    }
    async setAnimation() {
      this.unavailable("not available for web");
    }
    async show() {
      this.unavailable("not available for web");
    }
    async hide() {
      this.unavailable("not available for web");
    }
  };
  var SystemBars = registerPlugin("SystemBars", {
    web: () => new SystemBarsPluginWeb()
  });

  // src/core/platform/electron.ts
  function desktopBridge() {
    const bridge = window.savewaveDesktop;
    if (!bridge) throw new Error("DESKTOP_BRIDGE_UNAVAILABLE");
    return bridge;
  }
  var ElectronMediaEngine = class {
    getPlatform() {
      return "desktop";
    }
    async getCapabilities() {
      return parseCapabilities(await desktopBridge().getCapabilities());
    }
    async getEngineStatus() {
      return parseEngineStatus(await desktopBridge().getEngineStatus());
    }
    async getReleaseInfo() {
      return parseReleaseInfo(await desktopBridge().getReleaseInfo());
    }
    async resolveMedia(url, mode = "video") {
      if (isUnavailableSource(detectSource(url), url)) throw new MediaEngineError("UNSUPPORTED_SOURCE");
      return parseResolvedMedia(await desktopBridge().resolveMedia(url, mode));
    }
    async downloadMedia(request) {
      const input = parseDownloadRequest(request);
      if (isUnavailableSource(detectSource(input.url), input.url)) throw new MediaEngineError("UNSUPPORTED_SOURCE");
      return parseDownloadJob(await desktopBridge().downloadMedia(input));
    }
    cancelDownload(jobId) {
      return desktopBridge().cancelDownload(jobId);
    }
    async getDownloadProgress(jobId) {
      return parseDownloadProgress(await desktopBridge().getDownloadProgress(jobId));
    }
  };

  // src/core/spotify/search.ts
  var import_search_runtime = __toESM(require_search_runtime());

  // src/core/spotify/resolvedMedia.ts
  var candidateUrl = (candidate) => candidate.sourceUrl || candidate.url;
  var candidateCreator = (candidate) => candidate.artists?.filter(Boolean).join(", ") || candidate.artist || candidate.uploader || "YouTube source";
  function spotifyResolvedMedia(track, decision) {
    const base = {
      success: true,
      platform: "spotify",
      title: track.title,
      creator: track.artists.join(", "),
      thumbnail: track.thumbnail,
      duration: track.duration,
      type: "audio"
    };
    if (decision.status === "matched") {
      const sourceUrl = candidateUrl(decision.match.candidate);
      if (!sourceUrl) throw { code: "MATCH_CONFIDENCE_LOW" };
      const fallbackSourceUrls = (decision.match.alternatives || []).map(candidateUrl).filter((value) => Boolean(value) && value !== sourceUrl);
      return { ...base, qualityLabel: "Verified high-confidence match", sourceUrl, fallbackSourceUrls };
    }
    if (decision.status === "ambiguous") {
      const matchOptions = decision.candidates.map(({ candidate, score }) => ({
        sourceUrl: candidateUrl(candidate),
        title: candidate.title,
        creator: candidateCreator(candidate),
        duration: candidate.duration,
        score
      })).filter((option) => Boolean(option.sourceUrl));
      if (matchOptions.length === 2) {
        return { ...base, qualityLabel: "Your choice required", sourceUrl: "", selectionRequired: true, matchOptions };
      }
    }
    throw { code: "MATCH_CONFIDENCE_LOW" };
  }

  // src/core/spotify/youtubeMusic.ts
  var import_youtubeMusic_runtime = __toESM(require_youtubeMusic_runtime());

  // src/core/platform/capacitor.ts
  var mediaPlugin = registerPlugin("SavewaveMedia");
  var CapacitorMediaEngine = class {
    getPlatform() {
      return "android";
    }
    async getCapabilities() {
      return parseCapabilities(await mediaPlugin.getCapabilities());
    }
    async getEngineStatus() {
      return parseEngineStatus(await mediaPlugin.getEngineStatus());
    }
    async getReleaseInfo() {
      return parseReleaseInfo(await mediaPlugin.getReleaseInfo());
    }
    async resolveMedia(url, mode = "video") {
      if (isUnavailableSource(detectSource(url), url)) throw new MediaEngineError("UNSUPPORTED_SOURCE");
      if (detectSource(url) !== "spotify") return parseResolvedMedia(await mediaPlugin.resolveMedia({ url: canonicalMediaUrl(url), mode }));
      const track = await mediaPlugin.getSpotifyMetadata({ url });
      const decision = await (0, import_search_runtime.resolveSpotifyDecision)(track, { search: async (stage) => {
        if (stage.filter === "generic") return (await mediaPlugin.searchCandidates({ query: stage.query })).results;
        try {
          const response = await mediaPlugin.searchYoutubeMusic({ query: stage.query, filter: stage.filter });
          return (0, import_youtubeMusic_runtime.parseYouTubeMusicResults)(response.payload, stage.filter);
        } catch {
          return [];
        }
      } });
      return parseResolvedMedia(spotifyResolvedMedia(track, decision));
    }
    async downloadMedia(request) {
      const input = parseDownloadRequest(request);
      if (isUnavailableSource(detectSource(input.url), input.url)) throw new MediaEngineError("UNSUPPORTED_SOURCE");
      return parseDownloadJob(await mediaPlugin.downloadMedia({ ...input, url: canonicalMediaUrl(input.url), policy: createDownloadPolicy(input.mode, detectSource(input.url)) }));
    }
    cancelDownload(jobId) {
      return mediaPlugin.cancelDownload({ jobId });
    }
    async getDownloadProgress(jobId) {
      return parseDownloadProgress(await mediaPlugin.getDownloadProgress({ jobId }));
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
      return { available: true, version: "1.0.14" };
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
    if (window.savewaveDesktop) return "desktop";
    if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android") return "android";
    return "web";
  }
  function createMediaEngine() {
    const runtime = detectRuntime();
    if (runtime === "web") return new WebMediaEngine();
    if (runtime === "android") {
      return new CapacitorMediaEngine();
    }
    return new ElectronMediaEngine();
  }

  // src/core/platform/external.ts
  var allowedExternalHosts = /* @__PURE__ */ new Set(["github.com", "kuberbassi.com", "www.kuberbassi.com"]);
  var androidLinks = registerPlugin("SavewaveMedia");
  async function openExternal(value) {
    const url = new URL(value);
    if (url.protocol !== "https:" || !allowedExternalHosts.has(url.hostname.toLowerCase())) throw new Error("External link is not allowed.");
    if (window.savewaveDesktop) {
      await window.savewaveDesktop.openExternal(url.toString());
      return;
    }
    if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android") {
      await androidLinks.openExternal({ url: url.toString() });
      return;
    }
    window.open(url.toString(), "_blank", "noopener,noreferrer");
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

  // src/core/spotify/choices.ts
  var STORAGE_KEY = "savewave:spotify-choices:v1";
  var TRACK_ID = /open\.spotify\.com\/track\/([A-Za-z0-9]{22})/;
  function spotifyTrackId(url) {
    return String(url || "").match(TRACK_ID)?.[1] || null;
  }
  function readChoices() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  function rememberSpotifyChoice(url, sourceUrl) {
    const trackId = spotifyTrackId(url);
    if (!trackId || !/^https:\/\/(?:www\.)?youtube\.com\/watch\?v=[A-Za-z0-9_-]+/.test(sourceUrl)) return;
    try {
      const choices = readChoices();
      const bounded = Object.fromEntries([...Object.entries(choices), [trackId, sourceUrl]].slice(-50));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(bounded));
    } catch {
    }
  }
  function recallSpotifyChoice(url, options) {
    const trackId = spotifyTrackId(url);
    if (!trackId) return null;
    const remembered = readChoices()[trackId];
    return options.find((option) => option.sourceUrl === remembered) || null;
  }

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
/*! Bundled license information:

@capacitor/core/dist/index.js:
  (*! Capacitor: https://capacitorjs.com/ - MIT License *)
*/
