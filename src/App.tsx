import { useState, useMemo, useRef, useEffect } from 'react';
import './App.css';
import type { Classroom, Subject, Allocation, Term, DayOfWeek, Period, DisplayConfig, AllocationRule } from './types';
import { BUILDINGS, DAY_LABELS, CAMPUSES } from './types';
import { mockClassrooms, mockSubjects } from './data/mockData';
import { TimeTableGrid } from './components/TimeTableGrid';
import { UnassignedList } from './components/UnassignedList';
import { ClassroomManager } from './components/ClassroomManager';
import { DisplaySettings } from './components/DisplaySettings';
import { runAutoAllocation } from './utils/optimizer';
import { SubjectManager } from './components/SubjectManager';
import { SubjectEditModal } from './components/SubjectEditModal';
import { ClassroomEditModal } from './components/ClassroomEditModal';
import { AllocationRuleSettings } from './components/AllocationRuleSettings';
import { DEFAULT_ALLOCATION_RULES, DEFAULT_ORDER_BONUSES, DEFAULT_EQUIPMENT_SETTINGS, EQUIPMENT_LIST } from './types';
import type { AllocationOptions } from './types';

// Cloud Sync
import { CloudConnectionModal } from './components/CloudConnectionModal';
import { useAuth } from './utils/useAuth';
import { useCloudSync } from './utils/useCloudSync';
import type { CloudData } from './types_cloud';

// Icons
import {
  RefreshCw, Settings, BookOpen, Eye, Calendar,
  AlertTriangle, ListChecks, Cloud, CloudOff, LogIn
} from 'lucide-react';

const DAYS: DayOfWeek[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'];


function App() {
  // Auth & Cloud Sync
  const { user, loginByCampus, logout: authLogout, loading: authLoading } = useAuth();
  const { saveData, refreshData } = useCloudSync(user);

  const [showCloudModal, setShowCloudModal] = useState(false);
  const [isCloudLoading, setIsCloudLoading] = useState(false);

  // ログイン強制ロジック
  useEffect(() => {
    if (!authLoading && !user) {
      setShowCloudModal(true);
    }
  }, [authLoading, user]);

  const [classrooms, setClassrooms] = useState<Classroom[]>(() => {
    try {
      const saved = localStorage.getItem('classrooms');
      return saved ? JSON.parse(saved) : mockClassrooms;
    } catch { return mockClassrooms; }
  });
  const [subjects, setSubjects] = useState<Subject[]>(() => {
    try {
      const saved = localStorage.getItem('subjects');
      return saved ? JSON.parse(saved) : mockSubjects;
    } catch { return mockSubjects; }
  });
  const [allocations, setAllocations] = useState<Allocation[]>(() => {
    try {
      const saved = localStorage.getItem('allocations');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const [currentDay, setCurrentDay] = useState<DayOfWeek>('mon');
  const [selectedBuilding, setSelectedBuilding] = useState<string>('all');
  const [showManager, setShowManager] = useState(false);
  const [showSubjectManager, setShowSubjectManager] = useState(false);
  const [editingSubjectId, setEditingSubjectId] = useState<string | null>(null);
  const [editingClassroomId, setEditingClassroomId] = useState<string | null>(null);
  const [showDisplaySettings, setShowDisplaySettings] = useState(false);
  const [showRuleSettings, setShowRuleSettings] = useState(false);
  const [showExtraPeriods, setShowExtraPeriods] = useState(false);

  const [allocationSettings, setAllocationSettings] = useState<AllocationRule[]>(() => {
    try {
      const saved = localStorage.getItem('allocationSettings');
      return saved ? JSON.parse(saved) : DEFAULT_ALLOCATION_RULES;
    } catch { return DEFAULT_ALLOCATION_RULES; }
  });

  const [orderBonuses, setOrderBonuses] = useState<number[]>(() => {
    try {
      const saved = localStorage.getItem('orderBonuses');
      return saved ? JSON.parse(saved) : DEFAULT_ORDER_BONUSES;
    } catch { return DEFAULT_ORDER_BONUSES; }
  });

  const [equipmentSettings, setEquipmentSettings] = useState<{
    items: { [key: string]: { enabled: boolean; importance: number } };
    strictLevel5: boolean;
  }>(() => {
    const saved = localStorage.getItem('equipmentSettings');
    if (!saved) return DEFAULT_EQUIPMENT_SETTINGS;
    try {
      const parsed = JSON.parse(saved);
      // 新しいネスト構造（itemsプロパティあり）かチェック
      if (parsed && typeof parsed === 'object' && 'items' in parsed) {
        return parsed;
      }
      // 旧構造（フラットなオブジェクト）からの移行
      return {
        items: parsed,
        strictLevel5: false
      };
    } catch (e) {
      return DEFAULT_EQUIPMENT_SETTINGS;
    }
  });

  const [displayConfig, setDisplayConfig] = useState<DisplayConfig>(() => {
    try {
      const saved = localStorage.getItem('displayConfig');
      if (saved) return JSON.parse(saved);
    } catch { /* fall through to default */ }
    return {
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
  });

  const [pickingCell, setPickingCell] = useState<{ room: string; period: Period; term: Term } | null>(null);
  const [draggingSubjectId, setDraggingSubjectId] = useState<string | null>(null);

  // 永続化（ローカルストレージ）
  // クラウド接続中もローカルバックアップとして機能させるが、
  // クラウドからのロード直後は上書きしないよう注意が必要（現状は単純に保存）
  useEffect(() => { localStorage.setItem('classrooms', JSON.stringify(classrooms)); }, [classrooms]);
  useEffect(() => { localStorage.setItem('subjects', JSON.stringify(subjects)); }, [subjects]);
  useEffect(() => { localStorage.setItem('allocations', JSON.stringify(allocations)); }, [allocations]);
  useEffect(() => { localStorage.setItem('allocationSettings', JSON.stringify(allocationSettings)); }, [allocationSettings]);
  useEffect(() => { localStorage.setItem('equipmentSettings', JSON.stringify(equipmentSettings)); }, [equipmentSettings]);
  useEffect(() => { localStorage.setItem('displayConfig', JSON.stringify(displayConfig)); }, [displayConfig]);

  // 自動保存の仕組み: ローカルの状態が変わった際、ログイン中ならクラウドにも保存
  useEffect(() => {
    if (user && !isCloudLoading) {
      const data: CloudData = {
        subjects,
        classrooms,
        allocations,
        settings: allocationSettings,
        equipmentSettings,
        orderBonuses
      };

      const timeoutId = setTimeout(() => {
        saveData(data).catch(console.error);
      }, 2000); // 2秒変更がなければ保存

      return () => clearTimeout(timeoutId);
    }
  }, [user, isCloudLoading, subjects, classrooms, allocations, allocationSettings, equipmentSettings, orderBonuses, saveData]);


  // クラウドデータの旧フォーマット（フラット構造）を新フォーマットに移行
  const migrateEquipmentSettings = (s: any) =>
    s && typeof s === 'object' && 'items' in s ? s : { items: s || {}, strictLevel5: false };

  const handleCloudConnect = async (email: string) => {
    try {
      setIsCloudLoading(true);
      // 単一のキャンパスログインに統合
      await loginByCampus(email); // emailにはcampusIdが入る

      // ログイン直後にデータをロード
      const cloudData = await refreshData();
      if (cloudData) {
        if (window.confirm('クラウド上のデータが見つかりました。現在のローカルデータを上書きしてロードしますか？')) {
          setClassrooms(cloudData.classrooms);
          setSubjects(cloudData.subjects);
          setAllocations(cloudData.allocations);
          setAllocationSettings(cloudData.settings?.length ? cloudData.settings : DEFAULT_ALLOCATION_RULES);
          setOrderBonuses(cloudData.orderBonuses?.length ? cloudData.orderBonuses : DEFAULT_ORDER_BONUSES);
          setEquipmentSettings(migrateEquipmentSettings(cloudData.equipmentSettings));

          alert('クラウドデータをロードしました。');
          setShowCloudModal(false);
          return; // ロードした場合は保存処理を飛ばす（useEffect側で必要に応じて保存される）
        }
      }

      // クラウドにデータがない、またはロードをキャンセルした場合は現在のローカルデータをアップロード
      const currentData: CloudData = {
        subjects,
        classrooms,
        allocations,
        settings: allocationSettings,
        equipmentSettings,
        orderBonuses
      };
      await saveData(currentData);
      alert('現在のデータをクラウドに同期しました。');
      setShowCloudModal(false);
    } catch (e) {
      throw e; // Modalでエラー表示させるために再スロー
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

  const buildings = useMemo(() => {
    const list = Array.from(new Set(classrooms.map(c => c.building)));
    // BUILDINGS 定数の順序でソート。含まれないものは末尾へ。
    const sortedList = [...list].sort((a, b) => {
      const order = ['フォーサイト', '3号館', '7号館', '8号館', 'SCC'];
      const indexA = order.indexOf(a);
      const indexB = order.indexOf(b);
      if (indexA === -1 && indexB === -1) return a.localeCompare(b);
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });
    return ['all', ...sortedList];
  }, [classrooms]);

  const allEquipment = useMemo(() => {
    const set = new Set<string>(EQUIPMENT_LIST);
    classrooms.forEach(c => {
      c.equipment.forEach(e => set.add(e));
    });
    return Array.from(set).sort();
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

    // BUILDINGS の順序でソート
    return [...list].sort((a, b) => {
      const indexA = BUILDINGS.indexOf(a.building as any);
      const indexB = BUILDINGS.indexOf(b.building as any);
      if (indexA === -1 && indexB === -1) return a.building.localeCompare(b.building);
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      if (indexA !== indexB) return indexA - indexB;
      return a.name.localeCompare(b.name);
    });
  }, [classrooms, selectedBuilding]);

  const handleClassroomUpdate = (updated: Classroom[]) => {
    const roomIds = new Set(updated.map(r => r.id));
    const lostRooms = classrooms.filter(r => !roomIds.has(r.id)).map(r => r.id);

    if (lostRooms.length > 0) {
      setAllocations(prev => prev.filter(a => !lostRooms.includes(a.classroomId)));
    }

    setClassrooms(updated);
  };

  const handleSubjectUpdate = (updated: Subject[]) => {
    const subjectIds = new Set(updated.map(s => s.id));
    const lostSubjects = subjects.filter(s => !subjectIds.has(s.id)).map(s => s.id);

    setAllocations(prev => {
      let next = prev.filter(a => !lostSubjects.includes(a.subjectId));

      next = next.filter(a => {
        const oldSub = subjects.find(s => s.id === a.subjectId);
        const newSub = updated.find(s => s.id === a.subjectId);
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

    setSubjects(updated);
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

  const displayedUnassigned = useMemo(() => {
    return unassignedSubjectsAll.filter(s => s.day === currentDay);
  }, [unassignedSubjectsAll, currentDay]);


  const handleDrop = (vSubjectId: string, classroomId: string, period: Period, term: Term) => {
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

      if (current.length < limit) {
        return [...prev, { subjectId, classroomId }];
      } else {
        // 上限に達している場合は、最も古い（先頭の）割り当てを1つ削除して追加
        const others = prev.filter((_a, i) => i !== prev.findIndex(x => x.subjectId === subjectId));
        return [...others, { subjectId, classroomId }];
      }
    });
  };

  const handleRemove = (subjectId: string, classroomId: string) => {
    setAllocations(prev => prev.filter(a => !(a.subjectId === subjectId && a.classroomId === classroomId)));
  };

  const handleAutoAllocate = (options: AllocationOptions) => {
    const { rules: rulesToUse, orderBonuses: bonusesToUse, priorities, includeAllocated, includeUnassigned, equipmentSettings: equipmentToUse } = options;

    // 対象科目をフィルタリング
    const allocatedSubjectIds = new Set(allocations.map(a => a.subjectId));
    const targetSubjects = subjects.filter(s => {
      // 優先度フィルタ
      if (!priorities.includes(s.priority)) return false;

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

    // 配当済みを含む場合は確認
    if (includeAllocated) {
      const allocatedCount = targetSubjects.filter(s => allocatedSubjectIds.has(s.id)).length;
      if (allocatedCount > 0 && !confirm(`配当済み${allocatedCount}件を含む${targetSubjects.length}件を再配当します。\n既存の配当はリセットされます。よろしいですか？`)) return;
    }

    // 既存配当から対象科目を除外
    const preservedAllocations = allocations.filter(a => !targetSubjects.some(s => s.id === a.subjectId));

    const result = runAutoAllocation(targetSubjects, classrooms, preservedAllocations, rulesToUse, bonusesToUse, equipmentToUse);
    setAllocations(result.allocations);

    const newCount = result.allocations.length - preservedAllocations.length;
    alert(`完了しました。\n対象: ${targetSubjects.length}件\n配当: ${newCount}件\n未配当: ${result.unassignedSubjects.length}件`);
    setShowRuleSettings(false);
  };

  const handleReset = () => {
    if (confirm('割り当てをクリアしますか？')) setAllocations([]);
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

  const handleReorderSubjects = (reorderedUnassigned: Subject[]) => {
    const unassignedIds = new Set(reorderedUnassigned.map(s => s.id));
    let unassignedIdx = 0;

    const newSubjects = subjects.map(s => {
      if (unassignedIds.has(s.id)) {
        return reorderedUnassigned[unassignedIdx++];
      }
      return s;
    });

    setSubjects(newSubjects);
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
            <div className={`sync-badge ${isCloudLoading ? 'saving' : 'synced'}`}>
              <Cloud size={14} className={isCloudLoading ? 'animate-pulse' : ''} />
              <span>{isCloudLoading ? 'クラウド同期中...' : 'クラウド同期済み'}</span>
            </div>
          )}

          <button
            onClick={() => setShowCloudModal(true)}
            style={{
              display: 'flex', gap: '8px', alignItems: 'center',
              background: user ? 'rgba(100, 108, 255, 0.1)' : '#fff',
              color: user ? '#646cff' : '#666',
              border: user ? '1px solid rgba(100, 108, 255, 0.2)' : '1px solid #ccc',
              padding: '6px 16px', borderRadius: '12px', cursor: 'pointer',
              fontWeight: 'bold', transition: 'all 0.2s',
              boxShadow: user ? 'none' : '0 1px 2px rgba(0,0,0,0.05)'
            }}
            className="hover:scale-105 active:scale-95"
          >
            {user ? <LogIn size={16} /> : <CloudOff size={16} />}
            {user ? `ログイン中(${(CAMPUSES.find(c => `${c.id}@campus.local` === user.email)?.name) || user.email?.split('@')[0]})` : 'ログイン'}
          </button>


          {user && (
            <button
              onClick={async () => {
                if (!isCloudLoading) {
                  setIsCloudLoading(true);
                  try {
                    const data = await refreshData();
                    if (data) {
                      if (data.classrooms) setClassrooms(data.classrooms);
                      if (data.subjects) setSubjects(data.subjects);
                      if (data.allocations) setAllocations(data.allocations);
                      if (data.settings?.length) setAllocationSettings(data.settings);
                      if (data.equipmentSettings) setEquipmentSettings(migrateEquipmentSettings(data.equipmentSettings));
                      if (data.orderBonuses?.length) setOrderBonuses(data.orderBonuses);
                      alert('最新のデータを取得しました');
                    } else {
                      alert('保存されたデータが見つかりませんでした');
                    }
                  } catch (e: any) {
                    console.error('Refresh Error:', e);
                    alert('データの取得に失敗しました');
                  } finally {
                    setIsCloudLoading(false);
                  }
                }
              }}
              style={{
                display: 'flex', gap: '6px', alignItems: 'center',
                background: '#fff', color: '#666',
                border: '1px solid #ccc',
                padding: '6px 14px', borderRadius: '12px', cursor: 'pointer',
                opacity: isCloudLoading ? 0.5 : 1,
                fontSize: '0.9rem', fontWeight: '500'
              }}
              disabled={isCloudLoading}
              title="共有データを取得して更新"
            >
              <RefreshCw size={16} className={isCloudLoading ? 'animate-spin' : ''} />
              更新(共有)
            </button>
          )}

          <div style={{ width: '1px', background: '#666', height: '24px', margin: '0 4px' }}></div>
          <button onClick={() => setShowRuleSettings(true)} style={{ display: 'flex', gap: '6px', alignItems: 'center', background: '#2e7d32', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
            <ListChecks size={16} /> 配当ルール設定
          </button>
          <button onClick={handleReset} style={{ display: 'flex', gap: '6px', alignItems: 'center', background: '#d32f2f', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: '4px', cursor: 'pointer' }}>
            <RefreshCw size={16} /> クリア
          </button>
          <div style={{ width: '1px', background: '#666', height: '24px', margin: '0 4px' }}></div>
          <button onClick={() => setShowManager(true)} style={{ display: 'flex', gap: '6px', alignItems: 'center', background: '#444', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: '4px', cursor: 'pointer' }}>
            <Settings size={16} /> 教室管理
          </button>
          <button onClick={() => setShowSubjectManager(true)} style={{ display: 'flex', gap: '6px', alignItems: 'center', background: '#444', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: '4px', cursor: 'pointer' }}>
            <BookOpen size={16} /> 授業管理
          </button>
          <button onClick={() => setShowDisplaySettings(true)} style={{ display: 'flex', gap: '6px', alignItems: 'center', background: '#444', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: '4px', cursor: 'pointer' }}>
            <Eye size={16} /> 表示設定
          </button>
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
            <div style={{ display: 'flex', borderBottom: '1px solid #eee' }}>
              {
                DAYS.map(d => (
                  <button
                    key={d}
                    onClick={() => setCurrentDay(d)}
                    style={{
                      padding: '12px 25px', border: 'none',
                      background: currentDay === d ? '#fff' : 'transparent',
                      borderBottom: currentDay === d ? '3px solid #646cff' : 'none',
                      color: currentDay === d ? '#646cff' : '#666',
                      fontWeight: currentDay === d ? 'bold' : 'normal',
                      cursor: 'pointer', fontSize: '0.95em'
                    }}
                  >
                    {(() => {
                      const total = subjects.filter(s => s.day === d).length;
                      const allocated = subjects.filter(s => s.day === d && allocations.some(a => a.subjectId === s.id)).length;
                      return `${DAY_LABELS[d]}曜日${total > 0 ? ` (${allocated}/${total})` : ''}`;
                    })()}
                  </button>
                ))
              }
            </div>

            {/* Building Selection & Extra Options */}
            < div style={{ display: 'flex', gap: '20px', padding: '10px 20px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85em', color: '#666', fontWeight: 'bold' }}>建物：</span>
                {buildings.map(b => (
                  <button
                    key={b}
                    onClick={() => setSelectedBuilding(b)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '0 12px',
                      height: '30px',
                      minWidth: '60px',
                      borderRadius: '15px',
                      border: '1px solid #ddd',
                      background: selectedBuilding === b ? '#646cff' : '#fff',
                      color: selectedBuilding === b ? '#fff' : '#333',
                      fontSize: '0.85em',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {b === 'all' ? 'すべて' : b}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85em', color: '#666' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={showExtraPeriods} onChange={e => setShowExtraPeriods(e.target.checked)} />
                  6・7講時を表示
                </label>
              </div>
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
                  {classrooms.find(r => r.id === pickingCell.room)?.name} - {pickingCell.period}限 ({pickingCell.term === 'spring' ? '春' : '秋'})
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
                        <div style={{ fontWeight: 'bold', color: '#333' }}>{s.name}</div>
                        <div style={{ fontSize: '0.85em', color: '#666' }}>{s.teacher} / 定員: {s.requiredCapacity}</div>
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
              onUpdate={handleSubjectUpdate}
              onClose={() => setShowSubjectManager(false)}
            />
          )
        }

        {/* Subject Individual Edit Modal */}
        {
          editingSubject && (
            <SubjectEditModal
              subject={editingSubject}
              availableEquipment={allEquipment}
              onSave={(updated) => {
                setSubjects(prev => {
                  const next = prev.map(s => s.id === updated.id ? updated : s);
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
              onSave={(updated) => {
                setClassrooms(prev => prev.map(r => r.id === updated.id ? updated : r));
                setEditingClassroomId(null);
              }}
              onClose={() => setEditingClassroomId(null)}
            />
          )
        }

        {/* Display Settings Overlay */}
        {
          showDisplaySettings && (
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
              orderBonuses={orderBonuses}
              equipmentSettings={equipmentSettings}
              onSave={(options) => {
                setAllocationSettings(options.rules);
                setOrderBonuses(options.orderBonuses);
                setEquipmentSettings(options.equipmentSettings);
                localStorage.setItem('orderBonuses', JSON.stringify(options.orderBonuses));
                localStorage.setItem('equipmentSettings', JSON.stringify(options.equipmentSettings)); // 念のため即時保存
                handleAutoAllocate(options);
              }}
              onClose={() => setShowRuleSettings(false)}
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
