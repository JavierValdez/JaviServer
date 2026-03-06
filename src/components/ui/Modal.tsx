import type { ReactNode } from 'react';

interface ModalProps {
  title: string;
  description?: string;
  onClose: () => void;
  footer?: ReactNode;
  widthClassName?: string;
  children: ReactNode;
}

const CloseIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

export function Modal({
  title,
  description,
  onClose,
  footer,
  widthClassName = 'max-w-xl',
  children,
}: ModalProps) {
  return (
    <div className="modal-backdrop animate-fadeIn" onClick={onClose}>
      <div
        className={`modal-card ${widthClassName}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div className="min-w-0">
            <div className="section-label">Configuracion</div>
            <h2 className="mt-1 text-xl font-semibold text-[var(--text-primary)]">{title}</h2>
            {description ? <p className="mt-2 body-sm max-w-lg">{description}</p> : null}
          </div>

          <button type="button" className="btn-icon" onClick={onClose} aria-label="Cerrar modal" title="Cerrar">
            <CloseIcon />
          </button>
        </div>

        <div className="modal-body app-scroll">{children}</div>

        {footer ? <div className="modal-footer">{footer}</div> : null}
      </div>
    </div>
  );
}
