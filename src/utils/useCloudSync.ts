import { useState, useCallback, useRef } from 'react';
import { auth, getDb } from './firebase';
import { mergeAllocationsBySubjectBaseline } from './cloudAllocationMerge';
import { stableSerialize } from './cloudDiff';
import type { User } from 'firebase/auth';
import type { CloudData } from '../types_cloud';

type FirestoreValue = string | number | boolean | null | FirestoreValue[] | { [key: string]: FirestoreValue };
type WriteLockDoc = {
  lockSessionId: string;
  lockOwnerEmail: string | null;
  lockAcquiredAt: number;
  lockExpiresAt: number;
};
type CloudMetaDoc = {
  snapshotRevision?: string;
  lastUpdated?: number;
  createdAt?: number;
  email?: string | null;
  schemaVersion?: number;
  lockSessionId?: string | null;
  lockOwnerEmail?: string | null;
  lockAcquiredAt?: number;
  lockExpiresAt?: number;
};
type ChunkedPayloadDoc = {
  index?: number;
  revision?: string;
  items?: unknown;
};
type ChunkedCollectionRead<T> =
  | { status: 'ok'; items: T[] }
  | { status: 'missing' }
  | { status: 'invalid' };
type CloudSnapshot = {
  data: CloudData;
  revision: string | null;
};
type CloudSnapshotRead =
  | { status: 'ok'; snapshot: CloudSnapshot }
  | { status: 'empty' }
  | { status: 'invalid' };
type PayloadCounts = {
  subjects?: number;
  classrooms?: number;
  allocations?: number;
};

const WRITE_LOCK_TTL_MS = 15_000;
const CLOUD_SYNC_WAIT_MS = 250;
const CLOUD_SYNC_WAIT_MAX_ATTEMPTS = 20;
const WRITE_LOCK_SESSION_KEY = 'subject_rooms_cloud_write_session';
const META_COLLECTION = 'user_data_meta';
const PAYLOAD_COLLECTION = 'user_data_payload';
const CONFIG_DOC_ID = 'main';
const CHUNK_SIZE = 50;
const SCHEMA_VERSION = 2;
const CLOUD_SNAPSHOT_INVALID_MESSAGE = 'クラウドデータの整合性を確認できません。取得をやり直してから書き込んでください。';

const createFirestoreDeps = async () => {
  const [db, firestore] = await Promise.all([
    getDb(),
    import('firebase/firestore')
  ]);
  return {
    auth,
    db,
    collection: firestore.collection,
    deleteField: firestore.deleteField,
    doc: firestore.doc,
    getDoc: firestore.getDoc,
    getDocs: firestore.getDocs,
    runTransaction: firestore.runTransaction,
    setDoc: firestore.setDoc,
    writeBatch: firestore.writeBatch
  };
};

let firestoreDepsPromise: ReturnType<typeof createFirestoreDeps> | null = null;

const loadFirestoreDeps = () => {
  firestoreDepsPromise ??= createFirestoreDeps();
  return firestoreDepsPromise;
};

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

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const createSnapshotRevision = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `revision-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const mergeByBaseline = <T,>(baseline: T | null | undefined, localValue: T, cloudValue: T): T => {
  if (baseline === null || baseline === undefined) return localValue;
  return stableSerialize(localValue) === stableSerialize(baseline) ? cloudValue : localValue;
};

const replaceChunkedCollection = async <T,>(uid: string, name: string, items: T[], revision: string) => {
  const { db, collection, doc, getDocs, writeBatch } = await loadFirestoreDeps();
  const collectionRef = collection(db, PAYLOAD_COLLECTION, uid, name);
  const existing = await getDocs(collectionRef);
  const batch = writeBatch(db);

  existing.docs.forEach(snapshot => {
    batch.delete(snapshot.ref);
  });

  chunkArray(items, CHUNK_SIZE).forEach((chunk, index) => {
    batch.set(doc(db, PAYLOAD_COLLECTION, uid, name, String(index).padStart(4, '0')), {
      index,
      revision,
      items: sanitizeData(chunk)
    });
  });

  if (!existing.empty || items.length > 0) {
    await batch.commit();
  }
};

const touchChunkedCollectionRevision = async (uid: string, name: string, revision: string) => {
  const { db, collection, getDocs, writeBatch } = await loadFirestoreDeps();
  const collectionRef = collection(db, PAYLOAD_COLLECTION, uid, name);
  const existing = await getDocs(collectionRef);
  if (existing.empty) return;

  const batch = writeBatch(db);
  existing.docs.forEach(snapshot => {
    batch.update(snapshot.ref, { revision });
  });
  await batch.commit();
};

const readChunkedCollection = async <T,>(
  uid: string,
  name: string,
  expectedRevision?: string
): Promise<ChunkedCollectionRead<T>> => {
  const { db, collection, getDocs } = await loadFirestoreDeps();
  const collectionRef = collection(db, PAYLOAD_COLLECTION, uid, name);
  const snap = await getDocs(collectionRef);
  if (snap.empty) return { status: 'missing' };
  const docs = snap.docs.slice().sort((a, b) => {
    const aData = a.data() as ChunkedPayloadDoc;
    const bData = b.data() as ChunkedPayloadDoc;
    const ai = typeof aData.index === 'number' ? aData.index : Number(a.id);
    const bi = typeof bData.index === 'number' ? bData.index : Number(b.id);
    return ai - bi;
  });
  const items: T[] = [];
  let detectedRevision: string | null = null;
  for (const docSnap of docs) {
    const data = docSnap.data() as ChunkedPayloadDoc;
    const docRevision = typeof data.revision === 'string' ? data.revision : null;
    if (!docRevision) {
      return { status: 'invalid' };
    }
    if (expectedRevision) {
      if (docRevision !== expectedRevision) {
        return { status: 'invalid' };
      }
    } else {
      if (detectedRevision === null) {
        detectedRevision = docRevision;
      } else if (detectedRevision !== docRevision) {
        return { status: 'invalid' };
      }
    }
    if (Array.isArray(data.items)) {
      items.push(...(data.items as T[]));
    } else {
      return { status: 'invalid' };
    }
  }
  if (items.length === 0 && snap.size > 0) return { status: 'invalid' };
  return { status: 'ok', items };
};

const getPayloadCounts = (value: unknown): PayloadCounts => {
  if (!value || typeof value !== 'object') return {};
  const source = value as Record<string, unknown>;
  return {
    subjects: typeof source.subjects === 'number' && Number.isFinite(source.subjects) ? source.subjects : undefined,
    classrooms: typeof source.classrooms === 'number' && Number.isFinite(source.classrooms) ? source.classrooms : undefined,
    allocations: typeof source.allocations === 'number' && Number.isFinite(source.allocations) ? source.allocations : undefined
  };
};

const matchesPayloadCount = <T,>(read: ChunkedCollectionRead<T>, expectedCount?: number) => {
  if (expectedCount === undefined) return true;
  if (read.status === 'invalid') return false;
  if (read.status === 'missing') return expectedCount === 0;
  return read.items.length === expectedCount;
};

const loadLegacyCloudData = async (uid: string): Promise<CloudData | null> => {
  const { db, doc, getDoc } = await loadFirestoreDeps();
  const legacyRef = doc(db, 'user_data', uid);
  const legacySnap = await getDoc(legacyRef);
  if (!legacySnap.exists()) return null;
  const data = legacySnap.data();
  if (data && typeof data === 'object' && 'data' in data) {
    return (data.data as CloudData) ?? null;
  }
  return null;
};

const waitForUnlockedMeta = async (uid: string, sessionId: string) => {
  const { db, doc, getDoc } = await loadFirestoreDeps();
  const lockRef = doc(db, META_COLLECTION, uid);
  for (let attempt = 0; attempt < CLOUD_SYNC_WAIT_MAX_ATTEMPTS; attempt += 1) {
    const snap = await getDoc(lockRef);
    if (!snap.exists()) return null;
    const current = snap.data() as Partial<WriteLockDoc>;
    const expiresAt = typeof current.lockExpiresAt === 'number' ? current.lockExpiresAt : 0;
    const lockedSessionId = typeof current.lockSessionId === 'string' ? current.lockSessionId : '';
    if (lockedSessionId === sessionId || expiresAt <= Date.now()) {
      return current as Partial<WriteLockDoc>;
    }
    await delay(CLOUD_SYNC_WAIT_MS);
  }
  throw new Error('WRITE_LOCKED');
};

export const useCloudSync = (user: User | null) => {
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const lastCloudRevisionRef = useRef<string | null>(null);
  const lastCloudSnapshotRef = useRef<CloudData | null>(null);
  const lastLocalBaselineRef = useRef<CloudData | null>(null);

  const acquireWriteLock = useCallback(async () => {
    const { auth, db, doc, runTransaction } = await loadFirestoreDeps();
    const currentUser = user || auth.currentUser;
    if (!currentUser) return null;

    const sessionId = getWriteSessionId();
    const lockRef = doc(db, META_COLLECTION, currentUser.uid);
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

  const markLocalBaseline = useCallback((snapshot: CloudData | null) => {
    lastLocalBaselineRef.current = snapshot;
  }, []);

  const releaseWriteLock = useCallback(async () => {
    const { auth, db, deleteField, doc, runTransaction } = await loadFirestoreDeps();
    const currentUser = user || auth.currentUser;
    if (!currentUser) return;

    const sessionId = getWriteSessionId();
    const lockRef = doc(db, META_COLLECTION, currentUser.uid);

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

  const readCloudSnapshot = useCallback(async (): Promise<CloudSnapshotRead> => {
    const { auth, db, doc, getDoc } = await loadFirestoreDeps();
    const currentUser = user || auth.currentUser;
    if (!currentUser) return { status: 'empty' };
    try {
      const metaRef = doc(db, META_COLLECTION, currentUser.uid);
      const sessionId = getWriteSessionId();
      await waitForUnlockedMeta(currentUser.uid, sessionId);
      const metaSnap = await getDoc(metaRef);
      const metaData = metaSnap.exists() ? (metaSnap.data() as CloudMetaDoc) : null;
      const expectedRevision = typeof metaData?.snapshotRevision === 'string' ? metaData.snapshotRevision : undefined;

      const [subjectsRead, classroomsRead, allocationsRead, legacyData] = await Promise.all([
        readChunkedCollection(currentUser.uid, 'subjects', expectedRevision),
        readChunkedCollection(currentUser.uid, 'classrooms', expectedRevision),
        readChunkedCollection(currentUser.uid, 'allocations', expectedRevision),
        loadLegacyCloudData(currentUser.uid)
      ]);

      const configSnap = await getDoc(doc(db, PAYLOAD_COLLECTION, currentUser.uid, 'config', CONFIG_DOC_ID));
      const chunkedReads = [subjectsRead, classroomsRead, allocationsRead];
      if (chunkedReads.some(result => result.status === 'invalid')) {
        return { status: 'invalid' };
      }

      const hasChunkedSnapshot = chunkedReads.some(result => result.status === 'ok') || configSnap.exists();
      if (expectedRevision && !hasChunkedSnapshot) {
        return { status: 'invalid' };
      }

      if (hasChunkedSnapshot) {
        const configData = configSnap.exists() ? configSnap.data() : {};
        if (expectedRevision) {
          const configRevision = typeof configData.revision === 'string' ? configData.revision : undefined;
          if (!configSnap.exists() || configRevision !== expectedRevision) {
            return { status: 'invalid' };
          }
        }
        const payloadCounts = getPayloadCounts(configData.payloadCounts);
        if (
          !matchesPayloadCount(subjectsRead, payloadCounts.subjects) ||
          !matchesPayloadCount(classroomsRead, payloadCounts.classrooms) ||
          !matchesPayloadCount(allocationsRead, payloadCounts.allocations)
        ) {
          return { status: 'invalid' };
        }
        return {
          status: 'ok',
          snapshot: {
            data: {
              subjects: (subjectsRead.status === 'ok' ? subjectsRead.items : []) as CloudData['subjects'],
              classrooms: (classroomsRead.status === 'ok' ? classroomsRead.items : []) as CloudData['classrooms'],
              allocations: (allocationsRead.status === 'ok' ? allocationsRead.items : []) as CloudData['allocations'],
              settings: (configData.settings ?? []) as CloudData['settings'],
              equipmentSettings: (configData.equipmentSettings ?? {}) as CloudData['equipmentSettings'],
              subjectTaxonomy: (configData.subjectTaxonomy ?? {}) as CloudData['subjectTaxonomy']
            },
            revision: expectedRevision ?? (typeof metaData?.snapshotRevision === 'string' ? metaData.snapshotRevision : null)
          }
        };
      }

      if (legacyData) {
        return {
          status: 'ok',
          snapshot: {
            data: legacyData,
            revision: null
          }
        };
      }

      return { status: 'empty' };
    } catch (error) {
      console.error('Failed to refresh data:', error);
      throw error;
    }
  }, [user]);

  const saveData = useCallback(async (data: CloudData) => {
    const { auth, db, doc, setDoc } = await loadFirestoreDeps();
    const currentUser = user || auth.currentUser;
    if (!currentUser) return false;

    await acquireWriteLock();
    try {
      const metaRef = doc(db, META_COLLECTION, currentUser.uid);
      const now = Date.now();
      const revision = createSnapshotRevision();
      const currentCloudRead = await readCloudSnapshot();
      if (currentCloudRead.status === 'invalid') {
        throw new Error(CLOUD_SNAPSHOT_INVALID_MESSAGE);
      }
      const currentCloud = currentCloudRead.status === 'ok' ? currentCloudRead.snapshot.data : null;
      const baselineCloud = lastLocalBaselineRef.current ?? currentCloud;
      const nextData: CloudData = {
        subjects: mergeByBaseline(
          baselineCloud?.subjects,
          data.subjects,
          currentCloud?.subjects ?? data.subjects
        ),
        classrooms: mergeByBaseline(
          baselineCloud?.classrooms,
          data.classrooms,
          currentCloud?.classrooms ?? data.classrooms
        ),
        allocations: currentCloud
          ? mergeAllocationsBySubjectBaseline(
              baselineCloud?.allocations ?? currentCloud.allocations,
              data.allocations,
              currentCloud.allocations
            )
          : data.allocations,
        settings: mergeByBaseline(
          baselineCloud?.settings,
          data.settings,
          currentCloud?.settings ?? data.settings
        ),
        equipmentSettings: mergeByBaseline(
          baselineCloud?.equipmentSettings,
          data.equipmentSettings,
          currentCloud?.equipmentSettings ?? data.equipmentSettings
        ),
        subjectTaxonomy: mergeByBaseline(
          baselineCloud?.subjectTaxonomy,
          data.subjectTaxonomy,
          currentCloud?.subjectTaxonomy ?? data.subjectTaxonomy
        )
      };
      const shouldWriteSubjects = !currentCloud || stableSerialize(currentCloud.subjects) !== stableSerialize(nextData.subjects);
      const shouldWriteClassrooms = !currentCloud || stableSerialize(currentCloud.classrooms) !== stableSerialize(nextData.classrooms);
      const shouldWriteAllocations = !currentCloud || stableSerialize(currentCloud.allocations) !== stableSerialize(nextData.allocations);
      const shouldWriteConfig =
        !currentCloud ||
        stableSerialize(currentCloud.settings) !== stableSerialize(nextData.settings) ||
        stableSerialize(currentCloud.equipmentSettings) !== stableSerialize(nextData.equipmentSettings) ||
        stableSerialize(currentCloud.subjectTaxonomy) !== stableSerialize(nextData.subjectTaxonomy);

      const hasAnyChange =
        shouldWriteSubjects ||
        shouldWriteClassrooms ||
        shouldWriteAllocations ||
        shouldWriteConfig;

      if (!hasAnyChange) {
        setLastSynced(new Date());
        return false;
      }

      if (shouldWriteSubjects) {
        await replaceChunkedCollection(currentUser.uid, 'subjects', Array.isArray(nextData.subjects) ? nextData.subjects : [], revision);
      } else if (currentCloud) {
        await touchChunkedCollectionRevision(currentUser.uid, 'subjects', revision);
      }
      if (shouldWriteClassrooms) {
        await replaceChunkedCollection(currentUser.uid, 'classrooms', Array.isArray(nextData.classrooms) ? nextData.classrooms : [], revision);
      } else if (currentCloud) {
        await touchChunkedCollectionRevision(currentUser.uid, 'classrooms', revision);
      }
      if (shouldWriteAllocations) {
        await replaceChunkedCollection(currentUser.uid, 'allocations', Array.isArray(nextData.allocations) ? nextData.allocations : [], revision);
      } else if (currentCloud) {
        await touchChunkedCollectionRevision(currentUser.uid, 'allocations', revision);
      }

      if (hasAnyChange) {
        const configRef = doc(db, PAYLOAD_COLLECTION, currentUser.uid, 'config', CONFIG_DOC_ID);
        await setDoc(configRef, {
          revision,
          settings: sanitizeData(nextData.settings),
          equipmentSettings: sanitizeData(nextData.equipmentSettings),
          subjectTaxonomy: sanitizeData(nextData.subjectTaxonomy),
          payloadCounts: sanitizeData({
            subjects: Array.isArray(nextData.subjects) ? nextData.subjects.length : 0,
            classrooms: Array.isArray(nextData.classrooms) ? nextData.classrooms.length : 0,
            allocations: Array.isArray(nextData.allocations) ? nextData.allocations.length : 0
          }),
          updatedAt: now,
          schemaVersion: SCHEMA_VERSION
        }, { merge: true });
      }

      await setDoc(metaRef, {
        snapshotRevision: revision,
        lastUpdated: now,
        createdAt: now,
        email: currentUser.email ?? null,
        schemaVersion: SCHEMA_VERSION
      }, { merge: true });

      setLastSynced(new Date());
      lastCloudRevisionRef.current = revision;
      lastCloudSnapshotRef.current = nextData;
      lastLocalBaselineRef.current = nextData;
      return true;
    } catch (error) {
      console.error('Failed to save data:', error);
      throw error;
    } finally {
      await releaseWriteLock();
    }
  }, [user, acquireWriteLock, releaseWriteLock, readCloudSnapshot]);

  const refreshData = useCallback(async (): Promise<CloudData | null> => {
    const cloudSnapshotRead = await readCloudSnapshot();
    if (cloudSnapshotRead.status === 'invalid') {
      throw new Error(CLOUD_SNAPSHOT_INVALID_MESSAGE);
    }
    if (cloudSnapshotRead.status === 'ok') {
      const cloudSnapshot = cloudSnapshotRead.snapshot;
      setLastSynced(new Date());
      lastCloudRevisionRef.current = cloudSnapshot.revision;
      lastCloudSnapshotRef.current = cloudSnapshot.data;
      return cloudSnapshot.data;
    }
    lastCloudRevisionRef.current = null;
    lastCloudSnapshotRef.current = null;
    return null;
  }, [readCloudSnapshot]);

  return {
    lastSynced,
    saveData,
    refreshData,
    markLocalBaseline
  };
};
