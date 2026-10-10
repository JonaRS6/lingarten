import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import {allocate, isValidReference, referenceFromSequence, referencesIn} from './payments';

test('references carry a valid Luhn check digit', () => {
  const reference = referenceFromSequence(123456);
  assert.equal(reference, '1234566');
  assert.ok(isValidReference(reference));
  assert.ok(!isValidReference('1234567'));
  assert.ok(!isValidReference('0234566'));
});

test('sequences outside the range are rejected', () => {
  assert.throws(() => referenceFromSequence(99999));
  assert.throws(() => referenceFromSequence(1000000));
});

test('references are found inside bank descriptions', () => {
  assert.deepEqual(referencesIn('SPEI RECIBIDO REF 1234566 PAGO BASURA'), ['1234566']);
  assert.deepEqual(referencesIn('REF:1234566/1234566'), ['1234566']);
  // Part of a longer number, or a bad check digit.
  assert.deepEqual(referencesIn('CLABE 012180012345661234 REF 1234567'), []);
});

test('payments settle whole notes oldest first and keep the rest as credit', () => {
  const tickets = [
    {id: 'b', cost: 250, generated: 2},
    {id: 'a', cost: 250, generated: 1},
    {id: 'c', cost: 250, generated: 3}
  ];
  const result = allocate(600, tickets);
  assert.deepEqual(result.paidTickets.map((t) => t.id), ['a', 'b']);
  assert.equal(result.credit, 100);
});

test('a note that is too expensive blocks later notes', () => {
  const result = allocate(100, [
    {id: 'old', cost: 300, generated: 1},
    {id: 'new', cost: 50, generated: 2}
  ]);
  assert.deepEqual(result.paidTickets, []);
  assert.equal(result.credit, 100);
});

test('cents do not drift', () => {
  const result = allocate(0.3, [{id: 'a', cost: 0.1, generated: 1}, {id: 'b', cost: 0.2, generated: 2}]);
  assert.equal(result.paidTickets.length, 2);
  assert.equal(result.credit, 0);
});
