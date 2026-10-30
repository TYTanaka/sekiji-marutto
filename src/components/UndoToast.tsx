import { useAppState } from '../store/appState';

export function UndoToast() {
  const { undoNotice, undo, dismissUndo } = useAppState();
  if (!undoNotice) return null;

  return (
    <div className="undo-toast" role="status" key={undoNotice.id}>
      <span>{undoNotice.message}</span>
      <button type="button" className="undo-btn" onClick={undo}>
        元に戻す
      </button>
      <button
        type="button"
        className="undo-close"
        aria-label="閉じる"
        onClick={dismissUndo}
      >
        ✕
      </button>
    </div>
  );
}
