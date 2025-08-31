export class FilterInput extends HTMLElement {
    static styles = `
        :host {
            box-sizing: border-box;
            display: grid;
            grid-template-columns: 1fr auto;
        }

        input {
            border: 1px solid;
            outline: none;
            border-radius: .25em;
            border-top-right-radius: 0;
            border-bottom-right-radius: 0;
            background: transparent;
            font: inherit;
            color: inherit;
            min-width: 0;
        }

        input:disabled {
            opacity: 0.6;
            cursor: not-allowed;
        }

        button {
            display: grid;
            place-items: center;
            border: 1px solid;
            border-radius: .25em;
            border-top-left-radius: 0;
            border-bottom-left-radius: 0;
            border-left: none;
            background: transparent;
            cursor: pointer;
            font: inherit;
            font-size: .875em;
            color: inherit;
            opacity: 0.7;
        }

        button:hover {
            opacity: 1;
        }

        button:disabled {
            opacity: 0.3;
            cursor: not-allowed;
        }
    `

    static get observedAttributes() {
        return ["placeholder", "disabled"]
    }

    constructor() {
        super()
        this.attachShadow({ mode: "open" })
        this.handleInput = this.handleInput.bind(this)
        this.handleClear = this.handleClear.bind(this)
        this.handleKeydown = this.handleKeydown.bind(this)
    }

    connectedCallback() {
        this.render()
        this.addEventListeners()
    }

    disconnectedCallback() {
        this.removeEventListeners()
    }

    render() {
        this.shadowRoot.innerHTML = `
            <style>${FilterInput.styles}</style>
            <input type="text">
            <button type="button" tabindex="-1">🞨</button>
        `

        this.updateAttributes()
    }

    addEventListeners() {
        const input = this.shadowRoot.querySelector("input")
        const button = this.shadowRoot.querySelector("button")

        input.addEventListener("input", this.handleInput)
        input.addEventListener("keydown", this.handleKeydown)
        button.addEventListener("click", this.handleClear)
    }

    removeEventListeners() {
        const input = this.shadowRoot.querySelector("input")
        const button = this.shadowRoot.querySelector("button")

        if (input) {
            input.removeEventListener("input", this.handleInput)
            input.removeEventListener("keydown", this.handleKeydown)
        }
        if (button) {
            button.removeEventListener("click", this.handleClear)
        }
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue === newValue) return
        this.updateAttributes()
    }

    updateAttributes() {
        const input = this.shadowRoot.querySelector("input")
        const button = this.shadowRoot.querySelector("button")

        if (!input || !button) return

        // Handle placeholder
        const placeholder = this.getAttribute("placeholder")
        if (placeholder !== null) {
            input.placeholder = placeholder
        } else {
            input.removeAttribute("placeholder")
        }

        // Handle disabled
        const disabled = this.hasAttribute("disabled")
        input.disabled = disabled
        button.disabled = disabled
    }

    handleInput(event) {
        // Emit custom event from the filter-input element itself
        this.dispatchEvent(new CustomEvent("filter-input", {
            detail: { value: event.target.value },
            bubbles: true
        }))
    }

    handleKeydown(event) {
        if (event.key === "Escape") {
            event.preventDefault()
            this.clear()
        }
    }

    handleClear() {
        this.clear()
        input.focus()
    }

    clear() {
        const input = this.shadowRoot.querySelector("input")
        if (input.value !== "") {
            input.value = ""
            // Emit the same custom event when clearing
            this.dispatchEvent(new CustomEvent("filter-input", {
                detail: { value: "" },
                bubbles: true
            }))
        }
    }

    // Public API
    get value() {
        const input = this.shadowRoot.querySelector("input")
        return input ? input.value : ""
    }

    set value(val) {
        const input = this.shadowRoot.querySelector("input")
        if (input) {
            input.value = val
        }
    }

    get placeholder() {
        return this.getAttribute("placeholder") ?? ""
    }

    set placeholder(val) {
        if (val) {
            this.setAttribute("placeholder", val)
        } else {
            this.removeAttribute("placeholder")
        }
    }

    get disabled() {
        return this.hasAttribute("disabled")
    }

    set disabled(val) {
        if (val) {
            this.setAttribute("disabled", "")
        } else {
            this.removeAttribute("disabled")
        }
    }

    focus() {
        const input = this.shadowRoot.querySelector("input")
        if (input) {
            input.focus()
        }
    }

    blur() {
        const input = this.shadowRoot.querySelector("input")
        if (input) {
            input.blur()
        }
    }
}

customElements.define("filter-input", FilterInput)
