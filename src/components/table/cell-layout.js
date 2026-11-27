// Cell layout modes: "no-wrap" (columns as wide as their widest value) and
// "truncate" (columns as wide as their header, longer values cut off with an ellipsis)

// Values of these dtypes keep their full width: a cut-off number or date reads as a different value
export const UNTRUNCATED_DTYPES = ["int", "float", "date", "datetime"]

export function isTruncatable(dtype) {
    return !UNTRUNCATED_DTYPES.includes(dtype)
}

// Data cells whose values are cut off in truncate mode
export const TRUNCATABLE_CELLS =
    `td:not(${UNTRUNCATED_DTYPES.map(dtype => `[data-dtype="${dtype}"]`).join(", ")})`
