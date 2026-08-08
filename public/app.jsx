const { useState, useEffect, useRef } = React;

const HISTORY_STORAGE_KEY = 'savewave_local_history';
const HISTORY_STORAGE_LIMIT = 50;
const HISTORY_PAGE_SIZE = 8;
const RESOLVE_TIMEOUT_MS = 30000;

const SUPPORTED_PLATFORMS = [
  { name: 'YOUTUBE', label: 'YouTube', capability: 'VIDEO + AUDIO', title: 'YouTube videos, Shorts, and audio' },
  { name: 'INSTAGRAM', label: 'Instagram', capability: 'REELS + POSTS', title: 'Public Instagram Reels, posts, and carousels' },
  { name: 'FACEBOOK', label: 'Facebook', capability: 'VIDEO + REELS', title: 'Public Facebook videos, Reels, and post media' },
  { name: 'TWITTER', label: 'X', capability: 'VIDEO + IMAGES', title: 'X public videos and images' },
  { name: 'SOUNDCLOUD', label: 'SoundCloud', capability: 'AUDIO', title: 'SoundCloud public audio tracks' },
  { name: 'SPOTIFY', label: 'Spotify', capability: 'SMART MATCH', title: 'Spotify metadata matched to available audio' },
  { name: 'DIRECT', label: 'Direct Media', capability: 'VIDEO + AUDIO + IMAGES', title: 'Direct MP4, WebM, MP3, WAV, JPG, PNG, and WebP links' }
];

// Custom Brutalist Dialogue Modal Component
const BrutalistModal = ({ isOpen, title, message, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" role="presentation">
      <div className="paper-dark-texture border-2 border-[#e03d27] p-6 max-w-md w-full shadow-2xl btn-chamfer animate-in fade-in zoom-in-95 duration-200" role="alertdialog" aria-modal="true" aria-labelledby="notice-title">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-2.5 h-2.5 bg-[#e03d27] rounded-full animate-pulse"></span>
          <span id="notice-title" className="font-mono text-xs uppercase tracking-widest text-[#e03d27] font-bold">
            {title || 'SYSTEM NOTICE'}
          </span>
        </div>

        <p className="font-mono text-xs text-zinc-200 leading-relaxed mb-6">
          {message}
        </p>

        <button
          onClick={onClose}
          className="btn-chamfer font-mono text-xs uppercase font-bold bg-[#e03d27] text-white hover:bg-[#b82a17] w-full py-3 px-4 border border-white/20 transition-all cursor-pointer"
        >
          ACKNOWLEDGE
        </button>
      </div>
    </div>
  );
};

// Reusable Official SVG Platform Icons
const PlatformIcon = ({ name, className = "w-5 h-5" }) => {
  switch (name) {
    case 'YOUTUBE':
      return (
        <svg className={`${className} text-red-500`} viewBox="0 0 24 24" fill="currentColor">
          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
        </svg>
      );
    case 'SPOTIFY':
      return (
        <svg className={`${className} text-emerald-500`} viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0C5.376 0 0 5.376 0 12s5.376 12 12 12 12-5.376 12-12S18.624 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141 C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.18-.1.2-1.02-.36-.18-.6.36-1.02 1.02-1.2 4.2-1.261 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
        </svg>
      );
    case 'INSTAGRAM':
      return (
        <svg className={`${className} text-pink-500`} viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
        </svg>
      );
    case 'TWITTER':
      return (
        <svg className={`${className} text-white`} viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      );
    case 'SOUNDCLOUD':
      return (
        <svg className={`${className} text-orange-500`} viewBox="0 0 24 24" fill="currentColor">
          <path d="M1.175 12.225c-.05 0-.087.038-.1.088l-.512 3.125.512 3.1c.013.05.05.088.1.088.037 0 .075-.038.087-.088l.6-3.1-.6-3.125c-.012-.05-.05-.088-.087-.088zm2.038-1.587c-.05 0-.088.037-.1.087l-.538 4.712.538 4.675c.012.05.05.088.1.088.05 0 .087-.038.1-.088l.625-4.675-.625-4.712c-.013-.05-.05-.087-.1-.087zm2.112-.763c-.05 0-.087.038-.1.088l-.55 5.475.55 5.425c.013.05.05.088.1.088s.088-.038.1-.088l.638-5.425-.638-5.475c-.012-.05-.05-.088-.1-.088zm2.125-.975c-.05 0-.087.038-.1.088l-.55 6.45.55 6.375c.013.05.05.088.1.088s.088-.038.1-.088l.65-6.375-.65-6.45c-.012-.05-.05-.088-.1-.088zm2.138-.85c-.05 0-.088.038-.1.088l-.538 7.3.538 7.212c.012.05.05.088.1.088s.087-.038.1-.088l.65-7.212-.65-7.3c-.013-.05-.05-.088-.1-.088zm2.462-1.375c-.675 0-1.312.2-1.85.55-.062.038-.087.088-.075.138l.45 8.012-.45 7.825c-.012.05.013.1.075.125.175.1.375.163.587.213.375.075.762.112 1.163.112 3.65 0 6.612-2.875 6.775-6.488.925.075 1.837-.238 2.525-.863s1.075-1.525 1.075-2.462c0-1.887-1.475-3.437-3.362-3.525-.65-1.925-2.463-3.275-4.538-3.275z" />
        </svg>
      );
    case 'DRIVE':
      return (
        <img src="https://img.icons8.com/?size=100&id=eKDChMKt75eu&format=png&color=000000" className={className} alt="Google Drive" />
      );
    case 'DROPBOX':
      return (
        <svg className={`${className} text-blue-400`} viewBox="0 0 24 24" fill="currentColor">
          <path d="M6 2l6 3.927L6 9.854 0 5.927 6 2zm12 0l6 3.927-6 3.927-6-3.927L18 2zM0 13.78l6-3.927 6 3.927-6 3.927-6-3.927zm24 0l-6-3.927-6 3.927 6 3.927 6-3.927zM6 19.162l6-3.927 6 3.927-6 3.927-6-3.927z" />
        </svg>
      );
    case 'FACEBOOK':
      return (
        <svg className={`${className} text-blue-500`} viewBox="0 0 24 24" fill="currentColor">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
      );
    case 'THREADS':
      return (
        <svg className={`${className} text-white`} viewBox="0 0 16 16" fill="currentColor">
          <path d="M6.321 6.016c-.27-.18-1.166-.802-1.166-.802.756-1.081 1.753-1.502 3.132-1.502.975 0 1.803.327 2.394.948s.928 1.509 1.005 2.644q.492.207.905.484c1.109.745 1.719 1.86 1.719 3.137 0 2.716-2.226 5.075-6.256 5.075C4.594 16 1 13.987 1 7.994 1 2.034 4.482 0 8.044 0 9.69 0 13.55.243 15 5.036l-1.36.353C12.516 1.974 10.163 1.43 8.006 1.43c-3.565 0-5.582 2.171-5.582 6.79 0 4.143 2.254 6.343 5.63 6.343 2.777 0 4.847-1.443 4.847-3.556 0-1.438-1.208-2.127-1.27-2.127-.236 1.234-.868 3.31-3.644 3.31-1.618 0-3.013-1.118-3.013-2.582 0-2.09 1.984-2.847 3.55-2.847.586 0 1.294.04 1.663.114 0-.637-.54-1.728-1.9-1.728-1.25 0-1.566.405-1.967.868ZM8.716 8.19c-2.04 0-2.304.87-2.304 1.416 0 .878 1.043 1.168 1.6 1.168 1.02 0 2.067-.282 2.232-2.423a6.2 6.2 0 0 0-1.528-.161" />
        </svg>
      );
    case 'GITHUB':
      return (
        <svg className={`${className} text-white hover:text-zinc-300 transition-colors`} viewBox="0 0 24 24" fill="currentColor">
          <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
        </svg>
      );
    case 'WEBSITE':
      return (
        <svg className={`${className} text-white hover:text-zinc-300 transition-colors`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="2" y1="12" x2="22" y2="12"></line>
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
        </svg>
      );
    case 'DIRECT':
      return (
        <svg className={`${className} text-zinc-300`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z"></path>
          <polyline points="13 2 13 9 20 9"></polyline>
        </svg>
      );
    default:
      return (
        <svg className={`${className} text-zinc-400`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2v20M2 12h20" />
        </svg>
      );
  }
};

// Reusable RIG Button
const RigButton = ({ children, onClick, variant = 'primary', className = '', type = 'button', disabled = false }) => {
  const baseStyle = "btn-chamfer font-mono text-xs uppercase tracking-wider font-bold py-3 px-6 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed";

  const variants = {
    primary: "bg-[#0d0d0e] text-white hover:bg-[#1a1a1d] border border-black/20",
    red: "bg-[#e03d27] text-white hover:bg-[#b82a17] border border-white/20",
    outline: "bg-transparent text-white border border-white/40 hover:bg-white/10",
    white: "bg-white text-[#0d0d0e] hover:bg-zinc-200"
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${baseStyle} ${variants[variant] || variants.primary} ${className}`}
    >
      {children}
    </button>
  );
};

// Reusable RIG Card Component
const RigCard = ({ children, className = '' }) => {
  return (
    <div className={`paper-dark-texture border border-white/10 p-6 md:p-8 shadow-2xl relative overflow-hidden ${className}`}>
      {children}
    </div>
  );
};

const PlatformCard = ({ platform }) => (
  <div title={platform.title} className="platform-card card-hover-lift" aria-label={`${platform.label}: ${platform.capability}`}>
    <PlatformIcon name={platform.name} className="w-6 h-6 mb-2" />
    <span className="font-mono font-bold text-[10px] text-white">{platform.label}</span>
    <span className="font-mono text-[7px] text-[#e03d27] tracking-wider mt-1">{platform.capability}</span>
  </div>
);

// Main Savewave Application
const SavewaveApp = () => {
  const [activeTab, setActiveTab] = useState('downloader');
  const [url, setUrl] = useState('');
  const [platformInfo, setPlatformInfo] = useState(null);
  const [mode, setMode] = useState('video'); // 'video' | 'audio'
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [mediaInfo, setMediaInfo] = useState(null);
  const [clientHistory, setClientHistory] = useState([]);
  const [visibleHistoryCount, setVisibleHistoryCount] = useState(HISTORY_PAGE_SIZE);

  // Modal dialog state
  const [modalConfig, setModalConfig] = useState({ isOpen: false, title: '', message: '' });

  const mainContentRef = useRef(null);

  const navigateToTab = (tabName) => {
    setActiveTab(tabName);
    if (tabName === 'history') setVisibleHistoryCount(HISTORY_PAGE_SIZE);
    if (mainContentRef.current) {
      mainContentRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const scrollToDownloader = () => {
    navigateToTab('downloader');
  };

  const showAlert = (message, title = 'SYSTEM NOTICE') => {
    setModalConfig({ isOpen: true, title, message });
  };

  const closeModal = () => {
    setModalConfig(prev => ({ ...prev, isOpen: false }));
  };

  // Load local history
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(HISTORY_STORAGE_KEY) || '[]');
      if (Array.isArray(stored)) setClientHistory(stored.slice(0, HISTORY_STORAGE_LIMIT));
    } catch (e) { }
  }, []);

  const saveToLocalHistory = (item) => {
    try {
      setClientHistory((current) => {
        const updated = [item, ...current].slice(0, HISTORY_STORAGE_LIMIT);
        localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated));
        return updated;
      });
    } catch (e) { }
  };

  const clearLocalHistory = () => {
    setClientHistory([]);
    localStorage.removeItem(HISTORY_STORAGE_KEY);
    setVisibleHistoryCount(HISTORY_PAGE_SIZE);
  };

  const clearInput = () => {
    setUrl('');
    setPlatformInfo(null);
    setMediaInfo(null);
  };

  // Live platform detection
  const handleUrlChange = (val) => {
    setUrl(val);
    if (!val) {
      setPlatformInfo(null);
      return;
    }
    const lower = val.toLowerCase();
    if (lower.includes('spotify.com')) {
      setPlatformInfo({ name: 'SPOTIFY MATCH', icon: 'SPOTIFY', isAudioOnly: true });
      setMode('audio');
    } else if (lower.includes('soundcloud.com')) {
      setPlatformInfo({ name: 'SOUNDCLOUD', icon: 'SOUNDCLOUD', isAudioOnly: true });
      setMode('audio');
    } else if (lower.includes('youtube.com') || lower.includes('youtu.be')) {
      setPlatformInfo({ name: 'YOUTUBE', icon: 'YOUTUBE' });
    } else if (lower.includes('instagram.com')) {
      setPlatformInfo({ name: 'INSTAGRAM', icon: 'INSTAGRAM' });
    } else if (lower.includes('facebook.com') || lower.includes('fb.watch')) {
      setPlatformInfo({ name: 'FACEBOOK', icon: 'FACEBOOK' });
    } else if (lower.includes('threads.net')) {
      setPlatformInfo({ name: 'THREADS', icon: 'THREADS' });
    } else if (lower.includes('twitter.com') || lower.includes('x.com')) {
      setPlatformInfo({ name: 'X / TWITTER', icon: 'TWITTER' });
    } else {
      setPlatformInfo({ name: 'DIRECT MEDIA', icon: 'DIRECT' });
    }
  };

  // Resolve media link
  const handleResolve = async (e) => {
    if (e) e.preventDefault();
    if (!url) return;
    setLoading(true);
    setMediaInfo(null);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), RESOLVE_TIMEOUT_MS);

    try {
      const res = await fetch('/api/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), mode }),
        signal: controller.signal
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        showAlert(data.error, 'EXTRACTION FAILURE');
        return;
      }
      setMediaInfo(data);
    } catch (err) {
      const message = err.name === 'AbortError'
        ? 'The resolver took too long. Please retry in a moment.'
        : 'Failed to resolve this media. Check the link and your connection.';
      showAlert(message, 'EXTRACTION ERROR');
    } finally {
      clearTimeout(timeout);
      setLoading(false);
    }
  };

  // Download trigger
  const triggerBrowserDownload = () => {
    if (!mediaInfo || downloading) return;

    setDownloading(true);
    setDownloadProgress(10);

    const interval = setInterval(() => {
      setDownloadProgress((prev) => {
        if (prev >= 90) {
          clearInterval(interval);
          return 90;
        }
        return prev + 20;
      });
    }, 150);

    let streamMode = mode === 'audio' ? 'mp3' : 'mp4';
    let fileExt = streamMode;

    if (mediaInfo && mediaInfo.filename && mediaInfo.filename.includes('.')) {
      const parsedExt = mediaInfo.filename.split('.').pop().toLowerCase();
      if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'].includes(parsedExt)) {
        fileExt = parsedExt;
      }
    }

    const targetUrl = (mediaInfo.download && mediaInfo.download.directUrl) || mediaInfo.directUrl || url;
    const downloadFilename = mediaInfo.filename || `${mediaInfo.title}.${fileExt}`;
    const downloadUrl = `/api/stream?url=${encodeURIComponent(targetUrl)}&mode=${fileExt}&title=${encodeURIComponent(mediaInfo.title)}`;

    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = downloadFilename;
    document.body.appendChild(a);
    a.click();
    a.remove();

    setTimeout(() => {
      clearInterval(interval);
      setDownloadProgress(100);
      setTimeout(() => {
        setDownloading(false);
        setDownloadProgress(0);
      }, 600);
    }, 1200);

    saveToLocalHistory({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: mediaInfo.title,
      uploader: mediaInfo.uploader,
      mode: mode,
      timestamp: new Date().toLocaleString()
    });
  };

  return (
    <div className="relative z-10 min-h-screen flex flex-col justify-between">
      <div className="rig-scanlines-bg"></div>

      {/* Custom Dialogue Modal */}
      <BrutalistModal
        isOpen={modalConfig.isOpen}
        title={modalConfig.title}
        message={modalConfig.message}
        onClose={closeModal}
      />

      {/* Top Navbar */}
      <nav className="relative z-20 border-b border-black/20 px-4 sm:px-6 md:px-12 py-4 md:py-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <img src="savewave-dark.png" className="w-9 h-9 squircle-logo" alt="Savewave logo" width="36" height="36" decoding="async" />
          <span className="font-bold tracking-tighter text-lg sm:text-xl text-black">SAVEWAVE</span>
        </div>

        <div className="hidden md:flex items-center gap-8 font-mono text-xs uppercase tracking-widest text-black/80 font-semibold">
          <button onClick={() => navigateToTab('downloader')} className={`nav-link-item ${activeTab === 'downloader' ? 'active-nav text-black' : ''}`}>Downloader</button>
          <button onClick={() => navigateToTab('history')} className={`nav-link-item ${activeTab === 'history' ? 'active-nav text-black' : ''}`}>Local History</button>
          <button onClick={() => navigateToTab('privacy')} className={`nav-link-item ${activeTab === 'privacy' ? 'active-nav text-black' : ''}`}>Privacy</button>
        </div>

        <RigButton variant="primary" className="px-4 sm:px-6" onClick={() => navigateToTab('downloader')}>
          OPEN APP
        </RigButton>
      </nav>

      <div className="mobile-tabs relative z-20 md:hidden" aria-label="Application sections">
        {['downloader', 'history', 'privacy'].map((tab) => (
          <button key={tab} type="button" onClick={() => navigateToTab(tab)} className={activeTab === tab ? 'is-active' : ''} aria-current={activeTab === tab ? 'page' : undefined}>
            {tab === 'history' ? 'History' : tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* HERO SECTION */}
      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 pt-9 md:pt-12 pb-10 md:pb-12 w-full grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">

        {/* Hero Left Content */}
        <div className="lg:col-span-6 flex flex-col justify-center">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-black leading-tight mb-5 md:mb-6">
            Paste. Resolve. Save.<br />
            <span className="opacity-90">No accounts. No storage.</span>
          </h1>
          <p className="text-base sm:text-lg md:text-xl font-normal text-black/90 max-w-xl leading-relaxed mb-7 md:mb-8">
            Paste a supported media link. Savewave detects the source, resolves the best available media, and sends it to your browser. Nothing is stored.
          </p>

          <div className="flex flex-wrap items-center gap-4">
            <RigButton variant="primary" className="text-sm py-4 px-8" onClick={() => navigateToTab('downloader')}>
              OPEN SAVEWAVE
            </RigButton>
            <RigButton variant="outline" className="text-sm py-4 px-8 border-black/40 text-black hover:bg-black/10" onClick={() => navigateToTab('history')}>
              LOCAL HISTORY
            </RigButton>
          </div>
        </div>

        {/* HERO RIGHT PANEL: CLEAN SUPPORTED SOURCES VISUAL GRID (4x2 Rebalanced Grid) */}
        <div className="lg:col-span-6">
          <div className="paper-dark-texture border border-white/15 p-5 md:p-7 shadow-2xl btn-chamfer">

            <div className="flex justify-between items-center mb-6">
              <span className="font-mono text-[10px] uppercase tracking-widest text-[#e03d27] font-bold border border-[#e03d27]/40 px-2.5 py-0.5 bg-[#e03d27]/10">
                SUPPORTED SOURCES
              </span>
              <span className="font-mono text-[10px] text-zinc-500 font-semibold">AUTO DETECT</span>
            </div>

            <div className="platform-grid mb-6">
              {SUPPORTED_PLATFORMS.map((platform) => <PlatformCard key={platform.name} platform={platform} />)}
            </div>

            <p className="text-center font-mono text-[11px] text-zinc-400 border-t border-white/10 pt-4">
              Paste any supported media link. Savewave detects the source automatically.
            </p>
          </div>
        </div>

      </div>

      {/* REFINED PRODUCT PROPERTIES TICKER BAR */}
      <div className="relative z-10 bg-black text-white py-3.5 border-y border-white/10 overflow-hidden font-mono text-xs tracking-widest uppercase my-4">
        <div className="animate-marquee whitespace-nowrap flex gap-12">
          <span>BEST AVAILABLE QUALITY</span> • <span>ZERO DATABASE</span> • <span>NO MEDIA STORAGE</span> • <span>LOCAL HISTORY</span> • <span>AUTOMATIC SOURCE DETECTION</span> • <span>DIRECT DOWNLOADS</span>
          <span>BEST AVAILABLE QUALITY</span> • <span>ZERO DATABASE</span> • <span>NO MEDIA STORAGE</span> • <span>LOCAL HISTORY</span> • <span>AUTOMATIC SOURCE DETECTION</span> • <span>DIRECT DOWNLOADS</span>
        </div>
      </div>

      {/* MAIN APP TABS / ACTUAL FUNCTIONAL TOOL */}
      <main ref={mainContentRef} className="relative z-10 paper-dark-texture border-t border-white/10 pt-8 md:pt-12 pb-16 md:pb-24 px-3 sm:px-6 md:px-12 flex-1 scroll-mt-12">
        <div key={`tab-${activeTab}`} className="max-w-5xl mx-auto tab-page-transition">

          {/* ACTUAL WORKING DOWNLOADER SECTION */}
          {activeTab === 'downloader' && (
            <RigCard>
              <div className="flex justify-between items-center mb-4">
                <span className="font-mono text-xs uppercase tracking-widest text-zinc-400 font-semibold">
                  UNIVERSAL MEDIA RESOLVER
                </span>
                <span className="font-mono text-xs text-[#e03d27] font-bold">
                  {platformInfo ? platformInfo.name : 'PASTE MEDIA LINK'}
                </span>
              </div>

              {/* INPUT FORM */}
              <form onSubmit={handleResolve}>
                <div className="flex flex-col md:flex-row gap-3">
                  <div className="relative flex-1">
                    <input
                      type="url"
                      required
                      value={url}
                      onChange={(e) => handleUrlChange(e.target.value)}
                      placeholder="Paste a supported media link"
                      aria-label="Media URL"
                      autoComplete="url"
                      inputMode="url"
                      className="w-full bg-[#0d0d0e] border border-white/20 text-white placeholder-zinc-500 font-mono text-sm p-4 md:pr-64 outline-none focus:border-[#e03d27] transition-all"
                    />

                    {/* Input Actions */}
                    <div className="mt-2 md:mt-0 md:absolute md:right-4 md:top-1/2 md:-translate-y-1/2 flex flex-wrap justify-end items-center gap-2">
                      {url && (
                        <button
                          type="button"
                          onClick={clearInput}
                          className="text-zinc-400 hover:text-white bg-white/10 hover:bg-white/20 px-2 py-1 font-mono text-xs uppercase tracking-wider transition-colors flex items-center gap-1"
                        >
                          ✕ <span className="hidden sm:inline">CLEAR</span>
                        </button>
                      )}

                      {platformInfo && (
                        <span className="flex items-center gap-1.5 bg-[#e03d27]/20 border border-[#e03d27]/40 text-[#e03d27] px-2.5 py-1 text-xs font-mono select-none">
                          <PlatformIcon name={platformInfo.icon} />
                          {platformInfo.name}
                        </span>
                      )}
                    </div>
                  </div>

                  <RigButton variant="red" type="submit" disabled={loading} className="py-4 px-8 shrink-0">
                    {loading ? <div className="rig-spinner"></div> : 'RESOLVE'}
                  </RigButton>
                </div>
              </form>

              {/* Mode Toggle */}
              {platformInfo && platformInfo.isAudioOnly ? (
                <div className="bg-[#0d0d0e] py-3.5 px-4 border border-white/10 mt-6 font-mono text-xs uppercase text-center text-[#e03d27] font-bold flex items-center justify-center gap-2">
                  <PlatformIcon name={platformInfo.icon} />
                  <span>AUDIO ONLY SOURCE DETECTED</span>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 bg-[#0d0d0e] p-1.5 border border-white/10 mt-6 font-mono text-xs uppercase">
                  <button
                    type="button"
                    onClick={() => setMode('video')}
                    className={`py-3 transition-all ${mode === 'video' ? 'bg-[#e03d27] text-white font-bold' : 'text-zinc-400 hover:text-white'}`}
                  >
                    Video
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('audio')}
                    className={`py-3 transition-all ${mode === 'audio' ? 'bg-[#e03d27] text-white font-bold' : 'text-zinc-400 hover:text-white'}`}
                  >
                    Audio
                  </button>
                </div>
              )}

              {/* COMPACT CLEAN RESULT LAYOUT */}
              {mediaInfo && (
                <div className="mt-8 pt-8 border-t border-white/10 state-reveal-transition">
                  <div className="bg-[#0d0d0e] border border-white/10 p-6 flex flex-col md:flex-row gap-6 items-center justify-between card-hover-lift">
                    <div className="flex items-center gap-5 min-w-0 flex-1">
                      {mediaInfo.thumbnail ? (
                        <img src={mediaInfo.thumbnail} className="w-20 h-20 object-cover border border-white/15 squircle-logo shrink-0" alt="Media artwork" width="80" height="80" loading="lazy" decoding="async" />
                      ) : (
                        <div className="w-20 h-20 bg-zinc-800 border border-white/15 squircle-logo flex items-center justify-center text-zinc-400 font-mono text-[10px] shrink-0 font-bold uppercase">
                          MEDIA
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <h3 className="text-base font-bold text-white mb-1 truncate">{mediaInfo.title}</h3>
                        <p className="text-xs font-mono text-zinc-400 mb-2 truncate">{mediaInfo.uploader || 'Savewave Engine'}</p>

                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11px] text-[#e03d27]">
                          <span>{typeof mediaInfo.platform === 'string' ? mediaInfo.platform.toUpperCase() : (mediaInfo.platform && mediaInfo.platform.name) || 'WEB MEDIA'}</span> • <span>{mode.toUpperCase()}</span> • <span>{mediaInfo.qualityLabel || 'BEST AVAILABLE QUALITY'}</span>
                        </div>
                      </div>
                    </div>

                    <RigButton variant="red" className="w-full md:w-auto py-4 px-8 text-xs shrink-0" onClick={triggerBrowserDownload}>
                      SAVE
                    </RigButton>
                  </div>
                </div>
              )}
            </RigCard>
          )}

          {/* TAB 2: LOCAL BROWSER HISTORY */}
          {activeTab === 'history' && (
            <RigCard>
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
                <div>
                  <h2 className="font-mono text-xs uppercase tracking-widest text-zinc-400 font-semibold">LOCAL BROWSER HISTORY</h2>
                  <small className="text-[11px] text-zinc-500 font-mono">Stored only on this device • Never synced</small>
                </div>
                {clientHistory.length > 0 && (
                  <RigButton variant="outline" className="py-2 px-4 text-[10px]" onClick={clearLocalHistory}>CLEAR HISTORY</RigButton>
                )}
              </div>

              {clientHistory.length === 0 ? (
                <p className="font-mono text-xs text-zinc-600">No downloads yet.</p>
              ) : (
                <div className="history-list flex flex-col gap-3">
                  {clientHistory.slice(0, visibleHistoryCount).map((item, i) => (
                    <div key={item.id || `${item.timestamp}-${i}`} className="bg-[#0d0d0e] border border-white/10 p-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 card-hover-lift">
                      <div className="min-w-0 flex-1 pr-4">
                        <h4 className="text-xs font-medium text-white truncate">{item.title}</h4>
                        <span className="font-mono text-[11px] text-zinc-500">{item.uploader || 'Unknown source'} • {(item.mode || 'media').toUpperCase()} • {item.timestamp || 'Unknown time'}</span>
                      </div>
                      <span className="font-mono text-[10px] text-emerald-400 shrink-0">SAVED</span>
                    </div>
                  ))}
                  {visibleHistoryCount < clientHistory.length && (
                    <RigButton variant="outline" className="self-center mt-3 py-3 px-6" onClick={() => setVisibleHistoryCount((count) => Math.min(count + HISTORY_PAGE_SIZE, clientHistory.length))}>
                      LOAD MORE ({clientHistory.length - visibleHistoryCount})
                    </RigButton>
                  )}
                </div>
              )}
            </RigCard>
          )}

          {/* TAB 3: PRIVACY */}
          {activeTab === 'privacy' && (
            <RigCard>
              <h2 className="font-mono text-xs uppercase tracking-widest text-zinc-400 font-semibold mb-6">PRIVACY ARCHITECTURE</h2>

              <div className="flex flex-col gap-6 font-mono text-xs">
                <div>
                  <h3 className="text-sm font-bold text-white mb-1">No Database</h3>
                  <p className="text-zinc-400">No accounts or persistent server-side download history.</p>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-white mb-1">Stateless Resolution</h3>
                  <p className="text-zinc-400">Links are processed only to resolve available media.</p>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-white mb-1">No Permanent Media Storage</h3>
                  <p className="text-zinc-400">Savewave does not permanently store downloaded media on its servers.</p>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-white mb-1">Local History</h3>
                  <p className="text-zinc-400">Download history stays on this device and can be cleared anytime.</p>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-white mb-1">Direct Downloads</h3>
                  <p className="text-zinc-400">Media is downloaded directly from the resolved source when supported.</p>
                </div>
              </div>
            </RigCard>
          )}

        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 bg-[#08080a] border-t border-white/10 px-6 md:px-12 py-10">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6 font-mono text-xs text-zinc-400">

          <div className="flex items-center gap-3">
            <img src="savewave-light.png" className="w-6 h-6 squircle-logo" alt="Savewave Logo" />
            <span className="font-bold text-white tracking-widest text-sm">SAVEWAVE</span>
          </div>

          <div className="flex items-center gap-6 text-[11px] text-zinc-400">
            <button onClick={() => navigateToTab('downloader')} className="nav-link-item hover:text-white transition-colors">DOWNLOADER</button>
            <button onClick={() => navigateToTab('history')} className="nav-link-item hover:text-white transition-colors">HISTORY</button>
            <button onClick={() => navigateToTab('privacy')} className="nav-link-item hover:text-white transition-colors">PRIVACY</button>
          </div>

          <div className="flex items-center gap-5 text-[11px]">
            <a href="https://github.com/kuberbassi/savewave" target="_blank" rel="noopener noreferrer" title="GitHub Repository" className="hover:opacity-80 transition-opacity">
              <PlatformIcon name="GITHUB" className="w-4 h-4" />
            </a>
            <a href="https://kuberbassi.com" target="_blank" rel="noopener noreferrer" title="Kuber Bassi Website" className="hover:opacity-80 transition-opacity flex items-center">
              <img src="https://www.google.com/s2/favicons?domain=kuberbassi.com&sz=64" className="w-4 h-4 rounded-full" alt="kuberbassi.com favicon" />
            </a>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
              <span>© {(() => {
                const startYear = 2026;
                const currentYear = new Date().getFullYear();
                return currentYear > startYear ? `${startYear}-${String(currentYear).slice(-2)}` : `${startYear}`;
              })()} SAVEWAVE</span>
            </div>
          </div>

        </div>
      </footer>

    </div>
  );
};

// Render React App
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<SavewaveApp />);
