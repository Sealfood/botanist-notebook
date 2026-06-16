import { useEffect, useState, type PointerEvent, type ReactNode } from 'react';
import './Modal.css';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  closeOnOverlayClick?: boolean;
  draggable?: boolean;
}

export function Modal({
  open,
  onClose,
  title,
  children,
  closeOnOverlayClick = true,
  draggable = false,
}: ModalProps) {
  const [position, setPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  const startDrag = (e: PointerEvent<HTMLElement>) => {
    if (!draggable) return;
    if ((e.target as HTMLElement).closest('button')) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const startX = e.clientX - position.x;
    const startY = e.clientY - position.y;

    const handleMove = (ev: globalThis.PointerEvent) => {
      setPosition({ x: ev.clientX - startX, y: ev.clientY - startY });
    };
    const handleUp = () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  };

  return (
    <div
      className={`modal-overlay ${draggable ? 'modal-overlay--floating' : ''}`}
      onClick={closeOnOverlayClick ? onClose : undefined}
      role="presentation"
    >
      <div
        className={`modal ${draggable ? 'modal--draggable' : ''}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        style={
          draggable
            ? { transform: `translate(${position.x}px, ${position.y}px)` }
            : undefined
        }
      >
        <header className="modal__header" onPointerDown={startDrag}>
          <h2 id="modal-title">{title}</h2>
          <button className="modal__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <div className="modal__body">{children}</div>
      </div>
    </div>
  );
}
