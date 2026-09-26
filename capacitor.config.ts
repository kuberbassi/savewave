import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.kuberbassi.savewave',
  appName: 'Savewave',
  webDir: 'dist-capacitor',
  android: {
    allowMixedContent: false,
  },
  plugins: {
    CapacitorHttp: { enabled: true },
  },
};

export default config;
