// Sign in with LINE — free, official LINE Login (OAuth 2.1 + PKCE).
// The app holds only the public channel ID; the self-hosted gateway (server/) keeps the channel secret,
// exchanges the code and verifies the ID token with LINE.
//   EXPO_PUBLIC_LINE_CHANNEL_ID=…   EXPO_PUBLIC_OTP_GATEWAY_URL=https://your-gateway
import { ResponseType, makeRedirectUri, useAuthRequest } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { Button, Note } from '../components/ui';
import { GATEWAY } from './otp';

WebBrowser.maybeCompleteAuthSession();

const CHANNEL_ID = process.env.EXPO_PUBLIC_LINE_CHANNEL_ID || '';
export const lineConfigured = !!(CHANNEL_ID && GATEWAY);
const discovery = { authorizationEndpoint: 'https://access.line.me/oauth2/v2.1/authorize', tokenEndpoint: 'https://api.line.me/oauth2/v2.1/token' };

export type LineProfile = { sub: string; name: string; email: string };

export function LineSignIn({ onProfile }: { onProfile: (p: LineProfile) => void }) {
  const redirectUri = makeRedirectUri({ scheme: 'tamuko', path: 'line' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [request, response, promptAsync] = useAuthRequest(
    { clientId: CHANNEL_ID, scopes: ['profile', 'openid'], redirectUri, usePKCE: true, responseType: ResponseType.Code },
    discovery,
  );

  useEffect(() => {
    (async () => {
      if (response?.type !== 'success') {
        if (response?.type === 'error') setErr('LINE sign-in failed. Please try again.');
        setBusy(false);
        return;
      }
      try {
        const res = await fetch(`${GATEWAY}/line/token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: response.params.code, codeVerifier: request?.codeVerifier, redirectUri }),
        });
        const json = await res.json();
        if (!json.sub) throw new Error(json.error || 'unverified');
        onProfile({ sub: json.sub, name: json.name ?? '', email: json.email ?? '' });
      } catch {
        setErr('Could not confirm your LINE account. Please try again.');
      } finally {
        setBusy(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- react only to new OAuth responses
  }, [response]);

  if (!lineConfigured) return null;
  return (
    <>
      <Button
        label="Continue with LINE"
        icon="message"
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
