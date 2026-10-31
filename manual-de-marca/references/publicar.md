# Publicar o manual (site estático, sem indexação)

Estrutura publicada: o manual na raiz (`/`), `/motion/` com a galeria, `/marca-manual.pdf` e `/marca-pacote.zip` na raiz, e `robots.txt` com `Disallow: /`.

## Bloqueio de robôs em três camadas

1. `robots.txt`: `User-agent: *` / `Disallow: /`.
2. Cabeçalho `X-Robots-Tag: noindex, nofollow, noarchive, nosnippet, noimageindex` em **todas** as respostas, inclusive PDF e ZIP (a meta tag não alcança arquivos binários), mais `<meta name="robots">` nas páginas.
3. 403 para user-agents de rastreadores e robôs de IA (`assets/nginx.conf`).

Avise o usuário: a camada 3 também barra quem gera prévia de link (WhatsApp, Slack, LinkedIn); o link funciona, mas pode chegar sem miniatura.

## Container

```
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY site /usr/share/nginx/html
```

## CapRover (API, sem CLI)

Peça a URL do painel e a senha ao usuário; use a senha só na chamada de login e não grave em arquivo. Guarde só o token de sessão, num arquivo temporário, e apague ao terminar.

- Login: `POST /api/v2/login` `{"password": ...}` → `data.token`. Cabeçalhos das demais chamadas: `x-captain-auth: <token>`, `x-namespace: captain`.
- Domínio raiz: `GET /api/v2/user/system/info` → `rootDomain`; o app fica em `https://<app>.<rootDomain>`.
- Criar app: `POST /api/v2/user/apps/appDefinitions/register` `{"appName", "hasPersistentData": false}`. A resposta pode se perder (página de timeout) mesmo com o app criado: confira em `GET /api/v2/user/apps/appDefinitions` antes de tentar de novo.
- Deploy: `POST /api/v2/user/apps/appData/<app>?detached=1` com multipart `sourceFile` = tar.gz contendo `captain-definition` (`{"schemaVersion":2,"dockerfilePath":"./Dockerfile"}`), `Dockerfile`, `nginx.conf` e `site/`. Acompanhe `GET /api/v2/user/apps/appData/<app>` até `isAppBuilding` ser falso.
- SSL: `POST /api/v2/user/apps/appDefinitions/enablebasedomainssl` **depois** do primeiro deploy (antes, falha com "Verification Failed").
- HTTPS forçado: `POST /api/v2/user/apps/appDefinitions/update` com a definição atual inteira e `forceSsl: true`.

Outros destinos (Vercel, Netlify, Cloudflare Pages, S3) funcionam igual: o essencial é o cabeçalho `X-Robots-Tag` em todas as respostas e o `robots.txt`.

## Validação depois de publicar

- Todas as URLs principais respondem 200 com user-agent de navegador.
- O ZIP e o PDF baixados são idênticos aos locais (hash).
- Todos os links internos do manual respondem 200; nenhuma imagem quebrada; nenhum erro de JavaScript (Playwright).
- Robôs (Googlebot, GPTBot, ClaudeBot, CCBot) recebem 403; `robots.txt` responde 200.
- `http://` redireciona para `https://`.
