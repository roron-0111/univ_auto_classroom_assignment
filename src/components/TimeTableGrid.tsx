import React from 'react';
import type { Classroom, Period, Allocation, Subject, DayOfWeek, Term, DisplayConfig } from '../types';
import { ROOM_TYPE_LABELS, getEquipmentStyle, getImportantEquipmentStyle, EQUIPMENT_LIST, matchesEquipmentRequirement } from '../types';
import { isHiddenEquipment } from '../utils/equipmentVisibility';
import { checkConstraints } from '../utils/validation';
import { AlertTriangle } from 'lucide-react';

interface Props {
  day: DayOfWeek;
  classrooms: Classroom[];
  allocations: Allocation[];
  subjects: Subject[];
  onDrop: (subjectId: string, classroomId: string, period: Period, term: Term) => void;
  onRemove: (subjectId: string, classroomId: string) => void;
  onCellClick: (classroomId: string, period: Period, term: Term) => void;
  onClassClick?: (classroomId: string) => void;
  showExtraPeriods: boolean;
  displayConfig: DisplayConfig;
  draggingSubject?: Subject | null;
  onDragStart?: (id: string) => void;
  onDragEnd?: () => void;
  onEdit?: (id: string) => void;
}

const PERIODS: Period[] = [1, 2, 3, 4, 5, 6, 7];
const SPRING_TERMS = new Set(['spring', 'spring_first', 'spring_second', 'full_year']);
const AUTUMN_TERMS = new Set(['autumn', 'autumn_first', 'autumn_second', 'full_year']);

type CellAllocation = {
  allocation: Allocation;
  subject: Subject;
};

export const TimeTableGrid = ({
  day,
  classrooms,
  allocations,
  subjects,
  onDrop,
  onRemove,
  onCellClick,
  onClassClick,
  showExtraPeriods,
  displayConfig,
  draggingSubject,
  onDragStart,
  onDragEnd,
  onEdit
}: Props) => {
  const displayedPeriods = showExtraPeriods ? PERIODS : PERIODS.filter(p => p <= 5);

  const getCellAllocations = (classroomId: string, period: Period, season: 'spring' | 'autumn'): CellAllocation[] => {
    const validTerms = season === 'spring' ? SPRING_TERMS : AUTUMN_TERMS;
    return allocations
      .map(allocation => {
        const subject = subjects.find(s => s.id === allocation.subjectId);
        return subject ? { allocation, subject } : null;
      })
      .filter((item): item is CellAllocation => {
        if (!item) return false;
        const { allocation, subject } = item;
        const isInRange = period >= subject.period && period <= (subject.endPeriod || subject.period);
        return allocation.classroomId === classroomId && isInRange && subject.day === day && validTerms.has(subject.term);
      });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, classroomId: string, period: Period, term: Term) => {
    e.preventDefault();
    const subjectId = e.dataTransfer.getData('subjectId');
    const dragType = e.dataTransfer.getData('dragType');

    if (subjectId && (dragType === 'assign' || !dragType)) {
      onDrop(subjectId, classroomId, period, term);
    }
    onDragEnd?.();
  };

  const renderSubjectCard = (subject: Subject, room?: Classroom, allocation?: Allocation) => {
    const exceptions = allocation?.exceptions || [];
    const violations = room ? checkConstraints(subject, room) : [];
    const typeOk = !room || !subject.preferredRoomType || subject.preferredRoomType === room.type;
    const movOk = !room || !subject.requiresMovable || room.isMovable;
    const bldOk = !room || !subject.buildingPreference || subject.buildingPreference === room.building;
    const markMismatch = (label: string, mismatch: boolean) => (mismatch ? `${label}×` : label);
    const showViolationIcon = displayConfig.showViolationAlerts && violations.length > 0;
    const violationTitle = violations.map(v => v.message).join(' / ');

    const allEqSet = new Set([...(subject.mandatoryEquipment || []), ...(subject.requiredEquipment || [])]);
    allEqSet.delete('可動');
    const sortedEq = [
      ...EQUIPMENT_LIST.filter(e => allEqSet.has(e)),
      ...Array.from(allEqSet).filter(e => !EQUIPMENT_LIST.includes(e))
    ];

    return (
      <div
        key={subject.id}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData('subjectId', subject.id);
          if (room) e.dataTransfer.setData('fromClassroomId', room.id);
          e.dataTransfer.setData('dragType', 'assign');
          onDragStart?.(subject.id);
        }}
        onDragEnd={() => onDragEnd?.()}
        className="subject-card"
        style={{
          fontSize: '0.75rem',
          padding: '4px 6px',
          borderRadius: '4px',
          background: '#fff',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          cursor: 'grab',
          display: 'flex',
          flexDirection: 'column',
          border: displayConfig.showContinuityHighlight && (
            (subject.endPeriod && subject.endPeriod > subject.period) ||
            subject.term === 'full_year'
          )
            ? '4px solid #2196f3'
            : '1px solid #bbdefb',
          position: 'relative',
          minHeight: '65px'
        }}
        >
          {showViolationIcon && (
            <span
              title={violationTitle}
              style={{
                position: 'absolute',
                top: '4px',
                right: '4px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                background: '#ffebee',
                color: '#d32f2f',
                border: '1px solid #ef9a9a'
              }}
            >
              <AlertTriangle size={12} />
            </span>
          )}
          <div style={{
            fontWeight: 'bold',
            color: '#1976d2',
          lineHeight: '1.2',
          fontSize: '0.7rem',
          overflowWrap: 'anywhere',
          wordBreak: 'break-word',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '4px'
        }}>
          <span
            onClick={(e) => {
              e.stopPropagation();
              onEdit?.(subject.id);
            }}
            style={{ cursor: 'pointer', flex: 1 }}
            onMouseOver={(e) => (e.currentTarget.style.textDecoration = 'underline')}
            onMouseOut={(e) => (e.currentTarget.style.textDecoration = 'none')}
          >
            {displayConfig.subjectMainDisplay === 'name'
              ? subject.name
              : displayConfig.subjectMainDisplay === 'teacher'
                ? subject.teacher
                : subject.department}
          </span>
        </div>

        {displayConfig.showSubInfo && (
          <div style={{ fontSize: '0.7rem', color: '#666', overflow: 'hidden', overflowWrap: 'anywhere', marginTop: '2px', paddingBottom: '2px' }}>
            {displayConfig.subjectMainDisplay === 'name'
              ? `${subject.teacher}${subject.faculty ? ` (${subject.faculty})` : ''}`
              : subject.name}
          </div>
        )}

        {exceptions.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
            {exceptions.includes('term_split') && (
              <span style={{
                fontSize: '0.62em',
                padding: '1px 4px',
                borderRadius: '3px',
                background: '#fff8e1',
                color: '#9e7d00',
                border: '1px solid #ffe082',
                fontWeight: 'bold'
              }}>
                春秋分離配当
              </span>
            )}
            {exceptions.includes('room_type_relaxed') && (
              <span style={{
                fontSize: '0.62em',
                padding: '1px 4px',
                borderRadius: '3px',
                background: '#fff3e0',
                color: '#e65100',
                border: '1px solid #ffb74d',
                fontWeight: 'bold'
              }}>
                タイプ不一致配当
              </span>
            )}
          </div>
        )}

        {displayConfig.showRequirementTags && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px', marginTop: '2px', marginBottom: '4px' }}>
            {subject.preferredRoomType && (
              <span style={{
                fontSize: '0.65em',
                padding: '1px 4px',
                background: (room && !typeOk) ? '#d32f2f' : subject.preferredRoomType === 'pc' ? getImportantEquipmentStyle('PC').bg : subject.preferredRoomType === 'seminar' ? '#f3e5f5' : '#f5f5f5',
                color: (room && !typeOk) ? '#fff' : subject.preferredRoomType === 'pc' ? getImportantEquipmentStyle('PC').text : subject.preferredRoomType === 'seminar' ? '#7b1fa2' : '#666',
                border: `1px solid ${(room && !typeOk) ? '#b71c1c' : subject.preferredRoomType === 'pc' ? getImportantEquipmentStyle('PC').border : subject.preferredRoomType === 'seminar' ? '#e1bee7' : '#ddd'}`,
                borderRadius: '3px',
                fontWeight: 'bold'
              }} title={(room && !typeOk) ? '教室タイプ不一致' : undefined}>
                {markMismatch(ROOM_TYPE_LABELS[subject.preferredRoomType], !!room && !typeOk)}
              </span>
            )}

            {!!subject.requiresMovable && (
              <span style={{
                background: (room && !movOk) ? '#d32f2f' : getImportantEquipmentStyle('可動').bg,
                color: (room && !movOk) ? '#fff' : getImportantEquipmentStyle('可動').text,
                border: `1px solid ${(room && !movOk) ? '#b71c1c' : getImportantEquipmentStyle('可動').border}`,
                padding: '1px 4px',
                borderRadius: '3px',
                fontSize: '0.65em',
                fontWeight: 'bold'
              }}>
                {markMismatch('可動', !!room && !movOk)}
              </span>
            )}

            {sortedEq.map(eq => {
              const ok = !room || matchesEquipmentRequirement(room, eq);
              const isMandatory = (subject.mandatoryEquipment || []).includes(eq);
              const style = getEquipmentStyle(eq);
              return (
                <span key={eq} style={{
                  background: (room && !ok) ? '#d32f2f' : style.bg,
                  color: (room && !ok) ? '#fff' : style.text,
                  border: `1px solid ${(room && !ok) ? '#b71c1c' : style.border}`,
                  padding: '1px 4px',
                  borderRadius: '3px',
                  fontSize: '0.65em',
                fontWeight: isMandatory ? 'bold' : 'normal'
              }}>
                  {markMismatch(eq, !!room && !ok)}
                </span>
              );
            })}

            {subject.buildingPreference && (
              <span style={{
                background: (room && !bldOk) ? '#d32f2f' : '#f5f5f5',
                color: (room && !bldOk) ? '#fff' : '#666',
                border: `1px solid ${(room && !bldOk) ? '#b71c1c' : '#ddd'}`,
                padding: '1px 4px',
                borderRadius: '3px',
                fontSize: '0.65em',
                fontWeight: 'bold'
              }}>
                {markMismatch(subject.buildingPreference, !!room && !bldOk)}
              </span>
            )}
          </div>
        )}

        {displayConfig.showPreviousRooms && (
          <div style={{ fontSize: '0.65em', color: '#999', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '2px' }}>
            前年度: {subject.previousRooms && subject.previousRooms.length > 0 ? subject.previousRooms.join(', ') : 'なし'}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', gap: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', overflow: 'hidden', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.85em', fontWeight: 'bold', color: '#666', whiteSpace: 'nowrap' }}>{subject.department}</span>
            {displayConfig.showAllocationProgress && (() => {
              const requiredCount = subject.requiredRoomCount || 1;
              const currentCount = allocations.filter(a => a.subjectId === subject.id).length;
              return (
                <span style={{
                  fontSize: '0.65em',
                  padding: '1px 4px',
                  background: currentCount >= requiredCount ? '#e8f5e9' : (currentCount > 0 ? '#fff3e0' : '#ffebee'),
                  color: currentCount >= requiredCount ? '#2e7d32' : (currentCount > 0 ? '#e65100' : '#c62828'),
                  border: `1px solid ${currentCount >= requiredCount ? '#c8e6c9' : (currentCount > 0 ? '#ffcc80' : '#ef9a9a')}`,
                  borderRadius: '3px',
                  fontWeight: 'bold',
                  whiteSpace: 'nowrap'
                }} title={(room && room.capacity < subject.requiredCapacity) ? '定員不足' : undefined}>
                  {currentCount}/{requiredCount}室
                </span>
              );
            })()}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: (room && room.capacity < subject.requiredCapacity) ? '#d32f2f' : '#f5f5f5',
                  padding: '1px 4px',
                  borderRadius: '3px',
                  fontSize: '0.65rem',
                  color: (room && room.capacity < subject.requiredCapacity) ? '#fff' : '#444',
                  border: `1px solid ${(room && room.capacity < subject.requiredCapacity) ? '#b71c1c' : '#ddd'}`,
                  flexShrink: 0
                }}>
                  <span style={{ fontWeight: 'bold' }}>{markMismatch(`${subject.requiredCapacity}人`, !!room && room.capacity < subject.requiredCapacity)}</span>
                </div>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (room) onRemove(subject.id, room.id);
            }}
            style={{
              border: 'none',
              background: '#ffebee',
              cursor: 'pointer',
              color: '#f44336',
              fontSize: '9px',
              borderRadius: '50%',
              width: '13px',
              height: '13px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            ×
          </button>
        </div>
      </div>
    );
  };

  const renderCell = (room: Classroom, period: Period, season: 'spring' | 'autumn') => {
    const cellAllocations = getCellAllocations(room.id, period, season);
    const isInRange = draggingSubject && period >= draggingSubject.period && period <= (draggingSubject.endPeriod || draggingSubject.period);
    const isScheduleMismatch = draggingSubject && (
      (!((season === 'spring' ? SPRING_TERMS : AUTUMN_TERMS).has(draggingSubject.term))) ||
      (draggingSubject.day !== day || !isInRange)
    );

    const dragViolations = draggingSubject ? checkConstraints(draggingSubject, room) : [];
    const isUnfit = draggingSubject && !isScheduleMismatch && dragViolations.some(v => v.type === 'error');
    const isIdeal = draggingSubject && !isScheduleMismatch && !isUnfit;

    return (
      <td
        style={{
          padding: '4px',
          border: '1px solid #ddd',
          verticalAlign: 'top',
          background: isScheduleMismatch ? '#f0f0f0' : (isIdeal ? '#e6f7ff' : (isUnfit ? '#fff1f0' : (cellAllocations.length > 0 ? (cellAllocations.length > 1 ? '#fff9c4' : '#e3f2fd') : '#fff'))),
          opacity: isScheduleMismatch ? 0.6 : 1,
          transition: 'all 0.2s',
          position: 'relative',
          minWidth: '120px',
          boxShadow: isIdeal ? 'inset 0 0 0 2px #1890ff' : (isUnfit ? 'inset 0 0 0 1px #ffa39e' : 'none'),
          cursor: isScheduleMismatch ? 'not-allowed' : 'copy'
        }}
        onDragOver={(e) => {
          if (!isScheduleMismatch) handleDragOver(e);
        }}
        onDrop={(e) => {
          if (!isScheduleMismatch) handleDrop(e, room.id, period, season);
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minHeight: '40px', height: '100%', justifyContent: 'center' }}>
          {cellAllocations.map(({ subject, allocation }) => renderSubjectCard(subject, room, allocation))}
          <div
            onClick={() => onCellClick(room.id, period, season)}
            style={{ fontSize: '10px', color: '#ccc', textAlign: 'center', cursor: 'pointer', padding: '4px', border: '1px dashed transparent', borderRadius: '4px' }}
            onMouseOver={(e) => e.currentTarget.style.borderColor = '#ddd'}
            onMouseOut={(e) => e.currentTarget.style.borderColor = 'transparent'}
          >
            + 配当
          </div>
        </div>
      </td>
    );
  };

  return (
    <div className="timetable-grid" style={{ width: '100%', height: '100%', overflow: 'auto' }}>
      <table style={{ borderCollapse: 'separate', borderSpacing: 0, width: '100%', tableLayout: 'fixed' }}>
        <thead style={{ position: 'sticky', top: 0, zIndex: 100 }}>
          <tr>
            <th style={{ width: '207px', background: '#f5f5f5', padding: '8px', textAlign: 'left', border: '1px solid #ddd', position: 'sticky', left: 0, top: 0, zIndex: 110, fontSize: '0.85em' }}>教室 / 時限</th>
            <th style={{ width: '50px', background: '#f5f5f5', padding: '8px', textAlign: 'center', border: '1px solid #ddd', position: 'sticky', top: 0, zIndex: 105, fontSize: '0.8em' }}>定員</th>
            <th style={{ width: '40px', background: '#f5f5f5', padding: '8px', textAlign: 'center', border: '1px solid #ddd', position: 'sticky', top: 0, zIndex: 105, fontSize: '0.8em' }}>学期</th>
            {displayedPeriods.map(p => {
              const count = allocations.filter(a => {
                const s = subjects.find(sub => sub.id === a.subjectId);
                return s && s.day === day && p >= s.period && p <= (s.endPeriod || s.period);
              }).length;
              return (
                <th key={p} style={{ background: '#f5f5f5', padding: '8px', border: '1px solid #ddd', position: 'sticky', top: 0, zIndex: 101, fontSize: '0.85em' }}>
                  {p}講時{count > 0 ? ` (${count})` : ''}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {classrooms.map(room => (
            <React.Fragment key={room.id}>
              <tr>
                <td
                  rowSpan={2}
                  style={{
                    width: '207px',
                    padding: '6px 8px',
                    border: '1px solid #ddd',
                    background: '#fff',
                    position: 'sticky',
                    left: 0,
                    zIndex: 4,
                    overflow: 'hidden',
                    verticalAlign: 'top',
                    cursor: 'pointer',
                    color: '#1976d2',
                    transition: 'all 0.2s'
                  }}
                  onClick={() => onClassClick?.(room.id)}
                  onMouseOver={(e) => {
                    e.currentTarget.style.background = '#f5f5f5';
                    e.currentTarget.style.textDecoration = 'underline';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.background = '#fff';
                    e.currentTarget.style.textDecoration = 'none';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'nowrap' }}>
                    <span style={{ fontWeight: 'bold', fontSize: '1.1em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '129px' }} title={room.name}>{room.name}</span>
                    {displayConfig.showRoomType && (
                      <div style={{ display: 'flex', gap: '2px' }}>
                        <span style={{
                          background: room.type === 'pc' ? '#e3f2fd' : room.type === 'seminar' ? '#f3e5f5' : '#f5f5f5',
                          color: room.type === 'pc' ? '#1565c0' : room.type === 'seminar' ? '#7b1fa2' : '#666',
                          padding: '1px 3px',
                          borderRadius: '2px',
                          fontSize: '0.65em',
                          fontWeight: 'bold',
                          whiteSpace: 'nowrap'
                        }}>
                          {ROOM_TYPE_LABELS[room.type]}
                        </span>
                        <span style={{
                          background: room.isMovable ? getImportantEquipmentStyle('可動').bg : getImportantEquipmentStyle('固定').bg,
                          color: room.isMovable ? getImportantEquipmentStyle('可動').text : getImportantEquipmentStyle('固定').text,
                          border: `1px solid ${room.isMovable ? getImportantEquipmentStyle('可動').border : getImportantEquipmentStyle('固定').border}`,
                          padding: '1px 3px',
                          borderRadius: '2px',
                          fontSize: '0.65em',
                          fontWeight: 'bold',
                          whiteSpace: 'nowrap'
                        }}>
                          {room.isMovable ? '可動' : '固定'}
                        </span>
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: '0.7em', color: '#666', display: 'flex', flexWrap: 'wrap', gap: '3px', marginTop: '6px' }}>
                    {displayConfig.highlightedEquipment
                      .filter(e => e !== '可動' && e !== '固定')
                      .filter(e => !isHiddenEquipment(e))
                      .map(e => {
                        const has = room.equipment.includes(e);
                        const s = getEquipmentStyle(e);
                        return (
                          <span key={e} style={{
                            background: has ? s.bg : '#f5f5f5',
                            color: has ? s.text : '#ccc',
                            border: `1px solid ${has ? s.border : '#e8e8e8'}`,
                            padding: '1px 5px',
                            borderRadius: '3px',
                            fontSize: '0.72em',
                            fontWeight: has ? 'bold' : 'normal'
                          }}>
                            {e}
                          </span>
                        );
                      })}
                  </div>
                </td>

                <td rowSpan={2} style={{ width: '50px', border: '1px solid #ddd', background: '#fff', textAlign: 'center', padding: '4px', verticalAlign: 'middle' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'center', justifyContent: 'center' }}>
                    {displayConfig.showCapacity && (
                      <div style={{ fontSize: '0.85em', fontWeight: 'bold' }}>{room.capacity}</div>
                    )}
                    {displayConfig.showExamCapacity && room.examCapacity && (
                      <div style={{ fontSize: '0.75em', color: '#d32f2f', background: '#ffebee', padding: '0 3px', borderRadius: '2px' }}>試:{room.examCapacity}</div>
                    )}
                  </div>
                </td>

                <td style={{ width: '40px', border: '1px solid #ddd', background: '#eff8ff', textAlign: 'center', fontSize: '0.75em', color: '#1976d2', fontWeight: 'bold' }}>春</td>
                {displayedPeriods.map(p => renderCell(room, p, 'spring'))}
              </tr>

              <tr>
                <td style={{ width: '40px', border: '1px solid #ddd', background: '#fff9f0', textAlign: 'center', fontSize: '0.75em', color: '#f57c00', fontWeight: 'bold' }}>秋</td>
                {displayedPeriods.map(p => renderCell(room, p, 'autumn'))}
              </tr>
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
};
