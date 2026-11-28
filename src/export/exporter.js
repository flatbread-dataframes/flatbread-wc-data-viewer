function buildRows(view) {
    // view.values builds every row on each access: read it once
    const values = view.values
    return view.index.values.map((idx, rowIdx) => {
        const row = {}

        if (Array.isArray(idx)) {
            view.index.names?.forEach((name, level) => {
                row[name ?? `index_${level}`] = idx[level]
            })
        } else {
            row[view.index.names?.[0] ?? "index"] = idx
        }

        view.columns.values.forEach((col, colIdx) => {
            const key = Array.isArray(col) ? col.join(" > ") : col
            row[key] = values[rowIdx][colIdx]
        })

        return row
    })
}

function toJSON(view) {
    return JSON.stringify(buildRows(view), null, 2)
}

function toCSV(view) {
    const rows = buildRows(view)
    if (rows.length === 0) return ""

    const headers = Object.keys(rows[0])
    const lines = [
        headers.map(escapeCSV).join(","),
        ...rows.map(row =>
            headers.map(h => escapeCSV(row[h])).join(",")
        )
    ]
    return lines.join("\n")
}

function escapeCSV(value) {
    if (value === null || value === undefined) return ""
    const str = String(value)
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`
    }
    return str
}

function download(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
}

export { toJSON, toCSV, download }
