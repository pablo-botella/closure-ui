/*<%% note:
# `<signal-event>`

Aseptic one-shot event dispatcher. Used to deliver named signals from a
streamed HTML response (or any other HTML payload) to JavaScript listeners
on the page. The element never renders (`display: none`); on connect it
reads its `name` and `data-*` attributes, dispatches a `CustomEvent` (on
`document` by default — or a named element via `target-id`), and removes
itself. With `delay` it acts as a declarative, DOM-bound **timer**: the
signal fires after the delay unless the node is removed first.

By default it is decoupled — no registry, dispatches on `document`, no
bubbling. Listeners subscribe with the standard DOM API:
`document.addEventListener(name, handler)`. `target-id` opts into a
specific element only when you need one.

With `type` it is also a one-shot **directive**: a small action the server
seeds in any HTML — the initial document included, where no
`<closure-response>` flow exists — that runs once and vanishes. The first
family is browser storage (see *Directives*).

## Attributes

| Attribute | Description |
|---|---|
| `name="x"`  | event name passed to `CustomEvent` (required unless `type` is set) |
| `type="x"`  | directive to run (see *Directives*); runs before the event, if `name` is also set |
| `bubbles`   | if present, the event bubbles (default: `false`) |
| `target-id="x"` | dispatch on the element with this id instead of `document` (resolved **when the event fires**; a missing id logs `console.warn` and skips dispatch). Pair with `bubbles` so it still reaches `document` |
| `delay="N"` | fire `N` ms after connect instead of immediately — a declarative timer. Removing the node (or replacing its container) before then cancels it |
| `no-cancel` | **special cases** — with `delay`, keep the timer running even if the node is removed (opts out of cancel-on-disconnect; the signal then fires from a detached node) |
| `data-*`    | every `data-*` becomes a key of `event.detail`, with the `data-` prefix stripped; the key keeps its original kebab-case. The storage `set` directives write the same pairs |
| `key="a,b"` | (`*-storage-clear`) the keys to remove, comma-separated; required |
| `pattern="a*,b?"` | (`*-storage-clear-wild`) glob patterns of the keys to remove, comma-separated (`*` any run, `?` one character, anchored) |
| `url="x"` | (`redirect`) where to navigate |
| `history="push\|replace"` | (`redirect`) `push` (default) adds a history entry (`location.assign`); `replace` substitutes the current one (`location.replace`), so the page that carried the signal is gone from the history |
| `if-ss="a,b"` / `if-ls="a,b"` | run only when every listed key exists in sessionStorage / localStorage; otherwise the element does nothing (no directive, no event) and removes itself silently |
| `if-not-ss="a,b"` / `if-not-ls="a,b"` | run only when none of the listed keys exists in that storage |
| `enable-macro="ss,ls"` | the macro sources allowed in this element's attributes: `ss` for `<ss:key>` (sessionStorage), `ls` for `<ls:key>` (localStorage). Without it, macros stay literal text (see *Macros*) |

## Directives

| `type` | Effect |
|---|---|
| `session-storage-set` / `local-storage-set` | every `data-*` pair is written to the storage: `data-sid="x"` → `storage.sid = "x"` (prefix stripped, kebab-case kept) |
| `session-storage-clear` / `local-storage-clear` | removes the keys listed in `key` (comma-separated); without `key` it removes **nothing** (`console.warn`) |
| `session-storage-clear-wild` / `local-storage-clear-wild` | removes every key matching one of the `pattern` globs (same glob as `ClosureResponse`'s `remove-*-storage pattern`); `pattern="*"` empties the storage, the one deliberate way to do it |
| `redirect` | navigates to `url`; `history` picks `location.assign` (push, default) or `location.replace` |

## Macros

With `enable-macro`, the attributes a directive reads (`url`, `key`, `pattern`,
every `data-*`) and the `data-*` of the event detail may carry macros that
are expanded when the signal fires:

| Macro | Value |
|---|---|
| `<ss:key>` | `sessionStorage.getItem("key")` |
| `<ls:key>` | `localStorage.getItem("key")` |

Inside `url` the value is inserted with `encodeURIComponent` (it is a value
within a URL, as one would do by hand in an `href`); add `:raw`
(`<ss:next:raw>`) to insert it untouched, e.g. a whole URL kept in storage.
Everywhere else the value goes in as is. Each source must be enabled by its
own token (`enable-macro="ss"` leaves `<ls:…>` literal). A macro whose key
does not exist in the storage logs `console.warn` and **nothing runs**:
neither the directive nor the event; the element still removes itself.

An unknown `type` logs `console.warn` and does nothing (the event, if any,
still fires). Storage access is guarded: a browser that blocks storage
(private window, disabled site data) logs the failure and the element still
removes itself.

## Example

```html
<signal-event name="need-fingerprint"
              data-token="carrot"
              data-potato-count="3"></signal-event>
```

```js
document.addEventListener('need-fingerprint', (e) => {
  const token      = e.detail['token'];
  const employeeId = e.detail['employee-id'];
  // …
});
```

Delayed, targeted signal — a self-contained, non-blocking timer node:

```html
<!-- 5s after this lands, poke #live-grid; the rest of the payload runs now -->
<signal-event name="auto-refresh" target-id="live-grid" delay="5000"></signal-event>
```

Storage directives — the server seeds the session id in the initial page,
and later clears the application's keys:

```html
<signal-event type="session-storage-set" data-sid="tomato-soup-42"></signal-event>
<signal-event type="session-storage-clear" key="cart,step"></signal-event>
<signal-event type="session-storage-clear-wild" pattern="soup_*"></signal-event>
<signal-event type="local-storage-clear-wild" pattern="*"></signal-event>   <!-- everything -->
```

Conditions — a page that works only with a session id in sessionStorage sends
the browser away when there is none, and loads itself otherwise:

```html
<signal-event type="redirect" history="replace" if-not-ss="sid" url="/public/"></signal-event>
<signal-event name="dinner-ready" if-ss="sid"></signal-event>
```

The answer to an entry POST, leaving no trace of itself in the history: the
session id goes to `sessionStorage`, then the browser is sent to the first
screen with the id read back from there:

```html
<signal-event type="session-storage-set" data-sid="tomato-soup-42"></signal-event>
<signal-event type="redirect" history="replace" enable-macro="ss"
              url="/kitchen/?sid=<ss:sid>"></signal-event>
```

See `examples/signal-event.html`: every directive, macro and condition,
injected by buttons, with the live storage and event log.

## Behaviour

> **Note:** the element fires once and removes itself. For a script to
> receive the event the matching `addEventListener` must already be
> registered when the signal fires — in a streamed response, place the
> subscribing `<script>` earlier in the document than the `<signal-event>`.

> **Note:** by default the event is dispatched on `document` — the emitter
> need not know who listens (the point of the pub/sub split), and a scoped
> listener filters inside its handler. For a **targeted** dispatch prefer
> the `ClosureResponse` directives `dispatch-event` / `trigger-click`;
> `target-id` here exists mainly for the `delay` case (a delayed, targeted
> signal those synchronous directives can't express) and for HTML inserted
> outside the `closure-response` flow.

> **Note — directives vs `<response-item>`.** The storage `type`s mirror
> `ClosureResponse`'s `set-*-storage` / `remove-*-storage` /
> `clear-*-storage`, but a `<response-item>` only runs inside a
> `<closure-response>` (a fetched body), while a `<signal-event type>` runs
> wherever it lands — the initial document, a fragment inserted by any
> means. Same one-shot, self-removing contract; `delay` applies to the
> directive too.

> **Note — timer bound to the node.** `delay="N"` fires the signal `N` ms
> after connect. Its lifetime is the node's: remove the `<signal-event>`
> (or replace its container with another response) and the pending dispatch
> is **cancelled** — declarative cancellation. A `target-id` is resolved
> **when it fires** (after the delay), so the DOM is settled by then; a
> missing id logs `console.warn` and skips.
>
> For special cases where the signal must outlive its node, add
> `no-cancel`: the timer keeps running after removal and fires from a
> detached node (held in memory until it does). Use sparingly — it gives
> up the "remove the node to cancel" guarantee.
>
> ⚠️ A delayed signal is **lost if the page navigates** (a `redirect` /
> full reload clears the timer). Use `delay` only for in-page signals; for
> something that must survive navigation, schedule it server-side.

---
%%>*/

customElements.define('signal-event', class extends HTMLElement {
  connectedCallback() {
    this.style.display = 'none';
    // A bare node — neither an event to dispatch nor a directive to run — is noise
    // (a condition alone, with nothing to run, is noise too).
    if (!this.getAttribute('name') && !this.getAttribute('type')) { this.remove(); return; }
    // A `no-cancel` timer survives disconnect (see disconnectedCallback). If the
    // node is reconnected while that timer is still pending, don't arm a second
    // one — the original still fires (and self-removes); a duplicate would
    // dispatch the signal twice from a node that's about to vanish.
    if (this._timer) return;
    // `delay="N"` (ms) turns this into a declarative timer bound to the node:
    // the event fires N ms after connect. Without it, fires immediately (in
    // document order, like any other directive — a same-response `redirect`
    // would lose a still-pending dispatch).
    const delay = parseInt(this.getAttribute('delay'), 10);
    if (delay > 0) this._timer = setTimeout(() => this._fire(), delay);
    else this._fire();
  }

  disconnectedCallback() {
    // By default the timer lives and dies with the node: removing a pending
    // <signal-event> (or replacing its container) cancels the dispatch.
    // `no-cancel` opts out — the delayed signal still fires after removal.
    if (this._timer && !this.hasAttribute('no-cancel')) {
      clearTimeout(this._timer);
      this._timer = null;
    }
  }

  _fire() {
    this._timer = null;
    // if-ss / if-not-ss / if-ls / if-not-ls: a condition that fails means a silent no-op
    if (!this._conditions()) { this.remove(); return; }
    let detail;
    try {
      detail = this._dataPairs();
    } catch (err) {
      // a macro pointed at a missing key: nothing runs (see _macro)
      console.warn('signal-event: ' + err.message);
      this.remove();
      return;
    }
    // The directive runs first, then the event (if any): a listener may rely on
    // what the directive just stored.
    const type = this.getAttribute('type');
    if (type) {
      try {
        this._runDirective(type, detail);
      } catch (err) {
        if (err instanceof ClosureMacroError) {
          console.warn('signal-event: ' + err.message);
          this.remove();
          return;
        }
        throw err;
      }
    }
    const name = this.getAttribute('name');
    if (name) {
      const target = this._resolveTarget();
      if (target) {
        target.dispatchEvent(new CustomEvent(name, {
          detail,
          bubbles: this.hasAttribute('bubbles')
        }));
      }
    }
    this.remove();
  }

  // Every data-* attribute, prefix stripped, kebab-case kept — the event detail
  // and the payload of the storage `set` directives.
  _dataPairs() {
    const pairs = {};
    for (const attr of this.attributes) {
      if (attr.name.startsWith('data-')) pairs[attr.name.slice(5)] = this._macro(attr.value, false);
    }
    return pairs;
  }

  // Every key of `if-ss` / `if-ls` must exist in its storage, none of `if-not-ss` /
  // `if-not-ls` may. Evaluated when the signal fires (after any delay). A blocked
  // storage counts as "no key".
  _conditions() {
    const check = (attr, storage, want) => {
      for (const key of this._list(this.getAttribute(attr))) {
        let has = false;
        try { has = storage.getItem(key) !== null; } catch (err) { has = false; }
        if (has !== want) return false;
      }
      return true;
    };
    return check('if-ss', window.sessionStorage, true) && check('if-not-ss', window.sessionStorage, false) &&
      check('if-ls', window.localStorage, true) && check('if-not-ls', window.localStorage, false);
  }

  // The attribute, with its macros expanded when their source is enabled
  // (`enable-macro="ss,ls"`): <ss:key> reads sessionStorage, <ls:key>
  // localStorage. In a url the value is percent-encoded unless the macro says
  // `:raw`. A missing key throws ClosureMacroError: the caller logs and runs nothing.
  _attr(name, isUrl) {
    return this._macro(this.getAttribute(name), isUrl);
  }

  _macro(value, isUrl) {
    // the shared expansion (closure_helper_functions.js); ClosureMacroError on a missing key
    return closureExpandMacros(value, this.getAttribute('enable-macro'), isUrl);
  }

  // The directives: browser storage, mirroring ClosureResponse's storage items
  // but runnable anywhere (the initial document included). Storage access can
  // throw (private window, blocked site data): log and carry on, the node still
  // removes itself.
  _runDirective(type, pairs) {
    if (type === 'redirect') {
      const url = this._attr('url', true);
      if (!url) {
        console.warn('signal-event: type "redirect" needs a url');
        return;
      }
      if (this.getAttribute('history') === 'replace') window.location.replace(url);
      else window.location.assign(url);
      return;
    }
    const m = /^(session|local)-storage-(set|clear|clear-wild)$/.exec(type);
    if (!m) {
      console.warn('signal-event: unknown type "' + type + '"');
      return;
    }
    try {
      const storage = m[1] === 'session' ? window.sessionStorage : window.localStorage;
      switch (m[2]) {
        case 'set':
          for (const k in pairs) storage.setItem(k, pairs[k]);
          break;
        case 'clear': {
          // no key, nothing removed: emptying a storage is clear-wild pattern="*", on purpose
          const keys = this._list(this._attr('key', false));
          if (keys.length === 0) {
            console.warn('signal-event: type "' + type + '" needs a key (to empty the storage use ' +
              m[1] + '-storage-clear-wild pattern="*")');
            break;
          }
          keys.forEach(k => storage.removeItem(k));
          break;
        }
        case 'clear-wild': {
          const res = this._list(this._attr('pattern', false)).map(p =>
            new RegExp('^' + p.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$'));
          if (res.length === 0) {
            console.warn('signal-event: type "' + type + '" needs a pattern');
            break;
          }
          const toRemove = [];
          for (let i = 0; i < storage.length; i++) {
            const k = storage.key(i);
            if (res.some(re => re.test(k))) toRemove.push(k);
          }
          toRemove.forEach(k => storage.removeItem(k));
          break;
        }
      }
    } catch (err) {
      if (err instanceof ClosureMacroError) throw err;
      console.warn('signal-event: type "' + type + '" failed: ' + err);
    }
  }

  // A comma-separated attribute as a trimmed list, blanks dropped.
  _list(value) {
    return (value || '').split(',').map(s => s.trim()).filter(s => s !== '');
  }

  // target-id (resolved at fire time) dispatches on that element; a missing
  // id warns and skips. Otherwise the default broadcast target is document.
  _resolveTarget() {
    const id = this.getAttribute('target-id');
    if (id) {
      const el = document.getElementById(id);
      if (!el) {
        console.warn('signal-event: target-id "' + id + '" not found; event "' +
          this.getAttribute('name') + '" not dispatched');
      }
      return el;
    }
    return document;
  }
});
