// ============================================================
// tree-viz.js — Visualisasi Game Tree Treblecross
// Menggambar pohon pencarian ke canvas HTML5
// ============================================================

const TreeViz = {
  nodeRadius: 24,
  levelHeight: 95,

  // Warna node sesuai tipe
  colors: {
    max:    { fill: 'rgba(34,197,94,0.18)',  stroke: '#22c55e', text: '#86efac' },
    min:    { fill: 'rgba(239,68,68,0.18)',  stroke: '#ef4444', text: '#fca5a5' },
    pruned: { fill: 'rgba(245,158,11,0.15)', stroke: '#f59e0b', text: '#fcd34d' },
    edge:        '#475569',
    pruned_edge: '#f59e0b',
    bg: '#0f172a'
  },

  /**
   * Render game tree ke canvas
   * @param {string} canvasId  - ID elemen canvas
   * @param {object} treeData  - Data tree dari /api/tree
   * @param {boolean} useAB    - Tampilkan warna pruning atau tidak
   */
  render(canvasId, treeData, useAB = true) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Hitung berapa banyak leaf node untuk menentukan lebar
    const leafCount = this._countLeaves(treeData);
    const minWidth = Math.max(700, leafCount * 60);
    canvas.width = minWidth;
    canvas.height = 320;

    // Background
    ctx.fillStyle = this.colors.bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Hitung posisi semua node
    this._calcPositions(treeData, canvas.width / 2, 40, canvas.width * 0.9);

    // Gambar edge dulu (di bawah node)
    this._drawEdges(ctx, treeData, useAB);

    // Gambar node
    this._drawNodes(ctx, treeData, useAB);

    // Label level
    this._drawLevelLabels(ctx, treeData, canvas.width);
  },

  // Hitung jumlah daun (leaf node) untuk kalkulasi lebar
  _countLeaves(node) {
    if (!node.children || node.children.length === 0) return 1;
    return node.children.reduce((sum, c) => sum + this._countLeaves(c), 0);
  },

  // Hitung posisi x, y setiap node secara rekursif
  _calcPositions(node, x, y, totalWidth) {
    node._x = x;
    node._y = y;
    const n = node.children ? node.children.length : 0;
    if (n === 0) return;

    const spacing = totalWidth / n;
    node.children.forEach((child, i) => {
      this._calcPositions(
        child,
        x - totalWidth / 2 + spacing * (i + 0.5),
        y + this.levelHeight,
        spacing * 0.95
      );
    });
  },

  // Gambar semua garis penghubung (edge)
  _drawEdges(ctx, node, useAB) {
    if (!node.children) return;
    node.children.forEach(child => {
      const isPruned = useAB && child.pruned;

      ctx.beginPath();
      ctx.moveTo(node._x, node._y + this.nodeRadius);
      ctx.lineTo(child._x, child._y - this.nodeRadius);

      if (isPruned) {
        ctx.strokeStyle = this.colors.pruned_edge;
        ctx.setLineDash([5, 4]);
        ctx.globalAlpha = 0.5;
      } else {
        ctx.strokeStyle = this.colors.edge;
        ctx.setLineDash([]);
        ctx.globalAlpha = 0.8;
      }

      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;

      // Label langkah (sel yang dimainkan)
      if (child.move !== null && child.move !== undefined) {
        const mx = (node._x + child._x) / 2;
        const my = (node._y + child._y) / 2;
        ctx.fillStyle = isPruned ? '#f59e0b' : '#64748b';
        ctx.font = '10px Segoe UI, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`[${child.move}]`, mx + 8, my);
      }

      // Rekursi
      this._drawEdges(ctx, child, useAB);
    });
  },

  // Gambar semua node (lingkaran + teks)
  _drawNodes(ctx, node, useAB) {
    const r = this.nodeRadius;
    const isPruned = useAB && node.pruned;
    const col = isPruned
      ? this.colors.pruned
      : node.type === 'MAX' ? this.colors.max : this.colors.min;

    // Shadow halus
    ctx.shadowColor = col.stroke;
    ctx.shadowBlur = isPruned ? 4 : 8;

    // Lingkaran luar (border)
    ctx.beginPath();
    ctx.arc(node._x, node._y, r, 0, Math.PI * 2);
    ctx.fillStyle = col.fill;
    ctx.fill();
    ctx.strokeStyle = col.stroke;
    ctx.lineWidth = isPruned ? 1 : 2;
    ctx.stroke();

    ctx.shadowBlur = 0;

    // Label MAX/MIN
    ctx.fillStyle = col.text;
    ctx.font = `bold 9px Segoe UI, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(isPruned ? 'CUT' : node.type, node._x, node._y - 8);

    // Nilai node
    let valText = '?';
    if (isPruned) {
      valText = '✂';
    } else if (node.value !== null && node.value !== undefined) {
      if (node.value >= 900) valText = 'WIN';
      else if (node.value <= -900) valText = 'LOSE';
      else valText = String(node.value);
    }
    ctx.font = `bold 11px Segoe UI, sans-serif`;
    ctx.fillText(valText, node._x, node._y + 8);

    // Rekursi untuk anak
    if (node.children) {
      node.children.forEach(child => this._drawNodes(ctx, child, useAB));
    }
  },

  // Gambar label level di sisi kiri canvas
  _drawLevelLabels(ctx, root, canvasWidth) {
    const labels = [
      { y: 40,  text: 'Level 0 — Root' },
      { y: 40 + this.levelHeight, text: 'Level 1 — Human' },
      { y: 40 + this.levelHeight * 2, text: 'Level 2 — AI' },
      { y: 40 + this.levelHeight * 3, text: 'Level 3 — Human' },
    ];
    labels.forEach(l => {
      ctx.fillStyle = '#334155';
      ctx.font = '10px Segoe UI, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      if (l.y < 320) ctx.fillText(l.text, 6, l.y);
    });
  }
};