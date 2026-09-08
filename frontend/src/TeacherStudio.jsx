import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './teacher.css';
import './teacher-overrides.css';

const PROVIDERS = {
  openai: {
    name: 'OpenAI',
    model: 'gpt-5.4-mini',
    keyPlaceholder: 'sk-…',
    keyUrl: 'https://platform.openai.com/api-keys',
    billing: 'OpenAI API usage is billed separately from ChatGPT subscriptions.',
  },
  gemini: {
    name: 'Gemini',
    model: 'gemini-3.5-flash',
    keyPlaceholder: 'AIza…',
    keyUrl: 'https://aistudio.google.com/apikey',
    billing: 'Gemini API availability and usage limits depend on your Google AI project.',
  },
};

const MODES = [
  ['explain', 'Explain a concept'],
  ['guided', 'Teach me step by step'],
  ['practice', 'Practice with me'],
  ['interview', 'Mock interview'],
  ['review', 'Review my code'],
];
const TOPICS = [
  {
    icon: 'chart',
    label: 'Machine learning',
    detail: 'From intuition to your first model',
    prompt:
      'Teach me how machine learning works, starting with a real-world example. Explain the intuition, then guide me through a small Python example.',
  },
  {
    icon: 'network',
    label: 'Deep learning',
    detail: 'Neural networks, made understandable',
    prompt:
      'Teach me neural networks from the beginning. Use a simple analogy, explain how a network learns, and check my understanding before moving on.',
  },
  {
    icon: 'spark',
    label: 'LLMs & RAG',
    detail: 'Build useful AI applications',
    prompt:
      'Teach me how to build a retrieval-augmented generation (RAG) application. Explain embeddings and retrieval with a practical example, one step at a time.',
  },
  {
    icon: 'layers',
    label: 'MLOps & deployment',
    detail: 'Take a model into production',
    prompt:
      'Teach me how to take a machine learning model from a notebook to production. Walk me through serving, testing, monitoring, and data drift with a realistic example.',
  },
];
const FOLLOWUPS = [
  ['Explain simply', 'Explain that more simply, using an everyday analogy.'],
  ['Show Python', 'Show me a small, runnable Python example of that, and explain the code.'],
  [
    'Give an exercise',
    'Give me a small practice exercise on this topic. Let me try before showing the answer.',
  ],
  [
    'Check my understanding',
    'Ask me one question to check my understanding of what we just covered.',
  ],
];

function StudioIcon({ name, size = 20 }) {
  const paths = {
    spark: (
      <>
        <path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z" />
        <path d="m20 2 .5 1.5L22 4l-1.5.5L20 6l-.5-1.5L18 4l1.5-.5Z" />
      </>
    ),
    chart: (
      <>
        <path d="M4 3v17h17M8 15l4-5 4 3 5-7" />
        <path d="M17 6h4v4" />
      </>
    ),
    network: (
      <>
        <circle cx="5" cy="6" r="2" />
        <circle cx="5" cy="18" r="2" />
        <circle cx="19" cy="6" r="2" />
        <circle cx="19" cy="18" r="2" />
        <circle cx="12" cy="12" r="2" />
        <path d="m7 7 3.5 3.5m3 3L17 17M7 17l3.5-3.5m3-3L17 7" />
      </>
    ),
    layers: (
      <>
        <path d="m12 3 9 5-9 5-9-5 9-5ZM3 12l9 5 9-5M3 16l9 5 9-5" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    chat: <path d="M20 4H4v13h4l4 4 4-4h4V4Z" />,
    arrow: <path d="M12 20V4m-6 6 6-6 6 6" />,
    next: <path d="M4 12h16m-6-6 6 6-6 6" />,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    trash: (
      <>
        <path d="M4 7h16M10 11v6m4-6v6M9 7V4h6v3m-9 0 1 13h10l1-13" />
      </>
    ),
    copy: (
      <>
        <rect x="8" y="8" width="12" height="13" rx="2" />
        <path d="M15 8V3H3v12h5" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    settings: (
      <>
        <path d="M4 7h9m4 0h3M4 17h3m4 0h9" />
        <circle cx="15" cy="7" r="2" />
        <circle cx="9" cy="17" r="2" />
      </>
    ),
    key: (
      <>
        <circle cx="8" cy="8" r="5" />
        <path d="m12 12 9 9m-4-4 3-3m-6 0 3-3" />
      </>
    ),
    book: (
      <>
        <path d="M12 5C8 2 4 3 2 4v15c3-1 6-1 10 2 4-3 7-3 10-2V4c-3-1-6-1-10 1ZM12 5v16" />
      </>
    ),
    stop: <rect x="6" y="6" width="12" height="12" rx="2" />,
    history: (
      <>
        <path d="M3 11a9 9 0 1 1 2 7M3 4v7h7M12 7v5l3 2" />
      </>
    ),
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
      {paths[name] || paths.spark}
    </svg>
  );
}

async function teacherApi(path, options = {}) {
  const response = await fetch(`/api/teacher${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) window.dispatchEvent(new Event('session-expired'));
    throw new Error(
      typeof data.detail === 'string'
        ? data.detail
        : 'Unable to complete that request. Please try again.',
    );
  }
  return data;
}

function CopyButton({ text, label = 'Copy', className = '' }) {
  const [state, setState] = useState('');
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setState('Copied');
    } catch {
      setState('Select text to copy');
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState(''), 2200);
  }
  return (
    <button
      type="button"
      className={`teacher-copy ${className}`}
      onClick={copy}
      aria-label={state || label}
      title={state || label}
    >
      <StudioIcon name={state === 'Copied' ? 'check' : 'copy'} size={14} />
      <span>{state || label}</span>
    </button>
  );
}

function CodeBlock({ children }) {
  const child = React.Children.toArray(children)[0];
  const code = React.isValidElement(child)
    ? String(child.props.children || '')
    : String(children || '');
  const language = React.isValidElement(child)
    ? (child.props.className || '').replace('language-', '')
    : '';
  return (
    <div className="teacher-code">
      <div className="teacher-code-bar">
        <span>{language || 'Code'}</span>
        <CopyButton text={code.replace(/\n$/, '')} label="Copy code" />
      </div>
      <pre>{children}</pre>
    </div>
  );
}

function Markdown({ children }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      skipHtml
      components={{
        pre: CodeBlock,
        a: ({ children: linkText, href }) => (
          <a href={href} target="_blank" rel="noopener noreferrer">
            {linkText}
          </a>
        ),
        img: ({ alt }) => (
          <span className="teacher-image-alt">{alt ? `[Image: ${alt}]` : '[Image]'}</span>
        ),
        table: ({ children: cells }) => (
          <div className="teacher-table-wrap">
            <table>{cells}</table>
          </div>
        ),
      }}
    >
      {children}
    </ReactMarkdown>
  );
}

function TeacherSettings({ settings, initialSection, onChange, onClose }) {
  const [section, setSection] = useState(initialSection);
  const [key, setKey] = useState('');
  const [provider, setProvider] = useState(settings.provider || 'openai');
  const [model, setModel] = useState(settings.model || settings.default_model || 'gpt-5.4-mini');
  const [preferences, setPreferences] = useState(settings.preferences);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const selectedProvider = PROVIDERS[provider];
  const connectedProvider = PROVIDERS[settings.provider || 'openai'];
  const canReuseKey = settings.configured && (settings.provider || 'openai') === provider;
  const serverConnection = ['environment', 'project'].includes(settings.connection_source);
  const modalRef = useRef(null);
  const closeRef = useRef(onClose);
  const busyRef = useRef(busy);
  closeRef.current = onClose;
  busyRef.current = busy;
  useEffect(() => {
    const previousFocus = document.activeElement;
    const dialog = modalRef.current;
    dialog.querySelector('button')?.focus();
    const handleKey = (event) => {
      if (event.key === 'Escape' && !busyRef.current) closeRef.current();
      if (event.key !== 'Tab') return;
      const focusable = [...dialog.querySelectorAll('button, a[href], input, select')].filter(
        (node) => !node.disabled && node.getClientRects().length,
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener('keydown', handleKey);
    const priorOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = priorOverflow;
      previousFocus?.focus();
    };
  }, []);
  async function update(path, method, body) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const updated = await teacherApi(path, { method, body });
      onChange(updated);
      setKey('');
      setNotice(
        path === '/settings'
          ? 'Your teaching preferences are saved.'
          : method === 'DELETE'
            ? 'Session key removed.'
            : `${PROVIDERS[updated.provider || 'openai'].name} key and model access verified. You can start asking questions; responses depend on available API quota.`,
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div
      className="teacher-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <section
        ref={modalRef}
        className="teacher-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="teacher-settings-title"
      >
        <div className="teacher-modal-heading">
          <div>
            <span className="teacher-eyebrow">MAKE IT YOURS</span>
            <h2 id="teacher-settings-title">Your teaching studio</h2>
          </div>
          <button
            className="teacher-icon-button"
            aria-label="Close settings"
            onClick={onClose}
            disabled={busy}
          >
            <StudioIcon name="close" />
          </button>
        </div>
        <div className="teacher-settings-tabs" role="tablist" aria-label="Teacher settings">
          <button
            type="button"
            role="tab"
            disabled={busy}
            aria-selected={section === 'connection'}
            onClick={() => {
              setSection('connection');
              setError('');
              setNotice('');
            }}
          >
            AI connection
          </button>
          <button
            type="button"
            role="tab"
            disabled={busy}
            aria-selected={section === 'preferences'}
            onClick={() => {
              setSection('preferences');
              setError('');
              setNotice('');
            }}
          >
            Teaching preferences
          </button>
        </div>
        {section === 'connection' ? (
          <div className="teacher-settings-body">
            <div
              className={`teacher-connection-summary ${settings.configured ? 'is-connected' : ''}`}
            >
              <StudioIcon name="key" />
              <div>
                <strong>
                  {settings.configured
                    ? `Connected to ${connectedProvider.name}`
                    : 'Connect your AI teacher'}
                </strong>
                <p>
                  {settings.configured
                    ? `${settings.model} · ${settings.connection_source === 'project' ? 'Project connection' : serverConnection ? 'Server connection' : 'This signed-in session'}`
                    : 'Get thoughtful answers, working examples, and follow-up explanations powered by Gemini or OpenAI.'}
                </p>
              </div>
            </div>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                update('/connect', 'POST', {
                  provider,
                  api_key: key.trim() || null,
                  model: model.trim(),
                });
              }}
            >
              <label htmlFor="teacher-provider">
                AI provider
                <select
                  id="teacher-provider"
                  aria-label="AI provider"
                  value={provider}
                  disabled={busy}
                  onChange={(event) => {
                    const nextProvider = event.target.value;
                    setProvider(nextProvider);
                    setModel(
                      settings.configured && (settings.provider || 'openai') === nextProvider
                        ? settings.model
                        : settings.default_models?.[nextProvider] || PROVIDERS[nextProvider].model,
                    );
                    setKey('');
                    setError('');
                    setNotice('');
                  }}
                >
                  <option value="openai">OpenAI</option>
                  <option value="gemini">Google Gemini</option>
                </select>
              </label>
              <label htmlFor="teacher-api-key">
                {selectedProvider.name} API key
                <input
                  id="teacher-api-key"
                  aria-label={`${selectedProvider.name} API key`}
                  type="password"
                  autoComplete="off"
                  spellCheck={false}
                  value={key}
                  onChange={(event) => setKey(event.target.value)}
                  placeholder={selectedProvider.keyPlaceholder}
                  maxLength={512}
                  required={!canReuseKey}
                  disabled={busy}
                />
                {canReuseKey && (
                  <span className="teacher-field-help">
                    Leave blank to keep your current key and update the model.
                  </span>
                )}
              </label>
              <label htmlFor="teacher-model">
                Model
                <input
                  id="teacher-model"
                  aria-label="Model"
                  aria-describedby="teacher-model-help"
                  value={model}
                  onChange={(event) => setModel(event.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                  required
                  maxLength={100}
                  disabled={busy}
                />
                <span className="teacher-field-help" id="teacher-model-help">
                  Use a model available to your {selectedProvider.name} API project.
                </span>
              </label>
              <p className="teacher-privacy">
                {serverConnection
                  ? 'The project connection stays available after you sign out. A key entered here overrides it only for this signed-in session.'
                  : 'A key entered here is held on this server only for your signed-in session. Signing out removes it.'}{' '}
                Keys are never saved in browser storage or conversation history.
              </p>
              <p className="teacher-billing">
                {selectedProvider.billing}{' '}
                <a href={selectedProvider.keyUrl} target="_blank" rel="noopener noreferrer">
                  Get an API key <span aria-hidden="true">↗</span>
                </a>
              </p>
              <button
                className="teacher-primary"
                disabled={busy || (!canReuseKey && !key.trim()) || !model.trim()}
              >
                {busy
                  ? 'Checking connection…'
                  : canReuseKey
                    ? 'Update connection'
                    : `Connect ${selectedProvider.name}`}
                <StudioIcon name="next" size={17} />
              </button>
            </form>
            {settings.connection_source === 'session' && (
              <button
                className="teacher-remove"
                disabled={busy}
                onClick={() => update('/connection', 'DELETE', {})}
              >
                Remove session key
              </button>
            )}
          </div>
        ) : (
          <form
            className="teacher-settings-body"
            onSubmit={(event) => {
              event.preventDefault();
              update('/settings', 'PUT', preferences);
            }}
          >
            <p className="teacher-settings-intro">
              A teacher that meets you where you are. These preferences apply to your next question.
            </p>
            <label htmlFor="teacher-level">
              Your experience
              <select
                id="teacher-level"
                value={preferences.level}
                onChange={(event) => setPreferences({ ...preferences, level: event.target.value })}
              >
                <option value="beginner">Beginner — build my foundations</option>
                <option value="intermediate">Intermediate — connect the ideas</option>
                <option value="advanced">Advanced — go deeper technically</option>
              </select>
            </label>
            <label htmlFor="teacher-style">
              Explanation style
              <select
                id="teacher-style"
                value={preferences.style}
                onChange={(event) => setPreferences({ ...preferences, style: event.target.value })}
              >
                <option value="balanced">Balanced: intuition, examples, and detail</option>
                <option value="step_by_step">Step by step: one idea at a time</option>
                <option value="concise">Concise: focused, direct explanations</option>
              </select>
            </label>
            <label htmlFor="teacher-language">
              Teaching language
              <select
                id="teacher-language"
                value={preferences.language}
                onChange={(event) =>
                  setPreferences({ ...preferences, language: event.target.value })
                }
              >
                <option>English</option>
                <option>Tamil</option>
                <option>Tamil + English</option>
              </select>
            </label>
            <button className="teacher-primary" disabled={busy}>
              {busy ? 'Saving…' : 'Save preferences'}
              <StudioIcon name="check" size={17} />
            </button>
          </form>
        )}
        {error && (
          <div className="teacher-notice teacher-notice-error" role="alert">
            {error}
          </div>
        )}
        {notice && (
          <div className="teacher-notice" role="status">
            {notice}
          </div>
        )}
      </section>
    </div>
  );
}

export default function TeacherStudio({ user, onOpenLesson, onConnectionChange }) {
  const [settings, setSettings] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [currentId, setCurrentId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [modes, setModes] = useState({});
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingChat, setLoadingChat] = useState(false);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const controllerRef = useRef(null);
  const mountedRef = useRef(true);
  const sendingRef = useRef(false);
  const chatLoadRef = useRef(0);
  const textareaRef = useRef(null);
  const messagesRef = useRef(null);
  const followBottomRef = useRef(true);
  const onConnectionChangeRef = useRef(onConnectionChange);
  onConnectionChangeRef.current = onConnectionChange;
  const mode = modes[currentId || 'new'] || 'explain';
  const currentConversation = conversations.find((item) => item.id === currentId);

  function acceptSettings(value) {
    setSettings(value);
    onConnectionChangeRef.current?.(value);
  }
  async function initialize(signal) {
    setLoading(true);
    setError('');
    try {
      const [configuration, history] = await Promise.all([
        teacherApi('/settings', { signal }),
        teacherApi('/conversations', { signal }),
      ]);
      if (!mountedRef.current) return;
      acceptSettings(configuration);
      setConversations(history);
    } catch (e) {
      if (e.name !== 'AbortError' && mountedRef.current) setError(e.message);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }
  useEffect(() => {
    mountedRef.current = true;
    const controller = new AbortController();
    initialize(controller.signal);
    return () => {
      mountedRef.current = false;
      controller.abort();
      controllerRef.current?.abort();
      chatLoadRef.current += 1;
    };
  }, [user.id]);
  useEffect(() => {
    const field = textareaRef.current;
    if (field) {
      field.style.height = 'auto';
      field.style.height = `${Math.min(field.scrollHeight, 180)}px`;
    }
  }, [draft]);
  useEffect(() => {
    if (messagesRef.current && followBottomRef.current)
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
  }, [messages, busy, syncing]);

  function rememberConversation(conversation) {
    setConversations((items) => [
      conversation,
      ...items.filter((item) => item.id !== conversation.id),
    ]);
  }
  async function openConversation(id) {
    if (sendingRef.current || loadingChat) return;
    const request = ++chatLoadRef.current;
    setLoadingChat(true);
    setError('');
    try {
      const data = await teacherApi(`/conversations/${id}`);
      if (!mountedRef.current || request !== chatLoadRef.current) return;
      setCurrentId(id);
      setMessages(data.messages);
      setShowHistory(false);
      followBottomRef.current = true;
    } catch (e) {
      if (mountedRef.current && request === chatLoadRef.current) setError(e.message);
    } finally {
      if (mountedRef.current && request === chatLoadRef.current) setLoadingChat(false);
    }
  }
  async function deleteConversation(conversation) {
    if (sendingRef.current || loadingChat) return;
    if (!window.confirm(`Delete "${conversation.title || 'New conversation'}"?`)) return;
    setError('');
    try {
      await teacherApi(`/conversations/${conversation.id}`, { method: 'DELETE', body: {} });
      setConversations((items) => items.filter((item) => item.id !== conversation.id));
      if (currentId === conversation.id) {
        chatLoadRef.current += 1;
        setCurrentId(null);
        setMessages([]);
        setDraft('');
      }
    } catch (e) {
      if (mountedRef.current) setError(e.message);
    }
  }
  function newConversation() {
    if (sendingRef.current || loadingChat) return;
    chatLoadRef.current += 1;
    setCurrentId(null);
    setMessages([]);
    setError('');
    setShowHistory(false);
    textareaRef.current?.focus();
  }
  function usePrompt(prompt) {
    setDraft(prompt);
    textareaRef.current?.focus();
  }

  async function send(event) {
    event?.preventDefault();
    const question = draft.trim();
    if (
      !question ||
      sendingRef.current ||
      loadingChat ||
      !settings ||
      messages.some((item) => item.status === 'streaming')
    )
      return;
    if (!settings.configured) {
      setModal('connection');
      return;
    }
    const controller = new AbortController();
    controllerRef.current = controller;
    sendingRef.current = true;
    setBusy(true);
    setError('');
    setDraft('');
    followBottomRef.current = true;
    let conversationId = currentId;
    let accepted = false;
    let completed = false;
    let assistantId = `pending-assistant-${Date.now()}`;
    let localUserId = `pending-user-${Date.now()}`;
    let fullText = '';
    let optimisticAdded = false;
    let streamError = '';
    try {
      if (!conversationId) {
        const created = await teacherApi('/conversations', {
          method: 'POST',
          body: {},
          signal: controller.signal,
        });
        conversationId = created.id;
        if (!mountedRef.current) return;
        setCurrentId(created.id);
        rememberConversation(created);
        setModes((old) => ({ ...old, [created.id]: mode }));
      }
      setMessages((items) => [
        ...items,
        { id: localUserId, role: 'user', content: question, status: 'complete' },
        { id: assistantId, role: 'assistant', content: '', status: 'streaming' },
      ]);
      optimisticAdded = true;
      const response = await fetch(`/api/teacher/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: question, mode }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const detail = await response.json().catch(() => ({}));
        if (response.status === 401) window.dispatchEvent(new Event('session-expired'));
        throw new Error(
          typeof detail.detail === 'string'
            ? detail.detail
            : 'Your question could not be sent. Please try again.',
        );
      }
      if (!response.body)
        throw new Error(
          'Streaming is unavailable in this browser. Try a current version of Edge, Chrome, or Firefox.',
        );
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      function applyEvent(line) {
        if (!line.trim() || !mountedRef.current) return;
        const part = JSON.parse(line);
        if (part.type === 'start') {
          accepted = true;
          const previousAssistantId = assistantId;
          assistantId = part.assistant_message_id;
          setMessages((items) =>
            items.map((item) =>
              item.id === localUserId
                ? part.user_message
                : item.id === previousAssistantId
                  ? { ...item, id: assistantId }
                  : item,
            ),
          );
        } else if (part.type === 'delta') {
          fullText += part.text;
          setMessages((items) =>
            items.map((item) => (item.id === assistantId ? { ...item, content: fullText } : item)),
          );
        } else if (part.type === 'done') {
          completed = true;
          setMessages((items) =>
            items.map((item) => (item.id === assistantId ? part.message : item)),
          );
          if (part.conversation) rememberConversation(part.conversation);
        } else if (part.type === 'error') {
          streamError = part.message || 'The response was interrupted. Please try again.';
          setError(streamError);
        }
      }
      while (true) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) applyEvent(line);
        if (done) {
          if (buffer.trim()) applyEvent(buffer);
          break;
        }
      }
      if (!completed && !streamError)
        throw new Error(
          'The connection ended before the answer finished. Your conversation is being saved.',
        );
    } catch (e) {
      if (!mountedRef.current) return;
      if (e.name !== 'AbortError') setError(e.message);
      if (!accepted) {
        if (optimisticAdded)
          setMessages((items) =>
            items.filter((item) => item.id !== localUserId && item.id !== assistantId),
          );
        setDraft((current) => current || question);
      }
    } finally {
      if (mountedRef.current && accepted && !completed) {
        setMessages((items) =>
          items.map((item) =>
            item.id === assistantId ? { ...item, status: 'interrupted' } : item,
          ),
        );
        setSyncing(true);
        let restored = false;
        for (const delay of [250, 650, 1200]) {
          await new Promise((resolve) => setTimeout(resolve, delay));
          if (!mountedRef.current) break;
          try {
            const data = await teacherApi(`/conversations/${conversationId}`);
            if (!mountedRef.current) break;
            if (
              data.messages.some((item) => item.id === assistantId && item.status !== 'streaming')
            ) {
              setMessages(data.messages);
              rememberConversation(data.conversation);
              restored = true;
              break;
            }
          } catch {
            /* Keep the visible partial response if the network is still unavailable. */
          }
        }
        if (mountedRef.current && !restored)
          setError(
            (previous) =>
              previous ||
              'The answer was stopped. Saving may still be finishing; select this conversation again to refresh its history.',
          );
      }
      if (mountedRef.current) {
        setBusy(false);
        setSyncing(false);
      }
      sendingRef.current = false;
      controllerRef.current = null;
    }
  }

  const hasMessages = messages.length > 0;
  const providerName = PROVIDERS[settings?.provider || 'openai'].name;
  const awaitingSave = !busy && messages.some((item) => item.status === 'streaming');
  return (
    <section className="teacher-studio" aria-label="AI and ML teacher">
      <header className="teacher-page-heading">
        <div>
          <span className="teacher-eyebrow">A TEACHER FOR YOUR NEXT CHAPTER</span>
          <h1>
            AI & ML Teacher<span className="teacher-heading-dot">.</span>
          </h1>
          <p>Ask freely. Understand deeply. Build with confidence.</p>
        </div>
        <div className="teacher-heading-actions">
          <button
            className={`teacher-connection-button ${settings?.configured ? 'is-connected' : ''}`}
            onClick={() => setModal('connection')}
            disabled={!settings || busy}
          >
            <span className="teacher-status-dot" />
            {settings?.configured ? `${providerName} connected` : `Connect ${providerName}`}
          </button>
          <button
            className="teacher-icon-button"
            onClick={() => setModal('preferences')}
            disabled={!settings || busy}
            aria-label="Teaching preferences"
            title="Teaching preferences"
          >
            <StudioIcon name="settings" />
          </button>
        </div>
      </header>
      <div className="teacher-workspace">
        <aside
          className={`teacher-history ${showHistory ? 'is-open' : ''}`}
          aria-label="Saved conversations"
        >
          <div className="teacher-history-heading">
            <span className="teacher-eyebrow">YOUR CONVERSATIONS</span>
            <button
              className="teacher-mobile-close teacher-icon-button"
              aria-label="Close conversation history"
              onClick={() => setShowHistory(false)}
            >
              <StudioIcon name="close" size={18} />
            </button>
          </div>
          <button
            className="teacher-new-chat"
            onClick={newConversation}
            disabled={busy || loadingChat || loading}
          >
            <StudioIcon name="plus" size={17} />
            New conversation
          </button>
          <div className="teacher-history-list">
            {loading ? (
              <p className="teacher-history-empty">Loading your conversations…</p>
            ) : conversations.length === 0 ? (
              <div className="teacher-history-empty">
                <StudioIcon name="chat" size={25} />
                <p>A little curiosity goes a long way.</p>
                <span>Your conversations will be saved here.</span>
              </div>
            ) : (
              conversations.map((conversation) => (
                <div
                  key={conversation.id}
                  className={`teacher-history-item ${currentId === conversation.id ? 'is-active' : ''}`}
                >
                  <button
                    type="button"
                    className="teacher-history-open"
                    onClick={() => openConversation(conversation.id)}
                    disabled={busy || loadingChat}
                    aria-current={currentId === conversation.id ? 'page' : undefined}
                    title={conversation.title}
                  >
                    <StudioIcon name="chat" size={15} />
                    <span>{conversation.title || 'New conversation'}</span>
                  </button>
                  <span className="teacher-history-actions">
                    <span className="teacher-history-delete-hint">Delete</span>
                    <button
                      type="button"
                      className="teacher-history-delete"
                      aria-label={`Delete ${conversation.title || 'New conversation'}`}
                      title="Delete conversation"
                      onClick={(event) => {
                        event.stopPropagation();
                        deleteConversation(conversation);
                      }}
                      disabled={busy || loadingChat}
                    >
                      <StudioIcon name="trash" size={14} />
                    </button>
                  </span>
                </div>
              ))
            )}
          </div>
          <div className="teacher-history-note">
            <StudioIcon name="book" size={17} />
            <p>
              Build understanding,
              <br />
              <strong>one conversation at a time.</strong>
            </p>
          </div>
          {onOpenLesson && (
            <button className="teacher-lessons-link" onClick={() => onOpenLesson()} disabled={busy}>
              <span>Explore your lessons</span>
              <StudioIcon name="next" size={15} />
            </button>
          )}
        </aside>
        <div className="teacher-main">
          <div className="teacher-chat-toolbar">
            <button
              className="teacher-mobile-history teacher-icon-button"
              onClick={() => setShowHistory((shown) => !shown)}
              aria-label="Show conversation history"
            >
              <StudioIcon name="history" size={18} />
            </button>
            <span className="teacher-chat-title">
              {currentConversation?.title || 'Your space to understand'}
            </span>
            <label className="teacher-mode">
              <span className="teacher-sr-only">Teaching mode</span>
              <select
                aria-label="Teaching mode"
                value={mode}
                disabled={busy || loadingChat}
                onChange={(event) =>
                  setModes({ ...modes, [currentId || 'new']: event.target.value })
                }
              >
                {MODES.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div
            className={`teacher-thread ${hasMessages ? 'has-messages' : ''}`}
            ref={messagesRef}
            onScroll={(event) => {
              const element = event.currentTarget;
              followBottomRef.current =
                element.scrollHeight - element.scrollTop - element.clientHeight < 100;
            }}
            aria-busy={loadingChat}
          >
            {loading || loadingChat ? (
              <div className="teacher-loading" role="status">
                <span className="teacher-thinking">
                  <i />
                  <i />
                  <i />
                </span>
                {loading ? 'Preparing your teaching studio…' : 'Opening your conversation…'}
              </div>
            ) : !hasMessages ? (
              <div className="teacher-welcome">
                <div className="teacher-welcome-mark">
                  <StudioIcon name="spark" size={30} />
                </div>
                <span className="teacher-eyebrow">CURIOUS MINDS BUILD GREAT THINGS</span>
                <h2>
                  What would you like
                  <br />
                  to understand, <em>{user.name?.split(' ')[0] || 'today'}?</em>
                </h2>
                <p>
                  Your personal teacher for AI and machine learning.
                  <br className="teacher-desktop-break" /> Explore an idea, work through code, or
                  ask the question you held back.
                </p>
                <div className="teacher-topic-grid">
                  {TOPICS.map((topic) => (
                    <button
                      key={topic.label}
                      className="teacher-topic"
                      onClick={() => usePrompt(topic.prompt)}
                    >
                      <span className="teacher-topic-icon">
                        <StudioIcon name={topic.icon} size={20} />
                      </span>
                      <strong>{topic.label}</strong>
                      <span>{topic.detail}</span>
                      <StudioIcon name="next" size={16} />
                    </button>
                  ))}
                </div>
                <div className="teacher-welcome-tail">
                  <span>Start anywhere.</span> Python · Statistics · Model training · AI engineering
                </div>
              </div>
            ) : (
              <div className="teacher-messages">
                {messages.map((message) => (
                  <article
                    key={message.id}
                    className={`teacher-message teacher-message-${message.role}`}
                  >
                    <div className="teacher-message-avatar">
                      {message.role === 'assistant' ? (
                        <StudioIcon name="spark" size={18} />
                      ) : (
                        (user.name || 'You').slice(0, 1).toUpperCase()
                      )}
                    </div>
                    <div className="teacher-message-body">
                      <div className="teacher-message-byline">
                        <strong>{message.role === 'assistant' ? 'Your AI teacher' : 'You'}</strong>
                        {message.role === 'assistant' && message.status === 'streaming' && (
                          <span>Thinking with you</span>
                        )}
                      </div>
                      {message.role === 'assistant' ? (
                        <div className="teacher-markdown">
                          {message.content ? (
                            <Markdown>{message.content}</Markdown>
                          ) : message.status === 'streaming' ? (
                            <span
                              className="teacher-thinking"
                              aria-label="Teacher is preparing an answer"
                            >
                              <i />
                              <i />
                              <i />
                            </span>
                          ) : (
                            <p className="teacher-empty-response">
                              No answer was generated. You can ask again.
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="teacher-user-content">{message.content}</div>
                      )}
                      {message.status === 'interrupted' && (
                        <span className="teacher-interrupted">Response stopped</span>
                      )}
                      {message.status === 'error' && (
                        <span className="teacher-interrupted">Response could not be completed</span>
                      )}
                      {message.content && message.status !== 'streaming' && (
                        <CopyButton text={message.content} label="Copy message" />
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
          <div className="teacher-compose-area">
            {awaitingSave && (
              <div className="teacher-connect-note">
                <span>The last response is still finishing. Refresh to load the saved answer.</span>
                <button onClick={() => openConversation(currentId)} disabled={loadingChat}>
                  Refresh
                </button>
              </div>
            )}
            {error && (
              <div className="teacher-inline-error" role="alert">
                <span>{error}</span>
                {!settings && !loading && <button onClick={() => initialize()}>Retry</button>}
                <button aria-label="Dismiss message" onClick={() => setError('')}>
                  <StudioIcon name="close" size={15} />
                </button>
              </div>
            )}
            {!loading && settings && !settings.configured && (
              <div className="teacher-connect-note">
                <StudioIcon name="spark" size={16} />
                <span>Connect {providerName} to start a conversation with your teacher.</span>
                <button onClick={() => setModal('connection')}>
                  Connect <StudioIcon name="next" size={14} />
                </button>
              </div>
            )}
            {hasMessages && !busy && (
              <div className="teacher-followups" aria-label="Suggested follow-up questions">
                {FOLLOWUPS.map(([label, prompt]) => (
                  <button key={label} onClick={() => usePrompt(prompt)}>
                    {label}
                  </button>
                ))}
              </div>
            )}
            <form className="teacher-composer" onSubmit={send}>
              <label htmlFor="teacher-question" className="teacher-sr-only">
                Ask your AI and ML teacher
              </label>
              <textarea
                ref={textareaRef}
                id="teacher-question"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder={
                  hasMessages
                    ? 'Ask a follow-up, share your code, or tell me what feels unclear…'
                    : 'Ask anything about AI or machine learning…'
                }
                rows={2}
                maxLength={12000}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                    event.preventDefault();
                    if (!busy) send();
                  }
                }}
              />
              <div className="teacher-composer-bottom">
                <button
                  className="teacher-preferences-shortcut"
                  type="button"
                  onClick={() => setModal('preferences')}
                  disabled={!settings || busy}
                >
                  <StudioIcon name="settings" size={14} />
                  <span>
                    {settings
                      ? `${settings.preferences.level[0].toUpperCase()}${settings.preferences.level.slice(1)} · ${settings.preferences.language}`
                      : 'Personalized teaching'}
                  </span>
                </button>
                {busy ? (
                  <button
                    type="button"
                    className="teacher-send teacher-stop"
                    onClick={() => controllerRef.current?.abort()}
                    disabled={syncing}
                    aria-label={syncing ? 'Saving conversation' : 'Stop generating'}
                    title={syncing ? 'Saving conversation' : 'Stop generating'}
                  >
                    <StudioIcon name="stop" size={17} />
                  </button>
                ) : (
                  <button
                    type="submit"
                    className="teacher-send"
                    disabled={!draft.trim() || !settings || loadingChat || awaitingSave}
                    aria-label={
                      settings?.configured ? 'Send question' : `Connect ${providerName} to send`
                    }
                    title={
                      settings?.configured ? 'Send question' : `Connect ${providerName} to send`
                    }
                  >
                    <StudioIcon name="arrow" size={19} />
                  </button>
                )}
              </div>
            </form>
            <div className="teacher-composer-caption">
              <span role="status">
                {syncing
                  ? 'Saving your conversation…'
                  : busy
                    ? 'Your teacher is responding. You can draft your next question.'
                    : 'AI can make mistakes. Run examples and check important details.'}
              </span>
              <span>
                Enter to send <b>·</b> Shift + Enter for a new line
              </span>
            </div>
          </div>
        </div>
      </div>
      {modal && settings && (
        <TeacherSettings
          settings={settings}
          initialSection={modal}
          onChange={acceptSettings}
          onClose={() => setModal(null)}
        />
      )}
    </section>
  );
}
