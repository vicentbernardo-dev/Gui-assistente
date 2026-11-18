import { AlertTriangle, CalendarCheck2, X } from 'lucide-react';

interface ConfirmationModalProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  details?: Array<{ label: string; value: string }>;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmationModal({
  open,
  title,
  description,
  confirmLabel,
  destructive = false,
  details = [],
  onConfirm,
  onCancel,
}: ConfirmationModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      <div className="w-full max-w-md rounded-[28px] bg-white p-6 shadow-2xl border border-[#E6E3DA]">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                destructive ? 'bg-[#FFE5E3] text-[#D94F48]' : 'bg-[#E5D9FF] text-[#5E4AE3]'
              }`}
            >
              {destructive ? <AlertTriangle className="w-5 h-5" /> : <CalendarCheck2 className="w-5 h-5" />}
            </div>
            <div>
              <h2 id="confirm-modal-title" className="text-lg font-bold text-[#161618] leading-snug">
                {title}
              </h2>
              <p className="text-sm text-[#5C5B57] mt-0.5">{description}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Fechar janela de confirmação"
            className="min-w-[40px] min-h-[40px] rounded-full flex items-center justify-center text-[#5C5B57] hover:bg-[#F3F1EA] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {details.length > 0 && (
          <div className="mt-4 rounded-2xl bg-[#F6F5F0] p-4 space-y-2 border border-[#EAE8DF]">
            {details.map((item) => (
              <div key={item.label} className="flex items-baseline justify-between gap-4 text-sm">
                <span className="text-[#6E6D68] font-medium">{item.label}</span>
                <span className="text-[#161618] font-semibold text-right">{item.value}</span>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[44px] px-5 py-2.5 rounded-full text-sm font-semibold text-[#161618] bg-[#F1EFE7] hover:bg-[#E7E4DA] transition-colors whitespace-nowrap"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`min-h-[44px] px-5 py-2.5 rounded-full text-sm font-semibold text-white transition-colors whitespace-nowrap ${
              destructive ? 'bg-[#D94F48] hover:bg-[#C24039]' : 'bg-[#161618] hover:bg-[#2C2C30]'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
