import { useState, useRef, useMemo } from 'react';
import type { Classroom } from '../types';
import { ROOM_TYPE_LABELS, BUILDINGS } from '../types';
import { Settings, Plus, Edit2, Trash2, X, Check, Upload, Download, ArrowUp, ArrowDown } from 'lucide-react';
import { parseClassroomCSV, exportToCSV } from '../utils/csvParser';
import { getEquipmentStyle, IMPORTANT_EQUIPMENT_COLORS } from '../types';
import { ClassroomEditModal } from './ClassroomEditModal';

interface Props {
    classrooms: Classroom[];
    onUpdate: (updated: Classroom[]) => void;
    onClose: () => void;
}

export const ClassroomManager = ({ classrooms, onUpdate, onClose }: Props) => {
    const [editingClassroom, setEditingClassroom] = useState<Classroom | null>(null);
    const [editForm, setEditForm] = useState<Partial<Classroom>>({});
    const [isAdding, setIsAdding] = useState(false);
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

    const sortedClassrooms = useMemo(() => {
        if (!sortConfig) return classrooms;
        return [...classrooms].sort((a, b) => {
            const { key, direction } = sortConfig;
            if (key === 'order') return 0; // 手動並び替え時はソート無効

            const aVal = a[key] ?? '';
            const bVal = b[key] ?? '';

            if (aVal < bVal) return direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [classrooms, sortConfig]);

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
        onUpdate([...classrooms, editForm as Classroom]);
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
        setIsAdding(true);
        setEditForm({
            id: '',
            name: '',
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
        if (e.target.files && e.target.files[0]) {
            try {
                const data = await parseClassroomCSV(e.target.files[0]);
                if (confirm(`${data.length}件の教室データを読み込みます。既存のデータは上書きされます。よろしいですか？`)) {
                    onUpdate(data);
                }
            } catch (err) {
                alert('CSV読み込みエラー: ' + err);
            }
        }
    };

    const addEq = () => {
        if (!newEquipment.trim()) return;
        const currentEq = editForm.equipment || [];
        if (!currentEq.includes(newEquipment.trim())) {
            setEditForm({ ...editForm, equipment: [...currentEq, newEquipment.trim()] });
        }
        setNewEquipment('');
    };

    const removeEq = (name: string) => {
        setEditForm({ ...editForm, equipment: (editForm.equipment || []).filter(e => e !== name) });
    };

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
                    <Settings size={22} />
                    <h2 style={{ margin: 0, fontSize: '1.2rem' }}>教室管理</h2>
                </div>
                <button onClick={onClose} style={{
                    background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '1.5rem'
                }}><X /></button>
            </header>

            <div style={{ flex: 1, overflow: 'auto', padding: '30px' }}>
                <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', alignItems: 'flex-end' }}>
                        <div>
                            <p style={{ color: '#666', margin: '0 0 10px 0' }}>教室情報の編集、削除、一括インポートが行えます。</p>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button onClick={startAdding} style={{
                                    display: 'flex', gap: '8px', alignItems: 'center', background: '#646cff', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.9em'
                                }}>
                                    <Plus size={18} /> 新規教室
                                </button>
                                <button onClick={() => fileInputRef.current?.click()} style={{
                                    display: 'flex', gap: '8px', alignItems: 'center', background: '#555', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.9em'
                                }}>
                                    <Upload size={18} /> CSVインポート
                                </button>
                                <button onClick={() => {
                                    const exportData = classrooms.map(r => {
                                        const base: Record<string, any> = {
                                            'ID': r.id,
                                            '教室名': r.name,
                                            '建物': r.building,
                                            '収容人数': r.capacity,
                                            '試験時定員': r.examCapacity ?? '',
                                            '教室タイプ': ROOM_TYPE_LABELS[r.type],
                                            '可動': r.isMovable ? '○' : '',
                                            '配当対象外': r.isExcluded ? '○' : '',
                                        };
                                        r.equipment.forEach(eq => { base[eq] = '○'; });
                                        return base;
                                    });
                                    exportToCSV(exportData, 'classrooms_export.csv');
                                }} style={{
                                    display: 'flex', gap: '8px', alignItems: 'center', background: '#1976d2', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.9em'
                                }}>
                                    <Download size={18} /> CSVエクスポート
                                </button>
                                <input type="file" ref={fileInputRef} onChange={handleImportCSV} accept=".csv" style={{ display: 'none' }} />
                            </div>
                        </div>
                    </div>

                    <div style={{ marginBottom: '20px', padding: '12px 15px', background: '#fff9c4', borderRadius: '6px', border: '1px solid #fbc02d', color: '#827717', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '1.1rem' }}>⚠️</span>
                        <strong>※注意:</strong> 「教室管理」で配当対象外になっている教室には、自動配当時に科目が配当されません。
                    </div>

                    <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', fontSize: '0.9em' }}>
                        <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                            <tr style={{ background: '#f5f5f5', textAlign: 'left' }}>
                                <th style={{ padding: '10px', border: '1px solid #ddd', width: '50px', cursor: 'pointer' }} onClick={() => handleSort('order')}>順</th>
                                <th style={{ padding: '10px', border: '1px solid #ddd', width: '60px', cursor: 'pointer' }} onClick={() => handleSort('id')}>ID</th>
                                <th style={{ padding: '10px', border: '1px solid #ddd', width: '120px', cursor: 'pointer' }} onClick={() => handleSort('name')}>教室名</th>
                                <th style={{ padding: '10px', border: '1px solid #ddd', width: '100px', cursor: 'pointer' }} onClick={() => handleSort('building')}>建物</th>
                                <th style={{ padding: '10px', border: '1px solid #ddd', width: '140px', cursor: 'pointer' }} onClick={() => handleSort('capacity')}>収容人数 (試験)</th>
                                <th style={{ padding: '10px', border: '1px solid #ddd', width: '90px', cursor: 'pointer' }} onClick={() => handleSort('type')}>タイプ</th>
                                <th style={{ padding: '10px', border: '1px solid #ddd' }}>機材・設備</th>
                                <th style={{ padding: '10px', border: '1px solid #ddd', width: '90px', cursor: 'pointer' }} onClick={() => handleSort('isExcluded')}>配当対象外</th>
                                <th style={{ padding: '10px', border: '1px solid #ddd', width: '80px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span>操作</span>
                                        <button
                                            onClick={handleDeleteAll}
                                            style={{ fontSize: '0.7rem', padding: '2px 6px', background: '#d32f2f', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                            title="全件削除"
                                        >全削除</button>
                                    </div>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {isAdding && (
                                <tr style={{ background: '#f0f4ff' }}>
                                    <td style={{ padding: '8px', border: '1px solid #ddd' }}></td>
                                    <td style={{ padding: '8px', border: '1px solid #ddd' }}>
                                        <input value={editForm.id} onChange={e => setEditForm({ ...editForm, id: e.target.value })} style={{ width: '100%' }} placeholder="A101" />
                                    </td>
                                    <td style={{ padding: '8px', border: '1px solid #ddd' }}>
                                        <input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} style={{ width: '100%' }} />
                                    </td>
                                    <td style={{ padding: '8px', border: '1px solid #ddd' }}>
                                        <select value={editForm.building} onChange={e => setEditForm({ ...editForm, building: e.target.value })} style={{ width: '100%', padding: '4px' }}>
                                            {BUILDINGS.map(b => <option key={b} value={b}>{b}</option>)}
                                        </select>
                                    </td>
                                    <td style={{ padding: '8px', border: '1px solid #ddd' }}>
                                        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                            <input type="number" value={editForm.capacity} onChange={e => setEditForm({ ...editForm, capacity: Number(e.target.value) })} style={{ width: '50px' }} />
                                            <span>(</span>
                                            <input type="number" value={editForm.examCapacity} onChange={e => setEditForm({ ...editForm, examCapacity: Number(e.target.value) })} style={{ width: '50px' }} title="試験時定員" />
                                            <span>)</span>
                                        </div>
                                    </td>
                                    <td style={{ padding: '8px', border: '1px solid #ddd' }}>
                                        <select value={editForm.type} onChange={e => setEditForm({ ...editForm, type: e.target.value as any })} style={{ width: '100%' }}>
                                            {Object.entries(ROOM_TYPE_LABELS).map(([val, label]) => (
                                                <option key={val} value={val}>{label}</option>
                                            ))}
                                        </select>
                                    </td>
                                    <td style={{ padding: '8px', border: '1px solid #ddd' }}>
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
                                    </td>
                                    <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'center' }}>
                                        <input
                                            type="checkbox"
                                            checked={!!editForm.isExcluded}
                                            onChange={e => setEditForm({ ...editForm, isExcluded: e.target.checked })}
                                        />
                                    </td>
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
                                        <td style={{ padding: '10px', border: '1px solid #ddd' }}>{room.id}</td>
                                        <td style={{ padding: '10px', border: '1px solid #ddd', fontWeight: 'bold' }}>{room.name}</td>
                                        <td style={{ padding: '10px', border: '1px solid #ddd' }}>{room.building}</td>
                                        <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                                            {room.capacity}名 <span style={{ color: '#999', fontSize: '0.8em' }}>({room.examCapacity || '-'})</span>
                                        </td>
                                        <td style={{ padding: '10px', border: '1px solid #ddd' }}>{ROOM_TYPE_LABELS[room.type]}</td>
                                        <td style={{ padding: '10px', border: '1px solid #ddd', fontSize: '0.85em' }}>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                                <span style={{
                                                    background: IMPORTANT_EQUIPMENT_COLORS[room.isMovable ? '可動' : '固定'].bg,
                                                    color: IMPORTANT_EQUIPMENT_COLORS[room.isMovable ? '可動' : '固定'].text,
                                                    border: `1px solid ${IMPORTANT_EQUIPMENT_COLORS[room.isMovable ? '可動' : '固定'].border}`,
                                                    padding: '2px 8px', borderRadius: '4px', fontSize: '0.8em', fontWeight: 'bold'
                                                }}>
                                                    {room.isMovable ? '可動' : '固定'}
                                                </span>
                                                {room.equipment.map(eq => {
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
                                        </td>
                                        <td style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'center' }}>
                                            <input
                                                type="checkbox"
                                                checked={!!room.isExcluded}
                                                onChange={() => toggleExclusion(room.id)}
                                                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                                title="自動配当の対象から外す"
                                            />
                                        </td>
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
            {editingClassroom && (
                <ClassroomEditModal
                    classroom={editingClassroom}
                    onSave={(updated) => {
                        onUpdate(classrooms.map(r => r.id === updated.id ? updated : r));
                        setEditingClassroom(null);
                    }}
                    onClose={() => setEditingClassroom(null)}
                />
            )}
        </div>
    );
};
