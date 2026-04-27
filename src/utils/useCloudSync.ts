import { useState, useCallback } from 'react';
import { db, auth } from './firebase';
import {
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  runTransaction,
  setDoc,
  writeBatch
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import type { CloudData } from '../types_cloud';

type FirestoreValue = string | number | boolean | null | FirestoreValue[] | { [key: string]: FirestoreValue };
type WriteLockDoc = {
  lockSessionId: string;
  lockOwnerEmail: string | null;
  lockAcquiredAt: number;
  lockExpiresAt: number;
};

const WRITE_LOCK_TTL_MS = 15_000;
const WRITE_LOCK_SESSION_KEY = 'subject_rooms_cloud_write_session';
const META_COLLECTION = 'user_data_meta';
const PAYLOAD_COLLECTION = 'user_data_payload';
const CONFIG_DOC_ID = 'main';
const CHUNK_SIZE = 50;
const SCHEMA_VERSION = 2;

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

const chunkArray = <T,>(items: T[], chunkSize: number) => {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    result.push(items.slice(i, i + chunkSize));
  }
  return result;
};

const getMetaRef = (uid: string) => doc(db, META_COLLECTION, uid);
const getPayloadCollectionRef = (uid: string, name: string) => collection(db, PAYLOAD_COLLECTION, uid, name);
const getChunkDocRef = (uid: string, name: string, index: number) =>
  doc(db, PAYLOAD_COLLECTION, uid, name, String(index).padStart(4, '0'));
const getConfigDocRef = (uid: string) => doc(db, PAYLOAD_COLLECTION, uid, 'config', CONFIG_DOC_ID);

const replaceChunkedCollection = async <T,>(uid: string, name: string, items: T[]) => {
  const collectionRef = getPayloadCollectionRef(uid, name);
  const existing = await getDocs(collectionRef);
  const batch = writeBatch(db);

  existing.docs.forEach(snapshot => {
    batch.delete(snapshot.ref);
  });

  chunkArray(items, CHUNK_SIZE).forEach((chunk, index) => {
    batch.set(getChunkDocRef(uid, name, index), {
      index,
      items: sanitizeData(chunk)
    });
  });

  if (!existing.empty || items.length > 0) {
    await batch.commit();
  }
};

const readChunkedCollection = async <T,>(uid: string, name: string): Promise<T[] | null> => {
  const collectionRef = getPayloadCollectionRef(uid, name);
  const snap = await getDocs(collectionRef);
  if (snap.empty) return null;
  const docs = snap.docs.slice().sort((a, b) => {
    const ai = typeof a.data().index === 'number' ? a.data().index : Number(a.id);
    const bi = typeof b.data().index === 'number' ? b.data().index : Number(b.id);
    return ai - bi;
  });
  const items: T[] = [];
  docs.forEach(docSnap => {
    const data = docSnap.data() as { items?: unknown };
    if (Array.isArray(data.items)) {
      items.push(...(data.items as T[]));
    }
  });
  return items;
};

const loadLegacyCloudData = async (uid: string): Promise<CloudData | null> => {
  const legacyRef = doc(db, 'user_data', uid);
  const legacySnap = await getDoc(legacyRef);
  if (!legacySnap.exists()) return null;
  const data = legacySnap.data();
  if (data && typeof data === 'object' && 'data' in data) {
    return (data.data as CloudData) ?? null;
  }
  return null;
};

const getLockRef = (uid: string) => getMetaRef(uid);

export const useCloudSync = (user: User | null) => {
  const [lastSynced, setLastSynced] = useState<Date | null>(null);

  const acquireWriteLock = useCallback(async () => {
    const currentUser = user || auth.currentUser;
    if (!currentUser) return null;

    const sessionId = getWriteSessionId();
    const lockRef = getLockRef(currentUser.uid);
    const now = Date.now();

    await runTransaction(db, async tx => {
      const snap = await tx.get(lockRef);
      if (snap.exists()) {
        const current = snap.data() as Partial<WriteLockDoc>;
        const expiresAt = typeof current.lockExpiresAt === 'number' ? current.lockExpiresAt : 0;
        const lockedSessionId = typeof current.lockSessionId === 'string' ? current.lockSessionId : '';

        if (expiresAt > now && lockedSessionId && lockedSessionId !== sessionId) {
          throw new Error('WRITE_LOCKED');
        }
      }

      const nextLock: WriteLockDoc = {
        lockSessionId: sessionId,
        lockOwnerEmail: currentUser.email ?? null,
        lockAcquiredAt: now,
        lockExpiresAt: now + WRITE_LOCK_TTL_MS
      };
      tx.set(lockRef, nextLock, { merge: true });
    });

    return { lockRef, sessionId };
  }, [user]);

  const releaseWriteLock = useCallback(async () => {
    const currentUser = user || auth.currentUser;
    if (!currentUser) return;

    const sessionId = getWriteSessionId();
    const lockRef = getLockRef(currentUser.uid);

    try {
      await runTransaction(db, async tx => {
        const snap = await tx.get(lockRef);
        if (!snap.exists()) return;
        const current = snap.data() as Partial<WriteLockDoc>;
        if (current.lockSessionId === sessionId) {
          tx.update(lockRef, {
            lockSessionId: deleteField(),
            lockOwnerEmail: deleteField(),
            lockAcquiredAt: deleteField(),
            lockExpiresAt: deleteField()
          });
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
      const metaRef = getMetaRef(currentUser.uid);
      const sanitized = sanitizeData(data) as Record<string, FirestoreValue>;
      const now = Date.now();

      await replaceChunkedCollection(currentUser.uid, 'subjects', Array.isArray(data.subjects) ? data.subjects : []);
      await replaceChunkedCollection(currentUser.uid, 'classrooms', Array.isArray(data.classrooms) ? data.classrooms : []);
      await replaceChunkedCollection(currentUser.uid, 'allocations', Array.isArray(data.allocations) ? data.allocations : []);

      const configRef = getConfigDocRef(currentUser.uid);
      await setDoc(configRef, {
        settings: sanitizeData(data.settings),
        equipmentSettings: sanitizeData(data.equipmentSettings),
        subjectTaxonomy: sanitizeData(data.subjectTaxonomy),
        updatedAt: now,
        schemaVersion: SCHEMA_VERSION
      }, { merge: true });

      await setDoc(metaRef, {
        lastUpdated: now,
        createdAt: now,
        email: currentUser.email ?? null,
        schemaVersion: SCHEMA_VERSION
      }, { merge: true });

      void sanitized;
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
      const [subjects, classrooms, allocations, legacyData] = await Promise.all([
        readChunkedCollection(currentUser.uid, 'subjects'),
        readChunkedCollection(currentUser.uid, 'classrooms'),
        readChunkedCollection(currentUser.uid, 'allocations'),
        loadLegacyCloudData(currentUser.uid)
      ]);

      const configSnap = await getDoc(getConfigDocRef(currentUser.uid));

      if (subjects !== null || classrooms !== null || allocations !== null || configSnap.exists()) {
        const configData = configSnap.exists() ? configSnap.data() : {};
        setLastSynced(new Date());
        return {
          subjects: (subjects ?? []) as CloudData['subjects'],
          classrooms: (classrooms ?? []) as CloudData['classrooms'],
          allocations: (allocations ?? []) as CloudData['allocations'],
          settings: (configData.settings ?? []) as CloudData['settings'],
          equipmentSettings: (configData.equipmentSettings ?? {}) as CloudData['equipmentSettings'],
          subjectTaxonomy: (configData.subjectTaxonomy ?? {}) as CloudData['subjectTaxonomy']
        };
      }

      if (legacyData) {
        setLastSynced(new Date());
        return legacyData;
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
