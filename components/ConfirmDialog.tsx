import React from 'react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: 'danger' | 'warning' | 'info';
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  onConfirm,
  onCancel,
  variant = 'danger'
}) => {
  if (!isOpen) return null;

  const variantStyles = {
    danger: {
      icon: 'text-red-400',
      iconBg: 'bg-red-500/20',
      button: 'bg-red-600 hover:bg-red-700 hover:shadow-[0_0_15px_rgba(239,68,68,0.4)]',
    },
    warning: {
      icon: 'text-yellow-400',
      iconBg: 'bg-yellow-500/20',
      button: 'bg-yellow-600 hover:bg-yellow-700 hover:shadow-[0_0_15px_rgba(234,179,8,0.4)]',
    },
    info: {
      icon: 'text-blue-400',
      iconBg: 'bg-blue-500/20',
      button: 'bg-blue-600 hover:bg-blue-700 hover:shadow-[0_0_15px_rgba(59,130,246,0.4)]',
    }
  };

  const styles = variantStyles[variant];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-message">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />

      {/* Dialog */}
      <div className="relative max-w-sm w-full bg-sena-dark/95 backdrop-blur-xl border border-white/10 p-6 rounded-2xl shadow-2xl animate-scale-in">
        <div className={`w-12 h-12 mx-auto mb-4 rounded-full ${styles.iconBg} flex items-center justify-center`}>
          <svg className={`w-6 h-6 ${styles.icon}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <h3 id="confirm-title" className="text-lg font-bold text-white text-center mb-2">{title}</h3>
        <p id="confirm-message" className="text-sm text-gray-400 text-center mb-6">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 bg-white/10 text-white font-semibold py-2.5 px-4 rounded-xl hover:bg-white/20 transition-all focus:outline-none focus:ring-2 focus:ring-white/30"
            aria-label={cancelLabel}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 text-white font-semibold py-2.5 px-4 rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-white/30 ${styles.button}`}
            aria-label={confirmLabel}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
