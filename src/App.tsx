import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import './App.css';
import type { Classroom, Subject, Allocation, Term, DayOfWeek, Period, DisplayConfig, AllocationRule, Building, UnassignedInfo, OptimizerResult, PendingException, RelocationResult, EquipmentSettings } from './types';
import { BUILDINGS, DAY_LABELS, sortBuildingsByCanonicalOrder } from './types';
import { TimeTableGrid } from './components/TimeTableGrid';
import { UnassignedList, type UnassignedListItem } from './components/UnassignedList';
import { ClassroomManager } from './components/ClassroomManager';
import { DisplaySettings } from './components/DisplaySettings';
import { runAutoAllocation, relocateForUnassigned, resolveExceptions } from './utils/optimizer';
import { SubjectManager } from './components/SubjectManager';
import { SubjectEditModal } from './components/SubjectEditModal';
import { ClassroomEditModal } from './components/ClassroomEditModal';
import { AllocationRuleSettings } from './components/AllocationRuleSettings';
import { AllocationResultModal } from './components/AllocationResultModal';
import { ExceptionReviewModal } from './components/ExceptionReviewModal';
import { RelocationPreviewModal } from './components/RelocationPreviewModal';
import { CloudReadWarningModal } from './components/CloudReadWarningModal';
import { DEFAULT_ALLOCATION_RULES, DEFAULT_EQUIPMENT_SETTINGS, EQUIPMENT_LIST, migrateAllocationRules, normalizeEquipmentName, normalizeCampusLabel, getCampusLabelFromEmail } from './types';
import type { AllocationOptions } from './types';
import { buildDifficultyRanking, computeDifficulty, formatDifficultySummary, type DifficultyEntry } from './utils/difficulty';
import { buildApprovalKey } from './utils/approvalKey';
import {
  SUBJECT_EQUIPMENT_CHOICES,
  filterVisibleRoomEquipment,
  sanitizeSubjectEquipmentList,
  sortEquipmentByCanonicalOrder
} from './utils/equipmentVisibility';
import { getDefaultSubjectTaxonomy, normalizeSubjectTaxonomy, type SubjectTaxonomy } from './utils/subjectTaxonomy';
import { exportToCSV } from './utils/csvParser';

// Cloud Sync
import { CloudConnectionModal } from './components/CloudConnectionModal';
import { useAuth } from './utils/useAuth';
import { useCloudSync } from './utils/useCloudSync';
import type { CloudData } from './types_cloud';
import { clearStreakMap, loadStreakMap, pruneStreakMap, updateStreakAfterAllocation } from './utils/unassignedStreak';
import { buildCloudDiffCsv as buildCloudDiffCsvRows, compareCloudSnapshots, type CloudWriteWarningSummary } from './utils/cloudDiff';

// Icons
import {
  RefreshCw, Settings, BookOpen, Eye, Calendar,
  AlertTriangle, ListChecks, CloudUpload, CloudDownload, LogOut
} from 'lucide-react';

const DAYS: DayOfWeek[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const DEFAULT_DISPLAY_CONFIG: DisplayConfig = {
  showCapacity: true,
  showExamCapacity: true,
  showRoomType: true,
  subjectMainDisplay: 'name',
  showSubInfo: true,
  showPreviousRooms: true,
  showRequirementTags: true,
  showAllocationProgress: true,
  showContinuityHighlight: true,
  showViolationAlerts: true,
  highlightedEquipment: []
};
const SHOW_DISPLAY_SETTINGS_BUTTON = false;
const DEFAULT_CAMPUS_LABEL = '八景';

const isTerm = (value: unknown): value is Term =>
  value === 'spring' || value === 'spring_first' || value === 'spring_second' ||
  value === 'autumn' || value === 'autumn_first' || value === 'autumn_second' ||
  value === 'full_year';

const isDayOfWeek = (value: unknown): value is DayOfWeek =>
  value === 'mon' || value === 'tue' || value === 'wed' ||
  value === 'thu' || value === 'fri' || value === 'sat';

const isPeriod = (value: unknown): value is Period =>
  value === 1 || value === 2 || value === 3 || value === 4 || value === 5 || value === 6 || value === 7;

const normalizeDisplayConfig = (value: unknown): DisplayConfig => {
  if (!value || typeof value !== 'object') return DEFAULT_DISPLAY_CONFIG;
  const raw = value as Partial<DisplayConfig> & { highlightedEquipment?: unknown };
  return {
    ...DEFAULT_DISPLAY_CONFIG,
    ...raw,
    highlightedEquipment: Array.isArray(raw.highlightedEquipment)
      ? raw.highlightedEquipment.filter((item): item is string => typeof item === 'string')
      : DEFAULT_DISPLAY_CONFIG.highlightedEquipment
  };
};

const normalizeClassroom = (value: unknown, fallbackCampusLabel = DEFAULT_CAMPUS_LABEL): Classroom | null => {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Partial<Classroom> & { equipment?: unknown };
  const equipment = Array.isArray(raw.equipment)
    ? raw.equipment.filter((item): item is string => typeof item === 'string').map(normalizeEquipmentName)
    : [];
  if (typeof raw.id !== 'string' || typeof raw.name !== 'string') return null;
  return {
    id: raw.id,
    name: raw.name,
    campus: normalizeCampusLabel(raw.campus || fallbackCampusLabel) || fallbackCampusLabel,
    building: typeof raw.building === 'string' ? raw.building : '未設定',
    capacity: typeof raw.capacity === 'number' ? raw.capacity : 0,
    examCapacity: typeof raw.examCapacity === 'number' ? raw.examCapacity : undefined,
    type: raw.type === 'normal' || raw.type === 'pc' || raw.type === 'seminar' || raw.type === 'other' ? raw.type : 'other',
    isMovable: Boolean(raw.isMovable),
    equipment,
    isExcluded: Boolean(raw.isExcluded)
  };
};

const normalizeSubject = (value: unknown): Subject | null => {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Partial<Subject> & {
    teacherCode?: unknown;
    previousRooms?: unknown;
    requiredEquipment?: unknown;
    mandatoryEquipment?: unknown;
  };
  if (typeof raw.id !== 'string' || typeof raw.name !== 'string') return null;
  return {
    id: raw.id,
    code: typeof raw.code === 'string' ? raw.code : '',
    name: raw.name,
    teacherCode: typeof raw.teacherCode === 'string' ? raw.teacherCode : '',
    teacher: typeof raw.teacher === 'string' ? raw.teacher : '',
    faculty: typeof raw.faculty === 'string' ? raw.faculty : '',
    department: typeof raw.department === 'string' ? raw.department : '',
    term: isTerm(raw.term) ? raw.term : 'spring',
    day: isDayOfWeek(raw.day) ? raw.day : 'mon',
    period: isPeriod(raw.period) ? raw.period : 1,
    endPeriod: isPeriod(raw.endPeriod) ? raw.endPeriod : undefined,
    requiredCapacity: typeof raw.requiredCapacity === 'number' ? raw.requiredCapacity : 0,
    campus: typeof raw.campus === 'string' ? raw.campus : '',
    previousRooms: Array.isArray(raw.previousRooms)
      ? raw.previousRooms.filter((item): item is string => typeof item === 'string')
      : undefined,
    preferredRoomType: raw.preferredRoomType === 'normal' || raw.preferredRoomType === 'pc' || raw.preferredRoomType === 'seminar'
      ? raw.preferredRoomType
      : undefined,
    requiresProjector: Boolean(raw.requiresProjector),
    requiresMovable: Boolean(raw.requiresMovable),
    requiredEquipment: sanitizeSubjectEquipmentList(raw.requiredEquipment),
    mandatoryEquipment: sanitizeSubjectEquipmentList(raw.mandatoryEquipment),
    isContinuous: Boolean(raw.isContinuous),
    linkedSubjectId: typeof raw.linkedSubjectId === 'string' ? raw.linkedSubjectId : undefined,
    priority: typeof raw.priority === 'number' ? raw.priority : 1,
    buildingPreference: typeof raw.buildingPreference === 'string' ? raw.buildingPreference : undefined,
    requiredRoomCount: typeof raw.requiredRoomCount === 'number' && raw.requiredRoomCount > 0 ? raw.requiredRoomCount : 1,
    _realId: typeof raw._realId === 'string' ? raw._realId : undefined
  };
};

const normalizeSubjects = (value: unknown): Subject[] => {
  if (!Array.isArray(value)) return [];
  const items = value.map(normalizeSubject).filter((item): item is Subject => item !== null);
  return items.length > 0 ? items : [];
};

const normalizeSubjectsForCampus = (value: unknown, fallbackCampusLabel = DEFAULT_CAMPUS_LABEL): Subject[] => {
  const normalizedCampus = normalizeCampusLabel(fallbackCampusLabel) || DEFAULT_CAMPUS_LABEL;
  return normalizeSubjects(value).map(subject => ({
    ...subject,
    campus: normalizeCampusLabel(subject.campus || normalizedCampus) || normalizedCampus
  }));
};

const normalizeSubjectTaxonomyForCampus = (value: unknown, fallbackCampusLabel = DEFAULT_CAMPUS_LABEL): SubjectTaxonomy => {
  const campusLabel = normalizeCampusLabel(fallbackCampusLabel) || DEFAULT_CAMPUS_LABEL;
  return normalizeSubjectTaxonomy(value, campusLabel);
};

const normalizeClassrooms = (rooms: Classroom[], fallbackCampusLabel = DEFAULT_CAMPUS_LABEL): Classroom[] =>
  rooms.map(r => ({
    ...r,
    campus: normalizeCampusLabel(r.campus || fallbackCampusLabel) || fallbackCampusLabel,
    equipment: r.equipment.map(eq => eq === 'ﾀｯﾁﾃﾞｨｽﾌﾟﾚｲ' ? 'タッチディスプレイ' : eq)
  }));

const getScopedStorageKey = (campusLabel: string, key: string) => {
  const normalizedCampus = normalizeCampusLabel(campusLabel) || DEFAULT_CAMPUS_LABEL;
  return `campus:${normalizedCampus}:${key}`;
};

const readScopedStorage = (campusLabel: string, key: string) => {
  const scopedKey = getScopedStorageKey(campusLabel, key);
  const scopedValue = localStorage.getItem(scopedKey);
  if (scopedValue !== null) return scopedValue;
  if (normalizeCampusLabel(campusLabel) === DEFAULT_CAMPUS_LABEL) {
    const legacyValue = localStorage.getItem(key);
    if (legacyValue !== null) {
      localStorage.setItem(scopedKey, legacyValue);
      return legacyValue;
    }
  }
  return null;
};

const writeScopedStorage = (campusLabel: string, key: string, value: string) => {
  localStorage.setItem(getScopedStorageKey(campusLabel, key), value);
};

const hasScopedLocalCampusData = (campusLabel: string) => {
  const keys = [
    'classrooms',
    'subjects',
    'allocations',
    'allocationSettings',
    'equipmentSettings',
    'displayConfig',
    'subjectTaxonomy'
  ];
  return keys.some(key => readScopedStorage(campusLabel, key) !== null);
};

const parseJsonOrNull = <T,>(raw: string | null): T | null => {
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

const loadCampusLocalState = (campusLabel: string) => {
  const normalizedCampus = normalizeCampusLabel(campusLabel) || DEFAULT_CAMPUS_LABEL;

  const classroomsRaw = readScopedStorage(normalizedCampus, 'classrooms');
  const classroomsParsed = parseJsonOrNull<unknown[]>(classroomsRaw);
  const classrooms = Array.isArray(classroomsParsed)
    ? normalizeClassrooms(
        classroomsParsed.map(item => normalizeClassroom(item, normalizedCampus)).filter((item): item is Classroom => item !== null),
        normalizedCampus
      )
    : [];

  const subjectsRaw = readScopedStorage(normalizedCampus, 'subjects');
  const subjectsParsed = parseJsonOrNull<unknown>(subjectsRaw);
  const subjects = subjectsParsed ? normalizeSubjectsForCampus(subjectsParsed, normalizedCampus) : [];

  const allocationsRaw = readScopedStorage(normalizedCampus, 'allocations');
  const allocationsParsed = parseJsonOrNull<unknown>(allocationsRaw);
  const allocations = allocationsParsed ? normalizeAllocationsForPhase6(allocationsParsed) : [];

  const allocationSettingsRaw = readScopedStorage(normalizedCampus, 'allocationSettings');
  const allocationSettingsParsed = parseJsonOrNull<unknown[]>(allocationSettingsRaw);
  const allocationSettings = allocationSettingsRaw
    ? migrateAllocationRules(allocationSettingsParsed ?? undefined)
    : DEFAULT_ALLOCATION_RULES;

  const equipmentSettingsRaw = readScopedStorage(normalizedCampus, 'equipmentSettings');
  const equipmentSettingsParsed = parseJsonOrNull<unknown>(equipmentSettingsRaw);
  const equipmentSettings = equipmentSettingsRaw
    ? normalizeEquipmentSettings(equipmentSettingsParsed)
    : DEFAULT_EQUIPMENT_SETTINGS;

  const displayConfigRaw = readScopedStorage(normalizedCampus, 'displayConfig');
  const displayConfigParsed = parseJsonOrNull<unknown>(displayConfigRaw);
  const displayConfig = displayConfigRaw
    ? normalizeDisplayConfig(displayConfigParsed)
    : DEFAULT_DISPLAY_CONFIG;

  const subjectTaxonomyRaw = readScopedStorage(normalizedCampus, 'subjectTaxonomy');
  const subjectTaxonomyParsed = parseJsonOrNull<unknown>(subjectTaxonomyRaw);
  const subjectTaxonomy = subjectTaxonomyRaw
    ? normalizeSubjectTaxonomyForCampus(subjectTaxonomyParsed, normalizedCampus)
    : getDefaultSubjectTaxonomy(normalizedCampus);

  return {
    classrooms,
    subjects,
    allocations,
    allocationSettings,
    equipmentSettings,
    displayConfig,
    subjectTaxonomy
  };
};

const getMissingSubjectFields = (subject: Subject) => {
  const missing: string[] = [];
  if (!subject.code?.trim()) missing.push('時間割コード');
  if (!subject.name?.trim()) missing.push('時間割名称');
  if (!subject.teacherCode?.trim()) missing.push('教員コード');
  if (!subject.teacher?.trim()) missing.push('教員名');
  if (!subject.faculty?.trim()) missing.push('開講学部');
  if (!subject.department?.trim()) missing.push('管轄学科');
  if (!subject.term) missing.push('配当期');
  if (!subject.day) missing.push('曜日');
  if (!subject.period) missing.push('講時');
  if (!subject.requiredCapacity || subject.requiredCapacity <= 0) missing.push('履修予定人数');
  return missing;
};

const validateSubjectsForAutoAllocation = (targetSubjects: Subject[]) => {
  const issues = targetSubjects
    .map(subject => ({ subject, missing: getMissingSubjectFields(subject) }))
    .filter(issue => issue.missing.length > 0);

  if (issues.length === 0) return true;

  const lines = issues.slice(0, 8).map(issue => {
    const label = issue.subject.code?.trim() || issue.subject.name?.trim() || issue.subject.id;
    return `・${label}: ${issue.missing.join('、')}`;
  });

  if (issues.length > 8) {
    lines.push(`・ほか ${issues.length - 8} 件`);
  }

  alert(`必須項目が未入力のレコードがあります。確認してください。\n${lines.join('\n')}`);
  return false;
};

const validateCampusScopeForOperation = (
  operationLabel: string,
  campusLabel: string,
  classrooms: Classroom[],
  subjects: Subject[]
) => {
  const normalizedCampus = normalizeCampusLabel(campusLabel) || DEFAULT_CAMPUS_LABEL;
  const classroomMismatch = classrooms.some(room => normalizeCampusLabel(room.campus || normalizedCampus) !== normalizedCampus);
  const subjectMismatch = subjects.some(subject => normalizeCampusLabel(subject.campus || normalizedCampus) !== normalizedCampus);

  if (classroomMismatch || subjectMismatch) {
    alert(`${operationLabel}を実行できません。現在のキャンパス以外のデータが含まれています。`);
    return false;
  }

  return true;
};

const normalizeEquipmentSettings = (value: unknown): EquipmentSettings => {
  if (!value || typeof value !== 'object') return DEFAULT_EQUIPMENT_SETTINGS;
  const raw = value as { items?: unknown; strictLevel5?: unknown };
  const items: EquipmentSettings['items'] = raw.items && typeof raw.items === 'object' && !Array.isArray(raw.items)
    ? Object.fromEntries(
        Object.entries(raw.items as Record<string, unknown>).map(([key, item]) => {
          const current = item && typeof item === 'object' ? item as { enabled?: unknown; importance?: unknown } : {};
          return [
            key,
            {
              enabled: Boolean(current.enabled),
              importance: typeof current.importance === 'number' ? current.importance : 3
            }
          ];
        })
      )
    : DEFAULT_EQUIPMENT_SETTINGS.items;
  return {
    items,
    strictLevel5: Boolean(raw.strictLevel5)
  };
};

type AutoAllocationSummary = {
  targetCount: number;
  preservedCount: number;
  newlyAllocatedCount: number;
  unassigned: UnassignedInfo[];
  difficultyTop10: DifficultyEntry[];
};

type PendingAllocationBatch = {
  result: OptimizerResult;
  targetCount: number;
  preservedCount: number;
  pendingExceptions: PendingException[];
  attemptedSubjects: Subject[];
  difficultyTop10: DifficultyEntry[];
  campusLabel: string;
};

type PendingRelocationBatch = {
  result: RelocationResult;
  sourceUnassigned: UnassignedInfo[];
  campusLabel: string;
};

const normalizeAllocationForPhase6 = (allocation: unknown): Allocation | null => {
  if (!allocation || typeof allocation !== 'object') return null;
  const value = allocation as Allocation;
  const exceptions = Array.isArray(value.exceptions)
    ? value.exceptions.filter((item): item is 'term_split' | 'room_type_relaxed' => item === 'term_split' || item === 'room_type_relaxed')
    : undefined;
  return {
    ...value,
    exceptions,
    exceptionApproved: exceptions && exceptions.length > 0
      ? (value.exceptionApproved ?? true)
      : undefined
  };
};

const normalizeAllocationsForPhase6 = (allocations: unknown) =>
  Array.isArray(allocations)
    ? allocations.map(normalizeAllocationForPhase6).filter((item): item is Allocation => item !== null)
    : [];

function App() {
  // Auth & Cloud Sync
  const { user, loginByCampus, logout: authLogout, loading: authLoading } = useAuth();
  const { saveData, refreshData, markLocalBaseline } = useCloudSync(user);
  const currentCampusLabel = useMemo(() => getCampusLabelFromEmail(user?.email), [user?.email]);

  const [showCloudModal, setShowCloudModal] = useState(false);
  const [isCloudLoading, setIsCloudLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      setShowCloudModal(true);
    }
  }, [authLoading, user]);

  const applyCampusState = useCallback((campusLabel: string) => {
    const normalizedCampus = normalizeCampusLabel(campusLabel) || DEFAULT_CAMPUS_LABEL;
    const localCampusState = loadCampusLocalState(normalizedCampus);
    activeCampusRef.current = normalizedCampus;
    loadedCampusRef.current = normalizedCampus;
    setClassrooms(localCampusState.classrooms);
    setSubjects(localCampusState.subjects);
    setAllocations(localCampusState.allocations);
    setAllocationSettings(localCampusState.allocationSettings);
    setEquipmentSettings(localCampusState.equipmentSettings);
    setDisplayConfig(localCampusState.displayConfig);
    setSubjectTaxonomy(localCampusState.subjectTaxonomy);
    markLocalBaseline({
      classrooms: localCampusState.classrooms,
      subjects: localCampusState.subjects,
      allocations: localCampusState.allocations,
      settings: localCampusState.allocationSettings,
      equipmentSettings: localCampusState.equipmentSettings,
      subjectTaxonomy: localCampusState.subjectTaxonomy
    });
  }, [markLocalBaseline]);

  useEffect(() => {
    if (authLoading || !user) return;
    if (loadedCampusRef.current === currentCampusLabel) return;
    applyCampusState(currentCampusLabel);
  }, [authLoading, user, currentCampusLabel, applyCampusState]);

  const [classrooms, setClassrooms] = useState<Classroom[]>(() => {
    try {
      return loadCampusLocalState(currentCampusLabel).classrooms;
    } catch { return []; }
  });
  const [subjects, setSubjects] = useState<Subject[]>(() => {
    try {
      return loadCampusLocalState(currentCampusLabel).subjects;
    } catch { return []; }
  });
  const [allocations, setAllocations] = useState<Allocation[]>(() => {
    try {
      return loadCampusLocalState(currentCampusLabel).allocations;
    } catch { return []; }
  });

  const [currentDay, setCurrentDay] = useState<DayOfWeek>('mon');
  const [selectedBuilding, setSelectedBuilding] = useState<string>('all');
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([]);
  const [showManager, setShowManager] = useState(false);
  const [showSubjectManager, setShowSubjectManager] = useState(false);
  const [editingSubjectId, setEditingSubjectId] = useState<string | null>(null);
  const [editingClassroomId, setEditingClassroomId] = useState<string | null>(null);
  const [showDisplaySettings, setShowDisplaySettings] = useState(false);
  const [showRuleSettings, setShowRuleSettings] = useState(false);
  const [showExtraPeriods, setShowExtraPeriods] = useState(false);
  const [lastUnassigned, setLastUnassigned] = useState<UnassignedInfo[]>([]);
  const [autoAllocationSummary, setAutoAllocationSummary] = useState<AutoAllocationSummary | null>(null);
  const [pendingAllocationBatch, setPendingAllocationBatch] = useState<PendingAllocationBatch | null>(null);
  const [pendingRelocationBatch, setPendingRelocationBatch] = useState<PendingRelocationBatch | null>(null);
  const [cloudReadWarningSummary, setCloudReadWarningSummary] = useState<CloudWriteWarningSummary | null>(null);
  const [pendingCloudReadData, setPendingCloudReadData] = useState<CloudData | null>(null);
  const [showCloudReadWarningModal, setShowCloudReadWarningModal] = useState(false);
  const [showExceptionReviewModal, setShowExceptionReviewModal] = useState(false);
  const [pendingExceptionApprovedKeys, setPendingExceptionApprovedKeys] = useState<string[]>([]);
  const [showRelocationPreviewModal, setShowRelocationPreviewModal] = useState(false);
  const [resolvingExceptions, setResolvingExceptions] = useState(false);
  const [relocating, setRelocating] = useState(false);
  const [streakRevision, setStreakRevision] = useState(0);

  const [allocationSettings, setAllocationSettings] = useState<AllocationRule[]>(() => {
    try {
      return loadCampusLocalState(currentCampusLabel).allocationSettings;
    } catch { return DEFAULT_ALLOCATION_RULES; }
  });

  const [equipmentSettings, setEquipmentSettings] = useState<EquipmentSettings>(() => {
    try {
      return loadCampusLocalState(currentCampusLabel).equipmentSettings;
    } catch {
      return DEFAULT_EQUIPMENT_SETTINGS;
    }
  });

  const [displayConfig, setDisplayConfig] = useState<DisplayConfig>(() => {
    try {
      return loadCampusLocalState(currentCampusLabel).displayConfig;
    } catch { /* fall through to default */ }
    return DEFAULT_DISPLAY_CONFIG;
  });

  const [subjectTaxonomy, setSubjectTaxonomy] = useState<SubjectTaxonomy>(() => {
    try {
      return loadCampusLocalState(currentCampusLabel).subjectTaxonomy;
    } catch {
      return getDefaultSubjectTaxonomy(currentCampusLabel);
    }
  });

  const [pickingCell, setPickingCell] = useState<{ room: string; period: Period; term: Term } | null>(null);
  const [draggingSubjectId, setDraggingSubjectId] = useState<string | null>(null);
  const activeCampusRef = useRef(currentCampusLabel);
  const loadedCampusRef = useRef(currentCampusLabel);

  // 永続化（ローカルストレージ）
  // クラウド接続中もローカルバックアップとして機能させるが、
  // クラウドからのロード直後は上書きしないよう注意が必要（現状は単純に保存）
  useEffect(() => {
    if (activeCampusRef.current !== currentCampusLabel) return;
    writeScopedStorage(currentCampusLabel, 'classrooms', JSON.stringify(classrooms));
  }, [classrooms, currentCampusLabel]);
  useEffect(() => {
    if (activeCampusRef.current !== currentCampusLabel) return;
    writeScopedStorage(currentCampusLabel, 'subjects', JSON.stringify(subjects));
  }, [subjects, currentCampusLabel]);
  useEffect(() => {
    if (activeCampusRef.current !== currentCampusLabel) return;
    writeScopedStorage(currentCampusLabel, 'allocations', JSON.stringify(allocations));
  }, [allocations, currentCampusLabel]);
  useEffect(() => {
    if (activeCampusRef.current !== currentCampusLabel) return;
    writeScopedStorage(currentCampusLabel, 'allocationSettings', JSON.stringify(allocationSettings));
  }, [allocationSettings, currentCampusLabel]);
  useEffect(() => {
    if (activeCampusRef.current !== currentCampusLabel) return;
    writeScopedStorage(currentCampusLabel, 'equipmentSettings', JSON.stringify(equipmentSettings));
  }, [equipmentSettings, currentCampusLabel]);
  useEffect(() => {
    if (activeCampusRef.current !== currentCampusLabel) return;
    writeScopedStorage(currentCampusLabel, 'displayConfig', JSON.stringify(displayConfig));
  }, [displayConfig, currentCampusLabel]);
  useEffect(() => {
    if (activeCampusRef.current !== currentCampusLabel) return;
    writeScopedStorage(currentCampusLabel, 'subjectTaxonomy', JSON.stringify(subjectTaxonomy));
  }, [subjectTaxonomy, currentCampusLabel]);
  useEffect(() => {
    pruneStreakMap(subjects);
    setStreakRevision(v => v + 1);
  }, [subjects]);



  const buildCloudSnapshot = useCallback((): CloudData => ({
    subjects,
    classrooms,
    allocations,
    settings: allocationSettings,
    equipmentSettings,
    subjectTaxonomy
  }), [subjects, classrooms, allocations, allocationSettings, equipmentSettings, subjectTaxonomy]);

  const applyCloudData = useCallback((cloudData: CloudData, campusLabel: string) => {
    setClassrooms(normalizeClassrooms(cloudData.classrooms, campusLabel));
    setSubjects(normalizeSubjectsForCampus(cloudData.subjects, campusLabel));
    setAllocations(normalizeAllocationsForPhase6(cloudData.allocations));
    setAllocationSettings(migrateAllocationRules(cloudData.settings));
    setEquipmentSettings(normalizeEquipmentSettings(cloudData.equipmentSettings));
    setSubjectTaxonomy(normalizeSubjectTaxonomyForCampus(cloudData.subjectTaxonomy, campusLabel));
    markLocalBaseline(cloudData);
    setLastUnassigned([]);
    setAutoAllocationSummary(null);
    setPendingAllocationBatch(null);
    setPendingRelocationBatch(null);
    setShowExceptionReviewModal(false);
    setShowRelocationPreviewModal(false);
    setPendingExceptionApprovedKeys([]);
  }, [markLocalBaseline]);

  const buildCloudDiffCsv = useCallback((localData: CloudData, cloudData: CloudData) => buildCloudDiffCsvRows(localData, cloudData), []);

  const getCloudWriteErrorMessage = useCallback((error: unknown) => {
    if (error instanceof Error) {
      if (error.message === 'CLOUD_CONFLICT') {
        return '現在、閲覧のみ可能です。クラウドデータが更新されています。先に「取得」を行ってから書込してください。';
      }
      if (error.message === 'WRITE_LOCKED') {
        return '現在、別のユーザーが書き込み中です。しばらく待ってから再度お試しください。';
      }
      if (/permission-denied/i.test(error.message)) {
        return 'クラウドへの書き込み権限がありません。';
      }
      return error.message;
    }
    return 'Cloud write failed.';
  }, []);

  const clearCloudReadWarningState = useCallback(() => {
    setShowCloudReadWarningModal(false);
    setCloudReadWarningSummary(null);
    setPendingCloudReadData(null);
  }, []);

  const performCloudWrite = useCallback(async () => {
    if (!user) return;
    try {
      setIsCloudLoading(true);
      await new Promise<void>(resolve => {
        if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
          window.requestAnimationFrame(() => resolve());
        } else {
          setTimeout(resolve, 0);
        }
      });
      const wrote = await saveData(buildCloudSnapshot());
      alert(wrote ? 'Cloud write complete.' : '変更はありませんでした。');
    } catch (error) {
      console.error(error);
      alert(getCloudWriteErrorMessage(error));
    } finally {
      setIsCloudLoading(false);
    }
  }, [user, saveData, buildCloudSnapshot, getCloudWriteErrorMessage]);

  const handleCloudWrite = useCallback(async () => {
    if (!user) return;
    clearCloudReadWarningState();
    await performCloudWrite();
  }, [user, performCloudWrite, clearCloudReadWarningState]);

  const handleCloudRead = useCallback(async () => {
    if (!user) return;
    try {
      setIsCloudLoading(true);
      const cloudData = await refreshData();
      if (cloudData) {
        const summary = compareCloudSnapshots(buildCloudSnapshot(), cloudData);
        if (summary.hasDiff) {
          setCloudReadWarningSummary(summary);
          setPendingCloudReadData(cloudData);
          setShowCloudReadWarningModal(true);
          return;
        }
        applyCloudData(cloudData, currentCampusLabel);
        alert('Cloud data loaded.');
      } else {
        alert('No cloud data found.');
      }
    } catch (error) {
      console.error(error);
      alert('Cloud fetch failed.');
    } finally {
      setIsCloudLoading(false);
    }
  }, [user, refreshData, applyCloudData, currentCampusLabel, buildCloudSnapshot]);

  const handleCloudReadWarningConfirm = useCallback(() => {
    if (!pendingCloudReadData) return;
    applyCloudData(pendingCloudReadData, currentCampusLabel);
    setShowCloudReadWarningModal(false);
    setCloudReadWarningSummary(null);
    setPendingCloudReadData(null);
    alert('Cloud data loaded.');
  }, [pendingCloudReadData, applyCloudData, currentCampusLabel]);

  const handleCloudReadWarningExport = useCallback(() => {
    if (!cloudReadWarningSummary || !pendingCloudReadData) return;
    const diffRows = buildCloudDiffCsv(buildCloudSnapshot(), pendingCloudReadData);
    exportToCSV(diffRows, 'cloud_diff_export.csv');
  }, [cloudReadWarningSummary, pendingCloudReadData, buildCloudSnapshot, buildCloudDiffCsv]);

  const handleCloudReadWarningCancel = useCallback(() => {
    setShowCloudReadWarningModal(false);
    setCloudReadWarningSummary(null);
    setPendingCloudReadData(null);
  }, []);


  const handleCloudConnect = async (email: string) => {
    try {
      setIsCloudLoading(true);
      await loginByCampus(email);
      const campusLabel = getCampusLabelFromEmail(email);
      applyCampusState(campusLabel);

      const cloudData = await refreshData();
      if (cloudData && !hasScopedLocalCampusData(campusLabel)) {
        applyCloudData(cloudData, campusLabel);
        alert('Cloud data loaded.');
      }
      setShowCloudModal(false);
    } finally {
      setIsCloudLoading(false);
    }
  };

  const draggingSubject = useMemo(() => {
    if (!draggingSubjectId) return null;
    const realId = draggingSubjectId.includes('__slot') ? draggingSubjectId.split('__slot')[0] : draggingSubjectId;
    return subjects.find(s => s.id === realId);
  }, [subjects, draggingSubjectId]);
  const editingSubject = subjects.find(s => s.id === editingSubjectId);
  const editingClassroom = classrooms.find(r => r.id === editingClassroomId);
  const [streakMapSnapshot, setStreakMapSnapshot] = useState(() => loadStreakMap());

  useEffect(() => {
    setStreakMapSnapshot(loadStreakMap());
  }, [streakRevision]);

  const computeSubjectDifficulty = useCallback((subject: Subject) => {
    return computeDifficulty(subject, subjects, classrooms, allocationSettings, equipmentSettings, streakMapSnapshot);
  }, [subjects, classrooms, allocationSettings, equipmentSettings, streakMapSnapshot]);
  const buildApprovedExceptionSet = (sourceAllocations: Allocation[]) =>
    new Set(
      sourceAllocations
        .filter(allocation => allocation.exceptionApproved && Array.isArray(allocation.exceptions) && allocation.exceptions.length > 0)
        .map(allocation => buildApprovalKey(allocation.subjectId, allocation.classroomId, allocation.exceptions))
    );

  const buildings = useMemo(() => {
    const list = Array.from(new Set(classrooms.map(c => c.building)));
    return ['all', ...sortBuildingsByCanonicalOrder(list)];
  }, [classrooms]);

  const allEquipment = useMemo(() => {
    const set = new Set<string>(EQUIPMENT_LIST);
    classrooms.forEach(c => {
      c.equipment.forEach(e => set.add(e));
    });
    return sortEquipmentByCanonicalOrder(Array.from(set));
  }, [classrooms]);

  const subjectEquipmentOptions = useMemo(() => {
    const set = new Set<string>(SUBJECT_EQUIPMENT_CHOICES);
    classrooms.forEach(c => {
      filterVisibleRoomEquipment(c.equipment).forEach(e => set.add(e));
    });
    return sortEquipmentByCanonicalOrder(Array.from(set));
  }, [classrooms]);

  const hasInitializedEquipment = useRef(false);
  if (!hasInitializedEquipment.current && allEquipment.length > 0 && displayConfig.highlightedEquipment.length === 0) {
    setDisplayConfig(prev => ({ ...prev, highlightedEquipment: allEquipment }));
    hasInitializedEquipment.current = true;
  }

  const filteredClassrooms = useMemo(() => {
    let list = selectedBuilding === 'all'
      ? classrooms
      : classrooms.filter(c => c.building === selectedBuilding);

    if (selectedTypes.length > 0) {
      list = list.filter(c => selectedTypes.includes(c.type));
    }

    if (selectedEquipment.length > 0) {
      list = list.filter(c =>
        selectedEquipment.every(eq => {
          if (eq === '可動') return c.isMovable;
          return c.equipment.includes(eq);
        })
      );
    }

    // BUILDINGS の順序でソート
    return [...list].sort((a, b) => {
      const indexA = BUILDINGS.indexOf(a.building as Building);
      const indexB = BUILDINGS.indexOf(b.building as Building);
      if (indexA === -1 && indexB === -1) return a.building.localeCompare(b.building);
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      if (indexA !== indexB) return indexA - indexB;
      return a.name.localeCompare(b.name);
    });
  }, [classrooms, selectedBuilding, selectedTypes, selectedEquipment]);

  const handleClassroomUpdate = (updated: Classroom[]) => {
    const nextClassrooms = normalizeClassrooms(updated, currentCampusLabel);
    const roomIds = new Set(updated.map(r => r.id));
    const lostRooms = classrooms.filter(r => !roomIds.has(r.id)).map(r => r.id);

    if (lostRooms.length > 0) {
      setAllocations(prev => prev.filter(a => !lostRooms.includes(a.classroomId)));
    }

    setClassrooms(nextClassrooms);
  };

  const handleSubjectUpdate = (updated: Subject[]) => {
    const subjectIds = new Set(updated.map(s => s.id));
    const lostSubjects = subjects.filter(s => !subjectIds.has(s.id)).map(s => s.id);
    const normalizedSubjects = updated.map(subject => ({
      ...subject,
      campus: normalizeCampusLabel(subject.campus || currentCampusLabel) || currentCampusLabel
    }));

    setAllocations(prev => {
      let next = prev.filter(a => !lostSubjects.includes(a.subjectId));

      next = next.filter(a => {
        const oldSub = subjects.find(s => s.id === a.subjectId);
        const newSub = normalizedSubjects.find(s => s.id === a.subjectId);
        if (oldSub && newSub) {
          if (
            oldSub.term !== newSub.term ||
            oldSub.day !== newSub.day ||
            oldSub.period !== newSub.period ||
            (oldSub.endPeriod ?? oldSub.period) !== (newSub.endPeriod ?? newSub.period)
          ) {
            return false;
          }
        }
        return true;
      });

      return next;
    });

    setSubjects(normalizedSubjects);
  };

  const unassignedSubjectsAll = useMemo(() => {
    return subjects.flatMap(s => {
      const currentCount = allocations.filter(a => a.subjectId === s.id).length;
      const countNeeded = (s.requiredRoomCount || 1);
      const remaining = Math.max(0, countNeeded - currentCount);

      return Array(remaining).fill(null).map((_, i) => ({
        ...s,
        // DNDのキーとして一意にするため。配当を外した際も区別できるようインデックスを付与
        id: remaining > 1 || currentCount > 0 ? `${s.id}__slot${i}` : s.id,
        _realId: s.id
      }));
    });
  }, [subjects, allocations]);

  const unassignedWithReason = useMemo<UnassignedListItem[]>(() => {
    const reasonMap = new Map<string, UnassignedInfo>();
    lastUnassigned.forEach(info => {
      reasonMap.set(info.subject.id, info);
    });

    return unassignedSubjectsAll.map(subject => {
      const realId = subject._realId || subject.id;
      const info = reasonMap.get(realId) || reasonMap.get(subject.id);
      const difficulty = computeSubjectDifficulty(subject);
      return {
        ...subject,
        reason: info?.reason,
        reasonDetail: info?.detail,
        difficultyScore: difficulty?.score,
        difficultyDetail: difficulty ? formatDifficultySummary(difficulty) : undefined
      };
    });
  }, [unassignedSubjectsAll, lastUnassigned, computeSubjectDifficulty]);

  const displayedUnassigned = useMemo(() => {
    return unassignedWithReason.filter(s => s.day === currentDay);
  }, [unassignedWithReason, currentDay]);

  const pendingExceptionKey = (item: PendingException) => buildApprovalKey(item.subject.id, item.classroomId, item.exceptions);

  const mergeUnassignedInfos = (items: UnassignedInfo[]) => {
    const map = new Map<string, UnassignedInfo>();
    items.forEach(item => {
      if (!map.has(item.subject.id)) {
        map.set(item.subject.id, item);
      }
    });
    return Array.from(map.values());
  };

  const getUnassignedSubjects = (subjectList: Subject[], allocationList: Allocation[]) => {
    const allocationCounts = new Map<string, number>();
    allocationList.forEach(allocation => {
      allocationCounts.set(allocation.subjectId, (allocationCounts.get(allocation.subjectId) || 0) + 1);
    });

    return subjectList.filter(subject => {
      const currentCount = allocationCounts.get(subject.id) || 0;
      const requiredCount = subject.requiredRoomCount || 1;
      return currentCount < requiredCount;
    });
  };

  const reorderSubjectsByUnassignedOrder = (subjectList: Subject[], orderedUnassigned: Subject[]) => {
    const unassignedSet = new Set(orderedUnassigned.map(subject => subject.id));
    let unassignedIndex = 0;

    return subjectList.map(subject => {
      if (unassignedSet.has(subject.id)) {
        return orderedUnassigned[unassignedIndex++];
      }
      return subject;
    });
  };

  const rebuildUnassignedOrder = (
    subjectList: Subject[],
    allocationList: Allocation[],
    movingSubjectId: string,
    insertIndex: number
  ) => {
    const currentUnassigned = getUnassignedSubjects(subjectList, allocationList);
    const movingSubject = currentUnassigned.find(subject => subject.id === movingSubjectId);
    if (!movingSubject) return subjectList;

    const nextOrder = currentUnassigned.filter(subject => subject.id !== movingSubjectId);
    const safeIndex = Math.max(0, Math.min(insertIndex, nextOrder.length));
    nextOrder.splice(safeIndex, 0, movingSubject);
    return reorderSubjectsByUnassignedOrder(subjectList, nextOrder);
  };


  const handleDrop = (vSubjectId: string, classroomId: string, period: Period, term: Term, fromClassroomId?: string) => {
    const subjectId = vSubjectId.includes('__slot') ? vSubjectId.split('__slot')[0] : vSubjectId;
    const subject = subjects.find(s => s.id === subjectId);
    if (!subject) return;

    // 学期（春・秋）の不一致のみをチェック（通年科目は両方可）
    // spring_first/spring_second は春行(term='spring')、autumn_first/second は秋行(term='autumn') に対応
    const springTerms = ['spring', 'spring_first', 'spring_second'];
    const autumnTerms = ['autumn', 'autumn_first', 'autumn_second'];
    const subjectSeason = springTerms.includes(subject.term) ? 'spring' : (autumnTerms.includes(subject.term) ? 'autumn' : null);
    if (subjectSeason !== null && subjectSeason !== term) {
      const termLabel = springTerms.includes(subject.term) ? '春学期' : '秋学期';
      alert(`${termLabel}の授業です。${term === 'spring' ? '春' : '秋'}行には配置できません。`);
      return;
    }

    // 曜日・時限が異なる場合は科目のデータを更新する
    if (subject.day !== currentDay || subject.period !== period) {
      const updatedSubjects = subjects.map(s => {
        if (s.id === subjectId) {
          // 連続講時の場合は終了講時も再計算
          const duration = (s.endPeriod || s.period) - s.period;
          return {
            ...s,
            day: currentDay,
            period: period,
            endPeriod: (period + duration) <= 7 ? (period + duration) as Period : 7 as Period
          };
        }
        return s;
      });
      setSubjects(updatedSubjects);
    }

    setAllocations(prev => {
      const subject = subjects.find(s => s.id === subjectId);
      const limit = subject?.requiredRoomCount || 1;
      const current = prev.filter(a => a.subjectId === subjectId);

      // 同じスロット（教室・時限・学期）に既に同じ科目が配当されているかチェック
      // (TimeTableGrid側でガードはあるが、allocationsの状態としてもチェック)
      const isAlreadyInThisCell = prev.some(a => a.subjectId === subjectId && a.classroomId === classroomId);
      if (isAlreadyInThisCell) return prev;

      if (fromClassroomId) {
        const sourceExists = prev.some(a => a.subjectId === subjectId && a.classroomId === fromClassroomId);
        if (sourceExists) {
          return prev.map(a =>
            a.subjectId === subjectId && a.classroomId === fromClassroomId
              ? { subjectId, classroomId }
              : a
          );
        }
      }

      if (current.length < limit) {
        return [...prev, { subjectId, classroomId }];
      } else {
        // 上限に達している場合は、最も古い（先頭の）割り当てを1つ削除して追加
        const others = prev.filter((_a, i) => i !== prev.findIndex(x => x.subjectId === subjectId));
        return [...others, { subjectId, classroomId }];
      }
    });
  };

  const handleRemove = (subjectId: string, classroomId: string, insertIndex?: number) => {
    const nextAllocations = allocations.filter(a => !(a.subjectId === subjectId && a.classroomId === classroomId));
    setAllocations(nextAllocations);
    if (typeof insertIndex === 'number') {
      setSubjects(prev => rebuildUnassignedOrder(prev, nextAllocations, subjectId, insertIndex));
    }
  };

  const finalizeAutoAllocation = (
    result: OptimizerResult,
    targetCount: number,
    preservedCount: number,
    rejectedPending: PendingException[] = [],
    attemptedSubjects: Subject[] = [],
    difficultyTop10: DifficultyEntry[] = []
  ) => {
    const rejectedKeys = new Set(rejectedPending.map(pendingExceptionKey));
    const nextAllocations = result.allocations.filter(a => !rejectedKeys.has(`${a.subjectId}__${a.classroomId}`));
    const rejectedUnassigned = rejectedPending.map(item => ({
      subject: item.subject,
      reason: item.alternativeUnassignedReason,
      detail: `例外候補(${item.exceptions.join(' / ')})を却下しました`
    }));
    const nextUnassigned = mergeUnassignedInfos([...result.unassigned, ...rejectedUnassigned]);

    setAllocations(nextAllocations);
    setLastUnassigned(nextUnassigned);
    setAutoAllocationSummary({
      targetCount,
      preservedCount,
      newlyAllocatedCount: nextAllocations.length - preservedCount,
      unassigned: nextUnassigned,
      difficultyTop10
    });
    setPendingAllocationBatch(null);
    setShowExceptionReviewModal(false);
    setPendingExceptionApprovedKeys([]);
    setPendingRelocationBatch(null);
    setShowRelocationPreviewModal(false);
    updateStreakAfterAllocation(attemptedSubjects, nextUnassigned);
    setStreakRevision(v => v + 1);
  };

  const handleAutoAllocate = (options: AllocationOptions) => {
    const { rules: rulesToUse, priorities, includeAllocated, includeUnassigned, equipmentSettings: equipmentToUse } = options;

    if (!validateCampusScopeForOperation('教室自動配当', currentCampusLabel, classrooms, subjects)) {
      return;
    }

    // 対象科目をフィルタリング
    const allocatedSubjectIds = new Set(allocations.map(a => a.subjectId));
    const targetSubjects = subjects.filter(s => {
      // 優先度フィルタ
      if (!priorities.includes(s.priority || 1)) return false;

      // 配当期フィルタ
      if (!options.terms.includes(s.term)) return false;

      // 曜日フィルタ
      if (!options.days.includes(s.day)) return false;

      // 講時フィルタ
      // 連続講時の場合は、全ての関わる時限が選択されている必要がある
      const start = s.period;
      const end = s.endPeriod || s.period;
      for (let p = start; p <= end; p++) {
        if (!options.periods.includes(p as Period)) return false;
      }

      // 配当状況フィルタ
      const isAllocated = allocatedSubjectIds.has(s.id);
      if (isAllocated && !includeAllocated) return false;
      if (!isAllocated && !includeUnassigned) return false;
      return true;
    });

    if (targetSubjects.length === 0) {
      alert('対象となる科目がありません。');
      return;
    }

    if (!validateSubjectsForAutoAllocation(targetSubjects)) {
      return;
    }

    // 配当済みを含む場合は確認
    if (includeAllocated) {
      const allocatedCount = targetSubjects.filter(s => allocatedSubjectIds.has(s.id)).length;
      if (allocatedCount > 0 && !confirm(`配当済み${allocatedCount}件を含む${targetSubjects.length}件を再配当します。\n既存の配当はリセットされます。よろしいですか？`)) return;
    }

    // 既存配当から対象科目を除外
    const preservedAllocations = allocations.filter(a => !targetSubjects.some(s => s.id === a.subjectId));
    const streakMap = loadStreakMap();
    const approvedExceptions = buildApprovedExceptionSet(allocations);
    const difficultyTop10 = buildDifficultyRanking(targetSubjects, classrooms, rulesToUse, equipmentToUse, streakMap);

    const result = runAutoAllocation(
      targetSubjects,
      classrooms,
      preservedAllocations,
      rulesToUse,
      equipmentToUse,
      { streakMap, ignoreStreakOnce: options.ignoreStreakOnce, approvedExceptions }
    );
    finalizeAutoAllocation(
      result,
      targetSubjects.length,
      preservedAllocations.length,
      [],
      targetSubjects,
      difficultyTop10
    );
    setShowRuleSettings(false);
    setPendingRelocationBatch(null);
    setShowRelocationPreviewModal(false);
  };

  const handleAutoAllocatePhase3 = (options: AllocationOptions) => {
    const {
      rules: rulesToUse,
      priorities,
      includeAllocated,
      includeUnassigned,
      confirmExceptions,
      equipmentSettings: equipmentToUse
    } = options;

    if (!confirmExceptions) {
      handleAutoAllocate(options);
      return;
    }

    if (!validateCampusScopeForOperation('教室自動配当', currentCampusLabel, classrooms, subjects)) {
      return;
    }

    const allocatedSubjectIds = new Set(allocations.map(a => a.subjectId));
    const targetSubjects = subjects.filter(s => {
      if (!priorities.includes(s.priority || 1)) return false;
      if (!options.terms.includes(s.term)) return false;
      if (!options.days.includes(s.day)) return false;

      const start = s.period;
      const end = s.endPeriod || s.period;
      for (let p = start; p <= end; p++) {
        if (!options.periods.includes(p as Period)) return false;
      }

      const isAllocated = allocatedSubjectIds.has(s.id);
      if (isAllocated && !includeAllocated) return false;
      if (!isAllocated && !includeUnassigned) return false;
      return true;
    });

    if (targetSubjects.length === 0) {
      alert('対象となる科目がありません。');
      return;
    }

    if (!validateSubjectsForAutoAllocation(targetSubjects)) {
      return;
    }

    if (includeAllocated) {
      const allocatedCount = targetSubjects.filter(s => allocatedSubjectIds.has(s.id)).length;
      if (allocatedCount > 0 && !confirm(`既存配当を含む ${allocatedCount} 科目を再配当します。よろしいですか？`)) {
        return;
      }
    }

    const preservedAllocations = allocations.filter(a => !targetSubjects.some(s => s.id === a.subjectId));
    const streakMap = loadStreakMap();
    const approvedExceptions = buildApprovedExceptionSet(allocations);
    const difficultyTop10 = buildDifficultyRanking(targetSubjects, classrooms, rulesToUse, equipmentToUse, streakMap);
    const result = runAutoAllocation(
      targetSubjects,
      classrooms,
      preservedAllocations,
      rulesToUse,
      equipmentToUse,
      { dryRunExceptions: confirmExceptions, streakMap, ignoreStreakOnce: options.ignoreStreakOnce, approvedExceptions }
    );

    if (confirmExceptions && result.pendingExceptions && result.pendingExceptions.length > 0) {
      setAutoAllocationSummary(null);
      setPendingAllocationBatch({
        result,
        targetCount: targetSubjects.length,
        preservedCount: preservedAllocations.length,
        pendingExceptions: result.pendingExceptions,
        attemptedSubjects: targetSubjects,
        difficultyTop10,
        campusLabel: currentCampusLabel
      });
      setPendingExceptionApprovedKeys(result.pendingExceptions.map(pendingExceptionKey));
      setShowExceptionReviewModal(true);
      setShowRuleSettings(false);
      setPendingRelocationBatch(null);
      setShowRelocationPreviewModal(false);
      return;
    }

    finalizeAutoAllocation(
      result,
      targetSubjects.length,
      preservedAllocations.length,
      [],
      targetSubjects,
      difficultyTop10
    );
    setShowRuleSettings(false);
  };

  const handleConfirmExceptionReview = (approvedKeys: string[]) => {
    if (!pendingAllocationBatch) return;
    if (pendingAllocationBatch.campusLabel !== currentCampusLabel) {
      alert('キャンパスが切り替わったため、例外確認を中止しました。');
      setPendingAllocationBatch(null);
      setShowExceptionReviewModal(false);
      setPendingExceptionApprovedKeys([]);
      return;
    }

    const approvedSet = new Set(approvedKeys);
    const rejectedPending = pendingAllocationBatch.pendingExceptions.filter(item => !approvedSet.has(pendingExceptionKey(item)));
    const approvedAllocationsResult: OptimizerResult = {
      ...pendingAllocationBatch.result,
      allocations: pendingAllocationBatch.result.allocations.map(allocation => {
        if (!allocation.exceptions || allocation.exceptions.length === 0) return allocation;
        const key = buildApprovalKey(allocation.subjectId, allocation.classroomId, allocation.exceptions);
        return approvedSet.has(key)
          ? { ...allocation, exceptionApproved: true }
          : allocation;
      })
    };
    finalizeAutoAllocation(
      approvedAllocationsResult,
      pendingAllocationBatch.targetCount,
      pendingAllocationBatch.preservedCount,
      rejectedPending,
      pendingAllocationBatch.attemptedSubjects,
      pendingAllocationBatch.difficultyTop10
    );
    setPendingExceptionApprovedKeys([]);
  };

  const handleCancelExceptionReview = () => {
    setPendingAllocationBatch(null);
    setShowExceptionReviewModal(false);
    setPendingExceptionApprovedKeys([]);
  };

  const handleResolveCurrentExceptions = () => {
    if (resolvingExceptions) return;
    if (!validateCampusScopeForOperation('例外の再スキャン', currentCampusLabel, classrooms, subjects)) {
      return;
    }
    const exceptionCount = allocations.filter(a => a.exceptions && a.exceptions.length > 0 && !a.exceptionApproved).length;
    if (exceptionCount === 0) return;

    setResolvingExceptions(true);
    try {
      const result = resolveExceptions(subjects, classrooms, allocations, allocationSettings, equipmentSettings);
      setAllocations(result.allocations);
      setAutoAllocationSummary(null);
      alert(`例外を再スキャンしました。\n解消: ${result.resolved.length}件\n未解消: ${exceptionCount - result.resolved.length}件`);
    } finally {
      setResolvingExceptions(false);
    }
  };

  const handleReset = () => {
    if (confirm('割り当てをクリアしますか？')) setAllocations([]);
  };

  const handleResetUnassignedStreak = () => {
    if (!confirm('未配当連続カウントをリセットしますか？')) return;
    clearStreakMap();
    setStreakRevision(v => v + 1);
    alert('未配当連続カウントをリセットしました。');
  };

  const handleResetApprovedExceptions = () => {
    if (!confirm('承認済み例外をすべて再確認対象に戻しますか？')) return;
    setAllocations(prev => prev.map(allocation =>
      allocation.exceptionApproved
        ? { ...allocation, exceptionApproved: false }
        : allocation
    ));
    alert('承認済み例外をすべて再確認対象に戻しました。');
  };

  const handleRelocate = () => {
    if (relocating) return;
    if (!validateCampusScopeForOperation('未配当の再配置', currentCampusLabel, classrooms, subjects)) {
      return;
    }

    const sourceUnassigned = lastUnassigned.length > 0
      ? lastUnassigned
      : (autoAllocationSummary?.unassigned || []);

    if (sourceUnassigned.length === 0) {
      alert('再配置する未配当がありません。');
      return;
    }

    setRelocating(true);
    try {
      const result = relocateForUnassigned(
        subjects,
        classrooms,
        allocations,
        sourceUnassigned,
        allocationSettings,
        equipmentSettings
      );

      if (result.moves.length === 0 && result.placed.length === 0) {
        alert('再配置できる候補がありませんでした。');
        return;
      }

      setPendingRelocationBatch({ result, sourceUnassigned, campusLabel: currentCampusLabel });
      setShowRelocationPreviewModal(true);
    } finally {
      setRelocating(false);
    }
  };

  const handleConfirmRelocation = () => {
    if (!pendingRelocationBatch) return;
    if (pendingRelocationBatch.campusLabel !== currentCampusLabel) {
      alert('キャンパスが切り替わったため、再配置を中止しました。');
      setPendingRelocationBatch(null);
      setShowRelocationPreviewModal(false);
      return;
    }

    const result = pendingRelocationBatch.result;
    setAllocations(result.allocations);
    setLastUnassigned(result.unassigned);
    setAutoAllocationSummary({
      targetCount: pendingRelocationBatch.sourceUnassigned.length,
      preservedCount: result.allocations.length - result.placed.length,
      newlyAllocatedCount: result.placed.length,
      unassigned: result.unassigned,
      difficultyTop10: []
    });
    const attemptedSubjects = pendingRelocationBatch.sourceUnassigned.map(item => item.subject);
    updateStreakAfterAllocation(attemptedSubjects, result.unassigned);
    setStreakRevision(v => v + 1);
    setPendingRelocationBatch(null);
    setShowRelocationPreviewModal(false);
  };

  const handleCancelRelocation = () => {
    setPendingRelocationBatch(null);
    setShowRelocationPreviewModal(false);
  };

  const handleCellClick = (classroomId: string, period: Period, term: Term) => {
    setPickingCell({ room: classroomId, period, term });
  };

  const handleQuickAssign = (subjectId: string) => {
    if (pickingCell) {
      handleDrop(subjectId, pickingCell.room, pickingCell.period, pickingCell.term);
      setPickingCell(null);
    }
  };

  const handleReorderSubjects = (reorderedUnassigned: UnassignedListItem[]) => {
    const normalizedOrder = reorderedUnassigned
      .map(subject => subjects.find(s => s.id === (subject._realId || subject.id)))
      .filter((item): item is Subject => item !== undefined);

    setSubjects(prev => reorderSubjectsByUnassignedOrder(prev, normalizedOrder));
  };

  // Auth初期化中はローディング表示
  if (authLoading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f7fa', color: '#666', flexDirection: 'column', gap: '16px' }}>
        <div className="animate-spin" style={{ width: '40px', height: '40px', border: '4px solid #ddd', borderTopColor: '#646cff', borderRadius: '50%' }}></div>
        <p>読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="app-layout">
      {/* Header */}
      <header style={{
        padding: '10px 20px', background: '#2d2d2d', color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Calendar size={20} color="#646cff" />
          <h1 style={{ fontSize: '1.2rem', margin: 0, letterSpacing: '0.5px' }}>教室配当調整</h1>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {user && (
            <>
              <button
                onClick={handleCloudWrite}
                style={{
                  display: 'flex', gap: '6px', alignItems: 'center',
                  background: '#2f7d32', color: '#fff',
                  border: '1px solid #1b5e20',
                  padding: '6px 14px', borderRadius: '12px', cursor: 'pointer',
                  opacity: isCloudLoading ? 0.5 : 1,
                  fontSize: '0.9rem', fontWeight: '600'
                }}
                disabled={isCloudLoading}
                title={"ローカルデータをクラウドへ書き込みます"}
              >
                <CloudUpload size={16} />
                書込
              </button>
              <button
                onClick={handleCloudRead}
                style={{
                  display: 'flex', gap: '6px', alignItems: 'center',
                  background: '#f1f5f9', color: '#334155',
                  border: '1px solid #cbd5e1',
                  padding: '6px 14px', borderRadius: '12px', cursor: 'pointer',
                  opacity: isCloudLoading ? 0.5 : 1,
                  fontSize: '0.9rem', fontWeight: '600'
                }}
                disabled={isCloudLoading}
                title={"クラウドデータをローカルへ取得します"}
              >
                <CloudDownload size={16} className={isCloudLoading ? 'animate-pulse' : ''} />
                取得
              </button>
            </>
          )}

          {user && (
            <button
              onClick={authLogout}
              style={{
                display: 'flex', gap: '6px', alignItems: 'center',
                background: '#b91c1c', color: '#fff',
                border: '1px solid #7f1d1d',
                padding: '6px 14px', borderRadius: '12px', cursor: 'pointer',
                fontSize: '0.9rem', fontWeight: '600'
              }}
              title="ログアウト"
            >
              <LogOut size={16} />
              ログアウト
            </button>
          )}

          <div style={{ width: '1px', background: '#666', height: '24px', margin: '0 4px' }}></div>
          <button onClick={() => setShowRuleSettings(true)} style={{ display: 'flex', gap: '6px', alignItems: 'center', background: '#2563eb', color: '#fff', border: '1px solid #1d4ed8', padding: '6px 14px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
            <ListChecks size={16} /> {"配当ルール設定"}
          </button>
          <button onClick={handleReset} style={{ display: 'flex', gap: '6px', alignItems: 'center', background: '#dc2626', color: '#fff', border: '1px solid #991b1b', padding: '6px 14px', borderRadius: '4px', cursor: 'pointer' }}>
            <RefreshCw size={16} /> {"クリア"}
          </button>
          <div style={{ width: '1px', background: '#666', height: '24px', margin: '0 4px' }}></div>
          <button onClick={() => setShowManager(true)} style={{ display: 'flex', gap: '6px', alignItems: 'center', background: '#475569', color: '#fff', border: '1px solid #334155', padding: '6px 14px', borderRadius: '4px', cursor: 'pointer' }}>
            <Settings size={16} /> {"教室管理"}
          </button>
          <button onClick={() => setShowSubjectManager(true)} style={{ display: 'flex', gap: '6px', alignItems: 'center', background: '#475569', color: '#fff', border: '1px solid #334155', padding: '6px 14px', borderRadius: '4px', cursor: 'pointer' }}>
            <BookOpen size={16} /> {"授業管理"}
          </button>
          {SHOW_DISPLAY_SETTINGS_BUTTON && (
            <button onClick={() => setShowDisplaySettings(true)} style={{ display: 'flex', gap: '6px', alignItems: 'center', background: '#475569', color: '#fff', border: '1px solid #334155', padding: '6px 14px', borderRadius: '4px', cursor: 'pointer' }}>
              <Eye size={16} /> {"表示設定"}
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', width: '100%' }}>
        {/* Sidebar */}
        <div style={{ width: '250px', borderRight: '1px solid #dee2e6', display: 'flex', flexDirection: 'column', flexShrink: 0, background: '#f8f9fa' }}>
          <UnassignedList
            subjects={unassignedSubjectsAll}
            allocations={allocations}
            onReorder={handleReorderSubjects}
            onDragStart={setDraggingSubjectId}
            onDragEnd={() => setDraggingSubjectId(null)}
            onEdit={setEditingSubjectId}
            onRemoveAllocation={handleRemove}
          />
        </div>

        {/* Grid Area Container */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Grid Control Bar (Day & Building) */}
          <div style={{ background: '#f8f9fa', borderBottom: '1px solid #ddd' }}>
            {/* Day Tabs */}
            <div style={{ display: 'flex', borderBottom: '2px solid #c8cdd8', background: '#e4e8f0', paddingTop: '4px', paddingLeft: '4px', gap: '2px' }}>
              {
                DAYS.map((d) => {
                  const isActive = currentDay === d;
                  return (
                    <button
                      key={d}
                      onClick={() => setCurrentDay(d)}
                      style={{
                        padding: '8px 18px',
                        border: isActive ? '2px solid #c8cdd8' : '1px solid #b0b8c8',
                        borderBottom: isActive ? '2px solid #fff' : 'none',
                        borderRadius: '6px 6px 0 0',
                        background: isActive ? '#fff' : '#c2cad8',
                        color: isActive ? '#333' : '#4a5568',
                        fontWeight: isActive ? 'bold' : '500',
                        cursor: 'pointer', fontSize: '0.92em',
                        transition: 'background 0.15s',
                        marginBottom: isActive ? '-2px' : '2px',
                        position: 'relative' as const,
                        zIndex: isActive ? 2 : 1,
                        boxShadow: isActive ? 'none' : 'inset 0 -3px 0 rgba(0,0,0,0.08)'
                      }}
                    >
                      {(() => {
                        const total = subjects.filter(s => s.day === d).length;
                        const allocated = subjects.filter(s => s.day === d && allocations.some(a => a.subjectId === s.id)).length;
                        return `${DAY_LABELS[d]}曜日${total > 0 ? ` (${allocated} / ${total})` : ''}`;
                      })()}
                    </button>
                  );
                })
              }
              <div style={{ flex: 1 }} />
              <label style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '0 16px', fontSize: '0.85em', color: '#666', cursor: 'pointer' }}>
                <input type="checkbox" checked={showExtraPeriods} onChange={e => setShowExtraPeriods(e.target.checked)} />
                6・7講時を表示
              </label>
            </div>

            {/* Building / Type / Equipment Filters - single row */}
            <div style={{ padding: '6px 20px', borderBottom: '1px solid #eee', display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.82em', background: '#fafafa' }}>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ color: '#666', fontWeight: 'bold', whiteSpace: 'nowrap' }}>建物：</span>
                {buildings.map(b => (
                  <button
                    key={b}
                    onClick={() => setSelectedBuilding(b)}
                    style={{
                      padding: '3px 12px', borderRadius: '12px', border: '1px solid #ddd',
                      background: selectedBuilding === b ? '#646cff' : '#fff',
                      color: selectedBuilding === b ? '#fff' : '#333',
                      fontSize: '0.82em', cursor: 'pointer', whiteSpace: 'nowrap'
                    }}
                  >
                    {b === 'all' ? 'すべて' : b}
                  </button>
                ))}
              </div>
              <div style={{ width: '1px', height: '18px', background: '#ddd', flexShrink: 0 }} />

              {/* タイプ */}
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <span style={{ color: '#666', fontWeight: 'bold', whiteSpace: 'nowrap' }}>タイプ：</span>
                {[{ id: 'normal', label: '一般' }, { id: 'seminar', label: 'ゼミ' }, { id: 'pc', label: 'PC' }].map(t => (
                  <button key={t.id}
                    onClick={() => setSelectedTypes(prev => prev.includes(t.id) ? prev.filter(x => x !== t.id) : [...prev, t.id])}
                    style={{
                      padding: '3px 12px', borderRadius: '12px',
                      border: selectedTypes.includes(t.id) ? '1px solid #646cff' : '1px solid #ddd',
                      background: selectedTypes.includes(t.id) ? '#646cff' : '#fff',
                      color: selectedTypes.includes(t.id) ? '#fff' : '#333',
                      fontSize: '0.82em', cursor: 'pointer', whiteSpace: 'nowrap'
                    }}>{t.label}</button>
                ))}
              </div>
              <div style={{ width: '1px', height: '18px', background: '#ddd', flexShrink: 0 }} />
              {/* 設備 */}
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ color: '#666', fontWeight: 'bold', whiteSpace: 'nowrap' }}>設備：</span>
                {[
                  { id: 'PJ(中)', label: 'PJ(中)' },
                  { id: 'PJ(横)', label: 'PJ(横)' },
                  { id: 'タッチディスプレイ', label: 'タッチディスプレイ' },
                  { id: 'BD', label: 'BD' },
                  { id: '可動', label: '可動' },
                  { id: '黒板', label: '黒板' },
                  { id: '白板', label: '白板' },
                  { id: 'マイク', label: 'マイク' },
                ].map(eq => (
                  <button key={eq.id}
                    onClick={() => setSelectedEquipment(prev => prev.includes(eq.id) ? prev.filter(x => x !== eq.id) : [...prev, eq.id])}
                    style={{
                      padding: '3px 12px', borderRadius: '12px',
                      border: selectedEquipment.includes(eq.id) ? '1px solid #646cff' : '1px solid #ddd',
                      background: selectedEquipment.includes(eq.id) ? '#646cff' : '#fff',
                      color: selectedEquipment.includes(eq.id) ? '#fff' : '#333',
                      fontSize: '0.82em', cursor: 'pointer', whiteSpace: 'nowrap'
                    }}>{eq.label}</button>
                ))}
              </div>
              {(selectedBuilding !== 'all' || selectedTypes.length > 0 || selectedEquipment.length > 0) && (
                <button onClick={() => { setSelectedBuilding('all'); setSelectedTypes([]); setSelectedEquipment([]); }}
                  style={{ marginLeft: 'auto', padding: '2px 8px', border: '1px solid #ddd', borderRadius: '4px', background: '#fff', color: '#666', cursor: 'pointer', fontSize: '0.85em' }}>
                  絞込解除
                </button>
              )}
            </div>
          </div>

          {/* Grid Area - Use full remaining height */}
          < div style={{ flex: 1, overflow: 'hidden' }}>
            <TimeTableGrid
              day={currentDay}
              classrooms={filteredClassrooms}
              allocations={allocations}
              subjects={subjects}
              onDrop={handleDrop}
              onRemove={handleRemove}
              onCellClick={handleCellClick}
              onClassClick={(id) => setEditingClassroomId(id)}
              showExtraPeriods={showExtraPeriods}
              displayConfig={displayConfig}
              draggingSubject={draggingSubject}
              onDragStart={setDraggingSubjectId}
              onDragEnd={() => setDraggingSubjectId(null)}
              onEdit={setEditingSubjectId}
            />

            {/* Legend */}
            <div style={{
              padding: '10px 20px', background: '#fff', borderTop: '1px solid #ddd',
              display: 'flex', gap: '30px', fontSize: '0.8rem', color: '#666', alignItems: 'center'
            }}>
              <div style={{ fontWeight: 'bold' }}>凡例:</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', fontSize: '0.75rem', color: '#666' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <div style={{ width: '12px', height: '12px', border: '1px solid #ddd', background: '#fff' }}></div>
                  <span>通常配当</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <div style={{ width: '12px', height: '12px', background: '#fff9c4', border: '1px solid #ddd' }}></div>
                  <span>重複（1室に複数）</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <div style={{ width: '12px', height: '12px', border: '2px solid #2196f3', background: '#fff' }}></div>
                  <span>連続講時</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <AlertTriangle size={14} color="#d32f2f" />
                  <span>制約違反（定員・機材不足等）</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <div style={{ padding: '0 4px', background: '#fff3e0', border: '1px solid #ff9800', color: '#ff9800', borderRadius: '4px', fontSize: '0.9em', fontWeight: 'bold' }}>条件×</div>
                  <span>不一致（建物・タイプ希望等）</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Selection Modal */}
        {
          pickingCell && (
            <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
              <div style={{ background: '#fff', padding: '20px', borderRadius: '8px', maxWidth: '500px', width: '90%', maxHeight: '80vh', overflow: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                  <h3 style={{ margin: 0 }}>授業を選択</h3>
                  <button onClick={() => setPickingCell(null)} style={{ border: 'none', background: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>✕</button>
                </div>
                <div style={{ marginBottom: '10px', color: '#666', fontSize: '0.9em' }}>
                  {classrooms.find(r => r.id === pickingCell.room)?.name} - {pickingCell.period}講時 ({pickingCell.term === 'spring' ? '春' : '秋'})
                </div>
                {displayedUnassigned.filter(s => {
                    const springGroup = ['spring', 'spring_first', 'spring_second'];
                    const autumnGroup = ['autumn', 'autumn_first', 'autumn_second'];
                    const matchGroup = pickingCell.term === 'spring' ? springGroup : autumnGroup;
                    return matchGroup.includes(s.term) || s.term === 'full_year';
                  }).length === 0 ? (
                  <p style={{ textAlign: 'center', color: '#999', padding: '20px' }}>該当する未配当授業はありません。</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {displayedUnassigned.filter(s => {
                    const springGroup = ['spring', 'spring_first', 'spring_second'];
                    const autumnGroup = ['autumn', 'autumn_first', 'autumn_second'];
                    const matchGroup = pickingCell.term === 'spring' ? springGroup : autumnGroup;
                    return matchGroup.includes(s.term) || s.term === 'full_year';
                  }).map(s => (
                      <button
                        key={s.id}
                        onClick={() => handleQuickAssign(s.id)}
                        style={{
                          padding: '12px', textAlign: 'left', cursor: 'pointer', border: '1px solid #eee', borderRadius: '6px', background: '#fafafa',
                          transition: 'background 0.2s'
                        }}
                        onMouseOver={(e) => (e.currentTarget.style.background = '#f0f0f0')}
                        onMouseOut={(e) => (e.currentTarget.style.background = '#fafafa')}
                      >
                        <div style={{ fontWeight: 'bold', color: '#333' }}>
                          {s.code} / {s.name}
                        </div>
                        <div style={{ fontSize: '0.85em', color: '#666' }}>
                          {s.teacher} / {s.faculty} / {s.department}
                        </div>
                        <div style={{ fontSize: '0.82em', color: '#888' }}>
                          履修想定人数: {s.requiredCapacity}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                <button onClick={() => setPickingCell(null)} style={{ marginTop: '20px', width: '100%', padding: '10px', cursor: 'pointer', background: '#eee', border: 'none', borderRadius: '4px', fontWeight: 'bold' }}>閉じる</button>
              </div>
            </div>
          )
        }

        {/* Classroom Manager Overlay */}
        {
          showManager && (
            <ClassroomManager
              classrooms={classrooms}
              onUpdate={handleClassroomUpdate}
              currentCampusLabel={currentCampusLabel}
              onClose={() => setShowManager(false)}
            />
          )
        }

        {/* Subject Manager Overlay */}
        {
          showSubjectManager && (
            <SubjectManager
              subjects={subjects}
              allocations={allocations}
              classrooms={classrooms}
              currentCampusLabel={currentCampusLabel}
              subjectTaxonomy={subjectTaxonomy}
              onUpdate={handleSubjectUpdate}
              onUpdateAllocations={setAllocations}
              onUpdateSubjectTaxonomy={setSubjectTaxonomy}
              onClose={() => setShowSubjectManager(false)}
            />
          )
        }

        {/* Subject Individual Edit Modal */}
        {
          editingSubject && (
            <SubjectEditModal
              subject={editingSubject}
              availableEquipment={subjectEquipmentOptions}
              currentCampusLabel={currentCampusLabel}
              facultyOptions={subjectTaxonomy.faculties}
              departmentOptions={subjectTaxonomy.departments}
              onSave={(updated) => {
                setSubjects(prev => {
                  const next = prev.map(s => s.id === updated.id ? { ...updated, campus: normalizeCampusLabel(updated.campus || currentCampusLabel) || currentCampusLabel } : s);
                  return next;
                });
                setEditingSubjectId(null);
              }}
              onClose={() => setEditingSubjectId(null)}
            />
          )
        }

        {/* Classroom Individual Edit Modal */}
        {
          editingClassroom && (
            <ClassroomEditModal
              classroom={editingClassroom}
              existingIds={classrooms.map(r => r.id)}
              onSave={(updated) => {
                setClassrooms(prev => prev.map(r => r.id === editingClassroom.id ? updated : r));
                setEditingClassroomId(null);
              }}
              onClose={() => setEditingClassroomId(null)}
            />
          )
        }

        {/* Display Settings Overlay */}
        {
          (SHOW_DISPLAY_SETTINGS_BUTTON && showDisplaySettings) && (
            <DisplaySettings
              config={displayConfig}
              availableEquipment={allEquipment}
              onUpdate={setDisplayConfig}
              onClose={() => setShowDisplaySettings(false)}
            />
          )
        }
        {/* Allocation Rule Settings Overlay */}
        {
          showRuleSettings && (
            <AllocationRuleSettings
              settings={allocationSettings}
              equipmentSettings={equipmentSettings}
              onSave={(options) => {
                setAllocationSettings(options.rules);
                setEquipmentSettings(options.equipmentSettings);
                localStorage.setItem('equipmentSettings', JSON.stringify(options.equipmentSettings)); // 念のため即時保存
                handleAutoAllocatePhase3(options);
              }}
              onClose={() => setShowRuleSettings(false)}
              onResetUnassignedStreak={handleResetUnassignedStreak}
              onResetApprovedExceptions={handleResetApprovedExceptions}
            />
          )
        }

        {
          autoAllocationSummary && (
            <AllocationResultModal
              isOpen={!!autoAllocationSummary}
              summary={autoAllocationSummary}
              onClose={() => setAutoAllocationSummary(null)}
              onResolveExceptions={handleResolveCurrentExceptions}
              canResolveExceptions={allocations.some(a => (a.exceptions?.length || 0) > 0 && !a.exceptionApproved)}
              resolvingExceptions={resolvingExceptions}
              onRelocate={handleRelocate}
              canRelocate={lastUnassigned.length > 0}
              relocating={relocating}
            />
          )
        }

        {
          showRelocationPreviewModal && pendingRelocationBatch && (
            <RelocationPreviewModal
              isOpen={showRelocationPreviewModal}
              result={pendingRelocationBatch.result}
              subjects={subjects}
              classrooms={classrooms}
              onConfirm={handleConfirmRelocation}
              onCancel={handleCancelRelocation}
            />
          )
        }

        {
          showExceptionReviewModal && pendingAllocationBatch && (
              <ExceptionReviewModal
                isOpen={showExceptionReviewModal}
                exceptions={pendingAllocationBatch.pendingExceptions}
                classrooms={classrooms}
                approvedKeys={pendingExceptionApprovedKeys}
                onApprovedKeysChange={setPendingExceptionApprovedKeys}
                onConfirm={handleConfirmExceptionReview}
                onCancel={handleCancelExceptionReview}
              />
          )
        }

        {
          showCloudReadWarningModal && cloudReadWarningSummary && (
            <CloudReadWarningModal
              isOpen={showCloudReadWarningModal}
              summary={cloudReadWarningSummary}
              onExportCsv={handleCloudReadWarningExport}
              onConfirm={handleCloudReadWarningConfirm}
              onCancel={handleCloudReadWarningCancel}
            />
          )
        }

        {
          showCloudModal && (
            <CloudConnectionModal
              onClose={() => {
                // ユーザーがログインしている場合のみ閉じることができる
                if (user) setShowCloudModal(false);
              }}
              onLogin={(campusId) => handleCloudConnect(campusId)}
              onLogout={authLogout}
              isConnecting={isCloudLoading}
              user={user}
            />
          )
        }
      </div>
    </div>
  );
}

export default App;
