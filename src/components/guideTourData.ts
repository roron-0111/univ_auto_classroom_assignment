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
    when: 'まず全体の見方を知りたい',
    can: '未配当、時間割、絞り込み、凡例を確認',
    icon: LayoutDashboard,
    tone: 'overview',
    steps: [
      {
        view: 'main',
        target: '[data-tour="guide-button"]',
        title: 'ガイド',
        body: '操作に迷ったときに開きます。項目を選ぶと、必要な場所まで画面を切り替えながら案内します。'
      },
      {
        view: 'main',
        target: '[data-tour="unassigned-list"]',
        title: '未配当の科目',
        body: '左側は、まだ教室が入っていない科目の一覧です。人数、候補室数、必要機材を見て、先に対応する科目を判断します。'
      },
      {
        view: 'main',
        target: '[data-tour="timetable-grid"]',
        title: '教室の空き状況',
        body: '中央の時間割表で、教室ごとの空き枠と配当済み科目を確認します。ここを見て、移動先や配当結果の状態を判断します。'
      },
      {
        view: 'main',
        target: '[data-tour="day-tabs"]',
        title: '曜日を変える',
        body: '表示する曜日を切り替えます。科目の曜日と違うタブを見ていると、空き状況を誤って判断します。'
      },
      {
        view: 'main',
        target: '[data-tour="filters"]',
        title: '教室を探しやすくする',
        body: '建物、教室タイプ、機材で表示する教室を絞ります。配当データは変わらず、候補を探しやすくするための表示操作です。'
      },
      {
        view: 'main',
        target: '[data-tour="legend"]',
        title: '表示の意味を見る',
        body: '色や警告の意味を確認します。重複、連続講時、条件不一致が出たら、先にここで意味を確認します。'
      }
    ]
  },
  {
    id: 'subjects',
    title: '科目の追加・削除',
    when: '科目データを登録・修正したい',
    can: '追加、CSV入出力、一覧確認、列設定',
    icon: Upload,
    tone: 'subjects',
    steps: [
      {
        view: 'main',
        target: '[data-tour="subject-manager"]',
        title: '科目管理を開く',
        body: '科目データを追加、修正、削除するときに開きます。ここで直した内容が、自動配当で使う科目の元データになります。',
        nextLabel: '次へ（開く）'
      },
      {
        view: 'subjects',
        target: '[data-tour="subject-manager-header"]',
        title: '登録済み科目を確認する',
        body: '登録済みの科目データを確認します。曜日、講時、人数、必要機材が正しくないと、配当結果もずれます。'
      },
      {
        view: 'subjects',
        target: '[data-tour="subject-add"]',
        title: '新規追加',
        body: '科目を1件だけ追加するときに使います。少数の修正ならCSVよりここで入れる方が確認しやすいです。'
      },
      {
        view: 'subjects',
        target: '[data-tour="subject-import"]',
        title: 'CSVインポート',
        body: '科目CSVをまとめて取り込みます。既存科目の更新にも使うため、取込前に現在の内容を確認しておきます。'
      },
      {
        view: 'subjects',
        target: '[data-tour="subject-table"]',
        title: '一覧で編集・削除する',
        body: '科目が正しく入っているか一覧で確認します。各行から編集や削除ができますが、削除した科目の配当も確認が必要です。'
      },
      {
        view: 'subjects',
        target: '[data-tour="subject-column-settings"]',
        title: '列設定',
        body: '一覧に表示する列を選びます。科目データ自体は変わらず、確認しやすくするための表示操作です。'
      },
      {
        view: 'subjects',
        target: '[data-tour="subject-taxonomy"]',
        title: '開講学部・管轄を整える',
        body: '科目の分類に使う学部や管轄を整えます。検索や一覧整理で使う情報なので、表記ゆれを減らします。'
      },
      {
        view: 'subjects',
        target: '[data-tour="subject-export"]',
        title: 'CSVエクスポート',
        body: '現在の科目データをCSVで書き出します。大きく直す前の退避や、取込後の確認に使います。'
      }
    ]
  },
  {
    id: 'classrooms',
    title: '教室マスタの設定',
    when: '教室・定員・機材を整えたい',
    can: '教室追加、CSV入出力、候補条件を確認',
    icon: Building2,
    tone: 'classrooms',
    steps: [
      {
        view: 'main',
        target: '[data-tour="classroom-manager"]',
        title: '教室管理を開く',
        body: '教室、定員、機材を登録・修正するときに開きます。ここで直した内容が、自動配当の候補教室になります。',
        nextLabel: '次へ（開く）'
      },
      {
        view: 'classrooms',
        target: '[data-tour="classroom-manager-header"]',
        title: '登録済み教室を確認する',
        body: '登録済みの教室、定員、機材を確認します。教室マスタが誤っていると、候補教室の判定も誤ります。'
      },
      {
        view: 'classrooms',
        target: '[data-tour="classroom-add"]',
        title: '新規教室',
        body: '教室を1室だけ追加するときに使います。定員、建物、教室タイプ、機材を確認して登録します。'
      },
      {
        view: 'classrooms',
        target: '[data-tour="classroom-import"]',
        title: 'CSVインポート',
        body: '教室CSVをまとめて取り込みます。定員や機材の更新にも使うため、取込後は一覧で主要項目を確認します。'
      },
      {
        view: 'classrooms',
        target: '[data-tour="classroom-table"]',
        title: '一覧で編集・削除する',
        body: '教室ごとの定員、機材、建物などを確認します。各行から編集や削除ができますが、候補教室に影響します。'
      },
      {
        view: 'classrooms',
        target: '[data-tour="classroom-column-settings"]',
        title: '列設定',
        body: '一覧に表示する列を選びます。教室データ自体は変わらず、確認しやすくするための表示操作です。'
      },
      {
        view: 'classrooms',
        target: '[data-tour="classroom-excluded-note"]',
        title: '使わない教室を外す',
        body: '自動配当に使わない教室を確認します。対象外の教室は、原則として候補教室に入りません。'
      },
      {
        view: 'classrooms',
        target: '[data-tour="classroom-export"]',
        title: 'CSVエクスポート',
        body: '現在の教室データをCSVで書き出します。大きく直す前の退避や、取込後の確認に使います。'
      }
    ]
  },
  {
    id: 'auto-allocation',
    title: '科目の教室自動配当',
    when: '複数の科目へまとめて教室を入れたい',
    can: '対象範囲、配当方法、優先条件を設定',
    icon: WandSparkles,
    tone: 'auto',
    steps: [
      {
        view: 'main',
        target: '[data-tour="cloud-write"]',
        title: '未保存の変更を確認する',
        body: '手動調整やCSV取込の後は、先に書込するか、取得で戻すかを決めます。ローカルとクラウドが違う状態では、自動配当前に確認で止まります。'
      },
      {
        view: 'main',
        target: '[data-tour="allocation-rules"]',
        title: '配当ルール設定を開く',
        body: '自動配当の条件を確認する画面を開きます。ここでは、どの科目を、どの条件で配当するかを決めます。',
        nextLabel: '次へ（開く）'
      },
      {
        view: 'rules',
        target: '[data-tour="allocation-settings-header"]',
        title: '自動配当の準備',
        body: '自動配当の設定画面です。実行前に、対象範囲、配当方法、優先条件を上から順に確認します。'
      },
      {
        view: 'rules',
        target: '[data-tour="allocation-basic-settings"]',
        title: '対象を選ぶ',
        body: '配当する期間、曜日、講時を選びます。必要な範囲だけに絞ると、意図しない科目を動かしにくくなります。'
      },
      {
        view: 'rules',
        target: '[data-tour="allocation-mode"]',
        title: '配当方法を選ぶ',
        body: '通常は未配当のみを使います。すべて再配当は、今入っている教室も動かすため、やり直しが必要なときだけ使います。'
      },
      {
        view: 'rules',
        target: '[data-tour="allocation-preference-rules"]',
        title: '優先したい条件',
        body: '建物や教室タイプなど、できるだけ守りたい条件を並べます。絶対条件ではなく、候補を選ぶときの優先順位として使います。'
      },
      {
        view: 'rules',
        target: '[data-tour="allocation-equipment-rules"]',
        title: '必要な機材',
        body: '機材が必要な科目に、対応した教室を当てやすくします。教室マスタ側の機材登録が正しいことが前提です。'
      },
      {
        view: 'rules',
        target: '[data-tour="allocation-run"]',
        title: '自動配当を実行',
        body: '押すと条件に沿って教室配当を実行します。実行後は、未配当、重複、条件不一致が残っていないか確認します。'
      }
    ]
  },
  {
    id: 'manual-adjust',
    title: '手動教室調整',
    when: '一部の科目だけ手で直したい',
    can: '科目を選び、空き枠へ移動して保存',
    icon: MoveRight,
    tone: 'manual',
    steps: [
      {
        view: 'main',
        target: '[data-tour="unassigned-list"]',
        title: '調整する科目を探す',
        body: '未配当一覧から、教室を入れたい科目を探します。人数、候補室数、必要機材を見て、動かす前に条件を確認します。'
      },
      {
        view: 'main',
        target: '[data-tour="day-tabs"]',
        title: '曜日を合わせる',
        body: '科目の曜日に合わせて、時間割表の曜日を切り替えます。曜日が違うと、空き枠を誤って選ぶ原因になります。'
      },
      {
        view: 'main',
        target: '[data-tour="filters"]',
        title: '候補教室を絞る',
        body: '建物、教室タイプ、機材で表示する教室を絞ります。配当データは変わらず、空き教室を探しやすくするための表示操作です。'
      },
      {
        view: 'main',
        target: '[data-tour="timetable-grid"]',
        title: '空き枠へ移動する',
        body: '科目をドラッグして、時間割表の空いている教室へ移します。移動すると、その科目の教室配当がローカル上で変わります。'
      },
      {
        view: 'main',
        target: '[data-tour="legend"]',
        title: '表示を確認する',
        body: '重複や条件不一致の表示が出ていないか確認します。警告が出た場合は、保存前に意味を確認して直します。'
      },
      {
        view: 'main',
        target: '[data-tour="cloud-write"]',
        title: '変更を書込する',
        body: '手動で変えた配当を残す場合は、クラウドへ書込します。書込前に自動配当へ進むと、ローカルとクラウドの不一致確認で止まります。'
      }
    ]
  },
  {
    id: 'cloud',
    title: 'クラウドへの書込と取得',
    when: '保存と読込の向きを確認したい',
    can: 'ローカルから書込、クラウドから取得',
    icon: Cloud,
    tone: 'cloud',
    steps: [
      {
        view: 'main',
        target: '[data-tour="cloud-write"]',
        title: 'ローカルから書込',
        body: '今この画面にあるローカル内容を、クラウドへ保存します。手動調整、CSV取込、自動配当の後に、変更を残したいときに使います。',
        fallbackBody: 'ログイン後に使えます。先にキャンパスを選んでください。'
      },
      {
        view: 'main',
        target: '[data-tour="cloud-read"]',
        title: 'クラウドから取得',
        body: 'クラウドに保存されている内容を、この画面へ読み込みます。未書込のローカル変更がある場合は、上書きされる内容を確認してから進みます。',
        fallbackBody: 'ログイン後に使えます。先にキャンパスを選んでください。'
      },
      {
        view: 'main',
        target: '[data-tour="logout"]',
        title: 'ログアウト',
        body: '別のキャンパスを選び直すときに使います。未保存の変更がある場合は、先に書込するか判断します。',
        fallbackBody: 'ログイン後に使えます。'
      }
    ]
  },
  {
    id: 'trouble',
    title: '教室再配当、配当クリア',
    when: '配当を消す・やり直す必要がある',
    can: '状態確認、配当クリア、再配当',
    icon: AlertTriangle,
    tone: 'trouble',
    steps: [
      {
        view: 'main',
        target: '[data-tour="legend"]',
        title: '表示の意味を見る',
        body: 'まず重複、連続講時、条件不一致など、何が起きているか確認します。原因を見ずに再配当すると、同じ問題が残ることがあります。'
      },
      {
        view: 'main',
        target: '[data-tour="allocation-clear"]',
        title: '配当を消す',
        body: '教室配当だけを消します。科目データや教室マスタは削除されませんが、必要なら先に書込やCSV出力で退避します。'
      },
      {
        view: 'main',
        target: '[data-tour="allocation-rules"]',
        title: '配当ルール設定を開く',
        body: '条件を見直して再配当したいときに開きます。対象範囲や配当方法を確認してから実行します。',
        nextLabel: '次へ（開く）'
      },
      {
        view: 'rules',
        target: '[data-tour="allocation-mode"]',
        title: '再配当の範囲',
        body: 'すべて再配当は、現在入っている教室も動かします。既存配当を残したい場合は、未配当のみを選びます。'
      }
    ]
  }
];
