const {
  version: BUNDLED_VERSION,
  platforms: PLATFORMS,
  releasesUrl: RELEASE_PAGE,
  tickerItems: TICKER_ITEMS
} = window.SavewaveConfig;
const OfficialIcon = ({
  name
}) => {
  const props = {
    className: `landing-official-icon icon-${name.toLowerCase()}`,
    viewBox: '0 0 24 24',
    fill: 'currentColor',
    'aria-hidden': true
  };
  if (name === 'YOUTUBE') return /*#__PURE__*/React.createElement("svg", props, /*#__PURE__*/React.createElement("path", {
    d: "M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"
  }));
  if (name === 'INSTAGRAM') return /*#__PURE__*/React.createElement("svg", props, /*#__PURE__*/React.createElement("path", {
    d: "M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919C8.417 2.175 8.796 2.163 12 2.163zm0 3.675a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zm0 10.162a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"
  }));
  if (name === 'SPOTIFY') return /*#__PURE__*/React.createElement("svg", props, /*#__PURE__*/React.createElement("path", {
    d: "M12 0C5.376 0 0 5.376 0 12s5.376 12 12 12 12-5.376 12-12S18.624 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141 4.38-1.319 9.78-.658 13.5 1.621.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.18-1.2-.18-1.38-.72-.18-.6.18-1.2.72-1.38 4.2-1.261 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.298z"
  }));
  if (name === 'SOUNDCLOUD') return /*#__PURE__*/React.createElement("svg", props, /*#__PURE__*/React.createElement("path", {
    d: "M23.999 14.165c-.052 1.796-1.612 3.169-3.4 3.169h-8.18a.68.68 0 0 1-.675-.683V7.862a.747.747 0 0 1 .452-.724s.75-.513 2.333-.513a5.364 5.364 0 0 1 2.763.755 5.433 5.433 0 0 1 2.57 3.54c.282-.08.574-.121.868-.12.884 0 1.73.358 2.347.992s.948 1.49.922 2.373ZM10.721 8.421c.247 2.98.427 5.697 0 8.672a.264.264 0 0 1-.53 0c-.395-2.946-.22-5.718 0-8.672a.264.264 0 0 1 .53 0ZM9.072 9.448c.285 2.659.37 4.986-.006 7.655a.277.277 0 0 1-.55 0c-.331-2.63-.256-5.02 0-7.655a.277.277 0 0 1 .556 0Zm-1.663-.257c.27 2.726.39 5.171 0 7.904a.266.266 0 0 1-.532 0c-.38-2.69-.257-5.21 0-7.904a.266.266 0 0 1 .532 0Zm-1.647.77a26.108 26.108 0 0 1-.008 7.147.272.272 0 0 1-.542 0 27.955 27.955 0 0 1 0-7.147.275.275 0 0 1 .55 0Zm-1.67 1.769c.421 1.865.228 3.5-.029 5.388a.257.257 0 0 1-.514 0c-.21-1.858-.398-3.549 0-5.389a.272.272 0 0 1 .543 0Zm-1.655-.273c.388 1.897.26 3.508-.01 5.412-.026.28-.514.283-.54 0-.244-1.878-.347-3.54-.01-5.412a.283.283 0 0 1 .56 0Zm-1.668.911c.4 1.268.257 2.292-.026 3.572a.257.257 0 0 1-.514 0c-.241-1.262-.354-2.312-.023-3.572a.283.283 0 0 1 .563 0Z"
  }));
  return /*#__PURE__*/React.createElement("svg", {
    ...props,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M13 2v7h7"
  }));
};
const DownloadButton = ({
  href,
  label,
  detail,
  primary = false
}) => /*#__PURE__*/React.createElement("a", {
  className: `landing-download btn-chamfer ${primary ? 'is-primary' : ''}`,
  href: href
}, /*#__PURE__*/React.createElement("span", null, label), /*#__PURE__*/React.createElement("small", null, detail));
const LandingPage = () => {
  const [windowsUrl, setWindowsUrl] = React.useState(RELEASE_PAGE);
  const [androidUrl, setAndroidUrl] = React.useState(RELEASE_PAGE);
  const [releaseNotesUrl, setReleaseNotesUrl] = React.useState(RELEASE_PAGE);
  const [appVersion, setAppVersion] = React.useState(BUNDLED_VERSION);
  const [summary, setSummary] = React.useState('Rust core rewrite, Spotify Matcher v2, Tauri v2 desktop, Native Kotlin Android, auto-updating yt-dlp.');
  React.useEffect(() => {
    fetch('/client-version.json', {
      cache: 'no-store'
    }).then(response => response.ok ? response.json() : Promise.reject()).then(release => {
      const downloadUrl = release.windowsDownloadUrl || release.downloadUrl;
      if (typeof downloadUrl === 'string' && downloadUrl.startsWith('https://github.com/')) setWindowsUrl(downloadUrl);
      if (typeof release.androidDownloadUrl === 'string' && release.androidDownloadUrl.startsWith('https://github.com/')) setAndroidUrl(release.androidDownloadUrl);
      if (typeof release.changelogUrl === 'string' && release.changelogUrl.startsWith('https://github.com/')) setReleaseNotesUrl(release.changelogUrl);
      if (/^\d+\.\d+\.\d+$/.test(release.version)) setAppVersion(release.version);
      if (typeof release.summary === 'string' && release.summary.trim()) setSummary(release.summary.trim());
    }).catch(() => {});
  }, []);
  return /*#__PURE__*/React.createElement("div", {
    className: "relative z-10 min-h-screen flex flex-col"
  }, /*#__PURE__*/React.createElement("div", {
    className: "rig-scanlines-bg"
  }), /*#__PURE__*/React.createElement("nav", {
    className: "relative z-20 border-b border-black/20 px-4 sm:px-6 md:px-12 py-4 md:py-5 flex items-center justify-between gap-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-3"
  }, /*#__PURE__*/React.createElement("img", {
    src: "savewave-dark.png",
    className: "w-9 h-9 squircle-logo",
    alt: "Savewave",
    width: "36",
    height: "36"
  }), /*#__PURE__*/React.createElement("span", {
    className: "font-bold tracking-tighter text-xl text-black"
  }, "SAVEWAVE"), /*#__PURE__*/React.createElement("span", {
    className: "hidden sm:inline-block font-mono text-[10px] font-bold tracking-widest bg-black/15 text-black px-2 py-0.5"
  }, "v", appVersion, " · RUST CORE")), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-3"
  }, /*#__PURE__*/React.createElement("a", {
    href: releaseNotesUrl,
    target: "_blank",
    rel: "noopener noreferrer",
    className: "hidden md:inline-block font-mono text-xs font-bold tracking-wider text-black/80 hover:text-black px-3 py-2"
  }, "RELEASE NOTES"), /*#__PURE__*/React.createElement("a", {
    href: "#download",
    className: "btn-chamfer bg-[#0d0d0e] text-white font-mono text-xs font-bold tracking-wider px-6 py-3"
  }, "GET THE APP"))), /*#__PURE__*/React.createElement("main", {
    className: "relative z-10 flex-1"
  }, /*#__PURE__*/React.createElement("section", {
    className: "max-w-6xl mx-auto px-4 sm:px-6 pt-12 md:pt-20 pb-14 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center"
  }, /*#__PURE__*/React.createElement("div", {
    className: "lg:col-span-6"
  }, /*#__PURE__*/React.createElement("div", {
    className: "inline-flex items-center gap-2 font-mono text-[11px] font-bold tracking-widest text-black/80 bg-black/10 px-3 py-1 mb-5"
  }, /*#__PURE__*/React.createElement("span", {
    className: "w-2 h-2 rounded-full bg-black"
  }), "RUST CORE · TAURI V2 · NATIVE KOTLIN"), /*#__PURE__*/React.createElement("h1", {
    className: "text-5xl md:text-6xl font-bold tracking-tight text-black leading-tight mb-6"
  }, "Paste. Resolve. Save.", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("span", {
    className: "opacity-80"
  }, "100% on your device.")), /*#__PURE__*/React.createElement("p", {
    className: "text-lg md:text-xl text-black/90 leading-relaxed max-w-xl mb-8"
  }, "One shared Rust engine powering native Windows and Android apps. No accounts, no cloud proxies, no tracking — and ", /*#__PURE__*/React.createElement("code", {
    className: "font-mono font-bold"
  }, "yt-dlp"), " updates itself automatically."), /*#__PURE__*/React.createElement("div", {
    id: "download",
    className: "landing-downloads"
  }, /*#__PURE__*/React.createElement(DownloadButton, {
    href: windowsUrl,
    label: "DOWNLOAD FOR WINDOWS",
    detail: "v2.0.0 · 49.6 MB · TAURI V2 EXE",
    primary: true
  }), /*#__PURE__*/React.createElement(DownloadButton, {
    href: androidUrl,
    label: "DOWNLOAD FOR ANDROID",
    detail: "v2.0.0 · 56.1 MB · KOTLIN ARM64 APK"
  })), /*#__PURE__*/React.createElement("div", {
    className: "flex flex-wrap items-center gap-4 mt-4 font-mono text-[10px] text-black/75"
  }, /*#__PURE__*/React.createElement("span", null, "Windows 10/11 (x64) · Auto-updating"), /*#__PURE__*/React.createElement("span", null, "•"), /*#__PURE__*/React.createElement("span", null, "Android 10+ (arm64) · Share-to-Savewave"), /*#__PURE__*/React.createElement("span", null, "•"), /*#__PURE__*/React.createElement("a", {
    href: releaseNotesUrl,
    target: "_blank",
    rel: "noopener noreferrer",
    className: "underline font-bold text-black hover:opacity-80"
  }, "v", appVersion, " Release Notes →"))), /*#__PURE__*/React.createElement("div", {
    className: "lg:col-span-6 paper-dark-texture border border-white/15 p-5 md:p-7 shadow-2xl btn-chamfer"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex justify-between items-center mb-6"
  }, /*#__PURE__*/React.createElement("span", {
    className: "font-mono text-[10px] tracking-widest text-[#e03d27] font-bold border border-[#e03d27]/40 px-2.5 py-1"
  }, "SUPPORTED SOURCES"), /*#__PURE__*/React.createElement("span", {
    className: "font-mono text-[10px] text-emerald-400 font-bold"
  }, "AUTO DETECT · LOCAL")), /*#__PURE__*/React.createElement("div", {
    className: "platform-grid mb-6"
  }, PLATFORMS.map(({
    name,
    label,
    capability
  }) => /*#__PURE__*/React.createElement("div", {
    className: "platform-card card-hover-lift",
    key: name
  }, /*#__PURE__*/React.createElement(OfficialIcon, {
    name: name
  }), /*#__PURE__*/React.createElement("strong", {
    className: "font-mono text-[10px] text-white"
  }, label), /*#__PURE__*/React.createElement("small", {
    className: "font-mono text-[7px] text-[#e03d27] tracking-wider mt-1"
  }, capability)))), /*#__PURE__*/React.createElement("p", {
    className: "text-center font-mono text-[11px] text-zinc-400 border-t border-white/10 pt-4"
  }, summary))), /*#__PURE__*/React.createElement("div", {
    className: "relative z-10 bg-black text-white py-3.5 border-y border-white/10 overflow-hidden font-mono text-xs tracking-widest uppercase"
  }, /*#__PURE__*/React.createElement("div", {
    className: "landing-marquee-track",
    "aria-label": TICKER_ITEMS.join(', ')
  }, [0, 1].map(copy => /*#__PURE__*/React.createElement("div", {
    className: "landing-marquee-group",
    "aria-hidden": copy === 1,
    key: copy
  }, TICKER_ITEMS.map(item => /*#__PURE__*/React.createElement(React.Fragment, {
    key: item
  }, /*#__PURE__*/React.createElement("span", null, item), /*#__PURE__*/React.createElement("b", {
    "aria-hidden": "true"
  }, "•"))))))), /*#__PURE__*/React.createElement("section", {
    className: "paper-dark-texture text-white border-b border-white/10"
  }, /*#__PURE__*/React.createElement("div", {
    className: "max-w-6xl mx-auto px-6 py-10 grid grid-cols-2 md:grid-cols-4 gap-6 text-center font-mono"
  }, [['-72.6%', 'SMALLER WINDOWS EXE', '181 MB → 49.6 MB'], ['100%', 'SPOTIFY MATCH RATE', '2.3× – 3.5× faster'], ['24H', 'AUTO YT-DLP UPDATES', 'Self-maintaining'], ['0 KB', 'CLOUD STORAGE', '100% on-device']].map(([stat, label, sub]) => /*#__PURE__*/React.createElement("div", {
    key: label,
    className: "bg-[#0d0d0e] border border-white/10 p-5 btn-chamfer"
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-3xl md:text-4xl font-bold text-[#e03d27]"
  }, stat), /*#__PURE__*/React.createElement("div", {
    className: "text-[11px] font-bold tracking-widest text-white mt-2"
  }, label), /*#__PURE__*/React.createElement("div", {
    className: "text-[10px] text-zinc-500 mt-1"
  }, sub))))), /*#__PURE__*/React.createElement("section", {
    className: "paper-dark-texture text-white border-b border-white/10"
  }, /*#__PURE__*/React.createElement("div", {
    className: "max-w-6xl mx-auto px-6 py-10 grid grid-cols-1 sm:grid-cols-3 gap-8 text-center"
  }, [['01', 'INSTALL', 'Install the native Rust-powered Windows or Android app once.'], ['02', 'PASTE OR SHARE', 'Paste any link or share directly from YouTube, Spotify, or Instagram.'], ['03', 'SAVE', 'Preview and save best available video, audio, or direct media locally.']].map(([n, t, d]) => /*#__PURE__*/React.createElement("div", {
    key: n
  }, /*#__PURE__*/React.createElement("span", {
    className: "font-mono text-[#e03d27] text-xs"
  }, n), /*#__PURE__*/React.createElement("h2", {
    className: "font-mono font-bold tracking-widest my-2"
  }, t), /*#__PURE__*/React.createElement("p", {
    className: "text-zinc-400 text-sm"
  }, d))))), /*#__PURE__*/React.createElement("section", {
    className: "paper-dark-texture text-white border-t border-white/10 px-5 py-14"
  }, /*#__PURE__*/React.createElement("div", {
    className: "max-w-6xl mx-auto"
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-center mb-8"
  }, /*#__PURE__*/React.createElement("span", {
    className: "font-mono text-[10px] tracking-widest text-[#e03d27]"
  }, "PRIVACY BY ARCHITECTURE"), /*#__PURE__*/React.createElement("h2", {
    className: "text-3xl font-bold mt-2"
  }, "Your media never touches a server.")), /*#__PURE__*/React.createElement("div", {
    className: "privacy-grid"
  }, [['RUST CORE ENGINE', 'Source detection, Spotify Matcher v2, and URL safety run natively in Rust on your device.'], ['AUTO-UPDATING YT-DLP', 'Both Windows and Android silently update yt-dlp every 24h in the background.'], ['DIRECT MEDIA SUPPORT', 'Direct .mp4, .mp3, .png, .jpg, and .webp links stream natively without extra hops.'], ['ON-DEVICE INSTAGRAM AUTH', 'If Instagram asks for login on a Reel, cookies stay strictly on your device.'], ['NO ACCOUNTS OR CLOUD', 'Zero user database, zero telemetry, zero remote download history.'], ['OPEN SOURCE & VERIFIED', 'GitHub Releases with SHA-256 checksum verification for Windows updates.']].map(([title, copy]) => /*#__PURE__*/React.createElement("article", {
    className: "privacy-card",
    key: title
  }, /*#__PURE__*/React.createElement("h3", {
    className: "font-mono text-xs font-bold tracking-wider text-white mb-3"
  }, title), /*#__PURE__*/React.createElement("p", {
    className: "text-sm text-zinc-400 leading-relaxed"
  }, copy))))))), /*#__PURE__*/React.createElement("footer", {
    className: "relative z-10 bg-[#08080a] border-t border-white/10 px-6 py-8 text-center font-mono text-xs text-zinc-400"
  }, "© 2026 SAVEWAVE · v", appVersion, " · RUST CORE ·", ' ', /*#__PURE__*/React.createElement("a", {
    className: "text-white hover:opacity-80 transition-opacity",
    href: releaseNotesUrl
  }, "RELEASE NOTES"), " ·", ' ', /*#__PURE__*/React.createElement("a", {
    className: "text-white hover:opacity-80 transition-opacity",
    href: "https://github.com/kuberbassi/savewave"
  }, "GITHUB"), " ·", ' ', /*#__PURE__*/React.createElement("a", {
    className: "text-white hover:opacity-80 transition-opacity",
    href: "https://kuberbassi.com"
  }, "KUBERBASSI.COM")));
};
ReactDOM.createRoot(document.getElementById('root')).render(/*#__PURE__*/React.createElement(LandingPage, null));
