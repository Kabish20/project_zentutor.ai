# Validation record

Verified on 7 September 2026 in the local Windows workspace.

| Check | Result |
| --- | --- |
| `setup.ps1` creates the isolated Python environment, installs dependencies, and builds the frontend | Passed |
| Backend integration suite, including the conversational teacher and Gemini provider | 44 passed |
| React production build | Passed |
| Edge desktop learner flow, 1440 × 1000 | Passed |
| Edge mobile learner flow, 390 × 844 | Passed |
| Tutor preserves unsent drafts during pending replies and suggestion sends | Passed |
| AI Teacher connection form and teaching preferences at desktop/mobile widths | Passed |
| Streamed Markdown, code blocks, safe rendering, and saved conversation recovery | Passed |
| Stop-generation control preserves partial answer and next draft | Passed |
| Gemini project connection, private key field, provider selection, and session override | Passed |
| Live Gemini 3.5 Flash model validation, streamed teaching, and structured lesson | Passed |
| Credential scan and HTTP access to private configuration | Key only in ignored local file; private URLs return 404 |
| Visual inspection of desktop/mobile overview screenshots | Completed |
| Local `/api/health` and homepage on port 8000 | Healthy; HTTP 200 |

All eight browser tests passed. They cover learner flows, disconnected and connected teacher screens, safe Markdown, conversation recovery, stopping responses, and Gemini provider selection. The learner-flow tests cover registration, local tutor turns, practice submission, quiz grading, review records, task evidence, persistence after reload, resource links, logout, and login. Test accounts use a separate test database, not the normal learner database. Both test suites disable personal local provider configuration.

A final code review identified a draft-loss bug in the chat composer. The response handler now clears only the text actually submitted; the added browser regression test verifies that pending replies and suggestion buttons preserve unrelated drafts.

The automated hosted LLM tests use mocked success, streamed chunks, premature termination, provider refusal, quota errors, retries, and concurrent requests. Separate live checks verified Gemini 3.5 Flash model access, a streamed explanation of overfitting, and a structured lesson about dataset splitting. Gemini 2.5 Flash passed model lookup but rejected generation, so the saved configuration and Gemini default use the successfully exercised 3.5 Flash model. OpenAI generation is validated with mocks only. Live smoke checks establish connectivity and response formatting, not comprehensive teaching accuracy. Production deployment and independent verification of learner project evidence are outside this validation.

Project cleanup preserves the private learner database, ignored local provider connection, application sources, curriculum data, and required lockfiles. Original document sources live in `../roadmap/`. The Python environment, frontend dependencies, and production build are retained so the app runs immediately. Disposable test artifacts, package-download cache, and source bytecode caches are removed after validation. Runtime logs stay in ignored `tmp/` while the server is running.
