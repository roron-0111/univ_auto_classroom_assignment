import Papa from 'papaparse';
import type { Classroom, Subject, Term, DayOfWeek, Period } from '../types';
import { EQUIPMENT_LIST, normalizeEquipmentName } from '../types';

// Header definitions
// Header definitions

export const parseClassroomCSV = (file: File): Promise<Classroom[]> => {
    return new Promise((resolve, reject) => {
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                const classrooms: Classroom[] = (results.data as Record<string, string>[]).map((row) => {
                    const getVal = (keys: string[]) => {
                        const key = keys.find(k => row[k] !== undefined);
                        return key ? row[key] : '';
                    };

                    const isTrue = (val: string) =>
                        val === 'true' || val === 'TRUE' || val === '1' || val === '○' || val === 'あり';

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
                    const id = getVal(['ID', '教室コード']) || name;

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
            error: (error) => reject(error),
        });
    });
};

export const parseSubjectCSV = (file: File): Promise<Subject[]> => {
    return new Promise((resolve, reject) => {
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                const rawSubjects = (results.data as Record<string, string>[]).map((row) => ({
                    id: row.ID || row['時間割コード'] || `s-${Math.random().toString(36).substr(2, 9)}`,
                    code: row['時間割コード'] || row.Code || row.ID,
                    name: row.Name || row['時間割名称'] || row['授業名'],
                    teacherCode: row.TeacherCode || row['教員コード'] || row['教員番号'] || '',
                    teacher: row.Teacher || row['教員'] || row['代表教員'],
                    department: row.Department || row['管轄学科'] || row['学科'],
                    faculty: row.Faculty || row['開講学部'],
                    term: (() => {
                        const t = row.Term || row['開講期'] || row['配当期'] || row['学期'];
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
                        const d = row.Day || row['曜日'];
                        const map: Record<string, DayOfWeek> = { '月': 'mon', '火': 'tue', '水': 'wed', '木': 'thu', '金': 'fri', '土': 'sat' };
                        return map[d] || d as DayOfWeek;
                    })(),
                    period: parseInt(row.Period || row['開始講時'] || row['講時'], 10) as Period,
                    endPeriod: (parseInt(row.EndPeriod || row['終了講時'], 10) || undefined) as Period | undefined,
                    requiredCapacity: parseInt(row.RequiredCapacity || row['履修予定人数'] || row['履修想定人数'] || row['定員'], 10) || 0,
                    campus: row.Campus || row['キャンパス'],
                    previousRooms: row.PreviousRooms || row['教室'] || row['過去教室'] ? (row.PreviousRooms || row['教室'] || row['過去教室']).split(/[;\s]+/).map((s: string) => s.trim()).filter(Boolean) : [],
                    preferredRoomType: (() => {
                        const t = row.PreferredRoomType || row['希望教室タイプ'] || row['教室タイプ'];
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
                    buildingPreference: row.BuildingPreference || row['棟希望'],
                    // 必須設備: 設備列の値が◎のもの（新形式）、または旧形式の必須_X列
                    mandatoryEquipment: (() => {
                        const fromNew = EQUIPMENT_LIST.filter(eq => row[eq] === '◎').map(normalizeEquipmentName);
                        if (fromNew.length > 0) return fromNew;
                        // 旧形式後方互換: 必須_X列
                        return EQUIPMENT_LIST.filter(eq => row[`必須_${eq}`] === '○').map(normalizeEquipmentName);
                    })(),
                    // 希望設備: 設備列の値が○のもの（新形式）、または旧形式
                    requiredEquipment: (() => {
                        const fromNew = EQUIPMENT_LIST.filter(eq => row[eq] === '○').map(normalizeEquipmentName);
                        if (fromNew.length > 0) return fromNew;
                        // 旧形式後方互換: 希望_X列
                        const fromOldCols = EQUIPMENT_LIST.filter(eq => row[`希望_${eq}`] === '○').map(normalizeEquipmentName);
                        if (fromOldCols.length > 0) return fromOldCols;
                        // さらに旧形式: 必須設備セル（スペース/セミコロン区切り）
                        const legacy = row.RequiredEquipment || row['必須設備'];
                        return legacy ? legacy.split(/[;\s]+/).map((s: string) => normalizeEquipmentName(s.trim())).filter(Boolean) : [];
                    })(),
                }));

                // グルーピングして必要教室数を算出
                const grouped = new Map<string, Subject>();
                rawSubjects.forEach(s => {
                    const key = `${s.code}-${s.term}-${s.day}-${s.period}`;
                    if (grouped.has(key)) {
                        const existing = grouped.get(key)!;
                        existing.requiredRoomCount = (existing.requiredRoomCount || 1) + 1; // Increment count, default to 1 if not set
                        if (s.previousRooms && s.previousRooms.length > 0) {
                            existing.previousRooms = Array.from(new Set([...(existing.previousRooms || []), ...s.previousRooms]));
                        }
                    } else {
                        grouped.set(key, { ...s, requiredRoomCount: 1 });
                    }
                });

                resolve(Array.from(grouped.values()));
            },
            error: (error) => reject(error),
        });
    });
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
