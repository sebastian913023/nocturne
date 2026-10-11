(function () {
  const root = document.getElementById('root');

  const state = {
    screen: 'loading', // loading | auth | idea | building | app
    user: null,
    idea: '',
    ideaError: '',
    submittingIdea: false,
    business: null,
    activity: [],
    buildStep: 0,
    buildStillWorking: false,
    tab: 'overview',
    chatOpen: false,
    chatMessages: [],
    chatLoading: false,
    chatSending: false,
    chatInput: '',
    planStatus: 'free',
    cycleRunning: false,
    upgrading: false,
  };

  let buildTimer = null;

  function cleanupScreen() {
    if (root._appCountdownTimer) { clearInterval(root._appCountdownTimer); root._appCountdownTimer = null; }
  }

  const STAGE_TABS = new Set(['overview', 'agents', 'growth', 'money', 'approvals']);

  function syncScene() {
    if (!window.Scene3D) return;
    const s = state.screen;
    if (s === 'idea') Scene3D.show('landing');
    else if (s === 'building') Scene3D.show('ambient', { progress: Math.min(1, state.buildStep / 7) });
    else if (s === 'loading' || s === 'auth') Scene3D.show('ambient', { progress: 0 });
    else if (s === 'app' && STAGE_TABS.has(state.tab) && state.business) Scene3D.show(state.tab, state.business);
    else Scene3D.show(null);
  }

  function render() {
    renderScreen();
    syncScene();
  }

  function renderScreen() {
    cleanupScreen();
    if (state.screen === 'loading') {
      mount(root, h('div', { class: 'auth-page' }, h('div', { class: 'auth-logo' }, [h('div', { class: 'orb' }), h('span', {}, 'NOCTURNE')])));
    } else if (state.screen === 'auth') {
      renderAuthScreen(root, { onAuthed: handleAuthed });
    } else if (state.screen === 'idea') {
      renderIdeaScreen(root, {
        idea: state.idea,
        isAuthed: !!state.user,
        submitting: state.submittingIdea,
        error: state.ideaError,
        onIdeaChange: (v) => { state.idea = v; },
        onBuild: handleBuildClick,
        onSignIn: () => { state.screen = 'auth'; render(); },
        onSignOut: handleSignOut,
      });
    } else if (state.screen === 'building') {
      renderBuildingScreen(root, {
        business: state.business || { name: 'Your company', tagline: 'Assembling the plan…' },
        buildStep: state.buildStep,
        stillWorking: state.buildStillWorking,
      });
    } else if (state.screen === 'app') {
      renderAppScreen(root, {
        business: state.business,
        activity: state.activity,
        tab: state.tab,
        chatOpen: state.chatOpen,
        chatMessages: state.chatMessages,
        chatLoading: state.chatLoading,
        chatInput: state.chatInput,
        chatSending: state.chatSending,
        planStatus: state.planStatus,
        cycleRunning: state.cycleRunning,
        upgrading: state.upgrading,
        userEmail: state.user && state.user.email,
        onTabChange: (id) => { state.tab = id; render(); },
        onToggleChat: () => { state.chatOpen = !state.chatOpen; render(); },
        onVisitSite: () => openSiteSheet(state.business),
        onOpenCompany: () => openCompanySheet(state.business),
        onRunCycle: runCycle,
        onSignOut: handleSignOut,
        onChatInput: (v) => { state.chatInput = v; },
        onChatKeyDown: (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); } },
        onSendChat: () => sendChat(),
        onSuggestion: (text) => sendChat(text),
        onUpgrade: handleUpgrade,
        onSelectAutonomy: (mode) => updateBusinessSettings({ autonomy: mode }),
        onSpendCap: (spendCap) => updateBusinessSettings({ spendCap }),
        onSelectDigest: (digest) => updateBusinessSettings({ digest }),
        onToggleAgent: (key, enabled) => {
          Api.toggleAgent(key, enabled).then((data) => { state.business = data.business; render(); }).catch(reportBusinessError);
        },
        onApprove: (id) => decideApproval(id, 'approved'),
        onReject: (id) => decideApproval(id, 'rejected'),
      });
    }
  }

  function updateBusinessSettings(partial) {
    Api.updateSettings(partial).then((data) => { state.business = data.business; render(); }).catch(reportBusinessError);
  }

  const decidingApprovals = new Set();

  function decideApproval(id, decision) {
    if (decidingApprovals.has(id)) return;
    decidingApprovals.add(id);
    Api.decideApproval(id, decision)
      .then((data) => {
        state.business = data.business;
        render();
        Overlay.toast(decision === 'approved' ? 'Approved — your agents will proceed.' : 'Rejected — nothing will be done.', { tone: 'success', ms: 3000 });
      })
      .catch(reportBusinessError)
      .finally(() => decidingApprovals.delete(id));
  }

  function runCycle() {
    if (state.cycleRunning) return;
    state.cycleRunning = true;
    render();
    Api.runCycle()
      .then((data) => {
        state.business = data.business;
        state.activity = data.activity || [];
        Overlay.toast('Night cycle complete — your morning report is updated.', { tone: 'success' });
      })
      .catch(reportBusinessError)
      .finally(() => { state.cycleRunning = false; render(); });
  }

  function reportBusinessError(err) {
    Overlay.toast((err && err.message) || 'Something went wrong. Please try again.', { tone: 'error' });
  }

  function handleSignOut() {
    Api.logout().finally(() => {
      state.user = null;
      state.business = null;
      state.activity = [];
      state.chatMessages = [];
      state.screen = 'idea';
      render();
    });
  }

  function handleAuthed(user) {
    state.user = user;
    loadBusinessThenRoute({ autoBuild: true });
  }

  function loadBusinessThenRoute(opts) {
    opts = opts || {};
    state.screen = 'loading';
    render();
    Api.getBusiness()
      .then((data) => {
        if (data.business) {
          state.business = data.business;
          state.activity = data.activity || [];
          state.planStatus = data.business.planStatus;
          state.screen = 'app';
          loadChatHistory();
          render();
        } else if (opts.autoBuild && (state.idea || '').trim()) {
          startBuild(state.idea.trim());
        } else {
          state.screen = 'idea';
          render();
        }
      })
      .catch(() => { state.screen = 'idea'; render(); });
  }

  function loadChatHistory() {
    Api.getChat().then((data) => {
      state.chatMessages = (data.messages || []).map((m) => ({ role: m.role, content: m.content }));
      if (state.screen === 'app') render();
    }).catch(() => {});
  }

  function handleBuildClick() {
    if (state.submittingIdea) return;
    const idea = (state.idea || '').trim();
    if (!idea) {
      state.ideaError = 'Describe your business idea first — or hit "Surprise me".';
      render();
      return;
    }
    if (!state.user) {
      // Preserve the typed idea and require sign-in before we build anything real.
      state.screen = 'auth';
      render();
      return;
    }
    startBuild(idea);
  }

  function startBuild(idea) {
    state.submittingIdea = true;
    state.ideaError = '';
    state.buildStep = 0;
    state.buildStillWorking = false;
    state.business = { name: 'Your company', tagline: 'Assembling the plan…' };
    state.screen = 'building';
    render();

    const STEP_COUNT = 7;
    let animationDone = false;
    let apiResult = null;
    let apiError = null;

    buildTimer = setInterval(() => {
      state.buildStep += 1;
      if (state.buildStep >= STEP_COUNT) {
        clearInterval(buildTimer);
        buildTimer = null;
        animationDone = true;
        state.buildStillWorking = !apiResult && !apiError;
        maybeFinish();
      }
      render();
    }, 950);

    Api.createBusiness(idea)
      .then((data) => { apiResult = data; maybeFinish(); })
      .catch((err) => { apiError = err; maybeFinish(); });

    function maybeFinish() {
      if (!animationDone) return;
      if (apiResult) {
        state.business = apiResult.business;
        state.activity = apiResult.activity || [];
        state.planStatus = apiResult.business.planStatus;
        state.submittingIdea = false;
        state.screen = 'app';
        state.tab = 'overview';
        render();
        loadChatHistory();
      } else if (apiError) {
        if (buildTimer) { clearInterval(buildTimer); buildTimer = null; }
        state.submittingIdea = false;
        if (apiError.status === 409 && apiError.data && apiError.data.business) {
          state.business = apiError.data.business;
          Api.getBusiness().then((data) => {
            state.activity = data.activity || [];
            state.planStatus = data.business.planStatus;
            state.screen = 'app';
            render();
            loadChatHistory();
          });
        } else {
          state.ideaError = apiError.message || 'Something went wrong building your company. Please try again.';
          state.screen = 'idea';
          render();
        }
      }
    }
  }

  function sendChat(presetText) {
    const text = (presetText != null ? presetText : state.chatInput).trim();
    if (!text || state.chatSending) return;
    state.chatMessages = [...state.chatMessages, { role: 'user', content: text }];
    state.chatInput = '';
    state.chatLoading = true;
    state.chatSending = true;
    render();
    Api.sendChat(text)
      .then((data) => {
        state.chatMessages = [...state.chatMessages, data.reply];
      })
      .catch(() => {
        state.chatMessages = [...state.chatMessages, {
          role: 'assistant',
          content: "I hit a snag reaching my planning model just now — try again in a moment.",
        }];
      })
      .finally(() => {
        state.chatLoading = false;
        state.chatSending = false;
        render();
      });
  }

  function handleUpgrade() {
    if (state.upgrading) return;
    state.upgrading = true;
    render();
    Api.createCheckoutSession()
      .then((data) => { window.location.href = data.url; })
      .catch((err) => {
        state.upgrading = false;
        render();
        // 503 means billing isn't configured server-side; don't surface env var names to customers.
        if (err && err.status === 503) {
          Overlay.toast('Upgrades are not available right now. Please try again soon.', { tone: 'error' });
        } else {
          reportBusinessError(err);
        }
      });
  }

  // ---- bootstrap ----
  const params = new URLSearchParams(window.location.search);
  if (params.get('upgraded')) state.planStatus = 'active';

  Api.me()
    .then((data) => { state.user = data.user; loadBusinessThenRoute(); })
    .catch(() => { state.screen = 'idea'; render(); });

  render();
})();
