/*<%% note:
# Helpers

Functions shared by closure-ui components. Loaded first in `_source.list`
so they are available before any component that calls them.

## `applyWidthRange(el)`

Reads the `wr="min,max"` attribute on `el` and applies it as inline
`min-width` / `max-width`. Used by `<status-part>`, `<status-buttons>` and
`<status-kv>` to expose a uniform width-range hint without each component
duplicating the parser.

| `wr` value | Effect |
|---|---|
| absent / empty                  | nothing |
| `*,*` / `-,-` (natural)         | `flex: 0 0 auto` (use intrinsic size) |
| `100px,300px`                   | both `min-width` and `max-width` |
| `100px,*` or `100px,-`          | only `min-width` |
| `*,300px` or `-,300px`          | only `max-width` |

`*` and `-` are interchangeable as "unset / unbounded" sentinels.

## Shared design tokens

The theming premise is **CSS can be used, never needed**: every component
ships complete defaults and consumes these shared tokens with the *same*
canonical fallback everywhere, so with zero page CSS the library looks
homogeneous — and declaring the tokens once (on `:root`, a wrapper, or an
element) re-themes everything in one stroke. See `examples/theming.html`.

| Token | Canonical default | Role |
|---|---|---|
| `--primary`       | `#4f46e5`    | accent: primary buttons, focus rings, selection |
| `--primary-light` | `#e0e7ff`    | soft accent: focus glow, hover washes |
| `--border`        | `#e5e7eb`    | every border and separator |
| `--bg`            | `#f9fafb`    | chrome surfaces: headers, footers, nav panels |
| `--text`          | `#111827`    | primary text |
| `--text-muted`    | `#6b7280`    | secondary text, labels, icons at rest |
| `--red`           | `#dc2626`    | errors, destructive actions, required marks |
| `--green`         | `#16a34a`    | success, active/live indicators |
| `--warning`       | `#d97706`    | warnings |
| `--font`          | `sans-serif` | UI text |
| `--font-mono`     | `monospace`  | tabular/timestamp text |
| `--radius`        | `8px`        | corner rounding of container components |

On top of the shared tokens, each component exposes its own prefixed hooks
(`--dash-*`, `--dg-*`, `--tab-*`, `--form-btn-*`, `--cfr-*`, `--summary-*`,
`--ska-*`, `--fh-*`, `--btn-item-*`, `--lazy-iframe-*`) — documented in its
own *CSS Variables* table. Component hooks with a semantic twin default
**through** the shared token (e.g. `--dg-border` → `var(--border)`,
`--ska-warn-color` → `var(--red)`), so the global palette wins unless the
component hook is set explicitly.

## `closureFreeSubmit(el, url, defaultMethod, opts?)`

The one encapsulated hidden-form submit of the library: builds a hidden
form targeting `url`, fills its fields, submits it — a full navigation to
the response — and removes the form node so it can't orphan in `<body>`
on a download / new-tab action.

Callers: `<closure-btn free url>` (default **POST** — an action button),
`<closure-btn-item url>` (POST, payload via its parent-merging
`getBtnData()`), `<dash-nav-item free url>` (default **GET** —
navigation), `<session-keep-alive>` (logoff POST and server-instructed
redirects), `<closure-data-grid>` (query-definition navigation and row
`navigate` actions) and `<closure-lazy-iframe post>` (form submitted
**into** the named frame via `opts.target`).

Method resolution, in precedence order (attribute steps need `el`):

1. boolean quick attributes on `el`: `post`, then `get`
2. `method="get|post"` on `el`
3. the caller's `defaultMethod`

Fields, first match wins:

1. `opts.fields` — caller-computed payload, names used as-is
2. `el.getBtnData()` when present — the closure-btn contract, keeping
   the source's own payload semantics (e.g. parent-menu merge),
   `section_`-prefixed
3. `el`'s `data-*` attributes, `section_`-prefixed when `el` has `section`

Extras: `el` may be `null` (pure caller-driven submit);
`opts.target` sets `form.target` (e.g. `_blank`); a GET submit is native
— the fields **replace** any query already on `url` — unless `preserve`
(the `opts.preserve` flag or a `preserve` attribute on `el`, mirroring
captured GET forms) folds the url's existing query params in as leading
fields so they survive. A GET with **no fields at all** (and no
`opts.target`) skips the form entirely and navigates plainly — no bare
`?` is appended to the url.

## `closureBindRow(root, row, opts?)`

Writes the fields of `row` onto the descendants of `root` that carry binding
attributes. It is the one implementation behind `<closure-row-viewer>` and
the `<grid-card>` of `<closure-data-grid>`, so both read the same attributes
the same way: `bind`, `bind-show`, `bind-hide`, `bind-keep-space`,
`bind-crlf`, `map-data-id`, `map-show`, `bind-rows`, `bind-data-*`,
`abind-text` and `abind-tooltip` — described under `<closure-row-viewer>`.

`root` is an element or a `DocumentFragment`; it need not be in the page.
`opts.keepSpace` hides every `bind-show` / `bind-hide` with `visibility`
instead of `display`. A field the row lacks, or `null`, is the empty text.
`opts.parents` lists the rows above `row`, nearest first: they are what a
field name written `..field` reads. The rows of a `bind-rows` list get
theirs without being asked — the row that holds the list.

---
%%>*/

function closureFreeSubmit(el, url, defaultMethod, opts) {
  opts = opts || {};
  var method = defaultMethod || 'post';
  if (el) {
    method = el.hasAttribute('post') ? 'post'
      : el.hasAttribute('get') ? 'get'
      : (el.getAttribute('method') || method);
  }
  var isGet = String(method).toLowerCase() === 'get';
  var form = document.createElement('form');
  form.method = isGet ? 'GET' : 'POST';
  if (url) form.action = url;
  if (opts.target) form.target = opts.target;
  form.style.display = 'none';

  var addField = function(name, value) {
    var hidden = document.createElement('input');
    hidden.type = 'hidden';
    hidden.name = name;
    hidden.value = value;
    form.appendChild(hidden);
  };

  // `preserve`: a native GET submit REPLACES the url's query string — fold
  // the existing query params in as leading fields so they survive (same
  // semantics as the `preserve` opt-in on captured GET forms)
  if (isGet && (opts.preserve || (el && el.hasAttribute('preserve')))) {
    var qi = (url || '').indexOf('?');
    if (qi >= 0) {
      new URLSearchParams(url.slice(qi + 1)).forEach(function(v, k) { addField(k, v); });
    }
  }

  if (opts.fields) {
    // Caller-computed payload (grid query params, server-sent payloads…):
    // names are final, no section prefixing
    for (var k in opts.fields) addField(k, opts.fields[k]);
  } else if (el && typeof el.getBtnData === 'function') {
    // Sources with the closure-btn contract keep their own payload
    // semantics — e.g. <closure-btn-item> merges the parent menu's data-*
    var sections = el.getBtnData().sections;
    for (var section in sections) {
      var fields = sections[section];
      for (var name in fields) {
        addField(section ? section + '_' + name : name, fields[name]);
      }
    }
  } else if (el) {
    // Plain elements: one field per data-* attribute, `section`-prefixed
    var sec = el.getAttribute('section') || '';
    Array.prototype.forEach.call(el.attributes, function(attr) {
      if (attr.name.indexOf('data-') !== 0) return;
      addField(sec ? sec + '_' + attr.name.slice(5) : attr.name.slice(5), attr.value);
    });
  }

  // GET with no fields at all: don't build a form — a fieldless GET submit
  // would append a bare "?" to the url. Plain navigation instead.
  if (isGet && !form.children.length && !opts.target) {
    window.location.href = url;
    return;
  }

  document.body.appendChild(form);
  form.submit();
  form.remove(); // drop the node post-submit so it can't orphan
                 // in <body> on a download / new-tab action
}

// ---- Row binding: shared by <closure-row-viewer> and the <grid-card> of
// <closure-data-grid>, so the same attributes mean the same in both ----

// Where a field name reads: each leading ".." climbs one level, from a row of
// a bind-rows list to the row that holds it (detail to master). `parents`
// lists the rows above, nearest first; a level that does not exist reads
// nothing. Returns the row to read and the name without its dots
function closureRowField(row, field, parents) {
  field = String(field === undefined || field === null ? '' : field);
  var up = 0;
  while (field.substring(0, 2) === '..') { up++; field = field.substring(2); }
  return { row: up === 0 ? row : ((parents && parents[up - 1]) || null), name: field };
}

// The value of a field of a row, as text. A field the row lacks, or null, is
// the empty text
function closureRowText(row, field, parents) {
  var at = closureRowField(row, field, parents);
  var v = at.row ? at.row[at.name] : undefined;
  return v === undefined || v === null ? '' : String(v);
}

// Whether a row meets a bind-show / bind-hide condition: "field" (the field
// has a value — row values are text, so "0" and "false" count as none) or
// "field=value"
function closureRowMatches(row, cond, parents) {
  var eq = cond.indexOf('=');
  if (eq < 0) {
    var actual = closureRowText(row, cond, parents).trim().toLowerCase();
    return actual !== '' && actual !== '0' && actual !== 'false';
  }
  return closureRowText(row, cond.substring(0, eq), parents) === cond.substring(eq + 1);
}

// Shows or hides the element of a bind-show / bind-hide. keepSpace (or its
// own bind-keep-space): hidden with `visibility`, so it keeps its place
function closureBindVisible(el, isVisible, keepSpace) {
  if (isVisible) {
    el.style.display = '';
    el.style.visibility = 'visible';
  } else if (keepSpace || el.hasAttribute('bind-keep-space')) {
    el.style.display = '';
    el.style.visibility = 'hidden';
  } else {
    el.style.display = 'none';
    el.style.visibility = '';
  }
}

// The descendants of root that match selector and belong to root's own row:
// what is inside a [bind-rows] block belongs to the rows of that list
function closureBindOwn(root, selector) {
  return Array.prototype.filter.call(root.querySelectorAll(selector), function(el) {
    var block = el.parentElement ? el.parentElement.closest('[bind-rows]') : null;
    return !block || block === root || !root.contains(block);
  });
}

// bind-rows="field": the content of the element is the markup of ONE row of
// that list; it is repeated for each of them, each copy bound to its row.
// The markup is kept the first time, so the element can be bound again
// (a viewer changes row). No list, or row null: the element is left empty.
// The markup may come inside a <template>, the only child: there no
// component has built itself yet, which a copy must start from.
function closureBindLists(root, row, opts) {
  closureBindOwn(root, '[bind-rows]').forEach(function(block) {
    if (block._closureRowsMarkup === undefined) {
      var only = block.children.length === 1 ? block.firstElementChild : null;
      block._closureRowsMarkup = only && only.tagName === 'TEMPLATE' ? only.innerHTML : block.innerHTML;
    }
    var list = row ? row[block.getAttribute('bind-rows')] : null;
    block.textContent = '';
    if (!Array.isArray(list)) return;
    // The rows of the list read the row that holds them as "..field"
    var inner = {};
    for (var k in (opts || {})) inner[k] = opts[k];
    inner.parents = [row].concat((opts && opts.parents) || []);
    list.forEach(function(item) {
      var tpl = document.createElement('template');
      tpl.innerHTML = block._closureRowsMarkup;
      closureBindRow(tpl.content, item && typeof item === 'object' ? item : {}, inner);
      block.appendChild(tpl.content);
    });
  });
}

// The own descendants of root (see closureBindOwn) that carry an attribute
// with its target in the name: bind-data-<key> or abind-<what>
function closureBindNamed(root) {
  var found = Array.prototype.filter.call(root.querySelectorAll('*'), function(el) {
    var attrs = el.attributes;
    for (var i = 0; i < attrs.length; i++) {
      var n = attrs[i].name;
      if (n.indexOf('bind-data-') === 0 || n.indexOf('abind-') === 0) return true;
    }
    return false;
  });
  return found.filter(function(el) {
    var block = el.parentElement ? el.parentElement.closest('[bind-rows]') : null;
    return !block || block === root || !root.contains(block);
  });
}

// The text of an abind-<what>-format: %1, %2… are the values, in the order
// the fields were listed; %% is a percent sign
function closureBindFormat(format, values) {
  return format.replace(/%(%|\d+)/g, function(whole, n) {
    if (n === '%') return '%';
    var v = values[parseInt(n, 10) - 1];
    return v === undefined ? '' : v;
  });
}

// Writes a text as the content of an element: the `value` of a control or
// of a component that exposes one, the text of anything else (bind-crlf: its
// line breaks as the given separator)
function closureBindWrite(el, val) {
  var tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || ('value' in el && tag.indexOf('-') >= 0)) {
    // Controls, and components that expose `.value`, take it there
    el.value = val;
    return;
  }
  var crlf = el.getAttribute('bind-crlf');
  if (crlf && val.indexOf('\n') >= 0) {
    // val is row data — escape it so only the author-provided
    // crlf separator is interpreted as HTML
    var esc = val.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    el.innerHTML = esc.replace(/\r?\n/g, crlf);
  } else {
    el.textContent = val;
  }
}

// bind-data-<key>="field": the attribute data-<key> — the payload a button
// sends. abind-text / abind-tooltip="field[,field…]": the content of the
// element / its tooltip, the fields joined by a space or laid out by the
// matching -format; with no value in any of its fields, nothing is shown
function closureBindNamedAttrs(el, row, parents) {
  Array.prototype.slice.call(el.attributes).forEach(function(attr) {
    var name = attr.name;
    if (name.indexOf('bind-data-') === 0) {
      var key = name.substring(10);
      if (key) el.setAttribute('data-' + key, closureRowText(row, attr.value.trim(), parents));
      return;
    }
    if (name !== 'abind-text' && name !== 'abind-tooltip') return;
    var values = attr.value.split(',').map(function(s) { return s.trim(); }).filter(Boolean)
      .map(function(f) { return closureRowText(row, f, parents); });
    var text = '';
    if (values.some(function(v) { return v !== ''; })) {
      var format = el.getAttribute(name + '-format');
      text = format === null ? values.join(' ') : closureBindFormat(format, values);
    }
    if (name === 'abind-text') closureBindWrite(el, text);
    else if (text) el.setAttribute('title', text);
    else el.removeAttribute('title');
  });
}

function closureBindRow(root, row, opts) {
  opts = opts || {};

  // Conditional visibility
  var parents = opts.parents || [];
  closureBindOwn(root, '[bind-show]').forEach(function(el) {
    closureBindVisible(el, closureRowMatches(row, el.getAttribute('bind-show') || '', parents), opts.keepSpace);
  });
  closureBindOwn(root, '[bind-hide]').forEach(function(el) {
    closureBindVisible(el, !closureRowMatches(row, el.getAttribute('bind-hide') || '', parents), opts.keepSpace);
  });

  closureBindOwn(root, '[bind]').forEach(function(el) {
    var bind = el.getAttribute('bind');
    if (!bind) return;
    var tag = el.tagName;

    // <closure-btn> / <closure-btn-item> take the fields as data-*: their
    // payload, one attribute per field, named as the field without its ".."
    if (tag === 'CLOSURE-BTN' || tag === 'CLOSURE-BTN-ITEM') {
      bind.split(',').map(function(s) { return s.trim(); }).filter(Boolean).forEach(function(f) {
        el.setAttribute('data-' + closureRowField(row, f, parents).name, closureRowText(row, f, parents));
      });
      return;
    }
    if (bind.indexOf(',') >= 0) return; // several fields: only those buttons take them

    var val = closureRowText(row, bind, parents);
    var mapId = el.getAttribute('map-data-id');
    if (mapId) {
      var map = document.getElementById(mapId);
      var resolved = map ? map.resolve(val) : null;
      if (resolved) {
        var show = el.getAttribute('map-show') || '';
        var display = '';
        if (show === 'icon') display = resolved.icon || '';
        else if (show === 'label') display = resolved.label || '';
        else {
          if (resolved.icon) display += resolved.icon;
          if (resolved.label) display += (display ? ' ' : '') + resolved.label;
        }
        el.textContent = display || val;
        el.style.color = resolved.color || '';
      } else {
        el.textContent = val;
        el.style.color = '';
      }
    } else {
      closureBindWrite(el, val);
    }
  });

  closureBindNamed(root).forEach(function(el) { closureBindNamedAttrs(el, row, parents); });

  closureBindLists(root, row, opts);
}

// ClosureMacroError: a <ss:key> / <ls:key> macro named a key that is not in the
// storage. Callers decide what "nothing runs" means for them (skip the field,
// skip the whole signal...) and log it.
class ClosureMacroError extends Error {}

// closureExpandMacros(value, enabled, isUrl): expands the storage macros of an
// attribute value — <ss:key> reads sessionStorage, <ls:key> localStorage — for
// the sources listed in `enabled` (the element's enable-macro="ss,ls", a
// comma-separated string or an array); a source not enabled leaves its macro
// as literal text. In a url the value is percent-encoded unless the macro
// says `:raw` (<ss:next:raw>). A missing key throws ClosureMacroError. Shared
// by <signal-event> and <template-field enable-macro>.
function closureExpandMacros(value, enabled, isUrl) {
  if (value == null) return value;
  var list = Array.isArray(enabled) ? enabled
    : String(enabled || '').split(',').map(function(s) { return s.trim(); }).filter(Boolean);
  if (list.length === 0) return value;
  return value.replace(/<(ss|ls):([^<>:]+)(:raw)?>/g, function(whole, src, key, raw) {
    if (list.indexOf(src) < 0) return whole;
    var storage = src === 'ss' ? window.sessionStorage : window.localStorage;
    var v = storage.getItem(key);
    if (v === null) throw new ClosureMacroError('macro ' + whole + ': no such key in ' + src);
    return (isUrl && !raw) ? encodeURIComponent(v) : v;
  });
}

function applyWidthRange(el) {
  var wr = el.getAttribute('wr');
  if (!wr) return;
  var parts = wr.split(',');
  var min = (parts[0] || '').trim();
  var max = (parts[1] || '').trim();
  var isNatural = (min === '-' || min === '*' || min === '') && (max === '-' || max === '*' || max === '');
  if (isNatural) {
    el.style.flex = '0 0 auto';
  } else {
    if (min && min !== '-' && min !== '*') el.style.minWidth = min;
    if (max && max !== '-' && max !== '*') el.style.maxWidth = max;
  }
}
