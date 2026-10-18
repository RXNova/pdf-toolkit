import { describe, expect, it } from 'vitest';
import { ACCEPT, CATEGORIES, defaultFormValues, getToolDef, isOptionVisible, TOOL_CATALOG } from './catalog.js';

describe('TOOL_CATALOG integrity', () => {
  it('has unique tool ids', () => {
    const ids = TOOL_CATALOG.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(TOOL_CATALOG.map((t) => [t.id, t]))('%s is well-formed', (_id, tool) => {
    expect(ACCEPT[tool.accept]).toBeDefined();
    expect(CATEGORIES[tool.category]).toBeDefined();
    expect(tool.minFiles).toBeGreaterThanOrEqual(1);
    if (!tool.multi) expect(tool.minFiles).toBe(1);
    expect(tool.suffix).toMatch(/^[a-z]+$/);
    // multi-file tools show file cards; single-file tools show their pages
    if (tool.multi) expect(tool.preview).toBe('files');
    else expect(['pages', 'viewer']).toContain(tool.preview);

    const keys = tool.options.map((o) => o.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const o of tool.options) {
      if (o.type === 'select') expect(o.choices.map(([v]) => v)).toContain(o.default);
      if (o.type === 'number') expect(o.default).toBeGreaterThanOrEqual(o.min ?? -Infinity);
      for (const [dep, value] of Object.entries(o.showIf ?? {})) {
        const target = tool.options.find((x) => x.key === dep);
        expect(target, `${o.key} depends on unknown option ${dep}`).toBeDefined();
        expect(target.choices.map(([v]) => v)).toContain(value);
      }
    }
  });
});

it('puts at least one tool in every category', () => {
  for (const category of Object.keys(CATEGORIES)) expect(TOOL_CATALOG.some((t) => t.category === category)).toBe(true);
});

describe('getToolDef', () => {
  it('finds a tool by id and returns undefined for unknown ids', () => {
    expect(getToolDef('merge').title).toBe('Merge PDF');
    expect(getToolDef('nope')).toBeUndefined();
  });
});

describe('isOptionVisible', () => {
  const option = { key: 'ranges', showIf: { mode: 'ranges' } };
  it('is visible without showIf', () => expect(isOptionVisible({ key: 'x' }, {})).toBe(true));
  it('follows the controlling value', () => {
    expect(isOptionVisible(option, { mode: 'ranges' })).toBe(true);
    expect(isOptionVisible(option, { mode: 'every' })).toBe(false);
  });
});

describe('defaultFormValues', () => {
  it('stringifies defaults and uses "" when there is none', () => {
    expect(defaultFormValues(getToolDef('watermark'))).toEqual({
      text: 'CONFIDENTIAL', font: 'sans-bold', size: '60', color: '#d9480f', opacity: '0.2', angle: '45',
      layout: 'single', position: 'center', density: 'normal', layer: 'over', ranges: '',
    });
    expect(defaultFormValues(getToolDef('extract'))).toEqual({ ranges: '' });
  });
});
