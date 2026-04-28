import { AlertTriangle, CheckCircle2, Download, X } from 'lucide-react';
import type { CloudWriteWarningSummary } from '../utils/cloudDiff';

export type { CloudWriteWarningSummary } from '../utils/cloudDiff';

interface Props {
  isOpen: boolean;
  summary: CloudWriteWarningSummary | null;
  onExportCsv: () => void;
  onConfirm: () => void;
  onCancel: () => void;
}

const DiffBadge = ({ label, value, color }: { label: string; value: number; color: string }) => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: '12px',
      padding: '10px 12px',
      borderRadius: '10px',
      background: '#fff',
      border: `1px solid ${color}`,
      color: '#334155'
    }}
  >
    <div style={{ fontWeight: 'bold' }}>{label}</div>
    <div style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>{value} 件</div>
  </div>
);

export const CloudReadWarningModal = ({ isOpen, summary, onExportCsv, onConfirm, onCancel }: Props) => {
  if (!isOpen || !summary) return null;

  const count = summary.allocations.added + summary.allocations.removed + summary.allocations.updated;

  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.58)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2300,
        padding: '20px'
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 'min(860px, 100%)',
          maxHeight: '90vh',
          overflow: 'auto',
          background: '#fff',
          borderRadius: '16px',
          boxShadow: '0 24px 80px rgba(15, 23, 42, 0.28)',
          border: '1px solid #e5e7eb'
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '18px 20px',
            borderBottom: '1px solid #e5e7eb',
            background: 'linear-gradient(135deg, #eff6ff, #ffffff)'
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <AlertTriangle size={18} color="#2563eb" />
              <h2 style={{ margin: 0, fontSize: '1.05rem' }}>差分が {count} 件あります</h2>
            </div>
            <div style={{ fontSize: '0.82rem', color: '#64748b' }}>
              CSVで詳細を確認できます。クラウド→ローカルに取得すると、現在のローカルデータは上書きされます。
            </div>
          </div>
          <button
            onClick={onCancel}
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#94a3b8' }}
          >
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: '20px', display: 'grid', gap: '16px' }}>
          <DiffBadge label="差分の件数" value={count} color="#3b82f6" />
          <div style={{ color: '#475569', fontSize: '0.92rem' }}>
            詳細は CSV をエクスポートしてご確認ください。
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', flexWrap: 'wrap' }}>
            <button
              onClick={onExportCsv}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                borderRadius: '8px',
                border: '1px solid #2563eb',
                background: '#eff6ff',
                color: '#1d4ed8',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              <Download size={16} />
              CSVエクスポート
            </button>
            <button
              onClick={onCancel}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: '1px solid #d1d5db',
                background: '#fff',
                cursor: 'pointer'
              }}
            >
              キャンセル
            </button>
            <button
              onClick={onConfirm}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                borderRadius: '8px',
                border: 'none',
                background: '#2563eb',
                color: '#fff',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              <CheckCircle2 size={16} /> それでも取得する
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
