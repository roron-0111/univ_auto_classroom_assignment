import { useState, useRef, useEffect, useMemo } from 'react';
import type { Subject, Allocation, Classroom, Term, DayOfWeek, Period } from '../types';
import { DAY_LABELS, BUILDINGS, TERM_LABELS, ROOM_TYPE_LABELS } from '../types';
import { BookOpen, Plus, Edit2, Trash2, X, Check, Upload, Download, Search } from 'lucide-react';
import { parseSubjectCSV, exportToCSV } from '../utils/csvParser';
import { SubjectEditModal } from './SubjectEditModal';
import { normalizeRequiredEquipmentName } from '../types';
import { SUBJECT_EQUIPMENT_CHOICES, filterVisibleRoomEquipment } from '../utils/equipmentVisibility';
import { SUBJECT_IMPORT_REQUIRED_COLUMNS } from '../utils/csvParser';

function equipValue(
    eq: string,
    requiresMovable?: boolean,
    requiresProjector?: boolean,
    mandatory?: string[],
    preferred?: string[]
): string {
    const man = (mandatory ?? []).map(normalizeRequiredEquipmentName);
    const pref = (preferred ?? []).map(normalizeRequiredEquipmentName);
    const normalizedEq = normalizeRequiredEquipmentName(eq);
    const manHasProjector = man.some(item => item === 'PJ');
    const prefHasProjector = pref.some(item => item === 'PJ');
    if (requiresMovable && normalizedEq === '可動') return '◎';
    if (normalizedEq === 'PJ') {
        if (requiresProjector || manHasProjector) return '◎';
        if (prefHasProjector) return '○';
    }
    if (man.includes(normalizedEq)) return '◎';
    if (pref.includes(normalizedEq)) return '○';
    return '';
}

interface Props {
    subjects: Subject[];
    allocations: Allocation[];
    classrooms: Classroom[];
    onUpdate: (updated: Subject[]) => void;
    onClose: () => void;
}

// マルチセレクトドロップダウンコンポーネント
const MultiSelectFilter = ({
    options,
    selected,
    onChange,
    placeholder = '全て'
}: {
    options: { value: string | number, label: string }[],
    selected: (string | number)[],
    onChange: (values: (string | number)[]) => void,
    placeholder?: string
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleOption = (value: string | number) => {
        const newSelected = selected.includes(value)
            ? selected.filter(v => v !== value)
            : [...selected, value];
        onChange(newSelected);
    };

    const displayText = selected.length === 0
        ? placeholder
        : selected.length === 1
            ? options.find(o => o.value === selected[0])?.label || selected[0]
            : `${selected.length}項目選択`;

    return (
        <div ref={dropdownRef} style={{ position: 'relative', width: '100%', userSelect: 'none' }}>
            <div
                onMouseDown={(e) => {
                    e.stopPropagation();
                    setIsOpen(!isOpen);
                }}
                style={{
                    padding: '4px 6px',
                    borderRadius: '4px',
                    border: '1px solid #ccc',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    background: '#fff',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    minHeight: '26px',
                    gap: '4px'
                }}
                className="hover:border-blue-400"
            >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{displayText}</span>
                <span style={{ fontSize: '0.6rem', color: '#888', flexShrink: 0 }}>{isOpen ? '▲' : '▼'}</span>
            </div>
            {isOpen && (
                <div
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        width: 'auto',
                        minWidth: 'max(140px, 100%)',
                        maxHeight: '350px',
                        overflowY: 'auto',
                        background: '#fff',
                        border: '1px solid #ccc',
                        borderRadius: '6px',
                        boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
                        zIndex: 5000,
                        marginTop: '4px'
                    }}
                >
                    <div
                        onClick={() => { onChange([]); }}
                        style={{ padding: '8px 10px', cursor: 'pointer', borderBottom: '1px solid #eee', fontSize: '0.8rem', color: '#666', background: '#f9f9f9', fontWeight: 'bold' }}
                    >
                        (選択解除)
                    </div>
                    {options.map(opt => (
                        <div
                            key={opt.value}
                            onClick={(e) => { e.stopPropagation(); toggleOption(opt.value); }}
                            style={{
                                padding: '8px 12px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                fontSize: '0.8rem',
                                background: selected.includes(opt.value) ? '#f0f4ff' : 'transparent',
                                transition: 'background 0.1s'
                            }}
                            className="hover:bg-gray-100"
                        >
                            <input
                                type="checkbox"
                                checked={selected.includes(opt.value)}
                                readOnly
                                style={{ margin: 0, cursor: 'pointer', pointerEvents: 'none' }}
                            />
                            <span style={{ flex: 1 }}>{opt.label}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const SM_COL_DEFS = [
    { key: 'code', label: 'コード', width: 70 },
    { key: 'name', label: '時間割名称', width: 208 },
    { key: 'teacherCode', label: '教員コード', width: 90 },
    { key: 'teacher', label: '教員', width: 104 },
    { key: 'faculty', label: '学部', width: 78 },
    { key: 'department', label: '管轄', width: 50 },
    { key: 'term', label: '学期', width: 77 },
    { key: 'day', label: '曜日', width: 60 },
    { key: 'period', label: '講時', width: 70 },
    { key: 'campus', label: 'キャンパス', width: 70 },
    { key: 'requiredCapacity', label: '定員', width: 90 },
    { key: 'priority', label: '優先度', width: 65 },
    { key: 'requiredRoomCount', label: '数', width: 55 },
    { key: 'buildingPreference', label: '希望建物', width: 60 },
    { key: 'preferredRoomType', label: 'タイプ', width: 60 },
    { key: 'requiredEquipment', label: '機材･設備', width: 130 },
    { key: 'previousRooms', label: '過去教室', width: 80 },
    { key: 'allocatedRoom', label: '配当教室', width: 100 },
] as const;
type SMColKey = typeof SM_COL_DEFS[number]['key'];
type SMColConfig = Record<SMColKey, { width: number; hidden: boolean }>;
const smColDefaults = (): SMColConfig => Object.fromEntries(SM_COL_DEFS.map(c => [c.key, { width: c.width, hidden: false }])) as SMColConfig;

const mergeSubjectsByCode = (existing: Subject[], imported: Subject[]) => {
    const next = [...existing];
    imported.forEach(subject => {
        const key = (subject.code || '').trim() || subject.id;
        const index = next.findIndex(item => ((item.code || '').trim() || item.id) === key);
        if (index >= 0) {
            const current = next[index];
            next[index] = { ...current, ...subject, id: current.id };
        } else {
            next.push(subject);
        }
    });
    return next;
};

export const SubjectManager = ({ subjects, allocations, classrooms, onUpdate, onClose }: Props) => {
    const [editingSubjectModal, setEditingSubjectModal] = useState<Subject | null>(null);
    const [editForm, setEditForm] = useState<Partial<Subject>>({});
    const [isAdding, setIsAdding] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [colConfig, setColConfig] = useState<SMColConfig>(() => {
        try { const s = localStorage.getItem('smColConfig'); if (s) return { ...smColDefaults(), ...JSON.parse(s) }; } catch {}
        return smColDefaults();
    });
    const [showColSettings, setShowColSettings] = useState(false);
    const smColSettingsRef = useRef<HTMLDivElement>(null);
    useEffect(() => { localStorage.setItem('smColConfig', JSON.stringify(colConfig)); }, [colConfig]);
    useEffect(() => {
        if (!showColSettings) return;
        const handler = (event: MouseEvent) => {
            if (smColSettingsRef.current && !smColSettingsRef.current.contains(event.target as Node)) {
                setShowColSettings(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [showColSettings]);
    const smShow = (k: SMColKey) => !colConfig[k].hidden;
    const smW = (k: SMColKey) => `${colConfig[k].width}px`;
    const smToggle = (k: SMColKey) => setColConfig(c => ({ ...c, [k]: { ...c[k], hidden: !c[k].hidden } }));
    const smSetW = (k: SMColKey, w: number) => setColConfig(c => ({ ...c, [k]: { ...c[k], width: Math.max(30, w) } }));
    const [showCsvHint, setShowCsvHint] = useState(false);
    const csvHintRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!showCsvHint) return;
        const handler = (e: MouseEvent) => { if (csvHintRef.current && !csvHintRef.current.contains(e.target as Node)) setShowCsvHint(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [showCsvHint]);

    const smDrag = (k: SMColKey) => (e: React.MouseEvent) => {
        e.preventDefault(); e.stopPropagation();
        const x0 = e.clientX, w0 = colConfig[k].width;
        const onMove = (ev: MouseEvent) => smSetW(k, w0 + ev.clientX - x0);
        const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    };
    const smRH = (k: SMColKey) => <div onMouseDown={smDrag(k)} style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '5px', cursor: 'col-resize', zIndex: 1 }} />;

    const availableEquipment = useMemo(() => {
        const set = new Set<string>(SUBJECT_EQUIPMENT_CHOICES);
        classrooms.forEach(c => filterVisibleRoomEquipment(c.equipment).forEach(e => set.add(e)));
        return Array.from(set);
    }, [classrooms]);

    // フィルタステート（配列で保持）
    const [filters, setFilters] = useState({
        code: '',
        name: '',
        teacherCode: '',
        teacher: '',
        faculty: [] as string[],
        department: [] as string[],
        term: [] as Term[],
        day: [] as DayOfWeek[],
        period: [] as string[],
        campus: '',
        requiredCapacity: '',
        requiredCapacityMax: '',
        priority: [] as number[],
        requiredRoomCount: [] as number[],
        buildingPreference: [] as string[],
        preferredRoomType: [] as string[],
        previousRooms: '',
        requiredEquipment: ''
    });

    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

    // 講時フィルタ用：実データから存在する単/複数講時パターンを抽出し、
    // かつ「2-4」「3-5」などの標準的なパターンを確実に追加する
    const periodOptions = useMemo(() => {
        const found = subjects.map(s =>
            s.endPeriod && s.endPeriod > s.period ? `${s.period}-${s.endPeriod}` : `${s.period}`
        );
        const patterns = Array.from(new Set([...found, '2-4', '3-5'])).sort((a, b) => {
            const aIsMulti = a.includes('-');
            const bIsMulti = b.includes('-');
            if (aIsMulti !== bIsMulti) return aIsMulti ? 1 : -1;
            const [aStart, aEnd] = a.split('-').map(Number);
            const [bStart, bEnd] = b.split('-').map(Number);
            if (aStart !== bStart) return aStart - bStart;
            return (aEnd || 0) - (bEnd || 0);
        });
        return patterns.map(p => ({ value: p, label: `${p}講時` }));
    }, [subjects]);

    const handleEdit = (subject: Subject) => {
        setEditingSubjectModal(subject);
    };

    // フィルタリング処理（メモ化）
    const filteredSubjects = useMemo(() => {
        return subjects.filter(s => {
            // テキスト系：スペース区切りOR検索
            const checkText = (text: any, query: string) => {
                if (!query) return true;
                const keywords = query.toLowerCase().split(/\s+/).filter(k => !!k);
                if (keywords.length === 0) return true;
                const target = String(text || '').toLowerCase();
                return keywords.every(k => target.includes(k));
            };

            if (!checkText(s.code, filters.code)) return false;
            if (!checkText(s.name, filters.name)) return false;
            if (!checkText(s.teacherCode || '', filters.teacherCode)) return false;
            if (!checkText(s.teacher, filters.teacher)) return false;

            // 選択系：配列に含まれているか
            if (filters.faculty.length > 0 && !filters.faculty.includes(s.faculty)) return false;
            if (filters.department.length > 0 && !filters.department.includes(s.department)) return false;
            if (filters.term.length > 0 && !filters.term.includes(s.term)) return false;
            if (filters.day.length > 0 && !filters.day.includes(s.day)) return false;
            // 講時フィルタ: 「1-2」形式の文字列で比較
            if (filters.period.length > 0) {
                const pattern = s.endPeriod && s.endPeriod > s.period ? `${s.period}-${s.endPeriod}` : `${s.period}`;
                if (!filters.period.includes(pattern)) return false;
            }
            if (filters.priority.length > 0 && !filters.priority.includes(s.priority)) return false;
            if (filters.buildingPreference.length > 0 && (!s.buildingPreference || !filters.buildingPreference.some(b => s.buildingPreference?.includes(b)))) return false;
            if (filters.preferredRoomType.length > 0 && (!s.preferredRoomType || !filters.preferredRoomType.includes(s.preferredRoomType))) return false;

            // 数値系
            if (filters.requiredCapacity && s.requiredCapacity < Number(filters.requiredCapacity)) return false;
            if (filters.requiredCapacityMax && s.requiredCapacity > Number(filters.requiredCapacityMax)) return false;
            if (filters.requiredRoomCount.length > 0 && !filters.requiredRoomCount.includes(s.requiredRoomCount || 1)) return false;

            // テキスト系（配列など）
            if (filters.campus && !checkText(s.campus || '', filters.campus)) return false;
            if (filters.previousRooms && !checkText(s.previousRooms?.join(' ') || '', filters.previousRooms)) return false;
            if (filters.requiredEquipment && !checkText(s.requiredEquipment?.join(' ') || '', filters.requiredEquipment)) return false;

            return true;
        });
    }, [subjects, filters]);

    // ソート処理（メモ化）
    const sortedSubjects = useMemo(() => {
        return [...filteredSubjects].sort((a, b) => {
            if (!sortConfig) return 0;
            const { key, direction } = sortConfig;

            const getValue = (obj: any, k: string) => {
                if (!obj) return '';
                const val = obj[k];
                if (k === 'period' || k === 'requiredRoomCount' || k === 'requiredCapacity' || k === 'priority') {
                    return Number(val || 0);
                }
                if (k === 'term') {
                    const order: Record<string, number> = { spring: 1, spring_first: 2, spring_second: 3, autumn: 4, autumn_first: 5, autumn_second: 6, full_year: 7 };
                    return order[val] ?? 8;
                }
                if (k === 'day') return Object.keys(DAY_LABELS).indexOf(val || 'mon');
                if (Array.isArray(val)) return val.join(',');
                return String(val || '').toLowerCase();
            };

            const aVal = getValue(a, key);
            const bVal = getValue(b, key);

            if (aVal < bVal) return direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [filteredSubjects, sortConfig]);


    const handleSort = (key: string) => {
        setSortConfig(current => {
            if (current?.key === key) {
                return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
            }
            return { key, direction: 'asc' };
        });
    };

    const handleSave = () => {
        if (!editForm.id || !editForm.name || !editForm.code) {
            alert('時間割名称、時間割コードを入力してください。');
            return;
        }
        if (subjects.find(s => s.id === editForm.id)) {
            alert('その授業IDは既に存在します。');
            return;
        }
        const sanitized = {
            ...editForm,
            requiredEquipment: (editForm.requiredEquipment || []).filter(eq => SUBJECT_EQUIPMENT_CHOICES.includes(eq)),
            mandatoryEquipment: (editForm.mandatoryEquipment || []).filter(eq => SUBJECT_EQUIPMENT_CHOICES.includes(eq))
        } as Subject;
        onUpdate([...subjects, sanitized]);
        setIsAdding(false);
        setEditForm({});
    };

    const handleDelete = (id: string) => {
        if (confirm('本当にこの授業を削除しますか？割り当ても解除されます。')) {
            onUpdate(subjects.filter(s => s.id !== id));
        }
    };

    const handleDeleteAll = () => {
        if (confirm('全ての授業データを削除しますか？この操作は取り消せません。')) {
            onUpdate([]);
        }
    };

    const startAdding = () => {
        setIsAdding(true);
        setEditForm({
            id: 's-' + Date.now(),
            code: '',
            name: '',
            teacherCode: '',
            teacher: '',
            faculty: '',
            department: '他',
            term: 'spring',
            day: 'mon',
            period: 1,
            requiredCapacity: 30,
            priority: 2,
            campus: '寝屋川',
            requiredEquipment: [],
            previousRooms: [],
            requiredRoomCount: 1,
            buildingPreference: ''
        });
    };

    const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const input = e.currentTarget;
        if (input.files && input.files[0]) {
            try {
                const data = await parseSubjectCSV(input.files[0]);
                const sanitized = data.map(subject => ({
                    ...subject,
                    requiredEquipment: (subject.requiredEquipment || []).filter(eq => SUBJECT_EQUIPMENT_CHOICES.includes(eq)),
                    mandatoryEquipment: (subject.mandatoryEquipment || []).filter(eq => SUBJECT_EQUIPMENT_CHOICES.includes(eq))
                }));
                if (confirm(`${data.length}件の授業データを読み込みます。コードが一致する授業は上書きし、一致しないものは追加します。よろしいですか？`)) {
                    onUpdate(mergeSubjectsByCode(subjects, sanitized));
                }
            } catch (err) {
                alert('CSV読み込みエラー: ' + err);
            } finally {
                input.value = '';
            }
        }
    };

    const SortIcon = ({ columnKey }: { columnKey: string }) => {
        if (sortConfig?.key !== columnKey) return <span style={{ color: '#ccc', fontSize: '10px' }}>▲▼</span>;
        return <span style={{ color: '#000', fontSize: '10px' }}>{sortConfig.direction === 'asc' ? '▲' : '▼'}</span>;
    };

    const thStyle = { padding: '8px', border: '1px solid #ddd', cursor: 'pointer', userSelect: 'none' as const, background: '#f5f5f5', fontSize: '0.8rem', whiteSpace: 'nowrap' as const, position: 'sticky' as const, top: 0, zIndex: 10 };
    const filterInputStyle = { width: '100%', padding: '4px', fontSize: '0.8rem', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box' as const };

    return (
        <div className="manager-overlay" style={{
            position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
            background: '#fff', zIndex: 1000, display: 'flex', flexDirection: 'column'
        }}>
            <header style={{
                padding: '15px 30px', background: '#2d2d2d', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <BookOpen size={22} />
                    <h2 style={{ margin: 0, fontSize: '1.2rem' }}>授業管理</h2>
                </div>
                <button onClick={onClose} style={{
                    background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '1.5rem'
                }}><X /></button>
            </header>

            {/* 固定ヘッダーエリア（スクロール外） */}
            <div style={{ flexShrink: 0, padding: '16px 30px 12px', borderBottom: '1px solid #eee' }}>
                <div style={{ maxWidth: '1600px', margin: '0 auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '12px' }}>
                        <div>
                            <p style={{ color: '#666', margin: '0 0 10px 0' }}>授業情報の編集、削除、一括インポートが行えます。</p>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button onClick={startAdding} style={{
                                    display: 'flex', gap: '8px', alignItems: 'center', background: '#646cff', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.9em'
                                }}>
                                    <Plus size={18} /> 新規授業
                                </button>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <button onClick={() => fileInputRef.current?.click()} style={{
                                        display: 'flex', gap: '8px', alignItems: 'center', background: '#555', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.9em'
                                    }}>
                                        <Upload size={18} /> CSVインポート
                                    </button>
                                    <div ref={csvHintRef} style={{ position: 'relative' }}>
                                        <button onClick={() => setShowCsvHint(s => !s)} style={{ cursor: 'pointer', fontSize: '0.8rem', color: '#888', border: '1px solid #bbb', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', userSelect: 'none', flexShrink: 0, background: showCsvHint ? '#f0f4ff' : '#fff', padding: 0 }}>?</button>
                                        {showCsvHint && (
                                            <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 500, background: '#fff', border: '1px solid #ccc', borderRadius: '6px', padding: '10px 14px', width: '300px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', fontSize: '0.8rem', lineHeight: '1.6', marginTop: '4px' }}>
                                                <div style={{ fontWeight: 'bold', marginBottom: '6px', color: '#333' }}>CSVインポート — 列情報</div>
                                                <div style={{ marginBottom: '4px', lineHeight: 1.7 }}>
                                                    <span style={{ color: '#d32f2f', fontWeight: 'bold' }}>必須: </span>
                                                    {SUBJECT_IMPORT_REQUIRED_COLUMNS.map((col, index) => (
                                                        <span key={col.label} style={{ color: '#d32f2f', fontWeight: 'bold' }}>
                                                            {col.label}{index < SUBJECT_IMPORT_REQUIRED_COLUMNS.length - 1 ? '、' : ''}
                                                        </span>
                                                    ))}
                                                </div>
                                                <div style={{ marginBottom: '4px' }}>機材･設備：◎=必須 ○=希望</div>
                                                <div style={{ marginBottom: '4px' }}>※エクスポートCSVをそのまま再インポート可</div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <button onClick={() => {
                                    // エクスポート用にデータを整形（日本語キー、日本語値）
                                    // 複数教室配当がある場合は1教室につき1行で出力
                                    const exportData = subjects.flatMap(s => {
                                        const subjectAllocations = allocations.filter(a => a.subjectId === s.id);
                                        const baseRow: Record<string, any> = {
                                            'コード': s.code,
                                            '時間割名称': s.name,
                                            '教員コード': s.teacherCode || '',
                                            '教員名': s.teacher,
                                            '開講学部': s.faculty,
                                            '管轄': s.department,
                                            '配当期': TERM_LABELS[s.term] || s.term,
                                            '曜日': DAY_LABELS[s.day],
                                            '講時': s.period,
                                            '終了講時': s.endPeriod || s.period,
                                            'キャンパス': s.campus,
                                            '履修者数': s.requiredCapacity,
                                            '優先度': s.priority,
                                            '必要教室数': s.requiredRoomCount,
                                            '棟希望': s.buildingPreference || '',
                                            'タイプ': s.preferredRoomType === 'pc' ? 'PC' : s.preferredRoomType === 'seminar' ? 'ゼミ' : '一般',
                                            '教室(過去教室)': s.previousRooms?.join(', ') || '',
                                        };
                                        // 設備: 1列につき1設備、◎=必須 ○=希望 空=不要
                                        SUBJECT_EQUIPMENT_CHOICES.forEach(eq => {
                                            baseRow[eq] = equipValue(eq, s.requiresMovable, s.requiresProjector, s.mandatoryEquipment, s.requiredEquipment);
                                        });

                                        if (subjectAllocations.length === 0) {
                                            // 未配当：教室情報なしで1行
                                            return [{ ...baseRow, '教室ID': '', '教室名': '', '建物': '', '教室定員': '', '教室試験定員': '', '教室タイプ': '', '教室設備': '' }];
                                        }
                                        // 配当済み：1教室1行
                                        return subjectAllocations.map(alloc => {
                                            const r = classrooms.find(rm => rm.id === alloc.classroomId);
                                            const eqList = r ? [...(r.equipment ?? [])] : [];
                                            if (r?.isMovable) eqList.unshift('可動');
                                            return {
                                                ...baseRow,
                                                '教室ID': r?.id ?? '',
                                                '教室名': r?.name ?? '',
                                                '建物': r?.building ?? '',
                                                '教室定員': r?.capacity ?? '',
                                                '教室試験定員': r?.examCapacity ?? '',
                                                '教室タイプ': r ? (ROOM_TYPE_LABELS[r.type] ?? r.type) : '',
                                                '教室設備': eqList.join(', ')
                                            };
                                        });
                                    });
                                    exportToCSV(exportData, 'subjects_export.csv');
                                }} style={{
                                    display: 'flex', gap: '8px', alignItems: 'center', background: '#1976d2', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.9em'
                                }}>
                                    <Download size={18} /> CSVエクスポート
                                </button>
                                <input type="file" ref={fileInputRef} onChange={handleImportCSV} accept=".csv" style={{ display: 'none' }} />
                                <div ref={smColSettingsRef} style={{ position: 'relative' }}>
                                    <button onClick={() => setShowColSettings(s => !s)} style={{
                                        display: 'flex', gap: '6px', alignItems: 'center', background: '#eee', color: '#333', border: '1px solid #ccc', padding: '8px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.9em'
                                    }}>列設定</button>
                                    {showColSettings && (
                                        <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 200, background: '#fff', border: '1px solid #ddd', borderRadius: '6px', padding: '10px', width: '250px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', marginTop: '4px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                                <span style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>列設定</span>
                                                <button onClick={() => setColConfig(smColDefaults())} style={{ fontSize: '0.75rem', padding: '2px 8px', background: '#f5f5f5', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer' }}>初期値に戻す</button>
                                            </div>
                                            {SM_COL_DEFS.map(col => (
                                                <div key={col.key} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '5px' }}>
                                                    <input type="checkbox" checked={!colConfig[col.key].hidden} onChange={() => smToggle(col.key)} style={{ cursor: 'pointer' }} />
                                                    <span style={{ flex: 1, fontSize: '0.82rem' }}>{col.label}</span>
                                                    <input type="number" value={colConfig[col.key].width} onChange={e => smSetW(col.key, Number(e.target.value))} style={{ width: '54px', fontSize: '0.8rem', border: '1px solid #ddd', borderRadius: '3px', padding: '2px 4px' }} />
                                                    <span style={{ fontSize: '0.7rem', color: '#999' }}>px</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '10px' }}>
                            <div style={{ fontSize: '0.9rem', color: '#666' }}>
                                表示: {sortedSubjects.length} / {subjects.length} 件
                            </div>
                        </div>
                    </div>

                </div>
            </div>
            {/* スクロールエリア（テーブルのみ） */}
            <div style={{ flex: 1, overflow: 'auto' }}>
                <div style={{ maxWidth: '1600px', margin: '0 auto', padding: '0 30px 20px' }}>
                    <div style={{ border: '1px solid #ddd', borderRadius: '4px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', fontSize: '0.85em', minWidth: '1400px' }}>
                            <thead>
                                <tr style={{ background: '#f5f5f5', textAlign: 'left' }}>
                                    {SM_COL_DEFS.filter(col => smShow(col.key)).map(col => (
                                        <th key={col.key} style={{ ...thStyle, width: smW(col.key), overflow: 'visible' }} onClick={() => handleSort(col.key)}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
                                                {col.label}
                                                <SortIcon columnKey={col.key} />
                                            </div>
                                            {smRH(col.key)}
                                        </th>
                                    ))}
                                    <th style={{ ...thStyle, width: '70px', cursor: 'default' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <span>操作</span>
                                        </div>
                                    </th>
                                </tr>
                                <tr style={{ background: '#fafafa', position: 'sticky', top: 37, zIndex: 9 }}>
                                    {smShow('code') && <td style={{ padding: '4px', border: '1px solid #ddd', background: '#fafafa' }}><input style={filterInputStyle} value={filters.code} onChange={e => setFilters({ ...filters, code: e.target.value })} placeholder="検索..." /></td>}
                                    {smShow('name') && <td style={{ padding: '4px', border: '1px solid #ddd', background: '#fafafa' }}><input style={filterInputStyle} value={filters.name} onChange={e => setFilters({ ...filters, name: e.target.value })} placeholder="検索..." /></td>}
                                    {smShow('teacherCode') && <td style={{ padding: '4px', border: '1px solid #ddd', background: '#fafafa' }}><input style={filterInputStyle} value={filters.teacherCode} onChange={e => setFilters({ ...filters, teacherCode: e.target.value })} placeholder="検索..." /></td>}
                                    {smShow('teacher') && <td style={{ padding: '4px', border: '1px solid #ddd', background: '#fafafa' }}><input style={filterInputStyle} value={filters.teacher} onChange={e => setFilters({ ...filters, teacher: e.target.value })} placeholder="検索..." /></td>}
                                    {smShow('faculty') && <td style={{ padding: '4px', border: '1px solid #ddd', background: '#fafafa' }}><MultiSelectFilter options={['理', '経', '国', 'IR', '教', '他'].map(v => ({ value: v, label: v }))} selected={filters.faculty} onChange={v => setFilters({ ...filters, faculty: v as string[] })} /></td>}
                                    {smShow('department') && <td style={{ padding: '4px', border: '1px solid #ddd', background: '#fafafa' }}><MultiSelectFilter options={['理', '工', '法', '経', '文', '国', 'IR', '教', '他'].map(v => ({ value: v, label: v }))} selected={filters.department} onChange={v => setFilters({ ...filters, department: v as string[] })} /></td>}
                                    {smShow('term') && <td style={{ padding: '4px', border: '1px solid #ddd', background: '#fafafa' }}><MultiSelectFilter options={[{value:'spring',label:'春学期'},{value:'spring_first',label:'春前半'},{value:'spring_second',label:'春後半'},{value:'autumn',label:'秋学期'},{value:'autumn_first',label:'秋前半'},{value:'autumn_second',label:'秋後半'},{value:'full_year',label:'通年'}]} selected={filters.term} onChange={v => setFilters({ ...filters, term: v as Term[] })} /></td>}
                                    {smShow('day') && <td style={{ padding: '4px', border: '1px solid #ddd', background: '#fafafa' }}><MultiSelectFilter options={Object.entries(DAY_LABELS).map(([v, l]) => ({ value: v, label: l }))} selected={filters.day} onChange={v => setFilters({ ...filters, day: v as DayOfWeek[] })} /></td>}
                                    {smShow('period') && <td style={{ padding: '4px', border: '1px solid #ddd', background: '#fafafa' }}><MultiSelectFilter options={periodOptions} selected={filters.period} onChange={v => setFilters({ ...filters, period: v as string[] })} /></td>}
                                    {smShow('campus') && <td style={{ padding: '4px', border: '1px solid #ddd', background: '#fafafa' }}><input style={filterInputStyle} value={filters.campus} onChange={e => setFilters({ ...filters, campus: e.target.value })} placeholder="検索..." /></td>}
                                    {smShow('requiredCapacity') && <td style={{ padding: '4px', border: '1px solid #ddd', background: '#fafafa' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                            <input type="number" style={{ ...filterInputStyle, fontSize: '0.72rem', padding: '2px 3px' }} value={filters.requiredCapacity} onChange={e => setFilters({ ...filters, requiredCapacity: e.target.value })} placeholder="以上" title="定員 以上" />
                                            <input type="number" style={{ ...filterInputStyle, fontSize: '0.72rem', padding: '2px 3px' }} value={filters.requiredCapacityMax} onChange={e => setFilters({ ...filters, requiredCapacityMax: e.target.value })} placeholder="以下" title="定員 以下" />
                                        </div>
                                    </td>}
                                    {smShow('priority') && <td style={{ padding: '4px', border: '1px solid #ddd', background: '#fafafa' }}><MultiSelectFilter options={[1, 2, 3].map(v => ({ value: v, label: String(v) }))} selected={filters.priority} onChange={v => setFilters({ ...filters, priority: v as number[] })} /></td>}
                                    {smShow('requiredRoomCount') && <td style={{ padding: '4px', border: '1px solid #ddd', background: '#fafafa' }}><MultiSelectFilter options={[1, 2, 3, 4, 5].map(v => ({ value: v, label: String(v) }))} selected={filters.requiredRoomCount} onChange={v => setFilters({ ...filters, requiredRoomCount: v as number[] })} /></td>}
                                    {smShow('buildingPreference') && <td style={{ padding: '4px', border: '1px solid #ddd', background: '#fafafa' }}><MultiSelectFilter options={BUILDINGS.map(v => ({ value: v, label: v }))} selected={filters.buildingPreference} onChange={v => setFilters({ ...filters, buildingPreference: v as string[] })} /></td>}
                                    {smShow('preferredRoomType') && <td style={{ padding: '4px', border: '1px solid #ddd', background: '#fafafa' }}><MultiSelectFilter options={[{value:'normal',label:'一般'},{value:'pc',label:'PC'},{value:'seminar',label:'ゼミ'}]} selected={filters.preferredRoomType} onChange={v => setFilters({ ...filters, preferredRoomType: v as string[] })} /></td>}
                                    {smShow('requiredEquipment') && <td style={{ padding: '4px', border: '1px solid #ddd', background: '#fafafa' }}><input style={filterInputStyle} value={filters.requiredEquipment} onChange={e => setFilters({ ...filters, requiredEquipment: e.target.value })} placeholder="検索..." /></td>}
                                    {smShow('previousRooms') && <td style={{ padding: '4px', border: '1px solid #ddd', background: '#fafafa' }}><input style={filterInputStyle} value={filters.previousRooms} onChange={e => setFilters({ ...filters, previousRooms: e.target.value })} placeholder="検索..." /></td>}
                                    {smShow('allocatedRoom') && <td style={{ padding: '4px', border: '1px solid #ddd', background: '#fafafa' }}><input style={filterInputStyle} value={(filters as any).allocatedRoom || ''} onChange={e => setFilters({ ...filters, allocatedRoom: e.target.value } as any)} placeholder="検索..." /></td>}
                                    <td style={{ padding: '4px', border: '1px solid #ddd', textAlign: 'center', background: '#fafafa' }}>
                                        <button
                                            onClick={handleDeleteAll}
                                            style={{
                                                fontSize: '0.7rem', padding: '2px 6px', background: '#d32f2f', color: '#fff',
                                                border: 'none', borderRadius: '4px', cursor: 'pointer'
                                            }}
                                        >
                                            全削除
                                        </button>
                                    </td>
                                </tr>
                            </thead>
                            <tbody>
                                {isAdding && (
                                    <tr style={{ background: '#f0f4ff' }}>
                                        {smShow('code') && <td style={{ padding: '8px', border: '1px solid #ddd' }}><input value={editForm.code} onChange={e => setEditForm({ ...editForm, code: e.target.value })} style={{ width: '100%' }} placeholder="A0001" /></td>}
                                        {smShow('name') && <td style={{ padding: '8px', border: '1px solid #ddd' }}><input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} style={{ width: '100%' }} /></td>}
                                        {smShow('teacherCode') && <td style={{ padding: '8px', border: '1px solid #ddd' }}><input value={editForm.teacherCode || ''} onChange={e => setEditForm({ ...editForm, teacherCode: e.target.value })} style={{ width: '100%' }} placeholder="T001" /></td>}
                                        {smShow('teacher') && <td style={{ padding: '8px', border: '1px solid #ddd' }}><input value={editForm.teacher} onChange={e => setEditForm({ ...editForm, teacher: e.target.value })} style={{ width: '100%' }} /></td>}
                                        {smShow('faculty') && <td style={{ padding: '8px', border: '1px solid #ddd' }}><input value={editForm.faculty} onChange={e => setEditForm({ ...editForm, faculty: e.target.value })} style={{ width: '100%' }} placeholder="学部" /></td>}
                                        {smShow('department') && <td style={{ padding: '8px', border: '1px solid #ddd' }}><select value={editForm.department || '他'} onChange={e => setEditForm({ ...editForm, department: e.target.value })} style={{ width: '100%' }}>{['理', '工', '法', '経', '文', '国', 'IR', '教', '他'].map(v => <option key={v} value={v}>{v}</option>)}</select></td>}
                                        {smShow('term') && <td style={{ padding: '8px', border: '1px solid #ddd' }}><select value={editForm.term} onChange={e => setEditForm({ ...editForm, term: e.target.value as Term })} style={{ width: '100%' }}><option value="spring">春学期</option><option value="spring_first">春前半</option><option value="spring_second">春後半</option><option value="autumn">秋学期</option><option value="autumn_first">秋前半</option><option value="autumn_second">秋後半</option><option value="full_year">通年</option></select></td>}
                                        {smShow('day') && <td style={{ padding: '8px', border: '1px solid #ddd' }}><select value={editForm.day} onChange={e => setEditForm({ ...editForm, day: e.target.value as DayOfWeek })} style={{ width: '100%' }}>{Object.entries(DAY_LABELS).map(([val, label]) => <option key={val} value={val}>{label}</option>)}</select></td>}
                                        {smShow('period') && <td style={{ padding: '8px', border: '1px solid #ddd' }}><select value={editForm.period} onChange={e => setEditForm({ ...editForm, period: Number(e.target.value) as Period })} style={{ width: '100%' }}>{[1, 2, 3, 4, 5, 6, 7].map(p => <option key={p} value={p}>{p}</option>)}</select></td>}
                                        {smShow('campus') && <td style={{ padding: '8px', border: '1px solid #ddd' }}><input value={editForm.campus || ''} onChange={e => setEditForm({ ...editForm, campus: e.target.value })} style={{ width: '100%' }} placeholder="キャンパス" /></td>}
                                        {smShow('requiredCapacity') && <td style={{ padding: '8px', border: '1px solid #ddd' }}><input type="number" value={editForm.requiredCapacity} onChange={e => setEditForm({ ...editForm, requiredCapacity: Number(e.target.value) })} style={{ width: '100%' }} /></td>}
                                        {smShow('priority') && <td style={{ padding: '8px', border: '1px solid #ddd' }}><select value={editForm.priority || 1} onChange={e => setEditForm({ ...editForm, priority: Number(e.target.value) })} style={{ width: '100%' }}>{[1, 2, 3].map(p => <option key={p} value={p}>{p}</option>)}</select></td>}
                                        {smShow('requiredRoomCount') && <td style={{ padding: '8px', border: '1px solid #ddd' }}><input type="number" min="1" value={editForm.requiredRoomCount || 1} onChange={e => setEditForm({ ...editForm, requiredRoomCount: Number(e.target.value) })} style={{ width: '100%' }} /></td>}
                                        {smShow('buildingPreference') && <td style={{ padding: '8px', border: '1px solid #ddd' }}><select value={editForm.buildingPreference || ''} onChange={e => setEditForm({ ...editForm, buildingPreference: e.target.value })} style={{ width: '100%', padding: '4px' }}><option value="">(なし)</option>{BUILDINGS.map(b => <option key={b} value={b}>{b}</option>)}</select></td>}
                                        {smShow('preferredRoomType') && <td style={{ padding: '8px', border: '1px solid #ddd' }}><select value={editForm.preferredRoomType || 'normal'} onChange={e => setEditForm({ ...editForm, preferredRoomType: e.target.value as any })} style={{ width: '100%' }}><option value="normal">一般</option><option value="pc">PC</option><option value="seminar">ゼミ</option></select></td>}
                                        {smShow('requiredEquipment') && <td style={{ padding: '8px', border: '1px solid #ddd' }}><input value={editForm.requiredEquipment?.join(' ') || ''} onChange={e => setEditForm({ ...editForm, requiredEquipment: e.target.value.split(/\s+/).filter(Boolean) })} style={{ width: '100%' }} placeholder="例: プロジェクタ 可動" /></td>}
                                        {smShow('previousRooms') && <td style={{ padding: '8px', border: '1px solid #ddd' }}><input value={editForm.previousRooms?.join(',')} onChange={e => setEditForm({ ...editForm, previousRooms: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} style={{ width: '100%' }} placeholder="例: 3-201,3-202" /></td>}
                                        {smShow('allocatedRoom') && <td style={{ padding: '8px', border: '1px solid #ddd' }} />}
                                        <td style={{ padding: '8px', border: '1px solid #ddd' }}>
                                            <div style={{ display: 'flex', gap: '6px' }}>
                                                <button onClick={handleSave} style={{ background: '#2e7d32', color: '#fff', border: 'none', padding: '6px', borderRadius: '4px', cursor: 'pointer' }}><Check size={16} /></button>
                                                <button onClick={() => { setIsAdding(false); setEditForm({}); }} style={{ background: '#d32f2f', color: '#fff', border: 'none', padding: '6px', borderRadius: '4px', cursor: 'pointer' }}><X size={16} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                                {sortedSubjects.map(subject => (
                                    <tr key={subject.id} style={{ borderBottom: '1px solid #eee' }}>
                                        {smShow('code') && <td style={{ padding: '10px', border: '1px solid #ddd', color: '#888' }}>{subject.code}</td>}
                                        {smShow('name') && <td style={{ padding: '10px', border: '1px solid #ddd', fontWeight: 'bold' }}>{subject.name}</td>}
                                        {smShow('teacherCode') && <td style={{ padding: '10px', border: '1px solid #ddd', color: '#888' }}>{subject.teacherCode || ''}</td>}
                                        {smShow('teacher') && <td style={{ padding: '10px', border: '1px solid #ddd' }}>{subject.teacher}</td>}
                                        {smShow('faculty') && <td style={{ padding: '10px', border: '1px solid #ddd' }}>{subject.faculty}</td>}
                                        {smShow('department') && <td style={{ padding: '10px', border: '1px solid #ddd' }}>{subject.department}</td>}
                                        {smShow('term') && <td style={{ padding: '10px', border: '1px solid #ddd' }}>{TERM_LABELS[subject.term] || subject.term}</td>}
                                        {smShow('day') && <td style={{ padding: '10px', border: '1px solid #ddd' }}>{DAY_LABELS[subject.day]}</td>}
                                        {smShow('period') && <td style={{ padding: '10px', border: '1px solid #ddd' }}>{subject.period}{subject.endPeriod && subject.endPeriod !== subject.period ? `-${subject.endPeriod}` : ''}</td>}
                                        {smShow('campus') && <td style={{ padding: '10px', border: '1px solid #ddd' }}>{subject.campus}</td>}
                                        {smShow('requiredCapacity') && <td style={{ padding: '10px', border: '1px solid #ddd' }}>{subject.requiredCapacity}名</td>}
                                        {smShow('priority') && <td style={{ padding: '10px', border: '1px solid #ddd' }}>{subject.priority}</td>}
                                        {smShow('requiredRoomCount') && <td style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'center' }}>{subject.requiredRoomCount || 1}</td>}
                                        {smShow('buildingPreference') && <td style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'center' }}>{subject.buildingPreference}</td>}
                                        {smShow('preferredRoomType') && <td style={{ padding: '10px', border: '1px solid #ddd' }}>{subject.preferredRoomType === 'normal' ? '一般' : subject.preferredRoomType === 'pc' ? 'PC' : subject.preferredRoomType === 'seminar' ? 'ゼミ' : '-'}</td>}
                                        {smShow('requiredEquipment') && <td style={{ padding: '10px', border: '1px solid #ddd', fontSize: '0.85em' }}>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px' }}>
                                                {subject.requiredEquipment?.filter(eq => SUBJECT_EQUIPMENT_CHOICES.includes(eq)).map(eq => (
                                                    <span key={eq} style={{ background: '#eee', padding: '2px 4px', borderRadius: '3px', fontSize: '0.9em' }}>{eq}</span>
                                                ))}
                                                {subject.requiresMovable && <span style={{ background: '#e1bee7', padding: '2px 4px', borderRadius: '3px', fontSize: '0.9em' }}>可動</span>}
                                            </div>
                                        </td>}
                                        {smShow('previousRooms') && <td style={{ padding: '10px', border: '1px solid #ddd', fontSize: '0.85em', color: '#666' }}>{subject.previousRooms?.join(', ')}</td>}
                                        {smShow('allocatedRoom') && <td style={{ padding: '10px', border: '1px solid #ddd', fontSize: '0.85em' }}>
                                            {(() => {
                                                const rooms = allocations
                                                    .filter(a => a.subjectId === subject.id)
                                                    .map(a => classrooms.find(r => r.id === a.classroomId)?.name ?? a.classroomId);
                                                return rooms.length > 0
                                                    ? <span style={{ color: '#1976d2', fontWeight: 'bold' }}>{rooms.join(' / ')}</span>
                                                    : <span style={{ color: '#bbb' }}>未配当</span>;
                                            })()}
                                        </td>}
                                        <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                                            <div style={{ display: 'flex', gap: '10px' }}>
                                                <button onClick={() => handleEdit(subject)} style={{ background: 'none', border: 'none', color: '#1976d2', cursor: 'pointer' }} title="編集"><Edit2 size={16} /></button>
                                                <button onClick={() => handleDelete(subject.id)} style={{ background: 'none', border: 'none', color: '#d32f2f', cursor: 'pointer' }} title="削除"><Trash2 size={16} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {sortedSubjects.length === 0 && !isAdding && (
                                    <tr>
                                        <td colSpan={19} style={{ textAlign: 'center', padding: '150px 0', color: '#999', background: '#fafafa' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                                                <Search size={40} strokeWidth={1} />
                                                <span>該当する授業が見つかりません</span>
                                                <button
                                                    onClick={() => setFilters({
                                                        code: '', name: '', teacherCode: '', teacher: '', faculty: [], department: [], term: [], day: [], period: [], campus: '', requiredCapacity: '', requiredCapacityMax: '', priority: [], requiredRoomCount: [], buildingPreference: [], preferredRoomType: [], requiredEquipment: '', previousRooms: '', allocatedRoom: ''
                                                    } as any)}
                                                    style={{ background: 'none', border: '1px solid #ccc', padding: '4px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.9em', marginTop: '10px' }}
                                                >
                                                    フィルタをすべて解除
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            {editingSubjectModal && (
                <SubjectEditModal
                    subject={editingSubjectModal}
                    availableEquipment={availableEquipment}
                    onSave={(updated) => {
                        onUpdate(subjects.map(s => s.id === updated.id ? updated : s));
                        setEditingSubjectModal(null);
                    }}
                    onClose={() => setEditingSubjectModal(null)}
                />
            )}
        </div>
    );
};
