# reservation-app

friends のセミパーソナル無料体験予約を受け付けるための、静的HTMLで動くシンプルな予約Webアプリです。

## できること

- トップページは friends の無料体験予約フォームだけを表示します。
- 名前、電話番号、メールアドレス、第1〜第3希望日時、連絡事項を入力できます。
- 第1希望、第2希望、第3希望はすべて必須で、同じ幅・同じ高さの縦並びです。
- 予約リクエスト完了画面を表示します。
- `/admin.html` の簡易管理画面で予約一覧を確認できます。
- Formspree URLを設定すると、予約確定時に管理者通知メールを送信し、Formspree側にも送信履歴を残せます。
- 黄色ベースで、初心者女性でも安心しやすい明るく清潔感のあるセミパーソナルジム風のデザインです。
- スマホ優先のシンプルな画面です。

## 注意点

- このアプリ自体にはログイン機能、決済機能、Google カレンダー連携、独自サーバー保存はありません。
- `/admin.html` の一覧は、同じブラウザの `localStorage` に保存された予約を表示します。別の端末や別のブラウザとは共有されません。
- 複数端末で管理したい場合は、Formspree の Submissions 画面、または別途データベース付きの管理機能を利用してください。

## ファイル構成

```txt
reservation-app/
├── index.html                         # 予約フォームを表示するHTML
├── admin.html                         # 簡易管理画面を表示するHTML
├── package.json                       # 起動・ビルド用の設定
├── README.md                          # 起動方法、Formspree設定、公開方法
├── scripts/
│   └── build.js                       # dist/ へ静的ファイルをコピーするビルド処理
└── src/
    ├── assets/
    │   ├── hero-japanese-woman.svg    # ファーストビュー画像
    │   └── hero-japanese-woman.webp   # 予備のファーストビュー画像
    ├── main.js                        # 予約フォーム、管理者通知、管理画面の処理
    └── styles.css                     # スマホ優先のデザイン
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
5. 管理画面は `http://localhost:5173/admin.html` で開けます。

## 使い方

### お客様向け

1. 予約フォームを開きます。
2. 名前、電話番号、メールアドレスを入力します。
3. 第1希望、第2希望、第3希望の日時をすべて選び、必要に応じて連絡事項を入力します。
4. 「予約を確定する」を押します。
5. 「予約リクエストを受け付けました。」の完了画面が表示されます。

### 管理者向け

1. `/admin.html` を開きます。
2. 「予約ストック」で、送信日時、名前、メールアドレス、電話番号、第1希望日時を一覧確認できます。
3. 各予約カードで、第1〜第3希望日時と連絡事項まで確認できます。
4. 表示確認をしたい場合は「ダミーデータを追加」を押してください。管理画面に動作確認用の予約が保存されます。

## Formspree URLの設定方法

予約内容メールを管理者に届けるには、Formspree のフォームURLを `src/main.js` に設定します。

### 1. FormspreeでフォームURLを作る

1. Formspree にログインします。
2. 新しいフォームを作成します。
3. 管理者が受け取りたいメールアドレスを Formspree 側で確認・認証します。
4. フォームのエンドポイントURLをコピーします。例: `https://formspree.io/f/xxxxxxxx`

### 2. `src/main.js` にURLを貼り付ける

`src/main.js` の上部にある次の行を探します。

```js
const FORM_ENDPOINT = '';
const OWNER_NOTIFICATION_EMAIL = '';
```

次のように変更してください。

```js
const FORM_ENDPOINT = 'https://formspree.io/f/xxxxxxxx';
const OWNER_NOTIFICATION_EMAIL = 'admin@example.com';
```

- `FORM_ENDPOINT` には、Formspree でコピーしたURLを入れます。
- `OWNER_NOTIFICATION_EMAIL` には、管理者通知を受け取りたいメールアドレスを入れます。
- Formspree は、フォームに紐づく認証済みメールアドレスへ通知します。通知先の追加・変更は Formspree の管理画面でも確認してください。

### 3. 管理者通知メールに入る内容

Formspreeへ送信される内容には、次の項目が含まれます。

- 送信日時
- お名前
- 電話番号
- メールアドレス
- 第1希望日時
- 第2希望日時
- 第3希望日時
- 連絡事項

### 4. 送信に失敗した場合

Formspree URLが未設定の場合は、画面は壊れず `/admin.html` のブラウザ内一覧に保存されます。
Formspree URLが間違っていて送信に失敗した場合も、予約内容は同じブラウザの管理画面に保存され、未送信件数が表示されます。

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

> 注意: 一般公開して複数スタッフで管理する場合は、Formspreeの通知・保存機能に加えて、認証とデータベースの追加をおすすめします。
