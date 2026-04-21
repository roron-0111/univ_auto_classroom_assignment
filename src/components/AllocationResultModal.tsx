import { useMemo } from 'react';
import { X, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';
import type { UnassignedInfo, UnassignedReason } from '../types';
import type { DifficultyBreakdown, DifficultyEntry } from '../utils/difficulty';

interface AllocationResultSummary {
  targetCount: number;
  preservedCount: number;
  newlyAllocatedCount: number;
  unassigned: UnassignedInfo[];
  difficultyTop10?: DifficultyEntry[];
}

interface Props {
  isOpen: boolean;
  summary: AllocationResultSummary | null;
  onClose: () => void;
  onResolveExceptions?: () => void;
  canResolveExceptions?: boolean;
  resolvingExceptions?: boolean;
  onRelocate?: () => void;
  canRelocate?: boolean;
  relocating?: boolean;
}

const formatDifficulty = (breakdown: DifficultyBreakdown) => {
  const parts = [
    `候補 ${breakdown.strictCandidateCount}`,
    breakdown.mandatoryEquipmentCount > 0 ? `必須機材 ${breakdown.mandatoryEquipmentCount}` : null,
    breakdown.rareRoomTypeFlag ? '希少タイプ' : null,
    breakdown.capacityPressure >= 1.5 ? '大教室圧' : null,
    breakdown.continuityFlag ? '連続講時' : null,
    breakdown.termPairFlag ? '春秋ペア' : null,
    breakdown.multiRoomFlag ? '複数室' : null,
    breakdown.lastUnassignedStreak > 0 ? `未配当連鎖 ${breakdown.lastUnassignedStreak}` : null
  ].filter(Boolean);
  return parts.join(' / ');
};

const REASON_META: Record<UnassignedReason, { label: string; color: string; bg: string; border: string }> = {
  U1_no_hard_candidate: { label: '必須条件不足', color: '#b71c1c', bg: '#ffebee', border: '#ef9a9a' },
  U2_room_type_blocked: { label: '教室タイプ不一致', color: '#e65100', bg: '#fff3e0', border: '#ffb74d' },
  U3_term_split_blocked: { label: '春秋同一教室不可', color: '#9e7d00', bg: '#fff8e1', border: '#ffe082' },
  U4_room_count_short: { label: '教室数不足', color: '#1565c0', bg: '#e3f2fd', border: '#90caf9' },
  U5_swap_failed: { label: '再調整失敗', color: '#6a1b9a', bg: '#f3e5f5', border: '#ce93d8' }
};

export const AllocationResultModal = ({
  isOpen,
  summary,
  onClose,
  onResolveExceptions,
  canResolveExceptions,
  resolvingExceptions,
  onRelocate,
  canRelocate,
  relocating
}: Props) => {
  const reasonCounts = useMemo(() => {
    const counts = new Map<UnassignedReason, number>();
    summary?.unassigned.forEach(item => {
      counts.set(item.reason, (counts.get(item.reason) || 0) + 1);
    });
    return counts;
  }, [summary]);

  if (!isOpen || !summary) return null;

  const reasonOrder: UnassignedReason[] = [
    'U1_no_hard_candidate',
    'U3_term_split_blocked',
    'U4_room_count_short',
    'U2_room_type_blocked',
    'U5_swap_failed'
  ];

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(15, 23, 42, 0.55)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2000,
      padding: '20px'
    }}>
      <div style={{
        width: 'min(780px, 100%)',
        maxHeight: '90vh',
        overflow: 'auto',
        background: '#fff',
        borderRadius: '16px',
        boxShadow: '0 24px 80px rgba(15, 23, 42, 0.25)',
        border: '1px solid #e5e7eb'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '18px 20px',
          borderBottom: '1px solid #e5e7eb',
          background: 'linear-gradient(135deg, #eff6ff, #ffffff)'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <CheckCircle2 size={18} color="#2563eb" />
              <h2 style={{ margin: 0, fontSize: '1.05rem' }}>自動配当の結果</h2>
            </div>
            <div style={{ fontSize: '0.82rem', color: '#64748b' }}>
              対象 {summary.targetCount} 件 / 既存保持 {summary.preservedCount} 件 / 新規配当 {summary.newlyAllocatedCount} 件 / 未配当 {summary.unassigned.length} 件
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#94a3b8' }}
          >
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: '20px', display: 'grid', gap: '16px' }}>
          <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '12px' }}>
            <StatCard label="対象" value={summary.targetCount} />
            <StatCard label="既存保持" value={summary.preservedCount} />
            <StatCard label="新規配当" value={summary.newlyAllocatedCount} />
            <StatCard label="未配当" value={summary.unassigned.length} accent={summary.unassigned.length > 0 ? '#dc2626' : '#16a34a'} />
          </section>

          <section style={{
            border: '1px solid #e5e7eb',
            borderRadius: '12px',
            padding: '14px',
            background: '#f8fafc'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
              <AlertTriangle size={16} color="#f59e0b" />
              <h3 style={{ margin: 0, fontSize: '0.95rem' }}>未配当の内訳</h3>
            </div>
            {summary.unassigned.length === 0 ? (
              <div style={{ color: '#16a34a', fontSize: '0.9rem' }}>未配当はありません。</div>
            ) : (
              <div style={{ display: 'grid', gap: '8px' }}>
                {reasonOrder
                  .filter(reason => reasonCounts.has(reason))
                  .map(reason => {
                    const meta = REASON_META[reason];
                    const count = reasonCounts.get(reason) || 0;
                    return (
                      <div
                        key={reason}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '10px 12px',
                          borderRadius: '10px',
                          background: meta.bg,
                          border: `1px solid ${meta.border}`,
                          color: meta.color
                        }}
                      >
                        <div style={{ fontWeight: 'bold' }}>{meta.label}</div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>{count} 件</div>
                      </div>
                    );
                  })}
              </div>
            )}
          </section>

          {summary.unassigned.length > 0 && (
            <section style={{
              border: '1px solid #e5e7eb',
              borderRadius: '12px',
              padding: '14px'
            }}>
              <h3 style={{ margin: '0 0 10px', fontSize: '0.95rem' }}>未配当一覧</h3>
              <div style={{ display: 'grid', gap: '10px' }}>
                {summary.unassigned.map(item => {
                  const meta = REASON_META[item.reason];
                  return (
                    <div
                      key={`${item.subject.id}-${item.reason}`}
                      style={{
                        border: `1px solid ${meta.border}`,
                        borderRadius: '10px',
                        padding: '10px 12px',
                        background: meta.bg
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontWeight: 'bold', marginBottom: '2px' }}>{item.subject.name}</div>
                          <div style={{ fontSize: '0.82rem', color: '#475569' }}>
                            {item.subject.teacher} / {item.subject.department} / {item.subject.day} {item.subject.period}
                            {item.subject.endPeriod && item.subject.endPeriod > item.subject.period ? `-${item.subject.endPeriod}` : ''}限
                          </div>
                        </div>
                        <div style={{
                          alignSelf: 'flex-start',
                          padding: '4px 8px',
                          borderRadius: '999px',
                          background: '#fff',
                          border: `1px solid ${meta.border}`,
                          color: meta.color,
                          fontSize: '0.75rem',
                          fontWeight: 'bold'
                        }}>
                          {meta.label}
                        </div>
                      </div>
                      {item.detail && (
                        <div style={{ marginTop: '6px', fontSize: '0.82rem', color: '#334155' }}>
                          {item.detail}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {summary.difficultyTop10 && summary.difficultyTop10.length > 0 && (
            <details style={{
              border: '1px solid #e5e7eb',
              borderRadius: '12px',
              padding: '14px',
              background: '#f8fafc'
            }}>
              <summary style={{ cursor: 'pointer', fontWeight: 'bold', color: '#334155' }}>
                困難度トップ10
              </summary>
              <div style={{ display: 'grid', gap: '8px', marginTop: '12px' }}>
                {summary.difficultyTop10.map((entry, index) => (
                  <div
                    key={entry.subject.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: '12px',
                      alignItems: 'flex-start',
                      padding: '10px 12px',
                      borderRadius: '10px',
                      background: '#fff',
                      border: '1px solid #e5e7eb'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 'bold' }}>{index + 1}. {entry.subject.name}</div>
                      <div style={{ fontSize: '0.82rem', color: '#475569' }}>
                        {entry.subject.teacher} / {entry.subject.department}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>
                        {formatDifficulty(entry.breakdown)}
                      </div>
                    </div>
                    <div style={{
                      alignSelf: 'flex-start',
                      padding: '4px 8px',
                      borderRadius: '999px',
                      background: '#eff6ff',
                      border: '1px solid #bfdbfe',
                      color: '#1d4ed8',
                      fontSize: '0.75rem',
                      fontWeight: 'bold'
                    }}>
                      {entry.breakdown.score.toFixed(1)}
                    </div>
                  </div>
                ))}
              </div>
            </details>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', flexWrap: 'wrap' }}>
            <button
              onClick={onClose}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: '1px solid #d1d5db',
                background: '#fff',
                cursor: 'pointer'
              }}
            >
              閉じる
            </button>
            {onResolveExceptions && (
              <button
                onClick={onResolveExceptions}
                disabled={!canResolveExceptions || resolvingExceptions}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: '1px solid #f59e0b',
                  background: !canResolveExceptions ? '#fef3c7' : '#fff7ed',
                  color: '#92400e',
                  cursor: !canResolveExceptions || resolvingExceptions ? 'not-allowed' : 'pointer',
                  fontWeight: 'bold',
                  opacity: resolvingExceptions ? 0.7 : 1
                }}
              >
                <RefreshCw size={16} className={resolvingExceptions ? 'animate-spin' : ''} />
                例外を再スキャン
                </button>
            )}
            {onRelocate && (
              <button
                onClick={onRelocate}
                disabled={!canRelocate || relocating}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: '1px solid #2563eb',
                  background: !canRelocate ? '#dbeafe' : '#eff6ff',
                  color: '#1d4ed8',
                  cursor: !canRelocate || relocating ? 'not-allowed' : 'pointer',
                  fontWeight: 'bold',
                  opacity: relocating ? 0.7 : 1
                }}
              >
                <RefreshCw size={16} className={relocating ? 'animate-spin' : ''} />
                譛ｪ驟榊ｽ薙ｒ蜀崎ｪｿ謨ｴ
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ label, value, accent = '#2563eb' }: { label: string; value: number; accent?: string }) => (
  <div style={{
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '14px',
    background: '#fff'
  }}>
    <div style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: '8px' }}>{label}</div>
    <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: accent }}>{value}</div>
  </div>
);
