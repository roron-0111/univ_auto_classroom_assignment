import { useState, useRef, useMemo, useEffect } from 'react';
import type { Classroom } from './src/types';
import { ROOM_TYPE_LABELS, BUILDINGS, EQUIPMENT_LIST, normalizeCampusLabel } from './src/types';
import { Settings, Plus, Edit2, Trash2, X, Check, Upload, Download, ArrowUp, ArrowDown } from 'lucide-react';
import { exportToCSV, parseClassroomCSVStrictWithIssues } from './src/utils/csvParser';
import { getEquipmentStyle, getImportantEquipmentStyle } from './src/types';
import { ClassroomEditModal } from './src/components/ClassroomEditModal';
import { sortEquipmentByCanonicalOrder } from './src/utils/equipmentVisibility';
import { ImportErrorCsvDialog } from './src/components/ImportErrorCsvDialog';

const MultiSelectFilter = ({
    options, selected, onChange, placeholder = '全て'
}: {
    options: { value: string; label: string }[];
    selected: string[];
    onChange: (v: string[]) => void;
    placeholder?: string;
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);
    const toggle = (v: string) => onChange(selected.includes(v) ? selected.filter(x => x !== v) : [...selected, v]);
    const label = selected.length === 0 ? placeholder : selected.length === 1 ? selected[0] : `${selected.length}件`;
    return (
        <div ref={ref} style={{ position: 'relative', userSelect: 'none' }}>
            <div onMouseDown={e => { e.stopPropagation(); setIsOpen(!isOpen); }}
                style={{ padding: '3px 6px', border: '1px solid #ddd', borderRadius: '3px', background: '#fff', cursor: 'pointer', fontSize: '0.78rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '4px', minHeight: '24px' }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
                <span style={{ fontSize: '0.6rem', color: '#888' }}>{isOpen ? '▲' : '▼'}</span>
            </div>
            {isOpen && (
                <div onMouseDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}
                    style={{ position: 'absolute', top: '100%', left: 0, minWidth: 'max(120px, 100%)', maxHeight: '280px', overflowY: 'auto', background: '#fff', border: '1px solid #ccc', borderRadius: '4px', boxShadow: '0 6px 16px rgba(0,0,0,0.15)', zIndex: 5000, marginTop: '2px' }}>
                    <div onClick={() => onChange([])} style={{ padding: '6px 10px', cursor: 'pointer', borderBottom: '1px solid #eee', fontSize: '0.78rem', color: '#666', background: '#f9f9f9' }}>(選択解除)</div>
                    {options.map(opt => (
                        <div key={opt.value} onClick={() => toggle(opt.value)}
                            style={{ padding: '6px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', background: selected.includes(opt.value) ? '#f0f4ff' : 'transparent' }}>
                            <input type="checkbox" checked={selected.includes(opt.value)} readOnly style={{ margin: 0, pointerEvents: 'none' }} />
                            <span>{opt.label}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

interface Props {
    classrooms: Classroom[];
    onUpdate: (updated: Classroom[]) => void;
    currentCampusLabel: string;
    onClose: () => void;
}

const CR_COL_DEFS = [
    { key: 'id', label: 'ID', width: 60 },
    { key: 'name', label: '教室名', width: 120 },
    { key: 'campus', label: 'キャンパス', width: 90 },
    { key: 'building', label: '建物', width: 100 },
    { key: 'capacity', label: '収容人数(試験)', width: 140 },
    { key: 'type', label: 'タイプ', width: 90 },
    { key: 'equipment', label: '機材・設備', width: 293 },
    { key: 'isExcluded', label: '配当対象外', width: 90 },
] as const;
type CRColKey = typeof CR_COL_DEFS[number]['key'];
type CRColConfig = Record<CRColKey, { width: number; hidden: boolean }>;
const crColDefaults = (): CRColConfig => Object.fromEntries(CR_COL_DEFS.map(c => [c.key, { width: c.width, hidden: false }])) as CRColConfig;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const parseCRColConfig = (raw: string | null): CRColConfig => {
    const defaults = crColDefaults();
    if (!raw) return defaults;
    try {
        const parsed: unknown = JSON.parse(raw);
        if (!isRecord(parsed)) return defaults;
        return {
            ...defaults,
            ...Object.fromEntries(
                CR_COL_DEFS.map(({ key }) => {
                    const current = isRecord(parsed[key]) ? parsed[key] : undefined;
                    const savedWidth = current && typeof current.width === 'number' && Number.isFinite(current.width) ? current.width : defaults[key].width;
                    const savedHidden = current && typeof current.hidden === 'boolean' ? current.hidden : defaults[key].hidden;
                    return [key, { width: Math.max(30, savedWidth), hidden: savedHidden }];
                })
            ) as CRColConfig
        };
    } catch {
        return defaults;
    }
};

const mergeClassroomsById = (existing: Classroom[], imported: Classroom[]) => {
    const next = [...existing];
    imported.forEach(room => {
        const index = next.findIndex(item => item.id === room.id);
        if (index >= 0) {
            next[index] = room;
        } else {
            next.push(room);
        }
    });
    return next;
};

export const ClassroomManager = ({ classrooms, onUpdate, currentCampusLabel, onClose }: Props) => {
    const [editingClassroom, setEditingClassroom] = useState<Classroom | null>(null);
    const [editForm, setEditForm] = useState<Partial<Classroom>>({});
    const [isAdding, setIsAdding] = useState(false);
    const [classroomModalMode, setClassroomModalMode] = useState<'add' | 'edit' | null>(null);
    const [colConfig, setColConfig] = useState<CRColConfig>(() => parseCRColConfig(localStorage.getItem('crColConfig')));
    const [showColSettings, setShowColSettings] = useState(false);
    const crColSettingsRef = useRef<HTMLDivElement>(null);
    useEffect(() => { localStorage.setItem('crColConfig', JSON.stringify(colConfig)); }, [colConfig]);
    useEffect(() => {
        if (!showColSettings) return;
        const handler = (event: MouseEvent) => {
            if (crColSettingsRef.current && !crColSettingsRef.current.contains(event.target as Node)) {
                setShowColSettings(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [showColSettings]);
    const crShow = (k: CRColKey) => !colConfig[k].hidden;
    const crW = (k: CRColKey) => `${colConfig[k].width}px`;
    const crToggle = (k: CRColKey) => setColConfig(c => ({ ...c, [k]: { ...c[k], hidden: !c[k].hidden } }));
    const crSetW = (k: CRColKey, w: number) => setColConfig(c => ({ ...c, [k]: { ...c[k], width: Math.max(30, w) } }));
    const [showCsvHint, setShowCsvHint] = useState(false);
    const csvHintRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!showCsvHint) return;
        const handler = (e: MouseEvent) => { if (csvHintRef.current && !csvHintRef.current.contains(e.target as Node)) setShowCsvHint(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [showCsvHint]);
    const [classroomImportErrorCsv, setClassroomImportErrorCsv] = useState<{
        title: string;
        message: string;
        filename: string;
        rows: Record<string, unknown>[];
    } | null>(null);

    const crDrag = (k: CRColKey) => (e: React.MouseEvent) => {
        e.preventDefault(); e.stopPropagation();
        const x0 = e.clientX, w0 = colConfig[k].width;
        const onMove = (ev: MouseEvent) => crSetW(k, w0 + ev.clientX - x0);
        const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    };
    const crRH = (k: CRColKey) => <div onMouseDown={crDrag(k)} style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '5px', cursor: 'col-resize', zIndex: 1 }} />;
    const [filters, setFilters] = useState({
        id: '', name: '', campus: '', buildings: [] as string[], type: '',
        capacityMin: '', capacityMax: '', examCapacityMin: '', examCapacityMax: '',
        equipment: [] as string[]
    });

    const allEquipmentOptions = useMemo(() => {
        const set = new Set<string>(EQUIPMENT_LIST);
        return sortEquipmentByCanonicalOrder(Array.from(set))
            .filter(e => e !== '可動' && e !== '固定')
            .map(e => ({ value: e, label: e }));
    }, []);
    const [newEquipment, setNewEquipment] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [sortConfig, setSortConfig] = useState<{ key: keyof Classroom | 'order'; direction: 'asc' | 'desc' } | null>(null);

    const handleSort = (key: keyof Classroom | 'order') => {
        setSortConfig(current => {
            if (current?.key === key) {
                return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
            }
            return { key, direction: 'asc' };
        });
    };

    const filteredClassrooms = useMemo(() => {
        return classrooms.filter(r => {
            if (filters.id && !r.id.toLowerCase().includes(filters.id.toLowerCase())) return false;
            if (filters.name && !r.name.toLowerCase().includes(filters.name.toLowerCase())) return false;
            if (filters.campus && !(r.campus || '').toLowerCase().includes(filters.campus.toLowerCase())) return false;
            if (filters.buildings.length > 0 && !filters.buildings.includes(r.building)) return false;
            if (filters.type && r.type !== filters.type) return false;
            if (filters.capacityMin && r.capacity < Number(filters.capacityMin)) return false;
            if (filters.capacityMax && r.capacity > Number(filters.capacityMax)) return false;
            if (filters.examCapacityMin && (r.examCapacity ?? 0) < Number(filters.examCapacityMin)) return false;
            if (filters.examCapacityMax && (r.examCapacity ?? 0) > Number(filters.examCapacityMax)) return false;
            if (filters.equipment.length > 0 && !filters.equipment.every(eq => eq === '可動' ? r.isMovable : r.equipment.includes(eq))) return false;
            return true;
        });
    }, [classrooms, filters]);

    const sortedClassrooms = useMemo(() => {
        if (!sortConfig) return filteredClassrooms;
        return [...filteredClassrooms].sort((a, b) => {
            const { key, direction } = sortConfig;
            if (key === 'order') return 0;

            const aVal = a[key] ?? '';
            const bVal = b[key] ?? '';

            if (aVal < bVal) return direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [filteredClassrooms, sortConfig]);

    const handleMove = (roomId: string, direction: 'up' | 'down') => {
        const newClassrooms = [...classrooms];
        const index = newClassrooms.findIndex(r => r.id === roomId);
        if (index === -1) return;
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= newClassrooms.length) return;

        const temp = newClassrooms[index];
        newClassrooms[index] = newClassrooms[targetIndex];
        newClassrooms[targetIndex] = temp;
        onUpdate(newClassrooms);
        setSortConfig(null); // 並び替え時はソートを解除
    };

    const toggleExclusion = (id: string) => {
        onUpdate(classrooms.map(r => r.id === id ? { ...r, isExcluded: !r.isExcluded } : r));
    };

    const handleEdit = (room: Classroom) => {
        setClassroomModalMode('edit');
        setEditingClassroom(room);
    };

    const handleSave = () => {
        if (!editForm.id || !editForm.name) {
            alert('教室IDと教室名を入力してください。');
            return;
        }
        if (classrooms.find(r => r.id === editForm.id)) {
            alert('その教室IDは既に存在します。');
            return;
        }
        onUpdate([
            ...classrooms,
            {
                ...(editForm as Classroom),
                campus: normalizeCampusLabel(editForm.campus || currentCampusLabel) || currentCampusLabel,
                equipment: sortEquipmentByCanonicalOrder((editForm.equipment || []).filter(e => e !== '可動' && e !== '固定'))
            }
        ]);
        setIsAdding(false);
        setEditForm({});
    };

    const handleDeleteAll = () => {
        if (confirm('全ての教室データを削除しますか？配当もリセットされます。この操作は取り消せません。')) {
            onUpdate([]);
        }
    };

    const handleDelete = (id: string) => {
        if (confirm('本当にこの教室を削除しますか？割り当てられていた授業も解除されます。')) {
            onUpdate(classrooms.filter(r => r.id !== id));
        }
    };

    const startAdding = () => {
        setClassroomModalMode('add');
        setIsAdding(false);
        setEditingClassroom({
            id: '',
            name: '',
            campus: currentCampusLabel,
            building: BUILDINGS[0],
            capacity: 50,
            examCapacity: 25,
            type: 'normal',
            isMovable: false,
            equipment: [],
            isExcluded: false
        });
        setEditForm({
            id: '',
            name: '',
            campus: currentCampusLabel,
            building: 'フォーサイト',
            capacity: 50,
            examCapacity: 25,
            type: 'normal',
            isMovable: false,
            equipment: [],
            isExcluded: false
        });
    };

    const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const input = e.currentTarget;
        if (input.files && input.files[0]) {
            try {
                const { classrooms: data, issues } = await parseClassroomCSVStrictWithIssues(input.files[0]);
                const campusLabel = normalizeCampusLabel(currentCampusLabel) || currentCampusLabel;
                const campusIssues = data
                    .map((room, index) => {
                        if (!room.campus) return null;
                        if (normalizeCampusLabel(room.campus || '') === campusLabel) return null;
                        return {
                            lineNumber: index + 2,
                            classroomId: room.id,
                            classroomName: room.name,
                            campus: room.campus,
                            errorType: 'キャンパス不一致',
                            targetColumn: 'キャンパス',
                            detail: `キャンパス「${room.campus}」が現在のキャンパス「${currentCampusLabel}」と一致しません。`,
                            suggestion: `CSVのキャンパスを「${currentCampusLabel}」に揃えてください。`
                        };
                    })
                    .filter((item): item is NonNullable<typeof item> => item !== null);
                const allIssues = [...issues, ...campusIssues];
                if (allIssues.length > 0) {
                    const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+$/, '').replace('T', '_');
                    setClassroomImportErrorCsv({
                        title: '教室CSVインポートエラー',
                        message: `${allIssues.length}件のエラーがあります。保存先を選んで詳細CSVを出力してください。`,
                        filename: `classroom_import_errors_${timestamp}.csv`,
                        rows: allIssues.map(issue => ({
                            行番号: issue.lineNumber ? String(issue.lineNumber) : '',
                            教室ID: issue.classroomId ?? '',
                            教室名: issue.classroomName ?? '',
                            キャンパス: issue.campus ?? '',
                            エラー種別: issue.errorType,
                            対象列: issue.targetColumn ?? '',
                            詳細: issue.detail,
                            修正案: issue.suggestion
                        }))
                    });
                    return;
                }
                if (confirm(`${data.length}件の教室データを読み込みます。同一IDは上書きし、それ以外は追加します。よろしいですか？`)) {
                    onUpdate(mergeClassroomsById(classrooms, data));
                }
            } catch (err) {
                alert(err instanceof Error ? err.message : `CSV読み込みエラー: ${String(err)}`);
            } finally {
                input.value = '';
            }
        }
    };

    const addEq = () => {
        if (!newEquipment.trim()) return;
        const currentEq = editForm.equipment || [];
        if (!currentEq.includes(newEquipment.trim())) {
            setEditForm({ ...editForm, equipment: sortEquipmentByCanonicalOrder([...currentEq, newEquipment.trim()]) });
        }
        setNewEquipment('');
    };

    const removeEq = (name: string) => {
        setEditForm({ ...editForm, equipment: sortEquipmentByCanonicalOrder((editForm.equipment || []).filter(e => e !== name)) });
    };

    return (
        <div className="manager-overlay" data-tour="classroom-manager-screen" style={{
            position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
            background: '#fff', zIndex: 1000, display: 'flex', flexDirection: 'column'
        }}>
            <header data-tour="classroom-manager-header" style={{
                padding: '15px 30px', background: '#2d2d2d', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <Settings size={22} />
                    <h2 style={{ margin: 0, fontSize: '1.2rem' }}>教室管理</h2>
                </div>
                <button onClick={onClose} style={{
                    background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '1.5rem'
                }}><X /></button>
            </header>

            {/* 固定ヘッダーエリア（スクロール外） */}
            <div style={{ flexShrink: 0, padding: '20px 30px 12px', borderBottom: '1px solid #eee' }}>
                <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', alignItems: 'flex-end' }}>
                        <div>
                            <p style={{ color: '#666', margin: '0 0 10px 0' }}>教室情報の編集、削除、一括インポートが行えます。</p>
                            <div data-tour="classroom-actions" style={{ display: 'flex', gap: '10px' }}>
                                <button data-tour="classroom-add" onClick={startAdding} style={{
                                    display: 'flex', gap: '8px', alignItems: 'center', background: '#646cff', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.9em'
                                }}>
                                    <Plus size={18} /> 新規教室
                                </button>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <button data-tour="classroom-import" onClick={() => fileInputRef.current?.click()} style={{
                                        display: 'flex', gap: '8px', alignItems: 'center', background: '#555', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.9em'
                                    }}>
                                        <Upload size={18} /> CSVインポート
                                    </button>
                                    <div ref={csvHintRef} style={{ position: 'relative' }}>
                                        <button onClick={() => setShowCsvHint(s => !s)} style={{ cursor: 'pointer', fontSize: '0.8rem', color: '#888', border: '1px solid #bbb', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', userSelect: 'none', flexShrink: 0, background: showCsvHint ? '#f0f4ff' : '#fff', padding: 0 }}>?</button>
                                        {showCsvHint && (
                                            <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 500, background: '#fff', border: '1px solid #ccc', borderRadius: '6px', padding: '10px 14px', width: '380px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', fontSize: '0.8rem', lineHeight: '1.6', marginTop: '4px' }}>
                                                <div style={{ fontWeight: 'bold', marginBottom: '6px', color: '#333' }}>CSVインポート — 列情報</div>
                                                <div style={{ marginBottom: '4px' }}>エクスポートCSVの列に合わせて受け入れます</div>
                                                <div style={{ marginBottom: '4px' }}><span style={{ color: '#d32f2f', fontWeight: 'bold' }}>必須</span>: ID, 教室名, キャンパス, 建物, 収容人数</div>
                                                <div style={{ marginBottom: '4px' }}><span style={{ color: '#555' }}>任意</span>: 試験時定員, 教室タイプ, 可動(○), 配当対象外(○), 各機材列</div>
                                                <div style={{ marginBottom: '4px' }}>機材列: 列名がそのまま機材名、値が○なら有効</div>
                                                <div style={{ marginBottom: '4px' }}>※エクスポートCSVをそのまま再インポート可</div>
                                                <div style={{ marginBottom: '4px' }}>エラーがある場合は詳細CSVを保存先選択ダイアログ付きで出力します</div>
                                                <div style={{ marginBottom: '4px' }}>UTF-8(BOMあり/なし)・Shift_JIS系のCSVに対応しています</div>
                                                <div style={{ marginBottom: '4px', color: '#b45309', fontWeight: 'bold' }}>このCSVは現在のキャンパス専用です</div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <button data-tour="classroom-export" onClick={() => {
                                    const exportData = classrooms.map(r => {
                                        const base: Record<string, unknown> = {
                                            'ID': r.id,
                                            '教室名': r.name,
                                            'キャンパス': r.campus || currentCampusLabel,
                                            '建物': r.building,
                                            '収容人数': r.capacity,
                                            '試験時定員': r.examCapacity ?? '',
                                            '教室タイプ': ROOM_TYPE_LABELS[r.type],
                                            '可動': r.isMovable ? '○' : '',
                                            '配当対象外': r.isExcluded ? '○' : '',
                                        };
                                        // 標準機材全列を固定順で出力
                                        EQUIPMENT_LIST.filter(eq => eq !== '可動' && eq !== '固定').forEach(eq => {
                                            base[eq] = r.equipment.includes(eq) ? '○' : '';
                                        });
                                        // 非標準機材
                                        r.equipment.filter(eq => !EQUIPMENT_LIST.includes(eq)).forEach(eq => {
                                            base[eq] = '○';
                                        });
                                        return base;
                                    });
                                    exportToCSV(exportData, 'classrooms_export.csv');
                                }} style={{
                                    display: 'flex', gap: '8px', alignItems: 'center', background: '#1976d2', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.9em'
                                }}>
                                    <Download size={18} /> CSVエクスポート
                                </button>
                                <input type="file" ref={fileInputRef} onChange={handleImportCSV} accept=".csv" style={{ display: 'none' }} />
                                <div ref={crColSettingsRef} style={{ position: 'relative' }}>
                                    <button onClick={() => setShowColSettings(s => !s)} style={{
                                        display: 'flex', gap: '6px', alignItems: 'center', background: '#eee', color: '#333', border: '1px solid #ccc', padding: '8px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.9em'
                                    }}>列設定</button>
                                    {showColSettings && (
                                        <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 200, background: '#fff', border: '1px solid #ddd', borderRadius: '6px', padding: '10px', width: '250px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', marginTop: '4px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                                <span style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>列設定</span>
                                                <button onClick={() => setColConfig(crColDefaults())} style={{ fontSize: '0.75rem', padding: '2px 8px', background: '#f5f5f5', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer' }}>初期値に戻す</button>
                                            </div>
                                            {CR_COL_DEFS.map(col => (
                                                <div key={col.key} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '5px' }}>
                                                    <input type="checkbox" checked={!colConfig[col.key].hidden} onChange={() => crToggle(col.key)} style={{ cursor: 'pointer' }} />
                                                    <span style={{ flex: 1, fontSize: '0.82rem' }}>{col.label}</span>
                                                    <input type="number" value={colConfig[col.key].width} onChange={e => crSetW(col.key, Number(e.target.value))} style={{ width: '54px', fontSize: '0.8rem', border: '1px solid #ddd', borderRadius: '3px', padding: '2px 4px' }} />
                                                    <span style={{ fontSize: '0.7rem', color: '#999' }}>px</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div data-tour="classroom-excluded-note" style={{ padding: '8px 12px', background: '#fff9c4', borderRadius: '6px', border: '1px solid #fbc02d', color: '#827717', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>⚠️</span>
                        <strong>※注意:</strong> 配当対象外の教室には自動配当時に科目が配当されません。
                    </div>
                </div>
            </div>
            {/* スクロールエリア（テーブルのみ） */}
            <div data-tour="classroom-table" style={{ flex: 1, overflow: 'auto' }}>
                <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 30px 20px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', fontSize: '0.9em' }}>
                        <thead>
                            <tr style={{ textAlign: 'left' }}>
                                <th style={{ padding: '10px', border: '1px solid #ddd', width: '50px', cursor: 'pointer', position: 'sticky', top: 0, background: '#f5f5f5', zIndex: 10 }} onClick={() => handleSort('order')}>順</th>
                                {crShow('id') && <th style={{ padding: '10px', border: '1px solid #ddd', width: crW('id'), cursor: 'pointer', position: 'sticky', top: 0, background: '#f5f5f5', zIndex: 10, overflow: 'visible' }} onClick={() => handleSort('id')}>ID{crRH('id')}</th>}
                                {crShow('name') && <th style={{ padding: '10px', border: '1px solid #ddd', width: crW('name'), cursor: 'pointer', position: 'sticky', top: 0, background: '#f5f5f5', zIndex: 10, overflow: 'visible' }} onClick={() => handleSort('name')}>教室名{crRH('name')}</th>}
                                {crShow('campus') && <th style={{ padding: '10px', border: '1px solid #ddd', width: crW('campus'), cursor: 'pointer', position: 'sticky', top: 0, background: '#f5f5f5', zIndex: 10, overflow: 'visible' }} onClick={() => handleSort('campus')}>キャンパス{crRH('campus')}</th>}
                                {crShow('building') && <th style={{ padding: '10px', border: '1px solid #ddd', width: crW('building'), cursor: 'pointer', position: 'sticky', top: 0, background: '#f5f5f5', zIndex: 10, overflow: 'visible' }} onClick={() => handleSort('building')}>建物{crRH('building')}</th>}
                                {crShow('capacity') && <th style={{ padding: '10px', border: '1px solid #ddd', width: crW('capacity'), cursor: 'pointer', position: 'sticky', top: 0, background: '#f5f5f5', zIndex: 10, overflow: 'visible' }} onClick={() => handleSort('capacity')}>収容人数 (試験){crRH('capacity')}</th>}
                                {crShow('type') && <th style={{ padding: '10px', border: '1px solid #ddd', width: crW('type'), cursor: 'pointer', position: 'sticky', top: 0, background: '#f5f5f5', zIndex: 10, overflow: 'visible' }} onClick={() => handleSort('type')}>タイプ{crRH('type')}</th>}
                                {crShow('equipment') && <th style={{ padding: '10px', border: '1px solid #ddd', width: crW('equipment'), position: 'sticky', top: 0, background: '#f5f5f5', zIndex: 10, overflow: 'visible' }}>機材・設備{crRH('equipment')}</th>}
                                {crShow('isExcluded') && <th style={{ padding: '10px', border: '1px solid #ddd', width: crW('isExcluded'), cursor: 'pointer', position: 'sticky', top: 0, background: '#f5f5f5', zIndex: 10, overflow: 'visible' }} onClick={() => handleSort('isExcluded')}>配当対象外{crRH('isExcluded')}</th>}
                                <th style={{ padding: '10px', border: '1px solid #ddd', width: '80px', position: 'sticky', top: 0, background: '#f5f5f5', zIndex: 10 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span>操作</span>
                                    </div>
                                </th>
                            </tr>
                            {/* 検索行 */}
                            <tr style={{ background: '#fafafa', position: 'sticky', top: 44, zIndex: 12, boxShadow: '0 1px 0 #ddd' }}>
                                <td style={{ padding: '4px', border: '1px solid #ddd', background: '#fafafa' }} />
                                {crShow('id') && <td style={{ padding: '4px', border: '1px solid #ddd', background: '#fafafa' }}>
                                    <input style={{ width: '100%', padding: '3px', fontSize: '0.78rem', border: '1px solid #ddd', borderRadius: '3px', boxSizing: 'border-box' }}
                                        value={filters.id} onChange={e => setFilters(f => ({ ...f, id: e.target.value }))} placeholder="ID..." />
                                </td>}
                                {crShow('name') && <td style={{ padding: '4px', border: '1px solid #ddd', background: '#fafafa' }}>
                                    <input style={{ width: '100%', padding: '3px', fontSize: '0.78rem', border: '1px solid #ddd', borderRadius: '3px', boxSizing: 'border-box' }}
                                        value={filters.name} onChange={e => setFilters(f => ({ ...f, name: e.target.value }))} placeholder="検索..." />
                                </td>}
                                {crShow('campus') && <td style={{ padding: '4px', border: '1px solid #ddd', background: '#fafafa' }}>
                                    <input style={{ width: '100%', padding: '3px', fontSize: '0.78rem', border: '1px solid #ddd', borderRadius: '3px', boxSizing: 'border-box' }}
                                        value={filters.campus} onChange={e => setFilters(f => ({ ...f, campus: e.target.value }))} placeholder="検索..." />
                                </td>}
                                {crShow('building') && <td style={{ padding: '4px', border: '1px solid #ddd', background: '#fafafa' }}>
                                    <MultiSelectFilter
                                        options={BUILDINGS.map(b => ({ value: b, label: b }))}
                                        selected={filters.buildings}
                                        onChange={v => setFilters(f => ({ ...f, buildings: v }))}
                                    />
                                </td>}
                                {crShow('capacity') && <td style={{ padding: '4px', border: '1px solid #ddd', background: '#fafafa' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                        <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
                                            <input type="number" style={{ width: '46px', padding: '2px', fontSize: '0.72rem', border: '1px solid #ddd', borderRadius: '3px' }}
                                                value={filters.capacityMin} onChange={e => setFilters(f => ({ ...f, capacityMin: e.target.value }))} placeholder="通常↑" title="通常定員・以上" />
                                            <span style={{ fontSize: '0.65rem', color: '#999' }}>〜</span>
                                            <input type="number" style={{ width: '46px', padding: '2px', fontSize: '0.72rem', border: '1px solid #ddd', borderRadius: '3px' }}
                                                value={filters.capacityMax} onChange={e => setFilters(f => ({ ...f, capacityMax: e.target.value }))} placeholder="通常↓" title="通常定員・以下" />
                                        </div>
                                        <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
                                            <input type="number" style={{ width: '46px', padding: '2px', fontSize: '0.72rem', border: '1px solid #ddd', borderRadius: '3px', color: '#d32f2f' }}
                                                value={filters.examCapacityMin} onChange={e => setFilters(f => ({ ...f, examCapacityMin: e.target.value }))} placeholder="試験↑" title="試験定員・以上" />
                                            <span style={{ fontSize: '0.65rem', color: '#999' }}>〜</span>
                                            <input type="number" style={{ width: '46px', padding: '2px', fontSize: '0.72rem', border: '1px solid #ddd', borderRadius: '3px', color: '#d32f2f' }}
                                                value={filters.examCapacityMax} onChange={e => setFilters(f => ({ ...f, examCapacityMax: e.target.value }))} placeholder="試験↓" title="試験定員・以下" />
                                        </div>
                                    </div>
                                </td>}
                                {crShow('type') && <td style={{ padding: '4px', border: '1px solid #ddd', background: '#fafafa' }}>
                                    <select style={{ width: '100%', padding: '3px', fontSize: '0.78rem', border: '1px solid #ddd', borderRadius: '3px' }}
                                        value={filters.type} onChange={e => setFilters(f => ({ ...f, type: e.target.value }))}>
                                        <option value="">全て</option>
                                        {Object.entries(ROOM_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                                    </select>
                                </td>}
                                {crShow('equipment') && <td style={{ padding: '4px', border: '1px solid #ddd', background: '#fafafa' }}>
                                    <MultiSelectFilter
                                        options={allEquipmentOptions}
                                        selected={filters.equipment}
                                        onChange={v => setFilters(f => ({ ...f, equipment: v }))}
                                        placeholder="機材..."
                                    />
                                </td>}
                                {crShow('isExcluded') && <td style={{ padding: '4px', border: '1px solid #ddd', background: '#fafafa' }} />}
                                <td style={{ padding: '4px', border: '1px solid #ddd', background: '#fafafa', textAlign: 'center' }}>
                                    <button onClick={handleDeleteAll} style={{ fontSize: '0.7rem', padding: '2px 8px', background: '#d32f2f', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>全削除</button>
                                </td>
                            </tr>
                        </thead>
                        <tbody>
                            {isAdding && (
                                <tr style={{ background: '#f0f4ff' }}>
                                    <td style={{ padding: '8px', border: '1px solid #ddd' }}></td>
                                    {crShow('id') && <td style={{ padding: '8px', border: '1px solid #ddd' }}>
                                        <input value={editForm.id} onChange={e => setEditForm({ ...editForm, id: e.target.value })} style={{ width: '100%' }} placeholder="A101" />
                                    </td>}
                                    {crShow('name') && <td style={{ padding: '8px', border: '1px solid #ddd' }}>
                                        <input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} style={{ width: '100%' }} />
                                    </td>}
                                    {crShow('campus') && <td style={{ padding: '8px', border: '1px solid #ddd', color: '#666' }}>
                                        {currentCampusLabel}
                                    </td>}
                                    {crShow('building') && <td style={{ padding: '8px', border: '1px solid #ddd' }}>
                                        <select value={editForm.building} onChange={e => setEditForm({ ...editForm, building: e.target.value })} style={{ width: '100%', padding: '4px' }}>
                                            {BUILDINGS.map(b => <option key={b} value={b}>{b}</option>)}
                                        </select>
                                    </td>}
                                    {crShow('capacity') && <td style={{ padding: '8px', border: '1px solid #ddd' }}>
                                        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                            <input type="number" value={editForm.capacity} onChange={e => setEditForm({ ...editForm, capacity: Number(e.target.value) })} style={{ width: '50px' }} />
                                            <span>(</span>
                                            <input type="number" value={editForm.examCapacity} onChange={e => setEditForm({ ...editForm, examCapacity: Number(e.target.value) })} style={{ width: '50px' }} title="試験時定員" />
                                            <span>)</span>
                                        </div>
                                    </td>}
                                    {crShow('type') && <td style={{ padding: '8px', border: '1px solid #ddd' }}>
                                        <select value={editForm.type} onChange={e => setEditForm({ ...editForm, type: e.target.value as Classroom['type'] })} style={{ width: '100%' }}>
                                            {Object.entries(ROOM_TYPE_LABELS).map(([val, label]) => (
                                                <option key={val} value={val}>{label}</option>
                                            ))}
                                        </select>
                                    </td>}
                                    {crShow('equipment') && <td style={{ padding: '8px', border: '1px solid #ddd' }}>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '6px' }}>
                                            {(editForm.equipment || []).map(eq => {
                                                const style = getEquipmentStyle(eq);
                                                return (
                                                    <span key={eq} style={{
                                                        background: style.bg, color: style.text, border: `1px solid ${style.border}`,
                                                        padding: '1px 6px', borderRadius: '12px', fontSize: '0.8em', display: 'flex', alignItems: 'center', gap: '4px'
                                                    }}>
                                                        {eq} <X size={10} onClick={() => removeEq(eq)} style={{ cursor: 'pointer' }} />
                                                    </span>
                                                );
                                            })}
                                        </div>
                                        <div style={{ display: 'flex', gap: '4px' }}>
                                            <input value={newEquipment} onChange={e => setNewEquipment(e.target.value)} onKeyDown={e => e.key === 'Enter' && addEq()} placeholder="機材名" style={{ width: '80px', fontSize: '0.9em' }} />
                                            <button onClick={addEq} style={{ padding: '2px 6px', background: '#eee', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer' }}>+</button>
                                        </div>
                                    </td>}
                                    {crShow('isExcluded') && <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'center' }}>
                                        <input type="checkbox" checked={!!editForm.isExcluded} onChange={e => setEditForm({ ...editForm, isExcluded: e.target.checked })} />
                                    </td>}
                                    <td style={{ padding: '8px', border: '1px solid #ddd' }}>
                                        <div style={{ display: 'flex', gap: '6px' }}>
                                            <button onClick={handleSave} style={{ background: '#2e7d32', color: '#fff', border: 'none', padding: '6px', borderRadius: '4px', cursor: 'pointer' }}><Check size={16} /></button>
                                            <button onClick={() => { setIsAdding(false); setEditForm({}); }} style={{ background: '#d32f2f', color: '#fff', border: 'none', padding: '6px', borderRadius: '4px', cursor: 'pointer' }}><X size={16} /></button>
                                        </div>
                                    </td>
                                </tr>
                            )}
                            {sortedClassrooms.map((room, index) => (
                                <tr key={room.id} style={{ borderBottom: '1px solid #eee', background: room.isExcluded ? '#fff8f8' : 'transparent' }}>
                                        <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                                                <button
                                                    onClick={() => handleMove(room.id, 'up')}
                                                    disabled={index === 0}
                                                    style={{ background: 'none', border: 'none', cursor: index === 0 ? 'default' : 'pointer', color: index === 0 ? '#eee' : '#666', padding: 0 }}
                                                >
                                                    <ArrowUp size={14} />
                                                </button>
                                                <button
                                                    onClick={() => handleMove(room.id, 'down')}
                                                    disabled={index === classrooms.length - 1}
                                                    style={{ background: 'none', border: 'none', cursor: index === classrooms.length - 1 ? 'default' : 'pointer', color: index === classrooms.length - 1 ? '#eee' : '#666', padding: 0 }}
                                                >
                                                    <ArrowDown size={14} />
                                                </button>
                                            </div>
                                        </td>
                                        {crShow('id') && <td style={{ padding: '10px', border: '1px solid #ddd' }}>{room.id}</td>}
                                        {crShow('name') && <td style={{ padding: '10px', border: '1px solid #ddd', fontWeight: 'bold' }}>{room.name}</td>}
                                        {crShow('campus') && <td style={{ padding: '10px', border: '1px solid #ddd' }}>{room.campus || currentCampusLabel}</td>}
                                        {crShow('building') && <td style={{ padding: '10px', border: '1px solid #ddd' }}>{room.building}</td>}
                                        {crShow('capacity') && <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                                            {room.capacity}名 <span style={{ color: '#999', fontSize: '0.8em' }}>({room.examCapacity || '-'})</span>
                                        </td>}
                                        {crShow('type') && <td style={{ padding: '10px', border: '1px solid #ddd' }}>{ROOM_TYPE_LABELS[room.type]}</td>}
                                        {crShow('equipment') && <td style={{ padding: '10px', border: '1px solid #ddd', fontSize: '0.85em' }}>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                                <span style={{
                                                    background: getImportantEquipmentStyle(room.isMovable ? '可動' : '固定').bg,
                                                    color: getImportantEquipmentStyle(room.isMovable ? '可動' : '固定').text,
                                                    border: `1px solid ${getImportantEquipmentStyle(room.isMovable ? '可動' : '固定').border}`,
                                                    padding: '2px 8px', borderRadius: '4px', fontSize: '0.8em', fontWeight: 'bold'
                                                }}>
                                                    {room.isMovable ? '可動' : '固定'}
                                                </span>
                                                {[...EQUIPMENT_LIST.filter(e => room.equipment.includes(e)), ...room.equipment.filter(e => !EQUIPMENT_LIST.includes(e))].map(eq => {
                                                    const style = getEquipmentStyle(eq);
                                                    return (
                                                        <span key={eq} style={{
                                                            background: style.bg, color: style.text, border: `1px solid ${style.border}`,
                                                            padding: '2px 8px', borderRadius: '4px', fontSize: '0.8em', fontWeight: style.text !== '#666' ? 'bold' : 'normal'
                                                        }}>
                                                            {eq}
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                        </td>}
                                        {crShow('isExcluded') && <td style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'center' }}>
                                            <input
                                                type="checkbox"
                                                checked={!!room.isExcluded}
                                                onChange={() => toggleExclusion(room.id)}
                                                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                                title="自動配当の対象から外す"
                                            />
                                        </td>}
                                        <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                                            <div style={{ display: 'flex', gap: '10px' }}>
                                                <button onClick={() => handleEdit(room)} style={{ background: 'none', border: 'none', color: '#1976d2', cursor: 'pointer' }} title="編集"><Edit2 size={16} /></button>
                                                <button onClick={() => handleDelete(room.id)} style={{ background: 'none', border: 'none', color: '#d32f2f', cursor: 'pointer' }} title="削除"><Trash2 size={16} /></button>
                                            </div>
                                        </td>
                                    </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            {classroomImportErrorCsv && (
                <ImportErrorCsvDialog
                    open={true}
                    title={classroomImportErrorCsv.title}
                    message={classroomImportErrorCsv.message}
                    filename={classroomImportErrorCsv.filename}
                    rows={classroomImportErrorCsv.rows}
                    onClose={() => setClassroomImportErrorCsv(null)}
                />
            )}
            {editingClassroom && (
                <ClassroomEditModal
                    key={editingClassroom.id}
                    classroom={editingClassroom}
                    existingIds={classrooms.map(r => r.id)}
                    title={classroomModalMode === 'add' ? '新規教室情報の作成' : '教室情報の編集'}
                    onSave={(updated) => {
                        const next = {
                            ...updated,
                            campus: normalizeCampusLabel(updated.campus || currentCampusLabel) || currentCampusLabel
                        };
                        if (classroomModalMode === 'add') {
                            onUpdate([...classrooms, next]);
                        } else {
                            onUpdate(classrooms.map(r => r.id === editingClassroom.id ? next : r));
                        }
                        setEditingClassroom(null);
                        setClassroomModalMode(null);
                    }}
                    onClose={() => {
                        setEditingClassroom(null);
                        setClassroomModalMode(null);
                    }}
                />
            )}
        </div>
    );
};
