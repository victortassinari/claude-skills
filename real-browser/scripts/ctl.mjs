// Drives the user's real, visible Chrome through the DevTools protocol (remote debugging port).
// The person logs in by hand; this script only navigates, reads and clicks. No stealth tricks.
//
// Usage: node ctl.mjs <command> [args...]   (env RB_PORT, default 9333; RB_OUT, screenshot dir)
// Commands:
//   tabs                         list open tabs (index, url, title)
//   use <index|url-substring>    pick the tab the next commands act on (stored in RB_OUT/.tab)
//   newtab <url>                 open a tab and use it
//   goto <url> [shot]            navigate and screenshot
//   shot [name]                  screenshot of the current tab (RB_OUT/<name>.png)
//   text [maxChars]              visible text of the page
//   inputs                       visible inputs/textareas/selects with their index (passwords masked)
//   type <index> <text> [shot]   replace the value of visible input #index (never use for passwords)
//   typefile <index> <file> [shot]  type a multi-line text from a file (Shift+Enter between lines)
//   click <text> [shot]          real mouse click on the element whose text is exactly <text>
//   clickxy <x> <y> [shot]       real mouse click at viewport coordinates (read them from a screenshot)
//   rowclick <rowText> <buttonText> [shot]  click the button <buttonText> in the same row/card as <rowText>
//   key <Key> [shot]             press a key (Enter, Escape, Tab, ArrowDown...)
//   scroll <dy> [shot]           scroll the page by dy pixels
//   eval <js-expression>         evaluate an expression in the page and print the result
//   size <width> <height>        resize the browser window
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';

const require = createRequire(path.join(process.env.RB_HOME ?? path.join(os.homedir(), '.real-browser'), 'package.json'));
const puppeteer = require('puppeteer-core');

const PORT = Number(process.env.RB_PORT ?? 9333);
const OUT = process.env.RB_OUT ?? path.join(process.env.RB_HOME ?? path.join(os.homedir(), '.real-browser'), 'shots');
fs.mkdirSync(OUT, { recursive: true });
const TAB_FILE = path.join(OUT, '.tab');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const [cmd, ...args] = process.argv.slice(2);
const browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${PORT}`, defaultViewport: null });
let pages = (await browser.pages()).filter((p) => !p.url().startsWith('devtools://'));

function pickPage() {
  const saved = fs.existsSync(TAB_FILE) ? fs.readFileSync(TAB_FILE, 'utf8').trim() : '';
  return (saved && pages.find((p) => p.url().includes(saved))) || pages[pages.length - 1];
}
let page = pickPage();

async function shot(name = 'shot') {
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file });
  console.log(`url ${page.url()}`);
  console.log(`screenshot ${file}`);
}
async function visibleFields() {
  const out = [];
  for (const h of await page.$$('input,textarea,select,[contenteditable=true]')) if (await h.evaluate((e) => !!e.offsetParent)) out.push(h);
  return out;
}
async function centerOfText(text) {
  return page.evaluate((t) => {
    const els = [...document.querySelectorAll('*')].filter((e) => e.offsetParent && e.textContent.trim() === t);
    const el = els.sort((a, b) => a.childElementCount - b.childElementCount)[0];
    if (!el) return null;
    el.scrollIntoView({ block: 'center' });
    const b = el.getBoundingClientRect();
    return [b.x + b.width / 2, b.y + b.height / 2];
  }, text);
}

switch (cmd) {
  case 'tabs':
    pages.forEach((p, i) => console.log(`${i}\t${p.url()}`));
    break;
  case 'use': {
    const target = /^\d+$/.test(args[0]) ? pages[Number(args[0])] : pages.find((p) => p.url().includes(args[0]));
    if (!target) throw new Error(`No tab for ${args[0]}`);
    fs.writeFileSync(TAB_FILE, new URL(target.url()).host);
    page = target; await page.bringToFront(); console.log(`using ${page.url()}`);
    break;
  }
  case 'newtab':
    page = await browser.newPage();
    await page.goto(args[0], { waitUntil: 'networkidle2', timeout: 60000 }).catch(() => {});
    fs.writeFileSync(TAB_FILE, new URL(page.url()).host);
    await shot(args[1]);
    break;
  case 'goto':
    await page.goto(args[0], { waitUntil: 'networkidle2', timeout: 60000 }).catch(() => {});
    await wait(1500); await shot(args[1]);
    break;
  case 'shot':
    await shot(args[0]);
    break;
  case 'text':
    console.log((await page.evaluate(() => document.body.innerText)).slice(0, Number(args[0] ?? 8000)));
    break;
  case 'inputs': {
    const rows = [];
    for (const [i, h] of (await visibleFields()).entries()) {
      rows.push(await h.evaluate((e, i) => ({
        i, tag: e.tagName.toLowerCase(), type: e.type ?? null, name: e.name || null,
        label: e.getAttribute('aria-label') || e.placeholder || (e.labels?.[0]?.innerText ?? null),
        value: e.type === 'password' ? '***' : (e.value ?? e.innerText ?? '').slice(0, 80),
      }), i));
    }
    console.log(JSON.stringify(rows, null, 1));
    break;
  }
  case 'type': {
    const h = (await visibleFields())[Number(args[0])];
    if (!h) throw new Error(`No visible field #${args[0]}`);
    if (await h.evaluate((e) => e.type === 'password')) throw new Error('Refusing to type into a password field: the person types passwords.');
    await h.click();
    const mod = process.platform === 'darwin' ? 'Meta' : 'Control';
    await page.keyboard.down(mod); await page.keyboard.press('KeyA'); await page.keyboard.up(mod);
    await page.keyboard.press('Backspace');
    await h.type(args[1], { delay: 15 });
    await wait(600); await shot(args[2]);
    break;
  }
  case 'typefile': {
    const h = (await visibleFields())[Number(args[0])];
    if (!h) throw new Error(`No visible field #${args[0]}`);
    const lines = fs.readFileSync(args[1], 'utf8').replace(/\r/g, '').replace(/\n$/, '').split('\n');
    await h.click();
    for (let i = 0; i < lines.length; i++) {
      if (lines[i]) await page.keyboard.type(lines[i], { delay: 2 });
      if (i < lines.length - 1) { await page.keyboard.down('Shift'); await page.keyboard.press('Enter'); await page.keyboard.up('Shift'); }
    }
    await shot(args[2]);
    break;
  }
  case 'click': {
    const xy = await centerOfText(args[0]);
    if (!xy) { console.log(`not found: ${args[0]}`); break; }
    await page.mouse.click(xy[0], xy[1]); await wait(2500); await shot(args[1]);
    break;
  }
  case 'clickxy':
    await page.mouse.click(Number(args[0]), Number(args[1])); await wait(2500); await shot(args[2]);
    break;
  case 'rowclick': {
    const xy = await page.evaluate((rowText, label) => {
      const leaf = [...document.querySelectorAll('*')].find((e) => e.childElementCount === 0 && e.textContent.trim() === rowText);
      for (let n = leaf, k = 0; n && k < 12; k++) {
        n = n.parentElement;
        const b = n && [...n.querySelectorAll('button,[role=button],a')].find((x) => x.offsetParent && x.innerText.trim() === label);
        if (b) { b.scrollIntoView({ block: 'center' }); const r = b.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }
      }
      return null;
    }, args[0], args[1]);
    if (!xy) { console.log(`not found: ${args[1]} near ${args[0]}`); break; }
    await page.mouse.click(xy[0], xy[1]); await wait(2500); await shot(args[2]);
    break;
  }
  case 'key':
    await page.keyboard.press(args[0]); await wait(1200); await shot(args[1]);
    break;
  case 'scroll':
    await page.mouse.wheel({ deltaY: Number(args[0]) }); await wait(800); await shot(args[1]);
    break;
  case 'eval':
    console.log(await page.evaluate(args[0]));
    break;
  case 'size': {
    const s = await page.target().createCDPSession();
    const { windowId } = await s.send('Browser.getWindowForTarget');
    await s.send('Browser.setWindowBounds', { windowId, bounds: { windowState: 'normal', width: Number(args[0]), height: Number(args[1]) } });
    console.log('resized');
    break;
  }
  default:
    console.log('Commands: tabs use newtab goto shot text inputs type typefile click clickxy rowclick key scroll eval size');
}
browser.disconnect();
