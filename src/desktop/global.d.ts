import type { DesktopBridge } from './bridge';

declare global {
  interface Window {
    savewaveDesktop?: DesktopBridge;
  }
}

export {};
