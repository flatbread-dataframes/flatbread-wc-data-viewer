const baseSheet = new CSSStyleSheet()
baseSheet.replaceSync(`
    *, *::before, *::after {
        box-sizing: border-box;
    }

    :host(:focus-visible),
    :focus-visible {
        outline: 2px solid var(--focus-color, Highlight);
        outline-offset: 2px;
    }

    :host(:focus:not(:focus-visible)),
    :focus:not(:focus-visible) {
        outline: none;
    }
`)

export { baseSheet }
