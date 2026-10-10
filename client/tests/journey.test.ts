import assert from 'node:assert/strict';
import { test } from 'node:test';
import { amountPaise, doorTone, taskProgress } from '../src/lib/journey';
import type { ScanOutcome, TaskDetails } from '../src/generated/contracts';

// Value: protects=Exact money input and rejection of ambiguous or unsafe amounts; fails_when=Rupees round or invalid text reaches payments; why_new=New client money parser has no coverage; seam=none
test('money entry converts decimal rupees exactly and rejects ambiguous or unsafe values', () => {
  for (const [input, expected] of [['0.01', 1], [' 12.3 ', 1230], ['001.09', 109], ['100', 10000]] as const) assert.equal(amountPaise(input), expected);
  for (const input of ['', ' ', '0', '0.00', '-1', '+1', '1e2', '1,000', '.5', '1.', '1.001', 'Infinity', '9007199254740991']) assert.throws(() => amountPaise(input), Error, input);
});

// Value: protects=Door rejection colors and honest task completion totals; fails_when=A denial appears verified or completed overdue work counts late; why_new=New presentation helpers have no coverage; seam=none
test('door feedback distinguishes admission from every denial and progress excludes completed overdue tasks', () => {
  const outcomes: [ScanOutcome, string][] = [['admitted', 'verified'], ['member_no_ticket', 'pending'], ['already_checked_in', 'overdue'], ['payment_pending', 'overdue'], ['not_valid', 'overdue'], ['no_ticket_membership_expired', 'overdue']];
  for (const [outcome, expected] of outcomes) assert.equal(doorTone({ outcome, admitted: outcome === 'admitted', message: outcome }), expected);
  assert.deepEqual(taskProgress([]), { total: 0, done: 0, overdue: 0, onTrack: 0 });
  const task = (status: TaskDetails['status'], overdue: boolean): TaskDetails => ({ id: status, title: 'Task', description: null, assignee: null, assigneeId: null, status, eventId: null, eventTitle: null, dueAt: null, overdue, createdAt: '2026-10-10T08:00:00Z' });
  assert.deepEqual(taskProgress([task('done', true), task('in_progress', true), task('todo', false)]), { total: 3, done: 1, overdue: 1, onTrack: 2 });
});
