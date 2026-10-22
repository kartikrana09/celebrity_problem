import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  findCelebrities,
  generateSimulationSteps,
  validateMatrix,
} from './celebrity.js';

const initialPeople = 5;

function createCelebrityMatrix(n, candidate = n - 1) {
  return Array.from({ length: n }, (_, row) =>
    Array.from({ length: n }, (_, column) =>
      row === column ? 0 : (column === candidate ? 1 : 0),
    ),
  );
}

function createRandomMatrix(n) {
  return Array.from({ length: n }, (_, row) =>
    Array.from({ length: n }, (_, column) => row === column ? 0 : Math.round(Math.random())),
  );
}

function resizeMatrix(matrix, nextSize) {
  return Array.from({ length: nextSize }, (_, row) =>
    Array.from({ length: nextSize }, (_, column) =>
      row === column ? 0 : (matrix[row]?.[column] ?? 0),
    ),
  );
}

const personLabel = (person) => `P${person}`;

function App() {
  const [n, setN] = useState(initialPeople);
  const [matrix, setMatrix] = useState(() => createCelebrityMatrix(initialPeople, 2));
  const [candidate, setCandidate] = useState(0);
  const [selectedCell, setSelectedCell] = useState([0, 1]);
  const [editingEnabled, setEditingEnabled] = useState(false);
  const [simulation, setSimulation] = useState([]);
  const [stepIndex, setStepIndex] = useState(0);
  const [hasRun, setHasRun] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState('normal');
  const [matrixError, setMatrixError] = useState('');
  const [guess, setGuess] = useState('');
  const [challengeSubmitted, setChallengeSubmitted] = useState(false);
  const [challengeRevealed, setChallengeRevealed] = useState(false);
  const [challengeHint, setChallengeHint] = useState('');
  const cellRefs = useRef({});
  const current = simulation[stepIndex] ?? null;
  const currentOperation = current?.currentOperation ?? null;
  const matrixAnswer = useMemo(() => findCelebrities(matrix, n), [matrix, n]);
  const validationError = validateMatrix(matrix, n);
  const correctGuess = guess === 'none' ? matrixAnswer.length === 0 : matrixAnswer.includes(Number(guess));
  const shouldRevealMatrixAnswer = challengeRevealed || (challengeSubmitted && correctGuess);
  const activeCell = currentOperation?.cell ?? null;
  const highlightedCandidate = (current?.phase === 'verify' || current?.phase === 'complete') && current?.stack?.length === 1
    ? current.stack[0]
    : candidate;
  const canStepBack = hasRun && stepIndex > 0;
  const canStepForward = hasRun && stepIndex < simulation.length - 1;
  const delay = speed === 'slow' ? 1300 : speed === 'fast' ? 400 : 800;

  useEffect(() => {
    if (!playing) return undefined;
    if (stepIndex >= simulation.length - 1) {
      setPlaying(false);
      return undefined;
    }
    const timer = window.setTimeout(() => setStepIndex((index) => Math.min(index + 1, simulation.length - 1)), delay);
    return () => window.clearTimeout(timer);
  }, [playing, stepIndex, simulation.length, delay]);

  function resetDerivedState() {
    setSimulation([]);
    setStepIndex(0);
    setHasRun(false);
    setPlaying(false);
    setMatrixError('');
    setGuess('');
    setChallengeSubmitted(false);
    setChallengeRevealed(false);
    setChallengeHint('');
  }

  function updateMatrix(nextMatrix) {
    setMatrix(nextMatrix);
    resetDerivedState();
  }

  function changePeople(event) {
    const nextSize = Number(event.target.value);
    setN(nextSize);
    setCandidate((value) => Math.min(value, nextSize - 1));
    setSelectedCell(([row, column]) => [Math.min(row, nextSize - 1), Math.min(column, nextSize - 1)]);
    updateMatrix(resizeMatrix(matrix, nextSize));
  }

  function changeCell(row, column, rawValue) {
    if (!/^[01]$/.test(rawValue)) {
      setMatrixError('Enter 0 or 1 only. The matrix has not been changed.');
      return;
    }
    const nextMatrix = matrix.map((values, rowIndex) =>
      values.map((value, columnIndex) => rowIndex === row && columnIndex === column ? Number(rawValue) : value),
    );
    setSelectedCell([row, column]);
    updateMatrix(nextMatrix);
  }

  function startSimulation() {
    const error = validateMatrix(matrix, n);
    if (error) {
      setMatrixError(error);
      return;
    }
    try {
      const steps = generateSimulationSteps(matrix, n);
      setSimulation(steps);
      setStepIndex(Math.min(1, steps.length - 1));
      setHasRun(true);
      setPlaying(false);
      setMatrixError('');
    } catch (error) {
      setMatrixError(`Unable to start the simulation: ${error.message}`);
    }
  }

  function restartSimulation() {
    setPlaying(false);
    if (!hasRun) {
      startSimulation();
      return;
    }
    setStepIndex(0);
  }

  function previousStep() {
    setPlaying(false);
    setStepIndex((index) => Math.max(0, index - 1));
  }

  function nextStep() {
    if (!hasRun) {
      startSimulation();
      return;
    }
    setPlaying(false);
    setStepIndex((index) => Math.min(index + 1, simulation.length - 1));
  }

  function showFinalResult() {
    if (!hasRun) {
      const steps = generateSimulationSteps(matrix, n);
      setSimulation(steps);
      setHasRun(true);
      setStepIndex(steps.length - 1);
      return;
    }
    setPlaying(false);
    setStepIndex(simulation.length - 1);
  }

  function focusCell(row, column) {
    setSelectedCell([row, column]);
    cellRefs.current[`${row}-${column}`]?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    cellRefs.current[`${row}-${column}`]?.focus({ preventScroll: true });
  }

  function viewStackTrace(row, column) {
    const foundIndex = simulation.findIndex((snapshot) => {
      const operation = snapshot.currentOperation;
      return operation?.cell?.[0] === row && operation?.cell?.[1] === column;
    });
    if (foundIndex >= 0) {
      setStepIndex(foundIndex);
      document.getElementById('stack-simulation')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function submitGuess(event) {
    event.preventDefault();
    if (guess === '') return;
    setChallengeSubmitted(true);
    setChallengeHint('');
    if (!correctGuess) {
      if (guess === 'none') {
        setChallengeHint('There may be a person who satisfies both conditions. Inspect a candidate row and column.');
      } else {
        const guessed = Number(guess);
        const knows = matrix[guessed].some((value, index) => index !== guessed && value === 1);
        const knownByAll = matrix.every((row, index) => index === guessed || row[guessed] === 1);
        if (knows) setChallengeHint('Check whether your candidate knows anyone. Their row must contain only 0s outside the diagonal.');
        else if (!knownByAll) setChallengeHint('Inspect the candidate’s column. Does every other person know them?');
        else setChallengeHint('Remember, both conditions must hold. A celebrity knows nobody and is known by everyone.');
      }
    }
  }

  const inspectedRow = matrix[candidate] ?? [];
  const knowsCount = inspectedRow.reduce((count, value, index) => count + (index !== candidate && value === 1 ? 1 : 0), 0);
  const knownByCount = matrix.reduce((count, row, index) => count + (index !== candidate && row[candidate] === 1 ? 1 : 0), 0);
  const rowPass = knowsCount === 0;
  const columnPass = knownByCount === n - 1;
  const matchingTraceExists = hasRun && simulation.some((snapshot) => {
    const cell = snapshot.currentOperation?.cell;
    return cell?.[0] === selectedCell[0] && cell?.[1] === selectedCell[1];
  });

  let candidateSummary = `${personLabel(candidate)} does not satisfy either condition completely.`;
  if (rowPass && columnPass) candidateSummary = `${personLabel(candidate)} satisfies the celebrity conditions.`;
  else if (rowPass) candidateSummary = `${personLabel(candidate)} knows nobody, but not everyone knows ${personLabel(candidate)}.`;
  else if (columnPass) candidateSummary = `Everyone knows ${personLabel(candidate)}, but ${personLabel(candidate)} knows someone.`;

  const finalResult = current?.finalResult;

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#overview" aria-label="Celebrity Problem home"><span className="brand-mark">C</span><span>DSA<span className="brand-muted"> / VISUAL LAB</span></span></a>
        <nav aria-label="Main navigation">
          <a href="#overview">Overview</a>
          <a href="#matrix-simulation">Matrix Simulation</a>
          <a href="#stack-simulation">Stack Simulation</a>
          <a href="#algorithm">Algorithm</a>
        </nav>
        <span className="topbar-status"><i /> INTERACTIVE LESSON</span>
      </header>

      <main>
        <section className="hero section-wrap" id="overview">
          <div className="hero-copy">
            <span className="eyebrow"><span className="eyebrow-dot" /> DATA STRUCTURES &amp; ALGORITHMS</span>
            <h1>THE CELEBRITY<br /><span>PROBLEM</span></h1>
            <p>Explore the matrix. Trace the stack. Discover the celebrity.</p>
            <a className="button button-primary hero-button" href="#workspace">Start exploring <span aria-hidden="true">↘</span></a>
          </div>
          <div className="hero-visual" aria-label="Matrix and stack illustration">
            <div className="orbit orbit-one" /><div className="orbit orbit-two" />
            <div className="hero-matrix">
              {[0, 1, 2, 3].map((row) => <div className="hero-matrix-row" key={row}>{[0, 1, 2, 3].map((column) => <span className={(row === 2 || column === 2) && row !== column ? 'mini-cell mini-active' : 'mini-cell'} key={column}>{row === column ? '·' : row === 2 ? '0' : column === 2 ? '1' : (row + column) % 2}</span>)}</div>)}
            </div>
            <div className="hero-person"><span>★</span><small>KNOWN BY ALL</small><b>P2</b></div>
            <span className="hero-caption">MATRIX → CANDIDATE → PROOF</span>
          </div>
          <div className="hero-meta"><span>01 / TWO SIMULATIONS</span><span>O(N) CANDIDATE ELIMINATION</span><span>LEARN BY DOING</span></div>
        </section>

        <section className="section-wrap intro-grid">
          <div>
            <span className="section-kicker">THE IDEA</span>
            <h2>One person.<br />Two conditions.</h2>
          </div>
          <div className="intro-definition">
            <p className="definition">In a group of <em>N</em> people, a celebrity is known by everyone else—but knows no one else.</p>
            <p>Imagine a party where everyone recognizes one famous person, but that person recognizes nobody. Find them using only the relationships recorded in the matrix.</p>
            <div className="condition-row">
              <article className="condition-card"><span className="condition-number">01</span><div><b>Knows nobody</b><code>M[C][i] = 0</code><small>Every other entry in C’s row is 0.</small></div></article>
              <article className="condition-card"><span className="condition-number condition-number-teal">02</span><div><b>Known by everyone</b><code>M[i][C] = 1</code><small>Every other entry in C’s column is 1.</small></div></article>
            </div>
            <p className="muted-note">Both conditions must hold. Diagonal entries (a person’s relationship with themselves) are ignored.</p>
          </div>
        </section>

        <section className="workspace section-wrap" id="workspace">
          <div className="section-heading">
            <div><span className="section-kicker">YOUR INPUT</span><h2>Set the scene.</h2></div>
            <p>One shared matrix powers both simulations.<br />Edit it anytime to start fresh.</p>
          </div>
          <div className="config-card">
            <div className="config-top">
              <div><span className="micro-label">GROUP SIZE</span><div className="people-control"><button type="button" onClick={() => n > 2 && changePeople({ target: { value: n - 1 } })} aria-label="Remove one person" disabled={n <= 2}>−</button><strong>{String(n).padStart(2, '0')}</strong><span>people</span><button type="button" onClick={() => n < 10 && changePeople({ target: { value: n + 1 } })} aria-label="Add one person" disabled={n >= 10}>+</button></div></div>
              <label className="people-range"><span className="micro-label">N = {n}</span><input type="range" min="2" max="10" value={n} onChange={changePeople} aria-label="Number of people" /></label>
              <div className="preset-actions"><span className="micro-label">QUICK START</span><div className="button-row"><button className="button button-outline" type="button" onClick={() => updateMatrix(createRandomMatrix(n))}>↻ Random matrix</button><button className="button button-outline" type="button" onClick={() => updateMatrix(createCelebrityMatrix(n))}>★ Valid celebrity</button><button className="button button-outline" type="button" onClick={() => updateMatrix(Array.from({ length: n }, () => Array(n).fill(0)))}>∅ No celebrity</button><button className="button button-quiet" type="button" onClick={() => updateMatrix(Array.from({ length: n }, (_, row) => Array.from({ length: n }, (_, column) => row === column ? 0 : 0)))}>Reset</button></div></div>
            </div>
            <div className="config-bottom"><span><i className="status-dot" /> MATRIX READY <b>·</b> {n} × {n}</span><span>Diagonal values are ignored by the algorithm.</span><a href="#matrix-simulation">Edit matrix below ↓</a></div>
            {matrixError && <div className="error-banner" role="alert">{matrixError}</div>}
          </div>
        </section>

        <section className="challenge section-wrap" id="your-turn">
          <div className="challenge-mark">?</div>
          <div className="challenge-copy"><span className="section-kicker">BEFORE THE ALGORITHM</span><h2>Your turn.</h2><p>Study the matrix, make a prediction, and see if you can beat the stack.</p></div>
          <form className="challenge-form" onSubmit={submitGuess}>
            <label htmlFor="guess-select">Who do you think is the celebrity?</label>
            <div className="guess-controls"><select id="guess-select" value={guess} onChange={(event) => setGuess(event.target.value)}><option value="">Choose a person…</option>{Array.from({ length: n }, (_, person) => <option value={person} key={person}>{personLabel(person)}</option>)}<option value="none">No celebrity</option></select><button type="submit" className="button button-primary" disabled={guess === ''}>Check my answer</button></div>
            {challengeSubmitted && <div className={`challenge-feedback ${correctGuess ? 'feedback-correct' : 'feedback-wrong'}`} role="status">{correctGuess ? 'That’s right — your prediction matches the matrix.' : 'Not quite. Try again or reveal the explanation.'}{challengeHint && <small>{challengeHint}</small>}</div>}
            {challengeSubmitted && !correctGuess && <button className="text-button" type="button" onClick={() => setChallengeRevealed(true)}>Reveal the explanation →</button>}
            {challengeRevealed && <p className="challenge-reveal">The matrix result is {matrixAnswer.length ? matrixAnswer.map(personLabel).join(', ') : 'no celebrity'}. A celebrity must pass both checks.</p>}
            <button type="button" className="run-link" onClick={startSimulation}>Now run the stack simulation <span>→</span></button>
          </form>
        </section>

        <section className="section-wrap simulation-section" id="matrix-simulation">
          <div className="section-heading">
            <div><span className="section-kicker">SIMULATION 01 / DIRECT INSPECTION</span><h2>Read the matrix.</h2></div>
            <p>Investigate any person independently.<br />The highlighted cell follows the active stack step.</p>
          </div>
          <div className="matrix-layout">
            <article className="panel matrix-panel">
              <div className="panel-header"><div><span className="panel-index">01</span><div><h3>Relationship matrix</h3><p>Row = knows · Column = known by</p></div></div><div className="matrix-header-actions"><button type="button" className={`edit-toggle ${editingEnabled ? 'edit-toggle-on' : ''}`} onClick={() => setEditingEnabled((value) => !value)}>{editingEnabled ? '✓ Editing on' : 'Edit matrix'}</button><span className="live-tag"><i /> LIVE INPUT</span></div></div>
              <div className="matrix-scroll">
                <div className="matrix-table" role="grid" aria-label={`${n} by ${n} relationship matrix`} style={{ '--matrix-size': n }}>
                  <div className="matrix-label corner-label">KNOWS ↓<br />KNOWN →</div>
                  {Array.from({ length: n }, (_, column) => <div className={`matrix-label column-label ${highlightedCandidate === column ? 'selected-label' : ''} ${activeCell?.[1] === column ? 'active-label' : ''}`} role="columnheader" key={`head-${column}`}>{personLabel(column)}</div>)}
                  {matrix.map((row, rowIndex) => <div className="matrix-row" role="row" key={`row-${rowIndex}`}>
                    <div className={`matrix-label row-label ${highlightedCandidate === rowIndex ? 'selected-label' : ''} ${activeCell?.[0] === rowIndex ? 'active-label' : ''}`} role="rowheader">{personLabel(rowIndex)}</div>
                    {row.map((value, columnIndex) => {
                      const diagonal = rowIndex === columnIndex;
                      const selected = selectedCell[0] === rowIndex && selectedCell[1] === columnIndex;
                      const active = activeCell?.[0] === rowIndex && activeCell?.[1] === columnIndex;
                      return <button
                        type="button"
                        role="gridcell"
                        aria-label={`M[${rowIndex}][${columnIndex}] equals ${value}${diagonal ? ', diagonal ignored' : ''}`}
                        aria-pressed={selected}
                        ref={(element) => { cellRefs.current[`${rowIndex}-${columnIndex}`] = element; }}
                        className={`matrix-cell value-${value} ${diagonal ? 'diagonal-cell' : ''} ${rowIndex === highlightedCandidate ? 'candidate-row-cell' : ''} ${columnIndex === highlightedCandidate ? 'candidate-column-cell' : ''} ${activeCell?.[0] === rowIndex ? 'operation-row-cell' : ''} ${activeCell?.[1] === columnIndex ? 'operation-column-cell' : ''} ${selected ? 'selected-cell' : ''} ${active ? 'active-cell' : ''} ${editingEnabled ? 'editable-cell' : ''}`}
                        key={`${rowIndex}-${columnIndex}`}
                        onClick={() => {
                          setSelectedCell([rowIndex, columnIndex]);
                          setCandidate(rowIndex);
                          if (editingEnabled && !diagonal) changeCell(rowIndex, columnIndex, value === 1 ? '0' : '1');
                        }}
                        onDoubleClick={() => !editingEnabled && !diagonal && changeCell(rowIndex, columnIndex, value === 1 ? '0' : '1')}
                        title={diagonal ? 'Diagonal entries are ignored' : 'Click to inspect · double-click to toggle'}
                      >{diagonal ? '—' : value}</button>;
                    })}
                  </div>)}
                </div>
              </div>
              <div className="matrix-legend"><span><i className="legend-one">1</i> Knows</span><span><i className="legend-zero">0</i> Does not know</span><span><i className="legend-diagonal">—</i> Diagonal ignored</span><small>{editingEnabled ? 'Click an off-diagonal cell to toggle 0 / 1.' : 'Enable editing, or double-click any off-diagonal cell.'}</small></div>
              <div className="current-comparison">
                <span className="micro-label">STACK COMPARISON</span>
                {activeCell ? <><b>M[{activeCell[0]}][{activeCell[1]}] = {matrix[activeCell[0]][activeCell[1]]}</b><span>{currentOperation?.description}</span><button type="button" className="text-button" onClick={() => viewStackTrace(activeCell[0], activeCell[1])}>View Stack Trace →</button></> : <span>Run the stack simulation to see its current matrix lookup here.</span>}
              </div>
            </article>

            <aside className="panel inspection-panel">
              <div className="panel-header"><div><span className="panel-index panel-index-teal">02</span><div><h3>Inspect a candidate</h3><p>Evaluate the two rules directly</p></div></div></div>
              <label className="select-label" htmlFor="candidate-select">INVESTIGATE PERSON</label>
              <select id="candidate-select" value={candidate} onChange={(event) => setCandidate(Number(event.target.value))}>{Array.from({ length: n }, (_, person) => <option value={person} key={person}>{personLabel(person)}</option>)}</select>
              <div className={`check-card ${rowPass ? 'check-pass' : 'check-fail'}`}>
                <div className="check-title"><span>A</span><b>Knows nobody</b><strong>{rowPass ? 'PASS' : 'FAIL'}</strong></div>
                <p>{rowPass ? `${personLabel(candidate)} knows nobody else.` : `${personLabel(candidate)} knows ${personLabel(inspectedRow.findIndex((value, index) => index !== candidate && value === 1))} because M[${candidate}][${inspectedRow.findIndex((value, index) => index !== candidate && value === 1)}] = 1.`}</p>
                <small>Row values (diagonal ignored)</small><div className="value-strip">{inspectedRow.map((value, index) => index !== candidate && <span className={value ? 'strip-one' : 'strip-zero'} key={index}>{value}</span>)}</div>
                <small>People known <b>{knowsCount} / {n - 1}</b></small>
              </div>
              <div className={`check-card ${columnPass ? 'check-pass' : 'check-fail'}`}>
                <div className="check-title"><span>B</span><b>Known by everyone</b><strong>{columnPass ? 'PASS' : 'FAIL'}</strong></div>
                <p>{columnPass ? `Every other person knows ${personLabel(candidate)}.` : `${personLabel(matrix.findIndex((row, index) => index !== candidate && row[candidate] === 0) < 0 ? candidate : matrix.findIndex((row, index) => index !== candidate && row[candidate] === 0))} does not know ${personLabel(candidate)}.`}</p>
                <small>Column values (diagonal ignored)</small><div className="value-strip">{matrix.map((row, index) => index !== candidate && <span className={row[candidate] ? 'strip-one' : 'strip-zero'} key={index}>{row[candidate]}</span>)}</div>
                <small>People who know them <b>{knownByCount} / {n - 1}</b></small>
              </div>
              <div className="candidate-summary"><span className="micro-label">CANDIDATE RESULT</span><p>{candidateSummary}</p></div>
              <div className="overall-result"><span className="micro-label">MATRIX ANALYSIS</span>              {!shouldRevealMatrixAnswer ? <p className="overall-hidden">Make your prediction to reveal the overall matrix result.</p> : matrixAnswer.length ? <p className="overall-positive">✓ Qualifying: {matrixAnswer.map(personLabel).join(', ')}</p> : <p className="overall-negative">∅ No celebrity exists in this matrix.</p>}</div>
              {matchingTraceExists && <button type="button" className="button button-outline full-width" onClick={() => viewStackTrace(selectedCell[0], selectedCell[1])}>View Stack Trace →</button>}
            </aside>
          </div>
        </section>

        <section className="section-wrap simulation-section stack-section" id="stack-simulation">
          <div className="section-heading">
            <div><span className="section-kicker">SIMULATION 02 / CANDIDATE ELIMINATION</span><h2>Trace the stack.</h2></div>
            <p>One comparison eliminates one person.<br />The survivor still needs to be verified.</p>
          </div>
          <div className="stack-controls panel">
            <div className="control-copy"><span className="micro-label">SIMULATION CONTROLS</span><strong>{current?.description ?? 'Ready when you are.'}</strong><small>{hasRun ? `STEP ${stepIndex} OF ${simulation.length - 1} · ${current?.phase?.toUpperCase() ?? 'READY'}` : 'Start the algorithm to build a step-by-step trace.'}</small></div>
            <div className="control-actions">
              <button className="button button-primary" type="button" onClick={startSimulation}>{hasRun ? '↻ Start over' : '▶ Start simulation'}</button>
              <button className="icon-button" type="button" aria-label="Previous step" onClick={previousStep} disabled={!canStepBack}>←</button>
              <button className="icon-button" type="button" aria-label={playing ? 'Pause' : 'Play'} onClick={() => { if (!hasRun) startSimulation(); else if (stepIndex >= simulation.length - 1) setStepIndex(0); setPlaying((value) => !value); }}>{playing ? 'Ⅱ' : '▶'}</button>
              <button className="icon-button" type="button" aria-label="Next step" onClick={nextStep} disabled={hasRun && !canStepForward}>→</button>
              <button className="button button-outline" type="button" onClick={restartSimulation}>Restart</button>
              <button className="button button-quiet" type="button" onClick={showFinalResult}>Show result</button>
              <label className="speed-select">SPEED <select value={speed} onChange={(event) => setSpeed(event.target.value)}><option value="slow">Slow</option><option value="normal">Normal</option><option value="fast">Fast</option></select></label>
            </div>
          </div>
          <div className="stack-layout">
            <article className="panel stack-visual-panel">
              <div className="panel-header"><div><span className="panel-index">03</span><div><h3>Candidate stack</h3><p>Top of stack is on the right of the list</p></div></div><span className="phase-badge">{current?.phase === 'verify' || current?.phase === 'complete' ? 'PHASE 2 · VERIFY' : 'PHASE 1 · ELIMINATE'}</span></div>
              <div className="stack-visual">
                <div className="stack-items">
                  {current?.stack?.length ? [...current.stack].reverse().map((person, index) => <div className={`stack-item ${index === 0 ? 'stack-top' : ''} ${current.stack.length === 1 ? 'stack-survivor' : ''}`} key={`${person}-${index}`}><span>{personLabel(person)}</span>{index === 0 && <small>TOP</small>}</div>) : <div className="stack-empty">The stack is empty.</div>}
                </div>
                <div className="stack-base"><span>STACK</span><span>{current?.stack?.length ?? 0} candidates</span></div>
                <div className="stack-side">
                  <div className="side-block"><span className="micro-label">POPPED</span><div>{current?.popped?.length ? current.popped.map((person, index) => <span className="person-pill" key={`${person}-${index}`}>{personLabel(person)}</span>) : <small>—</small>}</div></div>
                  <div className="side-block"><span className="micro-label">ELIMINATED</span><div>{current?.eliminated?.length ? current.eliminated.map((person, index) => <span className="person-pill eliminated-pill" key={`${person}-${index}`}>{personLabel(person)}</span>) : <small>—</small>}</div></div>
                </div>
              </div>
              {current?.stack?.length === 1 && current.phase !== 'build' && <div className="survivor-callout">POSSIBLE CANDIDATE <b>{personLabel(current.stack[0])}</b><span>One person remains. Verification is still required.</span></div>}
            </article>
            <article className="panel operation-panel">
              <div className="panel-header"><div><span className="panel-index panel-index-amber">04</span><div><h3>Operation log</h3><p>Recorded algorithm operations</p></div></div><span className="operation-count">{current?.operations?.length ?? 0} OPS</span></div>
              <div className="operation-list" aria-live="polite">
                {current?.operations?.length ? [...current.operations].reverse().slice(0, 9).map((operation, index) => <div className={`operation-entry ${index === 0 ? 'operation-current' : ''}`} key={`${operation.type}-${current.operations.length - index}`}><span className={`op-symbol op-${operation.type}`}>{operation.type === 'push' ? '↓' : operation.type === 'pop' ? '↑' : operation.type.startsWith('verify') ? '✓' : operation.type === 'compare' ? '=' : '·'}</span><div><b>{operation.type === 'compare' ? `INSPECT → M[${operation.a}][${operation.b}] = ${operation.value}` : operation.type === 'verify-row' || operation.type === 'verify-column' ? `VERIFY → M[${operation.cell[0]}][${operation.cell[1]}] = ${operation.value}` : operation.type === 'eliminate' ? `ELIMINATE → P${operation.person}` : operation.type === 'push' ? `PUSH → P${operation.person}` : operation.type === 'pop' ? `POP → P${operation.person}` : operation.type === 'result' ? (operation.result.celebrity ? `CELEBRITY FOUND → P${operation.result.candidate}` : 'NO CELEBRITY EXISTS') : operation.description.split('.')[0]}</b><small>{operation.description}</small>{operation.cell && <button type="button" className="text-button" onClick={() => focusCell(operation.cell[0], operation.cell[1])}>View in Matrix ↗</button>}</div></div>) : <div className="empty-log">Operation history will appear here as you step through the algorithm.</div>}
              </div>
            </article>
          </div>
          {(current?.phase === 'verify' || current?.phase === 'complete') && current?.stack?.length === 1 && <article className="panel verify-panel">
            <div className="panel-header"><div><span className="panel-index panel-index-teal">05</span><div><h3>Verify the candidate</h3><p>For each person: check the candidate’s row, then the candidate’s column.</p></div></div><span className="phase-badge">PHASE 2</span></div>
            <div className="verification-list">
              {Array.from({ length: n }, (_, person) => person).filter((person) => person !== current.stack[0]).map((person) => {
                const rowCheck = current.verificationChecks.find((check) => check.type === 'verify-row' && check.person === person);
                const columnCheck = current.verificationChecks.find((check) => check.type === 'verify-column' && check.person === person);
                return <div className="verification-item" key={person}><span>{personLabel(person)}</span><div><small>CANDIDATE KNOWS THEM</small><b className={rowCheck ? (rowCheck.value ? 'text-fail' : 'text-pass') : ''}>{rowCheck ? `M[${current.stack[0]}][${person}] = ${rowCheck.value}` : 'Pending'}</b></div><div><small>THEY KNOW CANDIDATE</small><b className={columnCheck ? (columnCheck.value ? 'text-pass' : 'text-fail') : ''}>{columnCheck ? `M[${person}][${current.stack[0]}] = ${columnCheck.value}` : 'Pending'}</b></div></div>;
              })}
            </div>
          </article>}
          {current?.phase === 'complete' && finalResult && <article className={`result-card ${finalResult.celebrity ? 'result-success' : 'result-failure'}`}><div className="result-icon">{finalResult.celebrity ? '✓' : '×'}</div><div className="result-main"><span className="section-kicker">SIMULATION COMPLETE</span><h3>{finalResult.celebrity ? `CELEBRITY FOUND: ${personLabel(finalResult.candidate)}` : 'NO CELEBRITY EXISTS'}</h3><p>{finalResult.reason}</p></div><div className="result-stats"><div><small>ELIMINATION COMPARISONS</small><b>{current.comparisons}</b></div><div><small>VERIFICATION ITERATIONS</small><b>{current.verificationIterations}</b></div><div><small>CELL INSPECTIONS</small><b>{current.inspections}</b></div><div><small>FINAL STACK</small><b>{current.stack.length ? current.stack.map(personLabel).join(', ') : 'Empty'}</b></div></div></article>}
        </section>

        <section className="section-wrap algorithm-section" id="algorithm">
          <div className="algorithm-intro"><span className="section-kicker">WHY IT WORKS</span><h2>Eliminate.<br /><em>Then prove.</em></h2><p>For each pair, one person can be ruled out with a single matrix lookup. After elimination, verification checks that the survivor satisfies both celebrity rules.</p></div>
          <div className="algorithm-content">
            <div className="logic-row"><span className="logic-number">01</span><code>M[a][b] = 1</code><p>a knows b → <b>eliminate a</b>; a cannot be the celebrity.</p></div>
            <div className="logic-row"><span className="logic-number">02</span><code>M[a][b] = 0</code><p>a does not know b → <b>eliminate b</b>; b cannot be the celebrity.</p></div>
            <div className="complexity-row"><div><small>TIME COMPLEXITY</small><b>O(N)</b><span>Initialization, elimination, and verification are each linear.</span></div><div><small>AUXILIARY SPACE</small><b>O(N)</b><span>The stack stores at most N candidates.</span></div></div>
            <div className="single-note"><span>i</span><p><b>Single-person convention:</b> If the group has one person, that person is a celebrity by vacuous truth (there are no other people to violate either rule). The visualizer’s group-size control starts at 2, but the algorithm engine explicitly supports N = 1.</p></div>
          </div>
        </section>
      </main>
      <footer className="footer section-wrap"><a className="brand" href="#overview"><span className="brand-mark">C</span><span>DSA<span className="brand-muted"> / VISUAL LAB</span></span></a><span>Built to make every algorithm decision visible.</span><a href="#overview">BACK TO TOP ↑</a></footer>
    </div>
  );
}

export default App;
