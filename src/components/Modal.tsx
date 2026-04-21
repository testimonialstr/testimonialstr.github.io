import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

type Props = {
  onClose: () => void;
  children: ReactNode;
  disableBackdropClose?: boolean;
};

/** Portal-based modal: rendered at document.body so it escapes any ancestor
 *  containing block (backdrop-filter, transform, etc.) that would clip it. */
export default function Modal({
  onClose,
  children,
  disableBackdropClose,
}: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return createPortal(
    <div
      className="modal-backdrop"
      onClick={() => !disableBackdropClose && onClose()}
    >
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>,
    document.body,
  );
}
