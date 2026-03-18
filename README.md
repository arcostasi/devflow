<div align="center">

# DevFlow

**An open-source agile project management platform for modern teams.**

React 19 · TypeScript · Express 5 · SQLite · TailwindCSS

</div>

---

DevFlow is a comprehensive software project management tool designed for teams practicing **Scrum** and **XP (Extreme Programming)**. It combines a Kanban board, visual local Git operations, deployment environment tracking, and external integrations (GitLab/ClickUp API v3 + ClickUp MCP) all in one modern, sleek interface.

## ✨ Key Features

- **Real-time Dashboard**: Track metrics, sprint velocity, burndown charts, and a GitHub-style activity heat map.
- **Kanban Board**: Drag-and-drop board with WIP limits, priority filtering, and detailed task management (sub-tasks, tracing, DoR/DoD).
- **Product Backlog**: Centralized backlog with easy Sprint assignment and GitLab issue syncing.
- **Local Git Integration**: Perform real Git operations (`status`, `add`, `commit`, `pull`, `push`, `checkout`) visually within your local repositories.
- **Deployments & Pipelines**: Track your Dev, Stage, and Prod environments, promote releases, and view CI/CD pipelines.
- **Dark/Light Mode**: Beautiful UI with Glassmorphism effects, a command palette (Ctrl+K), and responsive design.

## 🚀 Getting Started

### Prerequisites

- **Node.js**: v18 or higher
- **Git**: Installed and available in your OS PATH

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/devflow.git
   cd devflow
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Environment Setup:
   Copy the example environment file and configure your variables (optional for local testing).
   ```bash
   cp .env.example .env
   ```

### Running the Application

DevFlow runs both the frontend and backend concurrently using a single command:

```bash
npm run dev
```

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001

*Note: On first run, the local SQLite database (`devflow.db`) will be automatically seeded.*

**Default Admin Credentials:**
- Email: `admin@devflow.local`
- Password: `admin123`

### Production Build

```bash
npm run build    # Generates optimized assets in dist/
npm run preview  # Local preview of the production build
```

## 🛠️ Tech Stack

- **Frontend**: React 19, TypeScript, Vite, TailwindCSS, Lucide Icons
- **Backend**: Express 5, Better-SQLite3, JWT Authentication
- **Tools**: ESLint, PostCSS, Concurrently

## 🤝 Contributing

We welcome contributions! If you're looking to help out:

1. Fork the project
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes following [Conventional Commits](https://www.conventionalcommits.org/) (`git commit -m 'feat: Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

**Development Guidelines:**
- Code strictly in TypeScript.
- Ensure your code passes the linter: `npm run lint`

## 📄 License

This project is licensed under the MIT License.
