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
  };

  let buildTimer = null;

  function cleanupScreen() {
    if (root._ideaCleanup) { root._ideaCleanup(); root._ideaCleanup = null; }
    if (root._appCountdownTimer) { clearInterval(root._appCountdownTimer); root._appCountdownTimer = null; }
  }

  function render() {
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
        userEmail: state.user && state.user.email,
        onTabChange: (id) => { state.tab = id; render(); },
        onToggleChat: () => { state.chatOpen = !state.chatOpen; render(); },
        onVisitSite: () => window.open(`https://${state.business.domain}`, '_blank', 'noopener'),
        onSignOut: handleSignOut,
        onReviewAds: () => { state.chatOpen = true; render(); sendChat('Should I approve the $18/day ad spend?'); },
        onChatInput: (v) => { state.chatInput = v; },
        onChatKeyDown: (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); } },
        onSendChat: () => sendChat(),
        onSuggestion: (text) => sendChat(text),
        onUpgrade: handleUpgrade,
      });
    }
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
    Api.createCheckoutSession()
      .then((data) => { window.location.href = data.url; })
      .catch((err) => {
        alert(err.message || 'Billing is not configured on this server yet.');
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
