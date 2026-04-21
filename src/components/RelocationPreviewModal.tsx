import { useMemo } from 'react';
import { X, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';
import type { Classroom, Subject, UnassignedReason, RelocationResult } from '../types';

interface Props {
  isOpen: boolean;
  result: RelocationResult | null;
  subjects: Subject[];
  classrooms: Classroom[];
  onConfirm: () => void;
  onCancel: () => void;
}

const REASON_META: Record<UnassignedReason, { label: string; color: string; bg: string; border: string }> = {
  U1_no_hard_candidate: { label: '候補不足', color: '#b71c1c', bg: '#ffebee', border: '#ef9a9a' },
  U2_room_type_blocked: { label: '教室タイプ', color: '#e65100', bg: '#fff3e0', border: '#ffb74d' },
  U3_term_split_blocked: { label: '春秋同一', color: '#9e7d00', bg: '#fff8e1', border: '#ffe082' },
  U4_room_count_short: { label: '室数不足', color: '#1565c0', bg: '#e3f2fd', border: '#90caf9' },
  U5_swap_failed: { label: '交換失敗', color: '#6a1b9a', bg: '#f3e5f5', border: '#ce93d8' }
};

const getReasonMeta = (reason?: UnassignedReason) =>
  (reason && REASON_META[reason]) || {
    label: '未分類',
    color: '#475569',
    bg: '#f8fafc',
    border: '#cbd5e1'
  };

export const RelocationPreviewModal = ({
  isOpen,
  result,
  subjects,
  classrooms,
  onConfirm,
  onCancel
}: Props) => {
  const subjectMap = useMemo(() => new Map(subjects.map(subject => [subject.id, subject])), [subjects]);
  const roomMap = useMemo(() => new Map(classrooms.map(room => [room.id, room])), [classrooms]);

  if (!isOpen || !result) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(15, 23, 42, 0.55)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2100,
      padding: '20px'
    }}>
      <div style={{
        width: 'min(900px, 100%)',
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
              <h2 style={{ margin: 0, fontSize: '1.05rem' }}>未配当の再配置プレビュー</h2>
            </div>
            <div style={{ fontSize: '0.82rem', color: '#64748b' }}>
              移動 {result.moves.length} 件 / 配置 {result.placed.length} 件 / 残り {result.unresolved.length} 件
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
          <section style={{
            border: '1px solid #e5e7eb',
            borderRadius: '12px',
            padding: '14px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
              <ArrowRight size={16} color="#2563eb" />
              <h3 style={{ margin: 0, fontSize: '0.95rem' }}>移動内容</h3>
            </div>
            {result.moves.length === 0 ? (
              <div style={{ color: '#64748b', fontSize: '0.9rem' }}>移動は発生していません。</div>
            ) : (
              <div style={{ display: 'grid', gap: '8px' }}>
                {result.moves.map(move => {
                  const subject = subjectMap.get(move.subjectId);
                  const fromRoom = roomMap.get(move.fromRoomId);
                  const toRoom = roomMap.get(move.toRoomId);
                  return (
                    <div
                      key={`${move.subjectId}-${move.fromRoomId}-${move.toRoomId}`}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: '12px',
                        alignItems: 'center',
                        padding: '10px 12px',
                        borderRadius: '10px',
                        background: '#f8fafc',
                        border: '1px solid #e5e7eb'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 'bold' }}>{subject?.name || move.subjectId}</div>
                        <div style={{ fontSize: '0.82rem', color: '#475569' }}>
                          {fromRoom?.name || move.fromRoomId} → {toRoom?.name || move.toRoomId}
                        </div>
                      </div>
                      <div style={{
                        fontSize: '0.75rem',
                        color: '#1d4ed8',
                        background: '#eff6ff',
                        border: '1px solid #bfdbfe',
                        borderRadius: '999px',
                        padding: '4px 8px',
                        fontWeight: 'bold'
                      }}>
                        移動
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section style={{
            border: '1px solid #e5e7eb',
            borderRadius: '12px',
            padding: '14px'
          }}>
            <h3 style={{ margin: '0 0 10px', fontSize: '0.95rem' }}>新規配置</h3>
            {result.placed.length === 0 ? (
              <div style={{ color: '#64748b', fontSize: '0.9rem' }}>新しく配置された科目はありません。</div>
            ) : (
              <div style={{ display: 'grid', gap: '8px' }}>
                {result.placed.map(item => {
                  const subject = subjectMap.get(item.subjectId);
                  const room = roomMap.get(item.roomId);
                  return (
                    <div
                      key={`${item.subjectId}-${item.roomId}`}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: '12px',
                        alignItems: 'center',
                        padding: '10px 12px',
                        borderRadius: '10px',
                        background: '#ecfdf5',
                        border: '1px solid #bbf7d0'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 'bold' }}>{subject?.name || item.subjectId}</div>
                        <div style={{ fontSize: '0.82rem', color: '#475569' }}>
                          {room?.name || item.roomId}
                        </div>
                      </div>
                      <div style={{
                        fontSize: '0.75rem',
                        color: '#166534',
                        background: '#f0fdf4',
                        border: '1px solid #bbf7d0',
                        borderRadius: '999px',
                        padding: '4px 8px',
                        fontWeight: 'bold'
                      }}>
                        配置
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section style={{
            border: '1px solid #e5e7eb',
            borderRadius: '12px',
            padding: '14px',
            background: '#f8fafc'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
              <AlertTriangle size={16} color="#f59e0b" />
              <h3 style={{ margin: 0, fontSize: '0.95rem' }}>残った未配当</h3>
            </div>
            {result.unresolved.length === 0 ? (
              <div style={{ color: '#16a34a', fontSize: '0.9rem' }}>未配当は解消されました。</div>
            ) : (
              <div style={{ display: 'grid', gap: '8px' }}>
                {result.unresolved.map(item => {
                  const meta = getReasonMeta(item.reason);
                  return (
                    <div
                      key={`${item.subject.id}-${item.reason}`}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: '12px',
                        alignItems: 'flex-start',
                        padding: '10px 12px',
                        borderRadius: '10px',
                        background: meta.bg,
                        border: `1px solid ${meta.border}`
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 'bold' }}>{item.subject.name}</div>
                        {item.detail && (
                          <div style={{ marginTop: '4px', fontSize: '0.82rem', color: '#334155' }}>
                            {item.detail}
                          </div>
                        )}
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
                  );
                })}
              </div>
            )}
          </section>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', flexWrap: 'wrap' }}>
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
                padding: '8px 16px',
                borderRadius: '8px',
                border: '1px solid #2563eb',
                background: '#2563eb',
                color: '#fff',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              反映する
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
