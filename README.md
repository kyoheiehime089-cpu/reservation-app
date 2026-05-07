# reservation-app

blossom yoga と friends の無料体験予約を受け付けるための、ローカルで動くシンプルな予約Webアプリです。

## できること

- お客様が予約可能日時を選んで予約できます。
- 名前、電話番号、メール、希望店舗、希望内容、連絡事項を入力できます。
- 予約完了画面を表示します。
- 管理画面で予約一覧を確認できます。
- 管理画面で予約枠を追加、削除できます。
- スマホ優先のシンプルな画面です。

## 最初の簡単版で対応していないこと

- ログイン機能
- 決済機能
- Google カレンダー連携
- サーバー保存

予約枠と予約内容は、ブラウザの `localStorage` に保存されます。別の端末や別のブラウザとは共有されません。

## ファイル構成

```txt
reservation-app/
├── index.html          # アプリを表示するHTML
├── package.json        # 起動・ビルド用の設定
├── README.md           # 起動方法と公開方法
└── src/
    ├── main.js         # 予約フォーム、完了画面、管理画面の処理
    └── styles.css      # スマホ優先のデザイン
```

## ローカルで起動する方法

1. Node.js をインストールします。
2. このリポジトリのフォルダで依存関係をインストールします。

```bash
npm install
```

3. 開発サーバーを起動します。

```bash
npm run dev
```

4. ターミナルに表示されたURLをブラウザで開きます。通常は `http://localhost:5173/` です。

## 使い方

### お客様向け

1. 「予約する」タブを開きます。
2. 予約可能日時を選びます。
3. 名前、電話番号、メール、希望店舗、希望内容を入力します。
4. 「予約を確定する」を押します。
5. 予約完了画面が表示されます。

### 管理者向け

1. 「管理画面」タブを開きます。
2. 「予約枠を追加」から日付、時間、店舗、定員を入力します。
3. 「予約枠一覧」で枠を確認できます。
4. 予約が入っていない枠は「削除」できます。
5. 「予約一覧」でお客様情報を確認できます。

## GitHubで公開する方法（GitHub Pages）

1. GitHubで `reservation-app` リポジトリを作成します。
2. ローカルの変更をGitHubへpushします。

```bash
git add .
git commit -m "Create simple reservation app"
git branch -M main
git remote add origin https://github.com/ユーザー名/reservation-app.git
git push -u origin main
```

3. GitHubのリポジトリ画面で **Settings** を開きます。
4. **Pages** を開きます。
5. **Build and deployment** の Source で **GitHub Actions** を選びます。
6. 必要に応じて、ビルド結果 `dist/` を公開するGitHub Actionsを追加します。

> 注意: このアプリはログインなし・ブラウザ保存の簡単版です。実際に一般公開して複数スタッフで管理する場合は、認証とデータベースの追加をおすすめします。
