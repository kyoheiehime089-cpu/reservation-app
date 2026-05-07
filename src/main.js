const STORAGE_KEYS = {
  slots: 'reservation-app-slots',
  reservations: 'reservation-app-reservations',
};

const DEFAULT_SLOTS = [
  { id: 'slot-1', date: '2026-05-09', time: '10:00', store: 'blossom yoga', capacity: 3 },
  { id: 'slot-2', date: '2026-05-09', time: '14:00', store: 'friends', capacity: 2 },
  { id: 'slot-3', date: '2026-05-10', time: '11:00', store: 'blossom yoga', capacity: 3 },
  { id: 'slot-4', date: '2026-05-10', time: '15:30', store: 'friends', capacity: 2 },
];

const INITIAL_FORM = {
  slotId: '',
  name: '',
  phone: '',
  email: '',
  store: '',
  program: '',
  note: '',
};

const state = {
  page: window.location.hash.replace('#', '') || 'reserve',
  slots: readStorage(STORAGE_KEYS.slots, DEFAULT_SLOTS),
  reservations: readStorage(STORAGE_KEYS.reservations, []),
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

function formatDate(dateString) {
  return new Intl.DateTimeFormat('ja-JP', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }).format(new Date(`${dateString}T00:00:00`));
}

function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function bookedCounts() {
  return state.reservations.reduce((counts, reservation) => {
    counts[reservation.slotId] = (counts[reservation.slotId] || 0) + 1;
    return counts;
  }, {});
}

function availableSlots() {
  const counts = bookedCounts();
  return state.slots
    .filter((slot) => (counts[slot.id] || 0) < Number(slot.capacity))
    .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
}

function navigate(page) {
  state.page = page;
  window.location.hash = page === 'reserve' ? '' : page;
  render();
}

function saveSlots(slots) {
  state.slots = slots;
  writeStorage(STORAGE_KEYS.slots, slots);
  render();
}

function saveReservations(reservations) {
  state.reservations = reservations;
  writeStorage(STORAGE_KEYS.reservations, reservations);
}

function addReservation(form) {
  const slot = state.slots.find((item) => item.id === form.slotId);
  if (!slot) return;

  const reservation = {
    id: createId('reservation'),
    createdAt: new Date().toISOString(),
    slotId: slot.id,
    slotDate: slot.date,
    slotTime: slot.time,
    slotStore: slot.store,
    name: form.name.trim(),
    phone: form.phone.trim(),
    email: form.email.trim(),
    store: form.store,
    program: form.program,
    note: form.note.trim(),
  };

  saveReservations([reservation, ...state.reservations]);
  state.lastReservation = reservation;
  navigate('complete');
}

function addSlot(slot) {
  saveSlots([...state.slots, { ...slot, id: createId('slot') }]);
}

function deleteSlot(slotId) {
  const hasReservations = state.reservations.some((reservation) => reservation.slotId === slotId);
  if (hasReservations) {
    alert('予約が入っている枠は削除できません。予約一覧を確認してください。');
    return;
  }
  saveSlots(state.slots.filter((slot) => slot.id !== slotId));
}

function appShell(content) {
  return `
    <div class="app-shell">
      <header class="hero">
        <p class="eyebrow">無料体験予約</p>
        <h1>blossom yoga / friends</h1>
        <p>
          初めての方でも迷わず入力できる、シンプルな体験予約フォームです。
          管理画面では予約一覧と予約枠を確認できます。
        </p>
        <nav class="nav-tabs" aria-label="ページ切り替え">
          <button class="${state.page === 'reserve' ? 'active' : ''}" data-page="reserve">予約する</button>
          <button class="${state.page === 'admin' ? 'active' : ''}" data-page="admin">管理画面</button>
        </nav>
      </header>
      <main>${content}</main>
    </div>
  `;
}

function reservationPage() {
  const slots = availableSlots();
  const slotOptions = slots
    .map((slot) => `<option value="${slot.id}">${formatDate(slot.date)} ${slot.time} / ${escapeHtml(slot.store)}</option>`)
    .join('');

  return `
    <section class="card">
      <div class="section-heading">
        <span>STEP 1</span>
        <h2>体験予約を入力</h2>
        <p>予約可能日時を選び、お客様情報を入力してください。</p>
      </div>
      <form class="form-grid" id="reservation-form">
        <label>予約可能日時 <strong>必須</strong>
          <select name="slotId" required>
            <option value="">日時を選択してください</option>
            ${slotOptions}
          </select>
        </label>
        <div class="selected-slot" id="selected-slot" hidden></div>
        <label>お名前 <strong>必須</strong>
          <input name="name" required placeholder="例：山田 花子" />
        </label>
        <label>電話番号 <strong>必須</strong>
          <input name="phone" inputmode="tel" required placeholder="例：090-1234-5678" />
        </label>
        <label>メールアドレス <strong>必須</strong>
          <input name="email" inputmode="email" required type="email" placeholder="例：hello@example.com" />
        </label>
        <label>希望店舗 <strong>必須</strong>
          <select name="store" required>
            <option value="">店舗を選択してください</option>
            <option value="blossom yoga">blossom yoga</option>
            <option value="friends">friends</option>
          </select>
        </label>
        <label>希望内容 <strong>必須</strong>
          <select name="program" required>
            <option value="">内容を選択してください</option>
            <option value="ヨガ無料体験">ヨガ無料体験</option>
            <option value="パーソナル相談">パーソナル相談</option>
            <option value="施設見学">施設見学</option>
          </select>
        </label>
        <label>連絡事項
          <textarea name="note" rows="4" placeholder="不安なことや事前に伝えたいことがあれば入力してください"></textarea>
        </label>
        <button class="primary-button" type="submit" ${slots.length === 0 ? 'disabled' : ''}>予約を確定する</button>
      </form>
    </section>
  `;
}

function completePage() {
  const reservation = state.lastReservation;
  const summary = reservation
    ? `<dl class="summary-list">
        <div><dt>日時</dt><dd>${formatDate(reservation.slotDate)} ${reservation.slotTime}</dd></div>
        <div><dt>店舗</dt><dd>${escapeHtml(reservation.store)}</dd></div>
        <div><dt>内容</dt><dd>${escapeHtml(reservation.program)}</dd></div>
      </dl>`
    : '';

  return `
    <section class="card complete-card">
      <div class="complete-icon" aria-hidden="true">✓</div>
      <h2>予約を受け付けました</h2>
      <p>ご入力ありがとうございます。担当者より必要に応じてご連絡します。</p>
      ${summary}
      <button class="primary-button" data-page="reserve">続けて予約する</button>
    </section>
  `;
}

function adminPage() {
  const counts = bookedCounts();
  const slotItems = state.slots.length === 0
    ? '<p class="empty-text">予約枠がありません。</p>'
    : state.slots.map((slot) => `
      <article class="list-item">
        <div>
          <strong>${formatDate(slot.date)} ${slot.time}</strong>
          <p>${escapeHtml(slot.store)} / ${counts[slot.id] || 0}名予約済み / 定員${slot.capacity}名</p>
        </div>
        <button class="ghost-button" data-delete-slot="${slot.id}">削除</button>
      </article>
    `).join('');

  const reservationItems = state.reservations.length === 0
    ? '<p class="empty-text">まだ予約はありません。</p>'
    : state.reservations.map((reservation) => `
      <article class="reservation-item">
        <div class="reservation-title">
          <strong>${escapeHtml(reservation.name)}</strong>
          <span>${formatDate(reservation.slotDate)} ${reservation.slotTime}</span>
        </div>
        <dl>
          <div><dt>電話</dt><dd>${escapeHtml(reservation.phone)}</dd></div>
          <div><dt>メール</dt><dd>${escapeHtml(reservation.email)}</dd></div>
          <div><dt>店舗</dt><dd>${escapeHtml(reservation.store)}</dd></div>
          <div><dt>内容</dt><dd>${escapeHtml(reservation.program)}</dd></div>
          ${reservation.note ? `<div><dt>連絡事項</dt><dd>${escapeHtml(reservation.note)}</dd></div>` : ''}
        </dl>
      </article>
    `).join('');

  return `
    <div class="admin-layout">
      <section class="card">
        <div class="section-heading">
          <span>ADMIN</span>
          <h2>予約枠を追加</h2>
          <p>ログインなしの簡単版です。公開前に必要に応じて認証を追加してください。</p>
        </div>
        <form class="slot-form" id="slot-form">
          <label>日付<input name="date" type="date" required /></label>
          <label>時間<input name="time" type="time" required /></label>
          <label>店舗
            <select name="store" required>
              <option value="blossom yoga">blossom yoga</option>
              <option value="friends">friends</option>
            </select>
          </label>
          <label>定員<input min="1" name="capacity" type="number" value="2" required /></label>
          <button class="primary-button" type="submit">予約枠を追加</button>
        </form>
      </section>
      <section class="card">
        <div class="section-heading"><span>SLOTS</span><h2>予約枠一覧</h2></div>
        <div class="list-stack">${slotItems}</div>
      </section>
      <section class="card wide-card">
        <div class="section-heading"><span>RESERVATIONS</span><h2>予約一覧</h2></div>
        <div class="list-stack">${reservationItems}</div>
      </section>
    </div>
  `;
}

function render() {
  const root = document.getElementById('root');
  const content = state.page === 'complete' ? completePage() : state.page === 'admin' ? adminPage() : reservationPage();
  root.innerHTML = appShell(content);
  bindEvents();
}

function bindEvents() {
  document.querySelectorAll('[data-page]').forEach((button) => {
    button.addEventListener('click', () => navigate(button.dataset.page));
  });

  const reservationForm = document.getElementById('reservation-form');
  if (reservationForm) {
    const slotSelect = reservationForm.elements.slotId;
    const selectedSlotBox = document.getElementById('selected-slot');
    slotSelect.addEventListener('change', () => {
      const slot = availableSlots().find((item) => item.id === slotSelect.value);
      selectedSlotBox.hidden = !slot;
      selectedSlotBox.innerHTML = slot
        ? `<span>選択中</span><strong>${formatDate(slot.date)} ${slot.time}</strong><small>${escapeHtml(slot.store)} の体験枠です</small>`
        : '';
    });

    reservationForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const formData = new FormData(reservationForm);
      const form = { ...INITIAL_FORM, ...Object.fromEntries(formData.entries()) };
      if (!form.slotId || !form.name || !form.phone || !form.email || !form.store || !form.program) {
        alert('必須項目をすべて入力してください。');
        return;
      }
      addReservation(form);
    });
  }

  const slotForm = document.getElementById('slot-form');
  if (slotForm) {
    slotForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const form = Object.fromEntries(new FormData(slotForm).entries());
      if (!form.date || !form.time || !form.store || !form.capacity) {
        alert('予約枠の情報を入力してください。');
        return;
      }
      addSlot({ ...form, capacity: Number(form.capacity) });
      slotForm.reset();
      slotForm.elements.capacity.value = 2;
    });
  }

  document.querySelectorAll('[data-delete-slot]').forEach((button) => {
    button.addEventListener('click', () => deleteSlot(button.dataset.deleteSlot));
  });
}

window.addEventListener('hashchange', () => {
  state.page = window.location.hash.replace('#', '') || 'reserve';
  render();
});

render();
