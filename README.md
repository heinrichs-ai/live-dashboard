# Live Dashboard

[English](#english) · [Português](#português)

## English

An agent skill that creates and maintains a local live web dashboard for long-running tasks.
Watch progress, elapsed time, active workstreams, quality gates, results, live log tails, and a timestamped activity feed in your browser without staring at the chat window.

Built with Node.js built-ins only. Zero npm dependencies. Localhost only (`127.0.0.1`).

### What it shows

- Live status indicator, phase, current action, progress bar, and elapsed timer.
- Stage pills, summary metric cards, and locked decisions.
- Workstream cards with owners, status badges, per-item progress, and inline log tails.
- Results table, quality gate checklist, standalone log tails, and a live activity feed.
- Instant browser updates over Server-Sent Events (SSE) with light and dark themes.

### Requirements

- Node.js 18 or newer.

### Install

```sh
npx skills add heinrichs-ai/live-dashboard
```

For Claude, download the [skill ZIP](https://github.com/heinrichs-ai/live-dashboard/releases/latest/download/live-dashboard.zip).
Upload it through Customize -> Skills.

For Codex, Cursor, or Copilot, copy `SKILL.md`, `references/`, `resources/`, and `scripts/` into `~/.agents/skills/live-dashboard/`.
For Claude Code, use `~/.claude/skills/live-dashboard/`.

To use the skill in one project only, place its folder under that project's skills directory (for example, `.agents/skills/live-dashboard/`).

### Skill files

- `SKILL.md`: Main instructions and CLI reference for the assistant.
- `scripts/init.mjs`: Scaffolds a standalone dashboard in a temporary or scratch directory.
- `scripts/server.mjs`: Runs the localhost SSE server on a free port (`127.0.0.1`).
- `scripts/update.mjs`: Updates `state.json` atomically and appends to `events.jsonl`.
- `resources/index.html`: Single-file dashboard UI with light/dark mode and SSE streaming.
- `references/patterns.md`: Recipes for parallel builds, eval loops, reviewer panels, and custom themes.

### Try it

- "Start a live dashboard for this migration so I can track each service in my browser."
- "Run these 4 parallel builds and keep a live status page open with test and lint gates."
- "Open a dark-mode dashboard to track our benchmark loop and tail the worker logs."

### Run tests

```sh
node --test test/dashboard.test.mjs
```

### License

MIT. See [LICENSE](./LICENSE).

## Português

Uma skill para agentes que cria e atualiza um painel web local em tempo real para tarefas longas.
Acompanhe o progresso, o tempo decorrido, as frentes ativas, os critérios de qualidade, os resultados, os logs ao vivo e o histórico de eventos no navegador sem precisar vigiar o chat.

Feita apenas com módulos nativos do Node.js. Sem dependências npm. Apenas em localhost (`127.0.0.1`).

### O que o painel mostra

- Indicador ao vivo, fase atual, ação em andamento, barra de progresso e cronômetro.
- Etapas, cartões de métricas e decisões definidas.
- Cartões de frentes de trabalho com responsável, selos de status, progresso individual e trechos de log.
- Tabela de resultados, lista de validações, logs ao vivo e linha do tempo com horário.
- Atualização instantânea no navegador via Server-Sent Events (SSE), com tema claro e escuro.

### Requisitos

- Node.js 18 ou superior.

### Instalar

```sh
npx skills add heinrichs-ai/live-dashboard
```

No Claude, baixe o [ZIP da skill](https://github.com/heinrichs-ai/live-dashboard/releases/latest/download/live-dashboard.zip).
Envie o arquivo em Customize -> Skills.

No Codex, Cursor ou Copilot, copie `SKILL.md`, `references/`, `resources/` e `scripts/` para `~/.agents/skills/live-dashboard/`.
No Claude Code, use `~/.claude/skills/live-dashboard/`.

Para usar a skill apenas em um projeto, coloque a pasta no diretório de skills desse projeto (por exemplo, `.agents/skills/live-dashboard/`).

### Arquivos da skill

- `SKILL.md`: Instruções principais e referência de CLI para o assistente.
- `scripts/init.mjs`: Cria um painel independente em uma pasta temporária ou de rascunho.
- `scripts/server.mjs`: Inicia o servidor SSE local em uma porta livre (`127.0.0.1`).
- `scripts/update.mjs`: Atualiza `state.json` de forma atômica e registra eventos em `events.jsonl`.
- `resources/index.html`: Interface em arquivo único com tema claro/escuro e streaming SSE.
- `references/patterns.md`: Receitas para builds paralelos, loops de avaliação, painéis de revisão e temas.

### Experimentar

- "Abra um painel ao vivo para esta migração para eu acompanhar cada serviço no navegador."
- "Execute estes 4 builds em paralelo e mantenha uma página de status com testes e lint."
- "Crie um painel em modo escuro para acompanhar os benchmarks e os logs dos workers."

### Executar testes

```sh
node --test test/dashboard.test.mjs
```

### Licença

MIT. Consulte [LICENSE](./LICENSE).
