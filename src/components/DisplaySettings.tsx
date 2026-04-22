import { useState } from 'react';
import type { DisplayConfig, SubjectMainDisplay } from '../types';
import { getEquipmentStyle } from '../types';
import { X, Eye } from 'lucide-react';

interface Props {
    config: DisplayConfig;
    availableEquipment: string[];
    onUpdate: (config: DisplayConfig) => void;
    onClose: () => void;
}

const subjectMainDisplayOptions: Array<{ id: SubjectMainDisplay; label: string }> = [
    { id: 'name', label: '科目名' },
    { id: 'teacher', label: '教員名' },
    { id: 'department', label: '開講学部名' }
];

export const DisplaySettings = ({ config, availableEquipment, onUpdate, onClose }: Props) => {
    const [localConfig, setLocalConfig] = useState<DisplayConfig>({ ...config });

    const toggleEq = (eq: string) => {
        const current = localConfig.highlightedEquipment;
        if (current.includes(eq)) {
            setLocalConfig({ ...localConfig, highlightedEquipment: current.filter(e => e !== eq) });
        } else {
            setLocalConfig({ ...localConfig, highlightedEquipment: [...current, eq] });
        }
    };

    const handleConfirm = () => {
        onUpdate(localConfig);
        onClose();
    };

    return (
        <div className="manager-overlay" style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 1100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
        }}>
            <div style={{ background: '#fff', width: '90%', maxWidth: '550px', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 15px 35px rgba(0,0,0,0.3)' }}>
                <header style={{ padding: '15px 20px', background: '#2d2d2d', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Eye size={20} color="#646cff" />
                        <h3 style={{ margin: 0, letterSpacing: '0.5px' }}>表示設定</h3>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', transition: 'opacity 0.2s' }} className="hover:opacity-70">
                        <X />
                    </button>
                </header>

                <div style={{ padding: '24px', maxHeight: '75vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <section>
                        <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '2px solid #f0f0f0', paddingBottom: '8px', marginBottom: '12px', color: '#333' }}>
                            教室表示
                        </h4>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem' }}>
                                <input type="checkbox" checked={localConfig.showCapacity} onChange={e => setLocalConfig({ ...localConfig, showCapacity: e.target.checked })} /> 通常定員
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem' }}>
                                <input type="checkbox" checked={localConfig.showExamCapacity} onChange={e => setLocalConfig({ ...localConfig, showExamCapacity: e.target.checked })} /> 試験時定員
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem' }}>
                                <input type="checkbox" checked={localConfig.showRoomType} onChange={e => setLocalConfig({ ...localConfig, showRoomType: e.target.checked })} /> 教室タイプ
                            </label>
                        </div>
                    </section>

                    <section>
                        <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '2px solid #f0f0f0', paddingBottom: '8px', marginBottom: '12px', color: '#333' }}>
                            授業カード詳細
                        </h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '0.9rem', color: '#666', fontWeight: 'bold' }}>メイン表示:</span>
                                <div style={{ display: 'flex', gap: '12px' }}>
                                    {subjectMainDisplayOptions.map(item => (
                                        <label key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.9rem' }}>
                                            <input
                                                type="radio"
                                                name="subjectMainDisplay"
                                                value={item.id}
                                                checked={localConfig.subjectMainDisplay === item.id}
                                                onChange={() => setLocalConfig({ ...localConfig, subjectMainDisplay: item.id })}
                                            />
                                            {item.label}
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem' }}>
                                    <input type="checkbox" checked={localConfig.showSubInfo} onChange={e => setLocalConfig({ ...localConfig, showSubInfo: e.target.checked })} /> サブ情報（教員/科目名）
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem' }}>
                                    <input type="checkbox" checked={localConfig.showPreviousRooms} onChange={e => setLocalConfig({ ...localConfig, showPreviousRooms: e.target.checked })} /> 過年度教室
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem' }}>
                                    <input type="checkbox" checked={localConfig.showRequirementTags} onChange={e => setLocalConfig({ ...localConfig, showRequirementTags: e.target.checked })} /> 要件タグ（PC/可動等）
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem' }}>
                                    <input type="checkbox" checked={localConfig.showAllocationProgress} onChange={e => setLocalConfig({ ...localConfig, showAllocationProgress: e.target.checked })} /> 配当進捗（○/□室）
                                </label>
                            </div>
                        </div>
                    </section>

                    <section>
                        <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '2px solid #f0f0f0', paddingBottom: '8px', marginBottom: '12px', color: '#333' }}>
                            グリッド視覚効果
                        </h4>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem' }}>
                                <input type="checkbox" checked={localConfig.showContinuityHighlight} onChange={e => setLocalConfig({ ...localConfig, showContinuityHighlight: e.target.checked })} /> 複数講時・通年科目の強調（<span style={{ color: '#2196f3', fontWeight: 'bold' }}>青枠</span>）
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem' }}>
                                <input type="checkbox" checked={localConfig.showViolationAlerts} onChange={e => setLocalConfig({ ...localConfig, showViolationAlerts: e.target.checked })} /> 制約違反の警告アイコン
                            </label>
                        </div>
                    </section>

                    <section>
                        <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '2px solid #f0f0f0', paddingBottom: '8px', marginBottom: '12px', color: '#333' }}>
                            機材表示（教室列）
                        </h4>
                        <p style={{ fontSize: '0.8rem', color: '#666', marginBottom: '10px' }}>選択した機材がグリッド左側の教室情報欄に表示されます。</p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {availableEquipment.length === 0 && <span style={{ color: '#999', fontSize: '0.9em' }}>表示できる機材がありません</span>}
                            {availableEquipment.map(eq => {
                                const style = getEquipmentStyle(eq);
                                const isSelected = localConfig.highlightedEquipment.includes(eq);
                                return (
                                    <button
                                        key={eq}
                                        onClick={() => toggleEq(eq)}
                                        style={{
                                            padding: '4px 12px',
                                            borderRadius: '16px',
                                            border: '1px solid',
                                            fontSize: '0.8rem',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s',
                                            background: isSelected ? style.bg : '#fff',
                                            color: isSelected ? style.text : '#666',
                                            borderColor: isSelected ? style.border : '#ddd',
                                            fontWeight: isSelected ? 'bold' : 'normal',
                                            boxShadow: isSelected ? '0 1px 2px rgba(0,0,0,0.1)' : 'none'
                                        }}
                                        className="hover:shadow-sm"
                                    >
                                        {eq}
                                    </button>
                                );
                            })}
                        </div>
                    </section>
                </div>

                <footer style={{ padding: '16px 24px', borderTop: '1px solid #efefef', textAlign: 'right', background: '#fafafa' }}>
                    <button
                        onClick={handleConfirm}
                        style={{ background: '#646cff', color: '#fff', border: 'none', padding: '10px 30px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem', transition: 'transform 0.1s' }}
                        className="hover:scale-105 active:scale-95"
                    >
                        決定
                    </button>
                </footer>
            </div>
        </div>
    );
};
