import { useState } from 'react';
import { X, Check } from 'lucide-react';
import type { Subject, Term, DayOfWeek, Period } from '../types';
import { DAY_LABELS, BUILDINGS, getEquipmentStyle } from '../types';

interface Props {
  subject: Subject;
  availableEquipment: string[];
  currentCampusLabel: string;
  facultyOptions: string[];
  departmentOptions: string[];
  onSave: (updated: Subject) => void;
  onClose: () => void;
}

const EQUIPMENT_CHOICES = ['PJ(中)', 'PJ(横)', 'タッチディスプレイ', 'BD', '黒板', '白板', 'マイク', 'ブラインド', 'PC', '可動', '固定'];

export const SubjectEditModal = ({
  subject,
  availableEquipment,
  currentCampusLabel,
  facultyOptions,
  departmentOptions,
  onSave,
  onClose
}: Props) => {
  const [form, setForm] = useState<Subject>({
    ...subject,
    campus: currentCampusLabel,
    faculty: subject.faculty || facultyOptions[0] || '',
    department: subject.department || departmentOptions[0] || '',
    requiredEquipment: subject.requiredEquipment || [],
    mandatoryEquipment: subject.mandatoryEquipment || [],
    previousRooms: subject.previousRooms || [],
  });

  const toggleListValue = (key: 'requiredEquipment' | 'mandatoryEquipment', value: string) => {
    setForm(prev => {
      const current = (prev[key] || []) as string[];
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
      requiredEquipment: (form.requiredEquipment || []).filter(eq => EQUIPMENT_CHOICES.includes(eq)),
      mandatoryEquipment: (form.mandatoryEquipment || []).filter(eq => EQUIPMENT_CHOICES.includes(eq)),
      previousRooms: form.previousRooms || [],
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
    <div className="modal-overlay" style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.5)',
      zIndex: 1100,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <div style={{ background: '#fff', padding: '20px 24px', borderRadius: '8px', width: '95%', maxWidth: '980px', maxHeight: '92vh', overflow: 'auto', boxShadow: '0 4px 16px rgba(0,0,0,0.18)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <h3 style={{ margin: 0, fontSize: '1rem' }}>授業情報の編集</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X /></button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.88rem' }}>
          <section style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', background: '#f8f9fa', borderRadius: '6px' }}>
            <h4 style={{ margin: 0, color: '#1976d2' }}>基本情報</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: '8px' }}>
              <label>時間割コード</label>
              <input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} />

              <label>時間割名称</label>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />

              <label>教員コード</label>
              <input value={form.teacherCode || ''} onChange={e => setForm({ ...form, teacherCode: e.target.value })} />

              <label>教員名</label>
              <input value={form.teacher} onChange={e => setForm({ ...form, teacher: e.target.value })} />

              <label>開講学部</label>
              <select value={form.faculty || ''} onChange={e => setForm({ ...form, faculty: e.target.value })}>
                <option value="">(未選択)</option>
                {facultyOptions.map(v => <option key={v} value={v}>{v}</option>)}
              </select>

              <label>管轄</label>
              <select value={form.department || ''} onChange={e => setForm({ ...form, department: e.target.value })}>
                <option value="">(未選択)</option>
                {departmentOptions.map(v => <option key={v} value={v}>{v}</option>)}
              </select>

              <label>キャンパス</label>
              <input value={currentCampusLabel} readOnly style={{ background: '#f7f7f7', color: '#666' }} />

              <label>過年度教室</label>
              <input
                value={form.previousRooms?.join(', ') || ''}
                onChange={e => setForm({ ...form, previousRooms: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                placeholder="3-201, 3-202"
              />
            </div>
          </section>

          <section style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', background: '#fff', borderRadius: '6px', border: '1px solid #e3f2fd' }}>
            <h4 style={{ margin: 0, color: '#2e7d32' }}>開講条件・配当</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div>
                <label>配当期</label>
                <select value={form.term} onChange={e => setForm({ ...form, term: e.target.value as Term })}>
                  <option value="spring">春学期</option>
                  <option value="spring_first">春前半</option>
                  <option value="spring_second">春後半</option>
                  <option value="autumn">秋学期</option>
                  <option value="autumn_first">秋前半</option>
                  <option value="autumn_second">秋後半</option>
                  <option value="full_year">通年</option>
                </select>
              </div>
              <div>
                <label>曜日</label>
                <select value={form.day} onChange={e => setForm({ ...form, day: e.target.value as DayOfWeek })}>
                  {Object.entries(DAY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </div>
              <div>
                <label>講時</label>
                <select value={form.period} onChange={e => setForm({ ...form, period: Number(e.target.value) as Period })}>
                  {[1, 2, 3, 4, 5, 6, 7].map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div>
                <label>履修想定人数</label>
                <input type="number" value={form.requiredCapacity} onChange={e => setForm({ ...form, requiredCapacity: Number(e.target.value) })} />
              </div>
              <div>
                <label>優先度</label>
                <select value={form.priority || 1} onChange={e => setForm({ ...form, priority: Number(e.target.value) })}>
                  {[1, 2, 3].map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div>
                <label>必要教室数</label>
                <input type="number" min="1" value={form.requiredRoomCount || 1} onChange={e => setForm({ ...form, requiredRoomCount: Number(e.target.value) })} />
              </div>
              <div>
                <label>希望建物</label>
                <select value={form.buildingPreference || ''} onChange={e => setForm({ ...form, buildingPreference: e.target.value })}>
                  <option value="">(なし)</option>
                  {BUILDINGS.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div>
                <label>希望教室タイプ</label>
                <select value={form.preferredRoomType || 'normal'} onChange={e => setForm({ ...form, preferredRoomType: e.target.value as Subject['preferredRoomType'] })}>
                  <option value="normal">一般</option>
                  <option value="pc">PC</option>
                  <option value="seminar">ゼミ</option>
                </select>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '6px' }}>機材・設備</label>
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
                        padding: '4px 10px',
                        cursor: 'pointer'
                      }}
                    >
                      {eq}{isMandatory ? '◎' : isRequired ? '○' : ''}
                    </button>
                  );
                })}
              </div>
              <div style={{ marginTop: '8px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <label><input type="checkbox" checked={!!form.requiresProjector} onChange={e => setForm({ ...form, requiresProjector: e.target.checked })} /> プロジェクター必須</label>
                <label><input type="checkbox" checked={!!form.requiresMovable} onChange={e => setForm({ ...form, requiresMovable: e.target.checked })} /> 可動設備</label>
              </div>
            </div>
          </section>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
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
