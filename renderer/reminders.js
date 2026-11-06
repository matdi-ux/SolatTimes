// reminders.js
// All the CRUD for reminders. Data lives in localStorage under 'solat_reminders'.

const $ = id => document.getElementById(id);
const KEY = 'solat_reminders';

// ---------- READ ----------
function render() {
  const list = store.get(KEY);

  // sort by time so earliest comes first
  list.sort((a, b) => a.time.localeCompare(b.time));

  if (list.length) {
    $('list').innerHTML = list.map(r => `
      <div class="item">
        <div>
          <b>${esc(r.title)}</b>
          <span class="tag">${esc(r.prayer)}</span>
          ${icon('clock')}${r.time}
          <div class="small">
            ${esc(r.note || 'No note')}${r.city ? ' | ' + icon('pin') + esc(r.city) : ''}
          </div>
        </div>
        <div class="btns">
          <button data-edit="${r.id}">${icon('edit')}Edit</button>
          <button class="del" data-del="${r.id}">${icon('trash')}Delete</button>
        </div>
      </div>
    `).join('');
  } else {
    $('list').innerHTML = '<p class="small">No reminders yet. Add one above or from the Dashboard suggestion.</p>';
  }

  // also render the suggestion history below
  const h = store.get('solat_suggestions');
  if (h.length) {
    $('history').innerHTML = h.map(s => `
      <div class="item">
        <div>
          <span class="tag">${esc(s.tag)}</span>
          <span class="small"> ${esc(s.time)} - ${esc(s.city)}</span>
          <div>${esc(s.text)}</div>
        </div>
      </div>
    `).join('');
  } else {
    $('history').innerHTML = '<p class="small">No suggestions saved yet. Open the Dashboard first.</p>';
  }
}

// ---------- CREATE / UPDATE ----------
$('remForm').addEventListener('submit', e => {
  e.preventDefault();

  const title = $('title').value.trim();
  const time = $('time').value;
  const id = $('editId').value;   // empty string when creating

  // validation
  if (title.length < 3) {
    return showMsg('Title must be at least 3 characters.', 'error');
  }
  if (!time) {
    return showMsg('Please choose a time.', 'error');
  }

  const list = store.get(KEY);

  // don't allow two reminders with the same title AND time
  const duplicate = list.some(r =>
    r.title.toLowerCase() === title.toLowerCase() &&
    r.time === time &&
    String(r.id) !== id
  );
  if (duplicate) {
    return showMsg('A reminder with the same title and time already exists.', 'error');
  }

  const rec = {
    title: title,
    prayer: $('prayer').value,
    time: time,
    note: $('note').value.trim()
  };

  if (id) {
    // UPDATE - find the existing one and merge in the new fields
    const i = list.findIndex(r => String(r.id) === id);
    list[i] = { ...list[i], ...rec };
    showMsg('Reminder updated successfully.', 'success');
  } else {
    // CREATE
    list.push({ id: Date.now(), ...rec });
    showMsg('Reminder added successfully.', 'success');
  }

  store.set(KEY, list);
  resetForm();
  render();
});

// ---------- EDIT / DELETE (event delegation) ----------
$('list').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;

  const editId = b.dataset.edit;
  const delId = b.dataset.del;

  if (editId) {
    // fill the form with the existing record
    const r = store.get(KEY).find(x => String(x.id) === editId);

    $('editId').value = r.id;
    $('title').value = r.title;
    $('prayer').value = r.prayer;
    $('time').value = r.time;
    $('note').value = r.note;

    $('formTitle').textContent = 'Edit Reminder';
    $('saveBtn').innerHTML = icon('save') + 'Update Reminder';
    $('cancelBtn').style.display = 'inline-block';

    // scroll up so the user can see the form
    window.scrollTo(0, 0);
  }

  if (delId && confirm('Delete this reminder?')) {
    store.set(KEY, store.get(KEY).filter(x => String(x.id) !== delId));
    showMsg('Reminder deleted.', 'success');
    render();
  }
});

function resetForm() {
  $('remForm').reset();
  $('editId').value = '';
  $('formTitle').textContent = 'Add Activity Reminder';
  $('saveBtn').innerHTML = icon('save') + 'Save Reminder';
  $('cancelBtn').style.display = 'none';
}

$('cancelBtn').addEventListener('click', resetForm);

$('clearHist').addEventListener('click', () => {
  store.set('solat_suggestions', []);
  render();
  showMsg('History cleared.', 'success');
});

// kick it off
render();