import { Redirect } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { overviewPath } from '../lib/navigation';
import { LoadingRows, Screen } from '../components/ui';

// Native and standalone Expo start here. The Next host serves its landing at /.
export default function Index() {
  const hosted = Platform.OS === 'web' && typeof document !== 'undefined' &&
    document.querySelector('meta[name="mode-host"][content="next"]') !== null;
  useEffect(() => { if (hosted) window.location.replace('/'); }, [hosted]);
  return hosted ? <Screen title="Opening MODE"><LoadingRows /></Screen> : <Redirect href={overviewPath} />;
}
