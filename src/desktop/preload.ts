import { contextBridge, ipcRenderer } from 'electron';
import { DESKTOP_CHANNELS, type DesktopBridge } from './bridge';

const bridge: DesktopBridge = {
  getCapabilities: () => ipcRenderer.invoke(DESKTOP_CHANNELS.capabilities),
  getEngineStatus: () => ipcRenderer.invoke(DESKTOP_CHANNELS.engineStatus),
  getReleaseInfo: () => ipcRenderer.invoke(DESKTOP_CHANNELS.releaseInfo),
  resolveMedia: (url, mode = 'video') => ipcRenderer.invoke(DESKTOP_CHANNELS.resolveMedia, { url, mode }),
  downloadMedia: (request) => ipcRenderer.invoke(DESKTOP_CHANNELS.downloadMedia, request),
  cancelDownload: (jobId) => ipcRenderer.invoke(DESKTOP_CHANNELS.cancelDownload, jobId),
  getDownloadProgress: (jobId) => ipcRenderer.invoke(DESKTOP_CHANNELS.downloadProgress, jobId),
  openExternal: (url) => ipcRenderer.invoke(DESKTOP_CHANNELS.openExternal, url),
};

contextBridge.exposeInMainWorld('savewaveDesktop', bridge);
