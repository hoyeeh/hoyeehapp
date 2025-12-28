import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.hoyeeh.app',
  appName: 'Hoyeeh',
  webDir: 'dist',
  server: {
    url: 'https://hoyeeh.com',
    cleartext: true
  },
  plugins: {
    // Google Cast plugin configuration (community plugin)
    GoogleCast: {
      receiverApplicationId: 'CC1AD845' // Default Media Receiver
    }
  }
};

export default config;
