import { useEffect, useMemo, useState } from 'react';
import type { Allocation, DayOfWeek, Subject, Term, UnassignedReason } from '../types';
import { DAY_LABELS, getEquipmentStyle, getImportantEquipmentStyle, ROOM_TYPE_LABELS, EQUIPMENT_LIST, getTermLabel, getDayLabel, getPeriodLabel } from '../types';

export type UnassignedListItem = Subject & {
  _realId?: string;
  reason?: UnassignedReason;
  reasonDetail?: string;
  difficultyScore?: number;
  difficultyDetail?: string;
};

interface Props {
  subjects: UnassignedListItem[];
  allocations: Allocation[];
  onReorder: (newOrder: UnassignedListItem[]) => void;
  onDragStart?: (id: string) => void;
  onDragEnd?: () => void;
  draggingSubjectId?: string | null;
  onEdit?: (id: string) => void;
  onRemoveAllocation?: (subjectId: string, classroomId: string, insertIndex?: number) => void;
}

const REASON_META: Record<UnassignedReason, { label: string; short: string; color: string; bg: string; border: string }> = {
  U1_no_hard_candidate: { label: '必須条件不足', short: 'U1', color: '#b71c1c', bg: '#ffebee', border: '#ef9a9a' },
  U2_room_type_blocked: { label: '教室タイプ不一致', short: 'U2', color: '#e65100', bg: '#fff3e0', border: '#ffb74d' },
  U3_term_split_blocked: { label: '春秋同一教室不可', short: 'U3', color: '#9e7d00', bg: '#fff8e1', border: '#ffe082' },
  U4_room_count_short: { label: '教室数不足', short: 'U4', color: '#1565c0', bg: '#e3f2fd', border: '#90caf9' },
  U5_swap_failed: { label: '再調整失敗', short: 'U5', color: '#6a1b9a', bg: '#f3e5f5', border: '#ce93d8' }
};

const toSubject = (item: UnassignedListItem): UnassignedListItem => {
  const { reason, ...subject } = item;
  void reason;
  return subject;
};

type FilterDropdownProps<T extends string> = {
  label: string;
  options: Array<{ value: T; label: string }>;
  selected: Set<T>;
  onToggle: (value: T) => void;
  isOpen: boolean;
  setIsOpen: (value: boolean) => void;
  getLabel: (value: T) => string;
};

const FilterDropdown = <T extends string,>({
  label,
  options,
  selected,
  onToggle,
  isOpen,
  setIsOpen,
  getLabel
}: FilterDropdownProps<T>) => (
  <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
    <button
      onClick={() => setIsOpen(!isOpen)}
      style={{
        width: '100%',
        fontSize: '0.75rem',
        padding: '4px 6px',
        borderRadius: '4px',
        border: '1px solid #ccc',
        background: '#fff',
        textAlign: 'left',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        cursor: 'pointer'
      }}
    >
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
        {selected.size === 0 ? label : Array.from(selected).map(getLabel).join(', ')}
      </span>
      <span style={{ fontSize: '0.6rem' }}>{isOpen ? '▲' : '▼'}</span>
    </button>
    {isOpen && (
      <>
        <div
          style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: 100 }}
          onClick={() => setIsOpen(false)}
        />
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            width: '100%',
            background: '#fff',
            border: '1px solid #ccc',
            borderRadius: '4px',
            marginTop: '2px',
            zIndex: 101,
            maxHeight: '220px',
            overflowY: 'auto',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
          }}
        >
          {options.map(opt => (
            <label
              key={opt.value}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 8px',
                fontSize: '0.75rem',
                cursor: 'pointer',
                borderBottom: '1px solid #f0f0f0'
              }}
            >
              <input
                type="checkbox"
                checked={selected.has(opt.value)}
                onChange={() => onToggle(opt.value)}
                style={{ margin: 0 }}
              />
              {opt.label}
            </label>
          ))}
        </div>
      </>
    )}
  </div>
);

export const UnassignedList = ({
  subjects,
  allocations,
  onReorder,
  onDragStart,
  onDragEnd,
  draggingSubjectId,
  onEdit,
  onRemoveAllocation
}: Props) => {
  const roomTypeStyle: Record<string, { bg: string; text: string; border: string }> = {
    normal: { bg: '#f5f5f5', text: '#666', border: '#ddd' },
    pc: getImportantEquipmentStyle('PC'),
    seminar: { bg: '#f3e5f5', text: '#7b1fa2', border: '#e1bee7' }
  };

  const [selectedTerms, setSelectedTerms] = useState<Set<Term>>(new Set());
  const [selectedDays, setSelectedDays] = useState<Set<DayOfWeek>>(new Set());
  const [selectedPeriods, setSelectedPeriods] = useState<Set<string>>(new Set());
  const [selectedDepartments, setSelectedDepartments] = useState<Set<string>>(new Set());
  const [capacityMin, setCapacityMin] = useState('');
  const [capacityMax, setCapacityMax] = useState('');
  const [isTermOpen, setIsTermOpen] = useState(false);
  const [isDayOpen, setIsDayOpen] = useState(false);
  const [isPeriodOpen, setIsPeriodOpen] = useState(false);
  const [isDeptOpen, setIsDeptOpen] = useState(false);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!draggingSubjectId) {
      setDropIndex(null);
    }
  }, [draggingSubjectId]);

  const periodOptions = useMemo(() => ([
    { value: '0', label: '未定' },
    { value: '1', label: '1講時' },
    { value: '2', label: '2講時' },
    { value: '3', label: '3講時' },
    { value: '4', label: '4講時' },
    { value: '5', label: '5講時' },
    { value: '6', label: '6講時' },
    { value: '7', label: '7講時' }
  ]), []);

  const departments = useMemo(() => Array.from(new Set(subjects.map(s => s.department))).sort(), [subjects]);

  const filteredSubjects = useMemo(() => {
    const min = capacityMin.trim() === '' ? null : Number(capacityMin);
    const max = capacityMax.trim() === '' ? null : Number(capacityMax);
    return subjects.filter(s => {
      if (selectedTerms.size > 0 && !selectedTerms.has(s.term)) return false;
      if (selectedDays.size > 0 && !selectedDays.has(s.day)) return false;
      if (selectedPeriods.size > 0) {
        const tokens = (!s.period || s.period <= 0)
          ? ['0']
          : Array.from({ length: Math.max(1, (s.endPeriod && s.endPeriod > s.period ? s.endPeriod : s.period) - s.period + 1) }, (_, index) => String(s.period + index));
        if (!tokens.every(token => selectedPeriods.has(token))) return false;
      }
      if (selectedDepartments.size > 0 && !selectedDepartments.has(s.department)) return false;
      if (min !== null && Number.isFinite(min) && s.requiredCapacity < min) return false;
      if (max !== null && Number.isFinite(max) && s.requiredCapacity > max) return false;
      return true;
    });
  }, [subjects, selectedTerms, selectedDays, selectedPeriods, selectedDepartments, capacityMin, capacityMax]);

  const displaySubjects = useMemo(() => {
    return filteredSubjects;
  }, [filteredSubjects]);

  const toggleFilter = <T,>(set: Set<T>, setter: (s: Set<T>) => void, value: T) => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    setter(next);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const getDropIndexFromEvent = (e: React.DragEvent, index: number) => {
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    return e.clientY < rect.top + rect.height / 2 ? index : index + 1;
  };

  const handleDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDropIndex(null);

    const dragType = e.dataTransfer.getData('dragType');
    if (dragType !== 'assign') return;

    const subjectId = e.dataTransfer.getData('subjectId');
    const fromClassroomId = e.dataTransfer.getData('fromClassroomId');

    if (fromClassroomId && subjectId && onRemoveAllocation) {
      onRemoveAllocation(subjectId, fromClassroomId, index);
      onDragEnd?.();
      return;
    }

    const fromIndexStr = e.dataTransfer.getData('index');
    if (!fromIndexStr) return;

    const fromIndex = Number(fromIndexStr);
    const next = [...displaySubjects];
    const [moved] = next.splice(fromIndex, 1);
    const insertIndex = fromIndex < index ? Math.max(0, index - 1) : index;
    next.splice(insertIndex, 0, moved);

    const seen = new Set<string>();
    const reordered = next.filter(item => {
      const key = item._realId || item.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).map(toSubject);

    onReorder(reordered);
    onDragEnd?.();
  };

  const handleDragEnd = () => {
    setDropIndex(null);
    onDragEnd?.();
  };

  const renderDropIndicator = () => (
    <div
      style={{
        marginBottom: '10px',
        padding: '5px 8px',
        border: '1px dashed #64b5f6',
        borderRadius: '6px',
        background: '#e3f2fd',
        color: '#1565c0',
        fontSize: '0.72rem',
        fontWeight: 'bold',
        textAlign: 'center',
        userSelect: 'none'
      }}
    >
      ここに移動
    </div>
  );

  return (
    <div
      style={{
        height: '100%',
        padding: '15px',
        background: '#f8f9fa',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        border: '2px dashed transparent',
        overflow: 'hidden'
      }}
      onDragOver={handleDragOver}
      onDrop={e => handleDrop(e, 0)}
    >
      <div style={{ borderBottom: '1px solid #ddd', paddingBottom: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', color: '#333' }}>未配当 ({displaySubjects.length})</h3>
          {(selectedTerms.size > 0 || selectedDays.size > 0 || selectedPeriods.size > 0 || selectedDepartments.size > 0 || capacityMin.trim() !== '' || capacityMax.trim() !== '') && (
            <button
              onClick={() => {
                setSelectedTerms(new Set());
                setSelectedDays(new Set());
                setSelectedPeriods(new Set());
                setSelectedDepartments(new Set());
                setCapacityMin('');
                setCapacityMax('');
              }}
              style={{
                background: '#eee',
                border: '1px solid #ccc',
                borderRadius: '4px',
                fontSize: '0.7rem',
                padding: '2px 8px',
                cursor: 'pointer'
              }}
            >
              すべて表示
            </button>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '6px' }}>
          <div style={{ display: 'flex', gap: '4px', minWidth: 0, minHeight: '32px' }}>
            <FilterDropdown
              label="配当期"
              options={[
                { value: '', label: '未定' },
                { value: 'spring', label: '春学期' },
                { value: 'spring_first', label: '春学期前半' },
                { value: 'spring_second', label: '春学期後半' },
                { value: 'autumn', label: '秋学期' },
                { value: 'autumn_first', label: '秋学期前半' },
                { value: 'autumn_second', label: '秋学期後半' },
                { value: 'full_year', label: '通年' }
              ]}
              selected={selectedTerms}
              onToggle={(val: string) => toggleFilter(selectedTerms, setSelectedTerms, val as Term)}
              isOpen={isTermOpen}
              setIsOpen={setIsTermOpen}
              getLabel={(val: string) => getTermLabel(val)}
            />
          </div>

          <div style={{ display: 'flex', gap: '4px', minWidth: 0, minHeight: '32px' }}>
            <FilterDropdown
              label="開講学部"
              options={departments.map(d => ({ value: d, label: d }))}
              selected={selectedDepartments}
              onToggle={(val: string) => toggleFilter(selectedDepartments, setSelectedDepartments, val)}
              isOpen={isDeptOpen}
              setIsOpen={setIsDeptOpen}
              getLabel={(val: string) => val}
            />
          </div>

          <div style={{ display: 'flex', gap: '4px', minWidth: 0, minHeight: '32px' }}>
            <FilterDropdown
              label="曜日"
              options={[{ value: '', label: '未定' }, ...Object.entries(DAY_LABELS).map(([val, label]) => ({ value: val, label: `${label}曜日` }))]}
              selected={selectedDays}
              onToggle={(val: string) => toggleFilter(selectedDays, setSelectedDays, val as DayOfWeek)}
              isOpen={isDayOpen}
              setIsOpen={setIsDayOpen}
              getLabel={(val: string) => getDayLabel(val)}
            />
          </div>

          <div style={{ display: 'flex', gap: '4px', minWidth: 0, minHeight: '32px' }}>
            <FilterDropdown
              label="講時"
              options={periodOptions}
              selected={selectedPeriods}
              onToggle={(val: string) => toggleFilter(selectedPeriods, setSelectedPeriods, val)}
              isOpen={isPeriodOpen}
              setIsOpen={setIsPeriodOpen}
              getLabel={(val: string) => periodOptions.find(opt => opt.value === val)?.label ?? '未定'}
            />
          </div>

          <div style={{ gridColumn: '1 / -1', minWidth: 0 }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) 18px minmax(0, 1fr)',
              alignItems: 'center',
              gap: '4px',
              minWidth: 0
            }}>
              <input
                type="number"
                value={capacityMin}
                onChange={e => setCapacityMin(e.target.value)}
                placeholder="人数(以上)"
                style={{
                  width: '100%',
                  minWidth: 0,
                  boxSizing: 'border-box',
                  height: '30px',
                  fontSize: '0.75rem',
                  padding: '4px 6px',
                  borderRadius: '4px',
                  border: '1px solid #ccc'
                }}
              />
              <span style={{ fontSize: '0.75rem', color: '#666', textAlign: 'center' }}>〜</span>
              <input
                type="number"
                value={capacityMax}
                onChange={e => setCapacityMax(e.target.value)}
                placeholder="人数(以下)"
                style={{
                  width: '100%',
                  minWidth: 0,
                  boxSizing: 'border-box',
                  height: '30px',
                  fontSize: '0.75rem',
                  padding: '4px 6px',
                  borderRadius: '4px',
                  border: '1px solid #ccc'
                }}
              />
            </div>
          </div>
        </div>
      </div>

      <div
        style={{ flex: 1, overflowY: 'auto' }}
        onDragOver={e => {
          handleDragOver(e);
          if (e.currentTarget === e.target) {
            setDropIndex(displaySubjects.length);
          }
        }}
        onDrop={e => handleDrop(e, displaySubjects.length)}
      >
        {displaySubjects.map((subject, index) => {
          const realId = subject._realId || subject.id;
          return (
            <>
              {dropIndex === index && renderDropIndicator()}
            <div
              key={`${realId}-${index}`}
              draggable
              title={[
                subject.difficultyDetail ? `困難度 ${subject.difficultyScore?.toFixed(1) ?? ''}` : null,
                subject.difficultyDetail
              ].filter(Boolean).join(' / ')}
              onDragStart={e => {
                e.dataTransfer.setData('index', index.toString());
                e.dataTransfer.setData('subjectId', subject.id);
                e.dataTransfer.setData('dragType', 'assign');
                onDragStart?.(subject.id);
              }}
              onDragEnd={handleDragEnd}
              onDragOver={e => {
                handleDragOver(e);
                setDropIndex(getDropIndexFromEvent(e, index));
              }}
              onDrop={e => handleDrop(e, dropIndex === null ? index : dropIndex)}
              style={{
                padding: '8px 10px',
                background: '#fff',
                border: `1px solid ${subject.reason ? REASON_META[subject.reason].border : '#ddd'}`,
                borderRadius: '6px',
                cursor: 'grab',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                position: 'relative'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 'bold', overflowWrap: 'anywhere', wordBreak: 'break-word', fontSize: '0.85rem', lineHeight: '1.3', marginBottom: '2px' }}>
                    <span
                      onClick={e => {
                        e.stopPropagation();
                        onEdit?.(subject.id);
                      }}
                      style={{ cursor: 'pointer', color: '#1976d2' }}
                    >
                      {subject.name}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '1px' }}>
                    {subject.teacher} ({subject.faculty})
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#888' }}>
                    {getTermLabel(subject.term)} {getDayLabel(subject.day)} {(() => {
                      const startLabel = getPeriodLabel(subject.period);
                      const endLabel = subject.endPeriod && subject.endPeriod > subject.period ? getPeriodLabel(subject.endPeriod) : '';
                      if (startLabel === '未定') return '未定';
                      return `${startLabel}${endLabel ? `-${endLabel}` : ''}講時`;
                    })()}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px', marginTop: '6px', marginBottom: '4px' }}>
                {subject.preferredRoomType && (
                  <span style={{
                    fontSize: '0.65em', padding: '1px 4px',
                    background: roomTypeStyle[subject.preferredRoomType].bg,
                    color: roomTypeStyle[subject.preferredRoomType].text,
                    border: `1px solid ${roomTypeStyle[subject.preferredRoomType].border}`,
                    borderRadius: '3px', fontWeight: 'bold'
                  }}>
                    {ROOM_TYPE_LABELS[subject.preferredRoomType]}
                  </span>
                )}
                {(() => {
                  const allEqSet = new Set([
                    ...(subject.mandatoryEquipment || []),
                    ...(subject.requiredEquipment || [])
                  ]);
                  const sortedEq = [
                    ...EQUIPMENT_LIST.filter(e => allEqSet.has(e)),
                    ...Array.from(allEqSet).filter(e => !EQUIPMENT_LIST.includes(e))
                  ];
                  return sortedEq.map(eq => {
                    const style = getEquipmentStyle(eq);
                    const isMandatory = (subject.mandatoryEquipment || []).includes(eq);
                    return (
                      <span key={eq} style={{
                        fontSize: '0.65em',
                        padding: '1px 4px',
                        background: style.bg,
                        color: style.text,
                        border: `1px solid ${style.border}`,
                        borderRadius: '3px',
                        fontWeight: isMandatory ? 'bold' : 'normal'
                      }}>
                        {eq}
                      </span>
                    );
                  });
                })()}
              </div>

              <div style={{
                fontSize: '0.65em',
                color: '#aaa',
                marginTop: '4px',
                display: 'flex',
                alignItems: 'center',
                gap: '3px',
                flexWrap: 'wrap',
                lineHeight: '1.2',
                wordBreak: 'break-all',
                overflowWrap: 'break-word'
              }}>
                前年度教室: {subject.previousRooms && subject.previousRooms.length > 0 ? subject.previousRooms.join(', ') : 'なし'}
              </div>

              <div style={{
                marginTop: '2px',
                paddingTop: '2px',
                borderTop: '1px dashed #eee',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '4px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.85em', fontWeight: 'bold', color: '#666' }}>{subject.department}</span>
                  {(() => {
                    const realId = subject._realId || subject.id;
                    const requiredCount = subject.requiredRoomCount || 1;
                    const currentCount = allocations.filter(a => a.subjectId === realId).length;
                    return (
                      <span style={{
                        fontSize: '0.65em',
                        padding: '1px 5px',
                        background: currentCount >= requiredCount ? '#e8f5e9' : (currentCount > 0 ? '#fff3e0' : '#ffebee'),
                        color: currentCount >= requiredCount ? '#2e7d32' : (currentCount > 0 ? '#e65100' : '#c62828'),
                        border: `1px solid ${currentCount >= requiredCount ? '#c8e6c9' : (currentCount > 0 ? '#ffcc80' : '#ef9a9a')}`,
                        borderRadius: '3px',
                        fontWeight: 'bold'
                      }}>
                        {currentCount}/{requiredCount}室
                      </span>
                    );
                  })()}
                </div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: '#f5f5f5',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontSize: '0.7rem',
                  color: '#444',
                  border: '1px solid #ddd'
                }}>
                  <span style={{ fontWeight: 'bold' }}>{subject.requiredCapacity}人</span>
                </div>
              </div>
            </div>
            </>
          );
        })}

        {dropIndex === displaySubjects.length && renderDropIndicator()}

        {subjects.length === 0 && (
          <div
            style={{
              textAlign: 'center',
              padding: '40px 20px',
              color: '#999',
              border: '2px dashed #eee',
              borderRadius: '8px'
            }}
          >
            未配当の科目はありません
          </div>
        )}
      </div>
    </div>
  );
};

