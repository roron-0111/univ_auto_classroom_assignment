import { useState, useCallback } from 'react';
import { db } from './firebase';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import type { CloudData } from '../types_cloud';

export const useCloudSync = (user: User | null) => {
    const [lastSynced, setLastSynced] = useState<Date | null>(null);

    const saveData = useCallback(async (data: CloudData) => {
        if (!user) return;

        try {
            const docRef = doc(db, 'user_data', user.uid);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                await updateDoc(docRef, {
                    data: data,
                    lastUpdated: Date.now()
                });
            } else {
                await setDoc(docRef, {
                    data: data,
                    lastUpdated: Date.now(),
                    createdAt: Date.now(),
                    email: user.email
                });
            }
            setLastSynced(new Date());
        } catch (error) {
            console.error('Failed to save data:', error);
            throw error;
        }
    }, [user]);

    const refreshData = useCallback(async (): Promise<CloudData | null> => {
        if (!user) return null;
        try {
            const docRef = doc(db, 'user_data', user.uid);
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
    }, [user]);

    return {
        lastSynced,
        saveData,
        refreshData
    };
};
