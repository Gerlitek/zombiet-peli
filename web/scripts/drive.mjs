// Drive the game in headless Chrome over the DevTools protocol: press keys, take screenshots.
// No dependencies: uses the WebSocket client built into Node.
//
// 1) npm run dev -- --port 4173 --strictPort
// 2) "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new \
//      --remote-debugging-port=9333 --user-data-dir=/tmp/zombie-chrome --window-size=760,780 about:blank
// 3) node scripts/drive.mjs <screenshot folder> <absolute path to a steps file, e.g. scripts/play-full-game.mjs>
//
// A steps file exports: async ({ tap, hold, shot, sleep, js }) => { ... }.
// In dev mode the running game is window.game, so js() can read scene state.
import { writeFileSync } from 'node:fs';
const out = process.argv[2];
const tabs = await (await fetch('http://127.0.0.1:9333/json')).json();
const ws = new WebSocket(tabs.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const waiting = new Map(); const logs = [];
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id) waiting.get(d.id)?.(d.result); else if (d.method === 'Runtime.exceptionThrown') logs.push('EXC ' + JSON.stringify(d.params.exceptionDetails).slice(0, 600)); else if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') logs.push('ERR ' + d.params.args.map((a) => a.value ?? a.description).join(' ')); };
const send = (method, params = {}) => new Promise((r) => { waiting.set(++id, r); ws.send(JSON.stringify({ id, method, params })); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const KEYS = { Escape: ['Escape', 27], KeyT: ['t', 84], KeyH: ['h', 72], Enter: ['Enter', 13], Space: [' ', 32], ArrowLeft: ['ArrowLeft', 37], ArrowRight: ['ArrowRight', 39], ArrowUp: ['ArrowUp', 38], ArrowDown: ['ArrowDown', 40], KeyN: ['n', 78] };
const key = (type, code) => send('Input.dispatchKeyEvent', { type, code, key: KEYS[code][0], windowsVirtualKeyCode: KEYS[code][1] });
const tap = async (code) => { await key('keyDown', code); await sleep(60); await key('keyUp', code); await sleep(120); };
const hold = async (code, ms) => { await key('keyDown', code); await sleep(ms); await key('keyUp', code); };
const shot = async (name) => { const r = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: 760, height: 780, scale: 1 } }); writeFileSync(`${out}/${name}.png`, Buffer.from(r.data, 'base64')); };
const js = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.value;
await send('Runtime.enable'); await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 760, height: 780, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: 'http://127.0.0.1:4173/' });
await sleep(1500);
const steps = (await import(process.argv[3])).default;
await steps({ tap, hold, shot, sleep, js });
console.log(logs.length ? logs.join('\n') : 'no errors');
ws.close();
