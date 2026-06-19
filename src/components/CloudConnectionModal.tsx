import React, { useState } from 'react';
import { X, Cloud, LogIn, LogOut, HelpCircle } from 'lucide-react';
import type { User } from 'firebase/auth';
import { CAMPUSES, getCampusLabelFromEmail } from '../types';

interface CloudConnectionModalProps {
  onClose: () => void;
  onGuide?: () => void;
  onLogin: (email: string, pass: string) => Promise<void>;
  onLogout: () => void;
  isConnecting: boolean;
  user: User | null;
}

export const CloudConnectionModal: React.FC<CloudConnectionModalProps> = ({
  onClose,
  onGuide,
  onLogin,
  onLogout,
  isConnecting,
  user
}) => {
  const [error, setError] = useState<string | null>(null);

  const handleCampusSelect = async (campusId: string) => {
    setError(null);
    try {
      await onLogin(campusId, '');
      onClose();
    } catch (err: unknown) {
      console.error(err);
      setError('ログインに失敗しました。しばらくしてからもう一度お試しください。');
    }
  };

  if (user) {
    const campusName = getCampusLabelFromEmail(user.email) || user.email?.split('@')[0] || '未設定';

    return (
      <div className="modal-overlay">
        <div className="modal-card">
          <div className="modal-header">
            <h2
              style={{
                fontSize: '1.1rem',
                fontWeight: 'bold',
                margin: 0,
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <LogIn size={20} color="#646cff" />
              ログイン情報
            </h2>
            <button onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#ccc' }}>
              <X size={20} />
            </button>
          </div>
          <div className="modal-body" style={{ textAlign: 'center' }}>
            <div className="user-avatar-circle">
              <LogIn size={40} color="#646cff" />
              <div className="online-dot" />
            </div>
            <div style={{ marginBottom: '32px' }}>
              <p
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 'bold',
                  color: '#999',
                  textTransform: 'uppercase',
                  marginBottom: '8px'
                }}
              >
                現在のキャンパス
              </p>
              <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: '0 0 12px' }}>{campusName}</h3>
              <div className="sync-badge synced" style={{ margin: '0 auto', width: 'fit-content' }}>
                <div
                  className="animate-pulse"
                  style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#2e7d32' }}
                />
                クラウド接続中
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
          <h2
            style={{
              fontSize: '1.1rem',
              fontWeight: 'bold',
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
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
              接続するキャンパスを選んでください。
            </p>
            {onGuide && (
              <button
                type="button"
                className="secondary-button"
                onClick={onGuide}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  marginTop: '16px'
                }}
              >
                <HelpCircle size={18} />
                ガイドを開く
              </button>
            )}
          </div>

          {error && <div className="error-message">{error}</div>}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
            {CAMPUSES.map(campus => (
              (() => {
                const isAvailable = campus.id === 'hakkei';
                return (
              <button
                key={campus.id}
                disabled={isConnecting || !isAvailable}
                onClick={() => {
                  if (!isAvailable) return;
                  handleCampusSelect(campus.id);
                }}
                className="primary-button"
                style={{
                  background: isAvailable ? '#fff' : '#f3f4f6',
                  color: isAvailable ? '#333' : '#9ca3af',
                  border: `2px solid ${isAvailable ? '#eee' : '#e5e7eb'}`,
                  boxShadow: 'none',
                  height: '64px',
                  fontSize: '1.1rem',
                  cursor: isAvailable ? 'pointer' : 'not-allowed',
                  opacity: isAvailable ? 1 : 0.75
                }}
                aria-disabled={!isAvailable}
              >
                {campus.name}
              </button>
                );
              })()
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
