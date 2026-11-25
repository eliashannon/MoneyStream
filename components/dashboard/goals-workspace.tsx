"use client";

import { Plus, Target } from "lucide-react";
import { currency, goalOverview } from "@/lib/finance";
import type { Goal } from "@/lib/types";

export function GoalsWorkspace({ goals, onAdd, onEdit, onDelete }: {
  goals: Goal[];
  onAdd: () => void;
  onEdit: (goal: Goal) => void;
  onDelete: (goal: Goal) => void;
}) {
  const overview = goalOverview(goals);
  return <section className="finance-panel full-section" id="goals">
    <div className="finance-panel-head"><h2><Target size={20} /> Goals</h2><button className="button primary small" onClick={onAdd}><Plus size={16} /> Add goal</button></div>
    <p className="finance-muted">Track amounts saved toward your goals. Goal amounts do not change account balances.</p>
    <div className="transaction-summary account-summary goals-summary">
      <div><span>Goals</span><strong>{goals.length}</strong></div>
      <div><span>Total target</span><strong>{currency.format(overview.target)}</strong></div>
      <div><span>Total saved</span><strong>{currency.format(overview.current)}</strong></div>
      <div><span>Overall progress</span><strong>{overview.target ? `${Math.round(overview.current / overview.target * 100)}%` : "—"}</strong></div>
      <div><span>Completed</span><strong>{overview.completed}</strong></div>
    </div>
    <div className="goals-workspace-list">
      {goals.length ? goals.map((goal) => <div className="goal-workspace-card" key={goal.id}>
        <div className="finance-panel-head"><h3>{goal.name}</h3><span>{goal.current >= goal.target ? "Completed" : goal.paused ? "Paused" : "In progress"}</span></div>
        {goal.description && <p className="finance-muted">{goal.description}</p>}
        {goal.category && <p className="finance-muted">{goal.category}</p>}
        <p>{currency.format(goal.current)} / {currency.format(goal.target)}</p>
        <div className="progress"><span style={{ width: `${Math.min(100, goal.current / goal.target * 100)}%` }} /></div>
        <p className="finance-muted">{Math.round(goal.current / goal.target * 100)}% · {currency.format(Math.max(0, goal.target - goal.current))} remaining</p>
        {(goal.targetDate || goal.monthlyTarget !== undefined) && <p className="finance-muted">{goal.targetDate && <>Target date: {goal.targetDate}</>}{goal.targetDate && goal.monthlyTarget !== undefined && " · "}{goal.monthlyTarget !== undefined && <>Monthly target: {currency.format(goal.monthlyTarget)}</>}</p>}
        <div className="record-actions"><button onClick={() => onEdit(goal)}>Details / edit</button><button onClick={() => onDelete(goal)}>Delete</button></div>
      </div>) : <p className="finance-muted">Add a goal to track your progress.</p>}
    </div>
  </section>;
}
