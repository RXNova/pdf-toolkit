import { describe, expect, it } from 'vitest';
import { getToolDef, TOOL_CATALOG } from '../catalog.js';
import { ioLabel, splitTitle, toolNumber, toolStyle, toolTag } from './tool-meta.js';

describe('tool-meta', () => {
  it('numbers tools by catalog position', () => {
    expect(toolNumber(TOOL_CATALOG[0])).toBe('01');
    expect(toolNumber(TOOL_CATALOG[11])).toBe('12');
  });

  it('splits titles so the last word can be accented', () => {
    expect(splitTitle('Merge PDF')).toEqual(['Merge', 'PDF']);
    expect(splitTitle('JPG / PNG to PDF')).toEqual(['JPG / PNG to', 'PDF']);
    expect(splitTitle('Single')).toEqual(['', 'Single']);
  });

  it('describes inputs and outputs', () => {
    expect(ioLabel(getToolDef('merge'))).toBe('PDF ×N → PDF');
    expect(ioLabel(getToolDef('split'))).toBe('PDF → ZIP');
    expect(ioLabel(getToolDef('images'))).toBe('JPG/PNG ×N → PDF');
    expect(ioLabel(getToolDef('rotate'))).toBe('PDF → PDF');
  });

  it('tags single- and multi-file tools', () => {
    expect(toolTag(getToolDef('merge'))).toBe('Multi-file · Local');
    expect(toolTag(getToolDef('rotate'))).toBe('Single file · Local');
  });

  it('gives every tool a distinct tile colour plus light/dark inks', () => {
    const colors = TOOL_CATALOG.map((t) => t.color);
    const hex = /^#[0-9a-f]{6}$/;
    expect(colors.every((c) => hex.test(c))).toBe(true);
    expect(new Set(colors).size).toBe(colors.length);
    for (const t of TOOL_CATALOG) expect(t.ink.every((c) => hex.test(c))).toBe(true);
  });

  it('exposes a tool\'s colours as CSS variables', () => {
    expect(toolStyle(getToolDef('merge'))).toEqual({ '--tile': '#2f7bf5', '--ink-light': '#1a5bc4', '--ink-dark': '#7fb0ff' });
  });
});
