import Papa from 'papaparse';
import type { Classroom, Subject, Term, DayOfWeek, Period } from '../types';
import { normalizeEquipmentName, normalizeCampusLabel } from '../types';
import { SUBJECT_EQUIPMENT_CHOICES, sanitizeSubjectEquipmentList } from './equipmentVisibility';

// Header definitions
// Header definitions

export type SubjectImportColumnDef = {
    label: string;
    aliases: string[];
};

export const SUBJECT_IMPORT_REQUIRED_COLUMNS: SubjectImportColumnDef[] = [
    { label: 'コード', aliases: ['コード', '時間割コード', 'ID', 'Code'] },
    { label: '時間割名称', aliases: ['時間割名称', '時間割名', 'Name'] },
    { label: '教員コード', aliases: ['教員コード', 'TeacherCode'] },
    { label: '教員名', aliases: ['教員名', '教員', 'Teacher'] },
    { label: '開講学部', aliases: ['開講学部', 'Faculty'] },
    { label: '管轄', aliases: ['管轄', '管轄学科', '学科', 'Department'] },
    { label: '配当期', aliases: ['配当期', '開講期', '学期', 'Term'] },
    { label: '曜日', aliases: ['曜日', 'Day'] },
    { label: '講時', aliases: ['講時', '開始講時', 'Period'] },
    { label: 'キャンパス', aliases: ['キャンパス', 'Campus'] },
    { label: '必要教室数', aliases: ['必要教室数', 'RequiredRoomCount'] },
    { label: 'タイプ', aliases: ['タイプ', '希望教室タイプ', 'PreferredRoomType'] },
];

export type ClassroomImportColumnDef = {
    label: string;
    aliases: string[];
};

export type ClassroomImportIssue = {
    lineNumber?: number;
    errorType: string;
    targetColumn?: string;
    detail: string;
    suggestion: string;
    classroomId?: string;
    classroomName?: string;
    campus?: string;
};

export const CLASSROOM_IMPORT_REQUIRED_COLUMNS: ClassroomImportColumnDef[] = [
    { label: '教室名', aliases: ['教室名', 'Name'] },
    { label: 'キャンパス', aliases: ['キャンパス', 'Campus'] },
    { label: '建物', aliases: ['建物', 'Building'] },
    { label: '収容人数', aliases: ['収容人数', 'Capacity'] },
];

const normalizeCsvHeader = (value: string) => value.replace(/^\uFEFF/, '').trim();

const CSV_TEXT_ENCODINGS = ['utf-8', 'shift_jis', 'windows-31j'] as const;

const decodeCsvFile = async (file: File, headerHints: string[]) => {
    const buffer = await file.arrayBuffer();
    let fallbackDecoded = new TextDecoder('utf-8').decode(buffer);
    let bestDecoded = fallbackDecoded;
    let bestMatchCount = -1;
    for (const encoding of CSV_TEXT_ENCODINGS) {
        try {
            const decoded = new TextDecoder(encoding).decode(buffer);
            const firstLine = decoded.split(/\r?\n/, 1)[0] ?? '';
            const headers = firstLine.split(',').map(normalizeCsvHeader).filter(Boolean);
            const matchCount = headerHints.filter(hint =>
                headers.some(header => normalizeCsvHeader(header) === normalizeCsvHeader(hint))
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
    const key = Object.keys(row).find((header) =>
        aliases.some(alias => normalizeCsvHeader(header) === normalizeCsvHeader(alias))
    );
    return key ? String(row[key] ?? '').trim() : '';
};

const hasCsvHeader = (headers: string[], aliases: string[]) => {
    return headers.some(header =>
        aliases.some(alias => normalizeCsvHeader(header) === normalizeCsvHeader(alias))
    );
};

export const parseClassroomCSV = (file: File): Promise<Classroom[]> => {
    return new Promise((resolve, reject) => {
        void decodeCsvFile(file, ['Name', 'Campus', 'Building', 'Capacity']).then((text) => {
        Papa.parse(text, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                const classrooms: Classroom[] = (results.data as Record<string, string>[]).map((row) => {
                    const getVal = (keys: string[]) => {
                        const key = keys.find(k => row[k] !== undefined);
                        return key ? row[key] : '';
                    };

                    const isTrue = (val: string) =>
                        val === 'true' || val === 'TRUE' || val === '1' || val === '○' || val === '◯' || val === 'あり';

                    // 収容人数
                    const cap = parseInt(getVal(['Capacity', '収容人数', '定員']), 10) || 0;
                    const examCap = parseInt(getVal(['ExamCapacity', '試験時定員', '試験定員']), 10) || undefined;

                    // 教室タイプ変換
                    const typeVal = getVal(['Type', '教室タイプ', '種別']).toLowerCase();
                    let type: Classroom['type'] = 'normal';
                    if (typeVal.includes('pc')) type = 'pc';
                    else if (typeVal.includes('ゼミ')) type = 'seminar';
                    else if (typeVal.includes('会議')) type = 'seminar';
                    else if (typeVal.includes('その他')) type = 'other';

                    // 設備集計 (特定の列以外で '○' なものを equipment に入れる)
                    const knownKeys = [
                        'ID', 'Name', '教室名', '名前', 'Building', '建物', '学舎',
                        'Capacity', '収容人数', '定員', 'ExamCapacity', '試験時定員',
                        'Type', '教室タイプ',
                        'IsMovable', '可動', '机椅子', 'スクリーン', '電子黒板', '可動式', '固定式',
                        'IsExcluded', '配当対象外'
                    ];
                    const equipment: string[] = [];
                    Object.keys(row).forEach(k => {
                        if (isTrue(row[k])) {
                            if (k.includes('プロジェクター(中央)') || k.includes('中央PJ')) {
                                equipment.push('PJ(中)');
                            } else if (k.includes('プロジェクター(サイド)') || k.includes('サイドPJ') || k.includes('横PJ')) {
                                equipment.push('PJ(横)');
                            } else if (k.includes('ホワイトボード') || k.includes('Whiteboard')) {
                                equipment.push('白板');
                            } else if (!knownKeys.some(kk => k.includes(kk))) {
                                equipment.push(normalizeEquipmentName(k));
                            }
                        }
                    });

                    // 個別フラグ
                    const isMovable = isTrue(getVal(['IsMovable', '机椅子(可動)', '可動式', '可動']));

                    const name = getVal(['Name', '教室名', '名前']);
                    const id = getVal(['ID', '教室ID']) || name;

                    return {
                        id,
                        name,
                        building: getVal(['Building', '建物', '学舎']) || '不明',
                        capacity: cap,
                        examCapacity: examCap,
                        type,
                        isMovable,
                        isExcluded: isTrue(getVal(['IsExcluded', '配当対象外'])),
                        equipment: [
                            ...equipment,
                            ...(row.Equipment ? row.Equipment.split(';').map((s: string) => normalizeEquipmentName(s.trim())).filter(Boolean) : [])
                        ]
                    };
                });
                resolve(classrooms);
            },
            error: (error: unknown) => reject(error instanceof Error ? error : new Error(String(error))),
        });
        }).catch(reject);
    });
};

export const parseSubjectCSV = (file: File): Promise<Subject[]> => {
    return new Promise((resolve, reject) => {
        void decodeCsvFile(file, ['Code', 'Name', 'Period', 'RequiredRoomCount']).then((text) => {
        Papa.parse(text, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                const rows = results.data as Record<string, string>[];
                const headers = (results.meta.fields || []).map(normalizeCsvHeader).filter(Boolean);
                const missingHeaders = SUBJECT_IMPORT_REQUIRED_COLUMNS.filter(col => !hasCsvHeader(headers, col.aliases));
                if (missingHeaders.length > 0) {
                    reject(new Error(`必須列が不足しています: ${missingHeaders.map(col => col.label).join('、')}`));
                    return;
                }

                const rowIssues: string[] = [];
                rows.forEach((row, index) => {
                    const missing = SUBJECT_IMPORT_REQUIRED_COLUMNS.filter(col => !getCsvValue(row, col.aliases));
                    const periodValue = parseInt(getCsvValue(row, ['講時', '開始講時', 'Period']), 10);
                    if ((!missing.some(col => col.label === '講時')) && (!Number.isFinite(periodValue) || periodValue <= 0)) {
                        missing.push({ label: '講時', aliases: ['講時'] });
                    }
                    const roomCountValue = parseInt(getCsvValue(row, ['必要教室数', 'RequiredRoomCount']), 10);
                    if ((!missing.some(col => col.label === '必要教室数')) && (!Number.isFinite(roomCountValue) || roomCountValue <= 0)) {
                        missing.push({ label: '必要教室数', aliases: ['必要教室数'] });
                    }
                    if (missing.length > 0) {
                        rowIssues.push(`${index + 2}行目(${missing.map(col => col.label).join('、')})`);
                    }
                });
                if (rowIssues.length > 0) {
                    reject(new Error(`必須項目が空欄の行があります: ${rowIssues.slice(0, 10).join('、')}${rowIssues.length > 10 ? '…' : ''}`));
                    return;
                }

                const rawSubjects = (results.data as Record<string, string>[]).map((row) => ({
                    id: row.ID || row['コード'] || row['時間割コード'] || `s-${Math.random().toString(36).substr(2, 9)}`,
                    code: row['コード'] || row['時間割コード'] || row.Code || row.ID,
                    name: row['時間割名称'] || row.Name || row['授業名'],
                    teacherCode: row['教員コード'] || row.TeacherCode || row['教員番号'] || '',
                    teacher: row['教員名'] || row.Teacher || row['教員'] || row['代表教員'],
                    department: row['管轄'] || row.Department || row['管轄学科'] || row['学科'],
                    faculty: row['開講学部'] || row.Faculty,
                    term: (() => {
                        const t = row['配当期'] || row.Term || row['開講期'] || row['学期'];
                        if (t === '春' || t === '春学期') return 'spring';
                        if (t === '春学期前半' || t === '春前半') return 'spring_first';
                        if (t === '春学期後半' || t === '春後半') return 'spring_second';
                        if (t === '秋' || t === '秋学期') return 'autumn';
                        if (t === '秋学期前半' || t === '秋前半') return 'autumn_first';
                        if (t === '秋学期後半' || t === '秋後半') return 'autumn_second';
                        if (t === '通年') return 'full_year';
                        return (t as Term) || 'spring';
                    })(),
                    day: (() => {
                        const d = row['曜日'] || row.Day;
                        const map: Record<string, DayOfWeek> = { '月': 'mon', '火': 'tue', '水': 'wed', '木': 'thu', '金': 'fri', '土': 'sat' };
                        return map[d] || d as DayOfWeek;
                    })(),
                    period: parseInt(row['講時'] || row['開始講時'] || row.Period, 10) as Period,
                    endPeriod: (parseInt(row.EndPeriod || row['終了講時'], 10) || undefined) as Period | undefined,
                    requiredCapacity: parseInt(row.RequiredCapacity || row['履修者数'] || row['履修予定人数'] || row['履修想定人数'] || row['定員'], 10) || 0,
                    campus: row['キャンパス'] || row.Campus,
                    requiredRoomCount: parseInt(row.RequiredRoomCount || row['必要教室数'], 10) || 1,
                    previousRooms: row.PreviousRooms || row['教室(過去教室)'] || row['教室'] || row['過去教室'] || row['過去教室(区切り)'] ? (row.PreviousRooms || row['教室(過去教室)'] || row['教室'] || row['過去教室'] || row['過去教室(区切り)']).split(/[;,\s、]+/).map((s: string) => s.trim()).filter(Boolean) : [],
                    preferredRoomType: (() => {
                        const t = row['タイプ'] || row.PreferredRoomType || row['希望教室タイプ'] || row['教室タイプ'];
                        if (t === 'PC' || t === 'PC室') return 'pc';
                        if (t === 'ゼミ' || t === 'ゼミ室') return 'seminar';
                        if (t === '一般') return 'normal';
                        return t ? (t as Subject['preferredRoomType']) : undefined;
                    })(),
                    // 新形式: PJ(中) or PJ(横) = ◎ → requiresProjector
                    // 旧形式: 専用列も引き続き受け付ける
                    requiresProjector: row['PJ(中)'] === '◎' || row['PJ(横)'] === '◎' ||
                        row.RequiresProjector === 'true' || row.RequiresProjector === '1' ||
                        row['PJ必須'] === '○' || row['PJ'] === '○' || row['プロジェクター'] === '○',
                    // 新形式: 可動 = ◎ → requiresMovable
                    requiresMovable: row['可動'] === '◎' ||
                        row.RequiresMovable === 'true' || row.RequiresMovable === '1' ||
                        row['可動席'] === '○' || row['可動式'] === '○',
                    priority: parseInt(row.Priority || row['優先度[1(低)～3(高)]'] || row['優先度'], 10) || 1,
                    isContinuous: row.IsContinuous === 'true' || row.IsContinuous === '1',
                    buildingPreference: row['希望建物'] || row.BuildingPreference || row['棟希望'],
                    // 必須設備: 設備列の値が◎のもの（新形式）、または旧形式の必須_X列
                    mandatoryEquipment: (() => {
                        const fromNew = SUBJECT_EQUIPMENT_CHOICES.filter(eq => row[eq] === '◎').map(normalizeEquipmentName);
                        if (fromNew.length > 0) return fromNew;
                        // 旧形式後方互換: 必須_X列
                        return SUBJECT_EQUIPMENT_CHOICES.filter(eq => row[`必須_${eq}`] === '○').map(normalizeEquipmentName);
                    })(),
                    // 希望設備: 設備列の値が○のもの（新形式）、または旧形式
                    requiredEquipment: (() => {
                        const fromNew = SUBJECT_EQUIPMENT_CHOICES.filter(eq => row[eq] === '○').map(normalizeEquipmentName);
                        if (fromNew.length > 0) return fromNew;
                        // 旧形式後方互換: 希望_X列
                        const fromOldCols = SUBJECT_EQUIPMENT_CHOICES.filter(eq => row[`希望_${eq}`] === '○').map(normalizeEquipmentName);
                        if (fromOldCols.length > 0) return fromOldCols;
                        // さらに旧形式: 必須設備セル（スペース/セミコロン区切り）
                        const legacy = row.RequiredEquipment || row['必須設備'];
                        return legacy ? legacy.split(/[;\s]+/).map((s: string) => normalizeEquipmentName(s.trim())).filter(Boolean) : [];
                    })(),
                }));

                // グルーピングして必要教室数を算出
                const grouped = new Map<string, Subject>();
                const normalizedSubjects = rawSubjects.map(s => ({
                    ...s,
                    requiredEquipment: sanitizeSubjectEquipmentList(s.requiredEquipment),
                    mandatoryEquipment: sanitizeSubjectEquipmentList(s.mandatoryEquipment)
                }));
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

                resolve(Array.from(grouped.values()));
            },
            error: (error: unknown) => reject(error instanceof Error ? error : new Error(String(error))),
        });
        }).catch(reject);
    });
};

export const parseClassroomCSVStrictWithIssues = (file: File): Promise<{ classrooms: Classroom[]; issues: ClassroomImportIssue[] }> => {
    return new Promise((resolve, reject) => {
        void decodeCsvFile(file, ['Name', 'Campus', 'Building', 'Capacity']).then((text) => {
            Papa.parse(text, {
                header: true,
                skipEmptyLines: true,
                complete: (results) => {
                    const rows = results.data as Record<string, string>[];
                    const headers = (results.meta.fields || []).map(normalizeCsvHeader).filter(Boolean);
                    const missingHeaders = CLASSROOM_IMPORT_REQUIRED_COLUMNS.filter(col => !hasCsvHeader(headers, col.aliases));
                    if (missingHeaders.length > 0) {
                        resolve({
                            classrooms: [],
                            issues: missingHeaders.map(col => ({
                                errorType: '必須列不足',
                                targetColumn: col.label,
                                detail: `必須列「${col.label}」が見つかりません。`,
                                suggestion: `CSVのヘッダーに「${col.label}」列を追加してください。`
                            }))
                        });
                        return;
                    }

                    const issues: ClassroomImportIssue[] = [];
                    rows.forEach((row, index) => {
                        const lineNumber = index + 2;
                        const classroomId = getCsvValue(row, ['ID', '教室ID']);
                        const classroomName = getCsvValue(row, ['教室名', 'Name']);
                        const campus = getCsvValue(row, ['キャンパス', 'Campus']);
                        const missing = CLASSROOM_IMPORT_REQUIRED_COLUMNS.filter(col => !getCsvValue(row, col.aliases));
                        if (!classroomId) {
                            issues.push({
                                lineNumber,
                                classroomName,
                                campus,
                                errorType: 'ID不足',
                                targetColumn: 'ID',
                                detail: '教室IDが空欄です。',
                                suggestion: '教室IDを入力してください。'
                            });
                        }
                        missing.forEach(col => {
                            if (col.label === '教室名' || col.label === 'キャンパス' || col.label === '建物' || col.label === '収容人数') {
                                issues.push({
                                    lineNumber,
                                    classroomId,
                                    classroomName,
                                    campus,
                                    errorType: '必須項目不足',
                                    targetColumn: col.label,
                                    detail: `「${col.label}」が空欄です。`,
                                    suggestion: `「${col.label}」を入力してください。`
                                });
                            }
                        });
                        const capacityRaw = getCsvValue(row, ['収容人数', 'Capacity']);
                        const capacityValue = parseInt(capacityRaw, 10);
                        if (capacityRaw && (!Number.isFinite(capacityValue) || capacityValue <= 0)) {
                            issues.push({
                                lineNumber,
                                classroomId,
                                classroomName,
                                campus,
                                errorType: '収容人数不正',
                                targetColumn: '収容人数',
                                detail: `収容人数の値「${capacityRaw}」が不正です。`,
                                suggestion: '収容人数には 1 以上の数値を入力してください。'
                            });
                        }
                    });

                    const classrooms: Classroom[] = rows.map((row) => {
                        const getVal = (keys: string[]) => {
                            const key = keys.find(k => row[k] !== undefined);
                            return key ? row[key] : '';
                        };
                        const isTrue = (val: string) =>
                            val === 'true' || val === 'TRUE' || val === '1' || val === '○' || val === '◯' || val === 'あり';

                        const equipment: string[] = [];
                        Object.keys(row).forEach((k) => {
                            if (isTrue(row[k])) {
                                if (k === 'PJ(中)' || k.includes('中PJ')) {
                                    equipment.push('PJ(中)');
                                } else if (k === 'PJ(横)' || k.includes('横PJ')) {
                                    equipment.push('PJ(横)');
                                } else if (k === '白板' || k.includes('Whiteboard')) {
                                    equipment.push('白板');
                                } else if (k === '黒板' || k.includes('Blackboard')) {
                                    equipment.push('黒板');
                                } else if (k === 'マイク') {
                                    equipment.push('マイク');
                                } else if (k === 'ブラインド') {
                                    equipment.push('ブラインド');
                                } else if (!['ID', '教室ID', 'Name', '教室名', 'キャンパス', 'Campus', '建物', 'Building', '収容人数', 'Capacity', 'Type', 'タイプ', 'IsMovable', '可動', '移動', 'IsExcluded', '配当対象外'].some(known => k.includes(known))) {
                                    equipment.push(normalizeEquipmentName(k));
                                }
                            }
                        });

                        const campus = normalizeCampusLabel(getVal(['Campus', 'キャンパス'])) || '';
                        const capacity = parseInt(getVal(['Capacity', '収容人数']), 10) || 0;
                        const examCapacity = parseInt(getVal(['ExamCapacity', '試験時定員', '試験定員']), 10) || undefined;
                        const typeVal = getVal(['Type', 'タイプ']).toLowerCase();
                        let type: Classroom['type'] = 'normal';
                        if (typeVal.includes('pc')) type = 'pc';
                        else if (typeVal.includes('ゼミ') || typeVal.includes('seminar')) type = 'seminar';
                        else if (typeVal.includes('other')) type = 'other';

                        return {
                            id: getVal(['ID', '教室ID']),
                            name: getVal(['教室名', 'Name']),
                            campus,
                            building: getVal(['建物', 'Building']) || '不明',
                            capacity,
                            examCapacity,
                            type,
                            isMovable: isTrue(getVal(['IsMovable', '可動', '移動'])),
                            equipment: sanitizeSubjectEquipmentList([...new Set(equipment)]),
                            isExcluded: isTrue(getVal(['IsExcluded', '配当対象外']))
                        };
                    });

                    resolve({ classrooms, issues });
                },
                error: (error: unknown) => reject(error instanceof Error ? error : new Error(String(error))),
            });
        }).catch(reject);
    });
};

export const parseClassroomCSVStrict = (file: File): Promise<Classroom[]> => {
    return parseClassroomCSVStrictWithIssues(file).then(result => result.classrooms);
};

export const exportToCSV = (data: Record<string, unknown>[], filename: string) => {
    const csv = Papa.unparse(data);
    const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
};

export const exportToCSVWithSaveDialog = async (data: Record<string, unknown>[], filename: string) => {
    const csv = Papa.unparse(data);
    const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });

    const picker = typeof window !== 'undefined'
        ? (window as Window & {
            showSaveFilePicker?: (options?: {
                suggestedName?: string;
                types?: Array<{
                    description?: string;
                    accept: Record<string, string[]>;
                }>;
            }) => Promise<FileSystemFileHandle>;
        }).showSaveFilePicker
        : undefined;

    if (picker) {
        try {
            const handle = await picker({
                suggestedName: filename,
                types: [
                    {
                        description: 'CSV file',
                        accept: { 'text/csv': ['.csv'] }
                    }
                ]
            });
            const writable = await handle.createWritable();
            await writable.write(blob);
            await writable.close();
            return true;
        } catch (err) {
            if (err instanceof DOMException && err.name === 'AbortError') return false;
            throw err;
        }
    }

    exportToCSV(data, filename);
    return true;
};
