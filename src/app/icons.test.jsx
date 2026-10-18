import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TOOL_CATALOG } from '../catalog.js';
import { TOOL_ICONS, ToolIcon } from './icons.jsx';
import { setupBrowserTestEnv } from './test-utils.js';

setupBrowserTestEnv();

describe('tool icons', () => {
  it('maps every catalog icon to a Lucide component, with no unused entries', () => {
    const used = TOOL_CATALOG.map((t) => t.icon);
    for (const name of used) expect(TOOL_ICONS[name], `no icon for "${name}"`).toBeDefined();
    expect(Object.keys(TOOL_ICONS).sort()).toEqual([...new Set(used)].sort());
  });

  it('gives every tool a distinct icon', () => {
    const icons = TOOL_CATALOG.map((t) => t.icon);
    expect(new Set(icons).size).toBe(icons.length);
  });

  it('renders a decorative SVG hidden from screen readers', () => {
    const { container } = render(<ToolIcon name="scissors" size={30} />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveClass('lucide');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveAttribute('width', '30');
  });
});
