const CHAT_SUGGESTIONS = [
  { label: 'What should we do today?', text: 'What should we focus on today?' },
  { label: 'Should I approve the ads?', text: 'Should I approve the $18/day ad spend?' },
];

let _lastChatSig = null;

// props: { open, businessName, messages, loading, input, sending,
//          onInputChange, onKeyDown, onSend, onClose, onSuggestion }
function renderChatPanel(props) {
  if (!props.open) { _lastChatSig = null; return null; }

  const msgNodes = props.messages.map((m) => h('div', { class: 'chat-msg', 'data-role': m.role }, [
    h('div', { class: 'chat-msg-who' }, m.role === 'user' ? 'You' : 'Ada · CEO'),
    h('div', { class: 'chat-msg-bubble' }, m.content),
  ]));

  if (props.loading) {
    msgNodes.push(h('div', { class: 'chat-typing' }, [h('span'), h('span'), h('span')]));
  }

  const body = h('div', { class: 'chat-body nc-scroll' }, msgNodes);

  const panel = h('div', { class: 'chat-panel' }, [
    h('div', { class: 'chat-head' }, [
      h('div', { class: 'chat-head-id' }, [
        h('div', { class: 'orb' }),
        h('div', {}, [
          h('div', { class: 'chat-head-name' }, 'Your AI co-founder'),
          h('div', { class: 'chat-head-status' }, `● online · runs ${props.businessName}`),
        ]),
      ]),
      h('button', { class: 'chat-close', onClick: props.onClose }, '×'),
    ]),
    body,
    h('div', { class: 'chat-foot' }, [
      h('div', { class: 'chat-suggestions' }, CHAT_SUGGESTIONS.map((sg) => h('button', {
        class: 'chat-suggestion', onClick: () => props.onSuggestion(sg.text),
      }, sg.label))),
      h('div', { class: 'chat-input-row' }, [
        h('textarea', {
          class: 'chat-input', rows: 1, value: props.input, placeholder: 'Message your co-founder…',
          onInput: (e) => props.onInputChange(e.target.value),
          onKeyDown: props.onKeyDown,
        }),
        h('button', { class: 'chat-send', disabled: props.sending, onClick: props.onSend }, '↑'),
      ]),
    ]),
  ]);

  const sig = props.messages.length + ':' + (props.loading ? 1 : 0);
  if (sig !== _lastChatSig) {
    _lastChatSig = sig;
    requestAnimationFrame(() => { body.scrollTop = body.scrollHeight; });
  }

  return panel;
}
