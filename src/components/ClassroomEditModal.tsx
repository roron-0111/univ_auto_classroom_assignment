import { useEffect, useState, type CSSProperties } from 'react';
import { Check, X } from 'lucide-react';
import type { Classroom } from '../types';
import { BUILDINGS, EQUIPMENT_LIST, ROOM_TYPE_LABELS, getEquipmentStyle } from '../types';

interface Props {
  classroom: Classroom;
  existingIds: string[];
  title?: string;
  onSave: (updated: Classroom) => void;
  onClose: () => void;
}

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  border: '1px solid #d1d5db',
  borderRadius: '6px',
  boxSizing: 'border-box'
};

const requiredLabelStyle: CSSProperties = {
  color: '#b91c1c',
  fontWeight: 700
};

const sectionTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: '1rem',
  fontWeight: 700
};

const tagButtonStyle = (active: boolean, eq: string): CSSProperties => {
  const style = getEquipmentStyle(eq);
  return {
    background: active ? style.bg : '#fff',
    color: style.text,
    border: `1px solid ${active ? style.border : '#ddd'}`,
    borderRadius: '999px',
    padding: '6px 12px',
    cursor: 'pointer',
    fontSize: '0.85rem',
    fontWeight: active ? 700 : 500
  };
};

const buildFormFromClassroom = (classroom: Classroom): Classroom => ({
  ...classroom,
  campus: classroom.campus || '',
  equipment: (classroom.equipment || []).filter(eq => eq !== '可動' && eq !== '固定'),
  isMovable: classroom.isMovable ?? (classroom.equipment || []).includes('可動')
});

export const ClassroomEditModal = ({
  classroom,
  existingIds,
  title = '教室情報の編集',
  onSave,
  onClose
}: Props) => {
  const [form, setForm] = useState<Classroom>(() => buildFormFromClassroom(classroom));

  useEffect(() => {
    setForm(buildFormFromClassroom(classroom));
  }, [classroom]);

  const toggleEquipment = (eq: string) => {
    if (eq === '可動') {
      setForm(prev => ({ ...prev, isMovable: true, equipment: (prev.equipment || []).filter(item => item !== '可動' && item !== '固定') }));
      return;
    }
    if (eq === '固定') {
      setForm(prev => ({ ...prev, isMovable: false, equipment: (prev.equipment || []).filter(item => item !== '可動' && item !== '固定') }));
      return;
    }

    setForm(prev => {
      const current = prev.equipment || [];
      return {
        ...prev,
        equipment: current.includes(eq)
          ? current.filter(item => item !== eq)
          : [...current, eq]
      };
    });
  };

  const handleSave = () => {
    const nextId = form.id.trim();
    const nextName = form.name.trim();

    if (!nextId || !nextName) {
      alert('教室IDと教室名を入力してください。');
      return;
    }

    if (existingIds.some(id => id === nextId && id !== classroom.id)) {
      alert('その教室IDは既に存在します。');
      return;
    }

    onSave({
      ...form,
      id: nextId,
      name: nextName,
      campus: classroom.campus || form.campus || '',
      equipment: (form.equipment || []).filter(eq => eq !== '可動' && eq !== '固定'),
      isMovable: !!form.isMovable
    });
  };

  const isMovableActive = !!form.isMovable;
  const activeEquipment = (form.equipment || []).filter(eq => eq !== '可動' && eq !== '固定');

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
          width: 'min(980px, 100%)',
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

        <div style={{ padding: '20px 24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <section style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px', background: '#f8f9fa', borderRadius: '8px' }}>
            <h4 style={{ ...sectionTitleStyle, color: '#1976d2' }}>基本情報</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '10px', alignItems: 'center' }}>
              <label style={requiredLabelStyle}>教室ID</label>
              <input
                value={form.id}
                onChange={e => setForm({ ...form, id: e.target.value })}
                placeholder="IDを入力"
                style={inputStyle}
              />
              <div />
              <div style={{ fontSize: '0.78rem', color: '#6b7280' }}>例: A101 / 1F-201</div>

              <label style={requiredLabelStyle}>教室名</label>
              <input
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                style={inputStyle}
              />

              <label style={requiredLabelStyle}>キャンパス</label>
              <input value={classroom.campus || form.campus || ''} readOnly style={{ ...inputStyle, background: '#f7f7f7', color: '#666' }} />

              <label style={requiredLabelStyle}>建物</label>
              <select value={form.building} onChange={e => setForm({ ...form, building: e.target.value })} style={inputStyle}>
                {BUILDINGS.map(building => (
                  <option key={building} value={building}>{building}</option>
                ))}
              </select>

              <label style={requiredLabelStyle}>タイプ</label>
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value as Classroom['type'] })} style={inputStyle}>
                {Object.entries(ROOM_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>

              <label style={requiredLabelStyle}>収容人数</label>
              <input
                type="number"
                min="1"
                value={form.capacity}
                onChange={e => setForm({ ...form, capacity: Number(e.target.value) })}
                style={inputStyle}
              />

              <label style={requiredLabelStyle}>試験時定員</label>
              <input
                type="number"
                min="1"
                value={form.examCapacity ?? ''}
                onChange={e => setForm({ ...form, examCapacity: e.target.value ? Number(e.target.value) : undefined })}
                style={inputStyle}
              />
            </div>
          </section>

          <section style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px', background: '#fff', borderRadius: '8px', border: '1px solid #e3f2fd' }}>
            <h4 style={{ ...sectionTitleStyle, color: '#2e7d32' }}>機材・設備</h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {EQUIPMENT_LIST.map(eq => {
                const active =
                  eq === '可動'
                    ? isMovableActive
                    : eq === '固定'
                      ? !isMovableActive
                      : activeEquipment.includes(eq);
                return (
                  <button
                    key={eq}
                    type="button"
                    onClick={() => toggleEquipment(eq)}
                    style={tagButtonStyle(active, eq)}
                  >
                    {eq}
                  </button>
                );
              })}
            </div>
            <div style={{ fontSize: '0.86rem', color: '#6b7280', lineHeight: 1.6 }}>
              <div>・可動 / 固定は、教室の可動性を表します。</div>
              <div>・その他のタグは、クリックでオン / オフを切り替えます。</div>
            </div>
          </section>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '0 24px 24px' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: '#f3f4f6',
              color: '#111827',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              padding: '8px 16px',
              cursor: 'pointer'
            }}
          >
            <X size={16} /> キャンセル
          </button>
          <button
            type="button"
            onClick={handleSave}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: '#4f46e5',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              padding: '8px 16px',
              cursor: 'pointer'
            }}
          >
            <Check size={16} /> 保存
          </button>
        </div>
      </div>
    </div>
  );
};
