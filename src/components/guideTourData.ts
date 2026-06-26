import type { LucideIcon } from 'lucide-react';
import { AlertTriangle, Building2, Cloud, LayoutDashboard, MoveRight, Upload, WandSparkles } from 'lucide-react';

export type GuideView = 'main' | 'subjects' | 'classrooms' | 'rules';

export type GuideStep = {
  view: GuideView;
  target: string;
  title: string;
  body: string;
  nextLabel?: string;
  fallbackBody?: string;
};

export type GuideTopic = {
  id: string;
  title: string;
  when: string;
  can: string;
  icon: LucideIcon;
  tone: 'overview' | 'subjects' | 'classrooms' | 'auto' | 'manual' | 'cloud' | 'trouble';
  steps: GuideStep[];
};

export const GUIDE_TOPICS: GuideTopic[] = [
  {
    id: 'overview',
    title: '画面の見方',
    when: '最初に操作画面を確認したい',
    can: '未配当、空き教室、凡例を見る',
    icon: LayoutDashboard,
    tone: 'overview',
    steps: [
      {
        view: 'main',
        target: '[data-tour="guide-button"]',
        title: 'ガイド',
        body: '知りたい項目だけ選んで確認できます。途中で項目選択に戻れます。'
      },
      {
        view: 'main',
        target: '[data-tour="unassigned-list"]',
        title: '未配当の科目',
        body: 'まだ教室が決まっていない科目です。ここから配当したい科目を探します。'
      },
      {
        view: 'main',
        target: '[data-tour="timetable-grid"]',
        title: '教室の空き状況',
        body: '教室ごとに、どの曜日・講時が空いているかを見ます。'
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
        body: '重複、連続講時、条件不一致などの表示の意味を確認します。'
      }
    ]
  },
  {
    id: 'subjects',
    title: '科目の追加・削除',
    when: '科目を登録・修正・削除したい',
    can: '新規追加、CSV入出力、列設定',
    icon: Upload,
    tone: 'subjects',
    steps: [
      {
        view: 'main',
        target: '[data-tour="subject-manager"]',
        title: '科目管理を開く',
        body: '科目を登録、修正、削除するときはここを押します。次へで画面を開きます。',
        nextLabel: '次へ（開く）'
      },
      {
        view: 'subjects',
        target: '[data-tour="subject-manager-header"]',
        title: '登録済み科目を確認する',
        body: 'いま登録されている科目データを確認します。追加、編集、削除もこの画面で行います。'
      },
      {
        view: 'subjects',
        target: '[data-tour="subject-add"]',
        title: '新規追加',
        body: 'CSVを使わず、科目を1件だけ追加するときに使います。'
      },
      {
        view: 'subjects',
        target: '[data-tour="subject-import"]',
        title: 'CSVインポート',
        body: '科目データをまとめて取り込みます。既存科目の更新にも使います。'
      },
      {
        view: 'subjects',
        target: '[data-tour="subject-table"]',
        title: '一覧で編集・削除する',
        body: '科目が正しく入っているか確認します。各行の操作から編集や削除ができます。'
      },
      {
        view: 'subjects',
        target: '[data-tour="subject-column-settings"]',
        title: '列設定',
        body: '一覧で見たい列を選びます。確認に不要な列を減らすと見やすくなります。'
      },
      {
        view: 'subjects',
        target: '[data-tour="subject-taxonomy"]',
        title: '開講学部・管轄を整える',
        body: '科目の分類に使う学部や管轄を見直します。検索や整理に使います。'
      },
      {
        view: 'subjects',
        target: '[data-tour="subject-export"]',
        title: 'CSVエクスポート',
        body: '現在の科目データをCSVで書き出します。バックアップや確認に使えます。'
      }
    ]
  },
  {
    id: 'classrooms',
    title: '教室マスタの設定',
    when: '教室・定員・機材を登録したい',
    can: '新規教室、CSV入出力、対象外設定',
    icon: Building2,
    tone: 'classrooms',
    steps: [
      {
        view: 'main',
        target: '[data-tour="classroom-manager"]',
        title: '教室管理を開く',
        body: '教室、定員、機材を登録・修正するときはここを押します。次へで画面を開きます。',
        nextLabel: '次へ（開く）'
      },
      {
        view: 'classrooms',
        target: '[data-tour="classroom-manager-header"]',
        title: '登録済み教室を確認する',
        body: 'いま登録されている教室、定員、機材を確認します。'
      },
      {
        view: 'classrooms',
        target: '[data-tour="classroom-add"]',
        title: '新規教室',
        body: 'CSVを使わず、教室を1室だけ追加するときに使います。'
      },
      {
        view: 'classrooms',
        target: '[data-tour="classroom-import"]',
        title: 'CSVインポート',
        body: '教室データをまとめて取り込みます。定員や機材の更新にも使います。'
      },
      {
        view: 'classrooms',
        target: '[data-tour="classroom-table"]',
        title: '一覧で編集・削除する',
        body: '教室ごとの定員や機材を確認します。各行の操作から編集や削除ができます。'
      },
      {
        view: 'classrooms',
        target: '[data-tour="classroom-column-settings"]',
        title: '列設定',
        body: '一覧で見たい列を選びます。確認に不要な列を減らすと見やすくなります。'
      },
      {
        view: 'classrooms',
        target: '[data-tour="classroom-excluded-note"]',
        title: '使わない教室を外す',
        body: '対象外にした教室は、自動配当では使われません。'
      },
      {
        view: 'classrooms',
        target: '[data-tour="classroom-export"]',
        title: 'CSVエクスポート',
        body: '現在の教室データをCSVで書き出します。バックアップや確認に使えます。'
      }
    ]
  },
  {
    id: 'auto-allocation',
    title: '科目の教室自動配当',
    when: '条件に沿ってまとめて配当したい',
    can: '対象範囲、配当方法、条件設定',
    icon: WandSparkles,
    tone: 'auto',
    steps: [
      {
        view: 'main',
        target: '[data-tour="cloud-write"]',
        title: '未保存の変更を確認する',
        body: '手動で配当を変えた後は、先に書込します。ローカルとクラウドが違うと自動配当は開始されません。'
      },
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
        body: 'どの科目を、どんな条件で配当するかを確認します。'
      },
      {
        view: 'rules',
        target: '[data-tour="allocation-basic-settings"]',
        title: '対象を選ぶ',
        body: '配当する期間、曜日、講時を選びます。必要な範囲だけに絞れます。'
      },
      {
        view: 'rules',
        target: '[data-tour="allocation-mode"]',
        title: '配当方法を選ぶ',
        body: '通常は未配当のみを使います。「すべて再配当」は現在の配当も動かします。'
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
        body: '機材が必要な科目に、対応した教室を当てやすくします。'
      },
      {
        view: 'rules',
        target: '[data-tour="allocation-run"]',
        title: '自動配当を実行',
        body: '押すと配当が始まります。未保存の変更がある場合は、確認画面で止まります。'
      }
    ]
  },
  {
    id: 'manual-adjust',
    title: '手動教室調整',
    when: '一部の配当だけ変更したい',
    can: '科目を選び、空き枠へ移動',
    icon: MoveRight,
    tone: 'manual',
    steps: [
      {
        view: 'main',
        target: '[data-tour="unassigned-list"]',
        title: '調整する科目を探す',
        body: '未配当一覧から、教室を入れたい科目を探します。科目名や条件を確認します。'
      },
      {
        view: 'main',
        target: '[data-tour="day-tabs"]',
        title: '曜日を合わせる',
        body: '科目の曜日に合わせて、時間割表の曜日を切り替えます。'
      },
      {
        view: 'main',
        target: '[data-tour="filters"]',
        title: '候補教室を絞る',
        body: '建物、教室タイプ、機材で絞ると、入れたい教室を探しやすくなります。'
      },
      {
        view: 'main',
        target: '[data-tour="timetable-grid"]',
        title: '空き枠へ移動する',
        body: '科目をドラッグして、時間割表の空いている教室へ移します。'
      },
      {
        view: 'main',
        target: '[data-tour="legend"]',
        title: '表示を確認する',
        body: '重複や条件不一致の表示が出ていないか確認します。'
      },
      {
        view: 'main',
        target: '[data-tour="cloud-write"]',
        title: '変更を書込する',
        body: '手動で変えた配当を残す場合は、クラウドへ書込します。書込前の自動配当は確認画面で止まります。'
      }
    ]
  },
  {
    id: 'cloud',
    title: 'クラウドへの書込と取得',
    when: '作業を保存・共有・復元したい',
    can: 'クラウドへ書込、最新データを取得',
    icon: Cloud,
    tone: 'cloud',
    steps: [
      {
        view: 'main',
        target: '[data-tour="cloud-write"]',
        title: 'ローカルから書込',
        body: '今の作業内容をクラウドに保存します。手動調整や自動配当の後に使います。',
        fallbackBody: 'ログイン後に使えます。先にキャンパスを選んでください。'
      },
      {
        view: 'main',
        target: '[data-tour="cloud-read"]',
        title: 'クラウドから取得',
        body: 'クラウドにある最新データを読み込みます。未書込のローカル変更は上書きされる場合があります。',
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
    can: '配当クリア、すべて再配当',
    icon: AlertTriangle,
    tone: 'trouble',
    steps: [
      {
        view: 'main',
        target: '[data-tour="legend"]',
        title: '表示の意味を見る',
        body: 'まず重複、連続講時、条件不一致など、何が起きているか確認します。'
      },
      {
        view: 'main',
        target: '[data-tour="allocation-clear"]',
        title: '配当を消す',
        body: '配当だけを消します。科目や教室データは残ります。やり直し前に使います。'
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
        title: '再配当の範囲',
        body: '「すべて再配当」は、現在の配当も動かします。必要なときだけ使います。'
      }
    ]
  }
];
