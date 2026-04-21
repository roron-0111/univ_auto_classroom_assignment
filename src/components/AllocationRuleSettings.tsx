import { useState } from 'react';
import type { AllocationRule, AllocationOptions, Term, DayOfWeek, Period } from '../types';
import { DEFAULT_ALLOCATION_RULES, DEFAULT_EQUIPMENT_SETTINGS, EQUIPMENT_LIST, TERM_LABELS } from '../types';
import { ChevronUp, ChevronDown, ArrowLeft, Save, Lock } from 'lucide-react';

interface Props {
    settings: AllocationRule[];
    equipmentSettings?: {
        items: { [key: string]: { enabled: boolean; importance: number } };
        strictLevel5: boolean;
    };
    onSave: (options: AllocationOptions) => void;
    onClose: () => void;
    onResetUnassignedStreak?: () => void;
    onResetApprovedExceptions?: () => void;
}

const tierOrder: Record<AllocationRule['tier'], number> = {
    hard: 0,
    near: 1,
    pref: 2
};

const displayOrder = new Map(DEFAULT_ALLOCATION_RULES.map((rule, index) => [rule.id, index]));

const sortRules = (items: AllocationRule[]) =>
    [...items].sort((a, b) => {
        const tierDiff = tierOrder[a.tier] - tierOrder[b.tier];
        if (tierDiff !== 0) return tierDiff;
        if (a.tier === 'pref' && b.tier === 'pref') return a.order - b.order;
        return (displayOrder.get(a.id) ?? 999) - (displayOrder.get(b.id) ?? 999);
    });

export const AllocationRuleSettings = ({ settings, equipmentSettings: initialEquipment, onSave, onClose, onResetUnassignedStreak, onResetApprovedExceptions }: Props) => {
    const [rules, setRules] = useState<AllocationRule[]>(sortRules(settings));
    const [priorities, setPriorities] = useState<number[]>([1, 2, 3]);
    const [terms, setTerms] = useState<Term[]>(['spring', 'spring_first', 'spring_second', 'autumn', 'autumn_first', 'autumn_second', 'full_year']);
    const [days, setDays] = useState<DayOfWeek[]>(['mon', 'tue', 'wed', 'thu', 'fri', 'sat']);
    const [periods, setPeriods] = useState<Period[]>([1, 2, 3, 4, 5, 6, 7]);
    const [allocationMode, setAllocationMode] = useState<'incremental' | 'shuffle'>('incremental');
    const [confirmExceptions, setConfirmExceptions] = useState(false);
    const [ignoreStreakOnce, setIgnoreStreakOnce] = useState(false);
    const [equipmentSettings, setEquipmentSettings] = useState(initialEquipment || DEFAULT_EQUIPMENT_SETTINGS);

    const handleToggle = (id: string) => {
        setRules(prev => prev.map(r =>
            r.id === id && r.tier !== 'hard'
                ? { ...r, enabled: !r.enabled }
                : r
        ));
    };

    const handleMovePref = (id: string, direction: 'up' | 'down') => {
        const prefRules = rules.filter(r => r.tier === 'pref').sort((a, b) => a.order - b.order);
        const index = prefRules.findIndex(r => r.id === id);
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (index < 0 || targetIndex < 0 || targetIndex >= prefRules.length) return;

        const next = [...prefRules];
        [next[index], next[targetIndex]] = [next[targetIndex], next[index]];

        const updated = rules.map(rule => {
            if (rule.tier !== 'pref') return rule;
            const swapped = next.find(r => r.id === rule.id)!;
            return { ...rule, order: next.findIndex(r => r.id === rule.id) + 1, enabled: swapped.enabled };
        });
        setRules(sortRules(updated));
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

    const hardRules = rules.filter(r => r.tier === 'hard');
    const nearRules = rules.filter(r => r.tier === 'near');
    const prefRules = rules.filter(r => r.tier === 'pref').sort((a, b) => a.order - b.order);

    const save = () => {
        onSave({
            rules: sortRules(rules),
            priorities,
            terms,
            days,
            periods,
            includeAllocated: allocationMode === 'shuffle',
            includeUnassigned: true,
            confirmExceptions,
            ignoreStreakOnce,
            equipmentSettings
        });
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
            background: '#fff', zIndex: 1000, display: 'flex', flexDirection: 'column',
            animation: 'slideIn 0.3s ease-out'
        }}>
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
                    <div>
                        <h2 style={{ margin: 0, fontSize: '1.4rem', color: '#333' }}>配当ルール設定</h2>
                        <div style={{ fontSize: '0.78rem', color: '#777' }}>Phase1: 必須条件は固定、希望条件は上から順に比較します</div>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <button
                        onClick={save}
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

            <div style={{ flex: 1, overflowY: 'auto', padding: '30px 40px' }}>
                <div style={{ background: '#f8f9fa', padding: '20px', borderRadius: '8px', marginBottom: '25px', border: '1px solid #e9ecef' }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '15px', fontSize: '0.95rem', color: '#333', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        🛠️ 配当基本設定
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.85rem', color: '#666', minWidth: '80px' }}>配当期:</span>
                            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                                {(Object.keys(TERM_LABELS) as Term[]).map(id => (
                                    <label key={id} style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                                        <input
                                            type="checkbox"
                                            checked={terms.includes(id)}
                                            onChange={() => setTerms(prev =>
                                                prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
                                            )}
                                        />
                                        <span style={{ fontSize: '0.85rem' }}>{TERM_LABELS[id]}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.85rem', color: '#666', minWidth: '80px' }}>曜日:</span>
                            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                {(['mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const).map(d => (
                                    <label key={d} style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                                        <input
                                            type="checkbox"
                                            checked={days.includes(d)}
                                            onChange={() => setDays(prev =>
                                                prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]
                                            )}
                                        />
                                        <span style={{ fontSize: '0.85rem' }}>{({ mon: '月', tue: '火', wed: '水', thu: '木', fri: '金', sat: '土' }[d])}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.85rem', color: '#666', minWidth: '80px' }}>講時:</span>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                {([1, 2, 3, 4, 5, 6, 7] as const).map(p => (
                                    <label key={p} style={{ display: 'flex', alignItems: 'center', gap: '3px', cursor: 'pointer' }}>
                                        <input
                                            type="checkbox"
                                            checked={periods.includes(p)}
                                            onChange={() => setPeriods(prev =>
                                                prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
                                            )}
                                        />
                                        <span style={{ fontSize: '0.85rem' }}>{p}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.85rem', color: '#666', minWidth: '80px' }}>科目の優先度:</span>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                {[3, 2, 1].map(p => (
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
                            <span style={{ fontSize: '0.75rem', color: '#666', background: '#f5f5f5', padding: '2px 6px', borderRadius: '4px', marginLeft: '8px' }}>
                                ※ 優先度が高い順に配当されます
                            </span>
                        </div>

                        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.85rem', color: '#666', minWidth: '80px' }}>配当モード:</span>
                            <div style={{ display: 'flex', gap: '15px', alignItems: 'center', background: '#e3f2fd', padding: '5px 12px', borderRadius: '20px' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: allocationMode === 'incremental' ? 'bold' : 'normal', color: allocationMode === 'incremental' ? '#1565c0' : '#666' }}>
                                    <input
                                        type="radio"
                                        name="allocationMode"
                                        value="incremental"
                                        checked={allocationMode === 'incremental'}
                                        onChange={() => setAllocationMode('incremental')}
                                        style={{ cursor: 'pointer' }}
                                    />
                                    <span style={{ fontSize: '0.85rem' }}>未配当のみ配当</span>
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: allocationMode === 'shuffle' ? 'bold' : 'normal', color: allocationMode === 'shuffle' ? '#d32f2f' : '#666' }}>
                                    <input
                                        type="radio"
                                        name="allocationMode"
                                        value="shuffle"
                                        checked={allocationMode === 'shuffle'}
                                        onChange={() => setAllocationMode('shuffle')}
                                        style={{ cursor: 'pointer' }}
                                    />
                                    <span style={{ fontSize: '0.85rem' }}>すべて再配当 (シャッフル)</span>
                                </label>
                            </div>
                        </div>

                        <label style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                            color: '#37474f',
                            background: '#fff',
                            border: '1px solid #e5e7eb',
                            borderRadius: '8px',
                            padding: '8px 12px',
                            width: 'fit-content'
                        }}>
                            <input
                                type="checkbox"
                                checked={confirmExceptions}
                                onChange={e => setConfirmExceptions(e.target.checked)}
                            />
                            例外配当を実行前に確認する
                        </label>

                        <label style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                            color: '#37474f',
                            background: '#fff',
                            border: '1px solid #e5e7eb',
                            borderRadius: '8px',
                            padding: '8px 12px',
                            width: 'fit-content'
                        }}>
                            <input
                                type="checkbox"
                                checked={ignoreStreakOnce}
                                onChange={e => setIgnoreStreakOnce(e.target.checked)}
                            />
                            今回は未配当連続カウントを無視する
                        </label>

                        {onResetUnassignedStreak && (
                            <button
                                type="button"
                                onClick={onResetUnassignedStreak}
                                style={{
                                    padding: '8px 12px',
                                    borderRadius: '8px',
                                    border: '1px solid #cbd5e1',
                                    background: '#fff',
                                    color: '#334155',
                                    cursor: 'pointer',
                                    fontSize: '0.85rem',
                                    width: 'fit-content'
                                }}
                            >
                                未配当連続カウントをリセット
                            </button>
                        )}

                        {onResetApprovedExceptions && (
                            <button
                                type="button"
                                onClick={onResetApprovedExceptions}
                                style={{
                                    padding: '8px 12px',
                                    borderRadius: '8px',
                                    border: '1px solid #cbd5e1',
                                    background: '#fff',
                                    color: '#334155',
                                    cursor: 'pointer',
                                    fontSize: '0.85rem',
                                    width: 'fit-content'
                                }}
                            >
                                承認済み例外を再確認対象に戻す
                            </button>
                        )}

                        <div style={{ marginTop: '10px', padding: '10px 12px', background: '#fff9c4', borderRadius: '6px', border: '1px solid #fbc02d', color: '#827717', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '1rem' }}>⚠️</span>
                            <span><strong>※注意:</strong> 「教室管理」で配当対象外になっている教室には、自動配当時に科目が配当されません。</span>
                        </div>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                    <section style={{ background: '#fff', border: '1px solid #eceff1', borderRadius: '10px', padding: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', fontWeight: 'bold', color: '#37474f' }}>
                            <Lock size={16} /> 絶対必須
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#607d8b', marginBottom: '12px' }}>固定。ここは切り替えません。</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {hardRules.map(rule => (
                                <div key={rule.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: '#f9fbfc', borderRadius: '8px', border: '1px solid #e0e0e0' }}>
                                    <Lock size={14} color="#78909c" />
                                    <div>
                                        <div style={{ fontWeight: 'bold', color: '#263238' }}>{rule.name}</div>
                                        <div style={{ fontSize: '0.78rem', color: '#607d8b' }}>{rule.description}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                    <section style={{ background: '#fff', border: '1px solid #eceff1', borderRadius: '10px', padding: '16px' }}>
                        <div style={{ fontWeight: 'bold', marginBottom: '12px', color: '#37474f' }}>準必須</div>
                        <div style={{ fontSize: '0.8rem', color: '#607d8b', marginBottom: '12px' }}>候補が0件のときだけ、許可されたものを例外的に緩和します。</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {nearRules.map(rule => (
                                <label key={rule.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px 12px', background: '#f9fbfc', borderRadius: '8px', border: '1px solid #e0e0e0', cursor: 'pointer' }}>
                                    <input
                                        type="checkbox"
                                        checked={rule.enabled}
                                        onChange={() => handleToggle(rule.id)}
                                        style={{ marginTop: '2px' }}
                                    />
                                    <div>
                                        <div style={{ fontWeight: 'bold', color: '#263238' }}>{rule.name}</div>
                                        <div style={{ fontSize: '0.78rem', color: '#607d8b' }}>{rule.description}</div>
                                        <div style={{ fontSize: '0.72rem', color: rule.enabled ? '#2e7d32' : '#999', marginTop: '4px' }}>
                                            {rule.enabled ? '例外配当を許可' : '例外配当を許可しない'}
                                        </div>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </section>
                </div>

                <section style={{ background: '#fff', border: '1px solid #eceff1', borderRadius: '10px', padding: '16px', marginBottom: '24px' }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '8px', color: '#37474f' }}>希望条件</div>
                    <div style={{ fontSize: '0.8rem', color: '#607d8b', marginBottom: '16px' }}>上から順に比較します。加点の合計ではありません。</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {prefRules.map((rule, index) => (
                            <div key={rule.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: '#fafafa', borderRadius: '8px', border: '1px solid #e0e0e0', opacity: rule.enabled ? 1 : 0.6 }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                    <button
                                        disabled={index === 0}
                                        onClick={() => handleMovePref(rule.id, 'up')}
                                        style={{ background: 'none', border: 'none', cursor: index === 0 ? 'default' : 'pointer', color: index === 0 ? '#eee' : '#999', padding: 0 }}
                                    >
                                        <ChevronUp size={18} />
                                    </button>
                                    <button
                                        disabled={index === prefRules.length - 1}
                                        onClick={() => handleMovePref(rule.id, 'down')}
                                        style={{ background: 'none', border: 'none', cursor: index === prefRules.length - 1 ? 'default' : 'pointer', color: index === prefRules.length - 1 ? '#eee' : '#999', padding: 0 }}
                                    >
                                        <ChevronDown size={18} />
                                    </button>
                                </div>
                                <div style={{ width: '32px', textAlign: 'center', fontWeight: 'bold', color: '#78909c' }}>{index + 1}</div>
                                <input
                                    type="checkbox"
                                    checked={rule.enabled}
                                    onChange={() => handleToggle(rule.id)}
                                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                />
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 'bold', fontSize: '1rem', color: '#263238', marginBottom: '4px' }}>{rule.name}</div>
                                    <div style={{ fontSize: '0.82rem', color: '#607d8b' }}>{rule.description}</div>
                                </div>
                                <div style={{ fontSize: '0.75rem', color: rule.enabled ? '#2e7d32' : '#999', whiteSpace: 'nowrap' }}>
                                    {rule.enabled ? '比較対象' : '無効'}
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                <section style={{ background: '#fff', border: '1px solid #eceff1', borderRadius: '10px', padding: '16px' }}>
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
                                onChange={() => setEquipmentSettings(prev => ({ ...prev, strictLevel5: !prev.strictLevel5 }))}
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
                </section>
            </div>

            <style>{`
                @keyframes slideIn {
                    from { opacity: 0; transform: translateX(-20px); }
                    to { opacity: 1; transform: translateX(0); }
                }
            `}</style>
        </div>
    );
};
