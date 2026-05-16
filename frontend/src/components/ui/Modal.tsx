import { useEffect, type PropsWithChildren, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import { cn } from "../../lib/utils";

export const Modal = ({
  open,
  onClose,
  title,
  children,
  footer,
  className,
}: PropsWithChildren<{
  open: boolean;
  onClose: () => void;
  title: string;
  footer?: ReactNode;
  className?: string;
}>) => {
  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/35 p-4">
      <div
        role="dialog"
        aria-modal="true"
        className={cn("w-full max-w-2xl rounded-3xl bg-white shadow-xl", className)}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          <button
            type="button"
            className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            onClick={onClose}
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-6 py-5">{children}</div>
        {footer ? <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
};
