// Thin fetch wrapper for the Nocturne API. All requests carry the session
// cookie automatically (same-origin); no token handling needed client-side.
const Api = (() => {
  async function request(method, url, body) {
    const res = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      credentials: 'same-origin',
      body: body ? JSON.stringify(body) : undefined,
    });
    let data = null;
    try { data = await res.json(); } catch (e) { /* no body */ }
    if (!res.ok) {
      const err = new Error((data && data.error) || `Request failed (${res.status})`);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  return {
    signup: (email, password) => request('POST', '/api/auth/signup', { email, password }),
    login: (email, password) => request('POST', '/api/auth/login', { email, password }),
    logout: () => request('POST', '/api/auth/logout'),
    me: () => request('GET', '/api/auth/me'),

    getBusiness: () => request('GET', '/api/business'),
    createBusiness: (idea) => request('POST', '/api/business', { idea }),
    deleteBusiness: () => request('DELETE', '/api/business'),
    runCycle: () => request('POST', '/api/business/cycle'),
    updateSettings: (partial) => request('PATCH', '/api/business/settings', partial),
    toggleAgent: (key, enabled) => request('PATCH', `/api/business/agents/${key}`, { enabled }),
    decideApproval: (id, decision) => request('PATCH', `/api/business/approvals/${id}`, { decision }),

    getChat: () => request('GET', '/api/chat'),
    sendChat: (text) => request('POST', '/api/chat', { text }),

    billingStatus: () => request('GET', '/api/billing/status'),
    createCheckoutSession: () => request('POST', '/api/billing/create-checkout-session'),
  };
})();
