"use strict";
var SavewaveCore = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
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
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

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
    confidentMatch: () => confidentMatch,
    createMediaEngine: () => createMediaEngine,
    detectRuntime: () => detectRuntime,
    detectSource: () => detectSource,
    equivalentToken: () => equivalentToken,
    listHistory: () => listHistory,
    mediaFilename: () => mediaFilename,
    normalize: () => normalize,
    normalizeError: () => normalizeError,
    normalizeUrl: () => normalizeUrl,
    openExternal: () => openExternal,
    removeHistory: () => removeHistory,
    sanitizeFilename: () => sanitizeFilename,
    scoreCandidate: () => scoreCandidate,
    supports: () => supports,
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
    return mode === "audio" ? ["-f", "bestaudio/best", "--extract-audio", "--audio-format", "best"] : ["-f", "bestvideo*+bestaudio/best", "--merge-output-format", "mp4/mkv"];
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
  function titleCoverage(expected, candidate) {
    const target = [...new Set(expected.split(" ").filter(Boolean))];
    const actual = candidate.split(" ").filter(Boolean);
    return target.length ? target.filter((token) => actual.some((value) => equivalentToken(token, value))).length / target.length : 0;
  }
  function creditedArtists(track) {
    return Array.from(new Set([track.primaryArtist, ...track.artists || []].map(normalize).filter(Boolean)));
  }
  function authoritativeOwner(track, candidate) {
    const owner = normalize(candidate.uploader || "");
    return creditedArtists(track).some((artist) => owner === artist || owner === `${artist} topic` || owner === `${artist} vevo`);
  }
  function corroboratesSameRecording(track, first, second) {
    const firstOwner = normalize(first.uploader || "");
    const secondOwner = normalize(second.uploader || "");
    if (!firstOwner || !secondOwner || firstOwner === secondOwner) return false;
    if (!track.duration || !first.duration || !second.duration) return false;
    if (Math.abs(track.duration - first.duration) > 3 || Math.abs(track.duration - second.duration) > 3) return false;
    const artists = creditedArtists(track);
    const firstIdentity = normalize(`${first.title} ${first.artist || ""}`);
    const secondIdentity = normalize(`${second.title} ${second.artist || ""}`);
    const title = normalize(canonicalTitle(track.title));
    if (!normalize(canonicalTitle(first.title)).includes(title) || !normalize(canonicalTitle(second.title)).includes(title)) return false;
    const primary = artists[0];
    if (!primary || !firstIdentity.includes(primary) || !secondIdentity.includes(primary)) return false;
    const expectedVersions = versionMarkers(track.title);
    const firstVersions = versionMarkers(first.title).filter((marker) => !expectedVersions.includes(marker));
    const secondVersions = versionMarkers(second.title).filter((marker) => !expectedVersions.includes(marker));
    return firstVersions.length === 0 && secondVersions.length === 0;
  }
  function scoreCandidate(track, candidate) {
    if (track.isrc && candidate.isrc) return track.isrc === candidate.isrc ? 150 : -100;
    let score = 0;
    const title = normalize(canonicalTitle(track.title));
    const candidateTitle = normalize(canonicalTitle(candidate.title));
    const identity = normalize(`${candidate.title} ${candidate.artist || ""} ${candidate.uploader || ""}`);
    if (title === candidateTitle) score += 40;
    else if (candidateTitle.includes(title) || titleCoverage(title, candidateTitle) >= 0.8) score += 28;
    else score -= 60;
    const primary = normalize(track.primaryArtist);
    if (primary && identity.includes(primary)) score += 40;
    else if (track.artists.some((artist) => identity.includes(normalize(artist)))) score += 25;
    else score -= 70;
    if (track.duration && candidate.duration) {
      const difference = Math.abs(track.duration - candidate.duration);
      score += difference <= 2 ? 20 : difference <= 7 ? 10 : difference > 20 ? -70 : -30;
    }
    if (track.album && candidate.album && normalize(track.album) === normalize(candidate.album)) score += 8;
    if (authoritativeOwner(track, candidate)) score += 18;
    const artists = creditedArtists(track);
    if (artists.length > 1 && artists.every((artist) => identity.includes(artist))) score += 8;
    const expectedVersions = versionMarkers(track.title);
    if (versionMarkers(candidate.title).some((marker) => !expectedVersions.includes(marker))) score -= 70;
    return score;
  }
  function confidentMatch(track, candidates) {
    const ranked = candidates.map((candidate) => ({ candidate, score: scoreCandidate(track, candidate) })).sort((a, b) => b.score - a.score);
    const best = ranked[0];
    const runnerUp = ranked[1];
    if (!best || best.score < 80) return null;
    if (!runnerUp || best.score - runnerUp.score >= 5) return best;
    const exactTitle = normalize(canonicalTitle(best.candidate.title)) === normalize(canonicalTitle(track.title));
    const durationClose = !track.duration || !best.candidate.duration || Math.abs(track.duration - best.candidate.duration) <= 3;
    if (exactTitle && durationClose && authoritativeOwner(track, best.candidate)) return best;
    return corroboratesSameRecording(track, best.candidate, runnerUp.candidate) ? best : null;
  }

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
      const candidates = await invoke("search_spotify_candidates", { title: track.title, artist: track.primaryArtist });
      const match = confidentMatch(track, candidates);
      if (!match) throw { code: "MATCH_CONFIDENCE_LOW" };
      const source = match.candidate;
      return { success: true, platform: "spotify", title: track.title, creator: track.artists.join(", "), thumbnail: track.thumbnail, duration: track.duration, type: "audio", qualityLabel: "Verified high-confidence match", sourceUrl: source.sourceUrl };
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
  var CURRENT_VERSION = "1.0.8";
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
    resolveMedia(url, mode = "video") {
      return command("resolveMedia", { request: { url, mode } });
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
      return { available: true, version: "1.0.8" };
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
