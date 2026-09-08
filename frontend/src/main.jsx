import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import TeacherStudio from './TeacherStudio';
import './styles.css';

async function api(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const data = await response.json();
  if (!response.ok) {
    if (response.status === 401 && !path.startsWith('/auth/'))
      window.dispatchEvent(new Event('session-expired'));
    throw new Error(
      typeof data.detail === 'string' ? data.detail : 'Check your input and try again.',
    );
  }
  return data;
}

const labels = {
  not_started: 'Not started',
  learning: 'Learning',
  practicing: 'Practicing',
  needs_review: 'Needs review',
  mastered: 'Quiz mastered',
};
const weekNames = [
  'Reliable Python',
  'Working with data',
  'Mathematical foundations',
  'Reasoning with uncertainty',
];
function Icon({ name, size = 20 }) {
  const paths = {
    home: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </>
    ),
    book: (
      <>
        <path d="M12 5C8 2 4 3 2 4v15c3-1 6-1 10 2 4-3 7-3 10-2V4c-3-1-6-1-10 1Z" />
        <path d="M12 5v16" />
      </>
    ),
    chat: <path d="M21 11a9 9 0 0 1-9 9H4l-3 2 2-7a9 9 0 1 1 18-4Z" />,
    repeat: (
      <>
        <path d="M20 7H8a5 5 0 0 0-5 5M16 3l4 4-4 4M4 17h12a5 5 0 0 0 5-5M8 13l-4 4 4 4" />
      </>
    ),
    arrow: (
      <>
        <path d="M4 12h16M14 6l6 6-6 6" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    leaf: (
      <>
        <path d="M20 3C6 1 2 8 5 15c7 7 17 1 15-12Z" />
        <path d="m4 20 11-11" />
      </>
    ),
    link: (
      <>
        <path d="M14 3h7v7M21 3 10 14M10 4H4v16h16v-6" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 6v6l4 2" />
      </>
    ),
    logout: (
      <>
        <path d="M10 3H4v18h6M9 12h12M17 8l4 4-4 4" />
      </>
    ),
    'chevron-left': <path d="m15 18-6-6 6-6" />,
    'chevron-right': <path d="m9 18 6-6-6-6" />,
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] || paths.book}
    </svg>
  );
}
function Status({ value }) {
  return <span className={`status ${value}`}>{labels[value]}</span>;
}
function ErrorNote({ children }) {
  return children ? (
    <div className="error" role="alert">
      {children}
    </div>
  ) : null;
}
function DateText({ value }) {
  return value
    ? new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    : '—';
}

function Auth({ onLogin }) {
  const [register, setRegister] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      onLogin(
        await api(`/auth/${register ? 'register' : 'login'}`, { method: 'POST', body: data }),
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-layout">
      <section className="auth-story">
        <div className="brand">
          <span className="brand-icon">
            <Icon name="leaf" />
          </span>
          <span>
            zentutor.ai <b>AI learning studio</b>
          </span>
        </div>
        <div className="auth-copy">
          <span className="eyebrow">YOUR PERSONAL LEARNING STUDIO</span>
          <h1>
            Build understanding.
            <br />
            <em>One idea at a time.</em>
          </h1>
          <p>
            A guided path from Python foundations to AI engineering. Learn, put it into practice,
            and come back stronger.
          </p>
          <div className="auth-path">
            <span>01 · Learn</span>
            <span>02 · Practice</span>
            <span>03 · Revisit</span>
          </div>
        </div>
        <p className="muted">AI & ML engineering · A personal teacher, a practical learning path</p>
      </section>
      <section className="auth-form">
        <div className="auth-form-inner">
          <span className="eyebrow">A LITTLE PROGRESS, EVERY DAY</span>
          <h2>{register ? 'Your next chapter starts here.' : 'Welcome back.'}</h2>
          <p>
            {register
              ? 'Create a local account to keep your lessons and progress together.'
              : 'Sign in to pick up where you left off.'}
          </p>
          <form onSubmit={submit}>
            {register && (
              <label>
                Your name
                <input
                  name="name"
                  autoComplete="given-name"
                  maxLength={60}
                  placeholder="Kabish"
                  required
                />
              </label>
            )}
            <label>
              Username
              <input
                name="username"
                autoComplete="username"
                minLength={3}
                maxLength={40}
                pattern="[a-zA-Z0-9_.\-]+"
                title="3–40 letters, numbers, dots, underscores, or hyphens"
                placeholder="Choose a username"
                required
              />
            </label>
            <label>
              Password
              <input
                name="password"
                type="password"
                autoComplete={register ? 'new-password' : 'current-password'}
                minLength={10}
                maxLength={128}
                placeholder="At least 10 characters"
                required
              />
            </label>
            <ErrorNote>{error}</ErrorNote>
            <button className="primary wide" disabled={busy}>
              {busy ? 'One moment…' : register ? 'Create my learning space' : 'Sign in'}
              <Icon name="arrow" />
            </button>
          </form>
          <button
            className="text-button auth-switch"
            onClick={() => {
              setRegister(!register);
              setError('');
            }}
          >
            {register ? 'Already have an account? Sign in' : 'New here? Create an account'}
          </button>
          <p className="small muted">
            Your account and progress stay in this app’s local database. Curated lessons work
            without an AI API key.
          </p>
        </div>
      </section>
    </main>
  );
}

function App() {
  const [user, setUser] = useState(null),
    [loading, setLoading] = useState(true);
  const [course, setCourse] = useState(null),
    [dashboard, setDashboard] = useState(null);
  const [page, setPage] = useState('teacher'),
    [selected, setSelected] = useState(null),
    [tab, setTab] = useState('lesson');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [error, setError] = useState('');
  const connectionChanged = useCallback((settings) => {
    setDashboard((previous) =>
      previous ? { ...previous, tutor_mode: settings.configured ? 'llm' : 'offline' } : previous,
    );
  }, []);
  useEffect(() => {
    api('/auth/me')
      .then(setUser)
      .catch(() => {})
      .finally(() => setLoading(false));
    const expired = () => {
      setUser(null);
      setCourse(null);
      setDashboard(null);
    };
    window.addEventListener('session-expired', expired);
    return () => window.removeEventListener('session-expired', expired);
  }, []);
  async function refresh() {
    const result = await api('/dashboard');
    setDashboard(result);
    return result;
  }
  useEffect(() => {
    if (user) {
      setError('');
      Promise.all([api('/curriculum'), api('/dashboard')])
        .then(([c, d]) => {
          setCourse(c);
          setDashboard(d);
        })
        .catch((e) => setError(e.message));
    }
  }, [user]);
  async function openLesson(id, nextTab = 'lesson') {
    try {
      await api(`/lessons/${id}/start`, { method: 'POST', body: {} });
      await refresh();
      setSelected(id);
      setTab(nextTab);
      setPage('lesson');
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }
  async function logout() {
    try {
      await api('/auth/logout', { method: 'POST', body: {} });
      setUser(null);
      setCourse(null);
      setDashboard(null);
      setSelected(null);
      setPage('teacher');
    } catch (e) {
      setError(e.message);
    }
  }
  if (loading) return <div className="loading">Opening your learning studio…</div>;
  if (!user) return <Auth onLogin={setUser} />;
  if (!course || !dashboard)
    return (
      <div className="loading">
        <ErrorNote>{error}</ErrorNote>
        {error ? (
          <button onClick={() => window.location.reload()}>Retry</button>
        ) : (
          'Loading your roadmap…'
        )}
      </div>
    );
  const progress = Object.fromEntries(dashboard.progress.map((p) => [p.lesson_id, p]));
  const activeLesson = course.lessons.find((l) => l.id === selected);
  const nav = [
    ['teacher', 'chat', 'AI Teacher'],
    ['home', 'home', 'Overview'],
    ['curriculum', 'book', 'My curriculum'],
    ['review', 'repeat', 'Review & progress'],
    ['resources', 'link', 'Resource shelf'],
  ];
  return (
    <div
      className={`app-shell ${sidebarCollapsed ? 'sidebar-collapsed' : ''} ${page === 'teacher' ? 'teacher-app' : ''}`}
    >
      <aside className="sidebar">
        <button
          className="sidebar-toggle"
          type="button"
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}
        >
          <Icon name={sidebarCollapsed ? 'chevron-right' : 'chevron-left'} size={17} />
        </button>
        <div className="brand">
          <span className="brand-icon">
            <Icon name="leaf" />
          </span>
          <span>
            zentutor.ai <b>AI learning studio</b>
          </span>
        </div>
        <div className="sidebar-label">YOUR WORKSPACE</div>
        <nav>
          {nav.map(([id, icon, label]) => (
            <button
              key={id}
              className={page === id ? 'nav-item active' : 'nav-item'}
              onClick={() =>
                id === 'lesson'
                  ? openLesson(selected || dashboard.recommended_lesson, 'tutor')
                  : setPage(id)
              }
            >
              <Icon name={icon} />
              {label}
              {id === 'review' && dashboard.review_due > 0 && (
                <span className="count">{dashboard.review_due}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="path-card">
          <Icon name="leaf" />
          <span className="eyebrow">THE BIGGER PICTURE</span>
          <strong>
            Backend developer
            <br />
            to AI engineer
          </strong>
          <p>
            Build the foundations.
            <br />
            Let the evidence follow.
          </p>
          <div className="progress-track">
            <i style={{ width: `${(dashboard.mastered / course.lessons.length) * 100}%` }} />
          </div>
          <span className="small">
            {dashboard.mastered} of {course.lessons.length} lesson quizzes mastered
          </span>
        </div>
        <div className="profile">
          <span className="avatar">{user.name[0].toUpperCase()}</span>
          <div>
            <strong>{user.name}</strong>
            <span>Personal learning space</span>
          </div>
          <button title="Sign out" aria-label="Sign out" className="icon-button" onClick={logout}>
            <Icon name="logout" size={17} />
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <span>
            MY LEARNING JOURNEY{' '}
            <span className="crumb">
              / {page === 'lesson' ? 'Tutor studio' : nav.find((n) => n[0] === page)?.[2]}
            </span>
          </span>
          <div className="topbar-actions">
            <span className="mode-pill">
              <i />
              {dashboard.tutor_mode === 'llm' ? 'AI connected' : 'AI not connected'}
            </span>
            <button className="icon-button" aria-label="Log out" title="Log out" onClick={logout}>
              <Icon name="logout" size={16} />
            </button>
          </div>
        </header>
        <main className={`content ${page === 'teacher' ? 'teacher-page' : ''}`}>
          <ErrorNote>{error}</ErrorNote>
          {page === 'teacher' && (
            <TeacherStudio
              user={user}
              onOpenLesson={null}
              onConnectionChange={connectionChanged}
            />
          )}
          {page === 'home' && (
            <Overview
              {...{ course, dashboard, progress, openLesson, refresh }}
              onCurriculum={() => setPage('curriculum')}
            />
          )}
          {page === 'curriculum' && (
            <Curriculum {...{ course, progress, openLesson, dashboard, refresh }} />
          )}
          {page === 'lesson' && activeLesson && (
            <Lesson
              key={activeLesson.id}
              lesson={activeLesson}
              {...{ course, progress, tab, setTab, openLesson, refresh }}
              mode={dashboard.tutor_mode}
            />
          )}
          {page === 'review' && <Review {...{ course, dashboard, progress, openLesson }} />}
          {page === 'resources' && <Resources course={course} />}
        </main>
        {page !== 'teacher' && (
          <footer>
            Small steps. Real understanding.<span>Phase 01 · Data & mathematics foundations</span>
          </footer>
        )}
      </div>
    </div>
  );
}

function Overview({ course, dashboard, progress, openLesson, refresh, onCurriculum }) {
  const current = course.lessons.find((l) => l.id === dashboard.recommended_lesson);
  const week = course.weeks.find((w) => w.week === current.week);
  const attempted = dashboard.progress.reduce((sum, p) => sum + p.attempts, 0);
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">YOUR ROADMAP, MADE PRACTICAL</span>
          <h1>Keep growing, {dashboard.user.name.split(' ')[0]}.</h1>
          <p>You don’t need to learn everything today. Just the next thing.</p>
        </div>
        <span className="date-chip">
          <Icon name="clock" size={16} />
          10–12 hours / week
        </span>
      </div>
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">
            {progress[current.id].review_due ? 'TIME TO REVISIT' : 'YOUR NEXT STEP'} · WEEK{' '}
            {String(current.week).padStart(2, '0')}
          </span>
          <h2>{current.title}</h2>
          <p>{current.objective}</p>
          <button className="primary" onClick={() => openLesson(current.id)}>
            {progress[current.id].status === 'not_started' ? 'Start learning' : 'Continue learning'}
            <Icon name="arrow" size={18} />
          </button>
          <span className="hero-meta">
            ~{current.minutes} min lesson · Learn → practice → revisit
          </span>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="art-card card-back">
            think<span>→</span>
          </div>
          <div className="art-card card-front">
            <span className="code-mark">{'{ }'}</span>
            <strong>
              Make it
              <br />
              make sense.
            </strong>
            <div className="art-lines">
              <i />
              <i />
              <i />
            </div>
          </div>
          <span className="art-star">✳</span>
          <span className="art-dot" />
        </div>
      </section>
      <section className="stats">
        <div>
          <span className="stat-icon">
            <Icon name="book" />
          </span>
          <div>
            <span>Current focus</span>
            <strong>
              Week {String(current.week).padStart(2, '0')} <small>/ 04</small>
            </strong>
          </div>
        </div>
        <div>
          <span className="stat-icon">
            <Icon name="check" />
          </span>
          <div>
            <span>Lesson quizzes mastered</span>
            <strong>
              {dashboard.mastered} <small>/ {course.lessons.length}</small>
            </strong>
          </div>
        </div>
        <div>
          <span className="stat-icon">
            <Icon name="repeat" />
          </span>
          <div>
            <span>Ready for review</span>
            <strong>
              {dashboard.review_due} <small>lessons</small>
            </strong>
          </div>
        </div>
        <div>
          <span className="stat-icon">
            <Icon name="chat" />
          </span>
          <div>
            <span>Quiz attempts</span>
            <strong>
              {attempted} <small>recorded</small>
            </strong>
          </div>
        </div>
      </section>
      <div className="overview-columns">
        <section>
          <div className="section-heading">
            <h2>This week’s learning</h2>
            <button className="text-button" onClick={onCurriculum}>
              Full curriculum <Icon name="arrow" size={16} />
            </button>
          </div>
          <div className="lesson-list">
            {course.lessons
              .filter((l) => l.week === current.week)
              .map((l, i) => (
                <button key={l.id} className="lesson-row" onClick={() => openLesson(l.id)}>
                  <span
                    className={`lesson-number ${progress[l.id].status === 'mastered' ? 'complete' : ''}`}
                  >
                    {progress[l.id].status === 'mastered' ? (
                      <Icon name="check" size={18} />
                    ) : (
                      String(i + 1).padStart(2, '0')
                    )}
                  </span>
                  <div>
                    <strong>{l.title}</strong>
                    <span>{l.minutes} min · Lesson + practice + quiz</span>
                  </div>
                  <Status value={progress[l.id].status} />
                  <Icon name="arrow" size={16} />
                </button>
              ))}
          </div>
          <div className="note-card">
            <Icon name="leaf" />
            <div>
              <strong>Understanding over ticking boxes.</strong>
              <p>
                Quiz mastery means a passing lesson quiz. Your practical work and weekly
                deliverables need their own evidence.
              </p>
            </div>
          </div>
        </section>
        <section className="week-card">
          <span className="eyebrow">MAKE SOMETHING REAL</span>
          <h2>Your weekly deliverable</h2>
          <p>{week.deliverable}</p>
          <TaskList
            tasks={dashboard.tasks.filter((t) => t.week === current.week)}
            refresh={refresh}
          />
        </section>
      </div>
    </>
  );
}

function TaskList({ tasks, refresh }) {
  const [editing, setEditing] = useState(null),
    [evidence, setEvidence] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  async function save(task, done) {
    setBusy(true);
    setError('');
    try {
      await api(`/weeks/${task.week}/tasks/${task.task_id}`, {
        method: 'PUT',
        body: { done, evidence: editing === task.task_id ? evidence : task.evidence },
      });
      await refresh();
      setEditing(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="tasks">
      {tasks.map((t) => (
        <div className="task" key={t.task_id}>
          <button
            className="task-toggle"
            disabled={busy}
            onClick={() => {
              if (t.done) save(t, false);
              else {
                setEditing(t.task_id);
                setEvidence(t.evidence);
                setError('');
              }
            }}
          >
            <span className={`checkbox ${t.done ? 'checked' : ''}`}>
              {t.done && <Icon name="check" size={13} />}
            </span>
            <span>{t.label}</span>
          </button>
          {t.done && <p className="evidence">Self-reported · {t.evidence}</p>}
          {editing === t.task_id && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                save(t, true);
              }}
            >
              <label className="small">
                What did you produce or check?
                <textarea
                  value={evidence}
                  onChange={(e) => setEvidence(e.target.value)}
                  maxLength={3000}
                  placeholder="File path, results, or a short evidence note"
                  required
                />
              </label>
              <div className="button-row">
                <button className="primary compact" disabled={busy}>
                  Save as done
                </button>
                <button type="button" className="text-button" onClick={() => setEditing(null)}>
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      ))}
      <ErrorNote>{error}</ErrorNote>
      <p className="small muted">Task completion is self-reported.</p>
    </div>
  );
}

function Curriculum({ course, progress, openLesson, dashboard, refresh }) {
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">PHASE 01 · WEEKS 1–4</span>
          <h1>Lay the foundations.</h1>
          <p>Follow the sequence, or revisit a topic that needs more time.</p>
        </div>
      </div>
      {course.weeks.map((w) => (
        <section className="curriculum-week" key={w.week}>
          <div className="week-heading">
            <span className="week-number">{String(w.week).padStart(2, '0')}</span>
            <div>
              <span className="eyebrow">WEEK {w.week}</span>
              <h2>{w.title}</h2>
              <p>{w.learn}</p>
            </div>
          </div>
          <div className="lesson-grid">
            {course.lessons
              .filter((l) => l.week === w.week)
              .map((l) => (
                <button className="lesson-card" key={l.id} onClick={() => openLesson(l.id)}>
                  <Status value={progress[l.id].status} />
                  <h3>{l.title}</h3>
                  <p>{l.objective}</p>
                  <span className="card-bottom">
                    {l.minutes} min <Icon name="arrow" size={18} />
                  </span>
                </button>
              ))}
          </div>
          <details className="weekly-details">
            <summary>Week {w.week} deliverable & evidence</summary>
            <p>{w.deliverable}</p>
            <TaskList tasks={dashboard.tasks.filter((t) => t.week === w.week)} refresh={refresh} />
          </details>
          <p className="source-line">
            Roadmap page 5 · {w.source_id} · Teaching material expanded for this app
          </p>
        </section>
      ))}
    </>
  );
}

function Lesson({ lesson, course, progress, tab, setTab, openLesson, refresh, mode }) {
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            WEEK {String(lesson.week).padStart(2, '0')} · {weekNames[lesson.week - 1]}
          </span>
          <h1>{lesson.title}</h1>
          <p>{lesson.objective}</p>
        </div>
        <Status value={progress[lesson.id].status} />
      </div>
      <div className="tabs" role="tablist" aria-label="Lesson workspace">
        {[
          ['lesson', 'Lesson notes'],
          ['tutor', 'Ask your tutor'],
          ['practice', 'Practice'],
          ['quiz', 'Check understanding'],
        ].map(([id, label]) => (
          <button
            role="tab"
            aria-selected={tab === id}
            key={id}
            className={tab === id ? 'selected' : ''}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <div role="tabpanel">
        {tab === 'lesson' && (
          <div className="lesson-columns">
            <article className="paper">
              <span className="eyebrow">START WITH A QUESTION</span>
              <h2>{lesson.diagnostic}</h2>
              <p className="lesson-explanation">{lesson.explanation}</p>
              <h3>A small example</h3>
              <pre>
                <code>{lesson.example}</code>
              </pre>
              <div className="practice-callout">
                <span className="eyebrow">YOUR TURN</span>
                <p>{lesson.exercise}</p>
                <button className="text-button" onClick={() => setTab('practice')}>
                  Open practice <Icon name="arrow" size={16} />
                </button>
              </div>
              <div className="button-row">
                <button className="primary" onClick={() => setTab('tutor')}>
                  Work through it with your tutor <Icon name="chat" size={17} />
                </button>
                <button className="secondary" onClick={() => setTab('quiz')}>
                  Take the quiz
                </button>
              </div>
            </article>
            <aside className="lesson-aside">
              <section className="paper">
                <span className="eyebrow">WATCH OUT FOR</span>
                <ul className="mistakes">
                  {lesson.common_mistakes.map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
              </section>
              <section className="paper">
                <span className="eyebrow">BEFORE THIS LESSON</span>
                {lesson.prerequisites.length ? (
                  lesson.prerequisites.map((id) => (
                    <button key={id} className="text-button" onClick={() => openLesson(id)}>
                      {course.lessons.find((l) => l.id === id).title}
                      <Icon name="arrow" size={16} />
                    </button>
                  ))
                ) : (
                  <p>No prior lesson required.</p>
                )}
                <p className="small muted">Prerequisites are guidance; you can explore freely.</p>
              </section>
              <section className="paper">
                <span className="eyebrow">LESSON SOURCES</span>
                <p>Roadmap page 5 · {lesson.source_id}</p>
                {course.resources
                  .filter((r) => lesson.resource_ids.includes(r.id))
                  .map((r) => (
                    <a
                      className="resource-link"
                      key={r.id}
                      href={r.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {r.title}
                      <Icon name="link" size={14} />
                    </a>
                  ))}
                <p className="small muted">
                  Examples and quizzes are authored teaching expansions.
                </p>
              </section>
            </aside>
          </div>
        )}
        {tab === 'tutor' && <Tutor lesson={lesson} mode={mode} openLesson={openLesson} />}
        {tab === 'practice' && <Practice lesson={lesson} refresh={refresh} />}
        {tab === 'quiz' && <Quiz lesson={lesson} refresh={refresh} />}
      </div>
    </>
  );
}

function Tutor({ lesson, mode: providerMode, openLesson }) {
  const [messages, setMessages] = useState([]),
    [text, setText] = useState(''),
    [mode, setMode] = useState('teach'),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState('');
  const end = useRef(null);
  useEffect(() => {
    let active = true;
    api(`/lessons/${lesson.id}/messages`)
      .then((data) => {
        if (active) setMessages(data);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [lesson.id]);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages]);
  async function send(value = text) {
    if (!value.trim() || busy || loading) return;
    setBusy(true);
    setError('');
    try {
      const reply = await api(`/lessons/${lesson.id}/chat`, {
        method: 'POST',
        body: { message: value, mode },
      });
      setMessages((prev) => [
        ...prev,
        { role: 'user', body: value },
        { role: 'assistant', body: reply },
      ]);
      setText((current) => (current === value ? '' : current));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="tutor paper">
      <div className="tutor-toolbar">
        <div>
          <span className="brand-icon small-icon">
            <Icon name="leaf" size={17} />
          </span>
          <strong>Your learning partner</strong>
        </div>
        <label className="mode-select">
          Mode
          <select value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="teach">Teach</option>
            <option value="practice">Practice</option>
            <option value="revision">Revision</option>
            <option value="interview">Interview</option>
          </select>
        </label>
      </div>
      <p className="tutor-notice">
        {providerMode === 'llm'
          ? 'Your messages and relevant lesson context are sent to the configured AI provider. Feedback is advisory.'
          : 'Curated offline mode uses prepared explanations and prompts. It cannot grade free-text answers.'}
      </p>
      <div className="messages" aria-live="polite">
        {loading ? (
          <p>Loading conversation…</p>
        ) : (
          !messages.length && (
            <div className="chat-empty">
              <span className="empty-icon">
                <Icon name="chat" size={30} />
              </span>
              <h2>Let’s make this click.</h2>
              <p>Start with what you know. Your tutor will help you work through the next step.</p>
              <button
                className="secondary"
                disabled={busy}
                onClick={() => send(`Help me learn ${lesson.title}.`)}
              >
                Start this lesson <Icon name="arrow" size={16} />
              </button>
            </div>
          )
        )}
        {messages.map((m, i) => (
          <div className={`message ${m.role}`} key={i}>
            <span className="message-label">{m.role === 'user' ? 'YOU' : 'MENTOR'}</span>
            {m.role === 'user' ? (
              <p>{m.body}</p>
            ) : (
              <>
                <p>{m.body.explanation}</p>
                {m.body.example && (
                  <pre>
                    <code>{m.body.example}</code>
                  </pre>
                )}
                {m.body.practice && (
                  <div className="chat-practice">
                    <strong>Try it yourself</strong>
                    <p>{m.body.practice}</p>
                  </div>
                )}
                {m.body.follow_up && <p className="follow-up">{m.body.follow_up}</p>}
                <div className="sources">
                  <span>Context supplied:</span>
                  {m.body.sources?.map((s) => (
                    <button key={s.lesson_id} onClick={() => openLesson(s.lesson_id)}>
                      {s.title} · p.{s.page}
                    </button>
                  ))}
                </div>
                <span className="small muted">{m.body.notice}</span>
              </>
            )}
          </div>
        ))}
        {busy && <p className="muted">Preparing your next step…</p>}
        <div ref={end} />
      </div>
      <ErrorNote>{error}</ErrorNote>
      <div className="suggestions">
        {['Give me a hint', 'Explain with an example', 'What should I practice?'].map((s) => (
          <button key={s} disabled={busy || loading} onClick={() => send(s)}>
            {s}
          </button>
        ))}
      </div>
      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <label className="sr-only" htmlFor="chat-input">
          Message your tutor
        </label>
        <textarea
          id="chat-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Share your thinking, ask a question, or request a hint…"
          maxLength={4000}
          rows={2}
          required
        />
        <button
          className="primary"
          disabled={busy || loading || !text.trim()}
          aria-label="Send message"
        >
          <Icon name="arrow" />
        </button>
      </form>
    </section>
  );
}

function Practice({ lesson, refresh }) {
  const [submission, setSubmission] = useState(''),
    [feedback, setFeedback] = useState([]),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    api(`/lessons/${lesson.id}/practice`)
      .then((rows) => {
        if (active && rows.length) {
          setSubmission(rows[0].submission);
          setFeedback(rows[0].feedback);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [lesson.id]);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await api(`/lessons/${lesson.id}/practice`, {
        method: 'POST',
        body: { submission },
      });
      setFeedback(result.feedback);
      await refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="lesson-columns">
      <section className="paper">
        <span className="eyebrow">BUILD IT YOURSELF</span>
        <h2>Turn the idea into practice.</h2>
        <p>{lesson.exercise}</p>
        <form onSubmit={submit}>
          <label>
            Your {lesson.language === 'python' ? 'Python code' : 'work and explanation'}
            <textarea
              className="code-editor"
              value={submission}
              onChange={(e) => setSubmission(e.target.value)}
              maxLength={12000}
              spellCheck="false"
              placeholder={loading ? 'Loading saved work…' : 'Write or paste your work here…'}
              disabled={loading}
              required
            />
          </label>
          <ErrorNote>{error}</ErrorNote>
          <button className="primary" disabled={busy || loading || !submission.trim()}>
            {busy ? 'Saving…' : 'Save & check'}
            <Icon name="check" size={17} />
          </button>
        </form>
      </section>
      <aside className="paper">
        <span className="eyebrow">REVIEW YOUR WORK</span>
        <h2>Evidence comes first.</h2>
        {feedback.length ? (
          <ul className="feedback">
            {feedback.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        ) : (
          <p>Save your work to see the available checks and a self-review checklist.</p>
        )}
        <p className="small muted">
          Python receives a syntax check only. SQL and written reports are saved for self-review.
          Code is never executed, and practice submissions do not establish mastery.
        </p>
      </aside>
    </div>
  );
}

function Quiz({ lesson, refresh }) {
  const [answers, setAnswers] = useState({}),
    [result, setResult] = useState(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      setResult(await api(`/lessons/${lesson.id}/quiz`, { method: 'POST', body: { answers } }));
      await refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="paper quiz">
      <span className="eyebrow">RECALL BEFORE YOU RE-READ</span>
      <h2>Check your understanding.</h2>
      <p>
        Three questions. Choose one answer per question. A score of at least 80% records quiz
        mastery.
      </p>
      {result && (
        <div className={`quiz-result ${result.status}`} role="status">
          <strong>
            {result.score}% ·{' '}
            {result.status === 'mastered' ? 'Quiz mastered' : 'Let’s revisit this topic'}
          </strong>
          <span>
            Next review: <DateText value={result.next_review} />. Practical competency still needs
            evidence.
          </span>
        </div>
      )}
      <form onSubmit={submit}>
        {lesson.questions.map((q, index) => {
          const grade = result?.results.find((r) => r.question_id === q.id);
          return (
            <fieldset className="question" key={q.id} disabled={!!result || busy}>
              <legend>
                <span>{String(index + 1).padStart(2, '0')}</span>
                {q.prompt}
              </legend>
              {q.options.map((option, i) => (
                <label
                  className={`option ${answers[q.id] === i ? 'chosen' : ''} ${grade && grade.correct_option === i ? 'correct-option' : ''}`}
                  key={i}
                >
                  <input
                    type="radio"
                    name={q.id}
                    checked={answers[q.id] === i}
                    onChange={() => setAnswers({ ...answers, [q.id]: i })}
                    required
                  />
                  <span>{option}</span>
                  {grade && grade.correct_option === i && <Icon name="check" size={18} />}
                </label>
              ))}
              {grade && (
                <p className="answer-feedback">
                  {grade.correct ? 'Correct. ' : 'Review this: '}
                  {grade.explanation}
                </p>
              )}
            </fieldset>
          );
        })}
        <ErrorNote>{error}</ErrorNote>
        {result ? (
          <button
            type="button"
            className="secondary"
            onClick={() => {
              setResult(null);
              setAnswers({});
            }}
          >
            Try again without the answers <Icon name="repeat" size={16} />
          </button>
        ) : (
          <button
            className="primary"
            disabled={busy || Object.keys(answers).length !== lesson.questions.length}
          >
            {busy ? 'Checking…' : 'Check my answers'}
            <Icon name="arrow" size={16} />
          </button>
        )}
      </form>
      <p className="small muted">
        These are fixed practice questions, not a secure certification exam. The latest attempt
        determines the lesson’s quiz status.
      </p>
    </section>
  );
}

function Review({ course, dashboard, progress, openLesson }) {
  const needs = course.lessons.filter(
    (l) => progress[l.id].review_due || progress[l.id].status === 'needs_review',
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">MAKE IT STICK</span>
          <h1>Come back a little stronger.</h1>
          <p>Revisit weak topics and check what you can recall without your notes.</p>
        </div>
      </div>
      <section className="paper">
        <h2>Your review queue</h2>
        {needs.length ? (
          <div className="lesson-list">
            {needs.map((l) => (
              <button className="lesson-row" key={l.id} onClick={() => openLesson(l.id, 'quiz')}>
                <Icon name="repeat" />
                <div>
                  <strong>{l.title}</strong>
                  <span>
                    Latest score: {progress[l.id].score}% · Review{' '}
                    <DateText value={progress[l.id].next_review} />
                  </span>
                </div>
                <Icon name="arrow" />
              </button>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <Icon name="leaf" size={28} />
            <h3>No reviews waiting.</h3>
            <p>Complete a quiz to start your review schedule. Missed concepts return sooner.</p>
            <button className="secondary" onClick={() => openLesson(dashboard.recommended_lesson)}>
              Open next lesson <Icon name="arrow" size={16} />
            </button>
          </div>
        )}
      </section>
      <section className="paper progress-paper">
        <h2>Your learning record</h2>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Lesson</th>
                <th>Status</th>
                <th>Latest score</th>
                <th>Attempts</th>
                <th>Next review</th>
              </tr>
            </thead>
            <tbody>
              {course.lessons.map((l) => (
                <tr key={l.id}>
                  <td>
                    <button className="text-button" onClick={() => openLesson(l.id)}>
                      {l.title}
                    </button>
                  </td>
                  <td>
                    <Status value={progress[l.id].status} />
                  </td>
                  <td>{progress[l.id].score == null ? '—' : `${progress[l.id].score}%`}</td>
                  <td>{progress[l.id].attempts}</td>
                  <td>
                    <DateText value={progress[l.id].next_review} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="small muted">
          Review schedule: 1 day after a missed quiz, 7 days after passing, and 30 days after a
          repeat pass. Dates reflect recorded attempts, not elapsed study time.
        </p>
      </section>
    </>
  );
}

function Resources({ course }) {
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">LESS SCROLLING, MORE BUILDING</span>
          <h1>Your reference shelf.</h1>
          <p>
            Resources carried over from your roadmap. Use the sections needed for the task at hand.
          </p>
        </div>
      </div>
      <div className="resource-grid">
        {course.resources.map((r) => (
          <a
            className="paper resource-card"
            href={r.url}
            key={r.id}
            target="_blank"
            rel="noreferrer"
          >
            <span className="resource-id">{r.id}</span>
            <h2>{r.title}</h2>
            <p>
              {r.id === 'R1'
                ? 'Functions, exceptions, modules, environments, and data structures.'
                : r.id === 'R2'
                  ? 'Joins, aggregates, CTEs, and window functions.'
                  : r.id === 'R3'
                    ? 'Shapes, broadcasting, indexing, and array operations.'
                    : r.id === 'R4'
                      ? 'Load, clean, combine, and summarise tables.'
                      : r.id === 'R5'
                        ? 'Selected linear algebra, calculus, and probability chapters.'
                        : 'Probability, statistics, and the foundations of machine learning.'}
            </p>
            <span className="card-bottom">
              Open resource <Icon name="link" size={17} />
            </span>
          </a>
        ))}
      </div>
      <div className="note-card">
        <Icon name="book" />
        <div>
          <strong>Grounded in your 24-week roadmap.</strong>
          <p>
            This first release expands Weeks 1–4 into 12 lessons. Later phases remain in the
            original roadmap. Your resume is not imported or sent to the tutor.
          </p>
        </div>
      </div>
    </>
  );
}

createRoot(document.getElementById('root')).render(<App />);
