// common.js
// Shared stuff used by both pages - local storage wrapper + the little message box
// (I put these here so I don't repeat them everywhere)

const store = {
  get(key) {
    // JSON.parse can throw if the value is garbage, so wrap it
    try {
      return JSON.parse(localStorage.getItem(key)) || [];
    } catch (e) {
      return [];
    }
  },
  set(key, v) {
    localStorage.setItem(key, JSON.stringify(v));
  }
};

// shows a coloured bar at the top of the page
// type can be 'info' | 'error' | 'success'
function showMsg(text, type = 'info') {
  const m = document.getElementById('msg');
  m.textContent = text;
  m.className = 'msg ' + type;
  // success messages fade away on their own after 3s
  if (type === 'success') {
    setTimeout(function () { m.className = 'msg'; }, 3000);
  }
}

// escape user text before putting it in innerHTML (stops HTML injection)
function esc(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

// "05:30" -> 330 (minutes since midnight), so I can do math on times
const toMin = t => {
  const parts = t.slice(0, 5).split(':');
  return Number(parts[0]) * 60 + Number(parts[1]);
};

// 90 -> "1 h 30 min"
const fmtDur = m => `${Math.floor(m / 60)} h ${Math.round(m % 60)} min`;