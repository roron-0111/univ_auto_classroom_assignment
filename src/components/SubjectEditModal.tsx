import { useState, useEffect } from 'react';
import type { Subject, Term, DayOfWeek, Period } from '../types';
import { DAY_LABELS, DEPARTMENTS, BUILDINGS, getEquipmentStyle } from '../types';
import { X, Check, HelpCircle } from 'lucide-react';

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
            <div style={{ background: '#fff', padding: '25px', borderRadius: '8px', maxWidth: '850px', width: '90%', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h3 style={{ margin: 0 }}>授業情報の編集</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}><X /></button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', fontSize: '0.9rem' }}>
                    {/* --- 基本情報 --- */}
                    <section style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '15px', background: '#f8f9fa', borderRadius: '6px' }}>
                        <h4 style={{ margin: '0 0 5px 0', color: '#1976d2', borderBottom: '2px solid #e3f2fd', paddingBottom: '5px' }}>基本情報</h4>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <div style={{ width: '120px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                <label style={{ fontWeight: 'bold', color: '#555' }}>時間割コード</label>
                                <input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }} />
                            </div>
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                <label style={{ fontWeight: 'bold', color: '#555' }}>時間割名称</label>
                                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }} />
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '10px' }}>
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                <label style={{ fontWeight: 'bold', color: '#555' }}>代表教員</label>
                                <input value={form.teacher} onChange={e => setForm({ ...form, teacher: e.target.value })} style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }} />
                            </div>
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                <label style={{ fontWeight: 'bold', color: '#555' }}>開講学部</label>
                                <input value={form.faculty || ''} onChange={e => setForm({ ...form, faculty: e.target.value })} style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }} placeholder="例: 理工学部" />
                            </div>
                            <div style={{ width: '80px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                <label style={{ fontWeight: 'bold', color: '#555' }}>管轄</label>
                                <select value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}>
                                    {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                                </select>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '10px' }}>
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                <label style={{ fontWeight: 'bold', color: '#555' }}>配当期</label>
                                <select value={form.term} onChange={e => setForm({ ...form, term: e.target.value as Term })} style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}>
                                    <option value="spring">春学期</option>
                                    <option value="spring_first">春学期前半</option>
                                    <option value="spring_second">春学期後半</option>
                                    <option value="autumn">秋学期</option>
                                    <option value="autumn_first">秋学期前半</option>
                                    <option value="autumn_second">秋学期後半</option>
                                    <option value="full_year">通年</option>
                                </select>
                            </div>
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                <label style={{ fontWeight: 'bold', color: '#555' }}>曜日</label>
                                <select value={form.day} onChange={e => setForm({ ...form, day: e.target.value as DayOfWeek })} style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}>
                                    {Object.entries(DAY_LABELS).map(([val, label]) => <option key={val} value={val}>{label}</option>)}
                                </select>
                            </div>
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                <label style={{ fontWeight: 'bold', color: '#555' }}>講時: 開始</label>
                                <select value={form.period} onChange={e => setForm({ ...form, period: Number(e.target.value) as Period })} style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}>
                                    {[1, 2, 3, 4, 5, 6, 7].map(p => <option key={p} value={p}>{p}講時</option>)}
                                </select>
                            </div>
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                <label style={{ fontWeight: 'bold', color: '#555' }}>講時: 終了</label>
                                <select value={form.endPeriod || form.period} onChange={e => setForm({ ...form, endPeriod: Number(e.target.value) as Period })} style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}>
                                    {[1, 2, 3, 4, 5, 6, 7].map(p => <option key={p} value={p}>{p}講時</option>)}
                                </select>
                            </div>
                        </div>
                    </section>

                    {/* --- 配当・希望条件 --- */}
                    <section style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '15px', border: '1px solid #e3f2fd', borderRadius: '6px' }}>
                        <h4 style={{ margin: '0 0 5px 0', color: '#2e7d32', borderBottom: '2px solid #e8f5e9', paddingBottom: '5px' }}>配当・希望条件</h4>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                <label style={{ fontWeight: 'bold', color: '#555' }}>キャンパス</label>
                                <input value={form.campus || ''} onChange={e => setForm({ ...form, campus: e.target.value })} style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }} placeholder="例: 寝屋川" />
                            </div>
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                <label style={{ fontWeight: 'bold', color: '#555' }}>希望建物</label>
                                <select
                                    value={form.buildingPreference || ''}
                                    onChange={e => setForm({ ...form, buildingPreference: e.target.value })}
                                    style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                                >
                                    <option value="">(未選択)</option>
                                    {BUILDINGS.map(b => <option key={b} value={b}>{b}</option>)}
                                </select>
                            </div>
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                <label style={{ fontWeight: 'bold', color: '#555' }}>希望教室タイプ</label>
                                <select value={form.preferredRoomType || 'normal'} onChange={e => setForm({ ...form, preferredRoomType: e.target.value as any })} style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}>
                                    <option value="normal">一般</option>
                                    <option value="pc">PC室</option>
                                    <option value="seminar">ゼミ室</option>
                                </select>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '10px' }}>
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                <label style={{ fontWeight: 'bold', color: '#555' }}>履修想定人数</label>
                                <input type="number" value={form.requiredCapacity} onChange={e => setForm({ ...form, requiredCapacity: Number(e.target.value) })} style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }} />
                            </div>
                            <div style={{ width: '100px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                <label style={{ fontWeight: 'bold', color: '#555', whiteSpace: 'nowrap' }}>科目の優先度</label>
                                <input type="number" min="1" max="5" value={form.priority} onChange={e => setForm({ ...form, priority: Number(e.target.value) })} style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }} />
                            </div>
                            <div style={{ width: '100px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                <label style={{ fontWeight: 'bold', color: '#555', whiteSpace: 'nowrap' }}>必要教室数</label>
                                <input type="number" min="1" max="10" value={form.requiredRoomCount || 1} onChange={e => setForm({ ...form, requiredRoomCount: Number(e.target.value) })} style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }} />
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label style={{ fontWeight: 'bold', color: '#555' }}>教室機材・設備要件</label>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px' }}>
                                {/* プロジェクターと可動机椅子を含めた全機材を表示 */}
                                {['PJ', '可動', ...availableEquipment.filter(eq => eq !== 'PJ' && eq !== '可動' && eq !== '可動式' && eq !== '固定' && eq !== '固定式')].map(eq => {
                                    const isRequired = form.requiredEquipment?.includes(eq) || (eq === 'PJ' && form.requiresProjector) || (eq === '可動' && form.requiresMovable);
                                    const isMandatory = form.mandatoryEquipment?.includes(eq);
                                    const style = getEquipmentStyle(eq);

                                    return (
                                        <div key={eq} style={{
                                            display: 'flex', alignItems: 'center', gap: '8px',
                                            background: '#f5f5f5', padding: '6px 10px', borderRadius: '4px',
                                            border: isRequired ? `1px solid ${style.border}` : '1px solid #ddd',
                                            backgroundColor: isRequired ? '#fff' : '#f9f9f9'
                                        }}>
                                            <label style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
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

                                                        // 既存フラグとの同期
                                                        const updates: any = { requiredEquipment: nextRequired };
                                                        if (eq === 'PJ') updates.requiresProjector = checked;
                                                        if (eq === '可動') updates.requiresMovable = checked;

                                                        // 必須がONで希望をOFFにした場合、必須もOFFにする
                                                        if (!checked && isMandatory) {
                                                            updates.mandatoryEquipment = (form.mandatoryEquipment || []).filter(item => item !== eq);
                                                        }

                                                        setForm({ ...form, ...updates });
                                                    }}
                                                />
                                                <span style={{
                                                    fontSize: '0.9rem',
                                                    color: isRequired ? style.text : '#666',
                                                    fontWeight: isRequired ? 'bold' : 'normal'
                                                }}>{eq}</span>
                                            </label>

                                            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', borderLeft: '1px solid #ddd', paddingLeft: '8px' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={!!isMandatory}
                                                    disabled={!isRequired} // 希望がOFFなら必須も選べない
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
                                                <span style={{ fontSize: '0.75rem', color: isMandatory ? '#d32f2f' : '#999', fontWeight: isMandatory ? 'bold' : 'normal' }}>必須</span>
                                            </label>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </section>

                    {/* --- 参考情報 --- */}
                    <section style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '15px', background: '#fff9f9', borderRadius: '6px' }}>
                        <h4 style={{ margin: '0 0 5px 0', color: '#d32f2f', borderBottom: '2px solid #ffebee', paddingBottom: '5px' }}>参考情報</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                            <label style={{ fontWeight: 'bold', color: '#555', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                教室 (過年度参考) <span title="複数ある場合はセミコロン(;)で区切ってください"><HelpCircle size={14} /></span>
                            </label>
                            <input
                                value={form.previousRooms?.join('; ') || ''}
                                onChange={e => setForm({ ...form, previousRooms: e.target.value.split(';').map(s => s.trim()).filter(Boolean) })}
                                style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                                placeholder="例: 3-201; 7-107"
                            />
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
