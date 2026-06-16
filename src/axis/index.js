import { Axis } from "./axis.js"

export class Index extends Axis {
    constructor({ values = [], names, dtypes, formatOptions } = {}) {
        super(values)
        this.names = names
        this.dtypes = dtypes
        this.formatOptions = formatOptions
        this.attrs = this.getAttrs()
    }

    get dtypes() { return this._dtypes }
    set dtypes(value) {
        this._dtypes = value
        this.attrs = this.getAttrs()
    }

    get formatOptions() { return this._formatOptions }
    set formatOptions(value) {
        this._formatOptions = value
        this.attrs = this.getAttrs()
    }

    getAttrs() {
        return this.ilevels.map(level => ({
            level,
            dtype: this.dtypes?.[level],
            formatOptions: this.formatOptions?.[level],
        }))
    }
}
