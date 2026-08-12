(() => {
  const androidUrl = 'https://github.com/kuberbassi/savewave/releases/download/v1.0.6/Savewave-android-arm64.apk';
  const windowsUrl = 'https://github.com/kuberbassi/savewave/releases/download/v1.0.6/Savewave_1.0.6_x64-setup.exe';
  const releaseUrl = 'https://github.com/kuberbassi/savewave/releases/tag/v1.0.6';
  const isAndroid = /Android/i.test(navigator.userAgent);
  const isWindows = /Windows/i.test(navigator.userAgent);
  const target = isAndroid ? androidUrl : isWindows ? windowsUrl : releaseUrl;
  const link = document.getElementById('recommended-download');
  const status = document.getElementById('update-status');

  link.href = target;
  link.textContent = isAndroid ? 'Download Android APK' : isWindows ? 'Download Windows installer' : 'Open the latest release';
  status.textContent = isAndroid ? 'Starting the Android APK download…' : isWindows ? 'Starting the Windows installer download…' : 'Opening the available downloads…';
  window.location.replace(target);
})();
