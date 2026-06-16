import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.odontiacloud.clinic',
  appName: 'OdontiaCloud',
  // Vite genera el sitio compilado en "dist"; Capacitor lo empaqueta dentro del APK.
  webDir: 'dist',
};

export default config;
