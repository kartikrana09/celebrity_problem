export function validateMatrix(matrix, n) {
  if (!Array.isArray(matrix) || matrix.length !== n) {
    return 'The matrix must have one row for each person.';
  }
  if (matrix.some((row) => !Array.isArray(row) || row.length !== n)) {
    return 'Every row must contain exactly one value for each person.';
  }
  if (matrix.some((row) => row.some((value) => value !== 0 && value !== 1))) {
    return 'Matrix cells can only contain 0 or 1.';
  }
  return '';
}

export function findCelebrities(matrix, n = matrix.length) {
  if (validateMatrix(matrix, n)) return [];
  return Array.from({ length: n }, (_, candidate) => candidate).filter((candidate) =>
    Array.from({ length: n }, (_, person) => person)
      .filter((person) => person !== candidate)
      .every((person) => matrix[candidate][person] === 0 && matrix[person][candidate] === 1),
  );
}

export function verifyCandidate(matrix, n, candidate) {
  if (!Number.isInteger(candidate) || candidate < 0 || candidate >= n) {
    return { celebrity: false, reason: 'There is no remaining candidate to verify.' };
  }
  for (let person = 0; person < n; person += 1) {
    if (person === candidate) continue;
    if (matrix[candidate][person] === 1) {
      return { celebrity: false, failedCell: [candidate, person], reason: `P${candidate} knows P${person}.` };
    }
    if (matrix[person][candidate] === 0) {
      return { celebrity: false, failedCell: [person, candidate], reason: `P${person} does not know P${candidate}.` };
    }
  }
  return { celebrity: true, reason: `P${candidate} knows nobody, and everyone else knows P${candidate}.` };
}

const cloneState = (state) => ({
  ...state,
  stack: [...state.stack],
  popped: [...state.popped],
  eliminated: [...state.eliminated],
  operations: [...state.operations],
  verificationChecks: [...state.verificationChecks],
  currentOperation: state.currentOperation ? { ...state.currentOperation } : null,
});

export function generateSimulationSteps(matrix, n = matrix.length) {
  const validationError = validateMatrix(matrix, n);
  if (validationError) throw new Error(validationError);

  const snapshots = [{
    step: 0,
    phase: 'ready',
    stack: [],
    popped: [],
    eliminated: [],
    operations: [],
    verificationChecks: [],
    currentOperation: null,
    comparisons: 0,
    verificationIterations: 0,
    inspections: 0,
    finalResult: null,
    description: 'Ready to build the candidate stack.',
  }];
  let state = cloneState(snapshots[0]);
  const record = (operation, update = {}) => {
    state = {
      ...state,
      ...update,
      step: snapshots.length,
      operations: [...state.operations, operation],
      currentOperation: operation,
      description: operation.description,
    };
    snapshots.push(cloneState(state));
  };

  state.phase = 'build';
  for (let person = 0; person < n; person += 1) {
    record({
      type: 'push',
      person,
      description: `PUSH → P${person}. Add P${person} to the candidate stack.`,
    }, { stack: [...state.stack, person], popped: [] });
  }

  state.phase = 'eliminate';
  while (state.stack.length > 1) {
    const a = state.stack[state.stack.length - 1];
    const stackAfterA = state.stack.slice(0, -1);
    record({ type: 'pop', person: a, description: `POP → P${a}. Store this as candidate a.` }, { stack: stackAfterA, popped: [...state.popped, a] });

    const b = state.stack[state.stack.length - 1];
    const stackAfterB = state.stack.slice(0, -1);
    record({ type: 'pop', person: b, description: `POP → P${b}. Store this as candidate b.` }, { stack: stackAfterB, popped: [...state.popped, b] });

    const value = matrix[a][b];
    const survivor = value === 1 ? b : a;
    const eliminated = value === 1 ? a : b;
    const explanation = value === 1
      ? `M[${a}][${b}] = 1: P${a} knows P${b}, so P${a} cannot be the celebrity. Keep P${b}.`
      : `M[${a}][${b}] = 0: P${a} does not know P${b}, so P${b} cannot be the celebrity. Keep P${a}.`;
    record({
      type: 'compare',
      a,
      b,
      value,
      survivor,
      eliminated,
      cell: [a, b],
      description: `INSPECT → M[${a}][${b}] = ${value}. ${explanation}`,
    }, { comparisons: state.comparisons + 1, inspections: state.inspections + 1 });
    record({
      type: 'eliminate',
      person: eliminated,
      description: `ELIMINATE → P${eliminated}. This person cannot be the celebrity.`,
    }, { eliminated: [...state.eliminated, eliminated] });
    record({
      type: 'push',
      person: survivor,
      description: `PUSH → P${survivor}. Keep the possible candidate for the next comparison.`,
    }, { stack: [...state.stack, survivor], popped: [] });
  }

  const candidate = state.stack.length === 1 ? state.stack[0] : null;
  state.phase = 'verify';
  record({
    type: 'phase',
    candidate,
    description: candidate === null ? 'No candidate remains to verify.' : `PHASE 2 — VERIFY P${candidate}. A survivor is only a possibility until checked.`,
  });

  let result = candidate === null
    ? { celebrity: false, candidate: null, reason: 'No candidate was available for verification.' }
    : null;
  if (candidate !== null) {
    for (let person = 0; person < n; person += 1) {
      if (person === candidate) continue;
      const knowsSomeone = matrix[candidate][person];
      const rowCheck = {
        type: 'verify-row',
        candidate,
        person,
        value: knowsSomeone,
        cell: [candidate, person],
      };
      if (knowsSomeone === 1) {
        const reason = `P${candidate} knows P${person} (M[${candidate}][${person}] = 1), so the candidate fails.`;
        record({ ...rowCheck, description: `VERIFY → M[${candidate}][${person}] = 1. ${reason}` }, {
          verificationIterations: state.verificationIterations + 1,
          inspections: state.inspections + 1,
          verificationChecks: [...state.verificationChecks, { ...rowCheck, passed: false }],
        });
        result = { celebrity: false, candidate, failedCell: [candidate, person], reason };
        break;
      }
      record({ ...rowCheck, description: `VERIFY → M[${candidate}][${person}] = 0. P${candidate} does not know P${person}; check the reverse direction.` }, {
        verificationIterations: state.verificationIterations + 1,
        inspections: state.inspections + 1,
        verificationChecks: [...state.verificationChecks, { ...rowCheck, passed: true }],
      });

      const knownBy = matrix[person][candidate];
      const columnCheck = {
        type: 'verify-column',
        candidate,
        person,
        value: knownBy,
        cell: [person, candidate],
      };
      const columnPassed = knownBy === 1;
      record({
        ...columnCheck,
        description: columnPassed
          ? `VERIFY → M[${person}][${candidate}] = 1. P${person} knows P${candidate}; this check passes.`
          : `VERIFY → M[${person}][${candidate}] = 0. P${person} does not know P${candidate}; the candidate fails.`,
      }, {
        inspections: state.inspections + 1,
        verificationChecks: [...state.verificationChecks, { ...columnCheck, passed: columnPassed }],
      });
      if (!columnPassed) {
        result = {
          celebrity: false,
          candidate,
          failedCell: [person, candidate],
          reason: `P${person} does not know P${candidate} (M[${person}][${candidate}] = 0), so the candidate fails.`,
        };
        break;
      }
    }
  }

  if (!result) {
    result = candidate === null
      ? { celebrity: false, candidate: null, reason: 'No celebrity exists.' }
      : { celebrity: true, candidate, reason: `P${candidate} knows nobody, and everyone else knows P${candidate}.` };
  }
  record({
    type: 'result',
    result,
    description: result.celebrity
      ? `CELEBRITY FOUND: P${result.candidate}. ${result.reason}`
      : `NO CELEBRITY EXISTS. ${result.reason}`,
  }, { phase: 'complete', finalResult: result });
  return snapshots;
}
