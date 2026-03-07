import { baseSheet } from "../styles/base.js"
import { interactiveSheet } from "../styles/interactive.js"

const componentSheet = new CSSStyleSheet()
componentSheet.replaceSync(`
    :host {
        display: grid;
        grid-template-columns: 1fr auto;
    }
    input {
        border-top-right-radius: 0;
        border-bottom-right-radius: 0;
    }
    button {
        display: grid;
        place-items: center;
        border-top-left-radius: 0;
        border-bottom-left-radius: 0;
        border-left: none;
        font-size: 0.875em;
        opacity: 0.7;
    }
    button:hover:not(:disabled) {
        opacity: 1;
    }
`)

export class FilterInput extends HTMLElement {
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

    // MARK: setup
    connectedCallback() {
        this.render()
        this.addEventListeners()
    }

    disconnectedCallback() {
        this.removeEventListeners()
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

        const placeholder = this.getAttribute("placeholder")
        if (placeholder !== null) {
            input.placeholder = placeholder
        } else {
            input.removeAttribute("placeholder")
        }

        const disabled = this.hasAttribute("disabled")
        input.disabled = disabled
        button.disabled = disabled
    }

    // MARK: get/set
    get input() {
        return this.shadowRoot.querySelector("input")
    }

    // MARK: render
    render() {
        this.shadowRoot.adoptedStyleSheets = [baseSheet, interactiveSheet, componentSheet]
        this.shadowRoot.innerHTML = `
            <input type="text">
            <button type="button" tabindex="-1">🞨</button>
        `

        this.updateAttributes()
    }

    // MARK: handlers
    handleInput(event) {
        const filterInputEvent = new CustomEvent("filter-input", {
            detail: { value: event.target.value },
            bubbles: true
        })
        this.dispatchEvent(filterInputEvent)
    }

    handleKeydown(event) {
        if (event.key === "Escape") {
            event.preventDefault()
            event.stopPropagation()
            this.clear()
            return
        }

        const allowNavigation = this.shouldAllowNavigation(event)
        if (!allowNavigation) {
            event.stopPropagation()
        }
    }

    shouldAllowNavigation(event) {
        const input = this.shadowRoot.querySelector("input")
        const cursorPos = input.selectionStart
        const isEmpty = input.value === ""

        switch (event.key) {
            case "ArrowUp":
            case "ArrowDown":
                return true // always allow vertical navigation
            case "ArrowLeft":
            case "Home":
                return isEmpty || cursorPos === 0
            case "ArrowRight":
            case "End":
                return isEmpty || cursorPos === input.value.length
            default:
                return false
        }
    }

    handleClear() {
        this.clear()
        this.input.focus()
    }

    clear() {
        const input = this.shadowRoot.querySelector("input")
        if (input.value !== "") {
            input.value = ""
            const filterInputEvent = new CustomEvent("filter-input", {
                detail: { value: "" },
                bubbles: true
            })
            this.dispatchEvent(filterInputEvent)
        }
    }

    // MARK: api
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
