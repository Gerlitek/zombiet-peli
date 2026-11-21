// The dashboard (tilastot/index.html). Reads the summary the nightly curate run writes (GET /api/stats)
// and draws it with Chart.js. No queries of its own: everything is computed in api/curate.py.
import { BarController, BarElement, CategoryScale, Chart, Legend, LinearScale, Tooltip } from 'chart.js';
import { ACHIEVEMENTS } from './data/achievements';
import { HEROES } from './data/characters';
import { WEAPONS } from './data/weapons';
import { ZOMBIES } from './data/zombies';
import { API_URL } from './systems/api';

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

// The shape of curate.summary() in api/curate.py.
export interface Summary {
  generated: string;
  recent_days: number;
  days: { day: string; started: number; ended: number; won: number }[]; // the recent days only
  players_recent: number | null; // distinct nicknames in the recent days
  games: { started: number; started_recent: number; ended: number; won: number; median_duration_s: number | null; median_kills: number | null };
  characters: Record<string, number>;
  kills_by_zombie: Record<string, number>;
  hits_by_zombie: Record<string, number>;
  wheel_weapons: Record<string, number>;
  achievements: Record<string, number>;
  puzzles: Record<string, { answered: number; correct: number; median_ms: number | null }>;
}

const COLORS = { accent: '#7CC8F2', brand: '#E85AA5', text: '#E7E8EA', dim: '#A9AFBA', grid: 'rgba(37, 45, 63, 0.6)', surface: '#151923' };
const LEVELS: Record<string, string> = { easy: 'Helppo', medium: 'Keski', hard: 'Vaikea' };
const nameOf = (table: Record<string, { name: string }>) => (id: string) => table[id]?.name ?? id;
const fmt = (n: number | null | undefined) => (n == null ? '–' : n.toLocaleString('fi-FI')); // older summaries lack some fields
const pct = (part: number, all: number) => (all ? `${Math.round((100 * part) / all)} %` : '–');

Chart.defaults.color = COLORS.dim;
Chart.defaults.font.family = 'Inter, system-ui, sans-serif';
Chart.defaults.borderColor = COLORS.grid;

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;

function el(tag: string, cls = '', text = ''): HTMLElement {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

function tile(value: string, label: string) {
  const t = el('div', 'tile');
  t.append(el('b', '', value), el('span', '', label));
  $('.tiles').append(t);
}

// One card: a title, the chart, and the same numbers as a table (readable without the chart).
function card(title: string, head: string[], rows: (string | number)[][], wide = false): HTMLCanvasElement | null {
  const c = el('section', wide ? 'card wide' : 'card');
  c.append(el('h2', '', title));
  $('.grid').append(c);
  if (!rows.length) {
    c.append(el('p', 'empty', 'Ei vielä dataa.'));
    return null;
  }
  const plot = el('div', 'plot'), canvas = document.createElement('canvas');
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', title);
  plot.append(canvas);
  const table = document.createElement('table');
  table.innerHTML = `<thead><tr>${head.map(() => '<th></th>').join('')}</tr></thead><tbody></tbody>`;
  table.querySelectorAll('th').forEach((th, i) => (th.textContent = head[i]));
  for (const row of rows) {
    const tr = table.tBodies[0].insertRow();
    for (const v of row) tr.insertCell().textContent = typeof v === 'number' ? fmt(v) : v;
  }
  const details = el('details');
  details.append(el('summary', '', 'Taulukkona'), table);
  c.append(plot, details);
  return canvas;
}

const bar = { borderRadius: 4, borderSkipped: 'start' as const, maxBarThickness: 18 };

// A single series of counts, longest first: horizontal bars, no legend (the title names it).
function counts(title: string, data: Record<string, number>, label: (id: string) => string, unit: string) {
  const entries = Object.entries(data);
  const canvas = card(title, ['', unit], entries.map(([id, n]) => [label(id), n]));
  if (!canvas) return;
  new Chart(canvas, {
    type: 'bar',
    data: { labels: entries.map(([id]) => label(id)), datasets: [{ label: unit, data: entries.map(([, n]) => n), backgroundColor: COLORS.accent, ...bar }] },
    options: {
      indexAxis: 'y', maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { x: { beginAtZero: true, ticks: { precision: 0 } }, y: { grid: { display: false }, ticks: { color: COLORS.text } } },
    },
  });
}

function days(s: Summary) {
  const label = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString('fi-FI', { day: 'numeric', month: 'numeric' });
  const canvas = card(`Pelikerrat päivittäin, viimeiset ${s.recent_days} päivää`, ['Päivä', 'Aloitettu', 'Läpäisty'], s.days.map((d) => [label(d.day), d.started, d.won]), true);
  if (!canvas) return;
  new Chart(canvas, {
    type: 'bar',
    data: {
      labels: s.days.map((d) => label(d.day)),
      datasets: [
        { label: 'Aloitettu', data: s.days.map((d) => d.started), backgroundColor: COLORS.accent, ...bar, maxBarThickness: 22 },
        { label: 'Läpäisty', data: s.days.map((d) => d.won), backgroundColor: COLORS.brand, ...bar, maxBarThickness: 22 },
      ],
    },
    options: {
      maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
      plugins: { legend: { align: 'end', labels: { boxWidth: 10, boxHeight: 10, color: COLORS.text } } },
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } }, x: { grid: { display: false } } },
    },
  });
}

function puzzles(s: Summary) {
  const levels = Object.keys(LEVELS).filter((lv) => s.puzzles[lv]?.answered).map((lv) => [lv, s.puzzles[lv]] as const);
  const secs = (ms: number | null) => (ms == null ? '–' : `${(ms / 1000).toFixed(1).replace('.', ',')} s`);
  const canvas = card('Hajotelmat: oikein vastattu', ['Taso', 'Vastauksia', 'Oikein', 'Aika (mediaani)'],
    levels.map(([lv, p]) => [LEVELS[lv] ?? lv, p.answered, pct(p.correct, p.answered), secs(p.median_ms)]));
  if (!canvas) return;
  new Chart(canvas, {
    type: 'bar',
    data: {
      labels: levels.map(([lv]) => LEVELS[lv] ?? lv),
      datasets: [{ label: 'Oikein', data: levels.map(([, p]) => Math.round((100 * p.correct) / p.answered)), backgroundColor: COLORS.accent, ...bar, maxBarThickness: 40 }],
    },
    options: {
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: {
          label: (c) => `Oikein ${c.parsed.y} %`,
          footer: (items) => { const p = levels[items[0].dataIndex][1]; return `${p.answered} vastausta, mediaani ${secs(p.median_ms)}`; },
        } },
      },
      scales: { y: { min: 0, max: 100, ticks: { callback: (v) => `${v} %` } }, x: { grid: { display: false }, ticks: { color: COLORS.text } } },
    },
  });
}

function render(s: Summary) {
  s.recent_days ??= 30;
  const g = s.games;
  const duration = g.median_duration_s == null ? '–' : `${Math.floor(g.median_duration_s / 60)}:${String(Math.round(g.median_duration_s % 60)).padStart(2, '0')}`;
  tile(fmt(g.started), 'peliä yhteensä');
  tile(fmt(g.started_recent), `peliä ${s.recent_days} päivän aikana`);
  tile(fmt(s.players_recent), `eri pelinimeä ${s.recent_days} päivän aikana`);
  tile(pct(g.won, g.ended), 'päättyneistä peleistä läpäisty');
  tile(duration, 'pelin kesto (mediaani, min:s)');
  tile(g.median_kills == null ? '–' : fmt(g.median_kills), 'tappoa pelissä (mediaani)');

  days(s);
  counts('Valitut hahmot', s.characters, nameOf(HEROES), 'Pelejä');
  counts('Kaadetut zombit', s.kills_by_zombie, nameOf(ZOMBIES), 'Tappoja');
  counts('Pelaajaan osuneet zombit', s.hits_by_zombie, nameOf(ZOMBIES), 'Osumia');
  counts('Onnenpyörän aseet', s.wheel_weapons, nameOf(WEAPONS), 'Kertaa');
  counts('Saavutukset', s.achievements, (id) => ACHIEVEMENTS[id as keyof typeof ACHIEVEMENTS] ?? id, 'Pelaajia');
  puzzles(s);

  const footer = $('footer');
  footer.textContent = `Päivitetty ${new Date(s.generated).toLocaleString('fi-FI', { dateStyle: 'short', timeStyle: 'short' })}.`;
  for (const sel of ['.tiles', '.grid', 'footer']) $(sel).hidden = false;
  $('.status').hidden = true;
}

async function load() {
  const status = $('.status');
  if (!API_URL) {
    status.textContent = 'Kehitystilassa ei ole API:a. Aseta VITE_API_URL tai lisää ?demo osoitteeseen.';
    return;
  }
  try {
    // The Function App scales to zero, so the first request may wait for a cold start (about 30 s).
    const res = await fetch(`${API_URL}/api/stats`, { signal: AbortSignal.timeout(45000) });
    if (res.status === 404) status.textContent = 'Tilastoja ei ole vielä. Ne lasketaan joka yö.';
    else if (!res.ok) status.textContent = 'Tilastot eivät ole nyt saatavilla. Yritä myöhemmin uudelleen.';
    else render(await res.json());
  } catch {
    status.textContent = 'Tilastot eivät ole nyt saatavilla. Yritä myöhemmin uudelleen.';
  }
}

// Development only: ?demo draws made-up numbers, so the layout can be checked without the API.
if (import.meta.env.DEV && location.search.includes('demo')) import('./stats-demo').then((m) => render(m.DEMO));
else load();
