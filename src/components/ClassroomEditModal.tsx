import { useState } from 'react';
import { X, Check } from 'lucide-react';
import type { Classroom } from '../types';
import { ROOM_TYPE_LABELS, getEquipmentStyle, BUILDINGS, EQUIPMENT_LIST } from '../types';

interface Props {
  classroom: Classroom;
  title?: string;
  onSave: (updated: Classroom) => void;
  onClose: () => void;
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px',
  border: '1px solid #ddd',
  borderRadius: '4px',
  boxSizing: 'border-box'
};

export const ClassroomEditModal = ({ classroom, title = '教室情報の編集', onSave, onClose }: Props) => {
  const [form, setForm] = useState<Classroom>({ ...classroom });

  const handleSave = () => {
    if (!form.id || !form.name) {
      alert('教室IDと教室名を入力してください。');
      return;
    }
    onSave(form);
  };

  const toggleEq = (name: string) => {
    const current = form.equipment || [];
    setForm({
      ...form,
      equipment: current.includes(name) ? current.filter(e => e !== name) : [...current, name]
    });
  };

  const availableEquipment = EQUIPMENT_LIST;

  return (
    <div
      className="modal-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        zIndex: 1100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}
    >
      <div
        style={{
          background: '#fff',
          width: 'min(900px, 100%)',
          maxHeight: '92vh',
          overflow: 'auto',
          borderRadius: '12px',
          boxShadow: '0 18px 40px rgba(0,0,0,0.22)'
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '18px 24px',
            borderBottom: '1px solid #e5e7eb'
          }}
        >
          <h3 style={{ margin: 0, fontSize: '1.05rem' }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }} aria-label="閉じる">
            <X />
          </button>
        </div>

        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '0.9rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: '10px', alignItems: 'center' }}>
            <label style={{ fontWeight: 700, color: '#555' }}>教室ID</label>
            <input disabled value={form.id} style={{ ...inputStyle, background: '#f5f5f5' }} />

            <label style={{ fontWeight: 700, color: '#555' }}>教室名</label>
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={inputStyle} />

            <label style={{ fontWeight: 700, color: '#555' }}>キャンパス</label>
            <input value={form.campus || ''} readOnly style={{ ...inputStyle, background: '#f5f5f5', color: '#666' }} />

            <label style={{ fontWeight: 700, color: '#555' }}>建物</label>
            <select value={form.building} onChange={e => setForm({ ...form, building: e.target.value })} style={inputStyle}>
              {BUILDINGS.map(b => <option key={b} value={b}>{b}</option>)}
            </select>

            <label style={{ fontWeight: 700, color: '#555' }}>タイプ</label>
            <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value as Classroom['type'] })} style={inputStyle}>
              {Object.entries(ROOM_TYPE_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>

            <label style={{ fontWeight: 700, color: '#555' }}>収容人数</label>
            <input type="number" value={form.capacity} onChange={e => setForm({ ...form, capacity: Number(e.target.value) })} style={inputStyle} />

            <label style={{ fontWeight: 700, color: '#555' }}>試験時定員</label>
            <input type="number" value={form.examCapacity || ''} onChange={e => setForm({ ...form, examCapacity: Number(e.target.value) })} style={inputStyle} />
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
            <input type="checkbox" checked={form.isMovable} onChange={e => setForm({ ...form, isMovable: e.target.checked })} />
            可動
          </label>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontWeight: 700, color: '#555' }}>機材・設備</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {availableEquipment.map(eq => {
                const has = (form.equipment || []).includes(eq);
                const s = getEquipmentStyle(eq);
                return (
                  <button
                    key={eq}
                    type="button"
                    onClick={() => toggleEq(eq)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      cursor: 'pointer',
                      padding: '3px 10px',
                      borderRadius: '15px',
                      fontSize: '0.82em',
                      background: has ? s.bg : '#f5f5f5',
                      color: has ? s.text : '#999',
                      border: `1px solid ${has ? s.border : '#e0e0e0'}`,
                      fontWeight: has ? 'bold' : 'normal'
                    }}
                  >
                    {eq}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '0 24px 24px' }}>
          <button onClick={onClose} style={{ padding: '8px 20px', background: '#eee', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>キャンセル</button>
          <button onClick={handleSave} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '8px 20px', background: '#646cff', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
            <Check size={18} /> 保存
          </button>
        </div>
      </div>
    </div>
  );
};
