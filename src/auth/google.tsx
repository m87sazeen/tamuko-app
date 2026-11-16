// Google (Gmail) sign-in via OAuth 2.0 + PKCE using expo-auth-session (free).
// Configure your own OAuth client IDs in Google Cloud Console (free) and set:
//   EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID, EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID, EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID
// Only the public client ID ships in the app — never a client secret.
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { Button, Note } from '../components/ui';

WebBrowser.maybeCompleteAuthSession();

const IDS = {
  web: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  ios: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  android: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
};

export const googleConfigured = Platform.OS === 'ios' ? !!IDS.ios : Platform.OS === 'android' ? !!IDS.android : !!IDS.web;

export type GoogleProfile = { email: string; name: string };

function GoogleInner({ onProfile }: { onProfile: (p: GoogleProfile) => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: IDS.web,
    iosClientId: IDS.ios,
    androidClientId: IDS.android,
    scopes: ['openid', 'email', 'profile'],
  });

  useEffect(() => {
    (async () => {
      if (response?.type !== 'success') {
        if (response?.type === 'error') setErr('Google sign-in failed. Please try again.');
        setBusy(false);
        return;
      }
      try {
        const token = response.authentication?.accessToken;
        const r = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: `Bearer ${token}` } });
        const info = await r.json();
        if (!info.email || info.email_verified !== true) throw new Error('unverified');
        onProfile({ email: String(info.email).toLowerCase(), name: info.name ?? '' });
      } catch {
        setErr('Could not confirm your Google account. Use a verified Gmail address.');
      } finally {
        setBusy(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- react only to new OAuth responses
  }, [response]);

  return (
    <>
      <Button
        label="Continue with Google"
        icon="google"
        kind="outline"
        disabled={!request || busy}
        loading={busy}
        onPress={() => {
          setErr('');
          setBusy(true);
          promptAsync();
        }}
      />
      {!!err && <Note tone="error" text={err} />}
    </>
  );
}

export function GoogleSignIn({ onProfile }: { onProfile: (p: GoogleProfile) => void }) {
  if (!googleConfigured)
    return (
      <>
        <Button label="Continue with Google" icon="google" kind="outline" disabled onPress={() => {}} />
        <Note tone="info" text="Google sign-in needs a free OAuth client ID. See README → Google sign-in." />
      </>
    );
  return <GoogleInner onProfile={onProfile} />;
}
