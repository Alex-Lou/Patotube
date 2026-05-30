// App-level mount of SearchPlayerDialog driven by usePlayerDialog
// store. Lets a non-parent (e.g. FloatingPlayer's expand button)
// re-open the dialog without going through the original search /
// preview / url-input parent that may already be closed.

import { SearchPlayerDialog } from './search-player-dialog';
import { usePlayerDialog } from './use-player-dialog';

export function GlobalPlayerDialog() {
  const result = usePlayerDialog((s) => s.result);
  const startAt = usePlayerDialog((s) => s.startAt);
  const close = usePlayerDialog((s) => s.close);
  return (
    <SearchPlayerDialog
      result={result}
      startAt={startAt}
      onClose={close}
      onDownload={close}
    />
  );
}
