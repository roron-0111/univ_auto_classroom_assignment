import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Building2,
  Cloud,
  HelpCircle,
  LayoutDashboard,
  MoveRight,
  Upload,
  WandSparkles,
  X
} from 'lucide-react';

export type GuideView = 'main' | 'subjects' | 'classrooms' | 'rules';

type GuideCaution = 'info' | 'careful' | 'danger';

type GuideStep = {
  view: GuideView;
  target: string;
  title: string;
  body: string;
  nextLabel?: string;
  caution?: GuideCaution;
  fallbackBody?: string;
};

type GuideTopic = {
  id: string;
  title: string;
  when: string;
  can: string;
  icon: LucideIcon;
  tone: 'overview' | 'subjects' | 'classrooms' | 'auto' | 'manual' | 'cloud' | 'trouble';
  steps: GuideStep[];
};

type TargetRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

const TARGET_RETRY_LIMIT = 8;
const TARGET_RETRY_DELAY_MS = 140;
const SCROLL_MEASURE_DELAY_MS = 180;
const STEP_CARD_MARGIN = 16;
const STEP_CARD_GAP = 14;
const STEP_CARD_MIN_WIDTH = 260;
const STEP_CARD_MAX_WIDTH = 420;
const STEP_CARD_ESTIMATED_HEIGHT = 360;

const GUIDE_TOPICS: GuideTopic[] = [
  {
    id: 'overview',
    title: '画面の見方',
    when: '最初に全体を確認したい',
    can: '未配当一覧、時間割、表示凡例を確認',
    icon: LayoutDashboard,
    tone: 'overview',
    steps: [
      {
        view: 'main',
        target: '[data-tour="guide-button"]',
        title: 'ガイド',
        body: '必要なところだけ確認できます。途中で項目選択に戻れます。'
      },
      {
        view: 'main',
        target: '[data-tour="unassigned-list"]',
        title: '未配当の授業',
        body: 'まだ教室が入っていない授業です。ここから配当したい授業を探します。'
      },
      {
        view: 'main',
        target: '[data-tour="timetable-grid"]',
        title: '教室の空き状況',
        body: '教室ごとに、どの時間が空いているかを見ます。'
      },
      {
        view: 'main',
        target: '[data-tour="day-tabs"]',
        title: '曜日を変える',
        body: '見たい曜日に切り替えます。'
      },
      {
        view: 'main',
        target: '[data-tour="filters"]',
        title: '教室を探しやすくする',
        body: '建物や機材で絞ると、候補の教室を探しやすくなります。'
      },
      {
        view: 'main',
        target: '[data-tour="legend"]',
        title: '表示の意味を見る',
        body: '色やマークが、重複や注意点を示します。'
      }
    ]
  },
  {
    id: 'subjects',
    title: '科目の追加・削除',
    when: '科目データを追加・更新したい',
    can: 'CSVインポート・エクスポート',
    icon: Upload,
    tone: 'subjects',
    steps: [
      {
        view: 'main',
        target: '[data-tour="subject-manager"]',
        title: '授業管理を開く',
        body: '授業データを扱うときはここを押します。次へで画面を開きます。',
        nextLabel: '次へ（開く）'
      },
      {
        view: 'subjects',
        target: '[data-tour="subject-manager-header"]',
        title: '授業を確認する',
        body: '登録済みの授業が入っているか見ます。必要なら追加や編集もできます。'
      },
      {
        view: 'subjects',
        target: '[data-tour="subject-import"]',
        title: '授業CSVを読み込む',
        body: '授業データをまとめて取り込みます。上書きされる内容に注意します。',
        caution: 'careful'
      },
      {
        view: 'subjects',
        target: '[data-tour="subject-table"]',
        title: '授業一覧を見る',
        body: '授業が正しく入っているか、一覧で見ます。'
      },
      {
        view: 'subjects',
        target: '[data-tour="subject-taxonomy"]',
        title: '学部・管轄を整える',
        body: '検索や整理に使う分類を見直します。'
      },
      {
        view: 'subjects',
        target: '[data-tour="subject-export"]',
        title: '授業を書き出す',
        body: '今の授業データをCSVで保存します。'
      }
    ]
  },
  {
    id: 'classrooms',
    title: '教室マスタの設定',
    when: '教室・定員・機材を更新したい',
    can: 'CSVインポート・エクスポート',
    icon: Building2,
    tone: 'classrooms',
    steps: [
      {
        view: 'main',
        target: '[data-tour="classroom-manager"]',
        title: '教室管理を開く',
        body: '教室データを扱うときはここを押します。次へで画面を開きます。',
        nextLabel: '次へ（開く）'
      },
      {
        view: 'classrooms',
        target: '[data-tour="classroom-manager-header"]',
        title: '教室を確認する',
        body: '教室の定員、種類、機材を見ます。'
      },
      {
        view: 'classrooms',
        target: '[data-tour="classroom-import"]',
        title: '教室CSVを読み込む',
        body: '教室データをまとめて取り込みます。上書きされる内容に注意します。',
        caution: 'careful'
      },
      {
        view: 'classrooms',
        target: '[data-tour="classroom-table"]',
        title: '教室一覧を見る',
        body: '教室ごとの定員や機材を一覧で見ます。'
      },
      {
        view: 'classrooms',
        target: '[data-tour="classroom-excluded-note"]',
        title: '使わない教室を外す',
        body: '対象外にした教室は、自動配当では使われません。',
        caution: 'careful'
      },
      {
        view: 'classrooms',
        target: '[data-tour="classroom-export"]',
        title: '教室を書き出す',
        body: '今の教室データをCSVで保存します。'
      }
    ]
  },
  {
    id: 'auto-allocation',
    title: '科目の教室自動配当',
    when: '未配当科目をまとめて配当したい',
    can: '対象・条件を選んで自動配当',
    icon: WandSparkles,
    tone: 'auto',
    steps: [
      {
        view: 'main',
        target: '[data-tour="allocation-rules"]',
        title: '配当ルール設定を開く',
        body: '自動配当を始める前に、ここで条件を確認します。次へで画面を開きます。',
        nextLabel: '次へ（開く）'
      },
      {
        view: 'rules',
        target: '[data-tour="allocation-settings-header"]',
        title: '自動配当の準備',
        body: 'どの授業を、どんな条件で配当するかを決めます。'
      },
      {
        view: 'rules',
        target: '[data-tour="allocation-basic-settings"]',
        title: '対象を選ぶ',
        body: '配当する期間、曜日、講時を選びます。'
      },
      {
        view: 'rules',
        target: '[data-tour="allocation-mode"]',
        title: '配当方法を選ぶ',
        body: '通常は未配当のみを使います。すべて再配当は今の配当も動きます。',
        caution: 'careful'
      },
      {
        view: 'rules',
        target: '[data-tour="allocation-preference-rules"]',
        title: '優先したい条件',
        body: '建物や教室タイプなど、できるだけ守りたい条件を並べます。'
      },
      {
        view: 'rules',
        target: '[data-tour="allocation-equipment-rules"]',
        title: '必要な機材',
        body: '機材が必要な授業に、対応した教室を当てやすくします。'
      },
      {
        view: 'rules',
        target: '[data-tour="allocation-run"]',
        title: '自動配当を実行',
        body: '押すと配当が始まります。ガイド中は押しません。',
        caution: 'danger'
      }
    ]
  },
  {
    id: 'manual-adjust',
    title: '手動教室調整',
    when: '一部の配当だけ変更したい',
    can: '科目を選んで空き教室へ移動',
    icon: MoveRight,
    tone: 'manual',
    steps: [
      {
        view: 'main',
        target: '[data-tour="unassigned-list"]',
        title: '未配当の授業を探す',
        body: 'まず、教室を入れたい授業を選びます。'
      },
      {
        view: 'main',
        target: '[data-tour="filters"]',
        title: '教室を絞る',
        body: '必要な建物や機材で、候補を減らします。'
      },
      {
        view: 'main',
        target: '[data-tour="timetable-grid"]',
        title: '空き教室に入れる',
        body: '時間割表の空いているところへ授業を移します。'
      },
      {
        view: 'main',
        target: '[data-tour="legend"]',
        title: '結果を見る',
        body: '色や表示を見て、問題が残っていないか確認します。'
      }
    ]
  },
  {
    id: 'cloud',
    title: 'クラウドへの書込と取得',
    when: '作業内容を保存・共有したい',
    can: 'クラウドへ書込、最新データを取得',
    icon: Cloud,
    tone: 'cloud',
    steps: [
      {
        view: 'main',
        target: '[data-tour="cloud-write"]',
        title: '保存する',
        body: '今の作業内容をクラウドに保存します。',
        caution: 'careful',
        fallbackBody: 'ログイン後に使えます。先にキャンパスを選んでください。'
      },
      {
        view: 'main',
        target: '[data-tour="cloud-read"]',
        title: '取得する',
        body: 'クラウドにある最新データを読み込みます。',
        caution: 'careful',
        fallbackBody: 'ログイン後に使えます。先にキャンパスを選んでください。'
      },
      {
        view: 'main',
        target: '[data-tour="logout"]',
        title: 'ログアウト',
        body: '別のキャンパスを選ぶときに使います。',
        fallbackBody: 'ログイン後に使えます。'
      }
    ]
  },
  {
    id: 'trouble',
    title: '教室再配当、配当クリア',
    when: '配当をやり直したい',
    can: '再配当の実行、配当クリア',
    icon: AlertTriangle,
    tone: 'trouble',
    steps: [
      {
        view: 'main',
        target: '[data-tour="legend"]',
        title: '表示の意味を見る',
        body: 'まず色やマークを見て、何が起きているか確認します。'
      },
      {
        view: 'main',
        target: '[data-tour="allocation-clear"]',
        title: '配当を消す',
        body: '配当だけを消します。授業や教室データは残ります。',
        caution: 'danger'
      },
      {
        view: 'main',
        target: '[data-tour="allocation-rules"]',
        title: '配当ルール設定を開く',
        body: '再配当したいときは、ここから設定画面を開きます。',
        nextLabel: '次へ（開く）'
      },
      {
        view: 'rules',
        target: '[data-tour="allocation-mode"]',
        title: '再配当に注意',
        body: 'すべて再配当は、今の配当も動かします。必要なときだけ使います。',
        caution: 'careful'
      }
    ]
  }
];

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onViewChange: (view: GuideView) => void;
};

const CAUTION_LABELS: Record<GuideCaution, string> = {
  info: '確認',
  careful: '注意',
  danger: '実行注意'
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const getStepCardWidth = () => Math.min(
  STEP_CARD_MAX_WIDTH,
  Math.max(STEP_CARD_MIN_WIDTH, window.innerWidth - STEP_CARD_MARGIN * 2)
);

export const GuideTour = ({ isOpen, onClose, onViewChange }: Props) => {
  const [activeTopicId, setActiveTopicId] = useState<string | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const [isStepReady, setIsStepReady] = useState(false);
  const [isTargetMissing, setIsTargetMissing] = useState(false);
  const measureRequestRef = useRef(0);
  const menuCardRef = useRef<HTMLDivElement | null>(null);
  const pendingTimersRef = useRef<number[]>([]);

  const activeTopic = useMemo(
    () => GUIDE_TOPICS.find(topic => topic.id === activeTopicId) ?? null,
    [activeTopicId]
  );
  const activeStep = activeTopic?.steps[stepIndex] ?? null;

  const clearPendingTimers = useCallback(() => {
    pendingTimersRef.current.forEach(timer => window.clearTimeout(timer));
    pendingTimersRef.current = [];
  }, []);

  const scheduleTimer = useCallback((callback: () => void, delay: number) => {
    const timer = window.setTimeout(() => {
      pendingTimersRef.current = pendingTimersRef.current.filter(item => item !== timer);
      callback();
    }, delay);
    pendingTimersRef.current.push(timer);
  }, []);

  const updateTargetRect = useCallback((shouldScroll = false, attempt = 0, requestId = measureRequestRef.current) => {
    if (requestId !== measureRequestRef.current) return;
    if (!activeStep) {
      setTargetRect(null);
      setIsStepReady(false);
      setIsTargetMissing(false);
      return;
    }
    const target = document.querySelector(activeStep.target);
    if (!(target instanceof HTMLElement)) {
      if (attempt < TARGET_RETRY_LIMIT) {
        scheduleTimer(() => updateTargetRect(shouldScroll, attempt + 1, requestId), TARGET_RETRY_DELAY_MS);
        return;
      }
      setTargetRect(null);
      setIsTargetMissing(true);
      setIsStepReady(true);
      return;
    }
    const measureTarget = () => {
      if (requestId !== measureRequestRef.current) return;
      const rect = target.getBoundingClientRect();
      setTargetRect({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height
      });
      setIsTargetMissing(false);
      setIsStepReady(true);
    };
    if (shouldScroll) {
      target.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
      scheduleTimer(measureTarget, SCROLL_MEASURE_DELAY_MS);
      return;
    }
    measureTarget();
  }, [activeStep, scheduleTimer]);

  useEffect(() => {
    if (!isOpen) return;
    if (!activeStep) {
      measureRequestRef.current += 1;
      clearPendingTimers();
      setTargetRect(null);
      setIsStepReady(false);
      setIsTargetMissing(false);
      onViewChange('main');
      return;
    }
    measureRequestRef.current += 1;
    const requestId = measureRequestRef.current;
    clearPendingTimers();
    setTargetRect(null);
    setIsStepReady(false);
    setIsTargetMissing(false);
    onViewChange(activeStep.view);
    scheduleTimer(() => updateTargetRect(true, 0, requestId), activeStep.view === 'main' ? 80 : 220);
    return () => {
      clearPendingTimers();
    };
  }, [isOpen, activeStep, onViewChange, updateTargetRect, clearPendingTimers, scheduleTimer]);

  useEffect(() => {
    if (!isOpen || !activeStep) return undefined;
    const handleUpdate = () => updateTargetRect(false, 0, measureRequestRef.current);
    window.addEventListener('resize', handleUpdate);
    window.addEventListener('scroll', handleUpdate, true);
    return () => {
      window.removeEventListener('resize', handleUpdate);
      window.removeEventListener('scroll', handleUpdate, true);
    };
  }, [isOpen, activeStep, updateTargetRect]);

  useEffect(() => {
    if (!isOpen || activeTopic) return;
    window.requestAnimationFrame(() => {
      menuCardRef.current?.scrollTo({ top: 0, left: 0 });
    });
  }, [isOpen, activeTopic]);

  const startTopic = (topicId: string) => {
    setActiveTopicId(topicId);
    setStepIndex(0);
  };

  const backToMenu = () => {
    setActiveTopicId(null);
    setStepIndex(0);
    setTargetRect(null);
    setIsStepReady(false);
    setIsTargetMissing(false);
    clearPendingTimers();
    onViewChange('main');
  };

  const goNext = () => {
    if (!activeTopic) return;
    if (stepIndex >= activeTopic.steps.length - 1) {
      backToMenu();
      return;
    }
    setStepIndex(prev => prev + 1);
  };

  const handleClose = () => {
    clearPendingTimers();
    onViewChange('main');
    onClose();
  };

  const tooltipStyle = useMemo<CSSProperties>(() => {
    if (!targetRect) {
      return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
    }
    const width = getStepCardWidth();
    const maxLeft = Math.max(STEP_CARD_MARGIN, window.innerWidth - width - STEP_CARD_MARGIN);
    const maxTop = Math.max(STEP_CARD_MARGIN, window.innerHeight - STEP_CARD_ESTIMATED_HEIGHT - STEP_CARD_MARGIN);
    const rightLeft = targetRect.left + targetRect.width + STEP_CARD_GAP;
    const leftLeft = targetRect.left - width - STEP_CARD_GAP;
    const belowTop = targetRect.top + targetRect.height + STEP_CARD_GAP;
    const aboveTop = targetRect.top - STEP_CARD_ESTIMATED_HEIGHT - STEP_CARD_GAP;
    const centeredLeft = targetRect.left + targetRect.width / 2 - width / 2;

    let left = centeredLeft;
    let top = belowTop;

    if (rightLeft + width <= window.innerWidth - STEP_CARD_MARGIN) {
      left = rightLeft;
      top = targetRect.top;
    } else if (leftLeft >= STEP_CARD_MARGIN) {
      left = leftLeft;
      top = targetRect.top;
    } else if (belowTop + STEP_CARD_ESTIMATED_HEIGHT <= window.innerHeight - STEP_CARD_MARGIN) {
      left = centeredLeft;
      top = belowTop;
    } else if (aboveTop >= STEP_CARD_MARGIN) {
      left = centeredLeft;
      top = aboveTop;
    }

    left = clamp(left, STEP_CARD_MARGIN, maxLeft);
    top = clamp(top, STEP_CARD_MARGIN, maxTop);
    return { top, left, width };
  }, [targetRect]);

  if (!isOpen) return null;

  if (!activeTopic || !activeStep) {
    return (
      <div className="guide-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="guide-menu-title">
        <div className="guide-menu-card" ref={menuCardRef}>
          <div className="guide-menu-header">
            <div>
              <h2 id="guide-menu-title">ガイド</h2>
              <p>項目を選択すると、ガイドツアーを開始します。</p>
            </div>
            <button type="button" className="guide-icon-button" onClick={handleClose} aria-label="ガイドを閉じる">
              <X size={20} />
            </button>
          </div>
          <div className="guide-topic-grid">
            {GUIDE_TOPICS.map(topic => {
              const TopicIcon = topic.icon;
              return (
                <button
                  key={topic.id}
                  type="button"
                  className="guide-topic-button"
                  data-topic={topic.id}
                  onClick={() => startTopic(topic.id)}
                >
                  <span className={`guide-topic-icon guide-topic-icon-${topic.tone}`}>
                    <TopicIcon size={23} />
                  </span>
                  <span className="guide-topic-text">
                    <strong>{topic.title}</strong>
                    <span className="guide-topic-line">
                      <span className="guide-topic-label">こんな時</span>
                      <span>{topic.when}</span>
                    </span>
                    <span className="guide-topic-line">
                      <span className="guide-topic-label">できること</span>
                      <span>{topic.can}</span>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  const highlightStyle = targetRect
    ? {
        top: clamp(targetRect.top - 6, 0, window.innerHeight),
        left: clamp(targetRect.left - 6, 0, window.innerWidth),
        width: Math.min(targetRect.width + 12, window.innerWidth - clamp(targetRect.left - 6, 0, window.innerWidth)),
        height: Math.min(targetRect.height + 12, window.innerHeight - clamp(targetRect.top - 6, 0, window.innerHeight))
      }
    : undefined;
  const stepBody = targetRect ? activeStep.body : activeStep.fallbackBody ?? 'この場所は今の画面では表示されていません。必要な画面を開いてから、もう一度確認してください。';

  if (!isStepReady) {
    return (
      <div className="guide-tour-layer" role="dialog" aria-modal="true" aria-labelledby="guide-step-title">
        <div className="guide-tour-dim" />
      </div>
    );
  }

  return (
    <div className="guide-tour-layer" role="dialog" aria-modal="true" aria-labelledby="guide-step-title">
      <div className="guide-tour-dim" />
      {highlightStyle && <div className="guide-highlight" style={highlightStyle} />}
      <div className="guide-step-card" style={tooltipStyle}>
        <div className="guide-step-kicker">
          <span className="guide-assistant-icon"><HelpCircle size={16} /></span>
          {activeTopic.title} {stepIndex + 1} / {activeTopic.steps.length}
        </div>
        <h2 id="guide-step-title" className="guide-step-title">{activeStep.title}</h2>
        <p className="guide-step-text">{stepBody}</p>
        {activeStep.caution && (
          <div className={`guide-caution guide-caution-${activeStep.caution}`}>
            <strong>{CAUTION_LABELS[activeStep.caution]}</strong>
            <span>
              {activeStep.caution === 'danger'
                ? '実行ボタンはガイドでは押しません。必要なときだけ手動で押してください。'
                : '取り込みや再配当は、今の内容が変わることがあります。'}
            </span>
          </div>
        )}
        {isTargetMissing && (
          <div className="guide-missing-target">
            対象が見つかりません。ログイン状態や画面の表示状態を確認してください。
          </div>
        )}
        <div className="guide-step-actions">
          <button type="button" className="guide-secondary-button" onClick={backToMenu}>
            項目選択へ
          </button>
          <div className="guide-step-nav">
            <button
              type="button"
              className="guide-secondary-button"
              onClick={() => setStepIndex(prev => Math.max(0, prev - 1))}
              disabled={stepIndex === 0}
            >
              <ArrowLeft size={16} /> 戻る
            </button>
            <button type="button" className="guide-primary-button" onClick={goNext}>
              {stepIndex >= activeTopic.steps.length - 1 ? '完了' : activeStep.nextLabel ?? '次へ'} <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
