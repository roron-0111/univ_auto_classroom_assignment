import { useState, useRef, useEffect, useMemo } from 'react';
import type { Subject, Term, DayOfWeek, Period } from '../types';
import { DAY_LABELS, BUILDINGS } from '../types';
import { BookOpen, Plus, Edit2, Trash2, X, Check, Upload, Download } from 'lucide-react';
import { parseSubjectCSV, exportToCSV } from '../utils/csvParser';

interface Props {
    subjects: Subject[];
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
        <div ref={dropdownRef} style={{ position: 'relative', width: '100%' }}>
            <div
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    border: '1px solid #ccc',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    background: '#fff',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    minHeight: '26px'
                }}
            >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayText}</span>
                <span style={{ fontSize: '0.6rem', color: '#888' }}>▼</span>
            </div>
            {isOpen && (
                <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    width: '100%', // 親と同じ幅
                    minWidth: '120px', // ただし最低幅は確保
                    maxHeight: '200px',
                    overflowY: 'auto',
                    background: '#fff',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
                    zIndex: 1000,
                    marginTop: '2px'
                }}>
                    <div
                        onClick={() => onChange([])}
                        style={{ padding: '6px 8px', cursor: 'pointer', borderBottom: '1px solid #eee', fontSize: '0.8rem', color: '#666' }}
                    >
                        (選択解除)
                    </div>
                    {options.map(opt => (
                        <div
                            key={opt.value}
                            onClick={() => toggleOption(opt.value)}
                            style={{
                                padding: '6px 8px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                fontSize: '0.8rem',
                                background: selected.includes(opt.value) ? '#f0f4ff' : 'transparent'
                            }}
                        >
                            <input
                                type="checkbox"
                                checked={selected.includes(opt.value)}
                                readOnly
                                style={{ margin: 0 }}
                            />
                            {opt.label}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export const SubjectManager = ({ subjects, onUpdate, onClose }: Props) => {
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<Partial<Subject>>({});
    const [isAdding, setIsAdding] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // フィルタステート（配列で保持）
    const [filters, setFilters] = useState({
        code: '',
        name: '',
        teacher: '',
        faculty: [] as string[],
        department: [] as string[],
        term: [] as Term[],
        day: [] as DayOfWeek[],
        period: [] as number[],
        campus: '',
        requiredCapacity: '',
        priority: [] as number[],
        requiredRoomCount: '',
        buildingPreference: [] as string[],
        preferredRoomType: [] as string[],
        previousRooms: '',
        requiredEquipment: ''
    });

    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

    const handleEdit = (subject: Subject) => {
        setEditingId(subject.id);
        const { id, ...rest } = subject;
        setEditForm({ id, ...rest }); // IDは維持、その他コピー
    };

    // フィルタリング処理（メモ化）
    const filteredSubjects = useMemo(() => {
        return subjects.filter(s => {
            // テキスト系：スペース区切りOR検索
            const checkText = (text: string, query: string) => {
                if (!query) return true;
                const keywords = query.toLowerCase().split(/\s+/).filter(k => k);
                if (keywords.length === 0) return true;
                const target = text.toLowerCase();
                return keywords.some(k => target.includes(k));
            };

            if (!checkText(s.code, filters.code)) return false;
            if (!checkText(s.name, filters.name)) return false;
            if (!checkText(s.teacher, filters.teacher)) return false;

            // 選択系：配列に含まれているか
            if (filters.faculty.length > 0 && !filters.faculty.includes(s.faculty)) return false;
            if (filters.department.length > 0 && !filters.department.includes(s.department)) return false;
            if (filters.term.length > 0 && !filters.term.includes(s.term)) return false;
            if (filters.day.length > 0 && !filters.day.includes(s.day)) return false;
            if (filters.period.length > 0 && !filters.period.includes(s.period)) return false;
            if (filters.priority.length > 0 && !filters.priority.includes(s.priority)) return false;
            if (filters.buildingPreference.length > 0 && (!s.buildingPreference || !filters.buildingPreference.some(b => s.buildingPreference?.includes(b)))) return false;
            if (filters.preferredRoomType.length > 0 && (!s.preferredRoomType || !filters.preferredRoomType.includes(s.preferredRoomType))) return false;

            // 数値系
            if (filters.requiredCapacity && s.requiredCapacity < Number(filters.requiredCapacity)) return false;
            if (filters.requiredRoomCount && (s.requiredRoomCount || 1) !== Number(filters.requiredRoomCount)) return false;

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
                if (k === 'period') return Number(obj[k]);
                if (k === 'term') return obj[k] === 'spring' ? 1 : obj[k] === 'autumn' ? 2 : 3;
                if (k === 'day') return Object.keys(DAY_LABELS).indexOf(obj[k]);
                if (k === 'requiredEquipment' || k === 'previousRooms') return (obj[k] || []).join(',');
                return obj[k] ?? '';
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
            alert('授業名、時間割コードを入力してください。');
            return;
        }

        if (isAdding) {
            if (subjects.find(s => s.id === editForm.id)) {
                alert('その授業IDは既に存在します。');
                return;
            }
            onUpdate([...subjects, editForm as Subject]);
            setIsAdding(false);
        } else {
            onUpdate(subjects.map(s => s.id === editingId ? (editForm as Subject) : s));
            setEditingId(null);
        }
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
        if (e.target.files && e.target.files[0]) {
            try {
                const data = await parseSubjectCSV(e.target.files[0]);
                if (confirm(`${data.length}件の授業データを読み込みます。既存のデータは上書きされ、割り当てもリセットされます。よろしいですか？`)) {
                    onUpdate(data);
                }
            } catch (err) {
                alert('CSV読み込みエラー: ' + err);
            }
        }
    };

    const SortIcon = ({ columnKey }: { columnKey: string }) => {
        if (sortConfig?.key !== columnKey) return <span style={{ color: '#ccc', fontSize: '10px' }}>▲▼</span>;
        return <span style={{ color: '#000', fontSize: '10px' }}>{sortConfig.direction === 'asc' ? '▲' : '▼'}</span>;
    };

    const thStyle = { padding: '8px', border: '1px solid #ddd', cursor: 'pointer', userSelect: 'none' as const, background: '#f5f5f5', fontSize: '0.8rem', whiteSpace: 'nowrap' as const };
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

            <div style={{ flex: 1, overflow: 'auto', padding: '30px' }}>
                <div style={{ maxWidth: '1600px', margin: '0 auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', alignItems: 'flex-end', flexWrap: 'wrap', gap: '20px' }}>
                        <div>
                            <p style={{ color: '#666', margin: '0 0 10px 0' }}>授業情報の編集、削除、一括インポートが行えます。</p>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button onClick={startAdding} style={{
                                    display: 'flex', gap: '8px', alignItems: 'center', background: '#646cff', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.9em'
                                }}>
                                    <Plus size={18} /> 新規授業
                                </button>
                                <button onClick={() => fileInputRef.current?.click()} style={{
                                    display: 'flex', gap: '8px', alignItems: 'center', background: '#555', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.9em'
                                }}>
                                    <Upload size={18} /> CSV
                                </button>
                                <button onClick={() => exportToCSV(subjects, 'subjects_export.csv')} style={{
                                    display: 'flex', gap: '8px', alignItems: 'center', background: '#1976d2', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.9em'
                                }}>
                                    <Download size={18} /> CSV
                                </button>
                                <input type="file" ref={fileInputRef} onChange={handleImportCSV} accept=".csv" style={{ display: 'none' }} />
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '10px' }}>
                            <div style={{ fontSize: '0.9rem', color: '#666' }}>
                                表示: {sortedSubjects.length} / {subjects.length} 件
                            </div>
                        </div>
                    </div>

                    <div style={{ overflowX: 'auto', border: '1px solid #ddd', borderRadius: '4px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', fontSize: '0.85em', minWidth: '1400px' }}>
                            <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                                <tr style={{ background: '#f5f5f5', textAlign: 'left' }}>
                                    {[
                                        { key: 'code', label: 'コード', width: '70px' },
                                        { key: 'name', label: '授業名', width: '160px' },
                                        { key: 'teacher', label: '教員', width: '80px' },
                                        { key: 'faculty', label: '学部', width: '60px' },
                                        { key: 'department', label: '管轄', width: '50px' },
                                        { key: 'term', label: '学期', width: '70px' },
                                        { key: 'day', label: '曜日', width: '60px' },
                                        { key: 'period', label: '講時', width: '70px' },
                                        { key: 'campus', label: 'キャンパス', width: '70px' },
                                        { key: 'requiredCapacity', label: '定員', width: '50px' },
                                        { key: 'priority', label: '優先', width: '45px' },
                                        { key: 'requiredRoomCount', label: '数', width: '35px' },
                                        { key: 'buildingPreference', label: '希望建物', width: '60px' },
                                        { key: 'preferredRoomType', label: 'タイプ', width: '60px' },
                                        { key: 'requiredEquipment', label: '機材', width: '100px' },
                                        { key: 'previousRooms', label: '過去教室', width: '80px' },
                                    ].map(col => (
                                        <th key={col.key} style={{ ...thStyle, width: col.width }} onClick={() => handleSort(col.key)}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
                                                {col.label}
                                                <SortIcon columnKey={col.key} />
                                            </div>
                                        </th>
                                    ))}
                                    <th style={{ ...thStyle, width: '70px', cursor: 'default' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
                                            <span>操作</span>
                                            <button
                                                onClick={handleDeleteAll}
                                                style={{
                                                    fontSize: '0.7rem', padding: '2px 4px', background: '#d32f2f', color: '#fff',
                                                    border: 'none', borderRadius: '4px', cursor: 'pointer'
                                                }}
                                            >
                                                全削除
                                            </button>
                                        </div>
                                    </th>
                                </tr>
                                <tr style={{ background: '#fafafa' }}>
                                    {[
                                        { key: 'code', type: 'text' },
                                        { key: 'name', type: 'text' },
                                        { key: 'teacher', type: 'text' },
                                        { key: 'faculty', type: 'select', options: ['理', '経', '国', 'IR', '教', '他'].map(v => ({ value: v, label: v })) },
                                        { key: 'department', type: 'select', options: ['理', '工', '法', '経', '文', '国', 'IR', '教', '他'].map(v => ({ value: v, label: v })) },
                                        {
                                            key: 'term', type: 'select', options: [
                                                { value: 'spring', label: '春' },
                                                { value: 'autumn', label: '秋' },
                                                { value: 'full_year', label: '通' }
                                            ]
                                        },
                                        { key: 'day', type: 'select', options: Object.entries(DAY_LABELS).map(([v, l]) => ({ value: v, label: l })) },
                                        { key: 'period', type: 'select', options: [1, 2, 3, 4, 5, 6, 7].map(v => ({ value: v, label: String(v) })) },
                                        { key: 'campus', type: 'text' },
                                        { key: 'requiredCapacity', type: 'number' },
                                        { key: 'priority', type: 'select', options: [1, 2, 3].map(v => ({ value: v, label: String(v) })) },
                                        { key: 'requiredRoomCount', type: 'number' },
                                        { key: 'buildingPreference', type: 'select', options: BUILDINGS.map(v => ({ value: v, label: v })) },
                                        {
                                            key: 'preferredRoomType', type: 'select', options: [
                                                { value: 'normal', label: '一般' },
                                                { value: 'pc', label: 'PC' },
                                                { value: 'seminar', label: 'ゼミ' }
                                            ]
                                        },
                                        { key: 'requiredEquipment', type: 'text' },
                                        { key: 'previousRooms', type: 'text' },
                                    ].map((field, idx) => (
                                        <td key={idx} style={{ padding: '4px', border: '1px solid #ddd' }}>
                                            {field.type === 'text' && (
                                                <input
                                                    style={filterInputStyle}
                                                    value={(filters as any)[field.key]}
                                                    onChange={e => setFilters({ ...filters, [field.key]: e.target.value })}
                                                    placeholder="検索..."
                                                />
                                            )}
                                            {field.type === 'number' && (
                                                <input
                                                    style={filterInputStyle}
                                                    type="number"
                                                    value={(filters as any)[field.key]}
                                                    onChange={e => setFilters({ ...filters, [field.key]: e.target.value })}
                                                    placeholder={field.key === 'requiredCapacity' ? "以上" : ""}
                                                />
                                            )}
                                            {field.type === 'select' && field.options && (
                                                <MultiSelectFilter
                                                    options={field.options}
                                                    selected={(filters as any)[field.key] as any[]}
                                                    onChange={(val) => setFilters({ ...filters, [field.key]: val })}
                                                />
                                            )}
                                        </td>
                                    ))}
                                    <td style={{ padding: '4px', border: '1px solid #ddd' }}></td>
                                </tr>
                            </thead>
                            <tbody>
                                {(isAdding || editingId) && (
                                    <tr style={{ background: '#f0f4ff' }}>
                                        <td style={{ padding: '8px', border: '1px solid #ddd' }}>
                                            <input value={editForm.code} onChange={e => setEditForm({ ...editForm, code: e.target.value })} style={{ width: '100%' }} placeholder="A0001" />
                                        </td>
                                        <td style={{ padding: '8px', border: '1px solid #ddd' }}>
                                            <input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} style={{ width: '100%' }} />
                                        </td>
                                        <td style={{ padding: '8px', border: '1px solid #ddd' }}>
                                            <input value={editForm.teacher} onChange={e => setEditForm({ ...editForm, teacher: e.target.value })} style={{ width: '100%' }} />
                                        </td>
                                        <td style={{ padding: '8px', border: '1px solid #ddd' }}>
                                            <input value={editForm.faculty} onChange={e => setEditForm({ ...editForm, faculty: e.target.value })} style={{ width: '100%' }} placeholder="学部" />
                                        </td>
                                        <td style={{ padding: '8px', border: '1px solid #ddd' }}>
                                            <select value={editForm.department || '他'} onChange={e => setEditForm({ ...editForm, department: e.target.value })} style={{ width: '100%' }}>
                                                {['理', '工', '法', '経', '文', '国', 'IR', '教', '他'].map(v => <option key={v} value={v}>{v}</option>)}
                                            </select>
                                        </td>
                                        <td style={{ padding: '8px', border: '1px solid #ddd' }}>
                                            <select value={editForm.term} onChange={e => setEditForm({ ...editForm, term: e.target.value as Term })} style={{ width: '100%' }}>
                                                <option value="spring">春</option>
                                                <option value="autumn">秋</option>
                                                <option value="full_year">通年</option>
                                            </select>
                                        </td>
                                        <td style={{ padding: '8px', border: '1px solid #ddd' }}>
                                            <select value={editForm.day} onChange={e => setEditForm({ ...editForm, day: e.target.value as DayOfWeek })} style={{ width: '100%' }}>
                                                {Object.entries(DAY_LABELS).map(([val, label]) => <option key={val} value={val}>{label}</option>)}
                                            </select>
                                        </td>
                                        <td style={{ padding: '8px', border: '1px solid #ddd' }}>
                                            <select value={editForm.period} onChange={e => setEditForm({ ...editForm, period: Number(e.target.value) as Period })} style={{ width: '100%' }}>
                                                {[1, 2, 3, 4, 5, 6, 7].map(p => <option key={p} value={p}>{p}</option>)}
                                            </select>
                                        </td>
                                        <td style={{ padding: '8px', border: '1px solid #ddd' }}>
                                            <input value={editForm.campus || ''} onChange={e => setEditForm({ ...editForm, campus: e.target.value })} style={{ width: '100%' }} placeholder="キャンパス" />
                                        </td>
                                        <td style={{ padding: '8px', border: '1px solid #ddd' }}>
                                            <input type="number" value={editForm.requiredCapacity} onChange={e => setEditForm({ ...editForm, requiredCapacity: Number(e.target.value) })} style={{ width: '100%' }} />
                                        </td>
                                        <td style={{ padding: '8px', border: '1px solid #ddd' }}>
                                            <select value={editForm.priority || 1} onChange={e => setEditForm({ ...editForm, priority: Number(e.target.value) })} style={{ width: '100%' }}>
                                                {[1, 2, 3].map(p => <option key={p} value={p}>{p}</option>)}
                                            </select>
                                        </td>
                                        <td style={{ padding: '8px', border: '1px solid #ddd' }}>
                                            <input type="number" min="1" value={editForm.requiredRoomCount || 1} onChange={e => setEditForm({ ...editForm, requiredRoomCount: Number(e.target.value) })} style={{ width: '100%' }} />
                                        </td>
                                        <td style={{ padding: '8px', border: '1px solid #ddd' }}>
                                            <select
                                                value={editForm.buildingPreference || ''}
                                                onChange={e => setEditForm({ ...editForm, buildingPreference: e.target.value })}
                                                style={{ width: '100%', padding: '4px' }}
                                            >
                                                <option value="">(なし)</option>
                                                {BUILDINGS.map(b => <option key={b} value={b}>{b}</option>)}
                                            </select>
                                        </td>
                                        <td style={{ padding: '8px', border: '1px solid #ddd' }}>
                                            <select value={editForm.preferredRoomType || 'normal'} onChange={e => setEditForm({ ...editForm, preferredRoomType: e.target.value as any })} style={{ width: '100%' }}>
                                                <option value="normal">一般</option>
                                                <option value="pc">PC</option>
                                                <option value="seminar">ゼミ</option>
                                            </select>
                                        </td>
                                        {/* 機材編集 */}
                                        <td style={{ padding: '8px', border: '1px solid #ddd' }}>
                                            <input
                                                value={editForm.requiredEquipment?.join(' ') || ''}
                                                onChange={e => setEditForm({ ...editForm, requiredEquipment: e.target.value.split(/\s+/).filter(Boolean) })}
                                                style={{ width: '100%' }}
                                                placeholder="例: プロジェクタ 可動"
                                            />
                                        </td>
                                        <td style={{ padding: '8px', border: '1px solid #ddd' }}>
                                            <input value={editForm.previousRooms?.join(';')} onChange={e => setEditForm({ ...editForm, previousRooms: e.target.value.split(';').map(s => s.trim()).filter(Boolean) })} style={{ width: '100%' }} placeholder="例: 3-201" />
                                        </td>
                                        <td style={{ padding: '8px', border: '1px solid #ddd' }}>
                                            <div style={{ display: 'flex', gap: '6px' }}>
                                                <button onClick={handleSave} style={{ background: '#2e7d32', color: '#fff', border: 'none', padding: '6px', borderRadius: '4px', cursor: 'pointer' }}><Check size={16} /></button>
                                                <button onClick={() => { setEditingId(null); setIsAdding(false); setEditForm({}); }} style={{ background: '#d32f2f', color: '#fff', border: 'none', padding: '6px', borderRadius: '4px', cursor: 'pointer' }}><X size={16} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                                {sortedSubjects.map(subject => (
                                    subject.id !== editingId && (
                                        <tr key={subject.id} style={{ borderBottom: '1px solid #eee' }}>
                                            <td style={{ padding: '10px', border: '1px solid #ddd', color: '#888' }}>{subject.code}</td>
                                            <td style={{ padding: '10px', border: '1px solid #ddd', fontWeight: 'bold' }}>{subject.name}</td>
                                            <td style={{ padding: '10px', border: '1px solid #ddd' }}>{subject.teacher}</td>
                                            <td style={{ padding: '10px', border: '1px solid #ddd' }}>{subject.faculty}</td>
                                            <td style={{ padding: '10px', border: '1px solid #ddd' }}>{subject.department}</td>
                                            <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                                                {subject.term === 'spring' ? '春' : subject.term === 'autumn' ? '秋' : '通年'}
                                            </td>
                                            <td style={{ padding: '10px', border: '1px solid #ddd' }}>{DAY_LABELS[subject.day]}</td>
                                            <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                                                {subject.period}{subject.endPeriod && subject.endPeriod !== subject.period ? `-${subject.endPeriod}` : ''}
                                            </td>
                                            <td style={{ padding: '10px', border: '1px solid #ddd' }}>{subject.campus}</td>
                                            <td style={{ padding: '10px', border: '1px solid #ddd' }}>{subject.requiredCapacity}名</td>
                                            <td style={{ padding: '10px', border: '1px solid #ddd' }}>{subject.priority}</td>
                                            <td style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'center' }}>{subject.requiredRoomCount || 1}</td>
                                            <td style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'center' }}>{subject.buildingPreference}</td>
                                            <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                                                {subject.preferredRoomType === 'normal' ? '一般' : subject.preferredRoomType === 'pc' ? 'PC' : subject.preferredRoomType === 'seminar' ? 'ゼミ' : '-'}
                                            </td>
                                            <td style={{ padding: '10px', border: '1px solid #ddd', fontSize: '0.85em' }}>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px' }}>
                                                    {subject.requiredEquipment?.map(eq => (
                                                        <span key={eq} style={{ background: '#eee', padding: '2px 4px', borderRadius: '3px', fontSize: '0.9em' }}>{eq}</span>
                                                    ))}
                                                    {subject.requiresMovable && <span style={{ background: '#e1bee7', padding: '2px 4px', borderRadius: '3px', fontSize: '0.9em' }}>可動</span>}
                                                </div>
                                            </td>
                                            <td style={{ padding: '10px', border: '1px solid #ddd', fontSize: '0.85em', color: '#666' }}>
                                                {subject.previousRooms?.join(', ')}
                                            </td>
                                            <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                                                <div style={{ display: 'flex', gap: '10px' }}>
                                                    <button onClick={() => handleEdit(subject)} style={{ background: 'none', border: 'none', color: '#1976d2', cursor: 'pointer' }} title="編集"><Edit2 size={16} /></button>
                                                    <button onClick={() => handleDelete(subject.id)} style={{ background: 'none', border: 'none', color: '#d32f2f', cursor: 'pointer' }} title="削除"><Trash2 size={16} /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};
