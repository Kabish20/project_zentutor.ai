# Next development milestones

The starting specification was supplied as pasted text. This implementation follows its instruction to test Weeks 1–4 before expanding the 24-week curriculum.

## 1. Validate the teaching experience

Have the learner complete one Python lesson and one mathematics lesson. Capture where explanations fail, whether the diagnostic is useful, and whether the exercises can be completed independently. Configure an available hosted model and measure answer usefulness, lesson-context relevance, provider failures, latency, and cost on a fixed set of representative prompts.

Acceptance: a complete diagnose → explain → practice → feedback → review cycle is useful to the learner; an unavailable provider stays understandable and usable; unsupported answers are acknowledged. Add a held-out prompt set before changing retrieval.

## 2. Strengthen assessments and persistence

Add question variants, spaced-recall checks, and explicit exercise rubrics. Store advisory LLM assessments separately from deterministic test results and human verification. Add a schema migration mechanism and move persistence to PostgreSQL if shared deployment is needed. Introduce account recovery, backup/restore checks, and distributed rate limits before opening access.

Acceptance: unverified model feedback cannot grant practical mastery; upgrades preserve learner records; users cannot read one another’s submissions.

## 3. Evaluate retrieval before adding vector search

Keep lexical retrieval as a baseline. Add embeddings and pgvector using versioned lesson chunks only if measured retrieval quality justifies them. Track source IDs, content revisions, the embedding model, and the question set. Private resume context would require an explicit user-controlled import and an independently access-controlled store.

Acceptance: compare citation correctness, missing-answer behaviour, retrieval recall, latency, and cost on the same held-out questions. Generated references must correspond to retrieved sources.

## 4. Extend curriculum and project mentoring

Expand Weeks 5–8 for the hotel cancellation ML project, then Weeks 9–12 for the travel-policy assistant. Derive objectives and deliverables from the existing roadmap. Build checklists for data provenance, leakage analysis, splits, baselines, evaluation reports, and project tests.

Acceptance: every completed milestone has reviewable evidence; self-reported completion remains distinct from independently checked results. Do not describe repository code, tests, or deployed services as verified without inspecting their evidence.

## 5. Add optional isolated code execution and deployment

Only add execution after designing a separate disposable worker with explicit CPU, memory, network, filesystem, and timeout limits. Maintain the existing non-executing submission path. Package the app, database migrations, and worker separately; add CI and an authenticated HTTPS deployment.

Acceptance: adversarial submissions cannot read server secrets, reach the progress database, persist between runs, or exhaust the main API process. Verify rollback and recovery before inviting additional users.
