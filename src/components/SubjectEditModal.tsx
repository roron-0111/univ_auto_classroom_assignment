import { useState, useEffect } from 'react';
import type { Subject, Term, DayOfWeek, Period } from '../types';
import { DAY_LABELS, DEPARTMENTS, BUILDINGS, getEquipmentStyle } from '../types';
import { X, Check } from 'lucide-react';

interface Props {
    subject: Subject;
    availableEquipment: string[];
    onSave: (updated: Subject) => void;
    onClose: () => void;
}

export const SubjectEditModal = ({ subject, availableEquipment, onSave, onClose }: Props) => {
    const [form, setForm] = useState<Subject>({
        ...subject,
        requiredEquipment: subject.requiredEquipment || [],
        mandatoryEquipment: subject.mandatoryEquipment || []
    });

    useEffect(() => {
        setForm({
            ...subject,
            requiresMovable: subject.requiresMovable || false,
            requiredEquipment: subject.requiredEquipment || [],
            mandatoryEquipment: subject.mandatoryEquipment || []
        });
    }, [subject]);

    const handleSave = () => {
        if (!form.name || !form.code) {
            alert('時間割コードと時間割名称を入力してください。');
            return;
        }
        // endPeriod が period より小さい場合は補正
        const saved = { ...form };
        if (saved.endPeriod && saved.endPeriod < saved.period) {
            saved.endPeriod = saved.period;
        }
        // endPeriod が period と同じなら省略（単一講時）
        if (saved.endPeriod === saved.period) {
            saved.endPeriod = undefined;
        }
        onSave(saved);
    };

    return (
        <div className="modal-overlay" style={{
            position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
            background: 'rgba(0,0,0,0.5)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
            <div style={{ background: '#fff', padding: '20px 24px', borderRadius: '8px', maxWidth: '900px', width: '95%', maxHeight: '92vh', overflow: 'auto', boxShadow: '0 4px 16px rgba(0,0,0,0.18)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                    <h3 style={{ margin: 0, fontSize: '1rem' }}>授業情報の編集</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}><X /></button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.88rem' }}>
                    {/* --- 上段: 基本情報 + 開講条件 2カラム --- */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        {/* 左: 基本情報 */}
                        <section style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', background: '#f8f9fa', borderRadius: '6px' }}>
                            <h4 style={{ margin: '0 0 4px 0', color: '#1976d2', borderBottom: '2px solid #e3f2fd', paddingBottom: '4px', fontSize: '0.85rem' }}>基本情報</h4>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <div style={{ width: '110px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <label style={{ fontWeight: 'bold', color: '#555', fontSize: '0.8rem' }}>時間割コード</label>
                                    <input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} style={{ padding: '6px', border: '1px solid #ddd', borderRadius: '4px' }} />
                                </div>
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <label style={{ fontWeight: 'bold', color: '#555', fontSize: '0.8rem' }}>時間割名称</label>
                                    <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={{ padding: '6px', border: '1px solid #ddd', borderRadius: '4px' }} />
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <label style={{ fontWeight: 'bold', color: '#555', fontSize: '0.8rem' }}>代表教員</label>
                                    <input value={form.teacher} onChange={e => setForm({ ...form, teacher: e.target.value })} style={{ padding: '6px', border: '1px solid #ddd', borderRadius: '4px' }} />
                                </div>
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <label style={{ fontWeight: 'bold', color: '#555', fontSize: '0.8rem' }}>開講学部</label>
                                    <input value={form.faculty || ''} onChange={e => setForm({ ...form, faculty: e.target.value })} style={{ padding: '6px', border: '1px solid #ddd', borderRadius: '4px' }} placeholder="例: 理工学部" />
                                </div>
                                <div style={{ width: '70px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <label style={{ fontWeight: 'bold', color: '#555', fontSize: '0.8rem' }}>管轄</label>
                                    <select value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} style={{ padding: '6px', border: '1px solid #ddd', borderRadius: '4px' }}>
                                        {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <label style={{ fontWeight: 'bold', color: '#555', fontSize: '0.8rem' }}>キャンパス</label>
                                    <input value={form.campus || ''} onChange={e => setForm({ ...form, campus: e.target.value })} style={{ padding: '6px', border: '1px solid #ddd', borderRadius: '4px' }} placeholder="例: 寝屋川" />
                                </div>
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <label style={{ fontWeight: 'bold', color: '#555', fontSize: '0.8rem' }}>過年度教室 <span style={{ fontWeight: 'normal', color: '#999', fontSize: '0.75rem' }}>(;区切り)</span></label>
                                    <input
                                        value={form.previousRooms?.join(', ') || ''}
                                        onChange={e => setForm({ ...form, previousRooms: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                                        style={{ padding: '6px', border: '1px solid #ddd', borderRadius: '4px' }}
                                        placeholder="例: 3-201; 7-107"
                                    />
                                </div>
                            </div>
                        </section>

                        {/* 右: 開講条件 + 配当設定 */}
                        <section style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', border: '1px solid #e3f2fd', borderRadius: '6px' }}>
                            <h4 style={{ margin: '0 0 4px 0', color: '#2e7d32', borderBottom: '2px solid #e8f5e9', paddingBottom: '4px', fontSize: '0.85rem' }}>開講条件・配当</h4>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <label style={{ fontWeight: 'bold', color: '#555', fontSize: '0.8rem' }}>配当期</label>
                                    <select value={form.term} onChange={e => setForm({ ...form, term: e.target.value as Term })} style={{ padding: '6px', border: '1px solid #ddd', borderRadius: '4px' }}>
                                        <option value="spring">春学期</option>
                                        <option value="spring_first">春学期前半</option>
                                        <option value="spring_second">春学期後半</option>
                                        <option value="autumn">秋学期</option>
                                        <option value="autumn_first">秋学期前半</option>
                                        <option value="autumn_second">秋学期後半</option>
                                        <option value="full_year">通年</option>
                                    </select>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <label style={{ fontWeight: 'bold', color: '#555', fontSize: '0.8rem' }}>曜日</label>
                                    <select value={form.day} onChange={e => setForm({ ...form, day: e.target.value as DayOfWeek })} style={{ padding: '6px', border: '1px solid #ddd', borderRadius: '4px' }}>
                                        {Object.entries(DAY_LABELS).map(([val, label]) => <option key={val} value={val}>{label}</option>)}
                                    </select>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <label style={{ fontWeight: 'bold', color: '#555', fontSize: '0.8rem' }}>講時（開始）</label>
                                    <select value={form.period} onChange={e => setForm({ ...form, period: Number(e.target.value) as Period })} style={{ padding: '6px', border: '1px solid #ddd', borderRadius: '4px' }}>
                                        {[1, 2, 3, 4, 5, 6, 7].map(p => <option key={p} value={p}>{p}講時</option>)}
                                    </select>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <label style={{ fontWeight: 'bold', color: '#555', fontSize: '0.8rem' }}>講時（終了）</label>
                                    <select value={form.endPeriod || form.period} onChange={e => setForm({ ...form, endPeriod: Number(e.target.value) as Period })} style={{ padding: '6px', border: '1px solid #ddd', borderRadius: '4px' }}>
                                        {[1, 2, 3, 4, 5, 6, 7].map(p => <option key={p} value={p}>{p}講時</option>)}
                                    </select>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <label style={{ fontWeight: 'bold', color: '#555', fontSize: '0.8rem' }}>履修想定人数</label>
                                    <input type="number" value={form.requiredCapacity} onChange={e => setForm({ ...form, requiredCapacity: Number(e.target.value) })} style={{ padding: '6px', border: '1px solid #ddd', borderRadius: '4px' }} />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <label style={{ fontWeight: 'bold', color: '#555', fontSize: '0.8rem' }}>優先度</label>
                                        <input type="number" min="1" max="5" value={form.priority} onChange={e => setForm({ ...form, priority: Number(e.target.value) })} style={{ padding: '6px', border: '1px solid #ddd', borderRadius: '4px' }} />
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <label style={{ fontWeight: 'bold', color: '#555', fontSize: '0.8rem' }}>必要教室数</label>
                                        <input type="number" min="1" max="10" value={form.requiredRoomCount || 1} onChange={e => setForm({ ...form, requiredRoomCount: Number(e.target.value) })} style={{ padding: '6px', border: '1px solid #ddd', borderRadius: '4px' }} />
                                    </div>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <label style={{ fontWeight: 'bold', color: '#555', fontSize: '0.8rem' }}>希望建物</label>
                                    <select value={form.buildingPreference || ''} onChange={e => setForm({ ...form, buildingPreference: e.target.value })} style={{ padding: '6px', border: '1px solid #ddd', borderRadius: '4px' }}>
                                        <option value="">(未選択)</option>
                                        {BUILDINGS.map(b => <option key={b} value={b}>{b}</option>)}
                                    </select>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <label style={{ fontWeight: 'bold', color: '#555', fontSize: '0.8rem' }}>希望教室タイプ</label>
                                    <select value={form.preferredRoomType || 'normal'} onChange={e => setForm({ ...form, preferredRoomType: e.target.value as any })} style={{ padding: '6px', border: '1px solid #ddd', borderRadius: '4px' }}>
                                        <option value="normal">一般</option>
                                        <option value="pc">PC室</option>
                                        <option value="seminar">ゼミ室</option>
                                    </select>
                                </div>
                            </div>
                        </section>
                    </div>

                    {/* --- 機材・設備要件 --- */}
                    <section style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', background: '#fafafa', borderRadius: '6px', border: '1px solid #eee' }}>
                        <h4 style={{ margin: '0 0 4px 0', color: '#555', fontSize: '0.85rem' }}>機材・設備要件 <span style={{ fontWeight: 'normal', color: '#999', fontSize: '0.75rem' }}>希望: チェック / 必須: さらに「必須」をON</span></h4>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '6px' }}>
                            {availableEquipment.filter(eq => eq !== '固定' && eq !== '固定式' && eq !== '可動式').map(eq => {
                                const isRequired = form.requiredEquipment?.includes(eq) || (eq === '可動' && form.requiresMovable);
                                const isMandatory = form.mandatoryEquipment?.includes(eq);
                                const style = getEquipmentStyle(eq);

                                return (
                                    <div key={eq} style={{
                                        display: 'flex', alignItems: 'center', gap: '6px',
                                        padding: '5px 8px', borderRadius: '4px',
                                        border: isRequired ? `1px solid ${style.border}` : '1px solid #e0e0e0',
                                        background: isRequired ? style.bg : '#fff'
                                    }}>
                                        <label style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', minWidth: 0 }}>
                                            <input
                                                type="checkbox"
                                                checked={!!isRequired}
                                                onChange={(e) => {
                                                    const checked = e.target.checked;
                                                    let nextRequired = form.requiredEquipment || [];
                                                    if (checked) {
                                                        if (!nextRequired.includes(eq)) nextRequired = [...nextRequired, eq];
                                                    } else {
                                                        nextRequired = nextRequired.filter(item => item !== eq);
                                                    }
                                                    const updates: Partial<Subject> & { requiresMovable?: boolean } = { requiredEquipment: nextRequired };
                                                    if (eq === '可動') updates.requiresMovable = checked;
                                                    if (!checked && isMandatory) {
                                                        updates.mandatoryEquipment = (form.mandatoryEquipment || []).filter(item => item !== eq);
                                                    }
                                                    setForm({ ...form, ...updates });
                                                }}
                                            />
                                            <span style={{ fontSize: '0.82rem', color: isRequired ? style.text : '#555', fontWeight: isRequired ? 'bold' : 'normal', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{eq}</span>
                                        </label>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '3px', cursor: 'pointer', borderLeft: '1px solid #ddd', paddingLeft: '6px', flexShrink: 0 }}>
                                            <input
                                                type="checkbox"
                                                checked={!!isMandatory}
                                                disabled={!isRequired}
                                                onChange={(e) => {
                                                    const checked = e.target.checked;
                                                    let nextMandatory = form.mandatoryEquipment || [];
                                                    if (checked) {
                                                        if (!nextMandatory.includes(eq)) nextMandatory = [...nextMandatory, eq];
                                                    } else {
                                                        nextMandatory = nextMandatory.filter(item => item !== eq);
                                                    }
                                                    setForm({ ...form, mandatoryEquipment: nextMandatory });
                                                }}
                                            />
                                            <span style={{ fontSize: '0.72rem', color: isMandatory ? '#d32f2f' : '#aaa', fontWeight: isMandatory ? 'bold' : 'normal' }}>必須</span>
                                        </label>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
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
