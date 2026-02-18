import { useState } from 'react';
import type { AllocationRule, AllocationOptions } from '../types';
import { DEFAULT_ORDER_BONUSES, EQUIPMENT_LIST, DEFAULT_EQUIPMENT_SETTINGS } from '../types';
import { ChevronUp, ChevronDown, ArrowLeft, Save } from 'lucide-react';

interface Props {
    settings: AllocationRule[];
    orderBonuses?: number[];
    equipmentSettings?: {
        items: { [key: string]: { enabled: boolean; importance: number } };
        strictLevel5: boolean;
    };
    onSave: (options: AllocationOptions) => void;
    onClose: () => void;
}

export const AllocationRuleSettings = ({ settings, orderBonuses: initialBonuses, equipmentSettings: initialEquipment, onSave, onClose }: Props) => {
    const [rules, setRules] = useState<AllocationRule[]>([...settings].sort((a, b) => a.order - b.order));
    const [bonuses, setBonuses] = useState<number[]>(initialBonuses || [...DEFAULT_ORDER_BONUSES]);
    const [priorities, setPriorities] = useState<number[]>([1, 2, 3, 4, 5]);
    const [includeAllocated, setIncludeAllocated] = useState(false);
    const [includeUnassigned, setIncludeUnassigned] = useState(true);
    const [equipmentSettings, setEquipmentSettings] = useState(initialEquipment || DEFAULT_EQUIPMENT_SETTINGS);

    const handleStrictToggle = () => {
        setEquipmentSettings(prev => ({
            ...prev,
            strictLevel5: !prev.strictLevel5
        }));
    };

    const handleToggle = (id: string) => {
        setRules(prev => prev.map(r =>
            r.id === id ? { ...r, enabled: !r.enabled } : r
        ));
    };

    const handleMove = (index: number, direction: 'up' | 'down') => {
        const next = [...rules];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= next.length) return;

        const temp = next[index];
        next[index] = next[targetIndex];
        next[targetIndex] = temp;

        const updated = next.map((r, i) => ({ ...r, order: i + 1 }));
        setRules(updated);
    };

    const handleWeightChange = (id: string, weight: number) => {
        setRules(prev => prev.map(r =>
            r.id === id ? { ...r, weight } : r
        ));
    };



    const handleBonusChange = (index: number, value: number) => {
        setBonuses(prev => {
            const next = [...prev];
            next[index] = value;
            return next;
        });
    };

    const handleEquipmentChange = (key: string, field: 'enabled' | 'importance', value?: any) => {
        setEquipmentSettings(prev => ({
            ...prev,
            items: {
                ...prev.items,
                [key]: {
                    ...prev.items[key],
                    [field]: field === 'enabled' ? !prev.items[key].enabled : value
                }
            }
        }));
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
            background: '#fff', zIndex: 1000, display: 'flex', flexDirection: 'column',
            animation: 'slideIn 0.3s ease-out'
        }}>
            {/* Header */}
            <header style={{
                padding: '15px 30px', borderBottom: '1px solid #eee',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: '#fcfcfc'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <button onClick={onClose} style={{
                        background: 'none', border: 'none', cursor: 'pointer', padding: '5px',
                        display: 'flex', alignItems: 'center', color: '#666'
                    }}>
                        <ArrowLeft size={24} />
                    </button>
                    <h2 style={{ margin: 0, fontSize: '1.4rem', color: '#333' }}>配当ルール設定</h2>
                </div>
                <div style={{ display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
                    {/* 優先度フィルター */}
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.85rem', color: '#666' }}>科目の優先度:</span>
                        {[5, 4, 3, 2, 1].map(p => (
                            <label key={p} style={{ display: 'flex', alignItems: 'center', gap: '3px', cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    checked={priorities.includes(p)}
                                    onChange={() => setPriorities(prev =>
                                        prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
                                    )}
                                />
                                <span style={{ fontSize: '0.85rem' }}>{p}</span>
                            </label>
                        ))}
                    </div>
                    {/* 配当状況フィルター */}
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                            <input type="checkbox" checked={includeUnassigned} onChange={() => setIncludeUnassigned(!includeUnassigned)} />
                            <span style={{ fontSize: '0.85rem' }}>未配当</span>
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                            <input type="checkbox" checked={includeAllocated} onChange={() => setIncludeAllocated(!includeAllocated)} />
                            <span style={{ fontSize: '0.85rem' }}>配当済み</span>
                        </label>
                    </div>
                    {/* 注記 */}
                    <span style={{ fontSize: '0.75rem', color: '#666', background: '#f5f5f5', padding: '3px 8px', borderRadius: '4px' }}>
                        ※ 科目の優先度が高い順に配当されます
                    </span>
                    <button
                        onClick={() => onSave({ rules, orderBonuses: bonuses, priorities, includeAllocated, includeUnassigned, equipmentSettings })}
                        style={{
                            padding: '6px 14px', borderRadius: '4px', border: 'none',
                            background: '#2e7d32', color: '#fff', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                        }}
                    >
                        <Save size={16} /> 教室自動配当
                    </button>
                    <button onClick={onClose} style={{
                        padding: '6px 14px', borderRadius: '4px', border: '1px solid #ccc',
                        background: '#fff', cursor: 'pointer'
                    }}>キャンセル</button>
                </div>
            </header>

            {/* Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '30px', maxWidth: '900px', margin: '0 auto', width: '100%' }}>

                <p style={{ color: '#666', marginBottom: '25px', fontSize: '0.95rem' }}>
                    優先順位を変更するには ↑ ↓ ボタンを使用してください。チェックを外すとそのルールを無効化できます。
                </p>

                {/* Rules List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {rules.map((rule, index) => {
                        return (
                            <div key={rule.id} style={{
                                background: '#fff', border: '1px solid #eee', borderRadius: '8px',
                                padding: '15px 20px', display: 'flex', alignItems: 'center',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                                transition: 'transform 0.2s',
                                opacity: rule.enabled ? 1 : 0.6
                            }}>
                                {/* Order Controls */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginRight: '20px', width: '40px', alignItems: 'center' }}>
                                    <button
                                        disabled={index === 0}
                                        onClick={() => handleMove(index, 'up')}
                                        style={{ background: 'none', border: 'none', cursor: index === 0 ? 'default' : 'pointer', color: index === 0 ? '#eee' : '#999' }}
                                    ><ChevronUp size={20} /></button>
                                    <button
                                        disabled={index === rules.length - 1}
                                        onClick={() => handleMove(index, 'down')}
                                        style={{ background: 'none', border: 'none', cursor: index === rules.length - 1 ? 'default' : 'pointer', color: index === rules.length - 1 ? '#eee' : '#999' }}
                                    ><ChevronDown size={20} /></button>
                                </div>

                                {/* Rank Number */}
                                <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#999', width: '30px', textAlign: 'center', marginRight: '20px' }}>
                                    {index + 1}
                                </div>

                                {/* Checkbox */}
                                <div style={{ marginRight: '20px' }}>
                                    <input
                                        type="checkbox"
                                        checked={rule.enabled}
                                        onChange={() => handleToggle(rule.id)}
                                        style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                                    />
                                </div>

                                {/* Main Info */}
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: '#333', marginBottom: '4px' }}>
                                        {rule.name}
                                    </div>
                                    <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '8px' }}>{rule.description}</div>

                                    {/* Weight Slider with Formula */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                        <span style={{ fontSize: '0.75rem', color: '#888', minWidth: '70px' }}>ベースの重み:</span>
                                        <input
                                            type="range"
                                            min="0"
                                            max="100"
                                            value={rule.weight ?? 50}
                                            onChange={(e) => handleWeightChange(rule.id, Number(e.target.value))}
                                            style={{ width: '120px', cursor: 'pointer' }}
                                        />
                                        <span style={{ fontWeight: 'bold', minWidth: '30px', textAlign: 'right' }}>{rule.weight ?? 50}</span>

                                        <span style={{ color: '#888', margin: '0 4px' }}>×</span>

                                        {/* Multiplier Display */}
                                        <span title={`順位${index + 1}位のボーナス係数`} style={{
                                            background: '#fff3e0', color: '#e65100', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold', fontSize: '0.9rem'
                                        }}>
                                            {bonuses[index] || 1.0}
                                        </span>

                                        <span style={{ color: '#888', margin: '0 4px' }}>=</span>

                                        {/* Final Score */}
                                        <span style={{
                                            background: '#e3f2fd', color: '#1565c0', padding: '2px 12px', borderRadius: '4px', fontWeight: 'bold', fontSize: '1rem', minWidth: '40px', textAlign: 'center'
                                        }}>
                                            {Math.round((rule.weight ?? 50) * (bonuses[index] || 1.0))}
                                        </span>
                                    </div>

                                    {/* Equipment Detail Settings */}
                                    {rule.id === 'equipment' && rule.enabled && (
                                        <div style={{ marginTop: '15px', background: '#f8f9fa', padding: '12px', borderRadius: '8px', border: '1px solid #e0e0e0' }}>
                                            <div style={{ marginBottom: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                                                <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#555', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    対象機材の個別設定 <span style={{ fontWeight: 'normal', fontSize: '0.75rem', color: '#888' }}>(重要度 1:低 〜 5:高)</span>
                                                </div>
                                                <label style={{
                                                    display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer',
                                                    fontSize: '0.8rem', background: '#fff', padding: '4px 10px', borderRadius: '20px',
                                                    border: `1px solid ${equipmentSettings.strictLevel5 ? '#2e7d32' : '#ccc'}`,
                                                    color: equipmentSettings.strictLevel5 ? '#2e7d32' : '#666',
                                                    fontWeight: equipmentSettings.strictLevel5 ? 'bold' : 'normal',
                                                    transition: 'all 0.2s'
                                                }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={equipmentSettings.strictLevel5}
                                                        onChange={handleStrictToggle}
                                                    />
                                                    重要度5を必須条件とする
                                                </label>
                                            </div>

                                            <div style={{
                                                display: 'grid',
                                                gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                                                gap: '8px',
                                                width: '100%',
                                                boxSizing: 'border-box'
                                            }}>
                                                {EQUIPMENT_LIST.map(eq => {
                                                    const item = equipmentSettings.items?.[eq] || { enabled: true, importance: 3 };
                                                    const isKeyItem = ['可動', 'BD', 'PJ(中)', 'PJ(横)'].includes(eq);

                                                    return (
                                                        <div key={eq} style={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'space-between',
                                                            padding: '4px 10px',
                                                            background: item.enabled ? '#fff' : 'transparent',
                                                            borderRadius: '6px',
                                                            border: `1px solid ${item.enabled ? '#e0e0e0' : 'transparent'}`,
                                                            height: '36px'
                                                        }}>
                                                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', flex: 1 }}>
                                                                <input
                                                                    type="checkbox"
                                                                    checked={item.enabled}
                                                                    onChange={() => handleEquipmentChange(eq, 'enabled')}
                                                                />
                                                                <span style={{
                                                                    fontWeight: item.enabled ? 'bold' : 'normal',
                                                                    color: isKeyItem && item.enabled ? '#1565c0' : 'inherit'
                                                                }}>
                                                                    {eq}{isKeyItem && item.enabled && <span style={{ fontSize: '0.6rem', marginLeft: '2px', opacity: 0.7 }}>*</span>}
                                                                </span>
                                                            </label>

                                                            {item.enabled && (
                                                                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                                                    {[1, 2, 3, 4, 5].map(lv => (
                                                                        <button
                                                                            key={lv}
                                                                            onClick={() => handleEquipmentChange(eq, 'importance', lv)}
                                                                            style={{
                                                                                width: '24px',
                                                                                height: '24px',
                                                                                borderRadius: '4px',
                                                                                border: 'none',
                                                                                fontSize: '0.7rem',
                                                                                fontWeight: 'bold',
                                                                                cursor: 'pointer',
                                                                                display: 'flex',
                                                                                alignItems: 'center',
                                                                                justifyContent: 'center',
                                                                                background: item.importance === lv
                                                                                    ? (lv >= 4 ? '#e65100' : (lv <= 2 ? '#757575' : '#1976d2'))
                                                                                    : '#eeeeee',
                                                                                color: item.importance === lv ? '#fff' : '#888',
                                                                                transition: 'all 0.2s',
                                                                                outline: equipmentSettings.strictLevel5 && lv === 5 && item.importance === 5 ? '2px solid #2e7d32' : 'none',
                                                                                outlineOffset: '1px'
                                                                            }}
                                                                            title={`重要度: ${lv}${lv === 5 && equipmentSettings.strictLevel5 ? ' (必須)' : ''}`}
                                                                        >
                                                                            {lv}
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                            <div style={{ marginTop: '10px', fontSize: '0.7rem', color: '#888', textAlign: 'right' }}>
                                                * 印の項目（可動, BD, PJ）は内部的に2倍の重みで計算されます
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Order Bonus Settings */}
                <div style={{
                    background: '#fff3e0', padding: '20px', borderRadius: '8px',
                    marginTop: '25px', border: '1px solid #ffcc80'
                }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '12px', color: '#e65100' }}>順位別倍率設定</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px' }}>
                        {bonuses.slice(0, rules.length).map((bonus, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontSize: '0.85rem', color: '#666' }}>{i + 1}位:</span>
                                <input
                                    type="number"
                                    min={0.5}
                                    max={3.0}
                                    step={0.1}
                                    value={bonus}
                                    onChange={(e) => handleBonusChange(i, parseFloat(e.target.value) || 1.0)}
                                    style={{
                                        width: '60px', padding: '4px 6px', border: '1px solid #ccc',
                                        borderRadius: '4px', textAlign: 'center', fontSize: '0.9rem'
                                    }}
                                />
                                <span style={{ fontSize: '0.8rem', color: '#888' }}>倍</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes slideIn {
                    from { opacity: 0; transform: translateX(-20px); }
                    to { opacity: 1; transform: translateX(0); }
                }
            `}</style>
        </div >
    );
};
