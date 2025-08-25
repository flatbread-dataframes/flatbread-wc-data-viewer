export class Formatter {
    constructor(options) {
        this.options = options
    }

    formatValue(value, dtype, formatOptions) {
        if (value === null || value === "") return this.options.naRep
        if (!dtype) return value

        switch (dtype) {
            case 'int':
            case 'float':
                return this.formatNumber(value, formatOptions)
            case 'datetime':
                return this.formatDate(value, formatOptions)
            default:
                return value.toString()
        }
    }

    formatNumber(value, options) {
        return value.toLocaleString(this.options.locale, options)
    }

    formatDate(value, options) {
        return new Date(value).toLocaleString(this.options.locale, options)
    }
}
