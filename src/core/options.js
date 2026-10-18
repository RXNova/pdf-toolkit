import { isOptionVisible } from '../catalog.js';
import { UserError } from './errors.js';

/**
 * Validate raw form values against a tool's option schema and coerce them to typed values.
 * Missing values fall back to the schema default. Hidden options are parsed but never required.
 *
 * @param {import('../catalog.js').OptionDef[]} schema
 * @param {Record<string, unknown>} [raw]
 * @returns {Record<string, string | number>}
 * @throws {UserError}
 */
export function parseOptions(schema, raw = {}) {
  const values = Object.fromEntries(
    schema.map((o) => [o.key, raw[o.key] === undefined || raw[o.key] === null ? o.default ?? '' : raw[o.key]]),
  );
  return Object.fromEntries(
    schema.map((o) => [o.key, PARSERS[o.type](o, values[o.key], isOptionVisible(o, values))]),
  );
}

const requireIfVisible = (option, value, visible) => {
  if (option.required && visible && value === '') throw new UserError(`${option.label} is required.`);
  return value;
};

const PARSERS = {
  text: (o, v, visible) => requireIfVisible(o, String(v).trim(), visible),
  ranges: (o, v, visible) => requireIfVisible(o, String(v).trim(), visible),
  password: (o, v, visible) => requireIfVisible(o, String(v), visible),

  number(o, v) {
    const text = String(v).trim();
    if (text === '') return Number(o.default ?? 0);
    const n = Number(text);
    if (!Number.isFinite(n)) throw new UserError(`${o.label} must be a number.`);
    if ((o.min !== undefined && n < o.min) || (o.max !== undefined && n > o.max)) {
      throw new UserError(`${o.label} must be between ${o.min} and ${o.max}.`);
    }
    return n;
  },

  select(o, v) {
    const value = String(v);
    if (!o.choices.some(([choice]) => choice === value)) {
      throw new UserError(`"${value}" is not a valid choice for ${o.label}.`);
    }
    return value;
  },

  /** An image as a data: URL (PNG or JPEG), e.g. a drawn signature or an uploaded logo. */
  image(o, v, visible) {
    const value = requireIfVisible(o, String(v), visible);
    if (value && !/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+=*$/.test(value)) {
      throw new UserError(`${o.label} must be a PNG or JPEG image.`);
    }
    return value;
  },

  /** JSON built by the UI: an object, or an array with `array: true` (e.g. form values, placed items). */
  json(o, v) {
    let value;
    try {
      value = typeof v === 'string' ? JSON.parse(v || (o.array ? '[]' : '{}')) : v;
    } catch {
      throw new UserError(`${o.label} isn’t valid.`);
    }
    if (!value || typeof value !== 'object' || Array.isArray(value) !== Boolean(o.array)) throw new UserError(`${o.label} isn’t valid.`);
    return value;
  },

  color(o, v) {
    const value = String(v);
    if (!/^#[0-9a-f]{6}$/i.test(value)) throw new UserError(`${o.label} must be a hex color like #ff0000.`);
    return value;
  },
};
