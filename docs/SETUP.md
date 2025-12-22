# Guia de Setup Completo — promolinxy-saas-bot-whatsapp

Este documento explica em detalhe tudo o que você precisa para rodar o projeto localmente e em produção, como resolver problemas comuns (Docker no Windows, fontes, variáveis de ambiente), e quais passos executar para disponibilizar o sistema.

Conteúdo

- Requisitos
- Preparar variáveis de ambiente (.env)
- Rodar com Docker Compose (recomendado)
- Rodar em desenvolvimento (frontend Next.js somente)
- Troubleshooting Docker no Windows (erro de pipe / daemon)
- Banco de dados e `DATABASE_URL` (erro: `sql is not a function`)
- Fontes (evitar Google Fonts) — 2 opções
- Passos para deploy em produção (pointers)

---

## 1) Requisitos

- Node.js 18+ (recomendado 18 ou 20 LTS)
- pnpm (recomendado) ou npm/yarn
- Docker Desktop (Windows/Mac) — obrigatório se quiser rodar via Docker Compose
- WSL2 (Windows) recomendado quando usar Docker Desktop
- PostgreSQL (opcional local se você não usar o container bundlado)

## 2) Preparar variáveis de ambiente

Existe um arquivo de exemplo `.env.example` no repositório.

1. Copie para `.env`:

\`\`\`bash
cp .env.example .env
# ou em PowerShell
# copy .env.example .env
\`\`\`

2. Ajuste os valores: `JWT_SECRET`, `CAKTO_WEBHOOK_SECRET`, `DATABASE_URL` etc.

- Se você for usar o `docker compose` provido, deixe o `DATABASE_URL` apontando para o serviço `postgres` como no `.env.example`:

\`\`\`
DATABASE_URL=postgresql://saasbot:saasbot123@postgres:5432/saasbot
\`\`\`

- Para rodar somente o frontend em dev use um Postgres local ou uma string SQLite/Neon conforme seu ambiente.

## 3) Rodar com Docker Compose (recomendado)

Eu removi a chave `version: '3.8'` do `docker-compose.yml` para evitar a mensagem de depreciação quando usar o plugin Compose moderno.

1. Certifique-se que o Docker Desktop está instalado e rodando (ver seção Troubleshooting).

2. Para subir toda a stack:

\`\`\`bash
# Use o plugin moderno (recomendado)
docker compose up --build -d

# Ver logs
docker compose logs -f

# Ver status
docker compose ps
\`\`\`

3. O dashboard ficará disponível em `http://localhost:3000` (ou `http://127.0.0.1:3000`).

Observação: se você usa `docker-compose` (com hífen) e esse binário não funcionar, prefira `docker compose` (sem hífen). A versão com hífen é legada.

## 4) Rodar em desenvolvimento (apenas frontend)

Se preferir desenvolver apenas no Next.js localmente:

\`\`\`bash
pnpm install
pnpm dev
# ou
npm install
npm run dev
\`\`\`

- Lembre-se de configurar `.env` com `DATABASE_URL` e `JWT_SECRET` se endpoints server-side precisarem acessar o DB em rotas durante o desenvolvimento.

## 5) Troubleshooting Docker no Windows — erro: pipe/dockerDesktopLinuxEngine (o seu erro)

Mensagem típica:

\`\`\`
unable to get image 'postgres:16-alpine': error during connect: Get "http://%2F%2F.%2Fpipe%2FdockerDesktopLinuxEngine/v1.51/images/postgres:16-alpine/json": open //./pipe/dockerDesktopLinuxEngine: The system cannot find the file specified.
\`\`\`

Causa: o CLI `docker` não conseguiu se conectar ao daemon do Docker (Docker Desktop não está rodando ou o serviço falhou).

Soluções:

1. Abra o Docker Desktop via o menu Iniciar e espere o ícone indicar que o Docker está pronto ("Docker is running").
2. Rode no terminal:

\`\`\`bash
docker info
docker version
\`\`\`

Se esses comandos retornarem informação, o daemon está OK. Se aparecer erro, o Docker não está rodando.

3. Reinicie o Docker Desktop. Se persistir, reinicie o Windows.

4. Verifique o serviço (PowerShell como administrador):

\`\`\`powershell
Get-Service -Name com.docker.service
\`\`\`

5. Use `docker compose` em vez de `docker-compose`:

\`\`\`bash
docker compose up --build -d
\`\`\`

6. Caso não tenha Docker Desktop instalado, instale-o seguindo as instruções da documentação oficial do Docker e habilite o WSL2 backend se estiver no Windows.

Se você receber erros do tipo "cannot copy to non-directory" ou problemas ao copiar `node_modules` durante o build: crie um `.dockerignore` (este repositório já inclui um) com pelo menos `node_modules` e `.next` para evitar enviar esses diretórios no contexto de build. Isso resolve o erro de `COPY . .` sobrescrevendo o `node_modules` copiado da etapa anterior.

## 6) Banco de dados / `sql is not a function` (erro do Next dev)

Mensagem que apareceu durante `next dev`:

\`\`\`
Database query error: TypeError: sql is not a function
\`\`\`

Possíveis causas e correções:

- `DATABASE_URL` não está definida no ambiente onde o Next roda (rotas do app router fazem consultas ao DB). Verifique `.env` e que o processo Next tem acesso às variáveis.
- Se você estiver rodando com `next dev` sem `DATABASE_URL`, muitas queries falharão. Defina `DATABASE_URL` para apontar a instância Postgres local ou a string `postgresql://...` usada pelo Docker Compose.

Exemplo (local usando container PostgreSQL do compose):

\`\`\`
DATABASE_URL=postgresql://saasbot:saasbot123@localhost:5432/saasbot
\`\`\`

ou, se estiver rodando o frontend dentro do container via compose, use `postgres` como host (nome do serviço do compose):

\`\`\`
DATABASE_URL=postgresql://saasbot:saasbot123@postgres:5432/saasbot
\`\`\`

Importante: depois de ajustar `.env` reinicie o `next dev`.

## 7) Fontes — evitar requests a fonts.googleapis.com

O projeto foi ajustado para usar um stack de fontes do sistema por padrão (melhora compatibilidade em redes restritas). Veja duas opções:

Opção A — usar stack do sistema (já ativo): rápido, sem downloads externos.

- Já configurado: `app/globals.css` define `--font-sans` com uma lista de fontes do sistema.
- Garantia: não há dependência de Google Fonts em tempo de execução.

Opção B — usar fonte específica (Inter) localmente via npm (recomendado se você quer o visual do Inter sem CDN):

1. Instale o pacote:

\`\`\`bash
pnpm add @fontsource/inter
# ou
npm install @fontsource/inter
\`\`\`

2. Importe no topo de `app/globals.css` ou do seu arquivo de estilo global:

\`\`\`css
@import "@fontsource/inter/variable.css"; /* importa a variante variável */
:root {
  --font-sans: "Inter Variable", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}
\`\`\`

3. Reinicie o servidor. As fontes serão servidas localmente a partir do bundle (node_modules) sem ida ao Google CDN.

Opção C — adicionar arquivos de fonte em `/public/fonts` e usar `@font-face` com caminhos absolutos `/fonts/...`.

## 8) Ver logs e depuração

- Logs de containers:

\`\`\`bash
docker compose logs -f
\`\`\`

- Logs do Next dev:

\`\`\`bash
pnpm dev
# veja o output no terminal
\`\`\`

- Se uma rota do servidor (API) der erro `TypeError: sql is not a function`, confirme `DATABASE_URL` e reinicie o processo que está executando a aplicação.

## 9) Build para produção (resumo)

- Ajuste variáveis de ambiente de produção (`DATABASE_URL`, `JWT_SECRET`, `CAKTO_WEBHOOK_SECRET`), não deixe segredos no repositório.
- Use a imagem do Node com sua estratégia preferida (heroku, docker-compose em servidor, Kubernetes, etc.). O repositório já inclui `Dockerfile.frontend` e `Dockerfile.backend`.

---

Se quiser, eu posso:

- Adicionar a importação do `@fontsource/inter` no CSS e atualizar `package.json` para incluir a dependência (faço o patch e instruo como instalar);
- Adicionar um script `scripts/up.sh` para facilitar subir a stack;
- Rodar diagnósticos adicionais para o problema `sql is not a function` (preciso que você me cole o `.env` com `DATABASE_URL` — não envie segredos públicos, mas você pode mascarar os valores mantendo o formato).

Diga qual das opções prefere sobre as fontes (manter sistema, instalar `@fontsource/inter` ou usar arquivos em `/public/fonts`) e eu aplico as mudanças necessárias no código.
