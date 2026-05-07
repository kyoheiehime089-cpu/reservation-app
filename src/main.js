const BRAND_NAME = 'friends';
const SERVICE_TEXT = '&#12475;&#12511;&#12497;&#12540;&#12477;&#12490;&#12523;';
const PROGRAM_TEXT = '&#28961;&#26009;&#20307;&#39443;';
const START_DAYS_AHEAD = 5;
const LESSON_MINUTES = 40;

// Formspreeなどの外部フォームサービスの送信先。
// 例: const FORM_ENDPOINT = 'https://formspree.io/f/xxxxxxxx';
// 未設定のままでも画面は壊れず、ブラウザ内の管理ストックに保存します。
const FORM_ENDPOINT = '';
const OWNER_NOTIFICATION_EMAIL = '';
const ADMIN_HASH = 'admin';

const STORAGE_KEYS = {
  reservations: 'reservation-app-reservations',
  emailHistory: 'reservation-app-email-history',
};

const WEEKDAY_SCHEDULE = {
  0: ['10:00', '10:50', '11:40', '12:30'],
  1: ['18:30', '19:20', '20:10', '21:00'],
  2: ['18:30', '19:20', '20:10', '21:00'],
  3: ['18:30', '19:20', '20:10', '21:00'],
  4: [],
  5: ['18:30', '19:20', '20:10', '21:00'],
  6: ['10:00', '10:50', '11:40', '12:30'],
};

const HOLIDAY_SCHEDULE = ['10:00', '10:50', '11:40', '12:30'];

const JAPAN_HOLIDAYS = new Set([
  '2026-01-01',
  '2026-01-12',
  '2026-02-11',
  '2026-02-23',
  '2026-03-20',
  '2026-04-29',
  '2026-05-03',
  '2026-05-04',
  '2026-05-05',
  '2026-05-06',
  '2026-07-20',
  '2026-08-11',
  '2026-09-21',
  '2026-09-22',
  '2026-09-23',
  '2026-10-12',
  '2026-11-03',
  '2026-11-23',
]);

const state = {
  reservations: readStorage(STORAGE_KEYS.reservations, []),
  emailHistory: readStorage(STORAGE_KEYS.emailHistory, []),
  lastReservation: null,
};

function readStorage(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function decodeEntities(value) {
  const textarea = document.createElement('textarea');
  textarea.innerHTML = value;
  return textarea.value;
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDate(dateString) {
  return new Intl.DateTimeFormat('ja-JP', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }).format(new Date(`${dateString}T00:00:00`));
}

function formatCalendarDateTime(date, time, offsetMinutes = 0) {
  const value = new Date(`${date}T${time}:00`);
  value.setMinutes(value.getMinutes() + offsetMinutes);
  return value.toISOString().replaceAll('-', '').replaceAll(':', '').replace(/\.\d{3}Z$/, 'Z');
}

function formatChoice(choice) {
  if (!choice) return '';
  return `${formatDate(choice.date)} ${choice.time}`;
}

function formatSubmittedAt(value) {
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function buildScheduleSlots() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const start = new Date(today);
  start.setDate(start.getDate() + START_DAYS_AHEAD);

  const end = new Date(start);
  end.setDate(end.getDate() + 20);

  const slots = [];
  for (const cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    const date = toDateKey(cursor);
    const times = JAPAN_HOLIDAYS.has(date) ? HOLIDAY_SCHEDULE : WEEKDAY_SCHEDULE[cursor.getDay()];
    times.forEach((time) => {
      slots.push({
        id: `slot-${date}-${time.replace(':', '')}`,
        date,
        time,
      });
    });
  }
  return slots;
}

function groupedSlotOptions(selectedValue = '', selectedChoices = getSelectedChoiceValues()) {
  const grouped = buildScheduleSlots().reduce((groups, slot) => {
    const label = formatDate(slot.date);
    groups[label] = groups[label] || [];
    groups[label].push(slot);
    return groups;
  }, {});

  return Object.entries(grouped)
    .map(([label, slots]) => `
      <optgroup label="${escapeHtml(label)}">
        ${slots.map((slot) => `
          <option value="${slot.id}" ${slot.id === selectedValue ? 'selected' : ''} ${slot.id !== selectedValue && selectedChoices.has(slot.id) ? 'disabled' : ''}>
            ${slot.time}&#12316;
          </option>
        `).join('')}
      </optgroup>
    `).join('');
}

function getSelectedChoiceValues() {
  const form = document.getElementById('reservation-form');
  if (!form) return new Set();
  return new Set(['firstChoice', 'secondChoice', 'thirdChoice']
    .map((name) => form.elements[name]?.value)
    .filter(Boolean));
}

function findSlot(slotId) {
  return buildScheduleSlots().find((slot) => slot.id === slotId);
}

function saveEmail(email) {
  const trimmed = email.trim();
  if (!trimmed) return;
  state.emailHistory = [trimmed, ...state.emailHistory.filter((item) => item !== trimmed)].slice(0, 8);
  writeStorage(STORAGE_KEYS.emailHistory, state.emailHistory);
}

function saveReservationStock(reservation) {
  state.reservations = [reservation, ...state.reservations.filter((item) => item.id !== reservation.id)];
  writeStorage(STORAGE_KEYS.reservations, state.reservations);
}

function createCustomerEmail(reservation) {
  const lines = [
    '{{name}} &#27096;',
    '',
    '&#12371;&#12398;&#24230;&#12399;&#12289;friends&#12398;&#28961;&#26009;&#20307;&#39443;&#12434;&#12372;&#20104;&#32004;&#12356;&#12383;&#12384;&#12365;&#12354;&#12426;&#12364;&#12392;&#12358;&#12372;&#12374;&#12356;&#12414;&#12377;&#128522;',
    '',
    '&#12372;&#20104;&#32004;&#20869;&#23481;&#12399;&#12371;&#12385;&#12425;&#12391;&#12377;&#65281;',
    '',
    '&#12304;&#31532;1&#24076;&#26395;&#26085;&#26178;&#12305;',
    '{{first_choice_date}} {{first_choice_time}}&#12316;',
    '',
    '&#12304;&#31532;2&#24076;&#26395;&#26085;&#26178;&#12305;',
    '{{second_choice_date}} {{second_choice_time}}&#12316;',
    '',
    '&#12304;&#31532;3&#24076;&#26395;&#26085;&#26178;&#12305;',
    '{{third_choice_date}} {{third_choice_time}}&#12316;',
    '',
    '&#12304;&#20104;&#32004;&#26528;&#12305;',
    '&#12475;&#12511;&#12497;&#12540;&#12477;&#12490;&#12523;&#28961;&#26009;&#20307;&#39443;',
    '',
    '&#24403;&#26085;&#12399;&#12289;&#36939;&#21205;&#21021;&#24515;&#32773;&#12398;&#26041;&#12391;&#12418;&#23433;&#24515;&#12375;&#12390;&#12372;&#21442;&#21152;&#12356;&#12383;&#12384;&#12369;&#12427;&#12424;&#12358;&#12469;&#12509;&#12540;&#12488;&#12373;&#12379;&#12390;&#12356;&#12383;&#12384;&#12365;&#12414;&#12377;&#12398;&#12391;&#12289;&#12362;&#27671;&#36605;&#12395;&#12362;&#36234;&#12375;&#12367;&#12384;&#12373;&#12356;&#10024;',
    '',
    '&#12304;&#25345;&#12385;&#29289;&#12305;',
    '&#12539;&#12362;&#27700;&#12414;&#12383;&#12399;&#12362;&#33590;',
    '&#12539;&#23460;&#20869;&#23653;&#12365;&#65288;&#12362;&#25345;&#12385;&#12391;&#12354;&#12428;&#12400;&#12391;&#22823;&#19976;&#22827;&#12391;&#12377;&#65281;&#12394;&#12367;&#12390;&#12418;&#21839;&#38988;&#12354;&#12426;&#12414;&#12379;&#12435;&#128522;&#65289;',
    '',
    '&#12381;&#12428;&#12391;&#12399;&#12289;&#24403;&#26085;&#12362;&#20250;&#12356;&#12391;&#12365;&#12427;&#12398;&#12434;&#27005;&#12375;&#12415;&#12395;&#12375;&#12390;&#12362;&#12426;&#12414;&#12377;&#65281;',
    '&#12424;&#12429;&#12375;&#12367;&#12362;&#39000;&#12356;&#12356;&#12383;&#12375;&#12414;&#12377;&#128588;',
  ];

  return decodeEntities(lines.join('\n'))
    .replace('{{name}}', reservation.name)
    .replace('{{first_choice_date}}', formatDate(reservation.firstChoice.date))
    .replace('{{first_choice_time}}', reservation.firstChoice.time)
    .replace('{{second_choice_date}}', reservation.secondChoice ? formatDate(reservation.secondChoice.date) : '-')
    .replace('{{second_choice_time}}', reservation.secondChoice ? reservation.secondChoice.time : '')
    .replace('{{third_choice_date}}', reservation.thirdChoice ? formatDate(reservation.thirdChoice.date) : '-')
    .replace('{{third_choice_time}}', reservation.thirdChoice ? reservation.thirdChoice.time : '');
}

function createOwnerNotification(reservation) {
  return [
    'friends無料体験フォームから新しい予約希望が届きました。',
    '',
    `【送信日時】${formatSubmittedAt(reservation.createdAt)}`,
    `【お名前】${reservation.name}`,
    `【電話番号】${reservation.phone}`,
    `【メールアドレス】${reservation.email}`,
    `【第1希望日時】${formatChoice(reservation.firstChoice)}〜`,
    `【第2希望日時】${formatChoice(reservation.secondChoice)}〜`,
    `【第3希望日時】${formatChoice(reservation.thirdChoice)}〜`,
    `【連絡事項】${reservation.note || 'なし'}`,
  ].join('\n');
}

function buildAdminStockRecord(reservation) {
  return {
    id: reservation.id,
    submitted_at: formatSubmittedAt(reservation.createdAt),
    submitted_at_iso: reservation.createdAt,
    name: reservation.name,
    phone: reservation.phone,
    email: reservation.email,
    first_choice: `${formatChoice(reservation.firstChoice)}〜`,
    second_choice: `${formatChoice(reservation.secondChoice)}〜`,
    third_choice: `${formatChoice(reservation.thirdChoice)}〜`,
    note: reservation.note || '',
  };
}

function buildFormspreePayload(reservation) {
  return {
    _subject: 'friends 無料体験の予約希望が届きました',
    _replyto: reservation.email,
    owner_notification_email: OWNER_NOTIFICATION_EMAIL,
    admin_notification_to: OWNER_NOTIFICATION_EMAIL,
    submitted_at: formatSubmittedAt(reservation.createdAt),
    name: reservation.name,
    email: reservation.email,
    phone: reservation.phone,
    first_choice_date: formatDate(reservation.firstChoice.date),
    first_choice_time: reservation.firstChoice.time,
    first_choice: `${formatChoice(reservation.firstChoice)}〜`,
    second_choice_date: formatDate(reservation.secondChoice.date),
    second_choice_time: reservation.secondChoice.time,
    second_choice: `${formatChoice(reservation.secondChoice)}〜`,
    third_choice_date: formatDate(reservation.thirdChoice.date),
    third_choice_time: reservation.thirdChoice.time,
    third_choice: `${formatChoice(reservation.thirdChoice)}〜`,
    reservation_frame: decodeEntities('&#12475;&#12511;&#12497;&#12540;&#12477;&#12490;&#12523;&#28961;&#26009;&#20307;&#39443;'),
    note: reservation.note || '',
    message: createOwnerNotification(reservation),
    customer_confirmation_message: createCustomerEmail(reservation),
    admin_stock_json: JSON.stringify(buildAdminStockRecord(reservation)),
  };
}

async function sendReservationEmail(reservation) {
  if (!FORM_ENDPOINT) {
    return;
  }

  const response = await fetch(FORM_ENDPOINT, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body: JSON.stringify(buildFormspreePayload(reservation)),
  });

  if (!response.ok) {
    throw new Error('Formspree request failed');
  }
}

function buildCalendarUrl(reservation) {
  const start = formatCalendarDateTime(reservation.firstChoice.date, reservation.firstChoice.time);
  const end = formatCalendarDateTime(reservation.firstChoice.date, reservation.firstChoice.time, LESSON_MINUTES);
  const url = new URL('https://calendar.google.com/calendar/render');
  url.searchParams.set('action', 'TEMPLATE');
  url.searchParams.set('text', decodeEntities('friends &#28961;&#26009;&#20307;&#39443;'));
  url.searchParams.set('dates', `${start}/${end}`);
  url.searchParams.set('details', createCustomerEmail(reservation));
  url.searchParams.set('location', 'friends');
  return url.toString();
}

async function addReservation(form) {
  const firstChoice = findSlot(form.firstChoice);
  const secondChoice = findSlot(form.secondChoice);
  const thirdChoice = findSlot(form.thirdChoice);

  if (!firstChoice || !secondChoice || !thirdChoice) {
    alert(decodeEntities('&#31532;1&#12316;&#31532;3&#24076;&#26395;&#26085;&#26178;&#12434;&#12377;&#12409;&#12390;&#36984;&#25246;&#12375;&#12390;&#12367;&#12384;&#12373;&#12356;&#12290;'));
    return;
  }

  const selected = [firstChoice, secondChoice, thirdChoice];
  const uniqueIds = new Set(selected.map((choice) => choice.id));
  if (uniqueIds.size !== selected.length) {
    alert(decodeEntities('&#24076;&#26395;&#26085;&#26178;&#12399;&#12381;&#12428;&#12382;&#12428;&#21029;&#12398;&#26528;&#12434;&#36984;&#25246;&#12375;&#12390;&#12367;&#12384;&#12373;&#12356;&#12290;'));
    return;
  }

  const reservation = {
    id: createId('reservation'),
    createdAt: new Date().toISOString(),
    name: form.name.trim(),
    phone: form.phone.trim(),
    email: form.email.trim(),
    firstChoice,
    secondChoice,
    thirdChoice,
    service: decodeEntities(SERVICE_TEXT),
    program: decodeEntities(PROGRAM_TEXT),
    note: form.note.trim(),
  };

  try {
    await sendReservationEmail(reservation);
  } catch {
    alert(decodeEntities('&#30906;&#35469;&#12513;&#12540;&#12523;&#12398;&#36865;&#20449;&#12395;&#22833;&#25943;&#12375;&#12414;&#12375;&#12383;&#12290;&#12513;&#12540;&#12523;&#12450;&#12489;&#12524;&#12473;&#12434;&#30906;&#35469;&#12375;&#12390;&#20877;&#24230;&#12362;&#35430;&#12375;&#12367;&#12384;&#12373;&#12356;&#12290;'));
    return;
  }

  saveReservationStock(reservation);
  saveEmail(reservation.email);
  state.lastReservation = reservation;
  navigate('complete');
}

function navigate(page) {
  window.location.hash = page === 'reserve' ? '' : page;
  render();
}

function appShell(content) {
  return `
    <div class="app-shell">
      <header class="hero seminar-hero">
        <div class="hero-copy">
          <p class="hero-kicker">BEGINNER DIET SEMINAR</p>
          <h1>見てわかる<br />ダイエット入門</h1>
          <p>カロリー・栄養・食事選びを、図解と比較で直感的に理解できるセミナースライドです。初心者が途中で置いていかれないよう、1枚ずつ「結論 → 理由 → 行動」の順に整理しました。</p>
          <div class="hero-badges" aria-label="このセミナーで学べること">
            <span>📊 数字はグラフ化</span>
            <span>↔️ 悪い例 / 良い例</span>
            <span>📱 スマホ対応</span>
          </div>
        </div>
      </header>
      <main>${content}</main>
    </div>
  `;
}

const seminarSlides = [
  {
    eyebrow: 'Slide 01 / Goal',
    title: 'ダイエットは「我慢」ではなく、体の仕組みを使うこと',
    lead: '最初に覚えることは3つだけです。食べる量、栄養の中身、続けられる環境を整えると、迷わず行動できます。',
    type: 'principles',
  },
  {
    eyebrow: 'Slide 02 / Big picture',
    title: '体重が変わる流れを1本の矢印で理解する',
    lead: '体重は毎日の小さな選択の合計で動きます。原因と結果を分けて見ると、何を直せばよいかが見えます。',
    type: 'flow',
  },
  {
    eyebrow: 'Slide 03 / Calories',
    title: '数字は「食べた量」と「使った量」の差で見る',
    lead: '難しい計算より、まずは差のイメージをつかみましょう。赤字の日が多いほど体脂肪は減りやすくなります。',
    type: 'calorieChart',
  },
  {
    eyebrow: 'Slide 04 / Nutrition balance',
    title: '同じカロリーでも「中身」で満腹感が変わる',
    lead: 'たんぱく質・野菜・炭水化物をそろえると、空腹を抑えながら続けやすくなります。',
    type: 'plate',
  },
  {
    eyebrow: 'Slide 05 / Bad vs Good',
    title: '悪い例と良い例を並べると、選び方が一瞬でわかる',
    lead: '完全に禁止するのではなく、満足感を残したまま「置き換える」ことが初心者の成功パターンです。',
    type: 'comparison',
  },
  {
    eyebrow: 'Slide 06 / Before After',
    title: 'ビフォーアフターは「食事の形」を変えるだけで大きく変わる',
    lead: '量を極端に減らすより、主食・主菜・副菜の配置を整える方が説明しやすく、再現しやすいです。',
    type: 'beforeAfter',
  },
  {
    eyebrow: 'Slide 07 / Habit design',
    title: '続く人は、意思よりも「仕組み」を作っている',
    lead: '行動を小さく分解し、チェックしやすくすると、忙しい日でもやることが明確になります。',
    type: 'habitCards',
  },
  {
    eyebrow: 'Slide 08 / Action plan',
    title: '今日からの実践は、この3ステップだけ',
    lead: '最後に、参加者がそのまま持ち帰れる行動プランにまとめます。説明の締めにも使いやすいスライドです。',
    type: 'actionFlow',
  },
];

function renderPrinciples() {
  return `
    <div class="principle-grid">
      <article class="visual-card emphasis-card"><span class="card-icon">🍽️</span><h4>食べる量</h4><p>まずは「いつもより少しだけ」調整。ゼロにしないので続けやすい。</p></article>
      <article class="visual-card"><span class="card-icon">🥚</span><h4>栄養の中身</h4><p>たんぱく質と野菜を先に決めると、食事全体が整いやすい。</p></article>
      <article class="visual-card"><span class="card-icon">🔁</span><h4>続く仕組み</h4><p>買い置き・記録・外食ルールで、迷う回数を減らす。</p></article>
    </div>
  `;
}

function renderFlow() {
  return `
    <div class="flow-diagram" aria-label="体重変化の流れ図">
      <div class="flow-node">食事量<br /><strong>摂取</strong></div>
      <div class="flow-arrow">→</div>
      <div class="flow-node">活動量<br /><strong>消費</strong></div>
      <div class="flow-arrow">→</div>
      <div class="flow-node highlight-node">差分<br /><strong>体脂肪の増減</strong></div>
      <div class="flow-arrow">→</div>
      <div class="flow-node">毎日の平均<br /><strong>体重変化</strong></div>
    </div>
    <div class="note-box">ポイント：1日だけで判断せず、1〜2週間の平均で見るとブレに振り回されません。</div>
  `;
}

function renderCalorieChart() {
  const rows = [
    ['食べた量', 2100, 'intake'],
    ['使った量', 2400, 'burn'],
    ['減量に向く差', 300, 'deficit'],
  ];
  return `
    <div class="bar-chart" aria-label="摂取カロリーと消費カロリーの比較グラフ">
      ${rows.map(([label, value, kind]) => `
        <div class="bar-row">
          <span class="bar-label">${label}</span>
          <div class="bar-track"><span class="bar-fill ${kind}" style="width:${kind === 'deficit' ? 22 : Math.round(value / 25)}%"></span></div>
          <strong>${value}kcal</strong>
        </div>
      `).join('')}
    </div>
    <div class="chart-callout">摂取 2,100kcal − 消費 2,400kcal = <strong>−300kcal</strong><br />小さな赤字を積み重ねるのが安全で続きやすい基本です。</div>
  `;
}

function renderPlate() {
  return `
    <div class="plate-layout">
      <div class="plate-visual" aria-label="理想の皿バランス図">
        <div class="plate-section protein">たんぱく質<br /><strong>25%</strong></div>
        <div class="plate-section veggie">野菜・海藻<br /><strong>50%</strong></div>
        <div class="plate-section carb">ごはん等<br /><strong>25%</strong></div>
      </div>
      <div class="macro-cards">
        <div><span>💪</span><strong>たんぱく質</strong><p>筋肉を守り、満腹感を保つ。</p></div>
        <div><span>🥦</span><strong>食物繊維</strong><p>かさが増えて、食べすぎを防ぐ。</p></div>
        <div><span>🍚</span><strong>炭水化物</strong><p>抜きすぎず、量とタイミングを整える。</p></div>
      </div>
    </div>
  `;
}

function renderComparison() {
  return `
    <div class="compare-grid">
      <article class="compare-card bad"><h4>悪い例：なんとなく選ぶ</h4><div class="meal-emoji">🍟🥤🍰</div><ul><li>甘い飲み物でカロリーが増える</li><li>たんぱく質が少なく空腹が早い</li><li>満足感より罪悪感が残る</li></ul></article>
      <article class="compare-card good"><h4>良い例：満足感を設計する</h4><div class="meal-emoji">🍱🥗☕</div><ul><li>主菜を先に決める</li><li>飲み物は無糖を基本にする</li><li>野菜で量を増やす</li></ul></article>
    </div>
  `;
}

function renderBeforeAfter() {
  return `
    <div class="before-after">
      <article><span class="tag before">Before</span><h4>朝を抜く → 夜に食べすぎ</h4><div class="mini-bars"><i style="height:20%"></i><i style="height:35%"></i><i style="height:95%"></i></div><p>空腹が強くなり、夕食で調整が難しくなる。</p></article>
      <div class="transform-arrow">⇒</div>
      <article><span class="tag after">After</span><h4>朝にたんぱく質 → 夜が安定</h4><div class="mini-bars balanced"><i style="height:55%"></i><i style="height:65%"></i><i style="height:70%"></i></div><p>食欲の波が小さくなり、選択ミスが減る。</p></article>
    </div>
  `;
}

function renderHabitCards() {
  return `
    <div class="habit-grid">
      <div class="habit-card"><span>🛒</span><strong>買う物を固定</strong><p>卵・魚・鶏肉・冷凍野菜など、迷わない定番を作る。</p></div>
      <div class="habit-card"><span>📸</span><strong>写真で記録</strong><p>カロリー計算が苦手でも、食事の偏りに気づける。</p></div>
      <div class="habit-card"><span>🚶</span><strong>食後10分歩く</strong><p>運動が苦手な人でも始めやすい小さな習慣。</p></div>
      <div class="habit-card"><span>😴</span><strong>睡眠を守る</strong><p>寝不足は食欲を乱しやすいので、夜更かし対策も重要。</p></div>
    </div>
  `;
}

function renderActionFlow() {
  return `
    <div class="action-flow">
      <div><span>1</span><strong>毎食たんぱく質</strong><p>手のひら1枚分を目安にする。</p></div>
      <div><span>2</span><strong>飲み物を無糖へ</strong><p>最も簡単に余分なカロリーを減らせる。</p></div>
      <div><span>3</span><strong>週2回だけ振り返る</strong><p>体重・写真・食事を見て次の一手を決める。</p></div>
    </div>
  `;
}

function renderSlideVisual(type) {
  const visuals = {
    principles: renderPrinciples,
    flow: renderFlow,
    calorieChart: renderCalorieChart,
    plate: renderPlate,
    comparison: renderComparison,
    beforeAfter: renderBeforeAfter,
    habitCards: renderHabitCards,
    actionFlow: renderActionFlow,
  };
  return visuals[type] ? visuals[type]() : '';
}

function seminarDeck() {
  return `
    <section class="seminar-intro panel">
      <div class="section-heading">
        <span>Visual seminar</span>
        <h2>初心者向けに、話す順番まで整理したスライド構成</h2>
        <p>各スライドは「大きな結論」「図解」「説明メモ」の3層で構成。スマホではカードが縦に並び、プレゼン中も読み上げやすい余白と強調を入れています。</p>
      </div>
      <div class="overview-cards">
        <div><strong>👀 見て理解</strong><span>比較・グラフ・矢印で直感化</span></div>
        <div><strong>🧭 迷わない</strong><span>1枚1テーマで順番に理解</span></div>
        <div><strong>✅ 行動できる</strong><span>最後は今日やることに落とし込む</span></div>
      </div>
    </section>
    <section class="slide-deck" aria-label="ダイエットセミナースライド">
      ${seminarSlides.map((slide) => `
        <article class="seminar-slide panel">
          <div class="slide-copy">
            <span class="slide-eyebrow">${slide.eyebrow}</span>
            <h3>${slide.title}</h3>
            <p>${slide.lead}</p>
          </div>
          <div class="slide-visual">${renderSlideVisual(slide.type)}</div>
        </article>
      `).join('')}
    </section>
  `;
}

function choiceField(name, label) {
  return `
    <label class="choice-field" for="${name}">
      <span>${label} <strong>&#24517;&#38920;</strong></span>
      <select id="${name}" name="${name}" required aria-required="true">
        <option value="">&#36984;&#25246;&#12375;&#12390;&#12367;&#12384;&#12373;&#12356;</option>
        ${groupedSlotOptions()}
      </select>
    </label>
  `;
}

function reservationPage() {
  return `
    ${seminarDeck()}
    <section class="panel reservation-panel reservation-cta">
      <div class="section-heading">
        <span>Free trial</span>
        <h2>セミナー後の無料体験予約</h2>
        <p>内容を実践したい方向けに、friendsのセミパーソナル無料体験を予約できます。</p>
      </div>
      <form class="form-grid" id="reservation-form" action="${escapeHtml(FORM_ENDPOINT)}" method="post">
        <div class="choice-stack">
          ${choiceField('firstChoice', '&#31532;1&#24076;&#26395;&#26085;&#26178;')}
          ${choiceField('secondChoice', '&#31532;2&#24076;&#26395;&#26085;&#26178;')}
          ${choiceField('thirdChoice', '&#31532;3&#24076;&#26395;&#26085;&#26178;')}
        </div>
        <label>&#12362;&#21517;&#21069; <strong>&#24517;&#38920;</strong>
          <input autocomplete="name" name="name" required placeholder="&#20363;&#65306;&#23665;&#30000; &#33457;&#23376;" />
        </label>
        <label>&#38651;&#35441;&#30058;&#21495; <strong>&#24517;&#38920;</strong>
          <input autocomplete="tel" inputmode="tel" name="phone" required placeholder="&#20363;&#65306;090-1234-5678" />
        </label>
        <label>&#12513;&#12540;&#12523;&#12450;&#12489;&#12524;&#12473; <strong>&#24517;&#38920;</strong>
          <input autocomplete="email" inputmode="email" list="email-history" name="email" required type="email" placeholder="hello@example.com" />
          <datalist id="email-history">
            ${state.emailHistory.map((email) => `<option value="${escapeHtml(email)}"></option>`).join('')}
          </datalist>
        </label>
        <label>&#36899;&#32097;&#20107;&#38917;
          <textarea name="note" rows="4" placeholder="&#20107;&#21069;&#12395;&#20253;&#12360;&#12383;&#12356;&#12371;&#12392;&#12364;&#12354;&#12428;&#12400;&#20837;&#21147;&#12375;&#12390;&#12367;&#12384;&#12373;&#12356;"></textarea>
        </label>
        <p class="mail-notice">送信後、管理者側でお名前・電話番号・メールアドレス・第1〜第3希望日時・連絡事項を確認できる形で保存します。送信先未設定時は、この端末の管理ストックに保存されます。</p>
        <button class="primary-button" type="submit">&#20104;&#32004;&#12434;&#30906;&#23450;&#12377;&#12427;</button>
      </form>
    </section>
  `;
}

function completePage() {
  const reservation = state.lastReservation;
  if (!reservation) return reservationPage();

  return `
    <section class="panel complete-card">
      <div class="complete-icon" aria-hidden="true">&#10003;</div>
      <h2>&#20104;&#32004;&#12434;&#21463;&#12369;&#20184;&#12369;&#12414;&#12375;&#12383;</h2>
      <p>&#36865;&#20449;&#23436;&#20102;&#12375;&#12414;&#12375;&#12383;&#12290;&#30906;&#35469;&#24460;&#12395;&#12371;&#12385;&#12425;&#12363;&#12425;&#12372;&#36899;&#32097;&#12375;&#12414;&#12377;&#12290;</p>
      <dl class="summary-list">
        <div><dt>&#31532;1&#24076;&#26395;&#26085;&#26178;</dt><dd>${formatChoice(reservation.firstChoice)}&#12316;</dd></div>
        <div><dt>&#31532;2&#24076;&#26395;&#26085;&#26178;</dt><dd>${formatChoice(reservation.secondChoice)}&#12316;</dd></div>
        <div><dt>&#31532;3&#24076;&#26395;&#26085;&#26178;</dt><dd>${formatChoice(reservation.thirdChoice)}&#12316;</dd></div>
        <div><dt>&#20104;&#32004;&#26528;</dt><dd>&#12475;&#12511;&#12497;&#12540;&#12477;&#12490;&#12523;&#28961;&#26009;&#20307;&#39443;</dd></div>
      </dl>
      <div class="action-row">
        <a class="primary-link" href="${buildCalendarUrl(reservation)}" target="_blank" rel="noreferrer">Google&#12459;&#12524;&#12531;&#12480;&#12540;&#12395;&#36861;&#21152;</a>
        <button class="ghost-button" data-page="reserve">&#32154;&#12369;&#12390;&#20104;&#32004;&#12377;&#12427;</button>
      </div>
    </section>
  `;
}

function adminPage() {
  const rows = state.reservations.map((reservation) => {
    const stock = buildAdminStockRecord(reservation);
    return `
      <article class="admin-card">
        <div><span>送信日時</span><strong>${escapeHtml(stock.submitted_at)}</strong></div>
        <div><span>お名前</span><strong>${escapeHtml(stock.name)}</strong></div>
        <div><span>電話番号</span><strong>${escapeHtml(stock.phone)}</strong></div>
        <div><span>メールアドレス</span><strong><a href="mailto:${escapeHtml(stock.email)}">${escapeHtml(stock.email)}</a></strong></div>
        <div><span>第1希望日時</span><strong>${escapeHtml(stock.first_choice)}</strong></div>
        <div><span>第2希望日時</span><strong>${escapeHtml(stock.second_choice)}</strong></div>
        <div><span>第3希望日時</span><strong>${escapeHtml(stock.third_choice)}</strong></div>
        <div class="admin-note"><span>連絡事項</span><p>${escapeHtml(stock.note || 'なし')}</p></div>
      </article>
    `;
  }).join('');

  return `
    <section class="panel admin-panel">
      <div class="section-heading">
        <span>Admin stock</span>
        <h2>予約ストック</h2>
        <p>Formspree等の送信先を設定すると外部サービス側にも同じ内容が保存・通知されます。現在の送信先: ${FORM_ENDPOINT ? '設定済み' : '未設定（ブラウザ内保存のみ）'}</p>
      </div>
      <div class="admin-list">
        ${rows || '<p class="empty-admin">まだ保存された予約はありません。</p>'}
      </div>
      <div class="action-row">
        <button class="ghost-button" data-page="reserve">予約フォームに戻る</button>
      </div>
    </section>
  `;
}

function render() {
  const root = document.getElementById('root');
  const page = window.location.hash.replace('#', '') || 'reserve';
  const content = page === 'complete' ? completePage() : page === ADMIN_HASH ? adminPage() : reservationPage();
  root.innerHTML = appShell(content);
  bindEvents();
}

function bindEvents() {
  document.querySelectorAll('[data-page]').forEach((button) => {
    button.addEventListener('click', () => navigate(button.dataset.page));
  });

  const form = document.getElementById('reservation-form');
  if (!form) return;

  const choiceSelects = ['firstChoice', 'secondChoice', 'thirdChoice']
    .map((name) => form.elements[name])
    .filter(Boolean);

  choiceSelects.forEach((select) => {
    select.addEventListener('change', () => {
      const values = Object.fromEntries(choiceSelects.map((item) => [item.name, item.value]));
      const selectedSet = new Set(Object.values(values).filter(Boolean));
      choiceSelects.forEach((item) => {
        item.innerHTML = `<option value="">&#36984;&#25246;&#12375;&#12390;&#12367;&#12384;&#12373;&#12356;</option>${groupedSlotOptions(values[item.name], selectedSet)}`;
        item.value = values[item.name];
      });
    });
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) {
      return;
    }

    const submitButton = form.querySelector('button[type="submit"]');
    const data = { ...Object.fromEntries(new FormData(form).entries()) };
    if (!data.name?.trim() || !data.phone?.trim() || !data.email?.trim() || !data.firstChoice || !data.secondChoice || !data.thirdChoice) {
      alert(decodeEntities('&#24517;&#38920;&#38917;&#30446;&#12434;&#12377;&#12409;&#12390;&#20837;&#21147;&#12375;&#12390;&#12367;&#12384;&#12373;&#12356;&#12290;'));
      return;
    }

    submitButton.disabled = true;
    submitButton.textContent = '送信中...';
    await addReservation(data);
    submitButton.disabled = false;
    submitButton.innerHTML = '&#20104;&#32004;&#12434;&#30906;&#23450;&#12377;&#12427;';
  });
}

window.addEventListener('hashchange', render);
render();
