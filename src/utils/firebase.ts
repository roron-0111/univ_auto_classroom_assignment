import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// HINT: Replace these values with your project's config object
// You can find this in the Firebase Console: Project Settings > General > Your apps
const firebaseConfig = {
    // 開発用プロジェクトID: subject-rooms-dev-001
    // 自動デプロイ時にHostingから正しい設定が読み込まれるため、
    // ローカル開発でも `/__/firebase/init.json` を使うか、
    // 明示的に書く必要があります。
    // 今回は手動設定値を入れます（後でConsoleから取得して埋める必要がありますが、
    // Hosting上では自動構成が効く場合があります）
    apiKey: "AIzaSyCQIO7u13mZnNGAz8xe_Q00BVuIKExvvJw",
    authDomain: "subject-rooms-dev-001.firebaseapp.com",
    projectId: "subject-rooms-dev-001",
    storageBucket: "subject-rooms-dev-001.firebasestorage.app",
    messagingSenderId: "532782050265",
    appId: "1:532782050265:web:6aa74497c647b7ef2ac7c8"
};

// 本番環境（Hosting上）では自動設定を使うテクニックもありますが、
// Reactアプリとしては明示的なConfigが確実です。
// いったんプレースホルダーで作成し、後ほど正確な値を埋めます。

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
