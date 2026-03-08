
class FilterCombo extends HTMLElement {
    static _instanceCount = 0

    static get observedAttributes() {
        return ["placeholder", "disabled"]
    }

    constructor() {
        super()
        this.attachShadow({ mode: "open" })
        this._instanceId = FilterCombo._instanceCount++
        this._anchorName = `--fc-${this._instanceId}`
        this._options = null
        this._optionsRequested = false
        this._highlightIndex = -1

        this.handleInput = this.handleInput.bind(this)
        this.handleKeydown = this.handleKeydown.bind(this)
        this.handleClear = this.handleClear.bind(this)
        this.handleTriggerClick = this.handleTriggerClick.bind(this)
        this.handlePopoverToggle = this.handlePopoverToggle.bind(this)
        this.handlePopoverClick = this.handlePopoverClick.bind(this)
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
        this.popover.addEventListener("toggle", this.handlePopoverToggle)
        this.popover.addEventListener("click", this.handlePopoverClick)
    }

    removeEventListeners() {
        this.input.removeEventListener("input", this.handleInput)
        this.input.removeEventListener("keydown", this.handleKeydown)
        this.shadowRoot.querySelector(".clear").removeEventListener("click", this.handleClear)
        this.shadowRoot.querySelector(".trigger").removeEventListener("click", this.handleTriggerClick)
        this.popover.removeEventListener("toggle", this.handlePopoverToggle)
        this.popover.removeEventListener("click", this.handlePopoverClick)
    }

    // MARK: get/set
    get input() {
        return this.shadowRoot.querySelector("input[type='text']")
    }

    get popover() {
        return this.shadowRoot.querySelector("[popover]")
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

    set options(values) {
        this._options = values
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

    invalidateOptions() {
        this._options = null
        this._optionsRequested = false
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
                border: 1px solid #ccc;
                border-right: none;
                border-radius: 4px 0 0 4px;
                font: inherit;
            }
            input[type="text"]:focus {
                outline: 2px solid #4a90d9;
                outline-offset: -1px;
                z-index: 1;
            }
            button {
                display: grid;
                place-items: center;
                border: 1px solid #ccc;
                border-left: none;
                background: #f8f8f8;
                font: inherit;
                cursor: pointer;
                padding: 2px 6px;
            }
            button:hover:not(:disabled) {
                background: #e8e8e8;
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
                border: 1px solid #ccc;
                border-radius: 4px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                max-height: 200px;
                overflow-y: auto;
            }
            .option {
                display: flex;
                align-items: center;
                gap: 6px;
                padding: 4px 8px;
                cursor: pointer;
                user-select: none;
            }
            .option:hover {
                background: #f0f0f0;
            }
            .option.highlighted {
                background: #e0e8f0;
            }
            .option input[type="checkbox"] {
                margin: 0;
            }
            .message {
                padding: 8px 12px;
                color: #888;
                font-size: 0.875em;
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
                <div class="message">Loading…</div>
            </div>
        `
        this.updateAttributes()
    }

    renderOptions() {
        const popover = this.popover
        if (!popover) return

        if (!this._options || this._options.length === 0) {
            popover.innerHTML = `<div class="message">Too many unique values — use text filter</div>`
            return
        }

        const filterText = this.input.value.trim().toLowerCase()
        const filtered = filterText
            ? this._options.filter(opt => String(opt).toLowerCase().includes(filterText))
            : this._options

        if (filtered.length === 0) {
            popover.innerHTML = `<div class="message">No matches</div>`
            return
        }

        const selected = this.parseSelectedValues()
        popover.innerHTML = filtered.map(opt => {
            const val = String(opt)
            const checked = selected.has(val) ? " checked" : ""
            return `<div class="option">
                <input type="checkbox" value="${val}" tabindex="-1"${checked}>
                <span>${val}</span>
            </div>`
        }).join("")
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
    parseSelectedValues() {
        const parts = this.input.value.split(",").map(p => p.trim()).filter(Boolean)
        return new Set(parts.map(p => p.startsWith("=") ? p.slice(1) : p))
    }

    syncCheckboxes() {
        const selected = this.parseSelectedValues()
        this.popover?.querySelectorAll("input[type='checkbox']").forEach(cb => {
            cb.checked = selected.has(cb.value)
        })
    }

    get optionCount() {
        return this.popover?.querySelectorAll(".option").length ?? 0
    }

    setHighlight(index) {
        this._highlightIndex = index
        const options = this.popover?.querySelectorAll(".option")
        if (!options) return
        options.forEach((opt, i) => opt.classList.toggle("highlighted", i === index))
    }

    toggleHighlightedOption() {
        const option = this.popover?.querySelectorAll(".option")[this._highlightIndex]
        if (!option) return
        const checkbox = option.querySelector("input[type='checkbox']")
        checkbox.checked = !checkbox.checked
        this.input.value = this.buildValueFromCheckboxes()
        this.dispatchFilterEvent(this.input.value)
    }

    buildValueFromCheckboxes() {
        const checked = this.popover?.querySelectorAll("input[type='checkbox']:checked")
        if (!checked || checked.length === 0) return ""
        return Array.from(checked).map(cb => `=${cb.value}`).join(", ")
    }

    dispatchFilterEvent(value) {
        this.dispatchEvent(new CustomEvent("filter-input", {
            detail: { value },
            bubbles: true
        }))
    }

    // MARK: handlers
    handleInput() {
        this.syncCheckboxes()
        this.dispatchFilterEvent(this.input.value)

        if (this._options && this._options.length > 0) {
            this.renderOptions()
            if (!this.popover.matches(":popover-open")) {
                this.popover.showPopover()
            }
            this.setHighlight(-1)
        }
    }

    handleKeydown(event) {
        const isOpen = this.popover?.matches(":popover-open")

        if (event.key === "Escape") {
            if (isOpen) {
                this.popover.hidePopover()
                return
            }
            event.preventDefault()
            event.stopPropagation()
            this.clear()
            return
        }

        if (event.key === "Enter") {
            if (isOpen) {
                event.preventDefault()
                this.popover.hidePopover()
            }
            return
        }

        if (event.key === "ArrowDown") {
            if (!isOpen && event.altKey) {
                event.preventDefault()
                event.stopPropagation()
                this.popover.showPopover()
                this.setHighlight(0)
                return
            }
            if (!isOpen) return // propagate to table navigation

            event.preventDefault()
            event.stopPropagation()
            if (this._highlightIndex < this.optionCount - 1) {
                this.setHighlight(this._highlightIndex + 1)
            }
            return
        }

        if (event.key === "ArrowUp" && isOpen) {
            event.preventDefault()
            event.stopPropagation()
            if (this._highlightIndex > 0) {
                this.setHighlight(this._highlightIndex - 1)
            } else {
                this.popover.hidePopover()
            }
            return
        }

        if (event.key === " " && isOpen && this._highlightIndex >= 0) {
            event.preventDefault()
            this.toggleHighlightedOption()
            return
        }

        if (!isOpen) {
            const allowNavigation = this.shouldAllowNavigation(event)
            if (!allowNavigation) {
                event.stopPropagation()
            }
        } else {
            // popover open: still prevent character keys from reaching table
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
        this.syncCheckboxes()
        this.input.focus()
    }

    handleTriggerClick() {
        if (this.popover.matches(":popover-open")) {
            this.popover.hidePopover()
        } else {
            this.popover.showPopover()
        }
    }

    handlePopoverToggle(event) {
        if (event.newState === "open") {
            if (!this._optionsRequested) {
                this._optionsRequested = true
                this.dispatchEvent(new CustomEvent("filter-options-request", {
                    bubbles: true,
                    composed: true
                }))
            }
            this.syncCheckboxes()
            this.setHighlight(-1)
        } else {
            this.setHighlight(-1)
        }
    }

    handlePopoverClick(event) {
        const option = event.target.closest(".option")
        if (!option) return

        const checkbox = option.querySelector("input[type='checkbox']")
        if (event.target !== checkbox) {
            checkbox.checked = !checkbox.checked
        }

        this.input.value = this.buildValueFromCheckboxes()
        this.dispatchFilterEvent(this.input.value)
        this.input.focus()
    }
}

customElements.define("filter-combo", FilterCombo)
