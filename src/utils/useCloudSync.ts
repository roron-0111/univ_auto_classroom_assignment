import { useState, useCallback } from 'react';
import { db, auth } from './firebase';
import { doc, getDoc, setDoc, updateDoc, runTransaction } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import type { CloudData } from '../types_cloud';
import { getCampusLabelFromEmail, normalizeCampusLabel } from '../types';

type FirestoreValue = string | number | boolean | null | FirestoreValue[] | { [key: string]: FirestoreValue };
type WriteLockDoc = {
  sessionId: string;
  ownerEmail: string | null;
  acquiredAt: number;
  expiresAt: number;
};

const WRITE_LOCK_TTL_MS = 15_000;
const WRITE_LOCK_SESSION_KEY = 'subject_rooms_cloud_write_session';
const WRITE_LOCK_KEY_PREFIX = 'subject_rooms_cloud_write_lock';

const getWriteSessionId = () => {
  try {
    const existing = sessionStorage.getItem(WRITE_LOCK_SESSION_KEY);
    if (existing) return existing;
    const next = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `session-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem(WRITE_LOCK_SESSION_KEY, next);
    return next;
  } catch {
    return `session-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
};

const getWriteLockDocId = (currentUser: User) => {
  const campusLabel = normalizeCampusLabel(getCampusLabelFromEmail(currentUser.email) || currentUser.email?.split('@')[0] || '');
  return campusLabel || 'default';
};

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

  const acquireWriteLock = useCallback(async () => {
    const currentUser = user || auth.currentUser;
    if (!currentUser) return null;

    const sessionId = getWriteSessionId();
    const lockDocId = getWriteLockDocId(currentUser);
    const lockRef = doc(db, WRITE_LOCK_KEY_PREFIX, lockDocId);
    const now = Date.now();

    await runTransaction(db, async tx => {
      const snap = await tx.get(lockRef);
      if (snap.exists()) {
        const current = snap.data() as Partial<WriteLockDoc>;
        const expiresAt = typeof current.expiresAt === 'number' ? current.expiresAt : 0;
        const lockedSessionId = typeof current.sessionId === 'string' ? current.sessionId : '';

        if (expiresAt > now && lockedSessionId && lockedSessionId !== sessionId) {
          throw new Error('WRITE_LOCKED');
        }
      }

      const nextLock: WriteLockDoc = {
        sessionId,
        ownerEmail: currentUser.email ?? null,
        acquiredAt: now,
        expiresAt: now + WRITE_LOCK_TTL_MS
      };
      tx.set(lockRef, nextLock, { merge: true });
    });

    return { lockRef, sessionId };
  }, [user]);

  const releaseWriteLock = useCallback(async () => {
    const currentUser = user || auth.currentUser;
    if (!currentUser) return;

    const sessionId = getWriteSessionId();
    const lockDocId = getWriteLockDocId(currentUser);
    const lockRef = doc(db, WRITE_LOCK_KEY_PREFIX, lockDocId);

    try {
      await runTransaction(db, async tx => {
        const snap = await tx.get(lockRef);
        if (!snap.exists()) return;
        const current = snap.data() as Partial<WriteLockDoc>;
        if (current.sessionId === sessionId) {
          tx.delete(lockRef);
        }
      });
    } catch (error) {
      console.warn('Failed to release write lock:', error);
    }
  }, [user]);

  const saveData = useCallback(async (data: CloudData) => {
    const currentUser = user || auth.currentUser;
    if (!currentUser) return;

    await acquireWriteLock();
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
    } finally {
      await releaseWriteLock();
    }
  }, [user, acquireWriteLock, releaseWriteLock]);

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
