/*<%% note:
# `<closure-select>`

A `<select>` that acts when its value changes, exactly as a `<closure-btn>`
acts when clicked: the `change` is the trigger, the chosen value travels as
one more field. Same attributes, same `getBtnData()` contract, same two
paths — a routed `btn-action` handled by the enclosing `<target-closure>`,
or a `free` hidden-form submit to `url`. Renders a native `<select>` inside
a shadow DOM (the system's own list, keyboard and all); the `<option>`s are
declared in light DOM and mirrored inside.

Outside any closure it is a plain picker: with `name` it joins the
enclosing `<form>` as a field (form-associated) without acting on its own.

## Attributes

| Attribute | Description |
|---|---|
| `name="x"`              | the field name of the chosen value in the payload; with it the element is also a field of the enclosing native `<form>` |
| `ct-role="x"`           | role used to match a `<closure-template>` template URL / response |
| `closure-template="x"`  | name of a specific `<closure-template>` to invoke |
| `section="x"`           | section key when packaging the fields for the closure |
| `data-*`                | included in `getBtnData()`'s payload; the chosen `<option>`'s own `data-*` are merged on top (the option wins) |
| `target-id="x"`         | element to receive the dispatched event (default: self, bubbling up to the closure) |
| `event="x"`             | event name to dispatch (default `btn-action`) |
| `free`                  | bypass target-closure: the change POSTs to `url` (hidden form, full navigation) |
| `url="x"`               | (with `free`) destination URL of the auto-generated form; without it, like a `<form>` without `action`, the page's own URL |
| `get` / `post` / `method="get\|post"` | (with `free`) the submit method, as on `<closure-btn free>`; default **POST** |
| `preserve`              | (with `free` + GET) keep the url's existing query, appending the fields |
| `disabled`              | the select is disabled and never acts |
| `label="x"`             | tooltip (`title`) of the select |

## Children

`<option value="x" [selected] [disabled] [data-*]>Label</option>` elements, as in a
native `<select>`; `<optgroup>` is accepted too. Changing the light-DOM options
after connect requires `refresh()`.

## Properties / methods

| Member | Description |
|---|---|
| `.value` (get/set) | the chosen value; setting it does **not** act (no event, no submit) |
| `getBtnData()`     | `{ ctRole, closureTemplate, sections: { [section]: { …data-*, …option data-*, [name or "value"]: value } } }` |
| `refresh()`        | rebuild the inner options from the light DOM |

## Events

| Event | Bubbles | Detail |
|---|---|---|
| `btn-action` (or custom `event`) | yes | none — the same event a `<closure-btn>` dispatches; `<target-closure>` reads `getBtnData()` from the source |
| `change` | yes | none — re-dispatched from the inner select so page scripts and dirty tracking see it |

## Example

```html
<!-- routed: the closure runs the template "action" with action=set-language, lang=<chosen> -->
<target-closure>
  <closure-template name="action" send-behavior="fetch" parse="closure-response">
    <template-url url="/action/" method="POST"></template-url>
  </closure-template>
  <closure-select name="lang" ct-role="action" closure-template="action" data-action="set-language">
    <option value="en" selected>English</option>
    <option value="fr">Français</option>
  </closure-select>
</target-closure>

<!-- free: GET ?lang=fr on the same page -->
<closure-select name="lang" free get url="">
  <option value="en">English</option>
  <option value="fr">Français</option>
</closure-select>
```

## CSS Variables

Consumed (with fallbacks):

| Variable | Default | Description |
|---|---|---|
| `--select-bg`        | `#fff`                | background of the select |
| `--select-color`     | `var(--text, #111827)` | text colour |
| `--select-border`    | `var(--border, #e5e7eb)` | border colour |
| `--select-radius`    | `4px`                 | border radius |
| `--select-padding`   | `4px 8px`             | inner padding |
| `--select-font-size` | `14px`                | font size |
| `--font`             | `sans-serif`          | font family |
| `--primary`          | `#4f46e5`             | focus ring |

## Behaviour

> **Note:** the trigger is the user's `change`. Setting `.value` from a
> script, or a `<response-item type="set-value">`, changes the selection
> silently; dispatch `change` on the element yourself if you want it to act.

> **Note:** as with `<closure-btn>`, a routed `<closure-select>` needs the
> `<target-closure>` to accept it as a source: the closure reads
> `getBtnData()` from the element that dispatched `btn-action` (or from
> `detail.source`), whatever its tag.

> **Note:** the inner `<select>` lives in the shadow DOM, so page CSS cannot
> reach it: use the `--select-*` variables (or the shared tokens) to restyle
> it. The host is `display: inline-block`.

---
%%>*/

class ClosureSelect extends HTMLElement {
  static formAssociated = true;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._internals = this.attachInternals ? this.attachInternals() : null;
  }

  connectedCallback() {
    if (this._built) return;
    this._built = true;
    this.style.display = 'inline-block';
    const style = document.createElement('style');
    style.textContent = `
      :host { display: inline-block; }
      select {
        font: inherit;
        font-family: var(--font, sans-serif);
        font-size: var(--select-font-size, 14px);
        color: var(--select-color, var(--text, #111827));
        background: var(--select-bg, #fff);
        border: 1px solid var(--select-border, var(--border, #e5e7eb));
        border-radius: var(--select-radius, 4px);
        padding: var(--select-padding, 4px 8px);
        max-width: 100%;
        cursor: pointer;
      }
      select:focus { outline: 2px solid var(--primary, #4f46e5); outline-offset: 1px; }
      select:disabled { cursor: default; opacity: .6; }
    `;
    const select = document.createElement('select');
    this._select = select;
    this.shadowRoot.appendChild(style);
    this.shadowRoot.appendChild(select);
    this.refresh();
    select.addEventListener('change', () => this._onChange());
  }

  static get observedAttributes() { return ['disabled', 'label']; }

  attributeChangedCallback() {
    if (this._select) this._syncState();
  }

  // Mirror the light-DOM <option>s (and <optgroup>s) into the inner select.
  refresh() {
    const select = this._select;
    if (!select) return;
    select.innerHTML = '';
    const copy = (src, dst) => {
      for (const child of src.children) {
        const tag = child.tagName;
        if (tag === 'OPTION') {
          const o = document.createElement('option');
          o.value = child.getAttribute('value') != null ? child.getAttribute('value') : child.textContent;
          o.textContent = child.textContent;
          if (child.hasAttribute('selected')) o.selected = true;
          if (child.hasAttribute('disabled')) o.disabled = true;
          o._light = child; // the source option, for its data-*
          dst.appendChild(o);
        } else if (tag === 'OPTGROUP') {
          const g = document.createElement('optgroup');
          g.label = child.getAttribute('label') || '';
          copy(child, g);
          dst.appendChild(g);
        }
      }
    };
    copy(this, select);
    this._syncState();
    this._syncFormValue();
  }

  _syncState() {
    this._select.disabled = this.hasAttribute('disabled');
    const label = this.getAttribute('label');
    if (label) this._select.title = label; else this._select.removeAttribute('title');
  }

  // Form participation only with a name (a nameless select is not a field).
  _syncFormValue() {
    if (!this._internals) return;
    if (this.hasAttribute('name')) this._internals.setFormValue(this.value);
    else this._internals.setFormValue(null);
  }

  get value() { return this._select ? this._select.value : ''; }
  set value(v) {
    if (!this._select) return;
    this._select.value = v == null ? '' : String(v);
    this._syncFormValue();
  }

  // The chosen option's source element (for its data-*), or null.
  _chosenLightOption() {
    const o = this._select && this._select.selectedOptions[0];
    return o ? (o._light || null) : null;
  }

  // The closure-btn contract: data-* of the element, the chosen option's data-*
  // on top (the option wins), and the value under `name` (or "value").
  getBtnData() {
    const section = this.getAttribute('section') || '';
    const fields = {};
    for (const attr of this.attributes) {
      if (attr.name.startsWith('data-')) fields[attr.name.slice(5)] = attr.value;
    }
    const opt = this._chosenLightOption();
    if (opt) {
      for (const attr of opt.attributes) {
        if (attr.name.startsWith('data-')) fields[attr.name.slice(5)] = attr.value;
      }
    }
    fields[this.getAttribute('name') || 'value'] = this.value;
    const sections = {};
    sections[section] = fields;
    return {
      ctRole: this.getAttribute('ct-role') || '',
      closureTemplate: this.getAttribute('closure-template') || '',
      sections: sections
    };
  }

  // The change is the click: free url → hidden-form submit; otherwise the
  // routed event, as <closure-btn>._dispatch() does.
  _onChange() {
    this._syncFormValue();
    // let the page (and the closure's dirty tracking) see a plain change too
    this.dispatchEvent(new Event('change', { bubbles: true }));
    if (this.hasAttribute('disabled')) return;
    if (this.hasAttribute('free')) {
      const url = this.getAttribute('url') || '';
      closureFreeSubmit(this, url, 'post');
      return;
    }
    const eventName = this.getAttribute('event') || 'btn-action';
    const targetId = this.getAttribute('target-id') || '';
    const dest = targetId ? document.getElementById(targetId) : this;
    if (dest) {
      dest.dispatchEvent(new CustomEvent(eventName, { bubbles: true, detail: { source: this } }));
    }
  }
}

if (!customElements.get('closure-select')) customElements.define('closure-select', ClosureSelect);
