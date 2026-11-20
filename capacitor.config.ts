import type { CapacitorConfig } from '@capacitor/cli';

// Operator approved: Ayah A Day / com.ayahaday.app. Never point server.url at the website.
const otaKey = process.env.AYAH_CAPGO_PUBLIC_KEY?.replace(/\\n/g, '\n').trim();
const otaEnabled = process.env.AYAH_CAPGO_ENABLED === 'true';
if (otaEnabled && !/^-----BEGIN (?:RSA )?PUBLIC KEY-----/.test(otaKey || '')) throw Error('Signed updates require the public Capgo key.');
const config: CapacitorConfig = {
  appId: 'com.ayahaday.app',
  appName: 'Ayah A Day',
  webDir: 'dist',
  loggingBehavior: 'none',
  server: { hostname: 'localhost', iosScheme: 'capacitor', androidScheme: 'https', cleartext: false },
  ios: { contentInset: 'never', preferredContentMode: 'mobile' },
  android: { allowMixedContent: false, webContentsDebuggingEnabled: false },
  plugins: {
    NativePurchases: { autoFinishTransactions: false },
    CapacitorUpdater: { autoUpdate: otaEnabled ? 'onlyDownload' : 'off', publicKey: otaKey,
      defaultChannel: 'mobile', allowSetDefaultChannel: false, allowModifyUrl: false,
      statsUrl: '', appReadyTimeout: 30000, resetWhenUpdate: true },
    SplashScreen: { launchShowDuration: 600, backgroundColor: '#101831', showSpinner: false },
    SystemBars: { insetsHandling: 'css', style: 'LIGHT' },
    Keyboard: { resize: 'body' },
  },
};
export default config;
