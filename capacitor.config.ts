import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.7c6d73391e454d9abc3875192bbd33e0',
  appName: 'hoyeehapp',
  webDir: 'dist',
  server: {
    url: 'https://7c6d7339-1e45-4d9a-bc38-75192bbd33e0.lovableproject.com?forceHideBadge=true',
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
