# Reuniator

Aplicação web para encontrar o melhor horário comum para reuniões/eventos em grupo.

O fluxo é simples:
1. Um organizador cria um evento (título, dias possíveis e janela de horário).
2. Compartilha o link do evento.
3. Cada participante marca sua disponibilidade em uma grade de 15 em 15 minutos.
4. A aplicação mostra um heatmap com os melhores horários para o grupo.

## O que a aplicação faz

- **Criação guiada de evento em 2 etapas**:
  - etapa 1: título do evento;
  - etapa 2: seleção de datas no calendário + faixa de horário permitida.
- **Entrada de participantes por nome** no link do evento.
- **Grade de disponibilidade individual** com marcação rápida por arraste (mouse e toque).
- **Heatmap de disponibilidade do grupo** mostrando quantas pessoas podem em cada slot.
- **Tooltip por célula** com lista de disponíveis e indisponíveis.
- **Atualização e persistência via API** usando banco SQLite com Prisma.
- **Detecção de fuso local** no momento da criação do evento.
- **Experiência mobile** com abas e modo de pintura rápida.

## Stack técnica

- **Next.js 16** (App Router, rotas API no próprio app).
- **React 19 + TypeScript**.
- **Prisma** como ORM.
- **SQLite** como banco de dados.
- **CSS global customizado** (tema dark com glassmorphism).

## Estrutura principal

- `src/app/page.tsx`: página inicial (captura título).
- `src/app/create/schedule/page.tsx`: configuração de datas e janela de horários.
- `src/app/event/[id]/page.tsx`: tela do evento com grade individual e heatmap coletivo.
- `src/app/api/events/route.ts`: cria evento.
- `src/app/api/events/[id]/route.ts`: consulta evento completo.
- `src/app/api/events/[id]/participants/route.ts`: adiciona (ou reutiliza) participante por nome.
- `src/app/api/events/[id]/availability/route.ts`: sobrescreve disponibilidade do participante.
- `prisma/schema.prisma`: modelos de dados.

## Modelo de dados (resumo)

- **Event**: título, criador, timezone, faixa de horário, datas e participantes.
- **EventDay**: datas permitidas para o evento.
- **Participant**: participante vinculado a um evento.
- **Availability**: slots de disponibilidade (`date` + `time`) por participante.

Há restrição de unicidade por participante/data/hora para evitar duplicidade de slots.

## Como rodar localmente

### 1) Pré-requisitos

- Node.js 20+
- npm

### 2) Instalar dependências

```bash
npm ci
```

### 3) Configurar variáveis de ambiente

Crie um arquivo `.env` na raiz:

```env
DATABASE_URL="file:./dev.db"
ADMIN_USERNAME="admin"
ADMIN_SESSION_SECRET="troque-por-um-segredo-longo-e-aleatorio"
```

> Observação: com esse valor, o SQLite fica no arquivo `dev.db` na raiz do projeto.

O painel administrativo ficará em `/admin`. No **primeiro acesso**, o sistema exige que você informe o `ADMIN_USERNAME` e defina a senha inicial.

### 4) Preparar banco e Prisma Client

```bash
npx prisma generate
npx prisma db push
```

### 5) Subir em desenvolvimento

```bash
npm run dev
```

Abra `http://localhost:3000`.

## Rodando com Docker

O repositório já inclui `Dockerfile` e `docker-compose.yml`.

```bash
docker compose up --build
```

No compose atual, o container expõe a aplicação em `127.0.0.1:6742`.
O arquivo SQLite é montado em `./dev.db -> /app/prisma/dev.db`, e o container executa `prisma db push --skip-generate` no startup para sincronizar o schema sem tentar reescrever o Prisma Client em runtime.

## Endpoints da API

### `POST /api/events`
Cria evento.

Payload esperado:

```json
{
  "title": "Project Kickoff",
  "creatorName": "Anônimo",
  "dates": ["2026-04-20", "2026-04-21"],
  "timeRangeStart": "09:00",
  "timeRangeEnd": "17:00",
  "timezone": "America/Sao_Paulo"
}
```

### `GET /api/events/:id`
Retorna evento com dias, participantes e disponibilidades.

### `POST /api/events/:id/participants`
Cria/retorna participante por nome no evento.

Payload:

```json
{ "name": "Maria" }
```

### `POST /api/events/:id/availability`
Sobrescreve toda a disponibilidade de um participante.

Payload:

```json
{
  "participantId": "uuid-do-participante",
  "availabilities": [
    { "date": "2026-04-20", "time": "09:00" },
    { "date": "2026-04-20", "time": "09:15" }
  ]
}
```

## Observações importantes

- O nome do participante é salvo no `localStorage` para facilitar retorno ao evento.
- O criador do evento também é marcado no `localStorage` para habilitar botão de copiar link.
- A janela de horário aceita intervalos que atravessam meia-noite (ex.: `22:00` → `02:00`).
- O script `cleanup_events.py` agora arquiva estatísticas dos eventos removidos na tabela `EventArchive`, permitindo métricas históricas no painel `/admin`.

## Próximas melhorias sugeridas

- Autenticação real (em vez de identificação só por nome).
- Compartilhamento com permissões (organizador vs participante).
- Sugestão automática de “melhor slot” com ranking.
- Internacionalização completa de textos (há mistura PT/EN na UI atual).
- Modo de edição de evento após criação.
