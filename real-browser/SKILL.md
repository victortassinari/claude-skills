---
name: real-browser
description: "Automate web navigation in the user's REAL, visible Chrome (their own profile and logins) instead of a headless browser. Use whenever a task needs a website the user is logged into or a dashboard without an API (Meta for Developers, Google/Azure/AWS consoles, admin panels, forms, support portals, forum posts): the user logs in by hand, the agent then navigates, reads, fills and clicks, checking a screenshot after each step. Works on Windows (also from WSL), macOS and Linux."
---

# Real browser (the user's own Chrome, driven by the agent)

The agent opens a normal, visible Chrome with a separate profile and a DevTools port, the **person logs in by
hand** (password, 2FA), and the agent drives that same window through the DevTools protocol (puppeteer-core
`connect`). Logins stay in the profile, so the next time no login is needed.

All commands go through one script (it handles WSL, macOS and Linux):

```bash
RB=~/.claude/skills/real-browser/scripts/rb.sh
$RB setup                         # once: installs puppeteer-core (on WSL, on the Windows side)
$RB launch meta https://developers.facebook.com/apps   # profile "meta"; reuse the name to keep the login
$RB status                        # is it listening? (port 9333; RB_PORT to change)
```

Then tell the person: **"Abri um Chrome; faça o login nele e me avise."** Wait for their answer. Never ask for
or type a password; the script refuses to type into a password field.

## The loop: act, then look

Every action prints `screenshot <path>`. **Read that PNG (Read tool) before the next step**: the page text alone
misses modals, disabled buttons, wrong tabs and React fields that did not take the value.

```bash
$RB goto <url> [shotName]         # navigate
$RB text [maxChars]               # visible text (fast way to find labels and states)
$RB inputs                        # visible fields with their index (passwords masked)
$RB type <index> "<text>" [shot]  # replace a field's value (select-all + type, works with React inputs)
$RB typefile <index> <file> [shot]# multi-line text (Shift+Enter between lines), e.g. a forum post body
$RB click "<exact text>" [shot]   # real mouse click on the element with that exact text
$RB rowclick "<row text>" "<button>" [shot]  # the button in the same row/card (e.g. a permission + "Adicionar")
$RB clickxy <x> <y> [shot]        # click at coordinates read from the last screenshot (radio, toggle, icon)
$RB key Enter|Escape|Tab [shot]   # key press
$RB scroll 600 [shot]             # scroll
$RB tabs / use <index|host> / newtab <url>
$RB size 1700 1050                # widen the window when a panel does not render (narrow layouts hide content)
$RB eval "<js expression>"        # last resort; keep it simple (shell quoting through PowerShell on WSL is fragile)
```

Tips that saved time:
- Text-based `click` uses a real mouse event; DOM `.click()` is often ignored by React dashboards.
- If a label has an icon or trailing space, `text` shows the exact string; or click by coordinates from the screenshot.
- After a click that opens a dropdown, take `text` again: options often render in a portal at the end of the page.
- A field that keeps its old value: `type` again (it selects all first); verify with `inputs`.
- Pages that render nothing: `size 1700 1050` and `goto` the same URL again; wait a few seconds and `shot`.

## Rules

- **The person's account, their decisions.** Ask before anything irreversible or public that they did not
  explicitly ask for: deleting, publishing, paying, sending messages, accepting new terms, posting in a forum.
  Show the exact text you will post. Reading and navigating need no confirmation.
- **No detection evasion.** It is a normal Chrome; do not add stealth plugins, spoof fingerprints or bypass
  captchas. If a site blocks automation or asks for a captcha, hand that step to the person.
- **Secrets.** Never echo tokens, secrets or passwords into the chat or files. If you must copy a secret from a page
  into another system, pass it directly (e.g. via an API call or a field) and do not print it; suggest rotating any
  secret that was exposed in chat.
- Keep one profile per purpose (`meta`, `google`, `azure`...). Profiles live in `~/.real-browser/profiles`
  (`%USERPROFILE%\.real-browser\profiles` on Windows). Screenshots go to `.../.real-browser/shots`.
- At the end, tell the person what was done (with links) and leave the browser open unless they ask to close it.

## Platform notes

- **WSL**: Chrome and Node run on Windows (the DevTools port listens on Windows' 127.0.0.1); `rb.sh` calls them
  through `powershell.exe` and converts the screenshot path to `/mnt/c/...`. Node must be installed on Windows.
- **macOS**: uses Google Chrome, Chromium or Edge from `/Applications`.
- **Linux**: uses `google-chrome`, `chromium` or `microsoft-edge` from the PATH (needs a desktop session).
- Port busy or Chrome already open with that profile without the port: close that window and `launch` again,
  or use another `RB_PORT`.
