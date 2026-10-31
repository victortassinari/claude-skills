# Despacho para modelos e CLIs

Rode tudo em segundo plano, a partir da pasta `motion/`, um processo por estúdio. Cada estúdio recebe **um prompt** com: leitura obrigatória de `BRIEF.md` e `logo-data.js`, as duas pastas (uma dirigida e uma livre), o autor para o `meta.js` e as restrições (não abrir navegador, não rodar comandos, testes ou builds, só escrever nas próprias pastas, criar o `meta.js` por último).

Monte os prompts com um script (Python com `str.format`), não com `sed`: substituir marcadores como `DIR` com sed corrompe palavras que os contêm ("DIRECAO" vira "<pasta>ECAO").

## Claude (subagentes do Claude Code)

`Agent` com `subagent_type: general-purpose`, `model: opus` ou `fable`, `run_in_background: true`. Prompt autossuficiente (o subagente não vê a conversa). Para corrigir uma entrega, use `SendMessage` para o mesmo agente, com a lista exata do que está errado.

## Codex CLI

```bash
codex exec -m <modelo> -c model_reasoning_effort="high" -s workspace-write --skip-git-repo-check -C "<pasta motion>" "<prompt>" > log 2>&1
```
`-s workspace-write` limita a escrita à pasta. Lista de modelos: os `slug` em `~/.codex/models_cache.json` (leia com `encoding='utf-8'`). Codex é confiável e rápido (10 a 15 min por rodada); vale encadear duas rodadas no mesmo processo em segundo plano.

## Antigravity (`agy`, modelos Gemini)

```bash
agy -p "<prompt>" --model <id> --sandbox --dangerously-skip-permissions --add-dir "<pasta motion>" > log 2>&1
```
`agy models` lista os IDs (ex.: `gemini-4-argon-high`). Em modo `-p` ele **não consegue pedir permissão**: com `--mode accept-edits` a leitura de arquivo é negada e ele termina sem fazer nada ("no output produced"). `--sandbox` restringe o terminal e `--dangerously-skip-permissions` libera as ferramentas; mantenha o prompt proibindo comandos. Gemini entregou rápido (5 a 10 min) e com qualidade alta; vale dar a ele as direções livres extras.

## Grok CLI

```bash
grok --prompt-file prompt.txt --cwd "<pasta motion>" -m grok-4.7 --reasoning-effort high \
  --permission-mode acceptEdits --allow Write --allow Edit --no-subagents --disable-web-search \
  --rules "Não use ferramentas MCP nem busca na web; tudo está em BRIEF.md e logo-data.js." > log 2>&1
```
Sem `--allow Write --allow Edit`, a criação de arquivo novo é bloqueada em modo headless e ele termina sem gravar nada, depois de pensar por meia hora. Sem `--rules` e `--disable-web-search`, ele tenta MCPs (Context7) que não estão autorizados e para. Ele demora (20 a 40 min por rodada); não conclua que travou só porque o log está vazio: acompanhe `~/.grok/sessions/<pasta codificada>/<sessão>/events.jsonl` (o tipo do último evento e o horário mostram se está raciocinando ou escrevendo).

## opencode

```bash
opencode run -m <provedor>/<modelo> --dir "<pasta motion>" "<prompt>" > log 2>&1
```
`opencode models` lista tudo. Atenção ao **provedor**: `opencode/<modelo>` usa créditos pagos (falha com "Insufficient account funds" se não houver saldo); o plano assinado costuma estar em outro provedor (ex.: `opencode-go/<modelo>`). Pergunte ao usuário qual plano ele tem.

- O plano tem **limite de uso por janela de tempo**. Disparar 5 modelos de uma vez estoura a cota (`429 ... usage limit exceeded`) e nenhum entrega nada. Rode **um modelo por vez** e só dispare o seguinte quando o anterior terminar.
- Diagnóstico: o log do terminal fica parado. O erro real está em `~/.local/share/opencode/log/<data>.log` (procure `service=llm` com `ERROR`, o `statusCode` e a `message`).
- Alguns modelos rejeitam o esquema das ferramentas do opencode (Kimi: "not a valid moonshot flavored json schema"); tente `--pure` (sem plugins) ou outro modelo.
- Cada processo do opencode ocupa cerca de 1 GB de RAM.

## Regras da máquina

- Os agentes só escrevem arquivos. Validação com navegador é sua, **uma de cada vez**.
- Antes de disparar de novo, confira os processos que sobraram (`tasklist` ou `Get-Process`) e encerre os duplicados ou os com modelo errado.
- Registre o autor real de cada proposta na galeria (`slots.js`) e no `meta.js`. Se trocar o modelo de uma direção, atualize os dois.
