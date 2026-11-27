/*<%% note:
# `<closure-row-viewer>`

Projects the currently selected (or focused) row of a
`<closure-data-grid>` onto its descendants through `bind` attributes.
Subscribes to the grid's `row-select` and `row-focus` events, and to
`row-update` (the data of the row on show changed in place); while no
row is selected it hides every bound child.

## Attributes

| Attribute | Description |
|---|---|
| `target="id"` | id of the `<closure-data-grid>` to bind to |
| `keep-space` | hide all descendant `bind-show` / `bind-hide` toggles with `visibility` instead of `display` |

## Per-child binding attributes

| Attribute on a descendant | Effect |
|---|---|
| `bind="field"`        | write `row[field]` into the element (`textContent`, `.value` for value-bearing controls/components, `data-field` on `<closure-btn>` / `<closure-btn-item>`) |
| `bind="f1,f2"`        | on `<closure-btn>` only — set one `data-*` attribute per field |
| `bind-show="field"`   | show only when `row[field]` is truthy |
| `bind-show="field=v"` | show only when `row[field] === v` |
| `bind-hide="field"`   | hide when `row[field]` is truthy |
| `bind-hide="field=v"` | hide when `row[field] === v` |
| `bind-keep-space`     | on `bind-show` / `bind-hide`, hide with `visibility` instead of `display` |
| `bind-crlf="<br>"`    | when the bound text has line breaks, render via `innerHTML` with the given separator |
| `bind-rows="field"`   | `row[field]` is a **list of rows**: the content of the element is the markup of one of them, repeated for each — see *Lists inside a row* |
| `bind-data-key="field"` | set the attribute `data-key` to `row[field]` — on any element. The `data-*` of a button are the fields it sends, so this is how a field travels under a name of its own |
| `abind-text="field"`  | write `row[field]` as the content of the element, like `bind` — for the elements where `bind` means something else (`<closure-btn>`) |
| `abind-tooltip="field"` | set the tooltip of the element (its `title`) to `row[field]` |
| `abind-text-format="…"` / `abind-tooltip-format="…"` | with several fields (`abind-tooltip="a,b"`), the text to build from them: `%1`, `%2`… are the fields in the order listed — see *Texts made of several fields* |
| `..field` (in any of the above) | inside a `bind-rows` list, read the field from the row that **holds** the list — see *Lists inside a row* |
| `map-data-id="id"`    | resolve through a `<data-map>` for icon / label / color substitution |
| `map-show="icon"`     | with `map-data-id`, render only the icon part |
| `map-show="label"`    | with `map-data-id`, render only the label part |

These attributes are not the viewer's alone: the `<grid-card>` of a
`<closure-data-grid>` paints each of its rows with the very same ones.

## Lists inside a row

A row can carry a list of rows in one of its fields — an array in a JSON
answer, a `<g-detail>` in `<g-row>` markup. `bind-rows` writes it out: the
element keeps, as written in the page, the markup of **one** row of the
list, and gets one copy of it per row.

```html
<closure-row-viewer target="users-grid">
  <span bind="username"></span>
  <ul bind-rows="sessions" bind-show="sessions">
    <li><span bind="device"></span> since <span bind="since"></span></li>
  </ul>
</closure-row-viewer>
```

Inside the element, `bind` and the other attributes read the row **of the
list**, not the row that holds it. A list can hold lists. A field that is
missing or is an empty list leaves the element empty, and `bind-show` on
that same field hides it.

A row of the list reaches the row that holds it — its master — with two
dots before the name: `..field`. It works wherever a field is named
(`bind`, `bind-show`, `bind-hide`, `bind-data-*`, `abind-*`). Each pair of
dots climbs one level, so in a list inside a list `....field` reads two rows
up; a level that does not exist reads as empty.

```html
<ul bind-rows="sessions">
  <li><span bind="device"></span> of <span bind="..username"></span></li>
</ul>
```

When the row of the list holds components, write it inside a `<template>`,
the only child of the element — there none of them has built itself yet,
and every copy must start from that:

```html
<div bind-rows="sessions"><template>
  <closure-status-bar>
    <status-kv key="Device" bind="device"></status-kv>
    <status-kv key="Since" bind="since"></status-kv>
  </closure-status-bar>
</template></div>
```

## Buttons that send fields of the row

A `<closure-btn>` sends its `data-*` attributes. `bind="a,b"` fills one per
field, named as the field (`data-a`, `data-b`; `..a` also gives `data-a`).
When the name to send is not the name of the field — or two rows have a field
of the same name — `bind-data-key="field"` names it:

```html
<div bind-rows="lines">
  <closure-btn free url="/orders/line" target="line-edit" return-refresh="row"
               bind-data-order="..id" bind-data-line="id"
               abind-text="number"></closure-btn>
</div>
```

The button sends `order` (the `id` of the row that holds the list) and `line`
(the `id` of the row of the list), and shows the number of the line.
`bind-data-*` is not the button's alone: it sets the attribute on any element.

A menu works the same way. The fields bound on the `<closure-btn menu>` go
with every item, and an item adds its own:

```html
<div bind-rows="lines">
  <closure-btn menu="Line" target="line-edit"
               bind-data-order="..id" bind-data-line="id">
    <closure-btn-item url="/orders/line/edit" return-refresh="row">Edit</closure-btn-item>
    <closure-btn-item url="/orders/line/copy" target="_blank"
                      bind-data-product="code">Copy</closure-btn-item>
  </closure-btn>
</div>
```

Both items send `order` and `line`; *Copy* also sends `product`. *Edit* opens
in `line-edit`, the window of the menu, and *Copy* in a new one.

## Texts made of several fields

`abind-text` and `abind-tooltip` take one field or several, separated by
commas. Several fields are joined by a space, or laid out by the matching
`-format`, where `%1`, `%2`… stand for the fields in the order listed (`%%`
is a percent sign):

```html
<closure-btn abind-text="number"
             abind-tooltip="..order_number,number"
             abind-tooltip-format="View order %1, line %2"></closure-btn>
```

When none of the fields has a value nothing is written: the element is left
empty, or without tooltip, instead of showing the bare words of the format.

## Actions that leave the window

| Attribute on a descendant | Effect |
|---|---|
| `return-refresh="row"` | the element takes the user to **another window** with the row on show — a `<form>` or a link with a `target`. When the user comes back to this window, the grid asks the server for that row again (its `single-row` query) |
| `return-refresh="all"` | the same, but the grid asks for its whole page again, staying where the user was |

```html
<closure-row-viewer target="users-grid">
  <form action="/admin/users/edit" method="post" target="user-edit" return-refresh="row">
    <input type="hidden" name="id" bind="id">
    <button type="submit">Edit</button>
  </form>
</closure-row-viewer>
```

## Properties

| Property | Description |
|---|---|
| `.row` (read-only) | the currently bound row object, or `null` |

## Example

```html
<closure-data-grid id="users-grid" …>…</closure-data-grid>

<closure-row-viewer target="users-grid">
  <span bind="username"></span>
  <span bind="role" map-data-id="role-map"></span>
  <span bind-show="active=1">✓ active</span>
  <span bind-show="active=0">✗ inactive</span>
  <span bind-hide="active">inactive only</span>
  <closure-btn ct-role="edit" bind="id">Edit</closure-btn>
</closure-row-viewer>
```

## Behaviour

> **Note:** elements with `[bind]` — and those with `bind-data-*` or
> `abind-*` — are hidden via `visibility: hidden`
> (so layout is preserved) when no row is selected. Elements with
> `[bind-show]` or `[bind-hide]` are hidden via `display: none`, unless
> the child has `bind-keep-space` or the viewer has `keep-space`.

> **Note:** `<input>`, `<textarea>`, `<select>` and custom components
> exposing a `.value` property receive the value via that property. This
> lets components such as `<status-kv>` update their value span without
> replacing their internal structure. Other elements get `textContent`
> (or `innerHTML` when `bind-crlf` is set).

> **Note:** when a `<data-map>` resolution returns a `color` field, that
> colour is applied to the bound element's `style.color`. Cleared on the
> next bind without a colour.

> **Note — `return-refresh`.** An edit opened in another window leaves this
> page untouched, so the grid would go on showing the row as it was. A form
> marked `return-refresh` tells the grid when it is **submitted**, any other
> element when it is **clicked**; nothing is asked then. The request goes
> when this window loses the user and gets them back (window `blur` then
> `focus`, or the tab hidden and shown again). Several rows sent out before
> coming back are all asked for; a user who never left asks for nothing. With
> `"row"` the grid needs a `single-row` query; the viewer of a detail grid fed
> by `detail-rows` refreshes the row of the master, which is where those rows
> come from. An inline grid has nobody to ask for a page: there `"all"` reloads
> the page.

---
%%>*/

class ClosureRowViewer extends HTMLElement {
  static _styleId = 'closure-row-viewer-default-style';
  static _style = [
    'closure-row-viewer { display: contents; visibility: hidden; }',
    'closure-row-viewer .rv-content { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }',
    'closure-row-viewer .rv-hidden { display: none; }',
  ].join('\n');

  connectedCallback() {
    if (this._initialized) {
      // Reconnect: re-attach the grid listeners removed on disconnect
      // and re-sync with whatever was selected while we were detached
      this._attachGridListeners();
      if (this._grid) this._setRow(this._grid.selectedRow || null);
      return;
    }
    this._initialized = true;
    if (!document.getElementById(ClosureRowViewer._styleId)) {
      const s = document.createElement('style');
      s.id = ClosureRowViewer._styleId;
      s.textContent = ClosureRowViewer._style;
      document.head.appendChild(s);
    }
    this._row = null;
    this._originalChildren = null;
    this._pendingUpdate = false;
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this._init(), { once: true });
    } else {
      this._init();
    }
  }

  disconnectedCallback() {
    if (this._grid && this._onRowSelect) {
      this._grid.removeEventListener('row-select', this._onRowSelect);
      this._grid.removeEventListener('row-focus', this._onRowFocus);
      this._grid.removeEventListener('row-update', this._onRowUpdate);
    }
  }

  _attachGridListeners() {
    if (!this._grid || !this._onRowSelect) return;
    this._grid.addEventListener('row-select', this._onRowSelect);
    this._grid.addEventListener('row-focus', this._onRowFocus);
    this._grid.addEventListener('row-update', this._onRowUpdate);
  }

  _init() {
    // Save original children as template
    this._template = this.innerHTML;
    this._bindTarget();
    this._watchActions();
    this._scheduleUpdate();
  }

  // ---
  // Children marked `return-refresh` are actions that take the user to
  // another window: a form when it is submitted, anything else (a link with
  // a `target`) when it is clicked. The grid is told which row went out, and
  // asks for it again when the user comes back to this window.
  _watchActions() {
    this.addEventListener('submit', e => {
      const form = e.target;
      if (form && form.hasAttribute && form.hasAttribute('return-refresh')) this._expectReturn(form);
    });
    this.addEventListener('click', e => {
      const el = e.target && e.target.closest ? e.target.closest('[return-refresh]') : null;
      if (el && el.tagName !== 'FORM' && this.contains(el)) this._expectReturn(el);
    });
  }

  // ---
  _expectReturn(el) {
    if (!this._row || !this._grid || typeof this._grid.expectReturn !== 'function') return;
    this._grid.expectReturn(el.getAttribute('return-refresh') === 'all' ? 'all' : 'row', this._row);
  }

  _bindTarget() {
    const targetId = this.getAttribute('target');
    if (!targetId) return;
    const grid = document.getElementById(targetId);
    if (!grid) return;
    this._grid = grid;

    this._onRowSelect = e => this._setRow(e.detail.row || null);
    this._onRowFocus = e => this._setRow(e.detail.row || null);
    // The data of the row on show changed in place (same object): paint it again
    this._onRowUpdate = e => { if (e.detail && e.detail.row === this._row) this._scheduleUpdate(); };
    this._attachGridListeners();

    // Sync with current selection if grid already has one
    if (grid.selectedRow) {
      this._setRow(grid.selectedRow);
    }
  }

  _update() {
    this.style.visibility = 'visible';
    const keepSpace = this.hasAttribute('keep-space');
    // Only the elements of the row on show: what a bind-rows list holds is
    // the markup of its own rows, and is written when the list is
    closureBindOwn(this, '[bind]').concat(closureBindNamed(this)).forEach(el => {
      el.style.visibility = this._row ? 'visible' : 'hidden';
    });
    if (!this._row) {
      closureBindOwn(this, '[bind-show], [bind-hide]').forEach(el => closureBindVisible(el, false, keepSpace));
      closureBindLists(this, null); // no row: its lists have no rows
      return;
    }
    // The fields of the row, written by the shared binding (the same one
    // paints the cards of a grid)
    closureBindRow(this, this._row, { keepSpace });
  }

  // ---
  _setRow(row) {
    if (row === this._row) return;
    this._row = row;
    this._scheduleUpdate();
  }

  // ---
  _scheduleUpdate() {
    if (this._pendingUpdate) return;
    this._pendingUpdate = true;
    requestAnimationFrame(() => {
      this._pendingUpdate = false;
      this._update();
    });
  }

  // ---
  get row() { return this._row; }
}

customElements.define('closure-row-viewer', ClosureRowViewer);
