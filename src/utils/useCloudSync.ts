import { useState, useEffect, useCallback } from 'react';
import { db } from './firebase';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import type { CloudProject, CloudData } from '../types_cloud';

export const useCloudSync = () => {
    const [currentProject, setCurrentProject] = useState<CloudProject | null>(null);
    const [isConnecting, setIsConnecting] = useState(false);
    const [lastSynced, setLastSynced] = useState<Date | null>(null);

    // マウント時にローカルストレージから接続情報を復元
    useEffect(() => {
        const savedProject = sessionStorage.getItem('currentCloudProject');
        if (savedProject) {
            setCurrentProject(JSON.parse(savedProject));
        }
    }, []);

    const connectToProject = useCallback(async (projectId: string, passcode: string, mode: 'connect' | 'create'): Promise<CloudData | null> => {
        setIsConnecting(true);
        try {
            const docRef = doc(db, 'projects', projectId);
            const docSnap = await getDoc(docRef);

            if (mode === 'create') {
                if (docSnap.exists()) {
                    throw new Error('Project already exists');
                }
                // 新規作成
                const newProject: CloudProject = {
                    id: projectId,
                    passcode,
                    createdAt: Date.now(),
                    lastUpdated: Date.now()
                };
                // 初期データは空で作成（アプリ側で現在の状態を保存する形になる）
                await setDoc(docRef, { ...newProject, data: null });

                setCurrentProject(newProject);
                sessionStorage.setItem('currentCloudProject', JSON.stringify(newProject));
                return null; // データはないのでnullを返す（呼び出し元で現在データを保存すべき）
            } else {
                // 既存接続
                if (!docSnap.exists()) {
                    throw new Error('Project not found');
                }
                const data = docSnap.data();
                if (data.passcode !== passcode) {
                    throw new Error('Invalid passcode');
                }

                const project: CloudProject = {
                    id: projectId,
                    passcode,
                    createdAt: data.createdAt,
                    lastUpdated: data.lastUpdated
                };
                setCurrentProject(project);
                sessionStorage.setItem('currentCloudProject', JSON.stringify(project));
                setLastSynced(new Date());

                return data.data as CloudData;
            }
        } finally {
            setIsConnecting(false);
        }
    }, []);

    const disconnect = useCallback(() => {
        setCurrentProject(null);
        sessionStorage.removeItem('currentCloudProject');
        setLastSynced(null);
    }, []);

    const saveData = useCallback(async (data: CloudData) => {
        if (!currentProject) return;

        try {
            const docRef = doc(db, 'projects', currentProject.id);
            await updateDoc(docRef, {
                data: data,
                lastUpdated: Date.now(),
                // serverTimestamp() を使うとサーバー側で時刻が入るが、
                // クライアント側で即座に表示したいのでDate.now()も併用検討
                // 今回はシンプルにローカル時間を記録
            });
            setLastSynced(new Date());
        } catch (error) {
            console.error('Failed to save data:', error);
            throw error;
        }
    }, [currentProject]);

    const refreshData = useCallback(async (): Promise<CloudData | null> => {
        if (!currentProject) return null;
        try {
            const docRef = doc(db, 'projects', currentProject.id);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const data = docSnap.data();
                setLastSynced(new Date());
                return data.data as CloudData;
            }
            return null;
        } catch (error) {
            console.error('Failed to refresh data:', error);
            throw error;
        }
    }, [currentProject]);

    return {
        currentProject,
        isConnecting,
        lastSynced,
        connectToProject,
        disconnect,
        saveData,
        refreshData
    };
};
