import { useState, useRef } from 'react';
import type { Classroom } from '../types';
import { ROOM_TYPE_LABELS, BUILDINGS } from '../types';
import { Settings, Plus, Edit2, Trash2, X, Check, Upload, Download } from 'lucide-react';
import { parseClassroomCSV, exportToCSV } from '../utils/csvParser';
import { getEquipmentStyle, IMPORTANT_EQUIPMENT_COLORS } from '../types';

interface Props {
    classrooms: Classroom[];
    onUpdate: (updated: Classroom[]) => void;
    onClose: () => void;
}

export const ClassroomManager = ({ classrooms, onUpdate, onClose }: Props) => {
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<Partial<Classroom>>({});
    const [isAdding, setIsAdding] = useState(false);
    const [newEquipment, setNewEquipment] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleEdit = (room: Classroom) => {
        setEditingId(room.id);
        setEditForm({ ...room });
    };

    const handleSave = () => {
        if (!editForm.id || !editForm.name) {
            alert('教室IDと教室名を入力してください。');
            return;
        }

        if (isAdding) {
            if (classrooms.find(r => r.id === editForm.id)) {
                alert('その教室IDは既に存在します。');
                return;
            }
            onUpdate([...classrooms, editForm as Classroom]);
            setIsAdding(false);
        } else {
            onUpdate(classrooms.map(r => r.id === editingId ? (editForm as Classroom) : r));
            setEditingId(null);
        }
        setEditForm({});
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
            equipment: []
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
                    <h2 style={{ margin: 0, fontSize: '1.2rem' }}>教室マスタ管理</h2>
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
                                <button onClick={() => exportToCSV(classrooms, 'classrooms_export.csv')} style={{
                                    display: 'flex', gap: '8px', alignItems: 'center', background: '#1976d2', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.9em'
                                }}>
                                    <Download size={18} /> CSVエクスポート
                                </button>
                                <input type="file" ref={fileInputRef} onChange={handleImportCSV} accept=".csv" style={{ display: 'none' }} />
                            </div>
                        </div>
                    </div>

                    <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', fontSize: '0.9em' }}>
                        <thead>
                            <tr style={{ background: '#f5f5f5', textAlign: 'left' }}>
                                <th style={{ padding: '10px', border: '1px solid #ddd', width: '60px' }}>ID</th>
                                <th style={{ padding: '10px', border: '1px solid #ddd', width: '120px' }}>教室名</th>
                                <th style={{ padding: '10px', border: '1px solid #ddd', width: '100px' }}>建物</th>
                                <th style={{ padding: '10px', border: '1px solid #ddd', width: '140px' }}>収容人数 (試験)</th>
                                <th style={{ padding: '10px', border: '1px solid #ddd', width: '90px' }}>タイプ</th>
                                <th style={{ padding: '10px', border: '1px solid #ddd' }}>機材・設備</th>
                                <th style={{ padding: '10px', border: '1px solid #ddd', width: '80px' }}>操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(isAdding || editingId) && (
                                <tr style={{ background: '#f0f4ff' }}>
                                    <td style={{ padding: '8px', border: '1px solid #ddd' }}>
                                        <input disabled={!isAdding} value={editForm.id} onChange={e => setEditForm({ ...editForm, id: e.target.value })} style={{ width: '100%' }} placeholder="A101" />
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
                                    <td style={{ padding: '8px', border: '1px solid #ddd' }}>
                                        <div style={{ display: 'flex', gap: '6px' }}>
                                            <button onClick={handleSave} style={{ background: '#2e7d32', color: '#fff', border: 'none', padding: '6px', borderRadius: '4px', cursor: 'pointer' }}><Check size={16} /></button>
                                            <button onClick={() => { setEditingId(null); setIsAdding(false); setEditForm({}); }} style={{ background: '#d32f2f', color: '#fff', border: 'none', padding: '6px', borderRadius: '4px', cursor: 'pointer' }}><X size={16} /></button>
                                        </div>
                                    </td>
                                </tr>
                            )}
                            {classrooms.map(room => (
                                room.id !== editingId && (
                                    <tr key={room.id} style={{ borderBottom: '1px solid #eee' }}>
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
                                        <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                                            <div style={{ display: 'flex', gap: '10px' }}>
                                                <button onClick={() => handleEdit(room)} style={{ background: 'none', border: 'none', color: '#1976d2', cursor: 'pointer' }} title="編集"><Edit2 size={16} /></button>
                                                <button onClick={() => handleDelete(room.id)} style={{ background: 'none', border: 'none', color: '#d32f2f', cursor: 'pointer' }} title="削除"><Trash2 size={16} /></button>
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
    );
};
