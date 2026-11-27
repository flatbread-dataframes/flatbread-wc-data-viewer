import { splitParts, parseFilterValue, quoteExact } from "../data/filter.js"

// The value of a ="…" part (the parts the list owns), or null for any other part
const exactValue = part => {
    const [parsed] = parseFilterValue(part)
    return parsed.type === "exact" && parsed.caseSensitive ? parsed.pattern : null
}

// A single unquoted contains term, copied into the search when the list opens; null otherwise
const plainTerm = expression => {
    const parts = splitParts(expression)
    if (parts.length !== 1) return null
    const [parsed] = parseFilterValue(parts[0])
    return parsed.type === "contains" && !parsed.caseSensitive ? parts[0] : null
}

class FilterCombo extends HTMLElement {
    static _instanceCount = 0

    static get observedAttributes() {
        return ["placeholder", "disabled"]
    }

    static get defaults() {
        return { maxOptions: 50 }
    }

    constructor() {
        super()
        this.attachShadow({ mode: "open" })
        this._instanceId = FilterCombo._instanceCount++
        this._anchorName = `--fc-${this._instanceId}`
        this._options = null
        this._layout = null           // { pinned, items }: the list's order, fixed until the next layout
        this._consumedTerm = null     // the plain term copied into the search; replaced by the first tick
        this._highlightIndex = -1
        this.maxOptions = FilterCombo.defaults.maxOptions

        this.handleInput = this.handleInput.bind(this)
        this.handleKeydown = this.handleKeydown.bind(this)
        this.handleClear = this.handleClear.bind(this)
        this.handleTriggerClick = this.handleTriggerClick.bind(this)
        this.handlePopoverToggle = this.handlePopoverToggle.bind(this)
        this.handlePopoverClick = this.handlePopoverClick.bind(this)
        this.handleSearchInput = this.handleSearchInput.bind(this)
        this.handleSearchKeydown = this.handleSearchKeydown.bind(this)
    }

    // MARK: lifecycle
    connectedCallback() {
        this.render()
        this.addEventListeners()
    }

    disconnectedCallback() {
        this.removeEventListeners()
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue === newValue) return
        this.updateAttributes()
    }

    addEventListeners() {
        this.input.addEventListener("input", this.handleInput)
        this.input.addEventListener("keydown", this.handleKeydown)
        this.shadowRoot.querySelector(".clear").addEventListener("click", this.handleClear)
        this.shadowRoot.querySelector(".trigger").addEventListener("click", this.handleTriggerClick)
        this.popover.addEventListener("beforetoggle", this.handlePopoverToggle)
        this.popover.addEventListener("click", this.handlePopoverClick)
        this.search.addEventListener("input", this.handleSearchInput)
        this.search.addEventListener("keydown", this.handleSearchKeydown)
    }

    removeEventListeners() {
        this.input.removeEventListener("input", this.handleInput)
        this.input.removeEventListener("keydown", this.handleKeydown)
        this.shadowRoot.querySelector(".clear").removeEventListener("click", this.handleClear)
        this.shadowRoot.querySelector(".trigger").removeEventListener("click", this.handleTriggerClick)
        this.popover.removeEventListener("beforetoggle", this.handlePopoverToggle)
        this.popover.removeEventListener("click", this.handlePopoverClick)
        this.search.removeEventListener("input", this.handleSearchInput)
        this.search.removeEventListener("keydown", this.handleSearchKeydown)
    }

    // MARK: get/set
    get input() {
        return this.shadowRoot.querySelector("input[type='text']")
    }

    get popover() {
        return this.shadowRoot.querySelector("[popover]")
    }

    get search() {
        return this.shadowRoot.querySelector(".search")
    }

    get list() {
        return this.shadowRoot.querySelector(".list")
    }

    get isOpen() {
        return this.popover?.matches(":popover-open") ?? false
    }

    get optionElements() {
        return this.list?.querySelectorAll(".option") ?? []
    }

    // Values ticked in the list: the ="…" parts of the expression
    get selectedValues() {
        return splitParts(this.value).map(exactValue).filter(value => value !== null)
    }

    get value() {
        return this.input ? this.input.value : ""
    }

    set value(val) {
        if (this.input) this.input.value = val
    }

    get options() {
        return this._options
    }

    // Refreshed options keep the order (no re-sort under the cursor); it changes on open and on search
    set options(values) {
        this._options = values
        if (!this._layout) this.layoutOptions()
        this.renderOptions()
    }

    get placeholder() {
        return this.getAttribute("placeholder") ?? ""
    }

    set placeholder(val) {
        if (val) this.setAttribute("placeholder", val)
        else this.removeAttribute("placeholder")
    }

    get disabled() {
        return this.hasAttribute("disabled")
    }

    set disabled(val) {
        if (val) this.setAttribute("disabled", "")
        else this.removeAttribute("disabled")
    }

    // MARK: api
    focus() {
        this.input?.focus()
    }

    blur() {
        this.input?.blur()
    }

    clear() {
        if (this.input && this.input.value !== "") {
            this.input.value = ""
            this.dispatchFilterEvent("")
        }
    }

    // The options depend on the other filters: an open list asks again, a closed one asks when it opens
    refreshOptions() {
        if (this.isOpen) this.requestOptions()
    }

    requestOptions() {
        this.dispatchEvent(new CustomEvent("filter-options-request", {
            bubbles: true,
            composed: true
        }))
    }

    // Adds or removes the value's ="…" part; other parts stay, except a consumed plain term
    toggleValue(text) {
        const parts = splitParts(this.value).filter(part => part !== this._consumedTerm)
        this._consumedTerm = null
        const kept = parts.filter(part => exactValue(part) === null)
        const listed = parts.filter(part => ![null, text].includes(exactValue(part)))
        if (!parts.some(part => exactValue(part) === text)) listed.push(quoteExact(text))
        this.input.value = [...kept, ...listed].join(", ")
        this.dispatchFilterEvent(this.input.value)
        this.syncChecks()
    }

    // MARK: render
    render() {
        const sheet = new CSSStyleSheet()
        sheet.replaceSync(`
            :host {
                display: grid;
                grid-template-columns: 1fr auto auto;
            }
            .anchor {
                display: grid;
                grid-template-columns: subgrid;
                grid-column: 1 / -1;
                anchor-name: ${this._anchorName};
            }
            input[type="text"] {
                min-width: 0;
                padding: 4px 6px;
                border: 1px solid var(--dv-border);
                border-right: none;
                border-radius: 4px 0 0 4px;
                background: transparent;
                color: inherit;
                font: inherit;
            }
            input[type="text"]:focus {
                outline: 2px solid var(--focus-color, Highlight);
                outline-offset: -1px;
                z-index: 1;
            }
            button {
                display: grid;
                place-items: center;
                border: 1px solid var(--dv-border);
                border-left: none;
                background: color-mix(in srgb, currentColor 8%, transparent);
                font: inherit;
                color: inherit;
                cursor: pointer;
                padding: 2px 6px;
            }
            button:hover:not(:disabled) {
                background: color-mix(in srgb, currentColor 12%, transparent);
            }
            button:disabled {
                opacity: 0.5;
                cursor: default;
            }
            .clear {
                font-size: 0.875em;
                opacity: 0.7;
            }
            .clear:hover:not(:disabled) {
                opacity: 1;
            }
            .trigger {
                border-radius: 0 4px 4px 0;
                font-size: 0.75em;
            }

            [popover] {
                position: fixed;
                position-anchor: ${this._anchorName};
                top: anchor(bottom);
                left: anchor(left);
                min-width: anchor-size(width);
                margin: 0;
                padding: 0;
                border: 1px solid var(--dv-border);
                border-radius: 4px;
                background: var(--dv-bg, white);
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                color: inherit;
                max-height: 240px;
                overflow-y: auto;
            }
            .search {
                position: sticky;
                top: 0;
                z-index: 1;
                box-sizing: border-box;
                width: 100%;
                padding: 4px 6px;
                border: none;
                border-bottom: 1px solid var(--dv-border);
                background: var(--dv-bg, white);
                color: inherit;
                font: inherit;
            }
            .search:focus {
                outline: 2px solid var(--focus-color, Highlight);
                outline-offset: -2px;
            }
            .separator {
                border-top: 1px solid var(--dv-border);
            }
            .option {
                display: flex;
                align-items: center;
                gap: 6px;
                padding: 4px 8px;
                cursor: pointer;
                user-select: none;
                scroll-margin-block: 2.5em;
            }
            .option.dimmed {
                opacity: 0.5;
            }
            .option:hover {
                background: color-mix(in srgb, currentColor 8%, transparent);
            }
            .option.highlighted {
                background: color-mix(in srgb, var(--focus-color) 20%, var(--dv-bg, white));
            }
            .option input[type="checkbox"] {
                margin: 0;
            }
            .message {
                padding: 8px 12px;
                color: color-mix(in srgb, currentColor 50%, transparent);
                font-size: 0.875em;
            }
            .footer[hidden] {
                display: none;
            }
            .footer {
                position: sticky;
                bottom: 0;
                border-top: 1px solid var(--dv-border);
                background: var(--dv-bg, white);
            }
        `)
        this.shadowRoot.adoptedStyleSheets = [sheet]
        this.shadowRoot.innerHTML = `
            <div class="anchor">
                <input type="text">
                <button type="button" class="clear" tabindex="-1">🞨</button>
                <button type="button" class="trigger" tabindex="-1">▾</button>
            </div>
            <div popover="auto">
                <input type="search" class="search" placeholder="Search values" autofocus>
                <div class="list"><div class="message">Loading…</div></div>
                <div class="message footer" hidden></div>
            </div>
        `
        this.updateAttributes()
    }

    // With an empty search, ticked values are pinned on top (dimmed when not in the options);
    // with a search, only matches, ticked ones in place
    layoutOptions() {
        if (!this._options) return
        const texts = [...new Set(this._options.map(String))]
        const search = this.search.value.trim().toLowerCase()
        if (search) {
            this._layout = { pinned: [], items: texts.filter(text => text.toLowerCase().includes(search)) }
            return
        }
        const selected = new Set(this.selectedValues)
        const present = new Set(texts)
        const dimmed = [...selected].filter(text => !present.has(text))
        this._layout = {
            pinned: [...texts.filter(text => selected.has(text)), ...dimmed],
            items: texts.filter(text => !selected.has(text)),
        }
    }

    // The combo always gets the full list; narrowing and the cap are a matter of rendering
    renderOptions() {
        if (!this._options || !this._layout) return
        const { pinned, items } = this._layout
        const selected = new Set(this.selectedValues)
        const present = new Set(this._options.map(String))
        const shown = items.slice(0, this.maxOptions)
        const pinnedPresent = pinned.filter(text => present.has(text)).length

        const nodes = pinned.map(text => this.buildOption(text, selected.has(text), !present.has(text)))
        if (pinned.length && shown.length) nodes.push(this.buildElement("div", "separator"))
        nodes.push(...shown.map(text => this.buildOption(text, selected.has(text), false)))
        if (!pinnedPresent && !items.length) {
            nodes.push(this.buildElement("div", "message", this._options.length ? "No matches" : "No values"))
        }
        this.list.replaceChildren(...nodes)
        this.optionElements[this._highlightIndex]?.classList.add("highlighted")

        // dimmed values are not counted
        const footer = this.shadowRoot.querySelector(".footer")
        footer.hidden = shown.length === items.length
        footer.textContent = `${pinnedPresent + shown.length} of ${(pinnedPresent + items.length).toLocaleString()} — type to narrow`
    }

    buildOption(text, checked, dimmed) {
        const option = this.buildElement("div", "option")
        option.classList.toggle("dimmed", dimmed)
        option.dataset.value = text
        const checkbox = Object.assign(document.createElement("input"), { type: "checkbox", tabIndex: -1, checked })
        option.append(checkbox, this.buildElement("span", "", text))
        return option
    }

    buildElement(tag, className, text = "") {
        return Object.assign(document.createElement(tag), { className, textContent: text })
    }

    updateAttributes() {
        const input = this.input
        if (!input) return

        const placeholder = this.getAttribute("placeholder")
        if (placeholder !== null) input.placeholder = placeholder
        else input.removeAttribute("placeholder")

        const disabled = this.hasAttribute("disabled")
        input.disabled = disabled
        this.shadowRoot.querySelector(".clear").disabled = disabled
        this.shadowRoot.querySelector(".trigger").disabled = disabled
    }

    // MARK: helpers
    syncChecks() {
        const selected = new Set(this.selectedValues)
        this.optionElements.forEach(option => {
            option.querySelector("input").checked = selected.has(option.dataset.value)
        })
    }

    setHighlight(index) {
        this._highlightIndex = index
        this.optionElements.forEach((option, i) => option.classList.toggle("highlighted", i === index))
        this.optionElements[index]?.scrollIntoView({ block: "nearest" })
    }

    // Closed from the keyboard: focus back to the input, whose keys apply again
    closeList() {
        this.popover.hidePopover()
        this.input.focus()
    }

    dispatchFilterEvent(value) {
        this.dispatchEvent(new CustomEvent("filter-input", {
            detail: { value },
            bubbles: true
        }))
    }

    // MARK: handlers
    // Typing filters the table and never opens the list
    handleInput() {
        this.dispatchFilterEvent(this.input.value)
    }

    // The list's keys are on the search field, which has focus while the list is open
    handleKeydown(event) {
        if (event.key === "Escape") {
            event.preventDefault()
            event.stopPropagation()
            this.clear()
            return
        }

        if (event.key === "ArrowDown" && event.altKey) {
            event.preventDefault()
            event.stopPropagation()
            this.popover.showPopover()
            return
        }

        if (!this.shouldAllowNavigation(event)) {
            event.stopPropagation()
        }
    }

    shouldAllowNavigation(event) {
        const cursorPos = this.input.selectionStart
        const isEmpty = this.input.value === ""

        switch (event.key) {
            case "ArrowUp":
            case "ArrowDown":
                return true
            case "ArrowLeft":
            case "Home":
                return isEmpty || cursorPos === 0
            case "ArrowRight":
            case "End":
                return isEmpty || cursorPos === this.input.value.length
            default:
                return false
        }
    }

    handleClear() {
        this.clear()
        this.input.focus()
    }

    handleTriggerClick() {
        if (this.isOpen) {
            this.popover.hidePopover()
        } else {
            this.popover.showPopover()
        }
    }

    // beforetoggle: the search and the list are ready when the popover shows
    handlePopoverToggle(event) {
        this._layout = null
        this._highlightIndex = -1
        if (event.newState === "open") {
            this._consumedTerm = plainTerm(this.value)
            this.search.value = this._consumedTerm ?? ""
            this.requestOptions()
        } else {
            this._consumedTerm = null
        }
    }

    handlePopoverClick(event) {
        const option = event.target.closest(".option")
        if (!option) return
        this._highlightIndex = [...this.optionElements].indexOf(option)
        this.toggleValue(option.dataset.value)
        this.setHighlight(this._highlightIndex)
        this.search.focus()
    }

    handleSearchInput() {
        this._highlightIndex = -1
        this.layoutOptions()
        this.renderOptions()
    }

    // Every key stays in the list: none reaches the table while it is open
    handleSearchKeydown(event) {
        event.stopPropagation()
        const last = this.optionElements.length - 1
        switch (event.key) {
            case "ArrowDown":
                this.setHighlight(Math.min(this._highlightIndex + 1, last))
                break
            case "ArrowUp":
                this.setHighlight(Math.max(this._highlightIndex - 1, -1))
                break
            case " ":
                if (this._highlightIndex < 0) return   // a space in the search
                this.toggleValue(this.optionElements[this._highlightIndex].dataset.value)
                break
            case "Escape":
                if (!this.search.value) {
                    this.closeList()
                    break
                }
                this.search.value = ""
                this.handleSearchInput()
                break
            case "Enter":
            case "Tab":
                this.closeList()
                break
            default:
                return
        }
        event.preventDefault()
    }
}

customElements.define("filter-combo", FilterCombo)
