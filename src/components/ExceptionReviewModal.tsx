import { useMemo } from 'react';
import { X, Check, XCircle, CheckCircle2, AlertTriangle } from 'lucide-react';
import type { Classroom, PendingException } from '../types';
import { buildApprovalKey } from '../utils/approvalKey';

interface Props {
  isOpen: boolean;
  exceptions?: PendingException[];
  classrooms?: Classroom[];
  approvedKeys: string[];
  onApprovedKeysChange: (approvedKeys: string[]) => void;
  onConfirm: (approvedKeys: string[]) => void;
  onCancel: () => void;
}

const isPendingException = (value: unknown): value is PendingException => {
  if (!value || typeof value !== 'object') return false;
  const item = value as PendingException;
  const validExceptions =
    Array.isArray(item.exceptions) &&
    item.exceptions.every(
      exception => exception === 'term_split' || exception === 'room_type_relaxed'
    );
  return !!item.subject && typeof item.subject.id === 'string' && typeof item.classroomId === 'string' && validExceptions;
};

const keyOf = (item: PendingException) => buildApprovalKey(item.subject.id, item.classroomId, item.exceptions);

export const ExceptionReviewModal = ({
  isOpen,
  exceptions = [],
  classrooms = [],
  approvedKeys,
  onApprovedKeysChange,
  onConfirm,
  onCancel
}: Props) => {
  const safeExceptions = useMemo(() => exceptions.filter(isPendingException), [exceptions]);
  const approvedSet = useMemo(() => new Set(approvedKeys), [approvedKeys]);
  const allKeys = useMemo(() => safeExceptions.map(keyOf), [safeExceptions]);
  const classroomById = useMemo(() => new Map(classrooms.map(room => [room.id, room])), [classrooms]);

  if (!isOpen) return null;

  const approvedCount = approvedSet.size;
  const rejectedCount = safeExceptions.length - approvedCount;

  const toggle = (item: PendingException, nextApproved: boolean) => {
    const key = keyOf(item);
    const next = new Set(approvedKeys);
    if (nextApproved) next.add(key);
    else next.delete(key);
    onApprovedKeysChange(Array.from(next));
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.58)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2200,
        padding: '20px'
      }}
    >
      <div
        style={{
          width: 'min(920px, 100%)',
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
              <h2 style={{ margin: 0, fontSize: '1.05rem' }}>例外配当の確認</h2>
            </div>
            <div style={{ fontSize: '0.82rem', color: '#64748b' }}>
              対象 {safeExceptions.length} 件 / 承認 {approvedCount} 件 / 却下 {rejectedCount} 件
            </div>
          </div>
          <button
            onClick={onCancel}
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#94a3b8' }}
          >
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: '20px', display: 'grid', gap: '14px' }}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              onClick={() => onApprovedKeysChange(allKeys)}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid #16a34a',
                background: '#f0fdf4',
                color: '#166534',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              すべて承認
            </button>
            <button
              onClick={() => onApprovedKeysChange([])}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid #dc2626',
                background: '#fef2f2',
                color: '#991b1b',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              すべて却下
            </button>
          </div>

          <div style={{ display: 'grid', gap: '10px' }}>
            {safeExceptions.map(item => {
              const room = classroomById.get(item.classroomId);
              const key = keyOf(item);
              const isApproved = approvedSet.has(key);
              return (
                <div
                  key={key}
                  style={{
                    border: `1px solid ${isApproved ? '#bbf7d0' : '#fecaca'}`,
                    borderRadius: '12px',
                    padding: '14px',
                    background: isApproved ? '#f0fdf4' : '#fff1f2'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{item.subject.name}</div>
                      <div style={{ fontSize: '0.82rem', color: '#475569' }}>
                        {item.subject.teacher} / {item.subject.day} {item.subject.period}
                        {item.subject.endPeriod && item.subject.endPeriod > item.subject.period
                          ? `-${item.subject.endPeriod}`
                          : ''}
                        講時 / {room?.name || item.classroomId}
                      </div>
                      <div style={{ fontSize: '0.82rem', color: '#475569', marginTop: '6px' }}>
                        例外: {item.exceptions.join(' / ')}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                      <button
                        onClick={() => toggle(item, true)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '6px 10px',
                          borderRadius: '8px',
                          border: '1px solid #16a34a',
                          background: isApproved ? '#16a34a' : '#fff',
                          color: isApproved ? '#fff' : '#166534',
                          cursor: 'pointer',
                          fontWeight: 'bold'
                        }}
                      >
                        <Check size={14} /> 承認
                      </button>
                      <button
                        onClick={() => toggle(item, false)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '6px 10px',
                          borderRadius: '8px',
                          border: '1px solid #dc2626',
                          background: !isApproved ? '#dc2626' : '#fff',
                          color: !isApproved ? '#fff' : '#991b1b',
                          cursor: 'pointer',
                          fontWeight: 'bold'
                        }}
                      >
                        <XCircle size={14} /> 却下
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
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
              onClick={() => onConfirm(approvedKeys)}
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
              <CheckCircle2 size={16} /> 確定
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
