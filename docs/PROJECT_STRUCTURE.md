# Project structure

zentutor.ai is organized around three boundaries: the FastAPI application, the React client, and the authored learning content.

```text
zentutor.ai/
|-- backend/
|   |-- app/              FastAPI routes, persistence, curriculum, and teacher service
|   |-- tests/            Backend integration and provider-behaviour tests
|   `-- requirements.txt  Pinned Python dependencies
|-- frontend/
|   |-- src/              React application and styles
|   |-- tests/            Playwright browser flows
|   |-- package.json       Frontend scripts and dependencies
|   `-- package-lock.json  Reproducible Node dependency lockfile
|-- data/
|   `-- roadmap.json      Checked-in source objectives for the current curriculum
|-- docs/                 Validation records, next milestones, and project documentation
|-- scripts/              Reproducible maintenance and import scripts
|-- setup.ps1             One-command local setup
|-- start.ps1             Local production server launcher
`-- README.md             Product overview and operating instructions
```

Generated or machine-local files are intentionally excluded from the project structure: `.venv/`, `frontend/node_modules/`, `frontend/dist/`, Python caches, test output, runtime logs, and `.env` files. The SQLite file at `data/mentor.db` is also ignored because it contains private learner state and is created at runtime.

Keep business logic in `backend/app`, UI behaviour in `frontend/src`, and authored curriculum changes in `backend/app/curriculum.py` or the source roadmap data. Add tests beside the boundary they protect.