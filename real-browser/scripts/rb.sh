#!/usr/bin/env bash
# real-browser: opens the user's real Chrome (visible, own profile) with a DevTools port and drives it with ctl.mjs.
# Works on Windows (from WSL: Chrome and Node run on the Windows side), macOS and Linux.
#
#   rb.sh setup                      install puppeteer-core once (in ~/.real-browser or %USERPROFILE%\.real-browser)
#   rb.sh launch <profile> [url]     open Chrome with profile <profile> (kept between runs: the login stays)
#   rb.sh status                     is a Chrome listening on the port?
#   rb.sh <ctl command> [args...]    any command of ctl.mjs (goto, shot, text, inputs, type, click, ...)
#
# Env: RB_PORT (default 9333). Screenshots: the path printed after "screenshot" (on WSL already converted to /mnt/...).
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT="${RB_PORT:-9333}"

is_wsl() { grep -qi microsoft /proc/version 2>/dev/null; }

if is_wsl; then
  WIN_HOME="$(powershell.exe -NoProfile -Command '$env:USERPROFILE' | tr -d '\r')"
  RB_HOME_WIN="${WIN_HOME}\\.real-browser"
  RB_HOME_LX="$(wslpath "$RB_HOME_WIN")"
else
  RB_HOME_LX="${RB_HOME:-$HOME/.real-browser}"
fi
mkdir -p "$RB_HOME_LX/profiles" "$RB_HOME_LX/shots"
cp "$HERE/ctl.mjs" "$RB_HOME_LX/ctl.mjs"

run_node() { # run ctl.mjs where Chrome is
  if is_wsl; then
    local args="" a
    for a in "$@"; do
      a="${a//\'/\'\'}"
      # a local file argument (typefile) must be a Windows path
      if [[ -e "$a" && "$a" == /* ]]; then a="$(wslpath -w "$a")"; fi
      args+=" '$a'"
    done
    powershell.exe -NoProfile -Command "\$env:RB_PORT='$PORT'; \$env:RB_HOME='$RB_HOME_WIN'; node '$RB_HOME_WIN\\ctl.mjs'$args" \
      | tr -d '\r' | while IFS= read -r line; do
          if [[ "$line" == screenshot\ * ]]; then echo "screenshot $(wslpath "${line#screenshot }")"; else echo "$line"; fi
        done
  else
    RB_PORT="$PORT" RB_HOME="$RB_HOME_LX" node "$RB_HOME_LX/ctl.mjs" "$@"
  fi
}

need_node() {
  local ok
  if is_wsl; then ok="$(powershell.exe -NoProfile -Command 'if (Get-Command node -ErrorAction SilentlyContinue) { node -v }' | tr -d '\r')"
  else ok="$(command -v node >/dev/null && node -v || true)"; fi
  if [[ -z "$ok" ]]; then
    echo "Node.js não encontrado$(is_wsl && echo ' no Windows'). Instale e rode de novo:" >&2
    if is_wsl; then echo "  Windows: winget install OpenJS.NodeJS.LTS" >&2
    elif [[ "$(uname)" == "Darwin" ]]; then echo "  macOS: brew install node   (ou https://nodejs.org)" >&2
    else echo "  Linux: sudo apt install nodejs npm   (ou https://nodejs.org / nvm)" >&2; fi
    exit 2
  fi
}

# Downloads Chrome for Testing (official Google build, no admin rights) into .real-browser/browsers; prints the binary.
install_chrome() {
  echo "Nenhum Chrome/Edge/Chromium encontrado: baixando o Chrome for Testing (oficial do Google, sem admin)..." >&2
  if is_wsl; then
    powershell.exe -NoProfile -Command "cd '$RB_HOME_WIN'; npx --yes @puppeteer/browsers install chrome@stable --path '$RB_HOME_WIN\\browsers'" | tr -d '\r' | tail -1 | awk '{print $NF}'
  else
    (cd "$RB_HOME_LX" && npx --yes @puppeteer/browsers install chrome@stable --path "$RB_HOME_LX/browsers" | tail -1 | awk '{print $NF}')
  fi
}

setup() {
  need_node
  if [[ -d "$RB_HOME_LX/node_modules/puppeteer-core" ]]; then echo "puppeteer-core already installed in $RB_HOME_LX"; return; fi
  [[ -f "$RB_HOME_LX/package.json" ]] || echo '{ "name": "real-browser", "private": true, "type": "module" }' > "$RB_HOME_LX/package.json"
  if is_wsl; then
    powershell.exe -NoProfile -Command "cd '$RB_HOME_WIN'; npm install --no-audit --no-fund puppeteer-core@24" | tr -d '\r' | tail -2
  else
    (cd "$RB_HOME_LX" && npm install --no-audit --no-fund puppeteer-core@24 | tail -2)
  fi
}

status() {
  if is_wsl; then
    powershell.exe -NoProfile -Command "try { (Invoke-WebRequest -UseBasicParsing -TimeoutSec 3 http://127.0.0.1:$PORT/json/version).Content } catch { 'no browser on port $PORT' }" | tr -d '\r'
  else
    curl -s --max-time 3 "http://127.0.0.1:$PORT/json/version" || echo "no browser on port $PORT"
  fi
}

launch() {
  local profile="${1:-default}" url="${2:-about:blank}"
  setup >/dev/null
  if is_wsl; then
    local dir="$RB_HOME_WIN\\profiles\\$profile" res
    res="$(powershell.exe -NoProfile -Command '$c = @("$env:ProgramFiles\Google\Chrome\Application\chrome.exe","${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe","$env:LocalAppData\Google\Chrome\Application\chrome.exe","$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe","${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1; if (-not $c) { $c = Get-ChildItem -Recurse -Filter chrome.exe "$env:USERPROFILE\.real-browser\browsers" -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName }; if (-not $c) { Write-Output "NOCHROME"; exit }; Start-Process $c -ArgumentList "--remote-debugging-port='"$PORT"'","--user-data-dir='"$dir"'","--no-first-run","--no-default-browser-check","'"$url"'"; Write-Output "opened $c"' | tr -d '\r')"
    if [[ "$res" == *NOCHROME* ]]; then [[ -n "${RB_TRIED_INSTALL:-}" ]] && { echo "Não consegui achar nem baixar o Chrome." >&2; exit 1; }; install_chrome >/dev/null; RB_TRIED_INSTALL=1 launch "$profile" "$url"; return; fi
    echo "$res"
  else
    local dir="$RB_HOME_LX/profiles/$profile" bin=""
    if [[ "$(uname)" == "Darwin" ]]; then
      for b in "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" "/Applications/Chromium.app/Contents/MacOS/Chromium" "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"; do [[ -x "$b" ]] && bin="$b" && break; done
    else
      for b in google-chrome google-chrome-stable chromium chromium-browser microsoft-edge; do command -v "$b" >/dev/null && bin="$(command -v "$b")" && break; done
    fi
    [[ -n "$bin" ]] || bin="$(find "$RB_HOME_LX/browsers" -type f \( -name chrome -o -name 'Google Chrome for Testing' \) -perm -u+x 2>/dev/null | head -1)"
    [[ -n "$bin" ]] || bin="$(install_chrome)"
    [[ -x "$bin" ]] || { echo "Não consegui achar nem baixar o Chrome." >&2; exit 1; }
    nohup "$bin" --remote-debugging-port="$PORT" --user-data-dir="$dir" --no-first-run --no-default-browser-check "$url" >/dev/null 2>&1 &
    echo "opened $bin"
  fi
  for _ in 1 2 3 4 5 6 7 8 9 10; do sleep 1; status | grep -q Browser && { echo "ready on port $PORT"; return; }; done
  echo "Chrome did not open the port $PORT (is another Chrome using this profile without the port? close it and retry)" >&2
}

case "${1:-}" in
  setup) setup ;;
  status) status ;;
  launch) shift; launch "$@" ;;
  ""|-h|--help) sed -n 2,12p "$0" ;;
  *) run_node "$@" ;;
esac
