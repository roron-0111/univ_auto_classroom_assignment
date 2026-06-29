import { auth, getDb } from './firebase';

const PAYLOAD_COLLECTION = 'user_data_payload';
const MANUAL_COLLECTION = 'manual';
const MANUAL_DOC_ID = 'main';
const MANUAL_SCHEMA_VERSION = 2;

export type ManualSection = {
  id: string;
  title: string;
  summary: string;
  when: string;
  steps: string[];
  controls: string[];
  notes: string[];
  keywords?: string[];
};

export type ManualDocument = {
  schemaVersion: number;
  title: string;
  lead: string;
  sections: ManualSection[];
};

const loadManualDeps = async () => {
  const [db, firestore] = await Promise.all([
    getDb(),
    import('firebase/firestore')
  ]);
  return {
    db,
    doc: firestore.doc,
    getDoc: firestore.getDoc,
    setDoc: firestore.setDoc
  };
};

const getManualRef = async () => {
  const currentUser = auth.currentUser;
  if (!currentUser) return null;
  const { db, doc, getDoc, setDoc } = await loadManualDeps();
  return {
    ref: doc(db, PAYLOAD_COLLECTION, currentUser.uid, MANUAL_COLLECTION, MANUAL_DOC_ID),
    getDoc,
    setDoc
  };
};

export const readManualContent = async () => {
  const manual = await readManualDocument();
  return manual ? manualDocumentToText(manual) : null;
};

export const saveManualContent = async (content: string) => {
  await saveManualDocument(contentToManualDocument(content));
};

export const readManualDocument = async (): Promise<ManualDocument | null> => {
  const manualRef = await getManualRef();
  if (!manualRef) return null;
  const snap = await manualRef.getDoc(manualRef.ref);
  if (!snap.exists()) return null;
  const data = snap.data() as {
    schemaVersion?: unknown;
    title?: unknown;
    lead?: unknown;
    sections?: unknown;
    content?: unknown;
  };
  const sections = Array.isArray(data.sections)
    ? data.sections
        .map(normalizeManualSection)
        .filter((section): section is ManualSection => section !== null)
    : [];

  if (sections.length > 0) {
    return {
      schemaVersion: MANUAL_SCHEMA_VERSION,
      title: typeof data.title === 'string' && data.title.trim() ? data.title.trim() : '教室配当マニュアル',
      lead: typeof data.lead === 'string' ? data.lead.trim() : '',
      sections
    };
  }

  return typeof data.content === 'string' && data.content.trim()
    ? contentToManualDocument(data.content)
    : null;
};

export const saveManualDocument = async (manual: ManualDocument) => {
  const manualRef = await getManualRef();
  if (!manualRef) {
    throw new Error('ログイン後に保存してください。');
  }
  const normalized = normalizeManualDocument(manual);
  await manualRef.setDoc(manualRef.ref, {
    ...normalized,
    schemaVersion: MANUAL_SCHEMA_VERSION,
    updatedAt: new Date().toISOString()
  }, { merge: true });
};

const normalizeStringList = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map(item => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean);
};

const normalizeManualSection = (value: unknown, index: number): ManualSection | null => {
  if (!value || typeof value !== 'object') return null;
  const section = value as Partial<ManualSection>;
  const title = typeof section.title === 'string' ? section.title.trim() : '';
  if (!title) return null;
  const id = typeof section.id === 'string' && section.id.trim()
    ? section.id.trim()
    : `section-${index + 1}`;
  return {
    id,
    title,
    summary: typeof section.summary === 'string' ? section.summary.trim() : '',
    when: typeof section.when === 'string' ? section.when.trim() : '',
    steps: normalizeStringList(section.steps),
    controls: normalizeStringList(section.controls),
    notes: normalizeStringList(section.notes),
    keywords: normalizeStringList(section.keywords)
  };
};

const normalizeManualDocument = (manual: ManualDocument): ManualDocument => {
  const sections = manual.sections
    .map(normalizeManualSection)
    .filter((section): section is ManualSection => section !== null);
  if (sections.length === 0) {
    throw new Error('マニュアル項目を1件以上入力してください。');
  }
  return {
    schemaVersion: MANUAL_SCHEMA_VERSION,
    title: manual.title.trim() || '教室配当マニュアル',
    lead: manual.lead.trim(),
    sections
  };
};

const contentToManualDocument = (content: string): ManualDocument => {
  const sections: ManualSection[] = [];
  let title = '教室配当マニュアル';
  let current: ManualSection | null = null;
  const ensureCurrent = () => {
    if (current) return current;
    current = {
      id: 'legacy',
      title: '以前のマニュアル',
      summary: '',
      when: '',
      steps: [],
      controls: [],
      notes: [],
      keywords: []
    };
    return current;
  };
  const pushCurrent = () => {
    if (!current) return;
    sections.push({
      ...current,
      summary: current.summary.trim()
    });
    current = null;
  };

  content.split(/\r?\n/).forEach(rawLine => {
    const line = rawLine.trim();
    if (!line) return;
    if (line.startsWith('# ')) {
      title = line.replace(/^#\s*/, '').trim() || title;
      return;
    }
    if (line.startsWith('## ')) {
      pushCurrent();
      current = {
        id: `legacy-${sections.length + 1}`,
        title: line.replace(/^##\s*/, '').trim() || `項目 ${sections.length + 1}`,
        summary: '',
        when: '',
        steps: [],
        controls: [],
        notes: [],
        keywords: []
      };
      return;
    }
    if (line.startsWith('- ')) {
      ensureCurrent().steps.push(line.replace(/^-\s*/, '').trim());
      return;
    }
    const target = ensureCurrent();
    target.summary = target.summary ? `${target.summary}\n${line}` : line;
  });
  pushCurrent();

  return {
    schemaVersion: MANUAL_SCHEMA_VERSION,
    title,
    lead: '以前の形式で保存されたマニュアルです。必要に応じて項目ごとに編集してください。',
    sections: sections.length > 0
      ? sections
      : [{
          id: 'legacy',
          title: '以前のマニュアル',
          summary: content.trim(),
          when: '',
          steps: [],
          controls: [],
          notes: [],
          keywords: []
        }]
  };
};

const manualDocumentToText = (manual: ManualDocument) => [
  `# ${manual.title}`,
  manual.lead,
  ...manual.sections.flatMap(section => [
    '',
    `## ${section.title}`,
    section.summary,
    section.when ? `使う場面: ${section.when}` : '',
    ...section.steps.map(step => `- ${step}`),
    section.controls.length ? `関連ボタン: ${section.controls.join('、')}` : '',
    ...section.notes.map(note => `注意: ${note}`)
  ])
].filter(Boolean).join('\n');
