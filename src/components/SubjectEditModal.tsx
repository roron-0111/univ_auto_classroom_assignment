import { useMemo, useState } from 'react';
import { X, Check } from 'lucide-react';
import type { Subject, Term, DayOfWeek, Period } from '../types';
import { DAY_LABELS, BUILDINGS, getEquipmentStyle } from '../types';
import { SUBJECT_EQUIPMENT_CHOICES } from '../utils/equipmentVisibility';

interface Props {
  subject: Subject;
  availableEquipment: string[];
  currentCampusLabel: string;
  facultyOptions: string[];
  departmentOptions: string[];
  title?: string;
  onSave: (updated: Subject) => void;
  onClose: () => void;
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  border: '1px solid #d1d5db',
  borderRadius: '6px',
  boxSizing: 'border-box'
};

const requiredLabelStyle: React.CSSProperties = {
  color: '#b91c1c',
  fontWeight: 700
};

const labelStyle: React.CSSProperties = {
  fontWeight: 600
};

const sectionTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '1rem',
  fontWeight: 700
};

const checkboxLabelStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  cursor: 'pointer'
};

export const SubjectEditModal = ({
  subject,
  availableEquipment,
  currentCampusLabel,
  facultyOptions,
  departmentOptions,
  title = '授業情報の編集',
  onSave,
  onClose
}: Props) => {
  const [form, setForm] = useState<Subject>({
    ...subject,
    campus: currentCampusLabel,
    faculty: subject.faculty || facultyOptions[0] || '',
    department: subject.department || departmentOptions[0] || '',
    priority: subject.priority ?? 1,
    requiredEquipment: subject.requiredEquipment || [],
    mandatoryEquipment: subject.mandatoryEquipment || [],
    previousRooms: subject.previousRooms || []
  });

  const allowedEquipment = useMemo(
    () => new Set<string>([...SUBJECT_EQUIPMENT_CHOICES, ...availableEquipment]),
    [availableEquipment]
  );

  const toggleListValue = (key: 'requiredEquipment' | 'mandatoryEquipment', value: string) => {
    setForm(prev => {
      const current = prev[key] || [];
      return {
        ...prev,
        [key]: current.includes(value) ? current.filter(v => v !== value) : [...current, value]
      } as Subject;
    });
  };

  const handleSave = () => {
    if (!form.code || !form.name || !form.faculty || !form.department) {
      alert('コード、時間割名称、開講学部、管轄は必須です。');
      return;
    }

    const saved: Subject = {
      ...form,
      campus: currentCampusLabel,
      faculty: form.faculty,
      department: form.department,
      priority: form.priority ?? 1,
      requiredEquipment: (form.requiredEquipment || []).filter(eq => allowedEquipment.has(eq)),
      mandatoryEquipment: (form.mandatoryEquipment || []).filter(eq => allowedEquipment.has(eq)),
      previousRooms: form.previousRooms || []
    };

    if (saved.endPeriod && saved.endPeriod < saved.period) {
      saved.endPeriod = saved.period;
    }
    if (saved.endPeriod === saved.period) {
      saved.endPeriod = undefined;
    }

    onSave(saved);
  };

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
          width: 'min(1100px, 100%)',
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
              <label style={requiredLabelStyle}>コード</label>
              <input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} style={inputStyle} />

              <label style={requiredLabelStyle}>時間割名称</label>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={inputStyle} />

              <label style={requiredLabelStyle}>教員コード</label>
              <input value={form.teacherCode || ''} onChange={e => setForm({ ...form, teacherCode: e.target.value })} style={inputStyle} />

              <label style={requiredLabelStyle}>教員名</label>
              <input value={form.teacher} onChange={e => setForm({ ...form, teacher: e.target.value })} style={inputStyle} />

              <label style={requiredLabelStyle}>開講学部</label>
              <select value={form.faculty || ''} onChange={e => setForm({ ...form, faculty: e.target.value })} style={inputStyle}>
                <option value="">(未選択)</option>
                {facultyOptions.map(v => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>

              <label style={requiredLabelStyle}>管轄</label>
              <select value={form.department || ''} onChange={e => setForm({ ...form, department: e.target.value })} style={inputStyle}>
                <option value="">(未選択)</option>
                {departmentOptions.map(v => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>

              <label style={requiredLabelStyle}>キャンパス</label>
              <input value={currentCampusLabel} readOnly style={{ ...inputStyle, background: '#f7f7f7', color: '#666' }} />

              <label>過去教室</label>
              <input
                value={form.previousRooms?.join(', ') || ''}
                onChange={e => setForm({ ...form, previousRooms: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                placeholder="3-201, 3-202"
                style={inputStyle}
              />
            </div>
          </section>

          <section style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px', background: '#fff', borderRadius: '8px', border: '1px solid #e3f2fd' }}>
            <h4 style={{ ...sectionTitleStyle, color: '#2e7d32' }}>開講条件・配当</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', alignItems: 'center' }}>
              <label style={requiredLabelStyle}>配当期</label>
              <select value={form.term || ''} onChange={e => setForm({ ...form, term: e.target.value as Term })} style={inputStyle}>
                <option value="">未定</option>
                <option value="spring">春学期</option>
                <option value="spring_first">春前半</option>
                <option value="spring_second">春後半</option>
                <option value="autumn">秋学期</option>
                <option value="autumn_first">秋前半</option>
                <option value="autumn_second">秋後半</option>
                <option value="full_year">通年</option>
              </select>

              <label style={requiredLabelStyle}>曜日</label>
              <select value={form.day || ''} onChange={e => setForm({ ...form, day: e.target.value as DayOfWeek })} style={inputStyle}>
                <option value="">未定</option>
                {Object.entries(DAY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>

              <label style={requiredLabelStyle}>講時</label>
              <select value={form.period || ''} onChange={e => setForm({ ...form, period: Number(e.target.value) as Period })} style={inputStyle}>
                <option value="">未定</option>
                {[1, 2, 3, 4, 5, 6, 7].map(v => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>

              <label>履修想定人数</label>
              <input type="number" value={form.requiredCapacity} onChange={e => setForm({ ...form, requiredCapacity: Number(e.target.value) })} style={inputStyle} />

              <label>優先度（1[低]～3[高]）</label>
              <select value={form.priority ?? 1} onChange={e => setForm({ ...form, priority: Number(e.target.value) })} style={inputStyle}>
                {[1, 2, 3].map(v => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>

              <label style={requiredLabelStyle}>必要教室数</label>
              <input type="number" min="1" value={form.requiredRoomCount || 1} onChange={e => setForm({ ...form, requiredRoomCount: Number(e.target.value) })} style={inputStyle} />

              <label>希望建物</label>
              <select value={form.buildingPreference || ''} onChange={e => setForm({ ...form, buildingPreference: e.target.value })} style={inputStyle}>
                <option value="">(未選択)</option>
                {BUILDINGS.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>

              <label style={requiredLabelStyle}>希望教室タイプ</label>
              <select value={form.preferredRoomType || 'normal'} onChange={e => setForm({ ...form, preferredRoomType: e.target.value as Subject['preferredRoomType'] })} style={inputStyle}>
                <option value="normal">一般</option>
                <option value="pc">PC</option>
                <option value="seminar">ゼミ</option>
              </select>
            </div>

            <div>
              <label style={{ ...labelStyle, display: 'block', marginBottom: '8px' }}>機材・設備</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {availableEquipment.map(eq => {
                  const style = getEquipmentStyle(eq);
                  const isRequired = (form.requiredEquipment || []).includes(eq);
                  const isMandatory = (form.mandatoryEquipment || []).includes(eq);
                  return (
                    <button
                      key={eq}
                      type="button"
                      onClick={() => toggleListValue('requiredEquipment', eq)}
                      style={{
                        background: isRequired ? style.bg : '#fff',
                        color: style.text,
                        border: `1px solid ${isRequired ? style.border : '#ddd'}`,
                        borderRadius: '999px',
                        padding: '5px 10px',
                        cursor: 'pointer'
                      }}
                    >
                      {eq}{isMandatory ? '◎' : isRequired ? '○' : ''}
                    </button>
                  );
                })}
              </div>
              <div style={{ marginTop: '10px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <label style={checkboxLabelStyle}>
                  <input
                    type="checkbox"
                    checked={!!form.requiresProjector}
                    onChange={e => setForm({ ...form, requiresProjector: e.target.checked })}
                  />
                  <span>プロジェクター必須</span>
                </label>
                <label style={checkboxLabelStyle}>
                  <input
                    type="checkbox"
                    checked={!!form.requiresMovable}
                    onChange={e => setForm({ ...form, requiresMovable: e.target.checked })}
                  />
                  <span>可動必須</span>
                </label>
              </div>
            </div>
          </section>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '0 24px 24px' }}>
          <button onClick={onClose} style={{ padding: '8px 16px' }}>キャンセル</button>
          <button onClick={handleSave} style={{ padding: '8px 16px', background: '#1976d2', color: '#fff', border: 'none', borderRadius: '4px' }}>
            <Check size={16} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
            保存
          </button>
        </div>
      </div>
    </div>
  );
};
