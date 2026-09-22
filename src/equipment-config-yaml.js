// @ts-check
// AeroBeat 0.0.63, child C1 of bead 376l (plan
// 2026-09-21-0.0.63-playtest-feedback-0.0.62-retest-successor.md, L-C design).
//
// Minimal STRICT YAML subset parser + canonical serializer for the
// equipment-config schema. The assembly repo declares NO yaml dependency
// (package.json / package-lock checked), so instead of adding one this module
// covers EXACTLY the schema shape:
//
//   - nested maps, arbitrary depth (the schema is 2 levels under each mode)
//   - scalar values: null, booleans (true/false), integers, decimals
//     (incl. negatives like -35), and strings — quoted ("..." / '...') or
//     bare tokens like `linear`
//   - NO arrays, NO anchors/aliases, NO multi-line blocks, NO flow style
//   - blank lines and `#` comments (full-line or trailing) allowed
//
// Anything else is rejected with a descriptive Error (strict, fail closed).

/**
 * Strip a trailing `#` comment from a non-quoted region of a YAML line.
 * A `#` starts a comment only at line start or when preceded by whitespace;
 * it is never stripped inside quoted spans (quotes are balanced by the
 * caller before this runs).
 *
 * @param {string} line - Raw line without surrounding indentation.
 * @returns {string} - Line with the trailing comment removed and trimmed.
 */
function stripComment(line) {
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === "'" && !inDouble) inSingle = !inSingle;
    else if (ch === '"' && !inSingle) inDouble = !inDouble;
    else if (ch === "#" && !inSingle && !inDouble) {
      if (i === 0 || line[i - 1] === " " || line[i - 1] === "\t") {
        return line.slice(0, i).trimEnd();
      }
    }
  }
  if (inSingle || inDouble) throw new Error("unterminated quoted string in YAML line");
  return line.trimEnd();
}

/**
 * Parse one scalar YAML token into a JS value.
 *
 * @param {string} raw - Raw (trimmed, comment-free) scalar text.
 * @returns {number | string | null | boolean} - The decoded value.
 */
function parseScalar(raw) {
  const text = raw.trim();
  if (text === "") throw new Error("empty scalar value in YAML");
  if (text.startsWith("[") || text.startsWith("{")) {
    throw new Error(`YAML flow (array/map) syntax "${text}" is not in the supported subset`);
  }
  if (text.length >= 2 && text.startsWith('"') && text.endsWith('"')) {
    const inner = text.slice(1, -1);
    if (inner.includes('"')) throw new Error("nested quote inside double-quoted YAML string");
    return inner;
  }
  if (text.length >= 2 && text.startsWith("'") && text.endsWith("'")) {
    const inner = text.slice(1, -1);
    if (inner.includes("'")) throw new Error("nested quote inside single-quoted YAML string");
    return inner;
  }
  if (text === "null" || text === "~") return null;
  if (text === "true") return true;
  if (text === "false") return false;
  if (/^-?(?:0|[1-9]\d*)$/u.test(text)) return Number(text);
  if (/^-?(?:0|[1-9]\d*)\.\d+$/u.test(text)) return Number(text);
  if (/^-?\d+\.?\d*(?:[eE][+-]?\d+)?$/u.test(text)) {
    const value = Number(text);
    if (Number.isNaN(value)) throw new Error(`unparseable number token "${text}" in YAML`);
    return value;
  }
  // Bare string token (e.g. an ease type such as `linear`). No whitespace or
  // YAML punctuation is allowed in a bare token for this subset.
  if (/^[A-Za-z0-9_.-]+$/u.test(text)) return text;
  throw new Error(`unsupported YAML scalar "${text}" (subset allows null/~/true/false, numbers, quoted or bare string tokens)`);
}

/**
 * Parse YAML text (the strict equipment-config subset) into a plain JS
 * object tree.
 *
 * @param {string} text - Full YAML document text.
 * @returns {{ [key: string]: unknown }} - Parsed nested-map object.
 * @throws {Error} When the input is not in the supported subset.
 */
export function parseYamlSubset(text) {
  /** @type {Array<{ indent: number, key: string, rest: string }>} */
  const entries = [];
  const lines = String(text).split(/\r\n|\n|\r/u);
  for (let i = 0; i < lines.length; i += 1) {
    const rawLine = lines[i];
    if (rawLine.includes("\t")) throw new Error(`YAML line ${i + 1} uses tab indentation (unsupported subset)`);
    const withoutComment = stripComment(rawLine);
    if (withoutComment === "") continue;
    if (rawLine.trimStart() === "---") continue; // document marker: allowed, ignored
    if (rawLine.trimStart().startsWith("- ") || rawLine.trimStart() === "-") {
      throw new Error(`YAML line ${i + 1} is an array entry (arrays are not in the supported subset)`);
    }
    const indent = rawLine.length - rawLine.trimStart().length;
    const content = withoutComment;
    const keyMatch = /^([^:]+):(.*)$/u.exec(content);
    if (!keyMatch) throw new Error(`YAML line ${i + 1} is not a "key: value" mapping entry`);
    const key = keyMatch[1].trim();
    if (!/^[A-Za-z0-9_.-]+$/u.test(key)) throw new Error(`YAML line ${i + 1} has an unsupported key "${key}"`);
    entries.push({ indent, key, rest: keyMatch[2] });
  }
  if (entries.length === 0) throw new Error("YAML document is empty");

  let position = 0;

  /**
   * Recursively build the object subtree starting at `entries[position]`
   * for the given indentation level.
   *
   * @param {number} indent - Expected indentation of the entries in this map.
   * @returns {{ [key: string]: unknown }} - Parsed map.
   */
  function parseLevel(indent) {
    /** @type {{ [key: string]: unknown }} */
    const result = {};
    while (position < entries.length) {
      const entry = entries[position];
      if (entry.indent > indent) throw new Error(`YAML indentation is inconsistent near key "${entry.key}"`);
      if (entry.indent < indent) break;
      position += 1;
      if (entry.key in result) throw new Error(`duplicate YAML key "${entry.key}"`);
      const rest = entry.rest.trim();
      if (rest !== "") {
        result[entry.key] = parseScalar(rest);
      } else {
        // Bare "key:" — must be followed by a deeper-indented nested map.
        if (position >= entries.length || entries[position].indent <= indent) {
          throw new Error(`YAML key "${entry.key}" has no value and no nested block`);
        }
        result[entry.key] = parseLevel(entries[position].indent);
      }
    }
    return result;
  }

  const top = parseLevel(entries[0].indent);
  if (position !== entries.length) throw new Error("YAML trailing entries at a shallower indentation are ambiguous");
  return top;
}

/**
 * Serialize a scalar value to its canonical YAML representation.
 *
 * @param {unknown} value - The value to serialize.
 * @returns {string} - The scalar text.
 */
function serializeScalar(value) {
  if (value === null) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("equipment-config YAML cannot serialize a non-finite number");
    return String(value);
  }
  if (typeof value === "string") {
    if (/^[A-Za-z0-9_.-]+$/u.test(value) && !/^(?:true|false|null|~)$/iu.test(value)
      && !/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(value)) {
      return value; // safe bare token (e.g. an ease type)
    }
    return JSON.stringify(value);
  }
  throw new Error(`equipment-config YAML cannot serialize value of type ${typeof value}`);
}

/**
 * Serialize a plain object tree to canonical YAML text (stable key order —
 * keys are emitted exactly in the object's own insertion order, so callers
 * build objects in the schema order for reproducible output).
 *
 * @param {{ [key: string]: unknown }} value - Nested-map object tree.
 * @returns {string} - Canonical YAML text ending with a newline.
 */
export function serializeYamlSubset(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("equipment-config YAML serializer expects a nested map (no arrays allowed)");
  }

  /**
   * @param {{ [key: string]: unknown }} map
   * @param {number} depth
   * @param {string[]} out
   */
  function walk(map, depth, out) {
    const pad = "  ".repeat(depth);
    for (const key of Object.keys(map)) {
      const child = map[key];
      if (child === null || typeof child !== "object" || Array.isArray(child)) {
        out.push(`${pad}${key}: ${serializeScalar(child)}`);
      } else {
        out.push(`${pad}${key}:`);
        walk(child, depth + 1, out);
      }
    }
  }

  /** @type {string[]} */
  const lines = [];
  walk(value, 0, lines);
  return `${lines.join("\n")}\n`;
}
