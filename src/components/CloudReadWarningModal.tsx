import { AlertTriangle, CheckCircle2, Download, X } from 'lucide-react';
import type { CloudWriteWarningSummary } from '../utils/cloudDiff';

interface Props {
  isOpen: boolean;
  summary: CloudWriteWarningSummary | null;
  onExportCsv: () => void;
  onConfirm: () => void;
  onCancel: () => void;
}

const totalDiffCount = (summary: CloudWriteWarningSummary) =>
  summary.subjects.added +
  summary.subjects.removed +
  summary.subjects.updated +
  summary.classrooms.added +
  summary.classrooms.removed +
  summary.classrooms.updated +
  summary.allocations.added +
  summary.allocations.removed +
  summary.allocations.updated +
  (summary.settingsChanged ? 1 : 0) +
  (summary.equipmentSettingsChanged ? 1 : 0) +
  (summary.subjectTaxonomyChanged ? 1 : 0);

export const CloudReadWarningModal = ({ isOpen, summary, onExportCsv, onConfirm, onCancel }: Props) => {
  if (!isOpen || !summary) return null;

  const count = totalDiffCount(summary);

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
        zIndex: 2310,
        padding: '20px'
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 'min(640px, 100%)',
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
