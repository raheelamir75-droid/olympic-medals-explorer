// ============ Olympic Medals Explorer - frontend ============
// Every chart asks the server (/api/...) for data. The server runs the SQL.

const COLORS = { Gold: '#b88600', Silver: '#5b86c4', Bronze: '#b5652a' };
const CMP = ['#3987e5', '#d95926']; // two-country comparison lines
const CARD = '#101730';             // card surface, used for the 2px gaps between bar segments
const INK = '#eef1f7', INK2 = '#b4bccb', MUTED = '#7d879b', GRID = 'rgba(255,255,255,0.06)';

// NOC code -> ISO country code (flag images are served locally from /flags)
const ISO = {
  AFG:'af', ALG:'dz', ARG:'ar', ARM:'am', AUS:'au', AUT:'at', AZE:'az', BAH:'bs', BAN:'bd', BEL:'be',
  BHU:'bt', BLR:'by', BRA:'br', BUL:'bg', CAN:'ca', CHI:'cl', CHN:'cn', CIV:'ci', CMR:'cm', COL:'co',
  CRO:'hr', CUB:'cu', CZE:'cz', DEN:'dk', DOM:'do', EGY:'eg', ESP:'es', EST:'ee', ETH:'et', FIN:'fi',
  FRA:'fr', GBR:'gb', GEO:'ge', GER:'de', GHA:'gh', GRE:'gr', HKG:'hk', HUN:'hu', INA:'id', IND:'in',
  IRI:'ir', IRL:'ie', ISL:'is', ISR:'il', ITA:'it', JAM:'jm', JPN:'jp', KAZ:'kz', KEN:'ke', KOR:'kr',
  LAT:'lv', LTU:'lt', MAR:'ma', MAS:'my', MDV:'mv', MEX:'mx', MGL:'mn', NED:'nl', NEP:'np', NGR:'ng',
  NOR:'no', NZL:'nz', PAK:'pk', PER:'pe', PHI:'ph', POL:'pl', POR:'pt', PRK:'kp', PUR:'pr', ROU:'ro',
  RSA:'za', RUS:'ru', SGP:'sg', SLO:'si', SRB:'rs', SRI:'lk', SUI:'ch', SVK:'sk', SWE:'se', THA:'th',
  TPE:'tw', TTO:'tt', TUN:'tn', TUR:'tr', UGA:'ug', UKR:'ua', URU:'uy', USA:'us', UZB:'uz', VEN:'ve',
  VIE:'vn', ZIM:'zw', KSA:'sa', QAT:'qa', UAE:'ae', IRQ:'iq', JOR:'jo', SYR:'sy', KUW:'kw', LIB:'lb',
};
const flagUrl = (noc) => (ISO[noc] ? `/flags/${ISO[noc]}.svg` : null);
function flagBadge(noc) {
  const url = flagUrl(noc, 80);
  return `<span class="flag-badge">${url ? `<img src="${url}" alt="" onerror="this.replaceWith('${noc}')">` : noc}</span>`;
}

// ---------- state ----------
const state = {
  from: 1896, to: 2016, season: 'All',
  medals: new Set(['Gold', 'Silver', 'Bronze']),
  noc: 'PAK', a: 'IND', b: 'PAK',
};
let countries = [];
const nameOf = (noc) => (countries.find((c) => c.noc === noc) || {}).country || noc;

const $ = (id) => document.getElementById(id);
const qs = (extra = {}) => new URLSearchParams({
  from: state.from, to: state.to, season: state.season,
  medals: [...state.medals].join(','), ...extra,
}).toString();

async function api(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || res.statusText);
  return res.json();
}
function toast(msg) {
  const t = $('toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast.timer); toast.timer = setTimeout(() => t.classList.remove('show'), 5000);
}

// ---------- number animation ----------
function countUp(el, target, dur = 1400) {
  const start = Number(el.dataset.v || 0);
  el.dataset.v = target;
  const t0 = performance.now();
  const step = (t) => {
    const p = Math.min((t - t0) / dur, 1);
    const eased = 1 - Math.pow(1 - p, 4);
    el.textContent = Math.round(start + (target - start) * eased).toLocaleString('en-US');
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// ---------- hero effects ----------
function buildFlagWall() {
  const codes = ['PAK','IND','USA','GBR','CHN','JPN','FRA','GER','ITA','BRA','CAN','AUS','KOR','RUS','ESP',
    'NED','SWE','KEN','JAM','TUR','EGY','BAN','SRI','NEP','AFG','NZL','ARG','NOR','HUN','CUB','ETH','MEX'];
  const rows = [codes.slice(0, 11), codes.slice(11, 22), codes.slice(22)];
  const cls = ['', 'rev', 'slow'];
  $('flagWall').innerHTML = rows.map((r, i) => {
    const list = [...r, ...r]; // doubled so the scroll loops without a gap
    return `<div class="flag-row ${cls[i]}">${list.map((c, j) =>
      `<div class="flag" style="animation-delay:${((j * 0.37) % 4).toFixed(2)}s">
         <img src="${flagUrl(c, 320)}" alt="" onerror="this.parentNode.remove()"></div>`).join('')}</div>`;
  }).join('');
}
function buildSparks() {
  const box = $('sparks');
  for (let i = 0; i < 28; i++) {
    const s = document.createElement('span');
    s.className = 'spark';
    s.style.left = Math.random() * 100 + '%';
    s.style.animationDuration = 7 + Math.random() * 9 + 's';
    s.style.animationDelay = -Math.random() * 14 + 's';
    s.style.setProperty('--dx', (Math.random() * 120 - 60).toFixed(0) + 'px');
    const size = 2 + Math.random() * 3;
    s.style.width = s.style.height = size + 'px';
    box.appendChild(s);
  }
}
function spotlight() {
  const hero = document.querySelector('.hero');
  hero.addEventListener('mousemove', (e) => {
    const r = hero.getBoundingClientRect();
    hero.style.setProperty('--mx', ((e.clientX - r.left) / r.width) * 100 + '%');
    hero.style.setProperty('--my', ((e.clientY - r.top) / r.height) * 100 + '%');
  });
}
function reveal() {
  const io = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }), { threshold: 0.12 });
  document.querySelectorAll('.reveal').forEach((el) => io.observe(el));
}

// ---------- Chart.js setup ----------
Chart.defaults.color = INK2;
Chart.defaults.font.family = "'Inter', 'Segoe UI', system-ui, sans-serif";
Chart.defaults.font.size = 12;
Chart.defaults.borderColor = GRID;
Chart.defaults.animation.duration = 900;
Chart.defaults.animation.easing = 'easeOutQuart';
Chart.defaults.plugins.legend.labels.usePointStyle = true;
Chart.defaults.plugins.legend.labels.pointStyle = 'circle';
Chart.defaults.plugins.legend.labels.boxWidth = 8;
Chart.defaults.plugins.legend.labels.color = INK2;
Object.assign(Chart.defaults.plugins.tooltip, {
  backgroundColor: 'rgba(8,12,24,0.95)', borderColor: 'rgba(242,201,76,0.35)', borderWidth: 1,
  titleColor: INK, bodyColor: INK2, footerColor: INK, padding: 12, cornerRadius: 10,
  usePointStyle: true, boxPadding: 4,
});

// Writes the total at the end of each horizontal stacked bar
const totalsPlugin = {
  id: 'totals',
  afterDatasetsDraw(chart, _args, opts) {
    if (!opts || !opts.enabled) return;
    const { ctx } = chart;
    const visible = chart.data.datasets.map((_, i) => i).filter((i) => chart.isDatasetVisible(i));
    if (!visible.length) return;
    ctx.save();
    ctx.font = "600 12px 'Inter', system-ui";
    ctx.fillStyle = INK;
    ctx.textBaseline = 'middle';
    chart.data.labels.forEach((_, idx) => {
      let total = 0, end = -Infinity, y = 0;
      visible.forEach((di) => {
        total += chart.data.datasets[di].data[idx] || 0;
        const el = chart.getDatasetMeta(di).data[idx];
        if (el && el.x > end) { end = el.x; y = el.y; }
      });
      if (total > 0) ctx.fillText(total.toLocaleString('en-US'), end + 8, y);
    });
    ctx.restore();
  },
};
// Writes the country code at the last point of each comparison line
const endLabelPlugin = {
  id: 'endLabels',
  afterDatasetsDraw(chart, _args, opts) {
    if (!opts || !opts.enabled) return;
    const { ctx } = chart;
    ctx.save();
    ctx.font = "700 12px 'Inter', system-ui";
    ctx.textBaseline = 'middle';
    chart.data.datasets.forEach((ds, i) => {
      if (!chart.isDatasetVisible(i)) return;
      const pts = chart.getDatasetMeta(i).data;
      const last = pts[pts.length - 1];
      if (!last) return;
      ctx.fillStyle = INK;
      ctx.fillText(ds.short, last.x + 8, last.y);
    });
    ctx.restore();
  },
};
Chart.register(totalsPlugin, endLabelPlugin);

const medalDatasets = (rows, horizontal) => ['Gold', 'Silver', 'Bronze']
  .filter((m) => state.medals.has(m))
  .map((m) => ({
    label: m,
    data: rows.map((r) => r[m.toLowerCase()]),
    backgroundColor: COLORS[m],
    borderColor: CARD,
    borderWidth: horizontal ? { right: 2 } : { top: 2 },
    borderSkipped: false,
    borderRadius: 3,
    maxBarThickness: horizontal ? 26 : 22,
  }));

const totalFooter = (items) => 'Total: ' + items.reduce((s, i) => s + i.parsed[i.chart.options.indexAxis === 'y' ? 'x' : 'y'], 0);

function hBarOptions(extra = {}) {
  return {
    indexAxis: 'y', responsive: true, maintainAspectRatio: false,
    layout: { padding: { right: 44 } },
    interaction: { mode: 'index', axis: 'y', intersect: false },
    scales: {
      x: { stacked: true, beginAtZero: true, grid: { color: GRID }, ticks: { precision: 0 }, border: { display: false } },
      y: { stacked: true, grid: { display: false }, ticks: { color: INK, font: { weight: 500 } }, border: { display: false } },
    },
    plugins: {
      legend: { position: 'top', align: 'end' },
      totals: { enabled: true },
      tooltip: { callbacks: { footer: totalFooter } },
    },
    ...extra,
  };
}

const charts = {};
function upsert(key, canvasId, config) {
  if (charts[key]) {
    charts[key].data = config.data;
    charts[key].options = config.options;
    charts[key].update();
  } else {
    charts[key] = new Chart($(canvasId), config);
  }
}

// ---------- sections ----------
async function loadSummary() {
  const s = await api('/api/summary');
  document.querySelectorAll('#heroStats .stat-num').forEach((el) => countUp(el, s[el.dataset.key] || 0, 2000));
}

async function loadCountries() {
  countries = await api('/api/countries');
  const medalists = countries.filter((c) => c.total > 0 || ['BAN', 'NEP', 'BHU', 'MDV'].includes(c.noc));
  const opts = medalists.map((c) => `<option value="${c.noc}">${c.country} (${c.noc})</option>`).join('');
  ['countrySelect', 'cmpA', 'cmpB'].forEach((id) => { $(id).innerHTML = opts; });
  $('countrySelect').value = state.noc; $('cmpA').value = state.a; $('cmpB').value = state.b;
}

function rangeNote() {
  const s = state.season === 'All' ? 'All Games' : `${state.season} Games`;
  return `${s}, ${state.from}–${state.to} · ${[...state.medals].join(', ')}`;
}

async function loadTop() {
  const rows = await api('/api/top?' + qs({ limit: 10 }));
  $('globalNote').textContent = rangeNote();
  upsert('top', 'topChart', {
    type: 'bar',
    data: { labels: rows.map((r) => `${r.country} (${r.noc})`), datasets: medalDatasets(rows, true) },
    options: hBarOptions(),
  });
}

async function loadSouthAsia() {
  const rows = await api('/api/south-asia?' + qs());
  const sum = rows.reduce((s, r) => s + r.total, 0) || 1;
  const cell = (v) => `<td class="num ${v ? '' : 'zero'}">${v}</td>`;
  $('saTable').querySelector('tbody').innerHTML = rows.map((r, i) => `
    <tr>
      <td class="rank">${r.total ? i + 1 : '–'}</td>
      <td><div class="ccell">${flagBadge(r.noc)}${r.country}</div></td>
      ${cell(r.gold)}${cell(r.silver)}${cell(r.bronze)}
      <td class="num total ${r.total ? '' : 'zero'}">${r.total}</td>
      <td class="share-cell"><div class="share" title="${((r.total / sum) * 100).toFixed(1)}% of South Asia's medals">
        <span style="background:${COLORS.Gold}" data-w="${(r.gold / sum) * 100}"></span>
        <span style="background:${COLORS.Silver}" data-w="${(r.silver / sum) * 100}"></span>
        <span style="background:${COLORS.Bronze}" data-w="${(r.bronze / sum) * 100}"></span>
      </div></td>
    </tr>`).join('');
  requestAnimationFrame(() => setTimeout(() => {
    document.querySelectorAll('#saTable .share span').forEach((s) => { s.style.width = s.dataset.w + '%'; });
  }, 60));
}

async function loadProfile() {
  const noc = state.noc;
  $('profileName').textContent = nameOf(noc);
  $('lbCountry').textContent = nameOf(noc);
  const url = flagUrl(noc, 160);
  $('profileFlag').innerHTML = url ? `<img src="${url}" alt="">` : noc;

  const [sports, timeline, athletes] = await Promise.all([
    api(`/api/country/${noc}/sports?` + qs()),
    api(`/api/country/${noc}/timeline?` + qs()),
    api(`/api/country/${noc}/athletes?` + qs()),
  ]);

  const sum = (k) => timeline.reduce((s, r) => s + r[k], 0);
  countUp($('kGold'), sum('gold'), 900);
  countUp($('kSilver'), sum('silver'), 900);
  countUp($('kBronze'), sum('bronze'), 900);
  countUp($('kTotal'), sum('gold') + sum('silver') + sum('bronze'), 900);
  $('kSport').textContent = sports[0] ? `${sports[0].sport} (${sports[0].total})` : 'No medals';

  upsert('sport', 'sportChart', {
    type: 'bar',
    data: { labels: sports.map((r) => r.sport), datasets: medalDatasets(sports, true) },
    options: hBarOptions({ plugins: { legend: { display: false }, totals: { enabled: true }, tooltip: { callbacks: { footer: totalFooter } } } }),
  });

  upsert('timeline', 'timelineChart', {
    type: 'bar',
    data: { labels: timeline.map((r) => r.year), datasets: medalDatasets(timeline, false) },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: { stacked: true, grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true, autoSkipPadding: 10 } },
        y: { stacked: true, beginAtZero: true, ticks: { precision: 0 }, grid: { color: GRID }, border: { display: false } },
      },
      plugins: { legend: { position: 'top', align: 'end' }, tooltip: { callbacks: { footer: totalFooter } } },
    },
  });

  // Summer and Winter are separate lines: mixing them in one line makes a false zig-zag
  const years = [...new Set(athletes.map((r) => r.year))].sort((x, y) => x - y);
  const line = (season, color) => {
    const byYear = Object.fromEntries(athletes.filter((r) => r.season === season).map((r) => [r.year, r.athletes]));
    return {
      label: `${season} Games`,
      data: years.map((y) => (y in byYear ? byYear[y] : null)),
      spanGaps: true,
      borderColor: color, backgroundColor: color, borderWidth: 2, cubicInterpolationMode: 'monotone',
      pointRadius: 4, pointHoverRadius: 7, pointBorderColor: CARD, pointBorderWidth: 2,
    };
  };
  const lines = [line('Summer', '#3987e5'), line('Winter', '#199e70')].filter((d) => d.data.some((v) => v !== null));
  upsert('athletes', 'athleteChart', {
    type: 'line',
    data: { labels: years, datasets: lines },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true, autoSkipPadding: 14 } },
        y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: GRID }, border: { display: false } },
      },
      plugins: { legend: { display: lines.length > 1, position: 'top', align: 'end' } },
    },
  });

  loadLeaderboard();
}

async function loadCompare() {
  const rows = await api('/api/compare?' + qs({ a: state.a, b: state.b }));
  const ta = rows.reduce((s, r) => s + r.a_total, 0);
  const tb = rows.reduce((s, r) => s + r.b_total, 0);
  $('cmpNote').textContent = rangeNote();
  $('cmpScore').innerHTML = [[state.a, ta, CMP[0]], [state.b, tb, CMP[1]]].map(([n, t, c]) => `
    <div class="side">${flagBadge(n)}<span class="sw" style="background:${c}"></span>
      <span>${nameOf(n)}</span><span class="big">${t}</span></div>`).join('');
  const ds = (key, n, color) => ({
    label: nameOf(n), short: n, data: rows.map((r) => r[key]),
    borderColor: color, backgroundColor: color, borderWidth: 2, cubicInterpolationMode: 'monotone',
    pointRadius: 3.5, pointHoverRadius: 7, pointBorderColor: CARD, pointBorderWidth: 2,
  });
  upsert('cmp', 'cmpChart', {
    type: 'line',
    data: { labels: rows.map((r) => r.year), datasets: [ds('a_total', state.a, CMP[0]), ds('b_total', state.b, CMP[1])] },
    options: {
      responsive: true, maintainAspectRatio: false,
      layout: { padding: { right: 40 } },
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true, autoSkipPadding: 10 } },
        y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: GRID }, border: { display: false } },
      },
      plugins: { legend: { position: 'top', align: 'end' }, endLabels: { enabled: true } },
    },
  });
}

async function loadLeaderboard() {
  const rows = await api(`/api/country/${state.noc}/appearances`);
  const max = Math.max(...rows.map((r) => r.appearances), 1);
  $('leaderboard').innerHTML = rows.length ? rows.map((r, i) => `
    <li style="animation-delay:${i * 70}ms">
      <span class="lb-rank">${i + 1}</span>
      <span class="lb-name"><b>${r.name}</b><span>${r.sport} · ${r.first_year}–${r.last_year}</span></span>
      <span class="lb-bar"><i data-w="${(r.appearances / max) * 100}"></i></span>
      <span class="lb-val"><b>${r.appearances}</b> Games</span>
    </li>`).join('') : '<li class="empty">No athletes found.</li>';
  setTimeout(() => document.querySelectorAll('#leaderboard .lb-bar i').forEach((b) => { b.style.width = b.dataset.w + '%'; }), 80);
}
async function loadSports() {
  const rows = await api('/api/sports?' + qs());
  rows.sort((a, b) => b.medals - a.medals);
  upsert('sports', 'sportsChart', {
    type: 'bar',
    data: {
      labels: rows.map((r) => `${r.sport} · ${r.country}`),
      datasets: [{ label: 'Medals', data: rows.map((r) => r.medals), backgroundColor: '#3987e5', borderRadius: 3, maxBarThickness: 26 }],
    },
    options: hBarOptions({ plugins: { legend: { display: false }, totals: { enabled: true } } }),
  });
}

async function loadGrowth() {
  const rows = await api('/api/growth?' + qs());
  upsert('growth', 'growthChart', {
    type: 'line',
    data: {
      labels: rows.map((r) => r.year),
      datasets: [{
        label: 'Medal-winning countries', data: rows.map((r) => r.countries),
        borderColor: '#3987e5', backgroundColor: '#3987e5', borderWidth: 2, cubicInterpolationMode: 'monotone',
        pointRadius: 3.5, pointHoverRadius: 7, pointBorderColor: CARD, pointBorderWidth: 2,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true, autoSkipPadding: 10 } },
        y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: GRID }, border: { display: false } },
      },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { afterLabel: (c) => `Medals awarded: ${rows[c.dataIndex].medals.toLocaleString('en-US')}` } },
      },
    },
  });
}

async function loadWomen() {
  const rows = await api('/api/women?' + qs());
  upsert('women', 'womenChart', {
    type: 'bar',
    data: {
      labels: rows.map((r) => r.decade + 's'),
      datasets: [{ label: 'Women (%)', data: rows.map((r) => r.percent), backgroundColor: '#199e70', borderRadius: 3, maxBarThickness: 36 }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: {
        x: { grid: { display: false } },
        y: { beginAtZero: true, suggestedMax: 50, ticks: { callback: (v) => v + '%' }, grid: { color: GRID }, border: { display: false } },
      },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: {
          label: (c) => `${c.parsed.y}% women`,
          afterLabel: (c) => `${rows[c.dataIndex].female.toLocaleString('en-US')} of ${rows[c.dataIndex].total.toLocaleString('en-US')} medal winners`,
        } },
      },
    },
  });
}

// ---------- filters ----------
let timer;
function refresh() {
  clearTimeout(timer);
  timer = setTimeout(() => {
    Promise.all([loadTop(), loadSouthAsia(), loadProfile(), loadCompare(), loadSports(), loadGrowth(), loadWomen()])
      .catch((e) => toast('Could not load data: ' + e.message));
  }, 220);
}

function paintRange() {
  const min = 1896, span = 2016 - min;
  $('rangeFill').style.left = ((state.from - min) / span) * 100 + '%';
  $('rangeFill').style.right = (100 - ((state.to - min) / span) * 100) + '%';
  $('fromVal').textContent = state.from; $('toVal').textContent = state.to;
}

function bindFilters() {
  const from = $('yearFrom'), to = $('yearTo');
  const onRange = (which) => {
    let f = +from.value, t = +to.value;
    if (f > t) { if (which === 'from') t = f; else f = t; from.value = f; to.value = t; }
    state.from = f; state.to = t; paintRange(); refresh();
  };
  from.addEventListener('input', () => onRange('from'));
  to.addEventListener('input', () => onRange('to'));

  $('seasonSeg').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    document.querySelectorAll('#seasonSeg button').forEach((x) => x.classList.toggle('on', x === b));
    state.season = b.dataset.v; refresh();
  });

  $('medalChips').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const m = b.dataset.v;
    if (state.medals.has(m) && state.medals.size === 1) return toast('Keep at least one medal type selected.');
    state.medals.has(m) ? state.medals.delete(m) : state.medals.add(m);
    b.classList.toggle('on', state.medals.has(m)); refresh();
  });

  $('resetBtn').addEventListener('click', () => {
    Object.assign(state, { from: 1896, to: 2016, season: 'All' });
    state.medals = new Set(['Gold', 'Silver', 'Bronze']);
    from.value = 1896; to.value = 2016; paintRange();
    document.querySelectorAll('#seasonSeg button').forEach((x) => x.classList.toggle('on', x.dataset.v === 'All'));
    document.querySelectorAll('#medalChips .chip').forEach((x) => x.classList.add('on'));
    refresh();
  });

  $('countrySelect').addEventListener('change', (e) => { state.noc = e.target.value; loadProfile().catch((err) => toast(err.message)); });
  $('cmpA').addEventListener('change', (e) => { state.a = e.target.value; loadCompare().catch((err) => toast(err.message)); });
  $('cmpB').addEventListener('change', (e) => { state.b = e.target.value; loadCompare().catch((err) => toast(err.message)); });
}

// ============ MATCH DAY: crowd sounds (made in the browser, no sound files) ============
const Sound = (() => {
  const VOLUME = 1.0; // too quiet or too loud? change this number (0.3 to 2)
  let ctx = null, master = null, out = null, noiseBuf = null, muted = false;
  const rand = (a, b) => a + Math.random() * (b - a);

  function start() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      const comp = ctx.createDynamicsCompressor();
      master = ctx.createGain();
      master.gain.value = VOLUME;
      master.connect(comp);
      comp.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume();
    if (out) out.gain.setTargetAtTime(0, ctx.currentTime, 0.05); // stop the previous sound
    out = ctx.createGain();
    out.connect(master);
  }

  // crowd noise that swells and fades
  function roar(dur, peak, from, to, when) {
    const t = ctx.currentTime + when;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.Q.value = 0.8;
    bp.frequency.setValueAtTime(from, t);
    bp.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + dur * 0.2);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(bp); bp.connect(g); g.connect(out);
    src.start(t, 0, dur + 0.1);
  }

  // one short hand clap
  function clap(when, gain) {
    const t = ctx.currentTime + when;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = rand(1200, 2800); bp.Q.value = 1.2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    src.connect(bp); bp.connect(g); g.connect(out);
    src.start(t, rand(0, 3.5), 0.12);
  }

  // one "oooo" voice whose pitch glides from f0 to f1
  function voice(f0, f1, dur, gain, when) {
    const t = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const lfo = ctx.createOscillator();            // slight wobble, sounds human
    lfo.frequency.value = rand(4.5, 6.5);
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = f0 * 0.02;
    lfo.connect(lfoGain); lfoGain.connect(osc.frequency);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + dur * 0.25);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    [[450, 5], [850, 7]].forEach(([f, q]) => {     // vowel "o" shape
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q;
      osc.connect(bp); bp.connect(g);
    });
    g.connect(out);
    osc.start(t); lfo.start(t);
    osc.stop(t + dur + 0.1); lfo.stop(t + dur + 0.1);
  }

  function cheer() {
    if (muted) return;
    start();
    roar(3.6, 0.9, 600, 1700, 0);
    roar(2.4, 0.5, 1800, 3200, 0.2);
    for (let i = 0; i < 5; i++) voice(rand(220, 300), rand(380, 520), 1.1, 0.9, rand(0, 0.35)); // "woooo" up
    for (let i = 0; i < 70; i++) clap(rand(0.4, 3.4), rand(0.12, 0.3));
  }
  function groan() {
    if (muted) return;
    start();
    roar(2.8, 0.35, 900, 250, 0);
    for (let i = 0; i < 8; i++) voice(rand(260, 340), rand(120, 170), rand(2.0, 2.6), 1.0, rand(0, 0.3)); // "ooooh" down
  }
  function setMuted(v) { muted = v; if (v && ctx && out) out.gain.setTargetAtTime(0, ctx.currentTime, 0.05); }
  return { cheer, groan, setMuted, isMuted: () => muted };
})();

// ============ MATCH DAY: result of one country in one year ============
let mdToken = 0;

function confetti() {
  const box = $('confetti');
  box.innerHTML = '';
  const cols = ['#f2c94c', '#b88600', '#5b86c4', '#b5652a', '#eef1f7'];
  for (let i = 0; i < 70; i++) {
    const s = document.createElement('span');
    s.style.left = Math.random() * 100 + '%';
    s.style.background = cols[i % cols.length];
    s.style.animationDuration = 2.4 + Math.random() * 2.2 + 's';
    s.style.animationDelay = Math.random() * 0.8 + 's';
    s.style.setProperty('--r', (Math.random() * 720 - 360).toFixed(0) + 'deg');
    box.appendChild(s);
  }
  setTimeout(() => { box.innerHTML = ''; }, 6500);
}

async function runMatchDay() {
  const noc = $('mdCountry').value, year = $('mdYear').value;
  if (!noc || !year) return;
  const token = ++mdToken;
  let r;
  try {
    const p = new URLSearchParams({ from: year, to: year, season: 'All', medals: 'Gold,Silver,Bronze' });
    const rows = await api(`/api/country/${noc}/timeline?` + p);
    r = rows.find((x) => String(x.year) === String(year)) || { gold: 0, silver: 0, bronze: 0 };
  } catch (e) { return toast('Could not load the result: ' + e.message); }
  if (token !== mdToken) return; // user already picked something else

  const total = r.gold + r.silver + r.bronze;
  const won = total > 0;
  const box = $('stadium');
  box.classList.remove('win', 'lose');
  void box.offsetWidth;                 // restart the animations
  box.classList.add(won ? 'win' : 'lose');

  $('sbTeam').innerHTML = `${flagBadge(noc)}<span>${nameOf(noc)}</span>`;
  $('sbVerdict').textContent = won ? 'VICTORY!' : 'NO MEDALS';
  $('sbSub').textContent = won
    ? `${nameOf(noc)} won ${total} medal${total > 1 ? 's' : ''} in ${year}`
    : `${nameOf(noc)} went home without a medal in ${year}`;
  $('sbG').textContent = r.gold; $('sbS').textContent = r.silver; $('sbB').textContent = r.bronze;

  if (won) { Sound.cheer(); confetti(); } else { Sound.groan(); }
}

async function initMatchDay() {
  const list = countries.filter((c) => c.total > 0 || ['BAN', 'NEP', 'BHU', 'MDV'].includes(c.noc));
  $('mdCountry').innerHTML = list.map((c) => `<option value="${c.noc}">${c.country} (${c.noc})</option>`).join('');
  $('mdCountry').value = 'PAK';
  const yrs = await api('/api/country/PAK/timeline?' + new URLSearchParams({ from: 1896, to: 2016, season: 'All', medals: 'Gold,Silver,Bronze' }));
  $('mdYear').innerHTML = yrs.map((r) => `<option value="${r.year}">${r.year}</option>`).join('');
  $('mdYear').value = '1992';
  $('mdCountry').addEventListener('change', runMatchDay);
  $('mdYear').addEventListener('change', runMatchDay);
  $('mdReplay').addEventListener('click', runMatchDay);
  $('testCheer').addEventListener('click', () => Sound.cheer());
  $('testGroan').addEventListener('click', () => Sound.groan());
  $('mdMute').addEventListener('click', () => {
    Sound.setMuted(!Sound.isMuted());
    $('mdMute').textContent = Sound.isMuted() ? 'Sound: off' : 'Sound: on';
  });
}

// ---------- start ----------
(async function init() {
  buildFlagWall(); buildSparks(); spotlight(); reveal(); paintRange(); bindFilters();
  try {
    await loadCountries();
    await initMatchDay();
    await Promise.all([loadSummary(), loadTop(), loadSouthAsia(), loadProfile(), loadCompare(), loadSports(), loadGrowth(), loadWomen()]);
  } catch (e) {
    toast('Could not reach the database. Is the server running and is .env correct? (' + e.message + ')');
  }
})();
