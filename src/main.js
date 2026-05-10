const FORM_ENDPOINT = "https://formspree.io/f/xkoyzpdv";
const BRAND_NAME = 'friends';
const ADMIN_PATH = 'admin.html';
const START_DAYS_AHEAD = 3;
const STORAGE_KEY = 'friends-trial-reservation-requests';

const WEEKDAY_SCHEDULE = {
  0: ['10:00', '10:50', '11:40', '12:30'],
  1: ['18:30', '19:20', '20:10', '21:00'],
  2: ['18:30', '19:20', '20:10', '21:00'],
  3: ['18:30', '19:20', '20:10', '21:00'],
  4: [],
  5: ['18:30', '19:20', '20:10', '21:00'],
  6: ['10:00', '10:50', '11:40', '12:30'],
};

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

const HOLIDAY_SCHEDULE = ['10:00', '10:50', '11:40', '12:30'];

const state = {
  reservations: readStorage(STORAGE_KEY, []),
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
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // localStorageが使えない環境でも、Formspree送信自体は継続します。
  }
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function createId() {
  return `request-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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

function formatDateTime(value) {
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function formatChoice(choice) {
  if (!choice) return '';
  return `${formatDate(choice.date)} ${choice.time}〜`;
}

function buildScheduleSlots() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const start = new Date(today);
  start.setDate(start.getDate() + START_DAYS_AHEAD);

  const end = new Date(start);
  end.setDate(end.getDate() + 27);

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

function findSlot(slotId) {
  return buildScheduleSlots().find((slot) => slot.id === slotId);
}

function getSelectedChoices(form) {
  return new Set(['firstChoice', 'secondChoice', 'thirdChoice']
    .map((name) => form?.elements[name]?.value)
    .filter(Boolean));
}

function groupedSlotOptions(selectedValue = '', selectedChoices = new Set()) {
  const groupedSlots = buildScheduleSlots().reduce((groups, slot) => {
    const label = formatDate(slot.date);
    groups[label] = groups[label] || [];
    groups[label].push(slot);
    return groups;
  }, {});

  return Object.entries(groupedSlots).map(([label, slots]) => `
    <optgroup label="${escapeHtml(label)}">
      ${slots.map((slot) => {
        const disabled = slot.id !== selectedValue && selectedChoices.has(slot.id) ? 'disabled' : '';
        const selected = slot.id === selectedValue ? 'selected' : '';
        return `<option value="${slot.id}" ${selected} ${disabled}>${slot.time}〜</option>`;
      }).join('')}
    </optgroup>
  `).join('');
}

function choiceField(name, label) {
  return `
    <label class="choice-field" for="${name}">
      <span>${label} <strong>必須</strong></span>
      <select id="${name}" name="${name}" required aria-required="true">
        <option value="">選択してください</option>
        ${groupedSlotOptions()}
      </select>
    </label>
  `;
}

function saveReservation(reservation) {
  state.reservations = [reservation, ...state.reservations.filter((item) => item.id !== reservation.id)];
  writeStorage(STORAGE_KEY, state.reservations);
}

function buildAdminRecord(reservation) {
  return {
    id: reservation.id,
    送信日時: formatDateTime(reservation.submittedAt),
    お名前: reservation.name,
    電話番号: reservation.phone,
    メールアドレス: reservation.email,
    第1希望日時: formatChoice(reservation.firstChoice),
    第2希望日時: formatChoice(reservation.secondChoice),
    第3希望日時: formatChoice(reservation.thirdChoice),
    連絡事項: reservation.message || 'なし',
  };
}

function buildFormspreePayload(reservation) {
  const record = buildAdminRecord(reservation);

  return {
    _subject: '【friends】無料体験予約リクエストが届きました',
    _replyto: reservation.email,
    送信日時: record.送信日時,
    お名前: reservation.name,
    電話番号: reservation.phone,
    メールアドレス: reservation.email,
    第1希望日時: record.第1希望日時,
    第2希望日時: record.第2希望日時,
    第3希望日時: record.第3希望日時,
    連絡事項: reservation.message || '',
    フォーム種別: 'friends 無料体験予約リクエスト',
    管理者確認メモ: 'この送信は予約確定ではありません。希望日時を確認し、管理者から予約確定メールを返信してください。',
  };
}

async function postToFormspree(reservation) {
  if (!FORM_ENDPOINT) {
    throw new Error('FORM_ENDPOINT is not configured');
  }

  const response = await fetch(FORM_ENDPOINT, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(buildFormspreePayload(reservation)),
  });

  if (!response.ok) {
    throw new Error('Formspree request failed');
  }
}

function appShell(content) {
  const isAdmin = window.location.pathname.endsWith(ADMIN_PATH);
  const adminNav = isAdmin
    ? '<nav class="top-nav" aria-label="ページ移動"><button class="nav-button" data-page="reserve">予約フォームに戻る</button></nav>'
    : '';

  return `
    <div class="app-shell">
      <header class="hero">
        ${adminNav}
        <div class="hero-copy">
          <p class="hero-kicker">1分で簡単予約</p>
          <p class="brand-label">${BRAND_NAME}</p>
          <h1>無料体験予約</h1>
          <p class="hero-lead">運動が続かなかった方へ。初心者でも安心して参加できるセミパーソナルジムの無料体験です。</p>
          <p class="hero-note">このフォームは予約確定ではなく、無料体験の希望日時を送る予約リクエストフォームです。</p>
        </div>
      </header>
      <main>${content}</main>
    </div>
  `;
}

function reservationPage() {
  return `
    <section class="panel reservation-panel" aria-labelledby="reservation-title">
      <div class="section-heading">
        <span>Request form</span>
        <h2 id="reservation-title">friends 無料体験の希望日時を送る</h2>
        <p>第1〜第3希望まで入力してください。確認後、メールで予約確定のご連絡をお送りします。</p>
      </div>
      <form class="form-grid" id="reservation-form" action="${escapeHtml(FORM_ENDPOINT)}" method="post" novalidate>
        <label>お名前 <strong>必須</strong>
          <input autocomplete="name" name="name" required placeholder="例：山田 花子" />
        </label>
        <label>電話番号 <strong>必須</strong>
          <input autocomplete="tel" inputmode="tel" name="phone" required placeholder="例：090-1234-5678" />
        </label>
        <label class="email-field">メールアドレス <strong>必須</strong>
          <input autocomplete="email" inputmode="email" name="email" required type="email" placeholder="hello@example.com" />
        </label>
        <div class="choice-stack" aria-label="希望日時">
          ${choiceField('firstChoice', '第1希望日時')}
          ${choiceField('secondChoice', '第2希望日時')}
          ${choiceField('thirdChoice', '第3希望日時')}
        </div>
        <label class="message-field">連絡事項 <span class="optional">任意</span>
          <textarea name="message" rows="4" placeholder="事前に伝えたいことがあれば入力してください。"></textarea>
        </label>
        <p class="form-status" id="form-status" role="status" aria-live="polite"></p>
        <button class="primary-button" type="submit">予約リクエストを送信する</button>
      </form>
    </section>
  `;
}

function completePage() {
  const reservation = state.lastReservation;
  if (!reservation) return reservationPage();

  return `
    <section class="panel complete-card" aria-labelledby="complete-title">
      <div class="complete-icon" aria-hidden="true">✓</div>
      <h2 id="complete-title">無料体験の予約リクエストを受け付けました。</h2>
      <p>確認後、入力いただいたメールアドレス宛に予約確定のご連絡をお送りします。</p>
      <dl class="summary-list">
        <div><dt>第1希望日時</dt><dd>${escapeHtml(formatChoice(reservation.firstChoice))}</dd></div>
        <div><dt>第2希望日時</dt><dd>${escapeHtml(formatChoice(reservation.secondChoice))}</dd></div>
        <div><dt>第3希望日時</dt><dd>${escapeHtml(formatChoice(reservation.thirdChoice))}</dd></div>
      </dl>
    </section>
  `;
}

function adminPage() {
  const rows = state.reservations.map((reservation) => {
    const record = buildAdminRecord(reservation);
    return `
      <article class="admin-card">
        <div><span>送信日時</span><strong>${escapeHtml(record.送信日時)}</strong></div>
        <div><span>お名前</span><strong>${escapeHtml(record.お名前)}</strong></div>
        <div><span>電話番号</span><strong>${escapeHtml(record.電話番号)}</strong></div>
        <div><span>メールアドレス</span><strong><a href="mailto:${escapeHtml(record.メールアドレス)}">${escapeHtml(record.メールアドレス)}</a></strong></div>
        <div><span>第1希望日時</span><strong>${escapeHtml(record.第1希望日時)}</strong></div>
        <div><span>第2希望日時</span><strong>${escapeHtml(record.第2希望日時)}</strong></div>
        <div><span>第3希望日時</span><strong>${escapeHtml(record.第3希望日時)}</strong></div>
        <div class="admin-note"><span>連絡事項</span><p>${escapeHtml(record.連絡事項)}</p></div>
      </article>
    `;
  }).join('');

  return `
    <section class="panel admin-panel" aria-labelledby="admin-title">
      <div class="section-heading">
        <span>Admin preview</span>
        <h2 id="admin-title">簡易予約一覧</h2>
        <p>この画面は同じブラウザのlocalStorageに保存された予約リクエストの簡易確認用です。別端末とは共有されません。本番の確認・保存場所はFormspree管理画面の投稿履歴と通知メールです。</p>
      </div>
      <div class="admin-notice">
        <strong>本番確認はFormspree管理画面で行ってください。</strong>
        <span>送信先URL: ${escapeHtml(FORM_ENDPOINT)}</span>
      </div>
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr><th>送信日時</th><th>名前</th><th>電話番号</th><th>メール</th><th>第1希望</th><th>第2希望</th><th>第3希望</th><th>連絡事項</th></tr>
          </thead>
          <tbody>
            ${state.reservations.map((reservation) => {
              const record = buildAdminRecord(reservation);
              return `<tr><td>${escapeHtml(record.送信日時)}</td><td>${escapeHtml(record.お名前)}</td><td>${escapeHtml(record.電話番号)}</td><td><a href="mailto:${escapeHtml(record.メールアドレス)}">${escapeHtml(record.メールアドレス)}</a></td><td>${escapeHtml(record.第1希望日時)}</td><td>${escapeHtml(record.第2希望日時)}</td><td>${escapeHtml(record.第3希望日時)}</td><td>${escapeHtml(record.連絡事項)}</td></tr>`;
            }).join('') || '<tr><td colspan="8">このブラウザにはまだ保存された予約リクエストがありません。</td></tr>'}
          </tbody>
        </table>
      </div>
      <div class="admin-list">
        ${rows || '<p class="empty-admin">まだ保存された予約リクエストはありません。</p>'}
      </div>
      <div class="action-row">
        <button class="ghost-button" data-page="reserve">予約フォームに戻る</button>
      </div>
    </section>
  `;
}

function render() {
  const root = document.getElementById('root');
  const isAdmin = window.location.pathname.endsWith(ADMIN_PATH);
  const page = isAdmin ? 'admin' : window.location.hash.replace('#', '') || 'reserve';
  const content = page === 'complete' ? completePage() : page === 'admin' ? adminPage() : reservationPage();
  root.innerHTML = appShell(content);
  bindEvents();
}

function refreshChoiceOptions(form) {
  const selects = ['firstChoice', 'secondChoice', 'thirdChoice'].map((name) => form.elements[name]);
  const selectedValues = Object.fromEntries(selects.map((select) => [select.name, select.value]));
  const selectedChoices = getSelectedChoices(form);

  selects.forEach((select) => {
    select.innerHTML = `<option value="">選択してください</option>${groupedSlotOptions(selectedValues[select.name], selectedChoices)}`;
    select.value = selectedValues[select.name];
  });
}

async function handleSubmit(form) {
  const status = document.getElementById('form-status');
  const submitButton = form.querySelector('button[type="submit"]');
  const formData = new FormData(form);
  const firstChoice = findSlot(formData.get('firstChoice'));
  const secondChoice = findSlot(formData.get('secondChoice'));
  const thirdChoice = findSlot(formData.get('thirdChoice'));

  if (!form.reportValidity() || !firstChoice || !secondChoice || !thirdChoice) {
    status.textContent = '必須項目をすべて入力してください。';
    return;
  }

  const selectedIds = new Set([firstChoice.id, secondChoice.id, thirdChoice.id]);
  if (selectedIds.size !== 3) {
    status.textContent = '第1〜第3希望は、それぞれ別の日時を選択してください。';
    return;
  }

  const reservation = {
    id: createId(),
    submittedAt: new Date().toISOString(),
    name: formData.get('name').trim(),
    phone: formData.get('phone').trim(),
    email: formData.get('email').trim(),
    firstChoice,
    secondChoice,
    thirdChoice,
    message: formData.get('message').trim(),
  };

  submitButton.disabled = true;
  submitButton.textContent = '送信中です…';
  status.classList.remove('error');
  status.textContent = '送信中です。しばらくお待ちください。';

  try {
    await postToFormspree(reservation);
    saveReservation(reservation);
    state.lastReservation = reservation;
    navigate('complete');
  } catch {
    status.classList.add('error');
    status.textContent = '送信に失敗しました。時間をおいて再度お試しください。';
    submitButton.disabled = false;
    submitButton.textContent = '予約リクエストを送信する';
  }
}

function navigate(page) {
  if (page === 'reserve' && window.location.pathname.endsWith(ADMIN_PATH)) {
    window.location.href = 'index.html';
    return;
  }

  window.location.hash = page === 'reserve' ? '' : page;
  render();
}

function bindEvents() {
  document.querySelectorAll('[data-page]').forEach((button) => {
    button.addEventListener('click', () => navigate(button.dataset.page));
  });

  const form = document.getElementById('reservation-form');
  if (!form) return;

  ['firstChoice', 'secondChoice', 'thirdChoice'].forEach((name) => {
    form.elements[name].addEventListener('change', () => refreshChoiceOptions(form));
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    handleSubmit(form);
  });
}

window.addEventListener('hashchange', render);
render();
