import { AlertTriangle, CheckCircle2, Download, X } from 'lucide-react';

type DiffCount = {
  added: number;
  removed: number;
  updated: number;
};

export type CloudWriteWarningSummary = {
  subjects: DiffCount;
  classrooms: DiffCount;
  allocations: DiffCount;
  settingsChanged: boolean;
  equipmentSettingsChanged: boolean;
  subjectTaxonomyChanged: boolean;
  hasDiff: boolean;
};

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

export const CloudWriteWarningModal = ({
  isOpen,
  summary,
  onExportCsv,
  onConfirm,
  onCancel
}: Props) => {
  if (!isOpen || !summary) return null;

  const hasAnyChange =
    summary.subjects.added > 0 ||
    summary.subjects.removed > 0 ||
    summary.subjects.updated > 0 ||
    summary.classrooms.added > 0 ||
    summary.classrooms.removed > 0 ||
    summary.classrooms.updated > 0 ||
    summary.allocations.added > 0 ||
    summary.allocations.removed > 0 ||
    summary.allocations.updated > 0 ||
    summary.settingsChanged ||
    summary.equipmentSettingsChanged ||
    summary.subjectTaxonomyChanged;

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
            background: 'linear-gradient(135deg, #fff7ed, #ffffff)'
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <AlertTriangle size={18} color="#f59e0b" />
              <h2 style={{ margin: 0, fontSize: '1.05rem' }}>更新データがあります</h2>
            </div>
            <div style={{ fontSize: '0.82rem', color: '#64748b' }}>
              ローカル→クラウドへ書き込む前に、ローカルデータをCSVで退避してください。
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
          {!hasAnyChange ? (
            <div style={{ color: '#16a34a', fontSize: '0.92rem', fontWeight: 'bold' }}>
              差分はありません。
            </div>
          ) : (
            <>
              <section style={{ display: 'grid', gap: '10px' }}>
                <DiffBadge
                  label="授業"
                  value={summary.subjects.added + summary.subjects.removed + summary.subjects.updated}
                  color="#d97706"
                />
                <DiffBadge
                  label="教室"
                  value={summary.classrooms.added + summary.classrooms.removed + summary.classrooms.updated}
                  color="#2563eb"
                />
                <DiffBadge
                  label="配当"
                  value={summary.allocations.added + summary.allocations.removed + summary.allocations.updated}
                  color="#059669"
                />
                <div style={{ display: 'grid', gap: '8px', marginTop: '4px' }}>
                  <div style={{ fontWeight: 'bold', color: '#334155' }}>差分の詳細</div>
                  <div style={{ display: 'grid', gap: '8px' }}>
                    <DiffBadge label="授業 追加" value={summary.subjects.added} color="#fdba74" />
                    <DiffBadge label="授業 変更" value={summary.subjects.updated} color="#fdba74" />
                    <DiffBadge label="授業 削除" value={summary.subjects.removed} color="#fdba74" />
                    <DiffBadge label="教室 追加" value={summary.classrooms.added} color="#93c5fd" />
                    <DiffBadge label="教室 変更" value={summary.classrooms.updated} color="#93c5fd" />
                    <DiffBadge label="教室 削除" value={summary.classrooms.removed} color="#93c5fd" />
                    <DiffBadge label="配当 追加" value={summary.allocations.added} color="#6ee7b7" />
                    <DiffBadge label="配当 変更" value={summary.allocations.updated} color="#6ee7b7" />
                    <DiffBadge label="配当 削除" value={summary.allocations.removed} color="#6ee7b7" />
                  </div>
                </div>
              </section>

              <section
                style={{
                  border: '1px solid #e5e7eb',
                  borderRadius: '12px',
                  padding: '14px',
                  background: '#f8fafc'
                }}
              >
                <div style={{ fontWeight: 'bold', marginBottom: '8px', color: '#334155' }}>設定の差分</div>
                <div style={{ display: 'grid', gap: '6px', color: '#475569', fontSize: '0.9rem' }}>
                  <div>配当ルール: {summary.settingsChanged ? '変更あり' : '変更なし'}</div>
                  <div>機材設定: {summary.equipmentSettingsChanged ? '変更あり' : '変更なし'}</div>
                  <div>開講学部・管轄: {summary.subjectTaxonomyChanged ? '変更あり' : '変更なし'}</div>
                </div>
              </section>
            </>
          )}

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
              <CheckCircle2 size={16} /> それでも書き込む
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
