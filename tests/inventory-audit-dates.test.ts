import test from 'node:test';
import assert from 'node:assert/strict';
import { caliDate, auditFridays } from '../lib/inventory/audits.ts';
test('Friday alerts follow midnight in Cali, independent of server timezone', () => {
 assert.equal(caliDate(new Date('2026-10-02T04:59:59Z')), '2026-10-01');
 assert.equal(caliDate(new Date('2026-10-02T05:00:00Z')), '2026-10-02');
 assert.deepEqual(auditFridays('2026-10-02','2026-10-01'), []);
 assert.deepEqual(auditFridays('2026-10-02','2026-10-16'), ['2026-10-02','2026-10-09','2026-10-16']);
});
