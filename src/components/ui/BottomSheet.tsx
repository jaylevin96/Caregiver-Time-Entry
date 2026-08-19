import { useEffect } from 'react';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  /** Render above another sheet (e.g. day list → entry detail). */
  elevated?: boolean;
}

export function BottomSheet({
  open,
  onClose,
  title,
  children,
  elevated = false,
}: BottomSheetProps) {
  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      if (elevated) event.stopImmediatePropagation();
      onClose();
    }

    window.addEventListener('keydown', onKeyDown, elevated);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown, elevated);
    };
  }, [open, onClose, elevated]);

  if (!open) return null;

  return (
    <div
      className={[
        'fixed inset-0 flex flex-col justify-end',
        elevated ? 'z-[60]' : 'z-50',
      ].join(' ')}
    >
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-black/30 backdrop-blur-[1px]"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-title"
        className="bg-surface-raised relative max-h-[calc(100dvh-env(safe-area-inset-top)-0.75rem)] w-full overflow-y-auto overscroll-contain rounded-t-2xl shadow-xl [-webkit-overflow-scrolling:touch]"
      >
        <div className="bg-border mx-auto mt-3 h-1 w-10 shrink-0 rounded-full" />
        <div className="border-border sticky top-0 border-b bg-white py-4 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]">
          <h2 id="sheet-title" className="text-lg font-semibold">
            {title}
          </h2>
        </div>
        <div className="py-4 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pb-[max(1rem,env(safe-area-inset-bottom))]">
          {children}
        </div>
      </div>
    </div>
  );
}
