const BRAND_NAME = 'friends';
const SERVICE_TEXT = '&#12475;&#12511;&#12497;&#12540;&#12477;&#12490;&#12523;';
const PROGRAM_TEXT = '&#28961;&#26009;&#20307;&#39443;';
const START_DAYS_AHEAD = 5;

// Formspreeなどの外部フォームサービスの送信先。
// 例: const FORM_ENDPOINT = 'https://formspree.io/f/xxxxxxxx';
// 未設定のままでも画面は壊れず、ブラウザ内の管理ストックに保存します。
const FORM_ENDPOINT = '';
const OWNER_NOTIFICATION_EMAIL = '';
const ADMIN_HASH = 'admin';
const ADMIN_PATH = 'admin.html';

const STORAGE_KEYS = {
  reservations: 'reservation-app-reservations',
  emailHistory: 'reservation-app-email-history',
  pendingOutbox: 'reservation-app-pending-outbox',
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
  pendingOutbox: readStorage(STORAGE_KEYS.pendingOutbox, []),
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

function savePendingOutbox(reservation) {
  const outboxItem = {
    id: reservation.id,
    createdAt: new Date().toISOString(),
    payload: buildFormspreePayload(reservation),
  };
  state.pendingOutbox = [outboxItem, ...state.pendingOutbox.filter((item) => item.id !== reservation.id)];
  writeStorage(STORAGE_KEYS.pendingOutbox, state.pendingOutbox);
}

function removePendingOutbox(reservationId) {
  state.pendingOutbox = state.pendingOutbox.filter((item) => item.id !== reservationId);
  writeStorage(STORAGE_KEYS.pendingOutbox, state.pendingOutbox);
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
    _subject: '【予約リクエスト】friends 無料体験の予約希望が届きました',
    _replyto: reservation.email,
    _cc: OWNER_NOTIFICATION_EMAIL,
    owner_notification_email: OWNER_NOTIFICATION_EMAIL,
    admin_notification_to: OWNER_NOTIFICATION_EMAIL,
    admin_email_note: OWNER_NOTIFICATION_EMAIL
      ? `Formspreeの通知先に加えて ${OWNER_NOTIFICATION_EMAIL} 宛の管理者通知を想定しています。`
      : 'Formspreeの通知先メールアドレスで管理者通知を受け取ってください。',
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
    admin_notification_message: createOwnerNotification(reservation),
    admin_stock_json: JSON.stringify(buildAdminStockRecord(reservation)),
  };
}

async function sendAdminNotificationEmail(reservation) {
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
    throw new Error('Formspree admin notification request failed');
  }
}


function createSampleReservation() {
  const [firstChoice, secondChoice, thirdChoice] = buildScheduleSlots();
  return {
    id: createId('sample-reservation'),
    createdAt: new Date().toISOString(),
    name: '山田 花子（ダミー）',
    phone: '090-1234-5678',
    email: 'dummy@example.com',
    firstChoice,
    secondChoice,
    thirdChoice,
    service: decodeEntities(SERVICE_TEXT),
    program: decodeEntities(PROGRAM_TEXT),
    note: '動作確認用のダミーデータです。管理画面で表示を確認してください。',
  };
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

  saveReservationStock(reservation);
  saveEmail(reservation.email);

  try {
    await sendAdminNotificationEmail(reservation);
    removePendingOutbox(reservation.id);
  } catch {
    savePendingOutbox(reservation);
    alert('予約内容はこのブラウザの管理画面に保存しました。管理者通知メールの送信に失敗したため、Formspree URLを確認してください。');
  }
  state.lastReservation = reservation;
  navigate('complete');
}

function navigate(page) {
  if (page === 'admin') {
    window.location.href = ADMIN_PATH;
    return;
  }

  if (window.location.pathname.endsWith(ADMIN_PATH)) {
    window.location.href = 'index.html';
    return;
  }

  window.location.hash = page === 'reserve' ? '' : page;
  render();
}

function appShell(content) {
  const isAdminPath = window.location.pathname.endsWith(ADMIN_PATH);
  const adminNav = isAdminPath
    ? `<nav class="top-nav" aria-label="ページ切り替え"><button class="nav-button" data-page="reserve">予約フォームに戻る</button></nav>`
    : '';

  return `
    <div class="app-shell">
      <header class="hero">
        ${adminNav}
        <div class="hero-copy">
          <p class="hero-kicker">女性初心者も安心の無料体験</p>
          <h1>${BRAND_NAME}</h1>
          <p>黄色を基調にした明るく清潔感のあるセミパーソナルジムで、まずは気軽に無料体験。日本人女性の方にも安心してご参加いただける予約フォームです。</p>
        </div>
      </header>
      <main>${content}</main>
    </div>
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
    <section class="panel reservation-panel">
      <div class="section-heading">
        <span>Free trial</span>
        <h2>&#28961;&#26009;&#20307;&#39443;&#20104;&#32004;</h2>
      </div>
      <form class="form-grid" id="reservation-form" action="${escapeHtml(FORM_ENDPOINT)}" method="post">
        <label>&#12362;&#21517;&#21069; <strong>&#24517;&#38920;</strong>
          <input autocomplete="name" name="name" required placeholder="&#20363;&#65306;&#23665;&#30000; &#33457;&#23376;" />
        </label>
        <label>&#38651;&#35441;&#30058;&#21495; <strong>&#24517;&#38920;</strong>
          <input autocomplete="tel" inputmode="tel" name="phone" required placeholder="&#20363;&#65306;090-1234-5678" />
        </label>
        <label class="email-field">&#12513;&#12540;&#12523;&#12450;&#12489;&#12524;&#12473; <strong>&#24517;&#38920;</strong>
          <input autocomplete="email" inputmode="email" list="email-history" name="email" required type="email" placeholder="hello@example.com" />
          <datalist id="email-history">
            ${state.emailHistory.map((email) => `<option value="${escapeHtml(email)}"></option>`).join('')}
          </datalist>
        </label>
        <div class="choice-stack" aria-label="希望日時">
          ${choiceField('firstChoice', '&#31532;1&#24076;&#26395;&#26085;&#26178;')}
          ${choiceField('secondChoice', '&#31532;2&#24076;&#26395;&#26085;&#26178;')}
          ${choiceField('thirdChoice', '&#31532;3&#24076;&#26395;&#26085;&#26178;')}
        </div>
        <label class="note-field">&#36899;&#32097;&#20107;&#38917;
          <textarea name="note" rows="4" placeholder="&#20107;&#21069;&#12395;&#20253;&#12360;&#12383;&#12356;&#12371;&#12392;&#12364;&#12354;&#12428;&#12400;&#20837;&#21147;&#12375;&#12390;&#12367;&#12384;&#12373;&#12356;&#12290;"></textarea>
        </label>
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
      <p>予約リクエストを受け付けました。<br />確認後、入力いただいたメールアドレス宛にご連絡いたします。</p>
      <dl class="summary-list">
        <div><dt>&#31532;1&#24076;&#26395;&#26085;&#26178;</dt><dd>${formatChoice(reservation.firstChoice)}&#12316;</dd></div>
        <div><dt>&#31532;2&#24076;&#26395;&#26085;&#26178;</dt><dd>${formatChoice(reservation.secondChoice)}&#12316;</dd></div>
        <div><dt>&#31532;3&#24076;&#26395;&#26085;&#26178;</dt><dd>${formatChoice(reservation.thirdChoice)}&#12316;</dd></div>
        <div><dt>&#20104;&#32004;&#26528;</dt><dd>&#12475;&#12511;&#12497;&#12540;&#12477;&#12490;&#12523;&#28961;&#26009;&#20307;&#39443;</dd></div>
      </dl>
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
        <p>送信された予約内容を一覧で確認できます。<code>/admin.html</code> をブックマークしてください。現在のFormspree送信先: ${FORM_ENDPOINT ? '設定済み' : '未設定（src/main.js 上部の FORM_ENDPOINT で設定）'}</p>
      </div>
      <div class="admin-actions">
        <button class="ghost-button" data-action="add-sample">ダミーデータを追加</button>
        <span>${state.pendingOutbox.length ? `未送信の管理者通知: ${state.pendingOutbox.length}件` : '管理者通知の未送信はありません'}</span>
      </div>
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr><th>日時</th><th>名前</th><th>メール</th><th>電話番号</th><th>第1希望</th></tr>
          </thead>
          <tbody>
            ${state.reservations.map((reservation) => {
              const stock = buildAdminStockRecord(reservation);
              return `<tr><td>${escapeHtml(stock.submitted_at)}</td><td>${escapeHtml(stock.name)}</td><td><a href="mailto:${escapeHtml(stock.email)}">${escapeHtml(stock.email)}</a></td><td>${escapeHtml(stock.phone)}</td><td>${escapeHtml(stock.first_choice)}</td></tr>`;
            }).join('') || '<tr><td colspan="5">まだ保存された予約はありません。</td></tr>'}
          </tbody>
        </table>
      </div>
      <div class="admin-list">
        ${rows || '<p class="empty-admin">まだ保存された予約はありません。ダミーデータを追加すると表示確認できます。</p>'}
      </div>
      <div class="action-row">
        <button class="ghost-button" data-page="reserve">予約フォームに戻る</button>
      </div>
    </section>
  `;
}

function render() {
  const root = document.getElementById('root');
  const isAdminPath = window.location.pathname.endsWith(ADMIN_PATH);
  const page = isAdminPath ? ADMIN_HASH : window.location.hash.replace('#', '') || 'reserve';
  const content = page === 'complete' ? completePage() : page === ADMIN_HASH ? adminPage() : reservationPage();
  root.innerHTML = appShell(content);
  bindEvents();
}

function bindEvents() {
  document.querySelectorAll('[data-page]').forEach((button) => {
    button.addEventListener('click', () => navigate(button.dataset.page));
  });

  document.querySelector('[data-action="add-sample"]')?.addEventListener('click', () => {
    const sample = createSampleReservation();
    saveReservationStock(sample);
    state.lastReservation = sample;
    render();
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
