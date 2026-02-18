import { useState, useEffect } from 'react';
import type { Classroom } from '../types';
import { ROOM_TYPE_LABELS, getEquipmentStyle, BUILDINGS } from '../types';
import { X, Check } from 'lucide-react';

interface Props {
    classroom: Classroom;
    onSave: (updated: Classroom) => void;
    onClose: () => void;
}

export const ClassroomEditModal = ({ classroom, onSave, onClose }: Props) => {
    const [form, setForm] = useState<Classroom>({ ...classroom });
    const [newEquipment, setNewEquipment] = useState('');

    useEffect(() => {
        setForm({ ...classroom });
    }, [classroom]);

    const handleSave = () => {
        if (!form.name) return;
        onSave(form);
    };

    const addEq = () => {
        if (!newEquipment.trim()) return;
        const currentEq = form.equipment || [];
        if (!currentEq.includes(newEquipment.trim())) {
            setForm({ ...form, equipment: [...currentEq, newEquipment.trim()] });
        }
        setNewEquipment('');
    };

    const removeEq = (name: string) => {
        setForm({ ...form, equipment: (form.equipment || []).filter(e => e !== name) });
    };

    return (
        <div className="modal-overlay" style={{
            position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
            background: 'rgba(0,0,0,0.5)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
            <div style={{ background: '#fff', padding: '25px', borderRadius: '8px', maxWidth: '500px', width: '90%', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h3 style={{ margin: 0 }}>教室情報の編集</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}><X /></button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', fontSize: '0.9rem' }}>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <div style={{ width: '100px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                            <label style={{ fontWeight: 'bold', color: '#555' }}>教室ID</label>
                            <input disabled value={form.id} style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px', background: '#f5f5f5' }} />
                        </div>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '5px' }}>
                            <label style={{ fontWeight: 'bold', color: '#555' }}>教室名</label>
                            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }} />
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '10px' }}>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '5px' }}>
                            <label style={{ fontWeight: 'bold', color: '#555' }}>建物</label>
                            <select value={form.building} onChange={e => setForm({ ...form, building: e.target.value })} style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}>
                                {BUILDINGS.map(b => <option key={b} value={b}>{b}</option>)}
                            </select>
                        </div>
                        <div style={{ width: '120px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                            <label style={{ fontWeight: 'bold', color: '#555' }}>タイプ</label>
                            <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value as Classroom['type'] })} style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}>
                                {Object.entries(ROOM_TYPE_LABELS).map(([val, label]) => (
                                    <option key={val} value={val}>{label}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '10px' }}>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '5px' }}>
                            <label style={{ fontWeight: 'bold', color: '#555' }}>収容人数</label>
                            <input type="number" value={form.capacity} onChange={e => setForm({ ...form, capacity: Number(e.target.value) })} style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }} />
                        </div>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '5px' }}>
                            <label style={{ fontWeight: 'bold', color: '#555' }}>試験時定員</label>
                            <input type="number" value={form.examCapacity || ''} onChange={e => setForm({ ...form, examCapacity: Number(e.target.value) })} style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }} />
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '15px', padding: '5px 0' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                            <input type="checkbox" checked={form.isMovable} onChange={e => setForm({ ...form, isMovable: e.target.checked })} /> 可動
                        </label>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ fontWeight: 'bold', color: '#555' }}>機材・設備</label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '4px' }}>
                            {form.equipment.map(eq => {
                                const style = getEquipmentStyle(eq);
                                return (
                                    <span key={eq} style={{
                                        background: style.bg, color: style.text, border: `1px solid ${style.border}`,
                                        padding: '2px 10px', borderRadius: '15px', fontSize: '0.8em', display: 'flex', alignItems: 'center', gap: '4px'
                                    }}>
                                        {eq} <X size={12} onClick={() => removeEq(eq)} style={{ cursor: 'pointer' }} />
                                    </span>
                                );
                            })}
                        </div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                            <input
                                value={newEquipment}
                                onChange={e => setNewEquipment(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && addEq()}
                                placeholder="追加する機材名"
                                style={{ flex: 1, padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                            />
                            <button onClick={addEq} style={{ padding: '8px 15px', background: '#eee', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>追加</button>
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '30px' }}>
                    <button onClick={onClose} style={{ padding: '8px 20px', background: '#eee', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>キャンセル</button>
                    <button onClick={handleSave} style={{
                        display: 'flex', alignItems: 'center', gap: '5px', padding: '8px 20px', background: '#646cff', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer'
                    }}>
                        <Check size={18} /> 保存
                    </button>
                </div>
            </div>
        </div>
    );
};
