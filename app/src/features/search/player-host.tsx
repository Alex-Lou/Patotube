// App-level mount point of the YouTube player. Renders the one visible
// player the playback mode asks for, and brings an automatically
// backgrounded track back into view when the app returns.

import { useEffect } from 'react';
import {
  backgroundPositionMsNative,
  hasBackgroundAudio,
  stopBackgroundAudioNative,
} from '@/lib/android/bridge';
import { FloatingPlayer } from './floating-player';
import { SearchPlayerDialog } from './search-player-dialog';
import { usePlayback } from './use-playback';

/** Registered before App's intent drain (child effects run first), so
 *  a notification "App" / "Floating" tap that arrives on the same
 *  visibilitychange still wins: its `open()` supersedes this switch. */
function useReturnFromBackground(): void {
  useEffect(() => {
    if (!hasBackgroundAudio()) return;
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      const { mode, returnTo, switchTo } = usePlayback.getState();
      if (mode !== 'background' || !returnTo) return;
      const positionMs = backgroundPositionMsNative();
      // Native session already over (Stop, end of track, notification action).
      if (positionMs === null) return;
      stopBackgroundAudioNative();
      switchTo(returnTo, positionMs / 1000);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);
}

export function PlayerHost() {
  const mode = usePlayback((s) => s.mode);
  const track = usePlayback((s) => s.track);
  const startAt = usePlayback((s) => s.startAt);
  useReturnFromBackground();

  if (!track) return null;
  // A new track or position means a fresh player (clean <video> + seek).
  const key = `${track.videoId}@${startAt}`;
  if (mode === 'dialog') return <SearchPlayerDialog key={key} track={track} startAt={startAt} />;
  if (mode === 'floating') return <FloatingPlayer key={key} track={track} startAt={startAt} />;
  return null;
}
