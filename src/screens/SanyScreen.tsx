import { useRef, useState } from 'react';
import { Linking, View } from 'react-native';
import { WebView, type WebViewNavigation } from 'react-native-webview';
import type { ShouldStartLoadRequest } from 'react-native-webview/lib/WebViewTypes';
import { colors } from '@/theme';
import { ErrorState, Header, ScreenContainer, Spinner } from '@/components';

/** The game, hosted on its own. sunray.sa shows the same URL in an iframe. */
const GAME_URL = 'https://sunraygm.netlify.app/';
const GAME_HOST = 'sunraygm.netlify.app';

/**
 * «تحدي ساني» — the Sun Ray mini game.
 *
 * The game has no backend of ours: no scores, no accounts, nothing it can write.
 * The app simply frames the page, as the website does, with our header and a
 * back button above it.
 *
 * Navigation is pinned to the game's own host. A link inside the page that
 * leads anywhere else opens in the system browser instead of replacing the game
 * inside the app — a framed page that can wander to any site is a browser we
 * did not mean to ship, with our header on top of whatever it reaches.
 */
export function SanyScreen() {
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const ref = useRef<WebView>(null);

  const allow = (req: ShouldStartLoadRequest | WebViewNavigation) => {
    if (req.url === 'about:blank') return true;
    // A regex, not `new URL(...).host`: React Native's URL polyfill throws
    // "not implemented" for `host` and `hostname`.
    const host = /^https?:\/\/([^/?#:]+)/i.exec(req.url)?.[1]?.toLowerCase();
    if (host === GAME_HOST) return true;
    if (host) void Linking.openURL(req.url);
    return false;
  };

  return (
    <ScreenContainer padded scroll={false} header={<Header showBack title="تحدي ساني" />}>
      <View style={{ flex: 1, marginHorizontal: -18, backgroundColor: colors.bg }}>
        {failed ? (
          <ErrorState
            title="تعذّر فتح اللعبة"
            message="تحقّق من اتصالك بالإنترنت وحاول مجدداً"
            onRetry={() => {
              setFailed(false);
              setLoading(true);
              ref.current?.reload();
            }}
          />
        ) : (
          <WebView
            ref={ref}
            source={{ uri: GAME_URL }}
            style={{ flex: 1, backgroundColor: colors.bg }}
            onLoadEnd={() => setLoading(false)}
            onError={() => setFailed(true)}
            onShouldStartLoadWithRequest={allow}
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            allowsFullscreenVideo
            setSupportMultipleWindows={false}
            // The game is played by dragging; letting the page bounce or zoom
            // fights the gesture.
            bounces={false}
            overScrollMode="never"
            scalesPageToFit={false}
          />
        )}
        {loading && !failed ? (
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} pointerEvents="none">
            <Spinner label="نجهّز اللعبة…" />
          </View>
        ) : null}
      </View>
    </ScreenContainer>
  );
}
