import { useState } from 'react';
import { Download, X } from 'lucide-react';
import { exportToCSVWithSaveDialog } from '../utils/csvParser';

type ImportErrorCsvDialogProps = {
    open: boolean;
    title: string;
    message: string;
    filename: string;
    rows: Record<string, unknown>[];
    onClose: () => void;
};

export const ImportErrorCsvDialog = ({
    open,
    title,
    message,
    filename,
    rows,
    onClose
}: ImportErrorCsvDialogProps) => {
    const [saving, setSaving] = useState(false);
    const [status, setStatus] = useState<string | null>(null);

    if (!open) return null;

    const previewKeys = Object.keys(rows[0] ?? {}).slice(0, 6);

    const handleSave = async () => {
        setSaving(true);
        setStatus(null);
        try {
            const saved = await exportToCSVWithSaveDialog(rows, filename);
            if (saved) {
                onClose();
                return;
            }
            setStatus('保存がキャンセルされました。もう一度お試しください。');
        } catch (err) {
            setStatus(err instanceof Error ? err.message : `CSV出力エラー: ${String(err)}`);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div
            role="dialog"
            aria-modal="true"
            style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.45)',
                zIndex: 2000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '20px'
            }}
        >
            <div
                style={{
                    width: 'min(860px, 100%)',
                    background: '#fff',
                    borderRadius: '12px',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
                    overflow: 'hidden'
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        gap: '16px',
                        padding: '16px 20px',
                        borderBottom: '1px solid #eee',
                        background: '#fafafa'
                    }}
                >
                    <div>
                        <div style={{ fontSize: '1rem', fontWeight: 700, color: '#222' }}>{title}</div>
                        <div style={{ fontSize: '0.88rem', color: '#666', marginTop: '4px', lineHeight: 1.5 }}>
                            {message}
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: '#666',
                            padding: 0,
                            lineHeight: 0
                        }}
                        aria-label="閉じる"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div style={{ padding: '16px 20px', maxHeight: '54vh', overflow: 'auto' }}>
                    <div style={{ marginBottom: '12px', color: '#333', lineHeight: 1.6 }}>
                        エラーCSVは <strong>{rows.length} 件</strong> の詳細を含みます。
                        保存ボタンを押すと保存先を選べます。
                    </div>

                    {status && (
                        <div
                            style={{
                                marginBottom: '12px',
                                padding: '10px 12px',
                                background: '#fff4e5',
                                border: '1px solid #f0c36d',
                                borderRadius: '8px',
                                color: '#8a5a00',
                                fontSize: '0.85rem'
                            }}
                        >
                            {status}
                        </div>
                    )}

                    <div style={{ border: '1px solid #eee', borderRadius: '8px', overflow: 'hidden' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                            <thead>
                                <tr style={{ background: '#f7f7f7' }}>
                                    {previewKeys.map(key => (
                                        <th
                                            key={key}
                                            style={{
                                                textAlign: 'left',
                                                padding: '8px 10px',
                                                borderBottom: '1px solid #eee',
                                                whiteSpace: 'nowrap'
                                            }}
                                        >
                                            {key}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {rows.slice(0, 5).map((row, index) => (
                                    <tr key={index}>
                                        {previewKeys.map(key => (
                                            <td
                                                key={key}
                                                style={{
                                                    padding: '8px 10px',
                                                    borderBottom: '1px solid #f3f3f3',
                                                    verticalAlign: 'top'
                                                }}
                                            >
                                                {String((row as Record<string, unknown>)[key] ?? '')}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'flex-end',
                        gap: '10px',
                        padding: '14px 20px',
                        borderTop: '1px solid #eee',
                        background: '#fafafa'
                    }}
                >
                    <button
                        type="button"
                        onClick={onClose}
                        style={{
                            border: '1px solid #ccc',
                            background: '#fff',
                            color: '#333',
                            padding: '8px 14px',
                            borderRadius: '8px',
                            cursor: 'pointer'
                        }}
                    >
                        閉じる
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            border: 'none',
                            background: saving ? '#9bb7e8' : '#1976d2',
                            color: '#fff',
                            padding: '8px 16px',
                            borderRadius: '8px',
                            cursor: saving ? 'wait' : 'pointer'
                        }}
                    >
                        <Download size={16} />
                        {saving ? '保存中...' : 'エラーCSVを保存'}
                    </button>
                </div>
            </div>
        </div>
    );
};
