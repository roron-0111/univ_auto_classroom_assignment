import { useState, useCallback } from 'react';
import { db, auth } from './firebase';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import type { CloudData } from '../types_cloud';

type FirestoreValue = string | number | boolean | null | FirestoreValue[] | { [key: string]: FirestoreValue };

const sanitizeData = (obj: unknown): FirestoreValue => {
  if (Array.isArray(obj)) {
    return obj.map(v => sanitizeData(v));
  }
  if (obj !== null && typeof obj === 'object') {
    const newObj: { [key: string]: FirestoreValue } = {};
    Object.entries(obj as Record<string, unknown>).forEach(([key, val]) => {
      if (val !== undefined) {
        newObj[key] = sanitizeData(val);
      }
    });
    return newObj;
  }
  return obj as FirestoreValue;
};

export const useCloudSync = (user: User | null) => {
  const [lastSynced, setLastSynced] = useState<Date | null>(null);

  const saveData = useCallback(async (data: CloudData) => {
    const currentUser = user || auth.currentUser;
    if (!currentUser) return;

    try {
      const sanitized = sanitizeData(data);
      const docRef = doc(db, 'user_data', currentUser.uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        await updateDoc(docRef, {
          data: sanitized,
          lastUpdated: Date.now()
        });
      } else {
        await setDoc(docRef, {
          data: sanitized,
          lastUpdated: Date.now(),
          createdAt: Date.now(),
          email: currentUser.email
        });
      }
      setLastSynced(new Date());
    } catch (error) {
      console.error('Failed to save data:', error);
      throw error;
    }
  }, [user]);

  const refreshData = useCallback(async (): Promise<CloudData | null> => {
    const currentUser = user || auth.currentUser;
    if (!currentUser) return null;
    try {
      const docRef = doc(db, 'user_data', currentUser.uid);
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
