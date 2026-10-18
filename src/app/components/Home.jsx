import { Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { CATEGORIES } from '../../catalog.js';
import { ToolCard, ToolRow } from './ToolCard.jsx';
import ScrollArea from './ScrollArea.jsx';

const FILTER_LABELS = { all: 'All', organize: 'Organize', edit: 'Edit', optimize: 'Optimize', security: 'Security' };

/** Case-insensitive match on title and description. */
export const matchesQuery = (tool, query) => `${tool.title} ${tool.desc}`.toLowerCase().includes(query.trim().toLowerCase());

export default function Home({ tools, onOpen, view }) {
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');

  const counts = useMemo(() => {
    const c = { all: tools.length };
    for (const id of Object.keys(CATEGORIES)) c[id] = tools.filter((t) => t.category === id).length;
    return c;
  }, [tools]);

  const visible = tools.filter((t) => (filter === 'all' || t.category === filter) && matchesQuery(t, query));

  return (
    <div className="launcher column">
      <div className="toolbar">
        <div className="filters" role="group" aria-label="Filter tools">
          {Object.keys(FILTER_LABELS).map((id) => (
            <button key={id} type="button" className={`tab${filter === id ? ' active' : ''}`} aria-pressed={filter === id} onClick={() => setFilter(id)}>
              {FILTER_LABELS[id]} <span className="count">{counts[id]}</span>
            </button>
          ))}
        </div>
        <div className="search">
          <Search size={16} aria-hidden="true" />
          <input type="search" aria-label="Search tools" placeholder="Search tools" value={query}
            onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Escape' && setQuery('')} />
          {query && (
            <button type="button" className="clear" aria-label="Clear search" onClick={() => setQuery('')}><X size={14} aria-hidden="true" /></button>
          )}
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="empty" role="status">No tools match “{query.trim()}”.</p>
      ) : view === 'list' ? (
        <ScrollArea as="ul" className="table" aria-label="Tools">
          {visible.map((t) => <ToolRow key={t.id} tool={t} onOpen={onOpen} />)}
        </ScrollArea>
      ) : (
        <ScrollArea className="grid" aria-label="Tools">
          {visible.map((t) => <ToolCard key={t.id} tool={t} onOpen={onOpen} />)}
        </ScrollArea>
      )}
    </div>
  );
}
