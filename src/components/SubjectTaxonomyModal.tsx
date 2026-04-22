import { useEffect, useState } from 'react';
import { X, Plus, Trash2, RotateCcw, Save } from 'lucide-react';
import type { SubjectTaxonomy } from '../utils/subjectTaxonomy';
import { getDefaultSubjectTaxonomy } from '../utils/subjectTaxonomy';

interface Props {
  campusLabel: string;
  taxonomy: SubjectTaxonomy;
  onSave: (next: SubjectTaxonomy) => void;
  onClose: () => void;
}

const normalizeList = (items: string[]) => Array.from(new Set(items.map(item => item.trim()).filter(Boolean)));

export const SubjectTaxonomyModal = ({ campusLabel, taxonomy, onSave, onClose }: Props) => {
  const [faculties, setFaculties] = useState<string[]>(taxonomy.faculties);
  const [departments, setDepartments] = useState<string[]>(taxonomy.departments);
  const [facultyInput, setFacultyInput] = useState('');
  const [departmentInput, setDepartmentInput] = useState('');

  useEffect(() => {
    setFaculties(taxonomy.faculties);
    setDepartments(taxonomy.departments);
  }, [taxonomy]);

  const addFaculty = () => {
    const value = facultyInput.trim();
    if (!value) return;
    setFaculties(prev => normalizeList([...prev, value]));
    setFacultyInput('');
  };

  const addDepartment = () => {
    const value = departmentInput.trim();
    if (!value) return;
    setDepartments(prev => normalizeList([...prev, value]));
    setDepartmentInput('');
  };

  const resetDefaults = () => {
    const defaults = getDefaultSubjectTaxonomy(campusLabel);
    setFaculties(defaults.faculties);
    setDepartments(defaults.departments);
  };

  const handleSave = () => {
    onSave({
      faculties: normalizeList(faculties),
      departments: normalizeList(departments)
    });
  };

  const chipStyle = (kind: 'faculty' | 'department') => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 8px',
    borderRadius: '999px',
    border: '1px solid #d0d7de',
    background: kind === 'faculty' ? '#eef5ff' : '#f4f8ff',
    fontSize: '0.85rem'
  });

  return (
    <div className="modal-overlay" style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1200,
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div style={{ background: '#fff', width: '92%', maxWidth: '760px', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 18px 40px rgba(0,0,0,0.25)' }}>
        <header style={{ padding: '16px 20px', background: '#2d2d2d', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '1rem', fontWeight: 'bold' }}>開講学部・管轄の編集</div>
            <div style={{ fontSize: '0.8rem', color: '#cfd8dc', marginTop: '4px' }}>{campusLabel}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}><X /></button>
        </header>
        <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <section style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h4 style={{ margin: 0 }}>開講学部</h4>
              <button onClick={resetDefaults} style={{ border: '1px solid #ddd', background: '#fafafa', borderRadius: '6px', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <RotateCcw size={14} /> 初期値
              </button>
            </div>
            <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
              <input value={facultyInput} onChange={e => setFacultyInput(e.target.value)} placeholder="追加する開講学部" style={{ flex: 1, padding: '8px', border: '1px solid #ddd', borderRadius: '6px' }} />
              <button onClick={addFaculty} style={{ padding: '8px 10px', border: 'none', background: '#1976d2', color: '#fff', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Plus size={14} /> 追加
              </button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {faculties.length === 0 && <span style={{ color: '#999', fontSize: '0.85rem' }}>候補がありません</span>}
              {faculties.map(item => (
                <span key={item} style={chipStyle('faculty')}>
                  {item}
                  <button onClick={() => setFaculties(prev => prev.filter(v => v !== item))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c62828' }}><Trash2 size={14} /></button>
                </span>
              ))}
            </div>
          </section>
          <section style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '16px' }}>
            <h4 style={{ margin: '0 0 12px 0' }}>管轄</h4>
            <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
              <input value={departmentInput} onChange={e => setDepartmentInput(e.target.value)} placeholder="追加する管轄" style={{ flex: 1, padding: '8px', border: '1px solid #ddd', borderRadius: '6px' }} />
              <button onClick={addDepartment} style={{ padding: '8px 10px', border: 'none', background: '#2e7d32', color: '#fff', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Plus size={14} /> 追加
              </button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {departments.length === 0 && <span style={{ color: '#999', fontSize: '0.85rem' }}>候補がありません</span>}
              {departments.map(item => (
                <span key={item} style={chipStyle('department')}>
                  {item}
                  <button onClick={() => setDepartments(prev => prev.filter(v => v !== item))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c62828' }}><Trash2 size={14} /></button>
                </span>
              ))}
            </div>
          </section>
        </div>
        <footer style={{ padding: '16px 20px', borderTop: '1px solid #eee', display: 'flex', justifyContent: 'flex-end', gap: '10px', background: '#fafafa' }}>
          <button onClick={onClose} style={{ padding: '8px 14px', border: '1px solid #ccc', borderRadius: '6px', background: '#fff' }}>キャンセル</button>
          <button onClick={handleSave} style={{ padding: '8px 14px', border: 'none', borderRadius: '6px', background: '#646cff', color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Save size={16} /> 保存
          </button>
        </footer>
      </div>
    </div>
  );
};
