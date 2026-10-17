# AfterHours

**Watch together. Even when you're apart.**

AfterHours is a real-time watch-party platform that brings people together through synchronized video playback, live chat, reactions, polls, and shared playlists. It aims to make watching content with friends feel effortless, no matter where they are.

**Live Demo:** [afterhours-watchparty.vercel.app](https://afterhours-watchparty.vercel.app)

## Features

- **Synchronized Playback** — Keep everyone in the room aligned during shared viewing.
- **Real-Time Chat** — Communicate with participants instantly.
- **Live Reactions** — Share reactions as moments unfold.
- **Interactive Polls** — Make group viewing more engaging with live voting.
- **Shared Playlists** — Organize content for group watch sessions.
- **Party Rooms** — Create watch parties and invite friends to join.

## Tech Stack

- **Frontend:** Next.js
- **Real-Time Communication:** Socket.IO
- **Database Modeling:** Prisma ORM and PostgreSQL schema
- **Deployment:** Vercel and a dedicated real-time backend

## Getting Started

### Prerequisites

- Node.js
- npm
- Git

### Installation

```powershell
git clone <YOUR_REPOSITORY_URL>
cd <YOUR_REPOSITORY_DIRECTORY>
Copy-Item .env.example .env
npm install
```

Configure the environment variables in `.env` for your local environment.

### Run Locally

```powershell
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to explore the application.

To test a watch party with multiple participants, create a room and open its invitation link in a separate browser session.

## Testing

Run the automated test suite:

```powershell
npm run test
```

To exercise the real-time communication layer with ten simulated clients:

```powershell
npm run test:load
```

The load-testing script checks message delivery to connected clients and retrieves delivery measurements from the backend health endpoint.

## Architecture

AfterHours separates the web application from its real-time communication service. This architecture allows the user interface and event-driven backend to operate independently while supporting interactive, multi-user experiences.

The repository also includes a Prisma schema for modeling structured application data.

## Project Highlights

- Real-time, event-driven application architecture
- Multi-user communication using WebSockets
- Collaborative and interactive user experiences
- Automated testing and simulated-client load testing
- Live deployment and hands-on full-stack development

## Documentation

- [Implementation Plan](IMPLEMENTATION_PLAN.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Performance Report](docs/PERFORMANCE_REPORT.md)
- [Demonstration Runbook](docs/DEMO_RUNBOOK.md)

## Future Scope

- Persistent storage for watch-party sessions
- Enhanced playback synchronization and resilience
- Expanded testing under concurrent user loads
- Further improvements to collaborative viewing features

---

Built to make online movie nights feel more connected.
