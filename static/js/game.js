// ============================================================
// game.js — Frontend Logic Treblecross
// ============================================================

const state = {
  board: [],
  boardSize: 15,
  depth: 4,
  useAlphaBeta: true,
  mode: 'hvai',
  gameOver: false,
  currentTurn: 'human',
  hvhPlayer: 1,
  moveCount: 0,
  lastMove: null,
  lastAIMove: null,
  historyRows: 0
};

const PLAYER_STYLE = {
  'H':  { symbol: '✕', css: 'cell-human' },
  'A':  { symbol: '◉', css: 'cell-ai'    },
  'P1': { symbol: '✕', css: 'cell-p1'   },
  'P2': { symbol: '◈', css: 'cell-p2'   }
};

document.addEventListener('DOMContentLoaded', () => newGame());

// ── NEW GAME ──
function newGame() {
  state.boardSize   = parseInt(document.getElementById('sizeSlider').value);
  state.depth       = parseInt(document.getElementById('depthSlider').value);
  state.board       = Array(state.boardSize).fill('');
  state.gameOver    = false;
  state.currentTurn = 'human';
  state.hvhPlayer   = 1;
  state.moveCount   = 0;
  state.lastMove    = null;
  state.lastAIMove  = null;

  renderBoard();
  resetCounters();
  clearTree();
  setStatus('🎮', state.mode === 'hvai' ? 'Giliran: Human (✕)' : 'Giliran: Pemain 1 (✕)');
  setTurnIndicator('human');
}

// ── RENDER BOARD ──
function renderBoard() {
  const boardEl = document.getElementById('board');
  const indexEl = document.getElementById('boardIndex');
  boardEl.innerHTML = '';
  indexEl.innerHTML = '';

  state.board.forEach((val, i) => {
    const cell = document.createElement('div');
    cell.className = 'cell';

    if (val !== '') {
      const ps = PLAYER_STYLE[val];
      cell.textContent = ps.symbol;
      cell.classList.add('filled', ps.css);
    }

    if (state.gameOver || (state.currentTurn === 'ai' && state.mode === 'hvai')) {
      cell.classList.add('disabled');
    }

    if (i === state.lastMove)  cell.classList.add('last-move');
    if (i === state.lastAIMove) cell.classList.add('ai-move');

    // Highlight sel berbahaya (mengisi ini = kalah)
    if (val === '' && isDangerCell(i)) {
      cell.classList.add('danger-cell');
    }
    cell.addEventListener('click', () => handleClick(i));
    boardEl.appendChild(cell);

    const idx = document.createElement('span');
    idx.textContent = i;
    indexEl.appendChild(idx);
  });
}

// ── HANDLE CLICK ──
function handleClick(index) {
  if (state.gameOver) return;
  if (state.board[index] !== '') return;
  if (state.mode === 'hvai') {
    if (state.currentTurn !== 'human') return;
    humanMove(index);
  } else {
    humanMoveHvH(index);
  }
}

// ── HUMAN MOVE (HvAI) ──
function humanMove(index) {
  // 1. Tulis ke state & render DULU — sel langsung muncul
  state.board[index] = 'H';
  state.lastMove   = index;
  state.lastAIMove = null;
  state.moveCount++;
  renderBoard();

  // 2. Cek kondisi board via API
  fetch('/api/check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ board: boardToServer(state.board), last_move: index })
  })
  .then(r => r.json())
  .then(data => {
    if (data.win) {
      highlightWin(data.win_positions);
      showModal('😢', 'Kamu Kalah!', 'Kamu membuat 3 tanda berurutan!');
      state.gameOver = true;
      setStatus('😢', 'Human kalah!');
    } else if (data.draw) {
      showModal('🤝', 'Seri!', 'Papan penuh tanpa pemenang.');
      state.gameOver = true;
      setStatus('🤝', 'Seri!');
    } else {
      // 3. Giliran AI — disable sel tanpa rebuild DOM
      state.currentTurn = 'ai';
      setStatus('🤖', 'AI sedang berpikir...');
      setTurnIndicator('ai');
      document.querySelectorAll('.cell').forEach(c => c.classList.add('disabled'));
      setTimeout(aiMove, 400);
    }
  })
  .catch(err => console.error('Check error:', err));
}

// ── AI MOVE ──
function aiMove() {
  // Baca depth terbaru dari slider (supaya selalu sinkron)
  state.depth = parseInt(document.getElementById('depthSlider').value);

  fetch('/api/move', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      board: boardToServer(state.board),
      depth: state.depth,
      use_alpha_beta: state.useAlphaBeta
    })
  })
  .then(r => r.json())
  .then(data => {
    console.log('AI response:', data); // debug — lihat di browser console

    if (data.move === null || data.move === undefined) {
      setStatus('🤝', 'Seri!');
      state.gameOver = true;
      renderBoard();
      return;
    }

    // Tulis langkah AI ke state lokal
    state.board[data.move] = 'A';
    state.lastAIMove = data.move;
    state.moveCount++;

    // Update counter & tabel
    const mm  = data.mm_nodes    || 0;
    const ab  = data.ab_nodes    || 0;
    const pc  = data.prune_count || 0;
    const pct = data.prune_percent != null ? data.prune_percent : 0;

    updateCounters(mm, ab, pc, pct);
    addHistoryRow(state.depth, mm, ab, pc, pct);
    renderBoard();

    if (data.win) {
      highlightWin(data.win_positions);
      showModal('🏆', 'AI Kalah!', 'AI membuat 3 tanda berurutan. Kamu menang!');
      state.gameOver = true;
      setStatus('🏆', 'Kamu menang!');
    } else {
      state.currentTurn = 'human';
      setStatus('🎮', 'Giliran: Human (✕)');
      setTurnIndicator('human');
      fetchAndRenderTree();
    }
  })
  .catch(err => console.error('AI move error:', err));
}

// ── HUMAN vs HUMAN ──
function humanMoveHvH(index) {
  const marker = state.hvhPlayer === 1 ? 'P1' : 'P2';
  state.board[index] = marker;
  state.lastMove = index;
  state.moveCount++;
  renderBoard();

  fetch('/api/check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ board: boardToServer(state.board), last_move: index })
  })
  .then(r => r.json())
  .then(data => {
    if (data.win) {
      highlightWin(data.win_positions);
      const loser  = `Pemain ${state.hvhPlayer}`;
      const winner = `Pemain ${state.hvhPlayer === 1 ? 2 : 1}`;
      showModal('🏆', `${winner} Menang!`, `${loser} membuat 3 tanda berurutan!`);
      state.gameOver = true;
      setStatus('🏆', `${winner} menang!`);
    } else if (data.draw) {
      showModal('🤝', 'Seri!', 'Papan penuh.');
      state.gameOver = true;
    } else {
      state.hvhPlayer = state.hvhPlayer === 1 ? 2 : 1;
      const sym = state.hvhPlayer === 1 ? '✕' : '◈';
      setStatus('🎮', `Giliran: Pemain ${state.hvhPlayer} (${sym})`);
    }
  })
  .catch(err => console.error('HvH check error:', err));
}

// ── CEK SEL BERBAHAYA ──
// Sel kosong yang jika diisi akan langsung membentuk 3 berurutan = bahaya!
function isDangerCell(index) {
  const b = boardToServer(state.board);
  b[index] = 'X';
  // Cek apakah langkah ini langsung membentuk 3 berurutan
  const n = b.length;
  for (let start = Math.max(0, index - 2); start <= Math.min(n - 3, index); start++) {
    if (b[start] === 'X' && b[start+1] === 'X' && b[start+2] === 'X') return true;
  }
  return false;
}

// ── KONVERSI BOARD ──
// Backend hanya mengenal 'X' dan ''
function boardToServer(board) {
  return board.map(v => v !== '' ? 'X' : '');
}

// ── FETCH TREE ──
function fetchAndRenderTree() {
  fetch('/api/tree', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      board: boardToServer(state.board),
      use_alpha_beta: state.useAlphaBeta
    })
  })
  .then(r => r.json())
  .then(data => {
    TreeViz.render('treeCanvas', data.tree, state.useAlphaBeta);
    document.getElementById('treeNote').textContent =
      `Tree dari posisi saat ini | ${state.useAlphaBeta ? 'Alpha-Beta aktif' : 'Minimax murni'}`;
  })
  .catch(err => console.error('Tree error:', err));
}

// ── UI HELPERS ──
function highlightWin(positions) {
  const cells = document.querySelectorAll('.cell');
  positions.forEach(i => cells[i] && cells[i].classList.add('winning'));
}

function setStatus(icon, text) {
  document.querySelector('.status-icon').textContent = icon;
  document.getElementById('statusText').textContent  = text;
}

function setTurnIndicator(who) {
  const h = document.getElementById('turnHuman');
  const a = document.getElementById('turnAI');
  if (who === 'human') {
    h.classList.remove('inactive'); a.classList.add('inactive');
  } else {
    a.classList.remove('inactive'); h.classList.add('inactive');
  }
}

function updateCounters(mm, ab, prune, pct) {
  document.getElementById('mmCount').textContent    = mm.toLocaleString();
  document.getElementById('abCount').textContent    = ab.toLocaleString();
  document.getElementById('pruneCount').textContent = prune.toLocaleString();
  document.getElementById('pruneBar').style.width   = Math.min(pct, 100) + '%';
  document.getElementById('prunePct').textContent   = `${pct}% lebih efisien`;
}

function resetCounters() {
  ['mmCount','abCount','pruneCount'].forEach(id =>
    document.getElementById(id).textContent = '0');
  document.getElementById('pruneBar').style.width = '0%';
  document.getElementById('prunePct').textContent = '0% efisiensi';
}

function clearTree() {
  const canvas = document.getElementById('treeCanvas');
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  document.getElementById('treeNote').textContent = 'Tree akan muncul setelah giliran AI';
}

// ── TABEL RIWAYAT ──
function addHistoryRow(depth, mm, ab, prune, pct) {
  const tbody = document.getElementById('histBody');

  // Hapus baris placeholder kalau masih ada
  const placeholder = document.getElementById('placeholderRow');
  if (placeholder) placeholder.remove();

  state.historyRows++;
  const pctNum   = parseFloat(pct) || 0;
  const pctClass = pctNum >= 60 ? 'eff-high' : pctNum >= 30 ? 'eff-mid' : 'eff-low';

  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td>${state.historyRows}</td>
    <td>${depth}</td>
    <td>${mm.toLocaleString()}</td>
    <td>${ab.toLocaleString()}</td>
    <td>${prune.toLocaleString()}</td>
    <td class="${pctClass}">${pctNum}%</td>`;

  // Terbaru di atas
  tbody.insertBefore(tr, tbody.firstChild);
}

function showModal(icon, title, msg) {
  document.getElementById('modalIcon').textContent  = icon;
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalMsg').textContent   = msg;
  document.getElementById('modalOverlay').classList.add('show');
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('show');
}

function toggleAB() {
  state.useAlphaBeta = document.getElementById('abToggle').checked;
}

function setMode(mode) {
  state.mode = mode;
  document.querySelectorAll('.btn-mode').forEach(b =>
    b.classList.toggle('active', b.dataset.mode === mode));
  newGame();
}