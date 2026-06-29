import { useEffect, useMemo, useState } from 'react';
import { BookOpen, CheckCircle2, Edit3, MousePointer2, Save, Search, X } from 'lucide-react';
import {
  readManualDocument,
  saveManualDocument,
  type ManualDocument,
  type ManualSection
} from '../utils/manualStore';
import type { GuideView } from './guideTourData';

const MANUAL_TARGET_FLASH_MS = 3200;
const MANUAL_TARGET_RETRY_LIMIT = 12;
const MANUAL_TARGET_RETRY_DELAY_MS = 120;

const LEGACY_DEFAULT_MANUAL_DOCUMENT: ManualDocument = {
  schemaVersion: 2,
  title: '教室配当マニュアル',
  lead: '項目を選ぶと、画面を操作しながら必要な手順を確認できます。',
  sections: [
    {
      id: 'overview',
      title: '画面の見方',
      summary: '未配当の科目、曜日ごとの教室、表示の意味を確認します。',
      when: '最初に画面全体を把握したいとき',
      controls: ['未配当一覧', '曜日タブ', '時間割表', '絞り込み', '凡例'],
      steps: [
        '左側の未配当一覧で、まだ教室が決まっていない科目を確認します。',
        '上部の曜日タブで、確認したい曜日に切り替えます。',
        '時間割表で、教室ごとの空き枠と配当済みの科目を確認します。',
        '建物、教室タイプ、機材で絞り込み、候補教室を探しやすくします。',
        '凡例で、重複、連続講時、条件不一致などの表示の意味を確認します。'
      ],
      notes: [
        '色や警告表示は、配当内容を確認するための目印です。',
        '表示が気になる場合は、まず凡例で意味を確認してから配当を直します。'
      ],
      keywords: ['未配当', '時間割', '曜日', '凡例', '表示']
    },
    {
      id: 'subjects',
      title: '科目の追加・削除',
      summary: '科目データを登録、更新、削除し、必要な列を確認します。',
      when: '科目を追加したい、CSVで更新したい、一覧を見直したいとき',
      controls: ['科目管理', '新規追加', 'CSVインポート', '列設定', 'CSVエクスポート'],
      steps: [
        '科目管理を開き、登録済み科目の一覧を確認します。',
        '1件だけ追加する場合は、新規追加から入力します。',
        'まとめて追加・更新する場合は、CSVインポートを使います。',
        '一覧で不要な列が多い場合は、列設定で表示する列を絞ります。',
        '確認用やバックアップが必要な場合は、CSVエクスポートで書き出します。'
      ],
      notes: [
        'CSV更新では、同じ科目コードのデータが更新対象になります。',
        '科目を削除すると、その科目に関係する配当も確認が必要です。'
      ],
      keywords: ['科目', '授業', 'CSV', '追加', '削除', '列設定']
    },
    {
      id: 'classrooms',
      title: '教室マスタの設定',
      summary: '教室名、定員、機材、自動配当の対象外を確認します。',
      when: '教室、定員、機材を追加・更新したいとき',
      controls: ['教室管理', '新規教室', 'CSVインポート', '列設定', '対象外設定', 'CSVエクスポート'],
      steps: [
        '教室管理を開き、登録済み教室の一覧を確認します。',
        '1室だけ追加する場合は、新規教室から入力します。',
        'まとめて更新する場合は、CSVインポートを使います。',
        '定員や機材が正しく入っているか一覧で確認します。',
        '自動配当に使わない教室は、対象外として扱います。'
      ],
      notes: [
        '定員や機材が不足していると、自動配当結果に制約違反が出やすくなります。',
        '対象外の教室は、自動配当では原則として候補に入りません。'
      ],
      keywords: ['教室', 'マスタ', '定員', '機材', '対象外']
    },
    {
      id: 'auto-allocation',
      title: '科目の教室自動配当',
      summary: '条件を確認し、未配当の科目へ教室をまとめて入れます。',
      when: '多数の未配当科目に教室をまとめて入れたいとき',
      controls: ['書込', '配当ルール設定', '未配当のみ', 'すべて再配当', '教室自動配当'],
      steps: [
        '手動変更がある場合は、先にクラウドへ書込します。',
        '配当ルール設定を開き、対象の期間、曜日、講時を確認します。',
        '通常は未配当のみを選び、まだ教室がない科目だけを対象にします。',
        '現在の配当も含めてやり直す場合だけ、すべて再配当を選びます。',
        '条件を確認してから教室自動配当を実行し、結果画面を確認します。'
      ],
      notes: [
        'ローカルとクラウドが不一致のまま自動配当しようとすると、確認画面で止まります。',
        'すべて再配当は現在の配当も動くため、通常は未配当のみを使います。'
      ],
      keywords: ['自動配当', '配当ルール', '未配当のみ', 'すべて再配当']
    },
    {
      id: 'manual-adjust',
      title: '手動教室調整',
      summary: '一部の科目だけ、空いている教室へ手動で移します。',
      when: '自動配当後に一部だけ直したいとき',
      controls: ['未配当一覧', '曜日タブ', '絞り込み', '時間割表', '書込'],
      steps: [
        '未配当一覧または時間割表で、調整したい科目を確認します。',
        '曜日タブで、科目の曜日に合わせます。',
        '建物、教室タイプ、機材で候補教室を絞ります。',
        '科目を空いている枠へ移動します。',
        '重複や条件不一致が出ていないか確認し、必要なら書込します。'
      ],
      notes: [
        '手動調整後に書込せず自動配当すると、ローカルとクラウドの不一致確認で止まります。',
        '手動変更を残したい場合は、次の大きな操作前に書込します。'
      ],
      keywords: ['手動', '調整', 'ドラッグ', '移動', '空き教室']
    },
    {
      id: 'cloud',
      title: 'クラウドへの書込と取得',
      summary: '今の作業内容を保存したり、クラウドの最新データを読み込みます。',
      when: '作業を保存、共有、復元したいとき',
      controls: ['書込', '取得', 'ログアウト'],
      steps: [
        '書込は、現在のローカル内容をクラウドへ保存します。',
        '取得は、クラウドに保存されている最新内容をローカルへ読み込みます。',
        '取得前にローカル変更がある場合は、上書きされる内容を確認します。',
        '別のキャンパスで作業する場合は、ログアウトして選び直します。'
      ],
      notes: [
        '取得に失敗しても、ローカルの内容は変更しません。',
        '迷った場合は、先にCSVエクスポートや書込で退避してから取得します。'
      ],
      keywords: ['クラウド', '書込', '取得', '保存', '復元']
    },
    {
      id: 'reset',
      title: '教室再配当、配当クリア',
      summary: '配当を消す、または条件を見直して再配当します。',
      when: '配当結果をやり直したいとき',
      controls: ['凡例', '配当クリア', '配当ルール設定', 'すべて再配当'],
      steps: [
        'まず凡例を見て、重複、制約違反、条件不一致の意味を確認します。',
        '配当だけを消したい場合は、配当クリアを使います。',
        '条件を変えてやり直す場合は、配当ルール設定を開きます。',
        '現在の配当も含めてやり直す場合だけ、すべて再配当を使います。'
      ],
      notes: [
        '配当クリアは科目や教室マスタを削除しません。',
        '再配当前に必要な変更がクラウドへ書込済みか確認します。'
      ],
      keywords: ['再配当', '配当クリア', 'やり直し', '重複', '制約違反']
    },
    {
      id: 'trouble',
      title: '困ったとき',
      summary: '表示、配当、クラウド取得で迷ったときの確認順です。',
      when: '何を直せばよいか判断しづらいとき',
      controls: ['ガイド', '凡例', '取得', '書込', 'CSVエクスポート'],
      steps: [
        '画面の意味が分からない場合は、ガイドまたは凡例を確認します。',
        '配当結果が想定と違う場合は、条件、機材、定員、対象外教室を確認します。',
        'クラウド取得に失敗した場合は、通信状態とログイン状態を確認して再実行します。',
        '大きく直す前に、必要に応じてCSVエクスポートで現在の内容を残します。'
      ],
      notes: [
        '原因が分からない場合は、どの操作の直後に起きたかを確認します。',
        '書込前の変更は、取得や再配当で影響を受ける場合があります。'
      ],
      keywords: ['困った', 'エラー', '失敗', '確認', '戻す']
    }
  ]
};

const DEFAULT_MANUAL_DOCUMENT: ManualDocument = {
  schemaVersion: 2,
  title: '教室配当マニュアル',
  lead: '項目を選ぶと、画面を操作しながら必要な手順を確認できます。',
  sections: [
    {
      id: 'overview',
      title: '画面の見方',
      summary: '未配当、曜日、時間割、警告表示の見方を確認します。',
      when: '最初に画面全体を把握したいとき',
      controls: ['未配当一覧', '曜日タブ', '時間割表', '絞り込み', '凡例'],
      steps: [
        '左側の未配当一覧で、まだ教室が決まっていない科目を確認します。',
        '上部の曜日タブで、確認したい曜日へ切り替えます。',
        '中央の時間割表で、教室ごとの空き枠と配当済み科目を見ます。',
        '建物、教室タイプ、機材で絞り込み、候補教室を探しやすくします。',
        '凡例で、重複、条件不一致、注意表示の意味を確認します。'
      ],
      notes: [
        '色や警告は、配当内容を確認するための目印です。',
        '表示の意味が分からない場合は、先に凡例を確認します。'
      ],
      keywords: ['画面', '未配当', '時間割', '曜日', '凡例']
    },
    {
      id: 'unassigned-check',
      title: '未配当科目を確認する',
      summary: '教室が未決定の科目を見つけ、配当や調整の対象を確認します。',
      when: 'どの科目から作業すればよいか確認したいとき',
      controls: ['未配当一覧', '曜日タブ', '絞り込み', '時間割表'],
      steps: [
        '未配当一覧で、教室が入っていない科目を確認します。',
        '科目名、曜日、講時、人数、必要機材を見て、優先して処理する科目を決めます。',
        '曜日タブで対象の曜日へ移動します。',
        '絞り込みを使い、条件に合いそうな教室だけを表示します。',
        '時間割表で、その科目を入れられる空き枠を確認します。'
      ],
      notes: [
        '未配当が残っている場合でも、条件に合う教室がない可能性があります。',
        '人数や機材の条件が厳しい科目から確認すると、後戻りが少なくなります。'
      ],
      keywords: ['未配当', '科目', '人数', '機材', '空き教室']
    },
    {
      id: 'subject-single',
      title: '科目を1件追加・編集する',
      summary: '科目を個別に追加し、一覧で内容を確認します。',
      when: '少数の科目だけ追加、修正、削除したいとき',
      controls: ['科目管理', '新規追加', '科目一覧'],
      steps: [
        '科目管理を開きます。',
        '新しく登録する場合は、新規追加を押します。',
        '科目コード、科目名、曜日、講時、人数、必要機材などを入力します。',
        '登録後、科目一覧で内容が正しいか確認します。',
        '不要な科目や誤った内容は、科目一覧から編集または削除します。'
      ],
      notes: [
        '曜日、講時、人数、必要機材は配当結果に直接影響します。',
        '科目を削除すると、その科目の配当も確認が必要です。'
      ],
      keywords: ['科目', '新規追加', '編集', '削除', '科目一覧']
    },
    {
      id: 'subject-csv',
      title: '科目CSVインポート・エクスポート',
      summary: '科目データをCSVでまとめて追加、更新、書き出しします。',
      when: '科目をまとめて登録、更新、バックアップしたいとき',
      controls: ['科目管理', '科目CSVインポート', '科目CSVエクスポート'],
      steps: [
        '科目管理を開きます。',
        'CSVで取り込む前に、科目コードなど更新キーになる列を確認します。',
        '科目CSVインポートでCSVファイルを選びます。',
        '取り込み後、科目一覧で件数と主要項目を確認します。',
        'バックアップや確認用データが必要な場合は、科目CSVエクスポートで書き出します。'
      ],
      notes: [
        '同じ科目コードがある場合は、既存データの更新として扱われます。',
        '大量更新の前は、必要に応じてCSVエクスポートで現在の内容を残します。'
      ],
      keywords: ['科目', 'CSV', 'インポート', 'エクスポート', 'バックアップ']
    },
    {
      id: 'subject-columns',
      title: '科目一覧の列設定',
      summary: '科目一覧に表示する列を調整し、確認しやすくします。',
      when: '一覧に列が多く、必要な情報だけ見たいとき',
      controls: ['科目管理', '科目列設定', '科目一覧'],
      steps: [
        '科目管理を開きます。',
        '科目列設定を開きます。',
        '確認に必要な列を表示し、不要な列を非表示にします。',
        '科目一覧に戻り、見たい情報が見えているか確認します。',
        'CSV確認や手作業の前に、曜日、講時、人数、機材などを見える状態にします。'
      ],
      notes: [
        '列設定は見やすさを変える操作で、科目データ自体は削除しません。',
        '確認作業ごとに表示列を変えると、誤確認を減らせます。'
      ],
      keywords: ['科目', '列設定', '表示列', '一覧']
    },
    {
      id: 'classroom-single',
      title: '教室を1室追加・編集する',
      summary: '教室を個別に追加し、定員や機材を確認します。',
      when: '少数の教室だけ追加、修正、削除したいとき',
      controls: ['教室管理', '新規教室', '教室一覧'],
      steps: [
        '教室管理を開きます。',
        '新しく登録する場合は、新規教室を押します。',
        '教室名、建物、教室タイプ、定員、機材などを入力します。',
        '登録後、教室一覧で内容が正しいか確認します。',
        '不要な教室や誤った内容は、教室一覧から編集または削除します。'
      ],
      notes: [
        '定員や機材が誤っていると、自動配当の候補判定も誤ります。',
        '教室名の表記ゆれは、CSV更新や確認作業の混乱につながります。'
      ],
      keywords: ['教室', '新規教室', '定員', '機材', '教室一覧']
    },
    {
      id: 'classroom-csv',
      title: '教室CSVインポート・エクスポート',
      summary: '教室マスタをCSVでまとめて追加、更新、書き出しします。',
      when: '教室、定員、機材をまとめて更新したいとき',
      controls: ['教室管理', '教室CSVインポート', '教室CSVエクスポート'],
      steps: [
        '教室管理を開きます。',
        'CSVで取り込む前に、教室名など更新キーになる列を確認します。',
        '教室CSVインポートでCSVファイルを選びます。',
        '取り込み後、教室一覧で件数、定員、機材を確認します。',
        'バックアップや確認用データが必要な場合は、教室CSVエクスポートで書き出します。'
      ],
      notes: [
        '教室CSVは、自動配当の候補教室を決める重要なマスタです。',
        '大量更新の前は、必要に応じてCSVエクスポートで現在の内容を残します。'
      ],
      keywords: ['教室', 'CSV', 'インポート', 'エクスポート', 'マスタ']
    },
    {
      id: 'classroom-rules',
      title: '教室の対象外・条件確認',
      summary: '自動配当に使う教室、使わない教室、条件不足を確認します。',
      when: '特定の教室を自動配当に使いたくないとき、候補に出ない理由を確認したいとき',
      controls: ['教室管理', '教室列設定', '対象外設定', '教室一覧'],
      steps: [
        '教室管理を開きます。',
        '教室列設定で、定員、機材、対象外に関する列を表示します。',
        '教室一覧で、自動配当に使う教室と使わない教室を確認します。',
        '使わない教室は、対象外設定として扱われているか確認します。',
        '候補に出ない教室がある場合は、定員、機材、対象外設定を見直します。'
      ],
      notes: [
        '対象外の教室は、自動配当では原則として候補に入りません。',
        '候補不足が起きる場合は、対象外設定を厳しくしすぎていないか確認します。'
      ],
      keywords: ['対象外', '定員', '機材', '候補教室', '教室条件']
    },
    {
      id: 'save-before-allocation',
      title: '自動配当前の保存確認',
      summary: '手動変更やCSV更新をクラウドへ書き込んでから自動配当します。',
      when: '手動調整やCSV更新の後に、自動配当へ進みたいとき',
      controls: ['書込', '取得', '科目の教室自動配当'],
      steps: [
        '手動調整、科目更新、教室更新を行った後は、まず書込を確認します。',
        'クラウドの内容を使い直したい場合は、取得で最新データを読み込みます。',
        'ローカル変更を残すか、クラウドの内容へ戻すかを決めます。',
        '必要な書込または取得が終わってから、科目の教室自動配当に進みます。',
        '未保存の変更がある状態では、自動配当の前に警告内容を確認します。'
      ],
      notes: [
        '保存前に自動配当すると、手動変更とクラウド内容がずれて判断しにくくなります。',
        '迷った場合は、CSVエクスポートで現在の内容を残してから操作します。'
      ],
      keywords: ['書込', '取得', '未保存', '自動配当', 'ローカル', 'クラウド']
    },
    {
      id: 'auto-allocation',
      title: '科目の教室自動配当',
      summary: '対象や条件を選び、未配当の科目へ教室をまとめて入れます。',
      when: '複数の未配当科目に教室をまとめて入れたいとき',
      controls: ['配当ルール設定', '配当基本設定', '未配当のみ', 'すべて再配当', '希望条件の順序', '対象機材', '教室自動配当'],
      steps: [
        '配当ルール設定を開きます。',
        '配当基本設定で、対象にする期間、曜日、講時を確認します。',
        '通常は未配当のみを選び、教室が未決定の科目だけを対象にします。',
        '現在の配当も含めてやり直す場合だけ、すべて再配当を選びます。',
        '希望条件の順序と対象機材を確認し、教室自動配当を実行します。'
      ],
      notes: [
        'すべて再配当は、今入っている教室も動くため、使う前に目的を確認します。',
        '実行後は、結果画面と凡例で重複や条件不一致がないか確認します。'
      ],
      keywords: ['自動配当', '配当ルール', '未配当のみ', 'すべて再配当', '機材']
    },
    {
      id: 'manual-adjust',
      title: '手動教室調整',
      summary: '一部の科目だけ、空いている教室へ手動で移します。',
      when: '自動配当後に一部だけ変更したいとき',
      controls: ['未配当一覧', '曜日タブ', '絞り込み', '時間割表', '書込'],
      steps: [
        '未配当一覧または時間割表で、調整したい科目を確認します。',
        '曜日タブで、科目の曜日に合わせます。',
        '絞り込みで、建物、教室タイプ、機材などの候補を絞ります。',
        '科目を空いている教室枠へ移動します。',
        '重複や条件不一致が出ていないか確認し、必要なら書込します。'
      ],
      notes: [
        '手動調整後に書込せず自動配当しようとすると、ローカルとクラウドの不一致確認で止まります。',
        '手動変更を残したい場合は、次の大きな操作の前に書込します。'
      ],
      keywords: ['手動', '調整', '移動', '空き教室', '書込']
    },
    {
      id: 'filter-classrooms',
      title: '候補教室を絞り込む',
      summary: '建物、教室タイプ、機材で候補教室を少なくします。',
      when: '空き教室が多く、目的の教室を探しにくいとき',
      controls: ['絞り込み', '時間割表', '凡例'],
      steps: [
        '絞り込みを開きます。',
        '建物を選び、表示する範囲を狭めます。',
        '教室タイプを選び、講義室やPC教室などの候補を絞ります。',
        '必要な機材を選び、条件に合う教室を探します。',
        '時間割表と凡例を確認し、使える空き枠か判断します。'
      ],
      notes: [
        '絞り込みは表示を狭める操作で、配当データ自体は変更しません。',
        '候補が少なすぎる場合は、絞り込み条件を外して確認します。'
      ],
      keywords: ['絞り込み', '建物', '教室タイプ', '機材', '候補']
    },
    {
      id: 'cloud',
      title: 'クラウドへの書込と取得',
      summary: '今の作業内容を保存し、必要に応じて最新データを読み込みます。',
      when: '作業を保存、共有、復元したいとき',
      controls: ['書込', '取得', 'ログアウト'],
      steps: [
        '書込は、現在のローカル内容をクラウドへ保存する操作です。',
        '取得は、クラウドに保存されている最新内容をローカルへ読み込む操作です。',
        '取得前にローカル変更がある場合は、上書きされる内容を確認します。',
        '別キャンパスで作業する場合は、ログアウトして選び直します。'
      ],
      notes: [
        '取得に失敗しても、ローカルの内容はその場で変更されません。',
        '大きく直す前は、CSVエクスポートや書込で退避してから操作します。'
      ],
      keywords: ['クラウド', '書込', '取得', '保存', '復元']
    },
    {
      id: 'reset',
      title: '教室再配当、配当クリア',
      summary: '配当を消す、または条件を見直して再配当します。',
      when: '配当結果をやり直したいとき',
      controls: ['凡例', '配当クリア', '配当ルール設定', 'すべて再配当'],
      steps: [
        'まず凡例で、現在の注意表示や重複の意味を確認します。',
        '配当だけを消したい場合は、配当クリアを使います。',
        '条件を変えてやり直す場合は、配当ルール設定を開きます。',
        '今の配当も含めて作り直す場合だけ、すべて再配当を選びます。',
        '再配当後は、未配当、重複、条件不一致を確認します。'
      ],
      notes: [
        '配当クリアは科目や教室マスタを削除する操作ではありません。',
        'すべて再配当は既存配当も動くため、必要なら先に書込またはCSVエクスポートを行います。'
      ],
      keywords: ['再配当', '配当クリア', 'やり直し', '重複', '条件不一致']
    },
    {
      id: 'trouble',
      title: '困ったとき',
      summary: '表示、配当、クラウド取得で迷ったときの確認順です。',
      when: '何を直せばよいか判断しづらいとき',
      controls: ['ガイド', '凡例', '取得', '書込', '科目CSVエクスポート', '教室CSVエクスポート'],
      steps: [
        '画面の意味が分からない場合は、ガイドまたは凡例を確認します。',
        '配当結果が想定と違う場合は、科目の人数、必要機材、教室の定員、対象外設定を確認します。',
        'クラウド取得に失敗した場合は、通信状態とログイン状態を確認して再実行します。',
        '大きく直す前に、必要に応じて書込またはCSVエクスポートで現在の内容を残します。',
        'どの操作の直後に問題が起きたかを確認し、直前の操作から見直します。'
      ],
      notes: [
        '原因が分からないまま再配当を繰り返すと、どの変更が効いたか分かりにくくなります。',
        '保存前の変更は、取得や再配当で影響を受ける場合があります。'
      ],
      keywords: ['困った', 'エラー', '失敗', '確認', '戻す']
    }
  ]
};

const isLegacyBundledManual = (manual: ManualDocument) => (
  manual.title === LEGACY_DEFAULT_MANUAL_DOCUMENT.title
  && manual.lead === LEGACY_DEFAULT_MANUAL_DOCUMENT.lead
  && manual.sections.length === LEGACY_DEFAULT_MANUAL_DOCUMENT.sections.length
  && manual.sections.every((section, index) => {
    const legacySection = LEGACY_DEFAULT_MANUAL_DOCUMENT.sections[index];
    return Boolean(legacySection)
      && section.id === legacySection.id
      && section.title === legacySection.title
      && section.summary === legacySection.summary;
  })
);

type ControlTarget = {
  selector: string;
  view?: GuideView;
};

const CONTROL_TARGET_BY_LABEL: Record<string, ControlTarget> = {
  ガイド: { selector: '[data-tour="guide-button"]' },
  未配当一覧: { selector: '[data-tour="unassigned-list"]' },
  曜日タブ: { selector: '[data-tour="day-tabs"]' },
  絞り込み: { selector: '[data-tour="filters"]' },
  凡例: { selector: '[data-tour="legend"]' },
  時間割表: { selector: '[data-tour="timetable-grid"]' },
  科目管理: { selector: '[data-tour="subject-manager"]' },
  新規追加: { selector: '[data-tour="subject-add"]', view: 'subjects' },
  科目一覧: { selector: '[data-tour="subject-table"]', view: 'subjects' },
  科目CSVインポート: { selector: '[data-tour="subject-import"]', view: 'subjects' },
  科目CSVエクスポート: { selector: '[data-tour="subject-export"]', view: 'subjects' },
  科目列設定: { selector: '[data-tour="subject-column-settings"]', view: 'subjects' },
  CSVインポート: { selector: '[data-tour="subject-import"]', view: 'subjects' },
  列設定: { selector: '[data-tour="subject-column-settings"]', view: 'subjects' },
  CSVエクスポート: { selector: '[data-tour="subject-export"]', view: 'subjects' },
  教室管理: { selector: '[data-tour="classroom-manager"]' },
  新規教室: { selector: '[data-tour="classroom-add"]', view: 'classrooms' },
  教室一覧: { selector: '[data-tour="classroom-table"]', view: 'classrooms' },
  教室CSVインポート: { selector: '[data-tour="classroom-import"]', view: 'classrooms' },
  教室CSVエクスポート: { selector: '[data-tour="classroom-export"]', view: 'classrooms' },
  教室列設定: { selector: '[data-tour="classroom-column-settings"]', view: 'classrooms' },
  対象外設定: { selector: '[data-tour="classroom-excluded-note"]', view: 'classrooms' },
  書込: { selector: '[data-tour="cloud-write"]' },
  取得: { selector: '[data-tour="cloud-read"]' },
  ログアウト: { selector: '[data-tour="logout"]' },
  科目の教室自動配当: { selector: '[data-tour="allocation-rules"]' },
  配当ルール設定: { selector: '[data-tour="allocation-rules"]' },
  配当基本設定: { selector: '[data-tour="allocation-basic-settings"]', view: 'rules' },
  未配当のみ: { selector: '[data-tour="allocation-mode"]', view: 'rules' },
  すべて再配当: { selector: '[data-tour="allocation-mode"]', view: 'rules' },
  希望条件の順序: { selector: '[data-tour="allocation-preference-rules"]', view: 'rules' },
  対象機材: { selector: '[data-tour="allocation-equipment-rules"]', view: 'rules' },
  教室自動配当: { selector: '[data-tour="allocation-run"]', view: 'rules' },
  配当クリア: { selector: '[data-tour="allocation-clear"]' }
};

const cloneManual = (manual: ManualDocument): ManualDocument => ({
  schemaVersion: manual.schemaVersion,
  title: manual.title,
  lead: manual.lead,
  sections: manual.sections.map(section => ({
    ...section,
    steps: [...section.steps],
    controls: [...section.controls],
    notes: [...section.notes],
    keywords: [...(section.keywords ?? [])]
  }))
});

const linesToList = (value: string) => value
  .split(/\r?\n/)
  .map(line => line.trim())
  .filter(Boolean);

const listToLines = (value: string[]) => value.join('\n');

const normalizeForSave = (manual: ManualDocument): ManualDocument => ({
  schemaVersion: 2,
  title: manual.title.trim() || DEFAULT_MANUAL_DOCUMENT.title,
  lead: manual.lead.trim(),
  sections: manual.sections.map(section => ({
    id: section.id,
    title: section.title.trim(),
    summary: section.summary.trim(),
    when: section.when.trim(),
    steps: section.steps.map(step => step.trim()).filter(Boolean),
    controls: section.controls.map(control => control.trim()).filter(Boolean),
    notes: section.notes.map(note => note.trim()).filter(Boolean),
    keywords: (section.keywords ?? []).map(keyword => keyword.trim()).filter(Boolean)
  })).filter(section => section.title)
});

const sectionMatchesQuery = (section: ManualSection, query: string) => {
  if (!query) return true;
  const haystack = [
    section.title,
    section.summary,
    section.when,
    ...section.steps,
    ...section.controls,
    ...section.notes,
    ...(section.keywords ?? [])
  ].join(' ').toLowerCase();
  return haystack.includes(query.toLowerCase());
};

type ManualPanelProps = {
  onClose?: () => void;
  onViewChange?: (view: GuideView) => void;
};

export const ManualPanel = ({ onClose, onViewChange }: ManualPanelProps) => {
  const [manual, setManual] = useState<ManualDocument>(() => cloneManual(DEFAULT_MANUAL_DOCUMENT));
  const [draft, setDraft] = useState<ManualDocument>(() => cloneManual(DEFAULT_MANUAL_DOCUMENT));
  const [activeSectionId, setActiveSectionId] = useState(DEFAULT_MANUAL_DOCUMENT.sections[0].id);
  const [query, setQuery] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    readManualDocument()
      .then(savedManual => {
        if (!isMounted || !savedManual?.sections.length) return;
        const nextManual = isLegacyBundledManual(savedManual)
          ? cloneManual(DEFAULT_MANUAL_DOCUMENT)
          : cloneManual(savedManual);
        setManual(nextManual);
        setDraft(cloneManual(nextManual));
        setActiveSectionId(nextManual.sections[0].id);
      })
      .catch(() => {
        if (!isMounted) return;
        setMessage('マニュアルを読み込めませんでした。初期内容を表示しています。');
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const visibleManual = isEditing ? draft : manual;
  const normalizedQuery = query.trim();
  const visibleSections = useMemo(
    () => visibleManual.sections.filter(section => sectionMatchesQuery(section, normalizedQuery)),
    [normalizedQuery, visibleManual.sections]
  );
  const activeSection = visibleSections.find(section => section.id === activeSectionId)
    ?? visibleSections[0]
    ?? visibleManual.sections[0];
  const activeDraftSection = draft.sections.find(section => section.id === activeSectionId)
    ?? draft.sections[0];

  const startEdit = () => {
    setDraft(cloneManual(manual));
    setMessage(null);
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setDraft(cloneManual(manual));
    setMessage(null);
    setIsEditing(false);
  };

  const updateDraftField = (field: 'title' | 'lead', value: string) => {
    setDraft(prev => ({ ...prev, [field]: value }));
  };

  const updateDraftSection = (sectionId: string, updater: (section: ManualSection) => ManualSection) => {
    setDraft(prev => ({
      ...prev,
      sections: prev.sections.map(section => section.id === sectionId ? updater(section) : section)
    }));
  };

  const updateDraftSectionField = (field: keyof Pick<ManualSection, 'title' | 'summary' | 'when'>, value: string) => {
    if (!activeDraftSection) return;
    updateDraftSection(activeDraftSection.id, section => ({ ...section, [field]: value }));
  };

  const updateDraftListField = (field: keyof Pick<ManualSection, 'steps' | 'controls' | 'notes' | 'keywords'>, value: string) => {
    if (!activeDraftSection) return;
    updateDraftSection(activeDraftSection.id, section => ({ ...section, [field]: linesToList(value) }));
  };

  const handleSave = async () => {
    const nextManual = normalizeForSave(draft);
    if (nextManual.sections.length === 0) {
      setMessage('マニュアル項目を1件以上入力してください。');
      return;
    }
    setIsSaving(true);
    setMessage(null);
    try {
      await saveManualDocument(nextManual);
      setManual(cloneManual(nextManual));
      setDraft(cloneManual(nextManual));
      setIsEditing(false);
      setMessage('保存しました。');
    } catch {
      setMessage('保存できませんでした。ログイン状態と通信状態を確認してください。');
    } finally {
      setIsSaving(false);
    }
  };

  const flashTarget = (selector: string) => {
    const target = document.querySelector(selector);
    if (!(target instanceof HTMLElement) || target.getClientRects().length === 0) {
      return false;
    }
    target.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
    target.classList.add('manual-target-flash');
    window.setTimeout(() => target.classList.remove('manual-target-flash'), MANUAL_TARGET_FLASH_MS);
    return true;
  };

  const flashTargetWhenReady = (control: string, selector: string, attempt = 0) => {
    if (flashTarget(selector)) return;
    if (attempt >= MANUAL_TARGET_RETRY_LIMIT) {
      setMessage(`「${control}」の場所を表示できませんでした。画面の読み込み後にもう一度押してください。`);
      return;
    }
    window.setTimeout(
      () => flashTargetWhenReady(control, selector, attempt + 1),
      MANUAL_TARGET_RETRY_DELAY_MS
    );
  };

  const handleControlClick = (control: string) => {
    const targetInfo = CONTROL_TARGET_BY_LABEL[control];
    if (!targetInfo) return;
    setMessage(null);
    if (flashTarget(targetInfo.selector)) return;
    if (targetInfo.view && onViewChange) {
      onViewChange(targetInfo.view);
      flashTargetWhenReady(control, targetInfo.selector);
      return;
    }
    setMessage(`「${control}」は今の画面には表示されていません。必要な画面を開いてから確認してください。`);
  };

  return (
    <div className="guide-manual-panel">
      <div className="guide-manual-toolbar">
        <div>
          <h3>{manual.title}</h3>
          <p>{manual.lead}</p>
        </div>
        {isEditing ? (
          <div className="guide-manual-actions">
            <button type="button" className="guide-secondary-button" onClick={cancelEdit} disabled={isSaving}>
              <X size={16} /> キャンセル
            </button>
            <button type="button" className="guide-primary-button" onClick={handleSave} disabled={isSaving}>
              <Save size={16} /> {isSaving ? '保存中' : '保存'}
            </button>
          </div>
        ) : (
          <div className="guide-manual-actions">
            <button type="button" className="guide-secondary-button" onClick={startEdit}>
              <Edit3 size={16} /> 編集
            </button>
            {onClose && (
              <button type="button" className="guide-icon-button" onClick={onClose} aria-label="マニュアルを閉じる">
                <X size={18} />
              </button>
            )}
          </div>
        )}
      </div>

      {isLoading && <div className="guide-manual-message">読み込み中...</div>}
      {message && <div className="guide-manual-message">{message}</div>}

      {isEditing ? (
        <div className="guide-manual-edit">
          <label className="guide-manual-field">
            <span>マニュアル名</span>
            <input value={draft.title} onChange={event => updateDraftField('title', event.target.value)} />
          </label>
          <label className="guide-manual-field">
            <span>説明文</span>
            <textarea value={draft.lead} onChange={event => updateDraftField('lead', event.target.value)} rows={2} />
          </label>
          <div className="guide-manual-edit-layout">
            <div className="guide-manual-edit-list" aria-label="編集する項目">
              {draft.sections.map((section, index) => (
                <button
                  key={section.id}
                  type="button"
                  className={section.id === activeDraftSection?.id ? 'active' : ''}
                  onClick={() => setActiveSectionId(section.id)}
                >
                  <span>{index + 1}</span>
                  {section.title || '未入力'}
                </button>
              ))}
            </div>
            {activeDraftSection && (
              <div className="guide-manual-edit-form">
                <label className="guide-manual-field">
                  <span>項目名</span>
                  <input value={activeDraftSection.title} onChange={event => updateDraftSectionField('title', event.target.value)} />
                </label>
                <label className="guide-manual-field">
                  <span>概要</span>
                  <textarea value={activeDraftSection.summary} onChange={event => updateDraftSectionField('summary', event.target.value)} rows={2} />
                </label>
                <label className="guide-manual-field">
                  <span>使う場面</span>
                  <textarea value={activeDraftSection.when} onChange={event => updateDraftSectionField('when', event.target.value)} rows={2} />
                </label>
                <label className="guide-manual-field">
                  <span>操作手順</span>
                  <textarea value={listToLines(activeDraftSection.steps)} onChange={event => updateDraftListField('steps', event.target.value)} rows={7} />
                </label>
                <label className="guide-manual-field">
                  <span>関連ボタン</span>
                  <textarea value={listToLines(activeDraftSection.controls)} onChange={event => updateDraftListField('controls', event.target.value)} rows={3} />
                </label>
                <label className="guide-manual-field">
                  <span>注意点</span>
                  <textarea value={listToLines(activeDraftSection.notes)} onChange={event => updateDraftListField('notes', event.target.value)} rows={4} />
                </label>
                <label className="guide-manual-field">
                  <span>検索用語</span>
                  <textarea value={listToLines(activeDraftSection.keywords ?? [])} onChange={event => updateDraftListField('keywords', event.target.value)} rows={3} />
                </label>
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          <label className="guide-manual-search">
            <Search size={16} />
            <input
              type="search"
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="項目や操作を検索"
              aria-label="マニュアルを検索"
            />
          </label>
          <div className="guide-manual-content">
            <div className="guide-manual-section-list">
              {visibleSections.map((section, index) => (
                <button
                  key={section.id}
                  type="button"
                  className={section.id === activeSection?.id ? 'active' : ''}
                  onClick={() => setActiveSectionId(section.id)}
                  aria-current={section.id === activeSection?.id ? 'true' : undefined}
                >
                  <span className="guide-manual-section-number">{index + 1}</span>
                  <span>
                    <strong>{section.title}</strong>
                    <small>{section.summary}</small>
                  </span>
                </button>
              ))}
            </div>
            {activeSection ? (
              <article className="guide-manual-detail">
                <div className="guide-manual-detail-heading">
                  <BookOpen size={18} />
                  <div>
                    <h4>{activeSection.title}</h4>
                    <p>{activeSection.summary}</p>
                  </div>
                </div>
                {activeSection.when && (
                  <div className="guide-manual-callout">
                    <strong>こんな時</strong>
                    <span>{activeSection.when}</span>
                  </div>
                )}
                {activeSection.controls.length > 0 && (
                  <div className="guide-manual-control-block">
                    <strong>関連する場所</strong>
                    <div className="guide-manual-control-list" aria-label="関連する場所">
                      {activeSection.controls.map(control => {
                        const hasTarget = Boolean(CONTROL_TARGET_BY_LABEL[control]);
                        return hasTarget ? (
                          <button key={control} type="button" onClick={() => handleControlClick(control)}>
                            <MousePointer2 size={14} /> {control}
                          </button>
                        ) : (
                          <span key={control}>{control}</span>
                        );
                      })}
                    </div>
                  </div>
                )}
                <ol className="guide-manual-step-list">
                  {activeSection.steps.map(step => (
                    <li key={step}>
                      <CheckCircle2 size={16} />
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
                {activeSection.notes.length > 0 && (
                  <div className="guide-manual-notes">
                    <strong>注意点</strong>
                    <ul>
                      {activeSection.notes.map(note => <li key={note}>{note}</li>)}
                    </ul>
                  </div>
                )}
              </article>
            ) : (
              <div className="guide-manual-message">該当する項目がありません。</div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
