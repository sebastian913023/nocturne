// Not part of the original design (the prototype had no auth screen) —
// added because production Nocturne needs real accounts so a business and
// its chat history persist across visits. Kept in the same visual language.
function renderAuthScreen(root, ctx) {
  let mode = 'login'; // 'login' | 'signup'
  let email = '';
  let password = '';
  let error = '';
  let loading = false;

  function submit(e) {
    e.preventDefault();
    if (loading) return;
    error = '';
    if (!email || !password) { error = 'Enter an email and password.'; return draw(); }
    loading = true;
    draw();
    const call = mode === 'login' ? Api.login(email, password) : Api.signup(email, password);
    call
      .then((data) => ctx.onAuthed(data.user))
      .catch((err) => { error = err.message || 'Something went wrong.'; loading = false; draw(); });
  }

  function draw() {
    const card = h('div', { class: 'auth-card' }, [
      h('h1', {}, mode === 'login' ? 'Welcome back' : 'Build your first company'),
      h('p', { class: 'sub' }, mode === 'login'
        ? 'Sign in to check on your AI co-founder.'
        : 'Create an account — free to start, no card required.'),
      h('form', { onSubmit: submit }, [
        h('div', { class: 'auth-field' }, [
          h('label', {}, 'Email'),
          h('input', {
            type: 'email', autocomplete: 'email', value: email, required: true,
            onInput: (e) => { email = e.target.value; },
          }),
        ]),
        h('div', { class: 'auth-field' }, [
          h('label', {}, 'Password'),
          h('input', {
            type: 'password', autocomplete: mode === 'login' ? 'current-password' : 'new-password',
            value: password, required: true, minLength: 8,
            onInput: (e) => { password = e.target.value; },
          }),
        ]),
        h('div', { class: 'auth-error' }, error || ''),
        h('button', { class: 'auth-submit', type: 'submit', disabled: loading }, loading ? 'Please wait…' : (mode === 'login' ? 'Sign in' : 'Create account')),
      ]),
      h('div', { class: 'auth-switch' }, [
        mode === 'login' ? 'New to Nocturne? ' : 'Already have an account? ',
        h('button', {
          type: 'button',
          onClick: () => { mode = mode === 'login' ? 'signup' : 'login'; error = ''; draw(); },
        }, mode === 'login' ? 'Create an account' : 'Sign in'),
      ]),
    ]);

    mount(root, h('div', { class: 'auth-page' }, [
      h('div', { class: 'bg-decor' }),
      h('div', { class: 'auth-logo' }, [h('div', { class: 'orb' }), h('span', {}, 'NOCTURNE')]),
      card,
    ]));
  }

  draw();
}
