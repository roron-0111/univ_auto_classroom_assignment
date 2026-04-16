import React, { useState } from 'react';
import { X, Cloud, LogIn, LogOut } from 'lucide-react';
import type { User } from 'firebase/auth';
import { CAMPUSES } from '../types';

interface CloudConnectionModalProps {
    onClose: () => void;
    onLogin: (email: string, pass: string) => Promise<void>;
    onLogout: () => void;
    isConnecting: boolean;
    user: User | null;
}

export const CloudConnectionModal: React.FC<CloudConnectionModalProps> = ({
    onClose,
    onLogin,
    onLogout,
    isConnecting,
    user
}) => {
    const [error, setError] = useState<string | null>(null);

    const handleCampusSelect = async (campusId: string) => {
        setError(null);
        try {
            await onLogin(campusId, ''); // pass is ignored in useAuth
            onClose();
        } catch (err: any) {
            console.error(err);
            setError(`接続に失敗しました (${err.code || err.message || 'unknown error'})`);
        }
    };

    if (user) {
        const campusName = CAMPUSES.find(c => `${c.id}@campus.local` === user.email)?.name || user.email?.split('@')[0];

        return (
            <div className="modal-overlay">
                <div className="modal-card">
                    <div className="modal-header">
                        <h2 style={{ fontSize: '1.1rem', fontWeight: 'bold', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <LogIn size={20} color="#646cff" />
                            接続情報
                        </h2>
                        <button onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#ccc' }}>
                            <X size={20} />
                        </button>
                    </div>
                    <div className="modal-body" style={{ textAlign: 'center' }}>
                        <div className="user-avatar-circle">
                            <LogIn size={40} color="#646cff" />
                            <div className="online-dot"></div>
                        </div>
                        <div style={{ marginBottom: '32px' }}>
                            <p style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#999', textTransform: 'uppercase', marginBottom: '8px' }}>現在のキャンパス</p>
                            <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: '0 0 12px' }}>{campusName}</h3>
                            <div className="sync-badge synced" style={{ margin: '0 auto', width: 'fit-content' }}>
                                <div className="animate-pulse" style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#2e7d32' }}></div>
                                クラウド同期中
                            </div>
                        </div>
                        <button onClick={() => { onLogout(); onClose(); }} className="logout-button">
                            <LogOut size={20} />
                            ログアウト
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="modal-overlay">
            <div className="modal-card">
                <div className="modal-header">
                    <h2 style={{ fontSize: '1.1rem', fontWeight: 'bold', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Cloud size={20} color="#646cff" />
                        キャンパスを選択
                    </h2>
                    {user && (
                        <button onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#ccc' }}>
                            <X size={20} />
                        </button>
                    )}
                </div>

                <div className="modal-body">
                    <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                        <p style={{ fontSize: '0.9rem', color: '#666', margin: 0 }}>
                            同期するキャンパスを選択してください。
                        </p>
                    </div>

                    {error && <div className="error-message">{error}</div>}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
                        {CAMPUSES.map(campus => (
                            <button
                                key={campus.id}
                                disabled={isConnecting}
                                onClick={() => handleCampusSelect(campus.id)}
                                className="primary-button"
                                style={{
                                    background: '#fff',
                                    color: '#333',
                                    border: '2px solid #eee',
                                    boxShadow: 'none',
                                    height: '64px',
                                    fontSize: '1.1rem'
                                }}
                            >
                                {campus.name}
                            </button>
                        ))}
                    </div>

                    {user && (
                        <button type="button" onClick={onClose} className="secondary-button" style={{ marginTop: '24px' }}>
                            キャンセル
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
