import { AlertTriangle, CloudDownload, CloudUpload, Download, X } from 'lucide-react';
import type { CloudWriteWarningSummary } from '../utils/cloudDiff';

interface Props {
  isOpen: boolean;
  summary: CloudWriteWarningSummary | null;
  hasOtherDiff: boolean;
  hasCloudData: boolean;
  isBusy: boolean;
  onExportCsv: () => void;
  onWriteLocal: () => void;
  onReadCloud: () => void;
  onCancel: () => void;
}

const buttonBase = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  padding: '9px 14px',
  borderRadius: '8px',
  cursor: 'pointer',
  fontWeight: 700
} as const;

export const AutoAllocationCloudGuardModal = ({
  isOpen,
  summary,
  hasOtherDiff,
  hasCloudData,
  isBusy,
  onExportCsv,
  onWriteLocal,
  onReadCloud,
  onCancel
}: Props) => {
  if (!isOpen || !summary) return null;

  const allocationDiffCount = summary.allocations.added + summary.allocations.removed + summary.allocations.updated;

  return (
    <div className="safety-modal-backdrop" onClick={onCancel}>
      <div className="safety-modal" onClick={event => event.stopPropagation()}>
        <div className="safety-modal-header">
          <div>
            <div className="safety-modal-title">
              <AlertTriangle size={20} color="#d97706" />
              <h2>自動配当を開始できません</h2>
            </div>
            <p>
              ローカルとクラウドの内容が一致していません。
              このまま自動配当すると、手動で変更した配当と自動配当の結果がずれる可能性があります。
            </p>
          </div>
          <button type="button" className="safety-modal-close" onClick={onCancel} aria-label="閉じる">
            <X size={20} />
          </button>
        </div>

        <div className="safety-modal-body">
          <div className="safety-modal-status-grid">
            <div className="safety-modal-status">
              <span>配当差分</span>
              <strong>{allocationDiffCount} 件</strong>
            </div>
            <div className="safety-modal-status">
              <span>その他の差分</span>
              <strong>{hasOtherDiff ? 'あり' : 'なし'}</strong>
            </div>
          </div>

          <div className="safety-modal-choices">
            <div>
              <strong>ローカルから書込</strong>
              <span>
                今の手動変更をクラウドへ保存します。自動配当はまだ実行しません。
                書込後に、もう一度「教室自動配当」を押してください。
              </span>
            </div>
            <div>
              <strong>クラウドから取得して戻す</strong>
              <span>
                ローカルの未書込変更を破棄し、クラウドの内容に戻します。
                配当ルール画面は閉じます。
              </span>
            </div>
            <div>
              <strong>中止</strong>
              <span>何も変更せず、この画面に戻ります。</span>
            </div>
          </div>

          {!hasCloudData && (
            <div className="safety-modal-note">
              クラウドに保存済みデータが見つかりません。先にローカルから書込してください。
            </div>
          )}

          <div className="safety-modal-actions">
            <button
              type="button"
              onClick={onExportCsv}
              disabled={isBusy || allocationDiffCount === 0}
              style={{ ...buttonBase, border: '1px solid #2563eb', background: '#eff6ff', color: '#1d4ed8' }}
            >
              <Download size={16} />
              差分CSV
            </button>
            <button
              type="button"
              onClick={onCancel}
              disabled={isBusy}
              style={{ ...buttonBase, border: '1px solid #d1d5db', background: '#fff', color: '#334155' }}
            >
              中止
            </button>
            <button
              type="button"
              onClick={onReadCloud}
              disabled={isBusy || !hasCloudData}
              style={{ ...buttonBase, border: '1px solid #2563eb', background: hasCloudData ? '#2563eb' : '#94a3b8', color: '#fff' }}
            >
              <CloudDownload size={16} />
              クラウドから取得
            </button>
            <button
              type="button"
              onClick={onWriteLocal}
              disabled={isBusy}
              style={{ ...buttonBase, border: 'none', background: '#15803d', color: '#fff' }}
            >
              <CloudUpload size={16} />
              ローカルから書込
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
