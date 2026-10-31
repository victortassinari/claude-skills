# claude-skills

Skills para o Claude Code (e outros agentes compatíveis com o formato de skills).

| Skill | Para quê |
|---|---|
| real-browser | O agente usa o seu Chrome de verdade |
| vetorizar-logo | Logo em PNG para SVG fiel |
| manual-de-marca | Identidade visual completa, PDF, peças, Word e ZIP |
| motion-de-logo | Animações do logo feitas por vários modelos |
| video-demo-narrado | Vídeo narrado de demonstração de app |

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

## Marca: vetorizar-logo, manual-de-marca e motion-de-logo

Três skills que funcionam em sequência (ou sozinhas) para montar a identidade visual de uma marca a partir de quase nada: um PNG do logo e o site.

- **vetorizar-logo**: reconstrói em SVG um logo que só existe em PNG, encaixando os glifos reais da fonte (escala, posição de cada letra, espessura do traço) e verificando pixel a pixel. Gera variantes de cor, curvas cúbicas lisas e `logo-data.js` com cada letra separada para animação. Script: `scripts/vetorizar.py` (Python).
- **manual-de-marca**: manual em HTML interativo e PDF A4 com sumário, cores, tipografia, construção do logo, área de proteção, usos incorretos, grafismos, fundos para reunião, LinkedIn, slides, assinaturas de e-mail, folder, papel timbrado em Word (.docx e .dotx com fontes embutidas), crachá, pacote ZIP organizado e publicação como site fechado para robôs.
- **motion-de-logo**: várias propostas de animação do logo (vídeo, web, loading, splash, transições, lower thirds) feitas em paralelo por modelos diferentes (subagentes Claude, Codex, Gemini via agy, Grok, opencode), com galeria que se atualiza sozinha, validação por quadros e revisão de qualidade.

Requisitos principais: Python 3 com `numpy scipy pillow matplotlib fonttools skia-python skia-pathops playwright pymupdf`, e Node.js (`docx`) para o Word. O papel timbrado em Word usa o Microsoft Word no Windows para embutir as fontes.

## video-demo-narrado

Vídeo de demonstração narrado de um app web, como código: tela gravada por roteiro (Playwright, desktop e celular), voz por IA (ElevenLabs), legendas e trilha, montado no Remotion. Inclui versões verticais para redes e soluções para render travado, celular borrado e narração fora de sincronia. Precisa de Node.js e de uma chave da ElevenLabs.

## Instalar qualquer uma

```bash
npx skills add victortassinari/claude-skills@<nome-da-skill> -g
```

Ou copie a pasta da skill para `~/.claude/skills/` (Windows: `%USERPROFILE%\.claude\skills\`) e reinicie o Claude Code.
