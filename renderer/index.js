// index.js
// The dashboard. Handles all the API calls and figures out what to suggest
// to the user based on the prayer times.

const $ = id => document.getElementById(id);

const PRAYERS = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

// keeps the latest data around so different functions can share it
// (place = where, times = prayer times, weather = current conditions, suggestion = what we recommend)
let state = {};

// small wrapper so I don't repeat the fetch boilerplate every time
async function getJSON(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error('HTTP ' + res.status);
  }
  return res.json();
}

// ============ SEARCH FORM ============
$('searchForm').addEventListener('submit', async e => {
  e.preventDefault();

  const city = $('city').value.trim();

  // quick validation before we bother hitting the API
  if (city.length < 2) {
    return showMsg('Please enter a valid city name (min 2 characters).', 'error');
  }

  await loadAll(city, $('method').value);
});

async function loadAll(city, method) {
  showMsg('Loading data...', 'info');
  $('searchBtn').disabled = true;

  try {
    // 1. turn the city name into coordinates + timezone
    const geo = await getJSON(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`
    );

    if (!geo.results || geo.results.length === 0) {
      // no match - hide the old results so the user doesn't get confused
      $('results').style.display = 'none';
      return showMsg(`No location found for "${city}". Try another city name.`, 'error');
    }

    const p = geo.results[0];
    state.place = {
      name: p.name,
      country: p.country,
      lat: p.latitude,
      lon: p.longitude,
      tz: p.timezone
    };

    // remember the last search so we can restore it next time
    localStorage.setItem('solat_lastCity', city);
    localStorage.setItem('solat_lastMethod', method);

    // grab the rest in parallel - if one fails I still want the others
    const [t, w, q, a] = await Promise.allSettled([
      getTimings(method),
      getWeather(),
      getQibla(),
      loadAyah()
    ]);

    $('results').style.display = 'block';

    const failed = [t, w, q, a].filter(r => r.status === 'rejected').length;

    // prayer times are the core feature, so if that failed it's game over
    if (t.status === 'rejected') {
      return showMsg('Could not retrieve prayer times. Check your internet connection.', 'error');
    }

    updateSuggestion();

    if (failed) {
      showMsg(`Loaded with ${failed} section(s) unavailable.`, 'info');
    } else {
      showMsg('Data loaded successfully.', 'success');
    }
  } catch (err) {
    showMsg('Request failed: ' + err.message + '. Please check your connection and try again.', 'error');
  } finally {
    $('searchBtn').disabled = false;
  }
}

// ============ PRAYER TIMES (aladhan.com) ============
async function getTimings(method) {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dateStr = `${dd}-${mm}-${d.getFullYear()}`;

  const { lat, lon, tz } = state.place;

  const j = await getJSON(
    `https://api.aladhan.com/v1/timings/${dateStr}?latitude=${lat}&longitude=${lon}&method=${method}&timezonestring=${encodeURIComponent(tz)}`
  );

  // aladhan gives us something like "05:12 (MYT)" - I just want the HH:MM
  state.times = {};
  PRAYERS.forEach(n => {
    state.times[n] = j.data.timings[n].slice(0, 5);
  });

  const h = j.data.date.hijri;
  $('place').innerHTML = icon('pin') + esc(`${state.place.name}, ${state.place.country} (${tz})`);
  $('hijri').textContent = `Hijri: ${h.day} ${h.month.en} ${h.year} AH  |  ${j.data.date.readable}`;

  renderTimes();
  renderCalc();
}

// ============ WEATHER (open-meteo) ============
async function getWeather() {
  const { lat, lon } = state.place;

  const j = await getJSON(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,wind_speed_10m&timezone=auto`
  );

  const c = j.current;
  const code = c.weather_code;

  // the API sends WMO weather codes which are a bit much, so I lump them into
  // 4 buckets: clear / cloudy / rain / storm
  let cond = 'clear';
  if (code >= 95) cond = 'storm';
  else if (code >= 51 && code <= 82) cond = 'rain';
  else if (code >= 1 && code <= 48) cond = 'cloudy';

  state.weather = { temp: c.temperature_2m, cond: cond, wind: c.wind_speed_10m };

  const iconMap = { clear: 'sun', cloudy: 'cloud', rain: 'rain', storm: 'storm' };
  const wIcon = icon(iconMap[cond]);

  $('weather').innerHTML = `
    <div class="big">${wIcon}${c.temperature_2m}°C</div>
    <p>Condition: <b>${cond}</b><br>Wind: ${c.wind_speed_10m} km/h</p>
  `;
}

// ============ QIBLA DIRECTION ============
async function getQibla() {
  const { lat, lon } = state.place;
  const j = await getJSON(`https://api.aladhan.com/v1/qibla/${lat}/${lon}`);
  const deg = j.data.direction;

  $('qibla').innerHTML = `
    <img class="ico arrow-img" src="icons/arrow-up.svg" alt="Qibla arrow" style="transform:rotate(${deg}deg)"><br>
    <p>Qibla direction: <b>${deg.toFixed(2)}°</b> from True North</p>
  `;
}

// ============ RANDOM AYAH ============
async function loadAyah() {
  // there are 6236 ayahs in the Quran
  const n = Math.floor(Math.random() * 6236) + 1;

  const j = await getJSON(`https://api.alquran.cloud/v1/ayah/${n}/editions/quran-uthmani,en.asad`);
  const ar = j.data[0];   // arabic (uthmani script)
  const en = j.data[1];   // english translation (asad)

  $('ayah').innerHTML = `
    <p class="arabic">${esc(ar.text)}</p>
    <p>${esc(en.text)}</p>
    <span class="tag">${esc(en.surah.englishName)} : ${en.numberInSurah}</span>
  `;
}

// button to load a fresh verse
$('newAyahBtn').addEventListener('click', () => {
  loadAyah().catch(() => showMsg('Could not load a new verse.', 'error'));
});

// ============ TIME HELPERS ============

// current time (in minutes) at the *selected* location, not the user's machine
// (important because the user might be checking times for a city abroad)
function nowMinutes() {
  const s = new Date().toLocaleTimeString('en-GB', {
    timeZone: state.place.tz,
    hour12: false,
    hour: '2-digit',
    minute: '2-digit'
  });
  return toMin(s);
}

// figures out the next prayer - skips Sunrise because it's not an obligatory prayer
function nextPrayer(now) {
  const list = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

  for (const n of list) {
    if (toMin(state.times[n]) > now) {
      return { name: n, mins: toMin(state.times[n]) - now };
    }
  }

  // nothing left today, so the next one is Fajr tomorrow
  return { name: 'Fajr (tomorrow)', mins: 1440 - now + toMin(state.times.Fajr) };
}

// builds the times table + highlights whichever prayer is next
function renderTimes() {
  const next = nextPrayer(nowMinutes()).name.split(' ')[0];

  $('timesTable').innerHTML = PRAYERS.map(n => {
    const isNext = (n === next);
    return `<tr class="${isNext ? 'next' : ''}">
      <td>${n}</td>
      <td>${state.times[n]}</td>
      <td>${isNext ? icon('clock') + 'Next' : ''}</td>
    </tr>`;
  }).join('');
}

// ============ CALCULATIONS ============
function renderCalc() {
  const T = state.times;
  const now = nowMinutes();
  const nx = nextPrayer(now);

  // 1. how long the fast is (Fajr -> Maghrib)
  const fast = toMin(T.Maghrib) - toMin(T.Fajr);

  // 2. how long the night is (Maghrib -> Fajr next day)
  const night = (1440 - toMin(T.Maghrib)) + toMin(T.Fajr);

  // 3. last third of the night starts (good time for tahajjud)
  // formula: fajr minus a third of the night length
  let third = toMin(T.Fajr) - Math.round(night / 3);
  if (third < 0) third += 1440;   // might wrap around midnight

  const hh = String(Math.floor(third / 60)).padStart(2, '0');
  const mm = String(third % 60).padStart(2, '0');

  $('calc').innerHTML = `
    <p>${icon('hourglass')}Time until <b>${nx.name}</b>: <b>${fmtDur(nx.mins)}</b></p>
    <p>${icon('moon')}Fasting duration (Fajr to Maghrib): <b>${fmtDur(fast)}</b></p>
    <p>${icon('star')}Last third of the night begins: <b>${hh}:${mm}</b> (Tahajjud time)</p>
    <p class="small">Night length: ${fmtDur(night)}</p>
  `;
}

// ============ SUGGESTION LOGIC ============
// This is the fun bit. Given the current time + prayer times + weather,
// figure out what the user should be doing right now.
function suggest(now, T, weather, isFriday) {
  const fajr    = toMin(T.Fajr);
  const sunrise = toMin(T.Sunrise);
  const dhuhr   = toMin(T.Dhuhr);
  const asr     = toMin(T.Asr);
  const maghrib = toMin(T.Maghrib);
  const isha    = toMin(T.Isha);

  let text = '';
  let tag = '';
  let wi = '';   // weather icon (if we add weather advice)

  if (now < fajr) {
    text = 'Pre-dawn: perform Tahajjud / Qiyamullail and make du\'a. Prepare for Subuh.';
    tag = 'Tahajjud';
  } else if (now < sunrise) {
    text = 'Fajr time: perform Solat Subuh, then morning adhkar and Quran recitation.';
    tag = 'Fajr';
  } else if (now < sunrise + 15) {
    text = 'Sun is rising: avoid praying now. Do dhikr and wait about 15 minutes for Solat Dhuha.';
    tag = 'Dhikr';
  } else if (now < dhuhr - 10) {
    text = 'Good time for Solat Dhuha (2-8 rakaat) and giving sadaqah.';
    tag = 'Dhuha';
  } else if (now < dhuhr + 30) {
    if (isFriday) {
      text = 'Friday: take ghusl, wear your best clothes, recite Surah Al-Kahf and go to Jumu\'ah prayer.';
      tag = 'Jumuah';
    } else {
      text = 'Dhuhr time: perform Solat Zohor with the sunnah rawatib prayers.';
      tag = 'Dhuhr';
    }
  } else if (now < asr) {
    text = 'Afternoon: read Quran, study knowledge, and prepare for Asr.';
    tag = 'Quran';
  } else if (now < maghrib - 30) {
    text = 'Asr time: perform Solat Asar, then evening adhkar.';
    tag = 'Asr';
  } else if (now < maghrib) {
    text = 'Almost Maghrib: this is a time when du\'a is accepted. Make du\'a and prepare to break fast if fasting.';
    tag = 'Dua';
  } else if (now < isha) {
    text = 'Maghrib time: perform Solat Maghrib with ba\'diah, then prepare for Isha.';
    tag = 'Maghrib';
  } else {
    text = 'Isha time: perform Solat Isyak and Witir. Recite Ayatul Kursi before sleeping.';
    tag = 'Isha';
  }

  // bonus: tweak the advice based on weather
  switch (weather ? weather.cond : 'unknown') {
    case 'rain':
      text += ' It is raining: bring an umbrella if going to the mosque, or pray at home.';
      wi = 'umbrella';
      break;
    case 'storm':
      text += ' Thunderstorm: stay safe indoors and pray at home.';
      wi = 'warning';
      break;
    case 'clear':
      if (weather.temp >= 33) {
        text += ' It is hot: stay hydrated and walk in the shade.';
        wi = 'water';
      }
      break;
    default:
      break;
  }

  if (!text) {
    // shouldn't happen, but just in case
    return { text: 'No suitable suggestion is available right now.', tag: 'None', icon: '' };
  }

  return { text, tag, icon: wi };
}

function updateSuggestion() {
  const now = nowMinutes();
  const dayName = new Date().toLocaleDateString('en-US', {
    timeZone: state.place.tz,
    weekday: 'long'
  });

  const s = suggest(now, state.times, state.weather, dayName === 'Friday');
  state.suggestion = s;

  $('suggestion').innerHTML = `
    <span class="tag">${s.tag}</span>
    <p>${s.icon ? icon(s.icon) : ''}${esc(s.text)}</p>
  `;

  // save into history - keep latest 20, and skip it if it's the same as last time
  const hist = store.get('solat_suggestions');
  if (!hist.length || hist[0].text !== s.text) {
    hist.unshift({
      id: Date.now(),
      time: new Date().toLocaleString(),
      city: state.place.name,
      tag: s.tag,
      text: s.text
    });
    store.set('solat_suggestions', hist.slice(0, 20));
  }
}

// ============ SAVE SUGGESTION AS REMINDER ============
$('saveSuggBtn').addEventListener('click', () => {
  if (!state.suggestion) {
    return showMsg('No suggestion to save yet.', 'error');
  }

  const list = store.get('solat_reminders');

  list.push({
    id: Date.now(),
    title: state.suggestion.tag + ' activity',
    prayer: state.suggestion.tag,
    time: new Date().toTimeString().slice(0, 5),
    note: state.suggestion.text,
    city: state.place.name
  });

  store.set('solat_reminders', list);
  showMsg('Suggestion added to My Reminders.', 'success');
});

// re-check the countdown every minute so it stays accurate
setInterval(() => {
  if (state.times) {
    renderTimes();
    renderCalc();
  }
}, 60000);

// on load, restore the last city/method the user searched
window.addEventListener('DOMContentLoaded', () => {
  const c = localStorage.getItem('solat_lastCity') || 'Kuala Lumpur';
  const m = localStorage.getItem('solat_lastMethod') || '17';

  $('city').value = c;
  $('method').value = m;

  loadAll(c, m);
});