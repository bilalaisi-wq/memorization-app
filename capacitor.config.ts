import type { CapacitorConfig } from '@capacitor/cli';

// Operator approved: Ayah A Day / com.ayahaday.app. Never point server.url at the website.
const config: CapacitorConfig = {
  appId: 'com.ayahaday.app',
  appName: 'Ayah A Day',
  webDir: 'dist',
  loggingBehavior: 'none',
  server: { hostname: 'localhost', iosScheme: 'capacitor', androidScheme: 'https', cleartext: false },
  ios: { contentInset: 'never', preferredContentMode: 'mobile' },
  android: { allowMixedContent: false, webContentsDebuggingEnabled: false },
  plugins: {
    SplashScreen: { launchShowDuration: 600, backgroundColor: '#101831', showSpinner: false },
    SystemBars: { insetsHandling: 'css', style: 'LIGHT' },
    Keyboard: { resize: 'body' },
  },
};
export default config;
