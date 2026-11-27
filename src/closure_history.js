/*<%% note:
# `<closure-history>`

Remembers, for each entry of the browser history, where every piece of the
page was — so coming back to the page (the back / forward buttons, a reload)
puts each piece where the user left it. Renders nothing (`display: none`).

It is **aseptic**: it knows nothing about grids, tabs or any other component,
and never interprets what it keeps. Each piece hands over a set of
attributes under its own name; when the page comes back, each piece gets its
own set and decides what to do with it. It keeps **state, never data**: the
rows, fields and content of a page are always fetched again.

Underneath it is `history.replaceState` (write) and `history.state` (read):
no entry is added to the history, the URL does not change and nothing
reaches the server.

## The state of an entry

One object per history entry, a member per piece, each with the attributes
that piece chose — the pieces need not resemble one another:

```
{
  users:  { page: 3, row: 7 },
  search: { q: "smith" },
  tabs:   { active: "settings" }
}
```

It lives under the single key `closureHistory` of `history.state`, so
whatever a page keeps there on its own is left alone.

## Attributes

None.

## Events

The whole conversation is events: a piece never calls `<closure-history>` and
need not know whether there is one. With no `<closure-history>` in the page
the events of the pieces reach nobody and nothing happens. And
`<closure-history>` never looks for the pieces: it knows only those that
introduced themselves, by the name they gave, and talks only to them.

| Event | From → to | `detail` | When |
|---|---|---|---|
| `history-register` | piece → history (must **bubble**) | `{ name }` | the piece introduces itself |
| `history-restore`  | history → piece (does not bubble) | `{ name, attributes }` | inside that same `history-register`, when the entry holds attributes of that piece — the piece has them before it paints. Also when the user moves to another entry of the same document |
| `history-save`     | piece → history (must **bubble**) | `{ name, attributes }` | something of the piece changed. The attributes **replace** the ones kept under that name; `attributes: null` forgets the piece |
| `history-resume`   | history → every registered piece (does not bubble, **cancelable**) | `{ name }` | the browser restored the page from memory instead of loading it again (see *Behaviour*) |
| `history-ready`    | history → `document` | none | `<closure-history>` is in charge: pieces that introduced themselves before it existed do it again |

The name of a piece always comes in the event, as `detail.name`; an event
without it is refused (`console.warn`). `<closure-history>` does not read the
tag, the `id` or any attribute of the element that dispatched it. Names are
unique within a page.

`attributes` is any value the browser can clone (plain objects, arrays,
strings, numbers, booleans…) — what goes in `history-save` is what comes back
in `history-restore`.

## Example

Any element can be a client, of this library or not; the page's own script
does by hand what a component would do by itself:

```html
<closure-history></closure-history>

<input id="volume" type="range" min="0" max="10" value="5">

<script>
  const volume = document.getElementById('volume');

  // 1. be ready to receive, then introduce yourself
  volume.addEventListener('history-restore', e => {
    volume.value = e.detail.attributes.level;
  });
  volume.dispatchEvent(new CustomEvent('history-register',
    { bubbles: true, detail: { name: 'volume' } }));

  // 2. hand over what is yours whenever it changes
  volume.addEventListener('change', () => {
    volume.dispatchEvent(new CustomEvent('history-save',
      { bubbles: true, detail: { name: 'volume', attributes: { level: volume.value } } }));
  });
</script>
```

Move the slider, go to another page and come back, or reload: the slider is
where it was.

## Behaviour

> **Note — who rules.** What is kept belongs to **one entry** of the
> history. Coming back to an entry that kept something, the entry rules.
> Any new request — a link, a form, a redirect — is a new entry that kept
> nothing: there the page rules, and no `history-restore` is dispatched.

> **Note — subscribing is the piece's decision.** Each element looks at its
> own attributes and decides whether to register, and under which name.
> `<closure-history>` inspects no tag and searches nothing in the page: an
> element that does not register does not exist for it. The only event not
> addressed to a registered piece is `history-ready`, the announcement that
> `<closure-history>` is there.

> **Note — one per page, placed first.** Put it at the top of `<body>`, before
> the pieces: a piece that registers then gets its `history-restore` inside
> its own `history-register`, before it paints. It also works when it arrives
> later (it announces itself with `history-ready`), but a piece that already
> painted has to move. A second `<closure-history>` in the page stays idle
> (`console.warn`).

> **Note — listen before you register.** `history-restore` is dispatched
> synchronously while `history-register` is still being dispatched, so the
> listener of the piece must already be there.

> **Note — writes are grouped.** Browsers limit how often the history can be
> written. A change is written at once when the last write was more than
> 400 ms ago; otherwise the changes of that interval go in one write at its
> end. Whatever is pending is written when the page is left or reloaded
> (`pagehide`, and `beforeunload` while a write is pending).

> **Note — restored from memory.** Going back, the browser may put the page
> back from memory exactly as it was, running no script: the pieces are
> where they were but show **old data**, and none registers again.
> `<closure-history>` then dispatches `history-resume` to every registered
> piece, so each one refreshes itself. A piece that cannot (its data came
> written in the page) calls `preventDefault()`, and `<closure-history>`
> reloads the page — the pieces then register and get their
> `history-restore` as on any load.

> **Note — entries of the same document.** Following a fragment link
> (`#section`) or a page's own `pushState` creates an entry without loading
> anything. A new entry that holds nothing gets what the pieces have now;
> going back to one that holds its own, that one rules and the registered
> pieces get `history-restore`.

> **Note:** attributes the browser cannot clone (a function, a DOM node) are
> refused with a `console.warn` and what was kept stays as it was.

---
%%>*/
class ClosureHistory extends HTMLElement {
  static _active = null;            // the instance in charge of the page
  static _KEY = 'closureHistory';   // the member of history.state it owns
  static _WRITE_GAP = 400;          // ms between two writes of the history

  connectedCallback() {
    this.style.display = 'none';
    if (ClosureHistory._active && ClosureHistory._active !== this) {
      console.warn('closure-history: only one per page; this one stays idle');
      return;
    }
    ClosureHistory._active = this;
    if (!this._pieces) {
      this._pieces = new Map();     // name -> the element that registered it
      this._dirty = false;
      this._timer = 0;
      this._lastWrite = 0;
      this._onRegister = e => this._register(e);
      this._onSave = e => this._save(e);
      this._onPageShow = e => { if (e.persisted) this._resume(); };
      this._onPageHide = () => this._flush();
      this._onEntryChange = () => this._entryChanged();
    }
    this._state = this._readEntry() || {};
    document.addEventListener('history-register', this._onRegister);
    document.addEventListener('history-save', this._onSave);
    window.addEventListener('pageshow', this._onPageShow);
    window.addEventListener('pagehide', this._onPageHide);
    window.addEventListener('popstate', this._onEntryChange);
    window.addEventListener('hashchange', this._onEntryChange);
    // Pieces that introduced themselves before this element existed do it again
    document.dispatchEvent(new CustomEvent('history-ready'));
  }

  disconnectedCallback() {
    if (ClosureHistory._active !== this) return;
    this._flush();
    document.removeEventListener('history-register', this._onRegister);
    document.removeEventListener('history-save', this._onSave);
    window.removeEventListener('pageshow', this._onPageShow);
    window.removeEventListener('pagehide', this._onPageHide);
    window.removeEventListener('popstate', this._onEntryChange);
    window.removeEventListener('hashchange', this._onEntryChange);
    ClosureHistory._active = null;
  }

  // ---
  // The element an event was dispatched on, also across shadow boundaries
  _source(e) {
    const path = e.composedPath ? e.composedPath() : [];
    return path.length ? path[0] : e.target;
  }

  // ---
  // The name a piece gave itself. It always comes in the event: the element
  // is never looked at, whatever its tag, its id or its attributes
  _name(e) {
    const name = e.detail && e.detail.name;
    return name ? String(name) : '';
  }

  // ---
  _clone(value) {
    return typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value));
  }

  // ---
  // Compared as text: what is kept is plain data
  _same(a, b) {
    try { return JSON.stringify(a) === JSON.stringify(b); } catch (err) { return false; }
  }

  // ---
  // What the current entry of the history keeps for this component, or null
  _readEntry() {
    let st;
    try { st = history.state; } catch (err) { return null; }
    const own = st && typeof st === 'object' ? st[ClosureHistory._KEY] : null;
    return own && typeof own === 'object' && !Array.isArray(own) ? this._clone(own) : null;
  }

  // ---
  _register(e) {
    const piece = this._source(e);
    const name = this._name(e);
    if (!name) { console.warn('closure-history: history-register without detail.name'); return; }
    const prev = this._pieces.get(name);
    if (prev && prev !== piece && prev.isConnected) {
      console.warn('closure-history: "' + name + '" registered twice; the last one wins');
    }
    this._pieces.set(name, piece);
    this._restore(name, piece);
  }

  // ---
  _restore(name, piece) {
    if (!Object.prototype.hasOwnProperty.call(this._state, name)) return;
    piece.dispatchEvent(new CustomEvent('history-restore', {
      detail: { name, attributes: this._clone(this._state[name]) },
    }));
  }

  // ---
  _save(e) {
    const name = this._name(e);
    if (!name) { console.warn('closure-history: history-save without detail.name'); return; }
    const attrs = e.detail ? e.detail.attributes : undefined;
    const had = Object.prototype.hasOwnProperty.call(this._state, name);
    if (attrs === undefined || attrs === null) {
      if (!had) return;
      delete this._state[name];
    } else {
      let copy;
      try { copy = this._clone(attrs); } catch (err) {
        console.warn('closure-history: the attributes of "' + name + '" cannot be kept: ' + err);
        return;
      }
      if (had && this._same(this._state[name], copy)) return;
      this._state[name] = copy;
    }
    this._touch();
  }

  // ---
  // Something changed: write now when the last write is old enough, otherwise
  // once at the end of the gap (browsers limit how often history is written).
  _touch() {
    this._dirty = true;
    if (this._timer) return;
    const wait = this._lastWrite + ClosureHistory._WRITE_GAP - Date.now();
    if (wait <= 0) { this._flush(); return; }
    this._timer = setTimeout(() => { this._timer = 0; this._flush(); }, wait);
    // A reload takes the state of the entry before pagehide: while a write is
    // pending, beforeunload writes it in time. The listener lives only that
    // long (a permanent one can keep a page out of the browser's memory cache).
    window.addEventListener('beforeunload', this._onPageHide);
  }

  // ---
  // Writes what the pieces handed over into the current entry, next to
  // whatever else the page keeps in history.state.
  _flush() {
    if (this._timer) { clearTimeout(this._timer); this._timer = 0; }
    window.removeEventListener('beforeunload', this._onPageHide);
    if (!this._dirty) return;
    let st;
    try { st = history.state; } catch (err) { return; }
    if (st !== null && st !== undefined && (typeof st !== 'object' || Array.isArray(st))) {
      // The page keeps a value of its own that cannot take a member: leave it
      this._dirty = false;
      console.warn('closure-history: history.state is not an object; nothing is kept');
      return;
    }
    const next = Object.assign({}, st || {});
    if (Object.keys(this._state).length) next[ClosureHistory._KEY] = this._state;
    else delete next[ClosureHistory._KEY];
    this._lastWrite = Date.now();
    try {
      history.replaceState(next, '');
      this._dirty = false;
    } catch (err) {
      // Refused (written too often, a sandboxed frame): it stays pending for
      // the next change or for pagehide
      console.warn('closure-history: the history could not be written: ' + err);
    }
  }

  // ---
  // The page came back from the browser's memory: the pieces are where they
  // were, with old data, and none registers again. Each one is told; the
  // first that cannot refresh itself (preventDefault) has the page reloaded.
  _resume() {
    for (const [name, piece] of Array.from(this._pieces)) {
      if (!piece.isConnected) { this._pieces.delete(name); continue; }
      const ev = new CustomEvent('history-resume', { detail: { name }, cancelable: true });
      if (!piece.dispatchEvent(ev)) {
        this._flush(); // a reload keeps the state the entry has now, not what pagehide writes
        location.reload();
        return;
      }
    }
  }

  // ---
  // Another entry of the same document became the current one (popstate, a
  // fragment). An entry that keeps its own rules: the registered pieces are
  // restored from it. One that keeps nothing gets what the pieces have now.
  _entryChanged() {
    const own = this._readEntry();
    if (!own) {
      if (Object.keys(this._state).length) { this._dirty = true; this._flush(); }
      return;
    }
    if (this._same(own, this._state)) return;
    if (this._timer) { clearTimeout(this._timer); this._timer = 0; }
    window.removeEventListener('beforeunload', this._onPageHide);
    this._dirty = false; // what was pending belonged to the entry that was left
    this._state = own;
    for (const [name, piece] of Array.from(this._pieces)) {
      if (!piece.isConnected) { this._pieces.delete(name); continue; }
      this._restore(name, piece);
    }
  }
}

customElements.define('closure-history', ClosureHistory);
