import type { DisplayConfig } from '../types';
import { getEquipmentStyle } from '../types';
import { X, Eye } from 'lucide-react';

interface Props {
    config: DisplayConfig;
    availableEquipment: string[];
    onUpdate: (config: DisplayConfig) => void;
    onClose: () => void;
}

export const DisplaySettings = ({ config, availableEquipment, onUpdate, onClose }: Props) => {
    const toggleEq = (eq: string) => {
        const current = config.highlightedEquipment;
        if (current.includes(eq)) {
            onUpdate({ ...config, highlightedEquipment: current.filter(e => e !== eq) });
        } else {
            onUpdate({ ...config, highlightedEquipment: [...current, eq] });
        }
    };

    return (
        <div className="manager-overlay" style={{
            position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
            background: 'rgba(0,0,0,0.5)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
            <div style={{ background: '#fff', width: '90%', maxWidth: '500px', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
                <header style={{ padding: '15px 20px', background: '#2d2d2d', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Eye size={20} />
                        <h3 style={{ margin: 0, whiteSpace: 'nowrap' }}>表示設定</h3>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}><X /></button>
                </header>

                <div style={{ padding: '20px', maxHeight: '70vh', overflowY: 'auto' }}>
                    <section style={{ marginBottom: '20px' }}>
                        <h4 style={{ borderBottom: '1px solid #eee', paddingBottom: '5px', marginBottom: '10px' }}>基本項目の表示</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                                <input type="checkbox" checked={config.showCapacity} onChange={e => onUpdate({ ...config, showCapacity: e.target.checked })} /> 通常定員
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                                <input type="checkbox" checked={config.showExamCapacity} onChange={e => onUpdate({ ...config, showExamCapacity: e.target.checked })} /> 試験時定員
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                                <input type="checkbox" checked={config.showRoomType} onChange={e => onUpdate({ ...config, showRoomType: e.target.checked })} /> 教室タイプ
                            </label>
                        </div>
                    </section>

                    <section>
                        <h4 style={{ borderBottom: '1px solid #eee', paddingBottom: '5px', marginBottom: '10px' }}>機材情報</h4>
                        <p style={{ fontSize: '0.85em', color: '#666', marginBottom: '10px' }}>チェックした項目はグリッド上の教室列に表示されます（デフォルトですべて表示）。</p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {availableEquipment.length === 0 && <span style={{ color: '#999', fontSize: '0.9em' }}>機材データがありません。</span>}
                            {availableEquipment.map(eq => {
                                const style = getEquipmentStyle(eq);
                                const isSelected = config.highlightedEquipment.includes(eq);
                                return (
                                    <button
                                        key={eq}
                                        onClick={() => toggleEq(eq)}
                                        style={{
                                            padding: '4px 10px', borderRadius: '15px', border: '1px solid',
                                            fontSize: '0.85em', cursor: 'pointer', transition: 'all 0.2s',
                                            background: isSelected ? style.bg : '#fff',
                                            color: isSelected ? style.text : '#666',
                                            borderColor: isSelected ? style.border : '#ddd',
                                            fontWeight: isSelected && style.text !== '#666' ? 'bold' : 'normal'
                                        }}
                                    >
                                        {eq}
                                    </button>
                                );
                            })}
                        </div>
                    </section>
                    <div style={{ marginTop: '20px', borderTop: '1px solid #ddd', paddingTop: '20px' }}>
                        <button
                            onClick={() => {
                                if (confirm('すべてのデータを初期状態に戻しますか？\n編集内容は失われます。')) {
                                    localStorage.removeItem('subjects');
                                    localStorage.removeItem('allocations');
                                    localStorage.removeItem('classrooms');
                                    window.location.reload();
                                }
                            }}
                            style={{
                                background: '#d32f2f', color: '#fff', border: 'none',
                                padding: '8px 15px', borderRadius: '4px', cursor: 'pointer',
                                width: '100%', fontSize: '0.9rem'
                            }}
                        >
                            全データをリセット (初期化)
                        </button>
                        <p style={{ fontSize: '0.75rem', color: '#666', marginTop: '5px' }}>
                            ※表示がおかしい場合や、初期データに戻したい場合に使用してください。
                        </p>
                    </div>
                </div>

                <footer style={{ padding: '15px 20px', borderTop: '1px solid #eee', textAlign: 'right' }}>
                    <button onClick={onClose} style={{ background: '#646cff', color: '#fff', border: 'none', padding: '8px 25px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                        決定
                    </button>
                </footer>
            </div>
        </div>
    );
};
