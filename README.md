# claude-skills

Skills para o Claude Code (e outros agentes compatíveis com o formato de skills).

## real-browser

O agente usa o **seu Chrome de verdade**, visível e com perfil próprio: você faz o login à mão (senha, 2FA) e ele navega, lê, preenche e clica, conferindo um print a cada passo. Serve para painéis sem API (Meta for Developers, consoles de nuvem, áreas administrativas), formulários e fóruns.

- Windows (inclusive chamado do WSL), macOS e Linux.
- Instala sozinho o que falta: `puppeteer-core` numa pasta própria (`~/.real-browser`) e, se não houver Chrome, Edge nem Chromium, o Chrome for Testing oficial do Google. Único requisito: Node.js.
- Nunca digita senha, pede confirmação antes de ações públicas ou irreversíveis e não tenta esconder a automação.

### Instalar

```bash
npx skills add victortassinari/claude-skills@real-browser -g
```

Ou copie a pasta `real-browser/` para `~/.claude/skills/` (Windows: `%USERPROFILE%\.claude\skills\`) e reinicie o Claude Code.

### Usar

Peça ao agente algo como "abre o painel da Meta e configura o app pra mim". Ele chama `real-browser`, abre o Chrome e pede que você faça o login. Os comandos estão no `SKILL.md`.

### Atualizar

```bash
npx skills update
```
