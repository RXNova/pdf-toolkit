import { describe, expect, it } from 'vitest';
import { addRest, assign, formatGroups, groupColor, GROUP_COLORS, readGroups, removeGroup, resize, subtract } from './split-groups.js';

describe('readGroups', () => {
  it('reads each part as a range, earlier parts keeping overlapped pages', () => {
    expect(readGroups('1-3, 4-6, 7-', 8)).toEqual([[1, 3], [4, 6], [7, 8]]);
    expect(readGroups('3-1, 5', 6)).toEqual([[1, 3], [5, 5]]);
    expect(readGroups('1-4, 3-6', 6)).toEqual([[1, 4], [5, 6]]);
    expect(readGroups('2-5, 3', 6)).toEqual([[2, 5]]);
  });

  it('is empty for an empty spec and null for one that does not fit', () => {
    expect(readGroups('', 4)).toEqual([]);
    expect(readGroups('9', 4)).toBeNull();
  });
});

describe('subtract', () => {
  it.each([
    [[1, 5], [7, 9], [[1, 5]]],
    [[1, 5], [1, 5], []],
    [[1, 5], [4, 9], [[1, 3]]],
    [[1, 5], [0, 2], [[3, 5]]],
    [[1, 9], [4, 5], [[1, 3], [6, 9]]],
  ])('%j minus %j → %j', (range, cut, out) => expect(subtract(range, cut)).toEqual(out));
});

describe('assign', () => {
  it('adds a group, trimming or splitting the groups it overlaps, in page order', () => {
    expect(assign([], [5, 3])).toEqual([[3, 5]]);
    expect(assign([[1, 3], [6, 8]], [3, 6])).toEqual([[1, 2], [3, 6], [7, 8]]);
    expect(assign([[1, 9]], [4, 5])).toEqual([[1, 3], [4, 5], [6, 9]]);
  });
});

describe('resize', () => {
  const groups = [[1, 3], [4, 6], [7, 8]];
  it('moves an edge, taking pages from the neighbour', () => {
    expect(resize(groups, 1, 'end', 7)).toEqual([[1, 3], [4, 7], [8, 8]]);
    expect(resize(groups, 1, 'start', 2)).toEqual([[1, 1], [2, 6], [7, 8]]);
    expect(resize(groups, 1, 'end', 5)).toEqual([[1, 3], [4, 5], [7, 8]]);
  });

  it('never lets an edge cross the other one', () => {
    expect(resize(groups, 1, 'start', 8)).toEqual([[1, 3], [6, 6], [7, 8]]);
    expect(resize(groups, 1, 'end', 1)).toEqual([[1, 3], [4, 4], [7, 8]]);
  });
});

it('removeGroup, addRest and formatGroups', () => {
  expect(removeGroup([[1, 2], [3, 4]], 0)).toEqual([[3, 4]]);
  expect(addRest([[3, 4], [7, 7]], 9)).toEqual([[1, 2], [3, 4], [5, 6], [7, 7], [8, 9]]);
  expect(addRest([], 3)).toEqual([[1, 3]]);
  expect(formatGroups([[1, 3], [4, 4], [5, 8]])).toBe('1-3, 4, 5-8');
});

it('cycles group colours', () => {
  expect(groupColor(0)).toBe(GROUP_COLORS[0]);
  expect(groupColor(GROUP_COLORS.length + 1)).toBe(GROUP_COLORS[1]);
});
