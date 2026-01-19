# 🚀 Fullstack Engineer Challenge – Music Licensing Workflow

Welcome to the **Fullstack Engineer Challenge!** 🎸🎬  
In this challenge, you'll help the fictional company **ACME BROS PICTURES** build a system to manage the **music licensing process** for their movies.

## 🎯 Context

Each movie scene can contain **multiple music tracks**, and each track requires licensing. The licensing process involves back-and-forth negotiations with rights holders (artists or labels), which makes tracking each license's progress essential.

Your task is to create a simple system to:

- Manage **tracks** for each movie scene.
- Associate a **song** to each track, specifying its start and end time.
- Track the **licensing status** of each song via a stateful workflow.
- Provide a way for other users to **immediately see updates** in licensing status (real-time or near real-time visibility).

## 📌 Requirements

### ⚙️ Tech Stack

> ⚡ **Must Include** - Use the following technologies, aligned with our tech stack:

- **Backend:** You can use any stack you're comfortable with, but we recommend using any of the following:
  - TypeScript + NestJS (you can use Fastify or Koa if you prefer)
  - Python + FastAPI (you can use Flask or Django if you prefer)
  - Go + Fiber (you can use Gin or Echo if you prefer)
- **API:** REST and/or GraphQL (you choose, and justify your choice if you only use one)
- **Frontend:** React (using any framework such as Next.js, Remix, or bare metal with Vite)
- **Database:** PostgreSQL (primary), MongoDB (optional if needed)
- **Containerization:** Docker (required)
- **Bonus:** Kafka, Redis, ArgoCD, Kubernetes (if you want to go further)

### 📦 Deliverables

> 📥 **Your submission must be a Pull Request that includes:**

- A **backend** exposing the required APIs.
- A **data model** to manage:
  - Movies, scenes, tracks, songs, and their licensing states.
- Endpoints or queries/mutations to:
  - Create a track and associate a song.
  - Update the licensing state of a track.
  - Query all tracks for a given scene/movie, including licensing status.
- A **frontend built with React** to:
  - Visualize the movie scenes and associated tracks.
  - Show licensing status.
  - Allow status updates (basic UI).
- Suggest a real-time implementation using WebSockets, GraphQL Subscriptions, or Server-Sent Events.
- Docker setup to run the entire app locally.
- A `README.md` with:
  - Setup instructions
  - Tech decisions and tradeoffs
  - If applicable, your reasoning for using REST, GraphQL, or both

> [!TIP]
> Use the `docs` folder to store any additional documentation or diagrams that help explain your solution.
> Mention any assumptions or constraints in your `README.md`.

### 📂 Folder Suggestions

You can organize your project like this (suggested but not mandatory):

```txt
/
├── .github/
│   ├── workflows/
│   └── PULL_REQUEST_TEMPLATE.md
├── docs/
├── backend/
│   ├── src/
│   ├── test/
│   └── Dockerfile
├── frontend/
│   ├── src/
│   ├── public/
│   └── Dockerfile
├── compose.yml
├── .env.example
├── README.md
├── .prettierrc.js
├── eslint.config.mjs
└── . . .
```

## 🌟 Nice to Have

> 💡 **Bonus Points For:**

- Automated testing and CI pipeline using GitHub Actions.
- Unit or integration tests for API or key logic.
- Use of MongoDB for unstructured metadata (if justified).
- Real-time suggestion implemented (e.g., via GraphQL subscriptions or WebSockets).
- Basic usage of **Kafka or Redis** (e.g., async event messaging).
- Usage of ArgoCD or Kubernetes (not expected, but definitely cool).

> [!TIP]
> Looking for inspiration or additional ideas to earn extra points? Check out our **[Awesome NaNLABS repository](https://github.com/nanlabs/awesome-nan)** for reference projects and best practices! 🚀

## 🧪 Submission Guidelines

> 📌 **Follow these steps to submit your solution:**

1. **Fork this repository.**
2. **Create a feature branch** for your implementation.
3. **Commit your changes** with meaningful commit messages.
4. **Open a Pull Request** following the provided template.
5. **Our team will review** and provide feedback.

## ✅ Evaluation Criteria

> 🔍 **What we'll be looking at:**

- Ability to **work across the stack** (NestJS, PostgreSQL, React/Next.js/. . .).
- Clean, modular and maintainable code with proper Git usage.
- A good understanding of **data modeling and workflow management**.
- Clear written communication in your README.
- Ability to **propose real-time solutions**, even if not implemented.

## 💬 Final Notes

> [!TIP]
> This challenge is designed to be flexible!

Here are some tips to help you succeed:

- If you feel confident on the backend but less on the frontend, focus there—but try to show some basic UI.
- Likewise, if you're stronger on the frontend, make sure your backend has clean structure and endpoints.
- Time-box it: we don’t expect perfection. We want to see **how you think and solve problems**.

## 🏁 Good luck and have fun building

If you have any questions, feel free to reach out.
