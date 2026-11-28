import { Axis } from "./axis.js"

export class Index extends Axis {
    constructor({ values = [], names, dtypes, formatOptions, nlevels, sourceIlocs } = {}) {
        super(values, { names, nlevels: nlevels ?? names?.length, sourceIlocs })
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

    // Constructor options for the rows at ilocs (see Axis.take): dtypes and formatOptions are per level
    subset(ilocs) {
        return {
            values: ilocs.map(iloc => this.values[iloc]),
            names: this.names,
            dtypes: this.dtypes,
            formatOptions: this.formatOptions,
            nlevels: this.nlevels,
        }
    }

    getAttrs() {
        return this.ilevels.map(level => ({
            level,
            dtype: this.dtypes?.[level],
            formatOptions: this.formatOptions?.[level],
        }))
    }
}
