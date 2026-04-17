import React from 'react';
import type { Classroom, Period, Allocation, Subject, DayOfWeek, Term, DisplayConfig } from '../types';
import { ROOM_TYPE_LABELS, getEquipmentStyle, IMPORTANT_EQUIPMENT_COLORS } from '../types';
import { checkConstraints } from '../utils/validation';
import { Users } from 'lucide-react';

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

export const TimeTableGrid = ({
    day, classrooms, allocations, subjects, onDrop, onRemove, onCellClick, onClassClick, showExtraPeriods, displayConfig,
    draggingSubject, onDragStart, onDragEnd, onEdit
}: Props) => {

    const displayedPeriods = showExtraPeriods ? PERIODS : PERIODS.filter(p => p <= 5);

    const getSubjects = (classroomId: string, period: Period, season: 'spring' | 'autumn') => {
        const springTerms = new Set(['spring', 'spring_first', 'spring_second', 'full_year']);
        const autumnTerms = new Set(['autumn', 'autumn_first', 'autumn_second', 'full_year']);
        const validTerms = season === 'spring' ? springTerms : autumnTerms;
        const matchingAllocations = allocations.filter(a => {
            const subject = subjects.find(s => s.id === a.subjectId);
            if (!subject) return false;
            const isInPeriodRange = period >= subject.period && period <= (subject.endPeriod || subject.period);
            return a.classroomId === classroomId && isInPeriodRange && subject.day === day && validTerms.has(subject.term);
        });
        return matchingAllocations.map(a => subjects.find(s => s.id === a.subjectId)!).filter(Boolean);
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

    const renderSubjectCard = (subject: Subject, room?: Classroom) => {
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
                <div style={{
                    fontWeight: 'bold', color: '#1976d2', lineHeight: '1.2',
                    fontSize: '0.7rem',
                    overflowWrap: 'anywhere', wordBreak: 'break-word',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                    gap: '4px'
                }}>
                    <span
                        onClick={(e) => { e.stopPropagation(); onEdit?.(subject.id); }}
                        style={{ cursor: 'pointer', flex: 1 }}
                        onMouseOver={(e) => (e.currentTarget.style.textDecoration = 'underline')}
                        onMouseOut={(e) => (e.currentTarget.style.textDecoration = 'none')}
                    >
                        {displayConfig.subjectMainDisplay === 'name' ? subject.name :
                            displayConfig.subjectMainDisplay === 'teacher' ? subject.teacher : subject.department}
                    </span>
                </div>
                {displayConfig.showSubInfo && (
                    <div style={{ fontSize: '0.7rem', color: '#666', overflow: 'hidden', overflowWrap: 'anywhere', marginTop: '2px', paddingBottom: '2px' }}>
                        {displayConfig.subjectMainDisplay === 'name'
                            ? `${subject.teacher}${subject.faculty ? ` (開講:${subject.faculty})` : ''}`
                            : subject.name}
                    </div>
                )}

                {/* タグ一覧 (希望タイプ・機材) */}
                {displayConfig.showRequirementTags && (() => {
                    // 配当済みの場合、条件チェック用の判定値を事前計算
                    const typeOk = !room || !subject.preferredRoomType || subject.preferredRoomType === room.type;
                    const pjOk = !room || !subject.requiresProjector || room.equipment.some(eq => eq.includes('PJ'));
                    const movOk = !room || !subject.requiresMovable || room.isMovable;
                    const eqMatch = (req: string) => !room || (() => {
                        if (req === 'PJ(横)' || req === 'PJ(中)') return room.equipment.some(e => e === 'PJ(横)' || e === 'PJ(中)');
                        if (req === '可動') return room.isMovable;
                        return room.equipment.some(e => e === req || e.includes(req) || req.includes(e));
                    })();
                    const bldOk = !room || !subject.buildingPreference || subject.buildingPreference === room.building;

                    return (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px', marginTop: '2px', marginBottom: '4px' }}>
                            {/* 希望教室タイプ（不一致: 橙ベタ） */}
                            {subject.preferredRoomType && (
                                <span style={{
                                    fontSize: '0.65em', padding: '1px 4px',
                                    background: (room && !typeOk) ? '#d32f2f' : subject.preferredRoomType === 'pc' ? IMPORTANT_EQUIPMENT_COLORS['PC'].bg : subject.preferredRoomType === 'seminar' ? '#f3e5f5' : '#f5f5f5',
                                    color: (room && !typeOk) ? '#fff' : subject.preferredRoomType === 'pc' ? IMPORTANT_EQUIPMENT_COLORS['PC'].text : subject.preferredRoomType === 'seminar' ? '#7b1fa2' : '#666',
                                    border: `1px solid ${(room && !typeOk) ? '#b71c1c' : subject.preferredRoomType === 'pc' ? IMPORTANT_EQUIPMENT_COLORS['PC'].border : subject.preferredRoomType === 'seminar' ? '#e1bee7' : '#ddd'}`,
                                    borderRadius: '3px', fontWeight: 'bold'
                                }}>
                                    {ROOM_TYPE_LABELS[subject.preferredRoomType]}{room && !typeOk ? '×' : ''}
                                </span>
                            )}
                            {/* PJ必須（不足: 赤ベタ） */}
                            {!!subject.requiresProjector && (
                                <span style={{
                                    background: (room && !pjOk) ? '#d32f2f' : '#e3f2fd',
                                    color: (room && !pjOk) ? '#fff' : '#1565c0',
                                    border: `1px solid ${(room && !pjOk) ? '#b71c1c' : '#bbdefb'}`,
                                    padding: '1px 4px', borderRadius: '3px', fontSize: '0.65em', fontWeight: 'bold'
                                }}>
                                    PJ必須{room && !pjOk ? '×' : ''}
                                </span>
                            )}
                            {/* 可動必須（不足: 赤ベタ） */}
                            {!!subject.requiresMovable && (
                                <span style={{
                                    background: (room && !movOk) ? '#d32f2f' : IMPORTANT_EQUIPMENT_COLORS['可動'].bg,
                                    color: (room && !movOk) ? '#fff' : IMPORTANT_EQUIPMENT_COLORS['可動'].text,
                                    border: `1px solid ${(room && !movOk) ? '#b71c1c' : IMPORTANT_EQUIPMENT_COLORS['可動'].border}`,
                                    padding: '1px 4px', borderRadius: '3px', fontSize: '0.65em', fontWeight: 'bold'
                                }}>
                                    可動{room && !movOk ? '×' : ''}
                                </span>
                            )}
                            {/* 必須設備（不足: 赤ベタ） */}
                            {(subject.mandatoryEquipment || []).map(eq => {
                                const ok = eqMatch(eq);
                                const style = getEquipmentStyle(eq);
                                return (
                                    <span key={`m-${eq}`} style={{
                                        background: (room && !ok) ? '#d32f2f' : style.bg,
                                        color: (room && !ok) ? '#fff' : style.text,
                                        border: `1px solid ${(room && !ok) ? '#b71c1c' : style.border}`,
                                        padding: '1px 4px', borderRadius: '3px', fontSize: '0.65em', fontWeight: 'bold'
                                    }}>
                                        {eq}{room && !ok ? '×' : ''}
                                    </span>
                                );
                            })}
                            {/* 希望設備（不足: 橙ベタ） */}
                            {(subject.requiredEquipment || []).map(eq => {
                                const ok = eqMatch(eq);
                                const style = getEquipmentStyle(eq);
                                return (
                                    <span key={`r-${eq}`} style={{
                                        background: (room && !ok) ? '#d32f2f' : style.bg,
                                        color: (room && !ok) ? '#fff' : style.text,
                                        border: `1px solid ${(room && !ok) ? '#b71c1c' : style.border}`,
                                        padding: '1px 4px', borderRadius: '3px', fontSize: '0.65em', fontWeight: 'bold'
                                    }}>
                                        {eq}{room && !ok ? '×' : ''}
                                    </span>
                                );
                            })}
                            {/* 希望学舎（不一致: 橙ベタ） */}
                            {subject.buildingPreference && (
                                <span style={{
                                    background: (room && !bldOk) ? '#d32f2f' : '#f5f5f5',
                                    color: (room && !bldOk) ? '#fff' : '#666',
                                    border: `1px solid ${(room && !bldOk) ? '#b71c1c' : '#ddd'}`,
                                    padding: '1px 4px', borderRadius: '3px', fontSize: '0.65em', fontWeight: 'bold'
                                }}>
                                    {subject.buildingPreference}棟{room && !bldOk ? '×' : ''}
                                </span>
                            )}
                        </div>
                    );
                })()}

                {displayConfig.showPreviousRooms && (
                    <div style={{ fontSize: '0.65em', color: '#999', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '2px' }}>
                        参考: {subject.previousRooms && subject.previousRooms.length > 0 ? subject.previousRooms.join(',') : 'なし'}
                    </div>
                )}


                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', gap: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', overflow: 'hidden' }}>
                        <span style={{ fontSize: '0.85em', fontWeight: 'bold', color: '#666', whiteSpace: 'nowrap' }}>{subject.department}</span>
                        {/* 複数教室配当の進捗表示 */}
                        {displayConfig.showAllocationProgress && (() => {
                            const requiredCount = subject.requiredRoomCount || 1;
                            const currentCount = allocations.filter(a => a.subjectId === subject.id).length;
                            return (
                                <span style={{
                                    fontSize: '0.65em', padding: '1px 4px',
                                    background: currentCount >= requiredCount ? '#e8f5e9' : (currentCount > 0 ? '#fff3e0' : '#ffebee'),
                                    color: currentCount >= requiredCount ? '#2e7d32' : (currentCount > 0 ? '#e65100' : '#c62828'),
                                    border: `1px solid ${currentCount >= requiredCount ? '#c8e6c9' : (currentCount > 0 ? '#ffcc80' : '#ef9a9a')}`,
                                    borderRadius: '3px', fontWeight: 'bold', whiteSpace: 'nowrap'
                                }}>
                                    {currentCount}/{requiredCount}室
                                </span>
                            );
                        })()}
                        {(() => {
                            const capOk = !room || room.capacity >= subject.requiredCapacity;
                            return (
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: '2px',
                                    background: (room && !capOk) ? '#d32f2f' : '#f5f5f5',
                                    padding: '1px 4px', borderRadius: '3px',
                                    fontSize: '0.65rem',
                                    color: (room && !capOk) ? '#fff' : '#444',
                                    border: `1px solid ${(room && !capOk) ? '#b71c1c' : '#ddd'}`,
                                    flexShrink: 0
                                }}>
                                    <Users size={10} color={(room && !capOk) ? '#fff' : '#666'} />
                                    <span style={{ fontWeight: 'bold' }}>{subject.requiredCapacity}{room && !capOk ? '×' : ''}</span>
                                </div>
                            );
                        })()}
                    </div>
                    <button
                        onClick={(e) => { e.stopPropagation(); if (room) onRemove(subject.id, room.id); }}
                        style={{
                            border: 'none', background: '#ffebee', cursor: 'pointer', color: '#f44336', fontSize: '9px', borderRadius: '50%', width: '13px', height: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                        }}
                    >✕</button>
                </div>
            </div>
        );
    };

    return (
        <div className="timetable-grid" style={{ width: '100%', height: '100%', overflow: 'auto' }}>
            <table style={{ borderCollapse: 'separate', borderSpacing: 0, width: '100%', tableLayout: 'fixed' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 100 }}>
                    <tr>
                        <th style={{ width: '120px', background: '#f5f5f5', padding: '8px', textAlign: 'left', border: '1px solid #ddd', position: 'sticky', left: 0, top: 0, zIndex: 110, fontSize: '0.85em' }}>教室 / 講時</th>
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
                            {/* 春学期 行 */}
                            <tr>
                                <td
                                    rowSpan={2}
                                    style={{
                                        width: '120px', padding: '6px 8px', border: '1px solid #ddd', background: '#fff',
                                        position: 'sticky', left: 0, zIndex: 4, overflow: 'hidden', verticalAlign: 'top',
                                        cursor: 'pointer', color: '#1976d2', transition: 'all 0.2s'
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
                                        <span style={{ fontWeight: 'bold', fontSize: '1.1em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '75px' }} title={room.name}>{room.name}</span>
                                        {displayConfig.showRoomType && (
                                            <div style={{ display: 'flex', gap: '2px' }}>
                                                <span style={{
                                                    background: room.type === 'pc' ? '#e3f2fd' : room.type === 'seminar' ? '#f3e5f5' : '#f5f5f5',
                                                    color: room.type === 'pc' ? '#1565c0' : room.type === 'seminar' ? '#7b1fa2' : '#666',
                                                    padding: '1px 3px', borderRadius: '2px', fontSize: '0.65em', fontWeight: 'bold', whiteSpace: 'nowrap'
                                                }}>
                                                    {ROOM_TYPE_LABELS[room.type]}
                                                </span>
                                                <span style={{
                                                    background: room.isMovable ? IMPORTANT_EQUIPMENT_COLORS['可動'].bg : IMPORTANT_EQUIPMENT_COLORS['固定'].bg,
                                                    color: room.isMovable ? IMPORTANT_EQUIPMENT_COLORS['可動'].text : IMPORTANT_EQUIPMENT_COLORS['固定'].text,
                                                    border: `1px solid ${room.isMovable ? IMPORTANT_EQUIPMENT_COLORS['可動'].border : IMPORTANT_EQUIPMENT_COLORS['固定'].border}`,
                                                    padding: '1px 3px', borderRadius: '2px', fontSize: '0.65em', fontWeight: 'bold', whiteSpace: 'nowrap'
                                                }}>
                                                    {room.isMovable ? '可動' : '固定'}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                    <div style={{ fontSize: '0.7em', color: '#666', display: 'flex', flexWrap: 'wrap', gap: '3px', marginTop: '6px' }}>
                                        {displayConfig.highlightedEquipment
                                            .filter(e => e !== '可動' && e !== '固定')
                                            .map(e => {
                                                const has = room.equipment.includes(e);
                                                const s = getEquipmentStyle(e);
                                                return (
                                                    <span key={e} style={{
                                                        background: has ? s.bg : '#f5f5f5',
                                                        color: has ? s.text : '#ccc',
                                                        border: `1px solid ${has ? s.border : '#e8e8e8'}`,
                                                        padding: '1px 5px', borderRadius: '10px', fontSize: '0.72em',
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

                                {displayedPeriods.map(p => {
                                    const cellSubjects = getSubjects(room.id, p, 'spring');
                                    const isInRange = draggingSubject && p >= draggingSubject.period && p <= (draggingSubject.endPeriod || draggingSubject.period);
                                    const isScheduleMismatch = draggingSubject && (
                                        (!['spring', 'spring_first', 'spring_second', 'full_year'].includes(draggingSubject.term)) ||
                                        (draggingSubject.day !== day || !isInRange)
                                    );

                                    const dragViolations = draggingSubject ? checkConstraints(draggingSubject, room) : [];
                                    const isUnfit = draggingSubject && !isScheduleMismatch && dragViolations.some(v => v.type === 'error');
                                    const isIdeal = draggingSubject && !isScheduleMismatch && !isUnfit;

                                    return (
                                        <td
                                            key={`${room.id}-${p}-spring`}
                                            style={{
                                                padding: '4px', border: '1px solid #ddd', verticalAlign: 'top',
                                                background: isScheduleMismatch ? '#f0f0f0' : (isIdeal ? '#e6f7ff' : (isUnfit ? '#fff1f0' : (cellSubjects.length > 0 ? (cellSubjects.length > 1 ? '#fff9c4' : '#e3f2fd') : '#fff'))),
                                                opacity: isScheduleMismatch ? 0.6 : 1, transition: 'all 0.2s', position: 'relative', minWidth: '120px',
                                                boxShadow: isIdeal ? 'inset 0 0 0 2px #1890ff' : (isUnfit ? 'inset 0 0 0 1px #ffa39e' : 'none'),
                                                cursor: isScheduleMismatch ? 'not-allowed' : 'copy'
                                            }}
                                            onDragOver={(e) => {
                                                if (!isScheduleMismatch) handleDragOver(e);
                                            }}
                                            onDrop={(e) => {
                                                if (!isScheduleMismatch) handleDrop(e, room.id, p, 'spring');
                                            }}
                                        >
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minHeight: '40px', height: '100%', justifyContent: 'center' }}>
                                                {cellSubjects.map(subject => renderSubjectCard(subject, room))}
                                                <div
                                                    onClick={() => onCellClick(room.id, p, 'spring')}
                                                    style={{ fontSize: '10px', color: '#ccc', textAlign: 'center', cursor: 'pointer', padding: '4px', border: '1px dashed transparent', borderRadius: '4px' }}
                                                    onMouseOver={(e) => e.currentTarget.style.borderColor = '#ddd'}
                                                    onMouseOut={(e) => e.currentTarget.style.borderColor = 'transparent'}
                                                >
                                                    + 追加
                                                </div>
                                            </div>
                                        </td>
                                    );
                                })}
                            </tr>

                            {/* 秋学期 行 */}
                            <tr>
                                <td style={{ width: '40px', border: '1px solid #ddd', background: '#fff9f0', textAlign: 'center', fontSize: '0.75em', color: '#f57c00', fontWeight: 'bold' }}>秋</td>
                                {
                                    displayedPeriods.map(p => {
                                        const cellSubjects = getSubjects(room.id, p, 'autumn');
                                        const isInRange = draggingSubject && p >= draggingSubject.period && p <= (draggingSubject.endPeriod || draggingSubject.period);
                                        const isScheduleMismatch = draggingSubject && (
                                            (!['autumn', 'autumn_first', 'autumn_second', 'full_year'].includes(draggingSubject.term)) ||
                                            (draggingSubject.day !== day || !isInRange)
                                        );

                                        const dragViolations = draggingSubject ? checkConstraints(draggingSubject, room) : [];
                                        const isUnfit = draggingSubject && !isScheduleMismatch && dragViolations.some(v => v.type === 'error');
                                        const isIdeal = draggingSubject && !isScheduleMismatch && !isUnfit;

                                        return (
                                            <td
                                                key={`${room.id}-${p}-autumn`}
                                                style={{
                                                    padding: '4px', border: '1px solid #ddd', verticalAlign: 'top',
                                                    background: isScheduleMismatch ? '#f0f0f0' : (isIdeal ? '#e6f7ff' : (isUnfit ? '#fff1f0' : (cellSubjects.length > 0 ? (cellSubjects.length > 1 ? '#fff9c4' : '#e3f2fd') : '#fff'))),
                                                    opacity: isScheduleMismatch ? 0.6 : 1, transition: 'all 0.2s', position: 'relative', minWidth: '120px',
                                                    boxShadow: isIdeal ? 'inset 0 0 0 2px #1890ff' : (isUnfit ? 'inset 0 0 0 1px #ffa39e' : 'none'),
                                                    cursor: isScheduleMismatch ? 'not-allowed' : 'copy'
                                                }}
                                                onDragOver={(e) => {
                                                    if (!isScheduleMismatch) handleDragOver(e);
                                                }}
                                                onDrop={(e) => {
                                                    if (!isScheduleMismatch) handleDrop(e, room.id, p, 'autumn');
                                                }}
                                            >
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minHeight: '40px', height: '100%', justifyContent: 'center' }}>
                                                    {cellSubjects.map(subject => renderSubjectCard(subject, room))}
                                                    <div
                                                        onClick={() => onCellClick(room.id, p, 'autumn')}
                                                        style={{ fontSize: '10px', color: '#ccc', textAlign: 'center', cursor: 'pointer', padding: '4px', border: '1px dashed transparent', borderRadius: '4px' }}
                                                        onMouseOver={(e) => e.currentTarget.style.borderColor = '#ddd'}
                                                        onMouseOut={(e) => e.currentTarget.style.borderColor = 'transparent'}
                                                    >
                                                        + 追加
                                                    </div>
                                                </div>
                                            </td>
                                        );
                                    })
                                }
                            </tr>
                        </React.Fragment>
                    ))}
                </tbody>
            </table >
        </div >
    );
};
