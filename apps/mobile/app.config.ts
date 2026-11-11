import type { ExpoConfig } from 'expo/config';

// Seules des valeurs PUBLIQUES (URL + clé anon) sont embarquées. Jamais la clé service.
const projectId = process.env.EAS_PROJECT_ID;

const config: ExpoConfig = {
  name: 'Wasla',
  slug: 'wasla',
  scheme: 'wasla',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  ios: {
    bundleIdentifier: 'ma.wasla.app',
    supportsTablet: false,
    infoPlist: {
      NSCameraUsageDescription: 'Wasla utilise la caméra pour prendre les photos et vidéos de vos rapports.',
      NSMicrophoneUsageDescription: 'Wasla utilise le micro pour enregistrer les vidéos de rapport.',
      NSLocationWhenInUseUsageDescription: 'Wasla enregistre la position GPS de chaque preuve pour garantir son authenticité.',
      NSPhotoLibraryUsageDescription: 'Wasla accède à vos photos pour les documents et la messagerie.',
    },
  },
  android: {
    package: 'ma.wasla.app',
    adaptiveIcon: {
      backgroundColor: '#0B5D3B',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    permissions: ['CAMERA', 'RECORD_AUDIO', 'ACCESS_FINE_LOCATION', 'ACCESS_COARSE_LOCATION'],
  },
  plugins: [
    'expo-router',
    'expo-localization',
    ['expo-camera', { cameraPermission: 'Wasla utilise la caméra pour les preuves de mission.', recordAudioAndroid: true }],
    ['expo-location', { locationWhenInUsePermission: 'Wasla enregistre la position GPS de chaque preuve.' }],
    ['expo-notifications', { color: '#0B5D3B' }],
    ['expo-image-picker', { photosPermission: 'Wasla accède à vos photos pour les documents et la messagerie.' }],
  ],
  // EAS Update : permet d'ouvrir l'app dans Expo Go depuis les serveurs Expo (sans PC joignable).
  runtimeVersion: { policy: 'sdkVersion' },
  updates: projectId ? { url: `https://u.expo.dev/${projectId}` } : undefined,
  experiments: { typedRoutes: true },
  extra: {
    supportsRTL: true,
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    eas: { projectId },
  },
};

export default config;
