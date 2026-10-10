import React, { useState } from 'react';
import IssueCard from './IssueCard.jsx';
import { Plus, Search, Filter } from 'lucide-react';

const COLUMNS = [
  { id: 'BACKLOG', label: 'Backlog', colorClass: 'backlog' },
  { id: 'TODO', label: 'To Do', colorClass: 'todo' },
  { id: 'IN_PROGRESS', label: 'In Progress', colorClass: 'in_progress' },
  { id: 'REVIEW', label: 'Code Review', colorClass: 'review' },
  { id: 'DONE', label: 'Done', colorClass: 'done' }
];

export default function KanbanBoard({
  issues = [],
  connections = [],
  onSelectIssue,
  onDeleteIssue,
  onUpdateStatus,
  onOpenCreateModalWithStatus,
  onOpenQuickConnect
}) {
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('ALL');
  const [filterPriority, setFilterPriority] = useState('ALL');
  const [dragOverCol, setDragOverCol] = useState(null);

  // Filter issues
  const filteredIssues = issues.filter(issue => {
    const matchesSearch = 
      issue.title?.toLowerCase().includes(search.toLowerCase()) ||
      issue.key?.toLowerCase().includes(search.toLowerCase()) ||
      issue.assignee?.toLowerCase().includes(search.toLowerCase());

    const matchesType = filterType === 'ALL' || issue.type === filterType;
    const matchesPriority = filterPriority === 'ALL' || issue.priority === filterPriority;

    return matchesSearch && matchesType && matchesPriority;
  });

  const handleDragStart = (e, issueId) => {
    e.dataTransfer.setData('text/plain', issueId);
  };

  const handleDragOver = (e, columnId) => {
    e.preventDefault();
    setDragOverCol(columnId);
  };

  const handleDragLeave = (e, columnId) => {
    if (dragOverCol === columnId) {
      setDragOverCol(null);
    }
  };

  const handleDrop = (e, columnId) => {
    e.preventDefault();
    setDragOverCol(null);
    const issueId = e.dataTransfer.getData('text/plain');
    if (issueId) {
      onUpdateStatus(issueId, columnId);
    }
  };

  const totalPoints = filteredIssues.reduce((sum, item) => sum + (Number(item.storyPoints) || 0), 0);

  return (
    <div className="board-wrapper" id="kanban-board-wrapper">
      {/* Sub-bar with search & filters */}
      <div className="sub-bar" id="board-filter-bar">
        <div className="search-box">
          <Search size={15} className="search-icon" />
          <input
            type="text"
            placeholder="Search issues, keys, assignees..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            id="input-search"
          />
        </div>

        <div className="filter-group">
          <select
            className="filter-select"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            id="filter-type"
          >
            <option value="ALL">All Types</option>
            <option value="Story">Stories</option>
            <option value="Task">Tasks</option>
            <option value="Bug">Bugs</option>
            <option value="Epic">Epics</option>
          </select>

          <select
            className="filter-select"
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            id="filter-priority"
          >
            <option value="ALL">All Priorities</option>
            <option value="HIGHEST">Highest</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
            <option value="LOWEST">Lowest</option>
          </select>

          <div className="stats-chip">
            <strong>{filteredIssues.length}</strong> issues &bull; <strong>{totalPoints}</strong> pts
          </div>
        </div>
      </div>

      {/* Kanban Columns */}
      <div className="kanban-grid" id="kanban-columns-container">
        {COLUMNS.map(column => {
          const colIssues = filteredIssues.filter(i => (i.status || 'TODO') === column.id);
          const colPoints = colIssues.reduce((acc, curr) => acc + (Number(curr.storyPoints) || 0), 0);

          return (
            <div
              key={column.id}
              className={`kanban-column ${dragOverCol === column.id ? 'drag-over' : ''}`}
              id={`col-${column.id}`}
              onDragOver={(e) => handleDragOver(e, column.id)}
              onDragLeave={(e) => handleDragLeave(e, column.id)}
              onDrop={(e) => handleDrop(e, column.id)}
            >
              <div className="column-header">
                <div className="col-title-group">
                  <span className={`col-badge ${column.colorClass}`} />
                  <span className="col-title">{column.label}</span>
                  <span className="col-count">{colIssues.length}</span>
                </div>

                <button
                  className="col-add-btn"
                  onClick={() => onOpenCreateModalWithStatus(column.id)}
                  title={`Add new issue to ${column.label}`}
                  id={`btn-add-col-${column.id}`}
                >
                  <Plus size={16} />
                </button>
              </div>

              <div className="cards-list" id={`cards-list-${column.id}`}>
                {colIssues.map(issue => (
                  <IssueCard
                    key={issue.id}
                    issue={issue}
                    connections={connections}
                    onSelectIssue={onSelectIssue}
                    onDeleteIssue={onDeleteIssue}
                    onOpenQuickConnect={onOpenQuickConnect}
                    onDragStart={handleDragStart}
                  />
                ))}

                {colIssues.length === 0 && (
                  <div style={{
                    padding: '24px 12px',
                    textAlign: 'center',
                    color: '#94a3b8',
                    fontSize: '0.8rem',
                    border: '1px dashed #cbd5e1',
                    borderRadius: '8px',
                    margin: '8px 0'
                  }}>
                    Drop issues here
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
