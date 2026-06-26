import { useMemo } from 'react';
import { X, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';
import { getDayLabel, getPeriodLabel, getTermLabel } from '../types';
import type { Subject, UnassignedInfo, UnassignedReason } from '../types';
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
    `厳密候補 ${breakdown.strictCandidateCount}`,
    breakdown.mandatoryEquipmentCount > 0 ? `必須機材 ${breakdown.mandatoryEquipmentCount}` : null,
    breakdown.rareRoomTypeFlag ? '希少教室タイプ' : null,
    breakdown.capacityPressure >= 1.5 ? '大人数傾向' : null,
    breakdown.continuityFlag ? '連続講時' : null,
    breakdown.termPairFlag ? '春秋ペア' : null,
    breakdown.multiRoomFlag ? '複数教室' : null,
    breakdown.lastUnassignedStreak > 0 ? `未配当連続 ${breakdown.lastUnassignedStreak}` : null
  ].filter(Boolean);
  return parts.join(' / ');
};

const REASON_META: Record<UnassignedReason, { label: string; description: string; color: string; bg: string; border: string }> = {
  U1_no_hard_candidate: {
    label: '条件に合う教室なし',
    description: '定員、必須機材、配当対象外の設定を確認してください。',
    color: '#b71c1c',
    bg: '#ffebee',
    border: '#ef9a9a'
  },
  U2_room_type_blocked: {
    label: '教室タイプが合わない',
    description: 'PC室、ゼミ室などの希望タイプと教室マスタを確認してください。',
    color: '#e65100',
    bg: '#fff3e0',
    border: '#ffb74d'
  },
  U3_term_split_blocked: {
    label: '春秋で同じ教室にできない',
    description: '春秋ペアの科目が同じ教室に入れられるか確認してください。',
    color: '#9e7d00',
    bg: '#fff8e1',
    border: '#ffe082'
  },
  U4_room_count_short: {
    label: '必要な教室数が足りない',
    description: '複数教室が必要な科目で、同じ時間に空いている教室数を確認してください。',
    color: '#1565c0',
    bg: '#e3f2fd',
    border: '#90caf9'
  },
  U5_swap_failed: {
    label: '再配置でも入らない',
    description: 'ほかの科目を動かしても空きが作れません。条件を見直してください。',
    color: '#6a1b9a',
    bg: '#f3e5f5',
    border: '#ce93d8'
  }
};

const getReasonMeta = (reason?: UnassignedReason) =>
  (reason && REASON_META[reason]) || {
    label: '未分類',
    description: '未配当一覧の補足を確認してください。',
    color: '#475569',
    bg: '#f8fafc',
    border: '#cbd5e1'
  };

const formatSubjectSchedule = (subject: Subject) => {
  const endPeriod = subject.endPeriod && subject.endPeriod > subject.period
    ? `-${getPeriodLabel(subject.endPeriod)}`
    : '';
  return `${getTermLabel(subject.term)} / ${getDayLabel(subject.day)}曜 / ${getPeriodLabel(subject.period)}${endPeriod}講時`;
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
      if (!item.reason) return;
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
  const unassignedCount = summary.unassigned.length;
  const hasUnassigned = unassignedCount > 0;
  const statusTitle = hasUnassigned ? '未配当があります' : 'すべて配当できました';
  const statusDescription = hasUnassigned
    ? '未配当一覧で原因を確認し、必要なら「未配当を再配置」または条件の見直しを行ってください。'
    : '対象科目はすべて教室に入りました。内容を確認し、問題なければクラウドへ書込してください。';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
        padding: '20px'
      }}
    >
      <div
        style={{
          width: 'min(780px, 100%)',
          maxHeight: '90vh',
          overflow: 'auto',
          background: '#fff',
          borderRadius: '16px',
          boxShadow: '0 24px 80px rgba(15, 23, 42, 0.25)',
          border: '1px solid #e5e7eb'
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '18px 20px',
            borderBottom: '1px solid #e5e7eb',
            background: 'linear-gradient(135deg, #eff6ff, #ffffff)'
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <CheckCircle2 size={18} color="#2563eb" />
              <h2 style={{ margin: 0, fontSize: '1.05rem' }}>教室自動配当結果</h2>
            </div>
            <div style={{ fontSize: '0.82rem', color: '#64748b' }}>
              対象科目 {summary.targetCount} 件 / 今回配当 {summary.newlyAllocatedCount} 件 / 未配当 {unassignedCount} 件 / 保持した配当 {summary.preservedCount} 件
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
          <section
            style={{
              border: `1px solid ${hasUnassigned ? '#fecaca' : '#bbf7d0'}`,
              borderRadius: '12px',
              padding: '14px 16px',
              background: hasUnassigned ? '#fff7ed' : '#f0fdf4'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              {hasUnassigned ? <AlertTriangle size={18} color="#c2410c" /> : <CheckCircle2 size={18} color="#15803d" />}
              <h3 style={{ margin: 0, fontSize: '1rem', color: hasUnassigned ? '#9a3412' : '#166534' }}>
                {statusTitle}
              </h3>
            </div>
            <div style={{ fontSize: '0.9rem', color: '#334155', lineHeight: 1.6 }}>
              {statusDescription}
            </div>
          </section>

          <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px' }}>
            <StatCard label="対象科目" value={summary.targetCount} />
            <StatCard label="今回配当" value={summary.newlyAllocatedCount} />
            <StatCard
              label="未配当"
              value={unassignedCount}
              accent={hasUnassigned ? '#dc2626' : '#16a34a'}
            />
            <StatCard label="保持した配当" value={summary.preservedCount} />
          </section>

          <section
            style={{
              border: '1px solid #e5e7eb',
              borderRadius: '12px',
              padding: '14px',
              background: '#f8fafc'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
              <AlertTriangle size={16} color="#f59e0b" />
              <h3 style={{ margin: 0, fontSize: '0.95rem' }}>未配当の理由</h3>
            </div>
            {!hasUnassigned ? (
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
                        <div>
                          <div style={{ fontWeight: 'bold' }}>{meta.label}</div>
                          <div style={{ fontSize: '0.78rem', lineHeight: 1.5, color: '#475569', marginTop: '2px' }}>
                            {meta.description}
                          </div>
                        </div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>{count} 件</div>
                      </div>
                    );
                  })}
              </div>
            )}
          </section>

          {hasUnassigned && (
            <section
              style={{
                border: '1px solid #e5e7eb',
                borderRadius: '12px',
                padding: '14px'
              }}
            >
              <h3 style={{ margin: '0 0 10px', fontSize: '0.95rem' }}>未配当一覧</h3>
              <div style={{ display: 'grid', gap: '10px' }}>
                {summary.unassigned.map(item => {
                  const meta = getReasonMeta(item.reason);
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
                            {item.subject.teacher} / {item.subject.department} / {formatSubjectSchedule(item.subject)}
                          </div>
                        </div>
                        <div
                          style={{
                            alignSelf: 'flex-start',
                            padding: '4px 8px',
                            borderRadius: '999px',
                            background: '#fff',
                            border: `1px solid ${meta.border}`,
                            color: meta.color,
                            fontSize: '0.75rem',
                            fontWeight: 'bold'
                          }}
                        >
                          {meta.label}
                        </div>
                      </div>
                      {item.detail && (
                        <div style={{ marginTop: '6px', fontSize: '0.82rem', color: '#334155' }}>
                          補足: {item.detail}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {summary.difficultyTop10 && summary.difficultyTop10.length > 0 && (
            <details
              style={{
                border: '1px solid #e5e7eb',
                borderRadius: '12px',
                padding: '14px',
                background: '#f8fafc'
              }}
            >
              <summary style={{ cursor: 'pointer', fontWeight: 'bold', color: '#334155' }}>
                配当が難しい科目（上位10件）
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
                      <div style={{ fontWeight: 'bold' }}>
                        {index + 1}. {entry.subject.name}
                      </div>
                      <div style={{ fontSize: '0.82rem', color: '#475569' }}>
                        {entry.subject.teacher} / {entry.subject.department}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>
                        {formatDifficulty(entry.breakdown)}
                      </div>
                    </div>
                    <div
                      style={{
                        alignSelf: 'flex-start',
                        padding: '4px 8px',
                        borderRadius: '999px',
                        background: '#eff6ff',
                        border: '1px solid #bfdbfe',
                        color: '#1d4ed8',
                        fontSize: '0.75rem',
                        fontWeight: 'bold'
                      }}
                    >
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
                例外を再確認
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
                未配当を再配置
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ label, value, accent = '#2563eb' }: { label: string; value: number; accent?: string }) => (
  <div
    style={{
      border: '1px solid #e5e7eb',
      borderRadius: '12px',
      padding: '14px',
      background: '#fff'
    }}
  >
    <div style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: '8px' }}>{label}</div>
    <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: accent }}>{value}</div>
  </div>
);
