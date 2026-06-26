import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { ArrowLeft, ArrowRight, HelpCircle, X } from 'lucide-react';
import { GUIDE_TOPICS } from './guideTourData';
import type { GuideView } from './guideTourData';

type TargetRect = {
  top: number;
  left: number;
  width: number;
  height: number;
  zoom: number;
};

const TARGET_RETRY_LIMIT = 8;
const TARGET_RETRY_DELAY_MS = 140;
const SCROLL_MEASURE_DELAY_MS = 180;
const STEP_CARD_MARGIN = 16;
const STEP_CARD_GAP = 14;
const STEP_CARD_MIN_WIDTH = 220;
const STEP_CARD_MAX_WIDTH = 420;
const STEP_CARD_ESTIMATED_HEIGHT = 260;

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onViewChange: (view: GuideView) => void;
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const getStepCardWidth = (availableWidth = window.innerWidth - STEP_CARD_MARGIN * 2) => Math.min(
  STEP_CARD_MAX_WIDTH,
  Math.max(STEP_CARD_MIN_WIDTH, availableWidth)
);

const getPageZoom = () => {
  const zoomValues = [document.documentElement, document.body]
    .map(element => Number(window.getComputedStyle(element).zoom))
    .filter(value => Number.isFinite(value) && value > 0);
  return zoomValues[0] ?? 1;
};

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
      const zoom = getPageZoom();
      setTargetRect({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        zoom
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

  const handleClose = useCallback(() => {
    clearPendingTimers();
    onViewChange('main');
    onClose();
  }, [clearPendingTimers, onClose, onViewChange]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      handleClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleClose, isOpen]);

  const tooltipStyle = useMemo<CSSProperties>(() => {
    if (!targetRect) {
      return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
    }
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const zoom = targetRect.zoom || 1;
    const idealWidth = getStepCardWidth();
    const maxTop = Math.max(STEP_CARD_MARGIN, viewportHeight - STEP_CARD_ESTIMATED_HEIGHT - STEP_CARD_MARGIN);
    const clampTop = (top: number) => clamp(top, STEP_CARD_MARGIN, maxTop);
    const clampLeft = (left: number, width: number) => clamp(
      left,
      STEP_CARD_MARGIN,
      Math.max(STEP_CARD_MARGIN, viewportWidth - width - STEP_CARD_MARGIN)
    );
    const fitWidth = (availableWidth: number) => Math.min(idealWidth, Math.max(STEP_CARD_MIN_WIDTH, availableWidth));
    const toLayerStyle = (style: { top: number; left: number; width: number }): CSSProperties => ({
      top: style.top / zoom,
      left: style.left / zoom,
      width: style.width / zoom
    });

    const centeredLeft = targetRect.left + targetRect.width / 2 - idealWidth / 2;
    const belowTop = targetRect.top + targetRect.height + STEP_CARD_GAP;
    if (belowTop + STEP_CARD_ESTIMATED_HEIGHT <= viewportHeight - STEP_CARD_MARGIN) {
      return toLayerStyle({
        top: belowTop,
        left: clampLeft(centeredLeft, idealWidth),
        width: idealWidth
      });
    }

    const rightSpace = viewportWidth - (targetRect.left + targetRect.width) - STEP_CARD_GAP - STEP_CARD_MARGIN;
    if (rightSpace >= STEP_CARD_MIN_WIDTH) {
      const width = fitWidth(rightSpace);
      return toLayerStyle({
        top: clampTop(targetRect.top),
        left: clampLeft(targetRect.left + targetRect.width + STEP_CARD_GAP, width),
        width
      });
    }

    const leftSpace = targetRect.left - STEP_CARD_GAP - STEP_CARD_MARGIN;
    if (leftSpace >= STEP_CARD_MIN_WIDTH) {
      const width = fitWidth(leftSpace);
      return toLayerStyle({
        top: clampTop(targetRect.top),
        left: clampLeft(targetRect.left - width - STEP_CARD_GAP, width),
        width
      });
    }

    const aboveTop = targetRect.top - STEP_CARD_ESTIMATED_HEIGHT - STEP_CARD_GAP;
    if (aboveTop >= STEP_CARD_MARGIN) {
      return toLayerStyle({
        top: aboveTop,
        left: clampLeft(centeredLeft, idealWidth),
        width: idealWidth
      });
    }

    return toLayerStyle({
      top: clampTop(belowTop),
      left: clampLeft(centeredLeft, idealWidth),
      width: idealWidth
    });
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
    ? (() => {
        const zoom = targetRect.zoom || 1;
        const top = clamp(targetRect.top - 6, 0, window.innerHeight);
        const left = clamp(targetRect.left - 6, 0, window.innerWidth);
        return {
          top: top / zoom,
          left: left / zoom,
          width: Math.min(targetRect.width + 12, window.innerWidth - left) / zoom,
          height: Math.min(targetRect.height + 12, window.innerHeight - top) / zoom
        };
      })()
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
        <span className="guide-step-count" aria-label={`ステップ ${stepIndex + 1} / ${activeTopic.steps.length}`}>
          <span className="guide-step-count-label" aria-hidden="true">STEP</span>
          <span className="guide-step-count-current" aria-hidden="true">{stepIndex + 1}</span>
          <span className="guide-step-count-slash" aria-hidden="true">/</span>
          <span className="guide-step-count-total" aria-hidden="true">{activeTopic.steps.length}</span>
        </span>
        <div className="guide-step-kicker">
          <span className="guide-assistant-icon"><HelpCircle size={16} /></span>
          {activeTopic.title}
        </div>
        <h2 id="guide-step-title" className="guide-step-title">{activeStep.title}</h2>
        <p className="guide-step-text">{stepBody}</p>
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
