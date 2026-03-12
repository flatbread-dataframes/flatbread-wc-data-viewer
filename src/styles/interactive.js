const interactiveSheet = new CSSStyleSheet()
interactiveSheet.replaceSync(`
    button {
        padding: 0.25em 0.5em;
        border: 1px solid var(--dv-border);
        border-radius: 0.25em;
        background: transparent;
        font: inherit;
        color: inherit;
        cursor: pointer;
        user-select: none;
    }

    button:hover {
        background-color: var(--dv-hover);
    }

    button:disabled {
        opacity: 0.3;
        cursor: default;
    }

    input {
        border: 1px solid var(--dv-border);
        border-radius: 0.25em;
        background: transparent;
        font: inherit;
        color: inherit;
        min-width: 0;
    }

    input:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }
`)

export { interactiveSheet }
