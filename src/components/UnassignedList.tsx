import { useState, useMemo } from 'react';
import type { Subject, Term, DayOfWeek, Allocation } from '../types';
import { DAY_LABELS, getEquipmentStyle, IMPORTANT_EQUIPMENT_COLORS, ROOM_TYPE_LABELS } from '../types';
import { Users } from 'lucide-react';

interface Props {
    subjects: Subject[];
    allocations: Allocation[]; // 配当状況表示用
    onReorder: (newOrder: Subject[]) => void;
    onDragStart?: (id: string) => void;
    onDragEnd?: () => void;
    onEdit?: (id: string) => void;
    onRemoveAllocation?: (subjectId: string, classroomId: string) => void;
}

export const UnassignedList = ({ subjects, allocations, onReorder, onDragStart, onDragEnd, onEdit, onRemoveAllocation }: Props) => {
    const roomTypeStyle: Record<string, { bg: string; text: string; border: string }> = {
        normal: { bg: '#f5f5f5', text: '#666', border: '#ddd' },
        pc: IMPORTANT_EQUIPMENT_COLORS['PC'],
        seminar: { bg: '#f3e5f5', text: '#7b1fa2', border: '#e1bee7' }
    };
    const [selectedTerms, setSelectedTerms] = useState<Set<Term>>(new Set());
    const [selectedDays, setSelectedDays] = useState<Set<DayOfWeek>>(new Set());
    const [selectedPeriods, setSelectedPeriods] = useState<Set<string>>(new Set());
    const [selectedDepartments, setSelectedDepartments] = useState<Set<string>>(new Set());
    const [isTermOpen, setIsTermOpen] = useState(false);
    const [isDayOpen, setIsDayOpen] = useState(false);
    const [isPeriodOpen, setIsPeriodOpen] = useState(false);
    const [isDeptOpen, setIsDeptOpen] = useState(false);

    // 存在する時限のパターン（1, 1-2 など）を抽出し、標準的なパターンを追加
    const periodPatterns = useMemo(() => {
        const found = subjects.map(s =>
            s.endPeriod && s.endPeriod > s.period ? `${s.period}-${s.endPeriod}` : `${s.period}`
        );
        return Array.from(new Set([...found, '2-4', '3-5'])).sort((a, b) => {
            const aIsMulti = a.includes('-');
            const bIsMulti = b.includes('-');
            if (aIsMulti !== bIsMulti) return aIsMulti ? 1 : -1;
            const [aStart, aEnd] = a.split('-').map(Number);
            const [bStart, bEnd] = b.split('-').map(Number);
            if (aStart !== bStart) return aStart - bStart;
            return (aEnd || 0) - (bEnd || 0);
        });
    }, [subjects]);

    // 管轄の一覧を動的に生成
    const departments = useMemo(() => {
        return Array.from(new Set(subjects.map(s => s.department))).sort();
    }, [subjects]);

    const filteredSubjects = subjects.filter(s => {
        // 学期フィルタ
        if (selectedTerms.size > 0) {
            if (!selectedTerms.has(s.term)) return false;
        }
        // 曜日フィルタ
        if (selectedDays.size > 0) {
            if (!selectedDays.has(s.day)) return false;
        }
        // 時限フィルタ
        if (selectedPeriods.size > 0) {
            const pattern = s.endPeriod && s.endPeriod > s.period ? `${s.period}-${s.endPeriod}` : `${s.period}`;
            if (!selectedPeriods.has(pattern)) return false;
        }
        // 管轄フィルタ
        if (selectedDepartments.size > 0) {
            if (!selectedDepartments.has(s.department)) return false;
        }
        return true;
    });

    const toggleFilter = <T extends any>(set: Set<T>, setter: (s: Set<T>) => void, value: T) => {
        const next = new Set(set);
        if (next.has(value)) next.delete(value);
        else next.add(value);
        setter(next);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const handleDrop = (e: React.DragEvent, index: number) => {
        const dragType = e.dataTransfer.getData('dragType');
        if (dragType !== 'assign') return;

        const subjectId = e.dataTransfer.getData('subjectId');
        const fromClassroomId = e.dataTransfer.getData('fromClassroomId');

        // グリッドからのドロップ（割り当て解除）
        if (fromClassroomId && subjectId && onRemoveAllocation) {
            onRemoveAllocation(subjectId, fromClassroomId);
            return;
        }

        // リスト内の並び替え
        const fromIndexStr = e.dataTransfer.getData('index');
        if (!fromIndexStr) return;

        const fromIndex = parseInt(fromIndexStr, 10);
        const newOrder = [...subjects];
        const [moved] = newOrder.splice(fromIndex, 1);
        newOrder.splice(index, 0, moved);
        onReorder(newOrder);
    };

    const handleDragEnd = () => {
        onDragEnd?.();
    };

    // 共通のフィルタドロップダウンコンポーネント
    const FilterDropdown = ({ label, options, selected, onToggle, isOpen, setIsOpen, getLabel }: any) => (
        <div style={{ position: 'relative', flex: 1 }}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    width: '100%', fontSize: '0.75rem', padding: '4px 6px', borderRadius: '4px',
                    border: '1px solid #ccc', background: '#fff', textAlign: 'left',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer'
                }}
            >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
                    <div style={{
                        position: 'absolute', top: '100%', left: 0, width: '100%', background: '#fff',
                        border: '1px solid #ccc', borderRadius: '4px', marginTop: '2px', zIndex: 101,
                        maxHeight: '200px', overflowY: 'auto', boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                    }}>
                        {options.map((opt: any) => (
                            <label key={opt.value} style={{
                                display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px',
                                fontSize: '0.75rem', cursor: 'pointer', borderBottom: '1px solid #f0f0f0'
                            }}>
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

    return (
        <div
            style={{
                height: '100%', padding: '15px', background: '#f8f9fa',
                display: 'flex', flexDirection: 'column', gap: '10px',
                border: '2px dashed transparent', // ドラッグオーバー用地
                overflow: 'hidden' // 全体はスクロールさせず、中身で制御
            }}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, 0)} // コンテナへのドロップは先頭への移動または解除
        >
            <div style={{ borderBottom: '1px solid #ddd', paddingBottom: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <h3 style={{ margin: 0, fontSize: '1.0rem', color: '#333' }}>
                        未配当 ({filteredSubjects.length})
                    </h3>
                    {(selectedTerms.size > 0 || selectedDays.size > 0 || selectedPeriods.size > 0 || selectedDepartments.size > 0) && (
                        <button
                            onClick={() => {
                                setSelectedTerms(new Set());
                                setSelectedDays(new Set());
                                setSelectedPeriods(new Set());
                                setSelectedDepartments(new Set());
                            }}
                            style={{
                                background: '#eee', border: '1px solid #ccc', borderRadius: '4px',
                                fontSize: '0.7rem', padding: '2px 8px', cursor: 'pointer'
                            }}
                        >
                            すべて表示
                        </button>
                    )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', gap: '4px' }}>
                        <FilterDropdown
                            label="すべての学期"
                            options={[
                                { value: 'spring', label: '春学期' },
                                { value: 'autumn', label: '秋学期' },
                                { value: 'full_year', label: '通年' }
                            ]}
                            selected={selectedTerms}
                            onToggle={(val: Term) => toggleFilter(selectedTerms, setSelectedTerms, val)}
                            isOpen={isTermOpen}
                            setIsOpen={setIsTermOpen}
                            getLabel={(val: Term) => val === 'spring' ? '春学期' : val === 'autumn' ? '秋学期' : '通年'}
                        />
                        <FilterDropdown
                            label="すべての曜日"
                            options={Object.entries(DAY_LABELS).map(([val, label]) => ({ value: val, label: `${label}曜日` }))}
                            selected={selectedDays}
                            onToggle={(val: DayOfWeek) => toggleFilter(selectedDays, setSelectedDays, val)}
                            isOpen={isDayOpen}
                            setIsOpen={setIsDayOpen}
                            getLabel={(val: DayOfWeek) => DAY_LABELS[val]}
                        />
                    </div>
                    <FilterDropdown
                        label="すべての時限"
                        options={periodPatterns.map(p => ({ value: p, label: `${p}講時` }))}
                        selected={selectedPeriods}
                        onToggle={(val: string) => toggleFilter(selectedPeriods, setSelectedPeriods, val)}
                        isOpen={isPeriodOpen}
                        setIsOpen={setIsPeriodOpen}
                        getLabel={(val: string) => `${val}講時`}
                    />
                    <FilterDropdown
                        label="すべての管轄"
                        options={departments.map(d => ({ value: d, label: d }))}
                        selected={selectedDepartments}
                        onToggle={(val: string) => toggleFilter(selectedDepartments, setSelectedDepartments, val)}
                        isOpen={isDeptOpen}
                        setIsOpen={setIsDeptOpen}
                        getLabel={(val: string) => val}
                    />
                </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {filteredSubjects.map((subject, index) => (
                    <div
                        key={subject.id}
                        draggable
                        onDragStart={(e) => {
                            // 順序入れ替え用のインデックスをセット
                            e.dataTransfer.setData('index', index.toString());
                            // 割り当て用のIDをセット
                            e.dataTransfer.setData('subjectId', subject.id);
                            // タイプをブラウザ共通の 'assign' に統一
                            e.dataTransfer.setData('dragType', 'assign');
                            onDragStart?.(subject.id);
                        }}
                        onDragEnd={handleDragEnd}
                        onDrop={(e) => handleDrop(e, index)}
                        style={{
                            padding: '8px 10px',
                            background: '#fff',
                            border: '1px solid #ddd',
                            borderRadius: '6px',
                            cursor: 'grab',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                            display: 'flex',
                            flexDirection: 'column',
                            minHeight: '120px',
                            gap: '4px'
                        }}
                    >
                        <div style={{ flex: 1 }}>
                            <div style={{
                                fontWeight: 'bold', overflowWrap: 'anywhere', wordBreak: 'break-word', fontSize: '0.85rem', lineHeight: '1.3', marginBottom: '2px'
                            }}>
                                <span
                                    onClick={(e) => { e.stopPropagation(); onEdit?.(subject.id); }}
                                    style={{ cursor: 'pointer', color: '#1976d2' }}
                                >
                                    {subject.name}
                                </span>
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '1px' }}>
                                {subject.teacher} ({subject.faculty})
                            </div>
                            <div style={{ fontSize: '0.7rem', color: '#888' }}>
                                {subject.term === 'spring' ? '春' : subject.term === 'autumn' ? '秋' : '通年'} {DAY_LABELS[subject.day]} {subject.period}{subject.endPeriod && subject.endPeriod > subject.period ? `-${subject.endPeriod}` : ''}講時
                            </div>

                            {/* タグ一覧 (希望タイプ・機材) */}
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px', marginTop: '4px', marginBottom: '4px' }}>
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
                                {!!subject.requiresMovable && (
                                    <span style={{
                                        fontSize: '0.65em', padding: '1px 4px',
                                        background: IMPORTANT_EQUIPMENT_COLORS['可動'].bg,
                                        color: IMPORTANT_EQUIPMENT_COLORS['可動'].text,
                                        border: `1px solid ${IMPORTANT_EQUIPMENT_COLORS['可動'].border}`,
                                        borderRadius: '3px', fontWeight: 'bold'
                                    }}>可動</span>
                                )}
                                {(subject.requiredEquipment || []).map(eq => {
                                    const style = getEquipmentStyle(eq);
                                    return (
                                        <span key={eq} style={{
                                            fontSize: '0.65em', padding: '1px 4px',
                                            background: style.bg, color: style.text, border: `1px solid ${style.border}`,
                                            borderRadius: '3px', fontWeight: 'bold'
                                        }}>{eq}</span>
                                    );
                                })}
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
                                参考: {subject.previousRooms && subject.previousRooms.length > 0 ? subject.previousRooms.join(', ') : 'なし'}
                            </div>
                        </div>

                        {/* 人数バッジを下部に配置 */}
                        <div style={{
                            marginTop: '2px',
                            paddingTop: '2px',
                            borderTop: '1px dashed #eee',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: '4px'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontSize: '0.85em', fontWeight: 'bold', color: '#666' }}>{subject.department}</span>
                                {/* 複数教室が必要な場合の配当状況表示 */}
                                {(() => {
                                    const realId = (subject as any)._realId || subject.id;
                                    const requiredCount = subject.requiredRoomCount || 1;
                                    const currentCount = allocations.filter(a => a.subjectId === realId).length;
                                    // 必要数に関わらず表示（ユーザー要望：配当していないときにも何教室必要なのかわかるように）
                                    return (
                                        <span style={{
                                            fontSize: '0.65em', padding: '1px 5px',
                                            background: currentCount >= requiredCount ? '#e8f5e9' : (currentCount > 0 ? '#fff3e0' : '#ffebee'),
                                            color: currentCount >= requiredCount ? '#2e7d32' : (currentCount > 0 ? '#e65100' : '#c62828'),
                                            border: `1px solid ${currentCount >= requiredCount ? '#c8e6c9' : (currentCount > 0 ? '#ffcc80' : '#ef9a9a')}`,
                                            borderRadius: '3px', fontWeight: 'bold'
                                        }}>
                                            {currentCount}/{requiredCount}室
                                        </span>
                                    );
                                })()}
                            </div>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                background: '#f5f5f5',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                fontSize: '0.7rem',
                                color: '#444',
                                border: '1px solid #ddd'
                            }}>
                                <Users size={12} color="#666" />
                                <span style={{ fontWeight: 'bold' }}>{subject.requiredCapacity}名</span>
                            </div>
                        </div>
                    </div>
                ))}

                {subjects.length === 0 && (
                    <div style={{
                        textAlign: 'center', padding: '40px 20px', color: '#999',
                        border: '2px dashed #eee', borderRadius: '8px'
                    }}>
                        すべての科目が割り当てられました
                    </div>
                )}
            </div>
        </div>
    );
};
