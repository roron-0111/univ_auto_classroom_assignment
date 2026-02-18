import React, { useState } from 'react';
import { X, Cloud, LogIn, PlusCircle } from 'lucide-react';



interface CloudConnectionModalProps {
    onClose: () => void;
    onConnect: (projectId: string, passcode: string, mode: 'connect' | 'create') => Promise<void>;
    isConnecting: boolean;
}

export const CloudConnectionModal: React.FC<CloudConnectionModalProps> = ({ onClose, onConnect, isConnecting }) => {
    const [mode, setMode] = useState<'connect' | 'create'>('connect');
    const [projectId, setProjectId] = useState('');
    const [passcode, setPasscode] = useState('');
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!projectId.trim() || !passcode.trim()) {
            setError('プロジェクトIDとパスコードを入力してください');
            return;
        }

        try {
            await onConnect(projectId.trim(), passcode.trim(), mode);
        } catch (err: any) {
            console.error(err);
            if (mode === 'create') {
                setError('プロジェクトの作成に失敗しました。このIDは既に使用されている可能性があります。');
            } else {
                setError('接続に失敗しました。IDまたはパスコードが間違っているか、プロジェクトが存在しません。');
            }
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
                <div className="flex justify-between items-center p-4 border-b bg-indigo-50">
                    <h2 className="text-lg font-semibold text-indigo-900 flex items-center gap-2">
                        <Cloud size={20} />
                        {mode === 'connect' ? 'クラウドプロジェクトに接続' : '新規プロジェクト作成'}
                    </h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="flex gap-2 mb-6 bg-gray-100 p-1 rounded-lg">
                        <button
                            type="button"
                            onClick={() => { setMode('connect'); setError(null); }}
                            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors flex items-center justify-center gap-2 ${mode === 'connect' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            <LogIn size={16} /> 接続する
                        </button>
                        <button
                            type="button"
                            onClick={() => { setMode('create'); setError(null); }}
                            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors flex items-center justify-center gap-2 ${mode === 'create' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            <PlusCircle size={16} /> 新規作成
                        </button>
                    </div>

                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded text-sm mb-4">
                            {error}
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            プロジェクトID (合言葉)
                        </label>
                        <input
                            type="text"
                            value={projectId}
                            onChange={(e) => setProjectId(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="例: univ-2024-spring"
                            pattern="^[a-zA-Z0-9-_]+$"
                            title="半角英数字、ハイフン、アンダースコアのみ使用可能です"
                            required
                        />
                        {mode === 'create' && (
                            <p className="text-xs text-gray-500 mt-1">※半角英数字、ハイフン(-)、アンダースコア(_)のみ</p>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            パスコード
                        </label>
                        <input
                            type="password"
                            value={passcode}
                            onChange={(e) => setPasscode(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="接続のための秘密のコード"
                            required
                        />
                        {mode === 'create' && (
                            <p className="text-xs text-gray-500 mt-1">※このパスコードを知っている人だけが接続できます</p>
                        )}
                    </div>

                    <div className="pt-4">
                        <button
                            type="submit"
                            disabled={isConnecting}
                            className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {isConnecting ? (
                                <>
                                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                                    処理中...
                                </>
                            ) : (
                                mode === 'connect' ? '接続する' : 'プロジェクトを作成'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
