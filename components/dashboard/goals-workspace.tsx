"use client";

import { Plus, Target } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { currency, goalOverview } from "@/lib/finance";
import type { Goal } from "@/lib/types";

export function GoalsWorkspace({ goals, onAdd, onEdit, onDelete }: {
  goals: Goal[];
  onAdd: () => void;
  onEdit: (goal: Goal) => void;
  onDelete: (goal: Goal) => void;
}) {
  const overview = goalOverview(goals);
  return <section className="workspace" id="goals">
    <header className="page-head">
      <div><h1>Goals</h1><p>Track amounts saved toward your goals. Goal amounts do not change account balances.</p></div>
      <div className="page-actions"><button className="button primary small" onClick={onAdd}><Plus size={16} aria-hidden /> Add goal</button></div>
    </header>
    <div className="metric-grid">
      <div className="metric"><span>Goals</span><strong>{goals.length}</strong></div>
      <div className="metric"><span>Total target</span><strong>{currency.format(overview.target)}</strong></div>
      <div className="metric"><span>Total saved</span><strong>{currency.format(overview.current)}</strong></div>
      <div className="metric featured"><span>Overall progress</span><strong>{overview.target ? `${Math.round(overview.current / overview.target * 100)}%` : "—"}</strong></div>
      <div className="metric"><span>Completed</span><strong>{overview.completed}</strong></div>
    </div>
    {goals.length ? <div className="goals-workspace-list">
      {goals.map((goal) => {
        const complete = goal.current >= goal.target;
        const status = complete ? "Completed" : goal.paused ? "Paused" : "In progress";
        return <article className="goal-workspace-card" key={goal.id} aria-labelledby={`goal-${goal.id}`}>
          <div className="finance-panel-head"><h2 id={`goal-${goal.id}`}>{goal.name}</h2><span className={`badge ${complete ? "success" : goal.paused ? "warning" : ""}`}>{status}</span></div>
          {goal.description && <p className="finance-muted">{goal.description}</p>}
          {goal.category && <p className="finance-muted">{goal.category}</p>}
          <p className="goal-amounts">{currency.format(goal.current)} <span>/ {currency.format(goal.target)}</span></p>
          <div className={`progress${complete ? " complete" : goal.paused ? " paused" : ""}`} role="progressbar" aria-label={`${goal.name} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, Math.round(goal.current / goal.target * 100))}><span style={{ width: `${Math.min(100, goal.current / goal.target * 100)}%` }} /></div>
          <p className="finance-muted">{Math.round(goal.current / goal.target * 100)}% · {currency.format(Math.max(0, goal.target - goal.current))} remaining</p>
          {(goal.targetDate || goal.monthlyTarget !== undefined) && <p className="goal-meta">{goal.targetDate && <span>Target date: {goal.targetDate}</span>}{goal.monthlyTarget !== undefined && <span>Monthly target: {currency.format(goal.monthlyTarget)}</span>}</p>}
          <div className="record-actions"><button onClick={() => onEdit(goal)} aria-label={`Details / edit, ${goal.name}`}>Details / edit</button><button className="danger-link" onClick={() => onDelete(goal)} aria-label={`Delete ${goal.name}`}>Delete</button></div>
        </article>;
      })}
    </div> : <EmptyState icon={Target} title="No goals yet" action={<button className="button primary small" onClick={onAdd}><Plus size={16} aria-hidden /> Add goal</button>}>Add a goal to track your progress.</EmptyState>}
  </section>;
}
