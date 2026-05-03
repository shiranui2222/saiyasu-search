# 最安サーチ

スーパーごとに商品の価格を比較できるWebアプリです。

## 機能
- 商品の登録（写真・バーコードスキャン対応）
- 店舗の登録・管理
- グラムあたりの単価で価格比較
- カテゴリ・商品名で検索

---

## 🚀 開発環境でのローカル起動方法

### 1. 必要なもの
- [Node.js](https://nodejs.org/) (v18以上) をインストール

### 2. 依存パッケージのインストール
```bash
npm install
```

### 3. 開発サーバー起動
```bash
npm run dev
```

ブラウザで `http://localhost:5173` を開くと動きます。

---

## 🌐 Vercelへのデプロイ方法（無料で公開）

### ステップ1：GitHubにコードをアップロード

1. [GitHub](https://github.com) でアカウントを作成（無料）
2. 「New repository」で新しいリポジトリを作成（名前例：`nedanmemo`）
3. このフォルダの中身を全部アップロード
   - GitHubのページで「uploading an existing file」をクリック
   - 全ファイルをドラッグ＆ドロップ
   - 「Commit changes」ボタンをクリック

### ステップ2：Vercelと連携

1. [Vercel](https://vercel.com) でアカウントを作成（GitHubアカウントでログイン可）
2. 「New Project」をクリック
3. GitHubのリポジトリ（nedanmemo）を選択
4. 設定はそのまま「Deploy」をクリック

### ステップ3：完成！

数分後に `https://nedanmemo-xxxx.vercel.app` のようなURLが発行されます。
このURLをスマホでブックマークすれば、いつでもどこでも使えます！

---

## 📁 ファイル構成

```
nedanmemo/
├── index.html          # エントリポイント
├── package.json        # 依存関係の定義
├── vite.config.js      # ビルド設定
├── tailwind.config.js  # スタイル設定
├── postcss.config.js   # CSS設定
└── src/
    ├── main.jsx        # Reactのエントリ
    ├── App.jsx         # メインコンポーネント
    └── index.css       # グローバルスタイル
```
