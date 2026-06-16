import { useState, useRef, useEffect, useMemo } from 'react';
import Papa from 'papaparse';
import { flushSync } from 'react-dom';
import type { Subject, Allocation, Classroom, Term, DayOfWeek, Period } from '../types';
import { DAY_LABELS, BUILDINGS, ROOM_TYPE_LABELS, normalizeCampusLabel, getDayLabel, getPeriodLabel, getTermLabel, getEquipmentStyle } from '../types';
import { BookOpen, Plus, Edit2, Trash2, X, Upload, Download, Search } from 'lucide-react';
import { exportToCSV } from '../utils/csvParser';
import { SubjectEditModal } from './SubjectEditModal';
import { normalizeRequiredEquipmentName } from '../types';
import { SUBJECT_EQUIPMENT_CHOICES, filterVisibleRoomEquipment, sortEquipmentByCanonicalOrder } from '../utils/equipmentVisibility';
import type { SubjectTaxonomy } from '../utils/subjectTaxonomy';
import { SubjectTaxonomyModal } from './SubjectTaxonomyModal';
import { ImportErrorCsvDialog } from './ImportErrorCsvDialog';

function equipValue(
    eq: string,
    requiresMovable?: boolean,
    requiresProjector?: boolean,
    mandatory?: string[],
    preferred?: string[]
): string {
    const man = (mandatory ?? []).map(normalizeRequiredEquipmentName);
    const pref = (preferred ?? []).map(normalizeRequiredEquipmentName);
    const normalizedEq = normalizeRequiredEquipmentName(eq);
    const manHasProjector = man.some(item => item.startsWith('PJ'));
    const prefHasProjector = pref.some(item => item.startsWith('PJ'));
    if (requiresMovable && normalizedEq === '可動') return '◎';
    if (normalizedEq.startsWith('PJ')) {
        if (man.includes(normalizedEq)) return '◎';
        if (pref.includes(normalizedEq)) return '○';
        if (requiresProjector && normalizedEq === 'PJ(中)' && !manHasProjector && !prefHasProjector) return '◎';
    }
    if (man.includes(normalizedEq)) return '◎';
    if (pref.includes(normalizedEq)) return '○';
    return '';
}

const normalizeCsvHeader = (value: string) => value.replace(/^\uFEFF/, '').trim();

const SUBJECT_IMPORT_TEXT_ENCODINGS = ['utf-8', 'shift_jis', 'windows-31j'] as const;

const decodeCsvFile = async (file: File) => {
    const buffer = await file.arrayBuffer();
    const encoderNames = SUBJECT_IMPORT_TEXT_ENCODINGS as readonly string[];
    const fallbackDecoded = new TextDecoder('utf-8').decode(buffer);
    let bestDecoded = fallbackDecoded;
    let bestMatchCount = -1;
    for (const encoding of encoderNames) {
        try {
            const decoded = new TextDecoder(encoding).decode(buffer);
            const headerLine = decoded.split(/\r?\n/, 1)[0] ?? '';
            const headers = headerLine.split(',').map(normalizeCsvHeader).filter(Boolean);
            const matchCount = SUBJECT_IMPORT_REQUIRED_COLUMNS.filter(col =>
                headers.some(header => col.aliases.some(alias => normalizeCsvHeader(header) === normalizeCsvHeader(alias)))
            ).length;
            if (matchCount > bestMatchCount) {
                bestMatchCount = matchCount;
                bestDecoded = decoded;
            }
        } catch {
            // 次の候補へフォールバックする
        }
    }
    return bestMatchCount > 0 ? bestDecoded : fallbackDecoded;
};

const getCsvValue = (row: Record<string, string>, aliases: string[]) => {
    const key = Object.keys(row).find(header =>
        aliases.some(alias => normalizeCsvHeader(header) === normalizeCsvHeader(alias))
    );
    return key ? String(row[key] ?? '').trim() : '';
};

const hasCsvHeader = (headers: string[], aliases: string[]) => {
    return headers.some(header =>
        aliases.some(alias => normalizeCsvHeader(header) === normalizeCsvHeader(alias))
    );
};

const SUBJECT_IMPORT_REQUIRED_COLUMNS: { label: string; aliases: string[] }[] = [
  { label: 'コード', aliases: ['コード', '時間割コード', 'Code', 'ID'] },
  { label: '時間割名称', aliases: ['時間割名称', '授業名称', 'Name'] },
  { label: '教員コード', aliases: ['教員コード', 'TeacherCode'] },
  { label: '教員名', aliases: ['教員名', '教員', 'Teacher', '代表教員'] },
  { label: '開講学部', aliases: ['開講学部', 'Faculty'] },
  { label: '管轄', aliases: ['管轄', '学科', 'Department'] },
    { label: '配当期', aliases: ['配当期', '学期', 'Term'] },
    { label: '曜日', aliases: ['曜日', 'Day'] },
    { label: '講時', aliases: ['講時', '開始講時', 'Period'] },
    { label: 'キャンパス', aliases: ['キャンパス', 'Campus'] },
    { label: '必要教室数', aliases: ['必要教室数', 'RequiredRoomCount'] },
    { label: 'タイプ', aliases: ['タイプ', '希望教室タイプ', 'PreferredRoomType'] }
] as const;

type ParsedSubjectCsvRow = {
    subject: Subject;
    classroomId: string;
};

type SubjectImportIssue = {
    lineNumber?: number;
    errorType: string;
    targetColumn?: string;
    detail: string;
    suggestion: string;
    code?: string;
    name?: string;
    teacherCode?: string;
    teacher?: string;
    campus?: string;
    classroomId?: string;
};

type ParsedSubjectCsv = {
    subjects: Subject[];
    rows: ParsedSubjectCsvRow[];
    issues: SubjectImportIssue[];
};

type SubjectImportErrorCsvRow = {
    行番号: string;
    コード: string;
    時間割名称: string;
    教員コード: string;
    教員名: string;
    キャンパス: string;
    教室ID: string;
    エラー種別: string;
    対象列: string;
    詳細: string;
    修正案: string;
};

const buildSubjectIssueContext = (row: Record<string, string>, lineNumber: number, classroomId = '') => ({
    lineNumber,
    code: getCsvValue(row, ['コード', '時間割コード', 'Code', 'ID']),
    name: getCsvValue(row, ['時間割名称', '授業名称', 'Name']),
    teacherCode: getCsvValue(row, ['教員コード', 'TeacherCode']),
    teacher: getCsvValue(row, ['教員名', 'Teacher', '教員', '代表教員']),
    campus: getCsvValue(row, ['キャンパス', 'Campus']),
    classroomId
});

const toSubjectImportErrorRows = (issues: SubjectImportIssue[]): SubjectImportErrorCsvRow[] => issues.map(issue => ({
    行番号: issue.lineNumber ? String(issue.lineNumber) : '',
    コード: issue.code ?? '',
    時間割名称: issue.name ?? '',
    教員コード: issue.teacherCode ?? '',
    教員名: issue.teacher ?? '',
    キャンパス: issue.campus ?? '',
    教室ID: issue.classroomId ?? '',
    エラー種別: issue.errorType,
    対象列: issue.targetColumn ?? '',
    詳細: issue.detail,
    修正案: issue.suggestion
}));

const buildSubjectImportIssues = (
    data: ParsedSubjectCsv,
    currentCampusLabel: string,
    classrooms: Classroom[]
): SubjectImportIssue[] => {
    const issues = [...data.issues];
    const campusLabel = normalizeCampusLabel(currentCampusLabel) || currentCampusLabel;
    const classroomIdSet = new Set(classrooms.map(room => room.id));

    data.rows.forEach((row, index) => {
        const lineNumber = index + 2;
        const subject = row.subject;
        const rowCampus = normalizeCampusLabel(subject.campus || '') || '';
        const rowContext = buildSubjectIssueContext({
            コード: subject.code || '',
            時間割名称: subject.name || '',
            教員コード: subject.teacherCode || '',
            教員名: subject.teacher || '',
            キャンパス: subject.campus || ''
        }, lineNumber, row.classroomId);

        if (subject.campus && rowCampus !== campusLabel) {
            issues.push({
                ...rowContext,
                errorType: 'キャンパス不一致',
                targetColumn: 'キャンパス',
                detail: `キャンパス「${subject.campus || ''}」が現在のキャンパス「${currentCampusLabel}」と一致しません。`,
                suggestion: `CSVのキャンパスを「${currentCampusLabel}」に揃えてください。`
            });
        }

        if (row.classroomId && !classroomIdSet.has(row.classroomId)) {
            issues.push({
                ...rowContext,
                errorType: '教室ID不一致',
                targetColumn: '教室ID',
                detail: `教室ID「${row.classroomId}」が現在の教室マスタに存在しません。`,
                suggestion: '現在の教室マスタに存在する教室IDへ修正してください。'
            });
        }
    });

    const requiredRoomCountByCode = new Map<string, number>();
    data.subjects.forEach(subject => {
        const code = (subject.code || '').trim();
        if (!code) return;
        const count = subject.requiredRoomCount || 1;
        requiredRoomCountByCode.set(code, Math.max(requiredRoomCountByCode.get(code) || 0, count));
    });

    const classroomRowsByCode = new Map<string, ParsedSubjectCsvRow[]>();
    data.rows.forEach(row => {
        const code = (row.subject.code || '').trim();
        if (!code || !row.classroomId) return;
        const list = classroomRowsByCode.get(code) ?? [];
        list.push(row);
        classroomRowsByCode.set(code, list);
    });

    classroomRowsByCode.forEach((rows, code) => {
        const requiredCount = requiredRoomCountByCode.get(code) || 1;
        if (rows.length <= requiredCount) return;
        rows.slice(requiredCount).forEach((row) => {
            issues.push({
                lineNumber: data.rows.indexOf(row) + 2,
                code: row.subject.code || '',
                name: row.subject.name || '',
                teacherCode: row.subject.teacherCode || '',
                teacher: row.subject.teacher || '',
                campus: row.subject.campus || '',
                classroomId: row.classroomId,
                errorType: '必要教室数超過',
                targetColumn: '教室ID',
                detail: `授業コード「${code}」は必要教室数${requiredCount}件ですが、${rows.length}件の教室配当があります。`,
                suggestion: '不要な教室IDの行を削除するか、必要教室数を見直してください。'
            });
        });
    });

    return issues;
};

const parseSubjectCSVWithTbd = (file: File): Promise<ParsedSubjectCsv> => {
    return new Promise((resolve, reject) => {
        void decodeCsvFile(file).then((text) => {
            Papa.parse(text, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                const rows = results.data as Record<string, string>[];
                const headers = (results.meta.fields || []).map(normalizeCsvHeader).filter(Boolean);
                const missingHeaders = SUBJECT_IMPORT_REQUIRED_COLUMNS.filter(col => !hasCsvHeader(headers, col.aliases));
                if (missingHeaders.length > 0) {
                    resolve({
                        subjects: [],
                        rows: [],
                        issues: missingHeaders.map(col => ({
                            errorType: '必須列不足',
                            targetColumn: col.label,
                            detail: `必須列「${col.label}」が見つかりません。`,
                            suggestion: `CSVのヘッダーに「${col.label}」列を追加してください。`
                        }))
                    });
                    return;
                }

                const issues: SubjectImportIssue[] = [];
                rows.forEach((row, index) => {
                    const lineNumber = index + 2;
                    const context = buildSubjectIssueContext(row, lineNumber);
                    const missing = SUBJECT_IMPORT_REQUIRED_COLUMNS.filter(col => !getCsvValue(row, col.aliases));
                    missing.forEach(col => {
                        issues.push({
                            ...context,
                            errorType: '必須項目不足',
                            targetColumn: col.label,
                            detail: `「${col.label}」が空欄です。`,
                            suggestion: `「${col.label}」を入力してください。`
                        });
                    });
                    const periodRaw = getCsvValue(row, ['講時', '開始講時', 'Period']);
                    const periodValue = parseInt(periodRaw, 10);
                    if (getCsvValue(row, ['講時', '開始講時', 'Period']) && (!Number.isFinite(periodValue) || periodValue < 0)) {
                        issues.push({
                            ...context,
                            errorType: '講時不正',
                            targetColumn: '講時',
                            detail: `講時の値「${periodRaw}」が不正です。`,
                            suggestion: '開始講時を 0 以上の数値で入力してください。'
                        });
                    }
                    const roomCountValue = parseInt(getCsvValue(row, ['必要教室数', 'RequiredRoomCount']), 10);
                    if (getCsvValue(row, ['必要教室数', 'RequiredRoomCount']) && (!Number.isFinite(roomCountValue) || roomCountValue <= 0)) {
                        issues.push({
                            ...context,
                            errorType: '必要教室数不正',
                            targetColumn: '必要教室数',
                            detail: `必要教室数の値「${getCsvValue(row, ['必要教室数', 'RequiredRoomCount'])}」が不正です。`,
                            suggestion: '必要教室数には 1 以上の数値を入力してください。'
                        });
                    }
                });

                const rawRows = rows.map((row) => ({
                    id: row.ID || row['コード'] || row['時間割コード'] || `s-${Math.random().toString(36).substr(2, 9)}`,
                    code: row['コード'] || row['時間割コード'] || row.Code || row.ID,
                    name: row['時間割名称'] || row.Name || row['授業名称'],
                    teacherCode: row['教員コード'] || row.TeacherCode || '',
                    teacher: row['教員名'] || row.Teacher || row['教員'] || row['代表教員'],
                    department: row['管轄'] || row.Department || '',
                    faculty: row['開講学部'] || row.Faculty || '',
                    term: (() => {
                        const t = row['配当期'] || row.Term || row['学期'] || '';
                        if (t === '0' || t === '未定' || t === '') return '' as Term;
                        if (t === '春学期' || t === '春') return 'spring';
                        if (t === '春前半') return 'spring_first';
                        if (t === '春後半') return 'spring_second';
                        if (t === '秋学期' || t === '秋') return 'autumn';
                        if (t === '秋前半') return 'autumn_first';
                        if (t === '秋後半') return 'autumn_second';
                        if (t === '通年') return 'full_year';
                        return (t as Term) || '' as Term;
                    })(),
                    day: (() => {
                        const d = row['曜日'] || row.Day || '';
                        if (d === '0' || d === '未定' || d === '') return '' as DayOfWeek;
                        const map: Record<string, DayOfWeek> = { '月': 'mon', '火': 'tue', '水': 'wed', '木': 'thu', '金': 'fri', '土': 'sat' };
                        return map[d] || d as DayOfWeek;
                    })(),
                    period: (() => {
                        const raw = row['講時'] || row['開始講時'] || row.Period || '';
                        if (raw === '0' || raw === '未定' || raw === '') return 0 as Period;
                        return parseInt(raw, 10) as Period;
                    })(),
                    endPeriod: (() => {
                        const raw = row['終了講時'] || row.EndPeriod || '';
                        if (raw === '0' || raw === '未定' || raw === '') return undefined;
                        return (parseInt(raw, 10) || undefined) as Period | undefined;
                    })(),
                    requiredCapacity: parseInt(row['履修者数'] || row.RequiredCapacity || row['履修予定人数'] || row['履修想定人数'] || row['定員'], 10) || 0,
                    campus: row['キャンパス'] || row.Campus || '',
                    requiredRoomCount: parseInt(row['必要教室数'] || row.RequiredRoomCount, 10) || 1,
                    previousRooms: row.PreviousRooms || row['過去教室'] || row['過去教室(区切り)'] ? (row.PreviousRooms || row['過去教室'] || row['過去教室(区切り)']).split(/[;,\s、]+/).map((s: string) => s.trim()).filter(Boolean) : [],
                    preferredRoomType: (() => {
                        const t = row['タイプ'] || row.PreferredRoomType || '';
                        if (t === 'PC') return 'pc';
                        if (t === 'ゼミ') return 'seminar';
                        if (t === '一般') return 'normal';
                        return t ? (t as Subject['preferredRoomType']) : undefined;
                    })(),
                    requiresProjector: SUBJECT_EQUIPMENT_CHOICES.some(eq => eq.startsWith('PJ') && row[eq] === '◎') || row.RequiresProjector === 'true' || row.RequiresProjector === '1',
                    requiresMovable: SUBJECT_EQUIPMENT_CHOICES.some(eq => normalizeRequiredEquipmentName(eq) === '可動' && row[eq] === '◎') || row.RequiresMovable === 'true' || row.RequiresMovable === '1',
                    priority: parseInt(row['優先度'] || row.Priority, 10) || 1,
                    isContinuous: row.IsContinuous === 'true' || row.IsContinuous === '1',
                    buildingPreference: row['希望建物'] || row['棟希望'] || row.BuildingPreference || '',
                    mandatoryEquipment: SUBJECT_EQUIPMENT_CHOICES.filter(eq => row[eq] === '◎').map(normalizeRequiredEquipmentName),
                    requiredEquipment: SUBJECT_EQUIPMENT_CHOICES.filter(eq => row[eq] === '○').map(normalizeRequiredEquipmentName)
                } as Subject));
                const classroomRows = rows.map((row, index) => ({
                    subject: rawRows[index],
                    classroomId: getCsvValue(row, ['教室ID', 'classroomId', 'ClassroomId'])
                }));

                const normalizedSubjects = rawRows.map(s => ({
                    ...s,
                    campus: normalizeCampusLabel(s.campus || '') || '',
                    requiredEquipment: s.requiredEquipment || [],
                    mandatoryEquipment: s.mandatoryEquipment || []
                }));

                const grouped = new Map<string, Subject>();
                normalizedSubjects.forEach(s => {
                    const key = `${s.code}-${s.term}-${s.day}-${s.period}`;
                    if (grouped.has(key)) {
                        const existing = grouped.get(key)!;
                        existing.requiredRoomCount = Math.max(existing.requiredRoomCount || 1, s.requiredRoomCount || 1);
                        if (s.previousRooms && s.previousRooms.length > 0) {
                            existing.previousRooms = Array.from(new Set([...(existing.previousRooms || []), ...s.previousRooms]));
                        }
                    } else {
                        grouped.set(key, { ...s });
                    }
                });

                resolve({ subjects: Array.from(grouped.values()), rows: classroomRows, issues });
            },
            error: (error: unknown) => reject(error instanceof Error ? error : new Error(String(error)))
            });
        }).catch(reject);
    });
};

interface Props {
    subjects: Subject[];
    allocations: Allocation[];
    classrooms: Classroom[];
    currentCampusLabel: string;
    subjectTaxonomy: SubjectTaxonomy;
    onUpdate: (updated: Subject[]) => void;
    onUpdateAllocations: (updated: Allocation[]) => void;
    onUpdateSubjectTaxonomy: (updated: SubjectTaxonomy) => void;
    onClose: () => void;
}

type SubjectFilters = {
    code: string;
    name: string;
    teacherCode: string;
    teacher: string;
    faculty: string[];
    department: string[];
    term: Term[];
    day: DayOfWeek[];
    period: string[];
    campus: string;
    requiredCapacity: string;
    requiredCapacityMax: string;
    priority: number[];
    requiredRoomCount: number[];
    buildingPreference: string[];
    preferredRoomType: string[];
    previousRooms: string;
    requiredEquipment: string;
    allocatedRoom: string;
};

const EMPTY_SUBJECT_FILTERS: SubjectFilters = {
    code: '',
    name: '',
    teacherCode: '',
    teacher: '',
    faculty: [],
    department: [],
    term: [],
    day: [],
    period: [],
    campus: '',
    requiredCapacity: '',
    requiredCapacityMax: '',
    priority: [],
    requiredRoomCount: [],
    buildingPreference: [],
    preferredRoomType: [],
    previousRooms: '',
    requiredEquipment: '',
    allocatedRoom: ''
};

// マルチセレクトドロップダウンコンポーネント
const MultiSelectFilter = ({
    options,
    selected,
    onChange,
    placeholder = '全て'
}: {
    options: { value: string | number, label: string }[],
    selected: (string | number)[],
    onChange: (values: (string | number)[]) => void,
    placeholder?: string
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleOption = (value: string | number) => {
        const newSelected = selected.includes(value)
            ? selected.filter(v => v !== value)
            : [...selected, value];
        onChange(newSelected);
    };

    const displayText = selected.length === 0
        ? placeholder
        : selected.length === 1
            ? options.find(o => o.value === selected[0])?.label || selected[0]
            : `${selected.length}項目選択`;

    return (
        <div ref={dropdownRef} style={{ position: 'relative', width: '100%', userSelect: 'none' }}>
            <div
                onMouseDown={(e) => {
                    e.stopPropagation();
                    setIsOpen(!isOpen);
                }}
                style={{
                    padding: '4px 6px',
                    borderRadius: '4px',
                    border: '1px solid #ccc',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    background: '#fff',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    minHeight: '26px',
                    gap: '4px'
                }}
                className="hover:border-blue-400"
            >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{displayText}</span>
                <span style={{ fontSize: '0.6rem', color: '#888', flexShrink: 0 }}>{isOpen ? '▲' : '▼'}</span>
            </div>
            {isOpen && (
                <div
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        width: 'auto',
                        minWidth: 'max(140px, 100%)',
                        maxHeight: '350px',
                        overflowY: 'auto',
                        background: '#fff',
                        border: '1px solid #ccc',
                        borderRadius: '6px',
                        boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
                        zIndex: 5000,
                        marginTop: '4px'
                    }}
                >
                    <div
                        onClick={() => { onChange([]); }}
                        style={{ padding: '8px 10px', cursor: 'pointer', borderBottom: '1px solid #eee', fontSize: '0.8rem', color: '#666', background: '#f9f9f9', fontWeight: 'bold' }}
                    >
                        (選択解除)
                    </div>
                    {options.map(opt => (
                        <div
                            key={opt.value}
                            onClick={(e) => { e.stopPropagation(); toggleOption(opt.value); }}
                            style={{
                                padding: '8px 12px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                fontSize: '0.8rem',
                                background: selected.includes(opt.value) ? '#f0f4ff' : 'transparent',
                                transition: 'background 0.1s'
                            }}
                            className="hover:bg-gray-100"
                        >
                            <input
                                type="checkbox"
                                checked={selected.includes(opt.value)}
                                readOnly
                                style={{ margin: 0, cursor: 'pointer', pointerEvents: 'none' }}
                            />
                            <span style={{ flex: 1 }}>{opt.label}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

type SMColDef = {
    key: string;
    label: string;
    width: number;
    required?: boolean;
};

const SM_COL_DEFS: readonly SMColDef[] = [
    { key: 'code', label: 'コード', width: 70, required: true },
    { key: 'name', label: '時間割名称', width: 208, required: true },
    { key: 'teacherCode', label: '教員コード', width: 90, required: true },
    { key: 'teacher', label: '教員', width: 104, required: true },
    { key: 'faculty', label: '学部', width: 78, required: true },
    { key: 'department', label: '管轄', width: 50, required: true },
    { key: 'term', label: '学期', width: 77, required: true },
    { key: 'day', label: '曜日', width: 60, required: true },
    { key: 'period', label: '講時', width: 70, required: true },
    { key: 'campus', label: 'キャンパス', width: 70, required: true },
    { key: 'requiredCapacity', label: '定員', width: 90, required: false },
    { key: 'priority', label: '優先度', width: 65 },
    { key: 'requiredRoomCount', label: '数', width: 55, required: true },
    { key: 'buildingPreference', label: '希望建物', width: 60 },
    { key: 'preferredRoomType', label: 'タイプ', width: 60, required: true },
    { key: 'requiredEquipment', label: '機材･設備', width: 130 },
    { key: 'previousRooms', label: '過去教室', width: 80 },
    { key: 'allocatedRoom', label: '配当教室', width: 100 },
] as const;
type SMColKey = typeof SM_COL_DEFS[number]['key'];
type SMColConfig = Record<SMColKey, { width: number; hidden: boolean; required: boolean }>;
const smColDefaults = (): SMColConfig => Object.fromEntries(SM_COL_DEFS.map(c => [c.key, { width: c.width, hidden: false }])) as SMColConfig;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const parseSMColConfig = (raw: string | null): SMColConfig => {
    const defaults = smColDefaults();
    if (!raw) return defaults;
    try {
        const parsed: unknown = JSON.parse(raw);
        if (!isRecord(parsed)) return defaults;
        return {
            ...defaults,
            ...Object.fromEntries(
                SM_COL_DEFS.map(({ key }) => {
                    const current = isRecord(parsed[key]) ? parsed[key] : undefined;
                    const savedWidth = current && typeof current.width === 'number' && Number.isFinite(current.width) ? current.width : defaults[key].width;
                    const savedHidden = current && typeof current.hidden === 'boolean' ? current.hidden : defaults[key].hidden;
                    return [key, { ...defaults[key], width: Math.max(30, savedWidth), hidden: savedHidden }];
                })
            ) as SMColConfig
        };
    } catch {
        return defaults;
    }
};

const mergeSubjectsByCode = (existing: Subject[], imported: Subject[]) => {
    const next = [...existing];
    imported.forEach(subject => {
        const key = (subject.code || '').trim() || subject.id;
        const index = next.findIndex(item => ((item.code || '').trim() || item.id) === key);
        if (index >= 0) {
            const current = next[index];
            next[index] = { ...current, ...subject, id: current.id };
        } else {
            next.push(subject);
        }
    });
    return next;
};

const sortSubjectsByCode = (items: Subject[]) =>
    [...items].sort((a, b) => {
        const codeA = (a.code || a.id || '').trim();
        const codeB = (b.code || b.id || '').trim();
        const cmp = codeA.localeCompare(codeB, 'ja', { numeric: true, sensitivity: 'base' });
        if (cmp !== 0) return cmp;
        return (a.name || '').localeCompare(b.name || '', 'ja', { numeric: true, sensitivity: 'base' });
    });

export const SubjectManager = ({
    subjects,
    allocations,
    classrooms,
    currentCampusLabel,
    subjectTaxonomy,
    onUpdate,
    onUpdateAllocations,
    onUpdateSubjectTaxonomy,
    onClose
}: Props) => {
    const [editingSubjectModal, setEditingSubjectModal] = useState<Subject | null>(null);
    const [subjectModalMode, setSubjectModalMode] = useState<'add' | 'edit' | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [colConfig, setColConfig] = useState<SMColConfig>(() => parseSMColConfig(localStorage.getItem('smColConfig')));
    const [showColSettings, setShowColSettings] = useState(false);
    const [showTaxonomyModal, setShowTaxonomyModal] = useState(false);
    const smColSettingsRef = useRef<HTMLDivElement>(null);
    const subjectScrollRef = useRef<HTMLDivElement>(null);
    const [subjectViewportHeight, setSubjectViewportHeight] = useState(0);
    const [subjectScrollTop, setSubjectScrollTop] = useState(0);
    const [subjectListReady, setSubjectListReady] = useState(false);
    const [subjectImportErrorCsv, setSubjectImportErrorCsv] = useState<{
        title: string;
        message: string;
        filename: string;
        rows: Record<string, unknown>[];
    } | null>(null);
    useEffect(() => { localStorage.setItem('smColConfig', JSON.stringify(colConfig)); }, [colConfig]);
    useEffect(() => {
        if (!showColSettings) return;
        const handler = (event: MouseEvent) => {
            if (smColSettingsRef.current && !smColSettingsRef.current.contains(event.target as Node)) {
                setShowColSettings(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [showColSettings]);
    const smShow = (k: SMColKey) => !colConfig[k].hidden;
    const smW = (k: SMColKey) => `${colConfig[k].width}px`;
    const smToggle = (k: SMColKey) => setColConfig(c => ({ ...c, [k]: { ...c[k], hidden: !c[k].hidden } }));
    const smSetW = (k: SMColKey, w: number) => setColConfig(c => ({ ...c, [k]: { ...c[k], width: Math.max(30, w) } }));
    const [showCsvHint, setShowCsvHint] = useState(false);
    const csvHintRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!showCsvHint) return;
        const handler = (e: MouseEvent) => { if (csvHintRef.current && !csvHintRef.current.contains(e.target as Node)) setShowCsvHint(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [showCsvHint]);

    const openTaxonomyModal = () => setShowTaxonomyModal(true);

    const smDrag = (k: SMColKey) => (e: React.MouseEvent) => {
        e.preventDefault(); e.stopPropagation();
        const x0 = e.clientX, w0 = colConfig[k].width;
        const onMove = (ev: MouseEvent) => smSetW(k, w0 + ev.clientX - x0);
        const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    };
    const smRH = (k: SMColKey) => <div onMouseDown={smDrag(k)} style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '5px', cursor: 'col-resize', zIndex: 1 }} />;

    const availableEquipment = useMemo(() => {
        const set = new Set<string>(SUBJECT_EQUIPMENT_CHOICES);
        classrooms.forEach(c => filterVisibleRoomEquipment(c.equipment).forEach(e => set.add(e)));
        return sortEquipmentByCanonicalOrder(Array.from(set));
    }, [classrooms]);
    const facultyOptions = subjectTaxonomy.faculties;
    const departmentOptions = subjectTaxonomy.departments;

    const createBlankSubject = (): Subject => ({
        id: `s-${Date.now()}`,
        code: '',
        name: '',
        teacherCode: '',
        teacher: '',
        faculty: '',
        department: '',
        term: '' as Term,
        day: '' as DayOfWeek,
        period: 0 as Period,
        requiredCapacity: 0,
        priority: 1,
        campus: currentCampusLabel,
        requiredEquipment: [],
        previousRooms: [],
        requiredRoomCount: 1,
        buildingPreference: ''
    });

    // フィルタステート（配列で保持）
    const [filters, setFilters] = useState<SubjectFilters>({ ...EMPTY_SUBJECT_FILTERS });

    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

    const periodFilterOptions = useMemo(() => ([
        { value: '0' as const, label: '未定' },
        { value: '1' as const, label: '1講時' },
        { value: '2' as const, label: '2講時' },
        { value: '3' as const, label: '3講時' },
        { value: '4' as const, label: '4講時' },
        { value: '5' as const, label: '5講時' },
        { value: '6' as const, label: '6講時' },
        { value: '7' as const, label: '7講時' }
    ]), []);

    const termFilterOptions = useMemo(() => {
        const options = [
            { value: '' as Term, label: '未定' },
            { value: 'spring' as Term, label: '春学期' },
            { value: 'spring_first' as Term, label: '春前半' },
            { value: 'spring_second' as Term, label: '春後半' },
            { value: 'autumn' as Term, label: '秋学期' },
            { value: 'autumn_first' as Term, label: '秋前半' },
            { value: 'autumn_second' as Term, label: '秋後半' },
            { value: 'full_year' as Term, label: '通年' }
        ];
        return Array.from(new Map(options.map(item => [String(item.value), item])).values());
    }, []);

    const dayFilterOptions = useMemo(() => {
        const options = [
            { value: '' as DayOfWeek, label: '未定' },
            ...Object.entries(DAY_LABELS).map(([v, l]) => ({ value: v as DayOfWeek, label: l }))
        ];
        return Array.from(new Map(options.map(item => [String(item.value), item])).values());
    }, []);

    const handleEdit = (subject: Subject) => {
        setSubjectModalMode('edit');
        setEditingSubjectModal(subject);
    };

    const getSubjectPeriodTokens = (subject: Subject) => {
        if (!subject.period || subject.period <= 0) return ['0'];
        const end = subject.endPeriod && subject.endPeriod > subject.period ? subject.endPeriod : subject.period;
        return Array.from({ length: Math.max(1, end - subject.period + 1) }, (_, index) => String(subject.period + index));
    };

    // フィルタリング処理（メモ化）
    const filteredSubjects = useMemo(() => {
        return subjects.filter(s => {
            // テキスト系：スペース区切りOR検索
            const checkText = (text: unknown, query: string) => {
                if (!query) return true;
                const keywords = query.toLowerCase().split(/\s+/).filter(k => !!k);
                if (keywords.length === 0) return true;
                const target = String(text || '').toLowerCase();
                return keywords.every(k => target.includes(k));
            };

            if (!checkText(s.code, filters.code)) return false;
            if (!checkText(s.name, filters.name)) return false;
            if (!checkText(s.teacherCode || '', filters.teacherCode)) return false;
            if (!checkText(s.teacher, filters.teacher)) return false;

            // 選択系：配列に含まれているか
            if (filters.faculty.length > 0 && !filters.faculty.includes(s.faculty)) return false;
            if (filters.department.length > 0 && !filters.department.includes(s.department)) return false;
            if (filters.term.length > 0 && !filters.term.includes(s.term)) return false;
            if (filters.day.length > 0 && !filters.day.includes(s.day)) return false;
            // 講時フィルタ: 選択された講時に、科目側の講時がすべて含まれるものを対象にする
            if (filters.period.length > 0) {
                const subjectPeriods = getSubjectPeriodTokens(s);
                if (!subjectPeriods.every(period => filters.period.includes(period))) return false;
            }
            if (filters.priority.length > 0 && !filters.priority.includes(s.priority)) return false;
            if (filters.buildingPreference.length > 0 && (!s.buildingPreference || !filters.buildingPreference.some(b => s.buildingPreference?.includes(b)))) return false;
            if (filters.preferredRoomType.length > 0 && (!s.preferredRoomType || !filters.preferredRoomType.includes(s.preferredRoomType))) return false;

            // 数値系
            if (filters.requiredCapacity && s.requiredCapacity < Number(filters.requiredCapacity)) return false;
            if (filters.requiredCapacityMax && s.requiredCapacity > Number(filters.requiredCapacityMax)) return false;
            if (filters.requiredRoomCount.length > 0 && !filters.requiredRoomCount.includes(s.requiredRoomCount || 1)) return false;

            // テキスト系（配列など）
            if (filters.campus && !checkText(s.campus || '', filters.campus)) return false;
            if (filters.previousRooms && !checkText(s.previousRooms?.join(' ') || '', filters.previousRooms)) return false;
            if (filters.requiredEquipment) {
                const equipmentText = sortEquipmentByCanonicalOrder([
                    ...(s.mandatoryEquipment || []),
                    ...(s.requiredEquipment || [])
                ]).join(' ');
                if (!checkText(equipmentText, filters.requiredEquipment)) return false;
            }

            return true;
        });
    }, [subjects, filters]);

    // ソート処理（メモ化）
    const sortedSubjects = useMemo(() => {
        return [...filteredSubjects].sort((a, b) => {
            if (!sortConfig) return 0;
            const { key, direction } = sortConfig;

            const getValue = (obj: unknown, k: string) => {
                if (!obj || typeof obj !== 'object') return '';
                const val = (obj as Record<string, unknown>)[k];
                if (k === 'period' || k === 'requiredRoomCount' || k === 'requiredCapacity' || k === 'priority') {
                    return Number(val || 0);
                }
                if (k === 'term') {
                    const order: Record<string, number> = { spring: 1, spring_first: 2, spring_second: 3, autumn: 4, autumn_first: 5, autumn_second: 6, full_year: 7 };
                    return order[typeof val === 'string' ? val : ''] ?? 8;
                }
                if (k === 'day') return Object.keys(DAY_LABELS).indexOf(typeof val === 'string' ? val : 'mon');
                if (Array.isArray(val)) return val.join(',');
                return String(val || '').toLowerCase();
            };

            const aVal = getValue(a, key);
            const bVal = getValue(b, key);

            if (aVal < bVal) return direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [filteredSubjects, sortConfig]);

    const visibleSubjectColumns = SM_COL_DEFS.filter(col => smShow(col.key)).length + 1;

    useEffect(() => {
        const el = subjectScrollRef.current;
        if (!el) return;

        const updateHeight = () => setSubjectViewportHeight(el.clientHeight);
        updateHeight();
        setSubjectListReady(true);

        if (typeof ResizeObserver === 'undefined') return;

        const observer = new ResizeObserver(() => updateHeight());
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    const virtualizedSubjects = useMemo(() => {
        const total = sortedSubjects.length;
        const rowEstimate = 56;
        const overscan = 10;

        if (total === 0) {
            return {
                enabled: false,
                start: 0,
                end: 0,
                topPadding: 0,
                bottomPadding: 0,
                items: [] as Subject[]
            };
        }

        if (total < 200 || subjectViewportHeight <= 0) {
            return {
                enabled: false,
                start: 0,
                end: total,
                topPadding: 0,
                bottomPadding: 0,
                items: sortedSubjects
            };
        }

        const start = Math.max(0, Math.floor(subjectScrollTop / rowEstimate) - overscan);
        const end = Math.min(total, Math.ceil((subjectScrollTop + subjectViewportHeight) / rowEstimate) + overscan);
        return {
            enabled: true,
            start,
            end,
            topPadding: start * rowEstimate,
            bottomPadding: Math.max(0, (total - end) * rowEstimate),
            items: sortedSubjects.slice(start, end)
        };
    }, [sortedSubjects, subjectScrollTop, subjectViewportHeight]);


    const handleSort = (key: string) => {
        setSortConfig(current => {
            if (current?.key === key) {
                return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
            }
            return { key, direction: 'asc' };
        });
    };

    const handleDelete = (id: string) => {
        if (confirm('本当にこの授業を削除しますか？割り当ても解除されます。')) {
            onUpdate(subjects.filter(s => s.id !== id));
        }
    };

    const handleDeleteAll = () => {
        if (confirm('全ての授業データを削除しますか？この操作は取り消せません。')) {
            onUpdate([]);
        }
    };

    const startAdding = () => {
        setSubjectModalMode('add');
        setEditingSubjectModal(createBlankSubject());
    };

    const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const input = e.currentTarget;
        if (input.files && input.files[0]) {
            try {
                const data = await parseSubjectCSVWithTbd(input.files[0]);
                const issues = buildSubjectImportIssues(data, currentCampusLabel, classrooms);
                if (issues.length > 0) {
                    const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+$/, '').replace('T', '_');
                    setSubjectImportErrorCsv({
                        title: '授業CSVインポートエラー',
                        message: `${issues.length}件のエラーがあります。保存先を選んで詳細CSVを出力してください。`,
                        filename: `subject_import_errors_${timestamp}.csv`,
                        rows: toSubjectImportErrorRows(issues)
                    });
                    return;
                }
                const campusLabel = normalizeCampusLabel(currentCampusLabel) || currentCampusLabel;
                const sanitized = data.subjects.map(subject => ({
                    ...subject,
                    campus: campusLabel,
                    requiredEquipment: (subject.requiredEquipment || []).filter(eq => SUBJECT_EQUIPMENT_CHOICES.includes(eq)),
                    mandatoryEquipment: (subject.mandatoryEquipment || []).filter(eq => SUBJECT_EQUIPMENT_CHOICES.includes(eq))
                }));
                if (confirm(`${data.subjects.length}件の授業データを読み込みます。コードが一致する授業は上書きし、一致しないものは追加します。教室IDがある行は配当も復元します。よろしいですか？`)) {
                    const mergedSubjects = mergeSubjectsByCode(subjects, sortSubjectsByCode(sanitized));
                    const importedCodes = new Set(sanitized.map(subject => (subject.code || '').trim()).filter(Boolean));
                    const codeToSubjectId = new Map(
                        mergedSubjects
                            .filter(subject => importedCodes.has((subject.code || '').trim()))
                            .map(subject => [(subject.code || '').trim(), subject.id] as const)
                    );
                    const importedSubjectIds = new Set(codeToSubjectId.values());
                    const preservedAllocations = allocations.filter(allocation => !importedSubjectIds.has(allocation.subjectId));
                    const importedAllocations = data.rows
                        .map(row => {
                            const subjectKey = (row.subject.code || '').trim();
                            const subjectId = codeToSubjectId.get(subjectKey);
                            if (!subjectId || !row.classroomId) return null;
                            return { subjectId, classroomId: row.classroomId };
                        })
                        .filter((item): item is Allocation => item !== null);
                    const dedupedAllocations = Array.from(new Map(
                        [...preservedAllocations, ...importedAllocations].map(allocation => [`${allocation.subjectId}__${allocation.classroomId}`, allocation] as const)
                    ).values());
                    console.debug('subject import allocations', {
                        subjects: data.subjects.length,
                        rows: data.rows.length,
                        importedCodes: importedCodes.size,
                        codeToSubjectId: codeToSubjectId.size,
                        preservedAllocations: preservedAllocations.length,
                        importedAllocations: importedAllocations.length,
                        dedupedAllocations: dedupedAllocations.length
                    });
                    flushSync(() => {
                        onUpdate(mergedSubjects);
                        onUpdateAllocations(dedupedAllocations);
                    });
                }
            } catch (err) {
                alert(err instanceof Error ? err.message : `CSV読み込みエラー: ${String(err)}`);
            } finally {
                input.value = '';
            }
        }
    };

    const SortIcon = ({ columnKey }: { columnKey: string }) => {
        if (sortConfig?.key !== columnKey) return <span style={{ color: '#ccc', fontSize: '10px' }}>▲▼</span>;
        return <span style={{ color: '#000', fontSize: '10px' }}>{sortConfig.direction === 'asc' ? '▲' : '▼'}</span>;
    };

    const thStyle = { padding: '8px', border: '1px solid #ddd', cursor: 'pointer', userSelect: 'none' as const, background: '#f5f5f5', fontSize: '0.8rem', whiteSpace: 'nowrap' as const, position: 'sticky' as const, top: 0, zIndex: 10 };
    const filterInputStyle = { width: '100%', padding: '4px', fontSize: '0.8rem', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box' as const };

    return (
        <div className="manager-overlay" style={{
            position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
            background: '#fff', zIndex: 1000, display: 'flex', flexDirection: 'column'
        }}>
            <header style={{
                padding: '15px 30px', background: '#2d2d2d', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <BookOpen size={22} />
                    <h2 style={{ margin: 0, fontSize: '1.2rem' }}>授業管理</h2>
                </div>
                <button onClick={onClose} style={{
                    background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '1.5rem'
                }}><X /></button>
            </header>

            {/* 固定ヘッダーエリア（スクロール外） */}
            <div style={{ flexShrink: 0, padding: '16px 30px 12px', borderBottom: '1px solid #eee' }}>
                <div style={{ maxWidth: '1600px', margin: '0 auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '12px' }}>
                        <div>
                            <p style={{ color: '#666', margin: '0 0 10px 0' }}>授業情報の編集、削除、一括インポートが行えます。</p>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button onClick={startAdding} style={{
                                    display: 'flex', gap: '8px', alignItems: 'center', background: '#646cff', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.9em'
                                }}>
                                    <Plus size={18} /> 新規追加
                                </button>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <button onClick={() => fileInputRef.current?.click()} style={{
                                        display: 'flex', gap: '8px', alignItems: 'center', background: '#555', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.9em'
                                    }}>
                                        <Upload size={18} /> CSVインポート
                                    </button>
                                    <div ref={csvHintRef} style={{ position: 'relative' }}>
                                        <button onClick={() => setShowCsvHint(s => !s)} style={{ cursor: 'pointer', fontSize: '0.8rem', color: '#888', border: '1px solid #bbb', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', userSelect: 'none', flexShrink: 0, background: showCsvHint ? '#f0f4ff' : '#fff', padding: 0 }}>?</button>
                                        {showCsvHint && (
                                            <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 500, background: '#fff', border: '1px solid #ccc', borderRadius: '6px', padding: '10px 14px', width: '420px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', fontSize: '0.8rem', lineHeight: '1.6', marginTop: '4px' }}>
                                                <div style={{ fontWeight: 'bold', marginBottom: '6px', color: '#333' }}>CSVインポート — 列情報</div>
                                                <div style={{ marginBottom: '4px' }}>左から「教室ID」までの列を受け入れます</div>
                                                <div style={{ marginBottom: '4px' }}>必須は本ページの赤字項目です</div>
                                                <div style={{ marginBottom: '4px' }}>機材・設備は ◎=必須、○=希望 です（◎にできるのは PJ(中)・PJ(横)・可動のみ）</div>
                                                <div style={{ marginBottom: '4px' }}>教室IDがある行は配当を復元できます</div>
                                                <div style={{ marginBottom: '4px' }}>教室名 / 建物 / 教室定員 / 教室試験定員 / 教室タイプ / 教室設備 があっても再インポート可能です</div>
                                                <div style={{ marginBottom: '4px' }}>※エクスポートCSVをそのまま再インポート可</div>
                                                <div style={{ marginBottom: '4px' }}>エラーがある場合は詳細CSVを保存先選択ダイアログ付きで出力します</div>
                                                <div style={{ marginBottom: '4px' }}>UTF-8(BOMあり/なし)・Shift_JIS系のCSVに対応しています</div>
                                                <div style={{ marginBottom: '4px', color: '#b45309', fontWeight: 'bold' }}>このCSVは現在のキャンパス専用です</div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <button onClick={openTaxonomyModal} style={{ display: 'flex', gap: '8px', alignItems: 'center', background: '#2e7d32', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.9em' }}>
                                    開講学部・管轄
                                </button>
                                <button onClick={() => {
                                    // エクスポート用にデータを整形（日本語キー、日本語値）
                                    // 複数教室配当がある場合は1教室につき1行で出力
                                    const exportData = subjects.flatMap(s => {
                                        const subjectAllocations = allocations.filter(a => a.subjectId === s.id);
                                        const exportTerm = s.term ? getTermLabel(s.term) : '0';
                                        const exportDay = s.day ? getDayLabel(s.day) : '0';
                                        const exportPeriod = s.period && s.period > 0 ? String(s.period) : '0';
                                        const exportEndPeriod = s.endPeriod && s.endPeriod > 0 ? String(s.endPeriod) : '0';
                                        const baseRow: Record<string, unknown> = {
                                            'コード': s.code,
                                            '時間割名称': s.name,
                                            '教員コード': s.teacherCode || '',
                                            '教員名': s.teacher,
                                            '開講学部': s.faculty,
                                            '管轄': s.department,
                                            '配当期': exportTerm,
                                            '曜日': exportDay,
                                            '開始講時': exportPeriod,
                                            '終了講時': exportEndPeriod,
                                            'キャンパス': s.campus,
                                            '履修者数': s.requiredCapacity,
                                            '優先度': s.priority,
                                            '必要教室数': s.requiredRoomCount,
                                            '希望建物': s.buildingPreference || '',
                                            'タイプ': s.preferredRoomType === 'pc' ? 'PC' : s.preferredRoomType === 'seminar' ? 'ゼミ' : '一般',
                                            '過去教室': s.previousRooms?.join(', ') || '',
                                        };
                                        // 設備: 1列につき1設備、◎=必須 ○=希望 空=不要
                                        SUBJECT_EQUIPMENT_CHOICES.forEach(eq => {
                                            baseRow[eq] = equipValue(eq, s.requiresMovable, s.requiresProjector, s.mandatoryEquipment, s.requiredEquipment);
                                        });

                                        if (subjectAllocations.length === 0) {
                                            // 未配当：教室情報なしで1行
                                            return [{ ...baseRow, '教室ID': '', '教室名': '', '建物': '', '教室定員': '', '教室試験定員': '', '教室タイプ': '', '教室設備': '' }];
                                        }
                                        // 配当済み：1教室1行
                                        return subjectAllocations.map(alloc => {
                                            const r = classrooms.find(rm => rm.id === alloc.classroomId || rm.name === alloc.classroomId);
                                            const eqList = r ? [...(r.equipment ?? [])] : [];
                                            if (r?.isMovable) eqList.unshift('可動');
                                            return {
                                                ...baseRow,
                                                '教室ID': r?.id ?? alloc.classroomId ?? '',
                                                '教室名': r?.name ?? '',
                                                '建物': r?.building ?? '',
                                                '教室定員': r?.capacity ?? '',
                                                '教室試験定員': r?.examCapacity ?? '',
                                                '教室タイプ': r ? (ROOM_TYPE_LABELS[r.type] ?? r.type) : '',
                                                '教室設備': eqList.join(', ')
                                            };
                                        });
                                    });
                                    exportToCSV(exportData, 'subjects_export.csv');
                                }} style={{
                                    display: 'flex', gap: '8px', alignItems: 'center', background: '#1976d2', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.9em'
                                }}>
                                    <Download size={18} /> CSVエクスポート
                                </button>
                                <input type="file" ref={fileInputRef} onChange={handleImportCSV} accept=".csv" style={{ display: 'none' }} />
                                <div ref={smColSettingsRef} style={{ position: 'relative' }}>
                                    <button onClick={() => setShowColSettings(s => !s)} style={{
                                        display: 'flex', gap: '6px', alignItems: 'center', background: '#eee', color: '#333', border: '1px solid #ccc', padding: '8px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.9em'
                                    }}>列設定</button>
                                    {showColSettings && (
                                        <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 200, background: '#fff', border: '1px solid #ddd', borderRadius: '6px', padding: '10px', width: '250px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', marginTop: '4px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                                <span style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>列設定</span>
                                                <button onClick={() => setColConfig(smColDefaults())} style={{ fontSize: '0.75rem', padding: '2px 8px', background: '#f5f5f5', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer' }}>初期値に戻す</button>
                                            </div>
                                            {SM_COL_DEFS.map(col => (
                                                <div key={col.key} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '5px' }}>
                                                    <input type="checkbox" checked={!colConfig[col.key].hidden} onChange={() => smToggle(col.key)} style={{ cursor: 'pointer' }} />
                                                    <span style={{ flex: 1, fontSize: '0.82rem' }}>{col.label}</span>
                                                    <input type="number" value={colConfig[col.key].width} onChange={e => smSetW(col.key, Number(e.target.value))} style={{ width: '54px', fontSize: '0.8rem', border: '1px solid #ddd', borderRadius: '3px', padding: '2px 4px' }} />
                                                    <span style={{ fontSize: '0.7rem', color: '#999' }}>px</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '10px' }}>
                            <div style={{ fontSize: '0.9rem', color: '#666' }}>
                                表示: {sortedSubjects.length} / {subjects.length} 件
                            </div>
                        </div>
                    </div>

                </div>
            </div>
            {/* スクロールエリア（テーブルのみ） */}
            <div
                ref={subjectScrollRef}
                onScroll={e => setSubjectScrollTop(e.currentTarget.scrollTop)}
                style={{ flex: 1, overflow: 'auto' }}
            >
                <div style={{ maxWidth: '1600px', margin: '0 auto', padding: '0 30px 20px' }}>
                    <div style={{ border: '1px solid #ddd', borderRadius: '4px', background: '#fff' }}>
                        {!subjectListReady ? (
                            <div style={{ minHeight: '240px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#777', fontSize: '0.95rem' }}>
                                授業一覧を読み込み中...
                            </div>
                        ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', borderSpacing: 0, background: '#fff', fontSize: '0.85em', minWidth: '1400px' }}>
                            <thead>
                                <tr style={{ background: '#f5f5f5', textAlign: 'left' }}>
                                    {SM_COL_DEFS.filter(col => smShow(col.key)).map(col => (
                                        <th key={col.key} style={{ ...thStyle, width: smW(col.key), overflow: 'visible' }} onClick={() => handleSort(col.key)}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
                                                <span style={{ color: col.required ? '#d32f2f' : '#222', fontWeight: col.required ? 'bold' : 600 }}>
                                                    {col.label}
                                                </span>
                                                <SortIcon columnKey={col.key} />
                                            </div>
                                            {smRH(col.key)}
                                        </th>
                                    ))}
                                    <th style={{ ...thStyle, width: '70px', cursor: 'default' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <span>操作</span>
                                        </div>
                                    </th>
                                </tr>
                                <tr style={{ background: '#fafafa', position: 'sticky', top: 37, zIndex: 9 }}>
                                    {smShow('code') && <td style={{ padding: '4px', border: '1px solid #ddd', background: '#fafafa' }}><input style={filterInputStyle} value={filters.code} onChange={e => setFilters({ ...filters, code: e.target.value })} placeholder="検索..." /></td>}
                                    {smShow('name') && <td style={{ padding: '4px', border: '1px solid #ddd', background: '#fafafa' }}><input style={filterInputStyle} value={filters.name} onChange={e => setFilters({ ...filters, name: e.target.value })} placeholder="検索..." /></td>}
                                    {smShow('teacherCode') && <td style={{ padding: '4px', border: '1px solid #ddd', background: '#fafafa' }}><input style={filterInputStyle} value={filters.teacherCode} onChange={e => setFilters({ ...filters, teacherCode: e.target.value })} placeholder="検索..." /></td>}
                                    {smShow('teacher') && <td style={{ padding: '4px', border: '1px solid #ddd', background: '#fafafa' }}><input style={filterInputStyle} value={filters.teacher} onChange={e => setFilters({ ...filters, teacher: e.target.value })} placeholder="検索..." /></td>}
                                    {smShow('faculty') && <td style={{ padding: '4px', border: '1px solid #ddd', background: '#fafafa' }}><MultiSelectFilter options={facultyOptions.map(v => ({ value: v, label: v }))} selected={filters.faculty} onChange={v => setFilters({ ...filters, faculty: v as string[] })} /></td>}
                                    {smShow('department') && <td style={{ padding: '4px', border: '1px solid #ddd', background: '#fafafa' }}><MultiSelectFilter options={departmentOptions.map(v => ({ value: v, label: v }))} selected={filters.department} onChange={v => setFilters({ ...filters, department: v as string[] })} /></td>}
                                    {smShow('term') && <td style={{ padding: '4px', border: '1px solid #ddd', background: '#fafafa' }}><MultiSelectFilter options={termFilterOptions} selected={filters.term} onChange={v => setFilters({ ...filters, term: v as Term[] })} /></td>}
                                    {smShow('day') && <td style={{ padding: '4px', border: '1px solid #ddd', background: '#fafafa' }}><MultiSelectFilter options={dayFilterOptions} selected={filters.day} onChange={v => setFilters({ ...filters, day: v as DayOfWeek[] })} /></td>}
                                    {smShow('period') && <td style={{ padding: '4px', border: '1px solid #ddd', background: '#fafafa' }}><MultiSelectFilter options={periodFilterOptions} selected={filters.period} onChange={v => setFilters({ ...filters, period: v as string[] })} /></td>}
                                    {smShow('campus') && <td style={{ padding: '4px', border: '1px solid #ddd', background: '#fafafa' }}><input style={filterInputStyle} value={filters.campus} onChange={e => setFilters({ ...filters, campus: e.target.value })} placeholder="検索..." /></td>}
                                    {smShow('requiredCapacity') && <td style={{ padding: '4px', border: '1px solid #ddd', background: '#fafafa' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                            <input type="number" style={{ ...filterInputStyle, fontSize: '0.72rem', padding: '2px 3px' }} value={filters.requiredCapacity} onChange={e => setFilters({ ...filters, requiredCapacity: e.target.value })} placeholder="以上" title="定員 以上" />
                                            <input type="number" style={{ ...filterInputStyle, fontSize: '0.72rem', padding: '2px 3px' }} value={filters.requiredCapacityMax} onChange={e => setFilters({ ...filters, requiredCapacityMax: e.target.value })} placeholder="以下" title="定員 以下" />
                                        </div>
                                    </td>}
                                    {smShow('priority') && <td style={{ padding: '4px', border: '1px solid #ddd', background: '#fafafa' }}><MultiSelectFilter options={[1, 2, 3].map(v => ({ value: v, label: String(v) }))} selected={filters.priority} onChange={v => setFilters({ ...filters, priority: v as number[] })} /></td>}
                                    {smShow('requiredRoomCount') && <td style={{ padding: '4px', border: '1px solid #ddd', background: '#fafafa' }}><MultiSelectFilter options={[1, 2, 3, 4, 5].map(v => ({ value: v, label: String(v) }))} selected={filters.requiredRoomCount} onChange={v => setFilters({ ...filters, requiredRoomCount: v as number[] })} /></td>}
                                    {smShow('buildingPreference') && <td style={{ padding: '4px', border: '1px solid #ddd', background: '#fafafa' }}><MultiSelectFilter options={BUILDINGS.map(v => ({ value: v, label: v }))} selected={filters.buildingPreference} onChange={v => setFilters({ ...filters, buildingPreference: v as string[] })} /></td>}
                                    {smShow('preferredRoomType') && <td style={{ padding: '4px', border: '1px solid #ddd', background: '#fafafa' }}><MultiSelectFilter options={[{value:'normal',label:'一般'},{value:'pc',label:'PC'},{value:'seminar',label:'ゼミ'}]} selected={filters.preferredRoomType} onChange={v => setFilters({ ...filters, preferredRoomType: v as string[] })} /></td>}
                                    {smShow('requiredEquipment') && <td style={{ padding: '4px', border: '1px solid #ddd', background: '#fafafa' }}><input style={filterInputStyle} value={filters.requiredEquipment} onChange={e => setFilters({ ...filters, requiredEquipment: e.target.value })} placeholder="検索..." /></td>}
                                    {smShow('previousRooms') && <td style={{ padding: '4px', border: '1px solid #ddd', background: '#fafafa' }}><input style={filterInputStyle} value={filters.previousRooms} onChange={e => setFilters({ ...filters, previousRooms: e.target.value })} placeholder="検索..." /></td>}
                                    {smShow('allocatedRoom') && <td style={{ padding: '4px', border: '1px solid #ddd', background: '#fafafa' }}><input style={filterInputStyle} value={filters.allocatedRoom || ''} onChange={e => setFilters({ ...filters, allocatedRoom: e.target.value })} placeholder="検索..." /></td>}
                                    <td style={{ padding: '4px', border: '1px solid #ddd', textAlign: 'center', background: '#fafafa' }}>
                                        <button
                                            onClick={handleDeleteAll}
                                            style={{
                                                fontSize: '0.7rem', padding: '2px 6px', background: '#d32f2f', color: '#fff',
                                                border: 'none', borderRadius: '4px', cursor: 'pointer'
                                            }}
                                        >
                                            全削除
                                        </button>
                                    </td>
                                </tr>
                            </thead>
                            <tbody style={{ background: '#fff' }}>
                                {virtualizedSubjects.enabled && virtualizedSubjects.topPadding > 0 && (
                                    <tr aria-hidden="true">
                                        <td colSpan={visibleSubjectColumns} style={{ height: `${virtualizedSubjects.topPadding}px`, padding: 0, border: 'none', background: '#fff' }} />
                                    </tr>
                                )}
                                {virtualizedSubjects.items.map(subject => (
                                    <tr key={subject.id} style={{ borderBottom: '1px solid #eee', background: '#fff' }}>
                                        {smShow('code') && <td style={{ padding: '10px', border: '1px solid #ddd', color: '#888' }}>{subject.code}</td>}
                                        {smShow('name') && <td style={{ padding: '10px', border: '1px solid #ddd', fontWeight: 'bold' }}>{subject.name}</td>}
                                        {smShow('teacherCode') && <td style={{ padding: '10px', border: '1px solid #ddd', color: '#888' }}>{subject.teacherCode || ''}</td>}
                                        {smShow('teacher') && <td style={{ padding: '10px', border: '1px solid #ddd' }}>{subject.teacher}</td>}
                                        {smShow('faculty') && <td style={{ padding: '10px', border: '1px solid #ddd' }}>{subject.faculty}</td>}
                                        {smShow('department') && <td style={{ padding: '10px', border: '1px solid #ddd' }}>{subject.department}</td>}
                                        {smShow('term') && <td style={{ padding: '10px', border: '1px solid #ddd' }}>{getTermLabel(subject.term)}</td>}
                                        {smShow('day') && <td style={{ padding: '10px', border: '1px solid #ddd' }}>{getDayLabel(subject.day)}</td>}
                                        {smShow('period') && <td style={{ padding: '10px', border: '1px solid #ddd' }}>{getPeriodLabel(subject.period)}{subject.endPeriod && subject.endPeriod !== subject.period ? `-${getPeriodLabel(subject.endPeriod)}` : ''}</td>}
                                        {smShow('campus') && <td style={{ padding: '10px', border: '1px solid #ddd' }}>{subject.campus}</td>}
                                        {smShow('requiredCapacity') && <td style={{ padding: '10px', border: '1px solid #ddd' }}>{subject.requiredCapacity}名</td>}
                                        {smShow('priority') && <td style={{ padding: '10px', border: '1px solid #ddd' }}>{subject.priority}</td>}
                                        {smShow('requiredRoomCount') && <td style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'center' }}>{subject.requiredRoomCount || 1}</td>}
                                        {smShow('buildingPreference') && <td style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'center' }}>{subject.buildingPreference}</td>}
                                        {smShow('preferredRoomType') && <td style={{ padding: '10px', border: '1px solid #ddd' }}>{subject.preferredRoomType === 'normal' ? '一般' : subject.preferredRoomType === 'pc' ? 'PC' : subject.preferredRoomType === 'seminar' ? 'ゼミ' : '-'}</td>}
                                        {smShow('requiredEquipment') && <td style={{ padding: '10px', border: '1px solid #ddd', fontSize: '0.85em' }}>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                                {(() => {
                                                    const displayEquipment = sortEquipmentByCanonicalOrder([
                                                        ...(subject.mandatoryEquipment || []),
                                                        ...(subject.requiredEquipment || [])
                                                    ]).filter(eq => SUBJECT_EQUIPMENT_CHOICES.includes(eq) && eq !== '可動');
                                                    const showMovable = subject.requiresMovable
                                                        || (subject.mandatoryEquipment || []).includes('可動')
                                                        || (subject.requiredEquipment || []).includes('可動');
                                                    return (
                                                        <>
                                                            {displayEquipment.map(eq => {
                                                                const style = getEquipmentStyle(eq);
                                                                return (
                                                                    <span key={eq} style={{
                                                                        background: style.bg,
                                                                        color: style.text,
                                                                        border: `1px solid ${style.border}`,
                                                                        padding: '2px 8px',
                                                                        borderRadius: '4px',
                                                                        fontSize: '0.8em',
                                                                        fontWeight: 600,
                                                                        whiteSpace: 'nowrap'
                                                                    }}>{eq}</span>
                                                                );
                                                            })}
                                                            {showMovable && (() => {
                                                                const style = getEquipmentStyle('可動');
                                                                return (
                                                                    <span style={{
                                                                        background: style.bg,
                                                                        color: style.text,
                                                                        border: `1px solid ${style.border}`,
                                                                        padding: '2px 8px',
                                                                        borderRadius: '4px',
                                                                        fontSize: '0.8em',
                                                                        fontWeight: 600,
                                                                        whiteSpace: 'nowrap'
                                                                    }}>可動</span>
                                                                );
                                                            })()}
                                                        </>
                                                    );
                                                })()}
                                            </div>
                                        </td>}
                                        {smShow('previousRooms') && <td style={{ padding: '10px', border: '1px solid #ddd', fontSize: '0.85em', color: '#666' }}>{subject.previousRooms?.join(', ')}</td>}
                                        {smShow('allocatedRoom') && <td style={{ padding: '10px', border: '1px solid #ddd', fontSize: '0.85em' }}>
                                            {(() => {
                                                const rooms = allocations
                                                    .filter(a => a.subjectId === subject.id)
                                                    .map(a => classrooms.find(r => r.id === a.classroomId)?.name ?? a.classroomId);
                                                return rooms.length > 0
                                                    ? <span style={{ color: '#1976d2', fontWeight: 'bold' }}>{rooms.join(' / ')}</span>
                                                    : <span style={{ color: '#bbb' }}>未配当</span>;
                                            })()}
                                        </td>}
                                        <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                                            <div style={{ display: 'flex', gap: '10px' }}>
                                                <button onClick={() => handleEdit(subject)} style={{ background: 'none', border: 'none', color: '#1976d2', cursor: 'pointer' }} title="編集"><Edit2 size={16} /></button>
                                                <button onClick={() => handleDelete(subject.id)} style={{ background: 'none', border: 'none', color: '#d32f2f', cursor: 'pointer' }} title="削除"><Trash2 size={16} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {virtualizedSubjects.enabled && virtualizedSubjects.bottomPadding > 0 && (
                                    <tr aria-hidden="true">
                                        <td colSpan={visibleSubjectColumns} style={{ height: `${virtualizedSubjects.bottomPadding}px`, padding: 0, border: 'none', background: '#fff' }} />
                                    </tr>
                                )}
                                {sortedSubjects.length === 0  && (
                                    <tr>
                                        <td colSpan={visibleSubjectColumns} style={{ textAlign: 'center', padding: '150px 0', color: '#999', background: '#fafafa' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                                                <Search size={40} strokeWidth={1} />
                                                <span>該当する授業が見つかりません</span>
                                                <button
                                                    onClick={() => setFilters({
                                                        code: '', name: '', teacherCode: '', teacher: '', faculty: [], department: [], term: [], day: [], period: [], campus: '', requiredCapacity: '', requiredCapacityMax: '', priority: [], requiredRoomCount: [], buildingPreference: [], preferredRoomType: [], requiredEquipment: '', previousRooms: '', allocatedRoom: ''
                                                    })}
                                                    style={{ background: 'none', border: '1px solid #ccc', padding: '4px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.9em', marginTop: '10px' }}
                                                >
                                                    フィルタをすべて解除
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                        )}
                    </div>
                </div>
            </div>
            {editingSubjectModal && (
                <SubjectEditModal
                    key={editingSubjectModal.id}
                    subject={editingSubjectModal}
                    availableEquipment={availableEquipment}
                    currentCampusLabel={currentCampusLabel}
                    facultyOptions={facultyOptions}
                    departmentOptions={departmentOptions}
                    title={subjectModalMode === 'add' ? '新規授業情報の作成' : '授業情報の編集'}
                    onSave={(updated) => {
                        if (subjectModalMode === 'add') {
                            onUpdate([...subjects, updated]);
                        } else {
                            onUpdate(subjects.map(s => s.id === updated.id ? updated : s));
                        }
                        setEditingSubjectModal(null);
                        setSubjectModalMode(null);
                    }}
                    onClose={() => {
                        setEditingSubjectModal(null);
                        setSubjectModalMode(null);
                    }}
                />
            )}
            {showTaxonomyModal && (
                <SubjectTaxonomyModal
                    campusLabel={currentCampusLabel}
                    taxonomy={subjectTaxonomy}
                    onSave={(updated) => {
                        onUpdateSubjectTaxonomy(updated);
                        setShowTaxonomyModal(false);
                    }}
                    onClose={() => setShowTaxonomyModal(false)}
                />
            )}
            {subjectImportErrorCsv && (
                <ImportErrorCsvDialog
                    open={true}
                    title={subjectImportErrorCsv.title}
                    message={subjectImportErrorCsv.message}
                    filename={subjectImportErrorCsv.filename}
                    rows={subjectImportErrorCsv.rows}
                    onClose={() => setSubjectImportErrorCsv(null)}
                />
            )}
        </div>
    );
};

