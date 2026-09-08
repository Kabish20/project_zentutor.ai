# zentutor.ai

A personal AI and machine learning engineering teacher, with a React conversation workspace and a FastAPI backend. Connect Gemini or OpenAI to ask questions, receive streamed explanations, discuss code, and continue saved conversations. The app also includes a structured learning path and progress tracking in SQLite.

The **AI Teacher covers the wider AI/ML engineering domain**, including neural networks, PyTorch, transformers, RAG, MLOps, deployment, and interviews. The structured course covers **Weeks 1–4, with 12 lessons and 36 quiz questions**. The original PDF and document-generation files remain in their existing directories.

## Run on Windows

Requires Python 3.11+ and Node.js 20.19+ (or a supported newer Node release).

```powershell
cd D:\material\life\zentutor.ai
.\setup.ps1
.\start.ps1
```

Open **http://127.0.0.1:8000** and create your own account. There are no default credentials. If dependencies and `frontend/dist` are already present, you can run `start.ps1` directly. Press Ctrl+C in the server terminal to stop it.

Manual setup:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
cd frontend
npm ci
npm run build
cd ..
.\.venv\Scripts\python.exe -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000
```

For frontend development, run `npm run dev` in `frontend` alongside the backend. Vite proxies `/api` to port 8000. After changing a production frontend build, restart the backend.

## What works

- A dedicated AI Teacher home with saved conversations, streamed Markdown answers, readable code blocks, copy controls, and a stop button.
- Answer-first explanations, guided teaching, practice, interviews, and code/reasoning review.
- Beginner/intermediate/advanced levels, balanced/step-by-step/concise styles, and English, Tamil, or mixed explanations.
- A private Gemini/OpenAI connection screen that validates key and model access. Generating answers also requires an available model and quota.
- Local registration and login with salted PBKDF2 password hashes, expiring server sessions, and HttpOnly cookies.
- Dashboard with a recommended lesson, current week, review count, and real quiz-attempt totals.
- Twelve lessons covering Python, files, tests, NumPy, pandas, SQL, linear algebra, gradients, optimisation, probability, statistics, and bias.
- Lesson notes, prerequisites, examples, exercises, common mistakes, and roadmap/resource references.
- Tutor modes: teach, practice, revision, and interview. Conversations persist per account and lesson.
- Quiz grading on the server, feedback after submission, latest-score tracking, and review dates.
- Practice submission storage and Python syntax checks. Submitted code is **never executed**.
- Weekly task lists with required evidence notes, available from the dashboard and each curriculum week.
- Responsive desktop/mobile layouts with empty, loading, and error states.

## Connect your AI teacher

1. Open the app and sign in.
2. Open the connection button in **AI Teacher**. A configured project connection is already available after sign-in.
3. To change it for your session, select **Google Gemini** or **OpenAI**, enter that provider's key, choose a model, and connect.
4. Ask a question such as “Explain logistic regression with a small Python example.”

Keys entered in the app are held only in server memory for the current signed-in session. They are not written to SQLite, browser storage, or source files; they are not returned by the settings API. Signing out, session expiry, or restarting the server removes the connection. Conversations and teaching preferences remain saved per account. The key/model check confirms access to that model; billing and quota can still affect subsequent generation. OpenAI API use requires API billing separately from any ChatGPT subscription.

The defaults are [Gemini 3.5 Flash](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash) and [GPT-5.4 Mini](https://developers.openai.com/api/docs/models/gpt-5.4-mini). You can enter another compatible text model available to your API project. The app uses a hosted AI model; it does not train a new foundation model or log into your ChatGPT account.

The current local setup uses Gemini 3.5 Flash. Its credential is saved in **`data/provider.local.json`**, which is gitignored and loaded only by the backend. This project connection survives restarts and is available to accounts on this local server. It is never returned to the browser or stored in conversations. To replace it permanently, edit that local file; the connection form creates a temporary session override instead. Do not include the secrets file when sharing or backing up public source.

Local configuration format (example placeholders only):

```json
{"provider": "gemini", "model": "gemini-3.5-flash", "api_key": "YOUR_GEMINI_API_KEY"}
```

For a connection that survives app restarts, the server operator can instead set environment variables before starting the server:

```powershell
$env:AI_PROVIDER = 'gemini'
$env:GEMINI_API_KEY = '<your API key>'
$env:GEMINI_MODEL = 'gemini-3.5-flash'
.\start.ps1
```

`.env.example` documents environment settings; `.env` files are not automatically loaded. Environment credentials take precedence over the local file. Set `AI_PROVIDER=openai`, `OPENAI_API_KEY`, and `OPENAI_MODEL` to select OpenAI instead. Without `AI_PROVIDER`, Gemini environment credentials take precedence over OpenAI. A key connected through the UI belongs only to that signed-in session and overrides the server connection. Disconnecting disables server fallback for that session. Tests explicitly disable local configuration and use dummy credentials.

The AI Teacher uses [Gemini streaming content generation](https://ai.google.dev/api/generate-content#method:-models.streamgeneratecontent) or [OpenAI streaming Responses API events](https://developers.openai.com/api/docs/guides/streaming-responses). OpenAI requests send `store: false`; Gemini uses its normal project data settings. Keys are sent in authentication headers, never URL query parameters. Each turn supplies the current question, teaching preferences, relevant lesson passages when available, and up to 24 recent messages bounded to approximately 24,000 characters total. This provides recent conversation context, not unlimited memory. Your resume, account password, and other users’ conversations are not included. Provider-side handling remains subject to the provider’s policies.

Answers are generated from the question and recent conversation. The teacher explains directly in its default mode, adapts follow-ups, and offers examples or practice when useful. It does not browse the web, execute code, or claim verified mastery. Saved partial responses are labelled interrupted after stopping or connection failures. Provider errors produce actionable messages; the AI Teacher never substitutes a prepared lesson and presents it as a generated answer.

Without an AI connection, live AI Teacher messaging is unavailable. You can still use the 12 lesson notes, quizzes, practice storage, and the separately labelled curated lesson tutor. Once connected, the lesson tutor uses the selected provider through its structured explanation/example/practice/follow-up adapter.

Gemini 3.5 Flash key/model access and a real streamed teaching answer were verified on 7 September 2026. Automated tests use mocked provider responses, including stream chunks and failure cases; they do not consume your API quota. OpenAI generation remains tested with mocks only.

## Retrieval, provenance, and progress

`data/roadmap.json` contains the original objectives and deliverables for Weeks 1–4, extracted from page 5 of `../roadmap/guide_text.txt`. Regenerate it with `python scripts/import_curriculum.py`. The checked-in extraction lets the app run independently of the PDF pipeline.

`backend/app/curriculum.py` expands those objectives into authored teaching material. Resource URLs come from the original roadmap generator. Lesson tutoring supplies up to three related passages; the AI Teacher supplies up to two and can answer from its broader model knowledge when local lessons do not cover the question. This is **lexical retrieval**, without embeddings or pgvector. Local context is not external research or a guarantee that generated claims have been independently verified.

Quiz scores are computed from answer keys that are excluded from public curriculum responses. The latest attempt determines the quiz status: at least 80% passes; a lower score needs review. With three questions, passing requires all three correct. Misses schedule review in one day, a pass in seven days, and a repeated pass in thirty days. A due review appears in the review queue. The fixed quizzes are learning aids, not secure exams or proof of practical competency.

Chat cannot write progress. Practice can move a lesson to “Practicing” but cannot grant mastery. Weekly task notes are self-reported, and the app does not fetch, execute, or verify the referenced files. Learners can explore all lessons; prerequisites are advisory.

## Tests

```powershell
# From zentutor.ai, with the setup environment available:
cd backend
..\.venv\Scripts\python.exe -m unittest discover -s tests -v
cd ..\frontend
npm run build
npm run test:e2e
```

The browser suite uses installed Microsoft Edge and a dedicated test database on port 8017. It starts its own test backend using the project virtual environment when present, falling back to `python` from PATH. Run `setup.ps1` first, or ensure that the fallback interpreter has `backend/requirements.txt` installed. Change the Playwright browser channel if Edge is unavailable.

Backend tests cover login/logout, expired sessions, user isolation, private answer keys, quiz validation and scheduling, non-execution of submitted code, task evidence, offline teaching, retrieval, provider integration/fallback, and request guards. Browser tests exercise registration, tutor turns, practice, passing a quiz, saved evidence, reload, logout, and login at desktop and mobile widths.

## Files and limits

```text
backend/app/main.py          API, sessions, persistence, grading, and lesson adapter
backend/app/teacher.py       Live teacher, session credentials, and streaming
backend/app/gemini.py        Gemini validation, streaming, and structured lesson adapter
backend/app/curriculum.py    Authored lessons, question keys, and lexical retrieval
backend/tests/test_app.py    Isolated backend integration tests
frontend/src/TeacherStudio.jsx Live AI teacher conversation workspace
frontend/src/               React learning workspace and responsive styles
frontend/tests/             Browser learner-flow tests
data/roadmap.json            Extracted Week 1–4 source objectives
data/mentor.db              Local private state (created at runtime, gitignored)
data/provider.local.json    Persistent private provider connection (gitignored)
scripts/import_curriculum.py Reproducible roadmap extraction
docs/NEXT_STEPS.md           Remaining phases and acceptance criteria
```

This is a local MVP. It uses SQLite and opaque cookie sessions in place of the plan’s PostgreSQL/pgvector/JWT stack. It has no password recovery, email delivery, full rubric-based code grading, sandbox execution, project milestone verification, or Weeks 5–24 lessons. It does not import resume details. Rate limits are in memory and assume a single server worker.

The server binds to loopback and restricts allowed hosts. Before a shared/public deployment, add the planned database migrations, deployment configuration, account recovery, backups, and distributed request controls; use HTTPS with `MENTOR_SECURE_COOKIE=1`. No public deployment is included.

Back up `data/mentor.db` while the server is stopped. Database files contain private learner work and should not be committed or published.
