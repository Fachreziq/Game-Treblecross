from flask import Flask, render_template, request, jsonify

app = Flask(__name__)

# ============================================================
# TREBLECROSS — backend
# ============================================================

def check_win_at(board, pos):
    """Cek apakah sel 'pos' melengkapi 3 X berurutan."""
    n = len(board)
    for start in range(max(0, pos - 2), min(n - 3, pos) + 1):
        if board[start] == 'X' and board[start+1] == 'X' and board[start+2] == 'X':
            return True, [start, start+1, start+2]
    return False, []

def get_empty_cells(board):
    return [i for i, v in enumerate(board) if v == '']

def evaluate(board):
    score = 0
    n = len(board)
    for i in range(n - 2):
        w = [board[i], board[i+1], board[i+2]]
        x = w.count('X')
        e = w.count('')
        if x == 3:            return -1000
        elif x == 2 and e == 1: score -= 10
        elif x == 1 and e == 2: score -= 1
    return score

# ── counter global ──
_mm_count = 0
_ab_count = 0
_pc_count = 0

# ============================================================
# MINIMAX MURNI — hanya untuk menghitung node count
# Dibatasi depth rendah agar tidak lambat
# ============================================================
def minimax(board, depth, is_maximizing, last_move):
    global _mm_count
    _mm_count += 1

    if last_move is not None:
        win, _ = check_win_at(board, last_move)
        if win:
            return 1000 if is_maximizing else -1000

    empty = get_empty_cells(board)
    if depth == 0 or not empty:
        return evaluate(board)

    if is_maximizing:
        best = -float('inf')
        for cell in empty:
            b = board[:]
            b[cell] = 'X'
            best = max(best, minimax(b, depth-1, False, cell))
        return best
    else:
        best = float('inf')
        for cell in empty:
            b = board[:]
            b[cell] = 'X'
            best = min(best, minimax(b, depth-1, True, cell))
        return best

# ============================================================
# MINIMAX + ALPHA-BETA — dipakai untuk mencari best move
# ============================================================
def minimax_ab(board, depth, is_maximizing, alpha, beta, last_move):
    global _ab_count, _pc_count
    _ab_count += 1

    if last_move is not None:
        win, _ = check_win_at(board, last_move)
        if win:
            return 1000 if is_maximizing else -1000

    empty = get_empty_cells(board)
    if depth == 0 or not empty:
        return evaluate(board)

    if is_maximizing:
        best = -float('inf')
        for cell in empty:
            b = board[:]
            b[cell] = 'X'
            best = max(best, minimax_ab(b, depth-1, False, alpha, beta, cell))
            alpha = max(alpha, best)
            if beta <= alpha:
                _pc_count += 1
                break
        return best
    else:
        best = float('inf')
        for cell in empty:
            b = board[:]
            b[cell] = 'X'
            best = min(best, minimax_ab(b, depth-1, True, alpha, beta, cell))
            beta = min(beta, best)
            if beta <= alpha:
                _pc_count += 1
                break
        return best

def get_best_move(board, depth, use_alpha_beta):
    global _mm_count, _ab_count, _pc_count

    clean = board[:]
    empty = get_empty_cells(clean)
    if not empty:
        return None, 0, 0, 0

    # ── Alpha-Beta: cari best move dengan depth penuh ──
    _ab_count = 0
    _pc_count = 0
    best_val  = -float('inf')
    best_move = empty[0]
    for cell in empty:
        b = clean[:]
        b[cell] = 'X'
        val = minimax_ab(b, depth-1, False, -float('inf'), float('inf'), cell)
        if val > best_val:
            best_val  = val
            best_move = cell
    ab_count = _ab_count
    pc       = _pc_count

    # ── Minimax murni: hanya hitung node count, depth dibatasi 3 ──
    # (hanya untuk keperluan perbandingan di tabel, tidak mempengaruhi langkah AI)
    mm_depth = min(depth, 3)
    _mm_count = 0
    for cell in empty:
        b = clean[:]
        b[cell] = 'X'
        minimax(b, mm_depth-1, False, cell)
    mm_count = _mm_count

    # Gunakan alpha-beta move selalu (lebih optimal)
    return best_move, mm_count, ab_count, pc

# ============================================================
# GAME TREE — visualisasi (max 3 level)
# ============================================================
def build_game_tree(board, depth, is_maximizing, alpha, beta,
                    last_move=None, use_ab=True):
    node_type = "MAX" if is_maximizing else "MIN"

    if last_move is not None:
        win, _ = check_win_at(board, last_move)
        if win:
            val = 1000 if is_maximizing else -1000
            return {"type": node_type, "value": val, "move": last_move,
                    "pruned": False, "children": [], "win": True}

    empty = get_empty_cells(board)
    if depth == 0 or not empty:
        return {"type": node_type, "value": evaluate(board), "move": last_move,
                "pruned": False, "children": [], "win": False}

    children = []
    node_val  = -float('inf') if is_maximizing else float('inf')

    # Batasi anak ke max 5 untuk visualisasi agar tidak terlalu penuh
    for idx, cell in enumerate(empty[:5]):
        b = board[:]
        b[cell] = 'X'
        child = build_game_tree(b, depth-1, not is_maximizing,
                                alpha, beta, cell, use_ab)
        child["move"] = cell
        children.append(child)

        cv = child["value"] if child["value"] is not None else (-999 if is_maximizing else 999)
        if is_maximizing:
            node_val = max(node_val, cv)
            if use_ab:
                alpha = max(alpha, node_val)
                if beta <= alpha:
                    for pc in empty[idx+1:5]:
                        children.append({"type": "MIN", "value": None, "move": pc,
                                         "pruned": True, "children": [], "win": False})
                    break
        else:
            node_val = min(node_val, cv)
            if use_ab:
                beta = min(beta, node_val)
                if beta <= alpha:
                    for pc in empty[idx+1:5]:
                        children.append({"type": "MAX", "value": None, "move": pc,
                                         "pruned": True, "children": [], "win": False})
                    break

    return {"type": node_type, "value": node_val, "move": last_move,
            "pruned": False, "children": children, "win": False}

# ============================================================
# FLASK ROUTES
# ============================================================

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/check', methods=['POST'])
def check_state():
    data      = request.get_json()
    board     = data.get('board', [])
    last_move = data.get('last_move')

    if last_move is None:
        return jsonify({"win": False, "win_positions": [], "draw": False})

    win, win_pos = check_win_at(board, int(last_move))
    draw = (not win) and (len(get_empty_cells(board)) == 0)
    return jsonify({"win": win, "win_positions": win_pos, "draw": draw})

@app.route('/api/move', methods=['POST'])
def ai_move():
    data   = request.get_json()
    board  = data.get('board', [])
    depth  = int(data.get('depth', 4))
    use_ab = bool(data.get('use_alpha_beta', True))

    # Batasi depth agar tidak terlalu lambat:
    # Makin banyak sel kosong → depth lebih rendah
    empty_count = len(get_empty_cells(board))
    if empty_count > 10:
        depth = min(depth, 4)
    elif empty_count > 6:
        depth = min(depth, 5)
    depth = max(depth, 1)

    move, mm_count, ab_count, pc = get_best_move(board, depth, use_ab)

    if move is None:
        return jsonify({"move": None, "mm_nodes": 0, "ab_nodes": 0,
                        "prune_count": 0, "prune_percent": 0,
                        "win": False, "win_positions": []})

    board_after       = board[:]
    board_after[move] = 'X'
    win, win_pos      = check_win_at(board_after, move)

    pct = round((1 - ab_count / mm_count) * 100 if mm_count > 0 else 0, 1)

    return jsonify({
        "move":          move,
        "mm_nodes":      mm_count,
        "ab_nodes":      ab_count,
        "prune_count":   pc,
        "prune_percent": pct,
        "win":           win,
        "win_positions": win_pos
    })

@app.route('/api/tree', methods=['POST'])
def get_tree():
    data   = request.get_json()
    board  = data.get('board', [])
    use_ab = bool(data.get('use_alpha_beta', True))
    tree   = build_game_tree(board[:], 3, True, -float('inf'), float('inf'),
                             last_move=None, use_ab=use_ab)
    return jsonify({"tree": tree})

if __name__ == '__main__':
    import os
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)