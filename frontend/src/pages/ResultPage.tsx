import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import * as echarts from "echarts";
import type { EChartsOption } from "echarts";
import { fetchCells, type Cell, type CellType } from "../api";

// 动态调色板 — 20 色
const PALETTE = [
  "#2a78d6", "#eb6834", "#1baf7a", "#4a3aa7",
  "#e34948", "#eda100", "#e87ba4", "#008300",
  "#7b60b5", "#d46090", "#3d8b7a", "#c4714a",
  "#5994c4", "#b38b5f", "#6a9336", "#3d7a9b",
  "#cf8a4b", "#27a398", "#a359b0", "#d97745",
];

// 所有细胞数据的缓存（供选中态查询用）
let _allCellsCache: Cell[] = [];

export default function ResultPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [cellCount, setCellCount] = useState(0);
  const [cellTypes, setCellTypes] = useState<CellType[]>([]);
  const [hoveredCell, setHoveredCell] = useState<Cell | null>(null);
  const [groupedCells, setGroupedCells] = useState<Record<string, Cell[]>>({});
  const [colorMap, setColorMap] = useState<Record<string, string>>({});
  const [bounds, setBounds] = useState({ xMin: 0, xMax: 0, yMin: 0, yMax: 0 });
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [selectMode, setSelectMode] = useState<"click" | "box">("click");

  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);
  const chartReady = useRef(false);

  // 清除选中
  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  useEffect(() => {
    if (!id) return;
    fetchCells(id)
      .then((data) => {
        setName(data.name);
        setCellCount(data.cell_count);
        _allCellsCache = data.cells;

        const groups: Record<string, Cell[]> = {};
        for (const c of data.cells) {
          if (!groups[c.label]) groups[c.label] = [];
          groups[c.label].push(c);
        }

        const cmap: Record<string, string> = {};
        Object.entries(groups)
          .sort((a, b) => b[1].length - a[1].length)
          .forEach(([n], i) => { cmap[n] = PALETTE[i % PALETTE.length]; });

        const types: CellType[] = Object.entries(groups)
          .map(([n, cells]) => ({ name: n, count: cells.length, color: cmap[n] }))
          .sort((a, b) => b.count - a.count);

        setCellTypes(types);
        setGroupedCells(groups);
        setColorMap(cmap);

        const ac = data.cells;
        let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
        for (const c of ac) {
          if (c.x < xMin) xMin = c.x; if (c.x > xMax) xMax = c.x;
          if (c.y < yMin) yMin = c.y; if (c.y > yMax) yMax = c.y;
        }
        const px = (xMax - xMin) * 0.02 || 1;
        const py = (yMax - yMin) * 0.02 || 1;
        setBounds({ xMin: xMin - px, xMax: xMax + px, yMin: yMin - py, yMax: yMax + py });
        setLoading(false);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "加载失败");
        setLoading(false);
      });
  }, [id]);

  // 选中的 Cell 列表
  const selectedCells = useMemo(() => {
    return _allCellsCache.filter((c) => selectedIds.has(c.cell_id));
  }, [selectedIds]);

  const option: EChartsOption = useMemo(() => {
    if (Object.keys(groupedCells).length === 0) return {};

    const series: Record<string, unknown>[] = Object.entries(groupedCells).map(([label, cells]) => ({
      name: label,
      type: "scatter" as const,
      large: true,
      largeThreshold: 500,
      data: cells.map((c) => [
        c.x, c.y, c.cell_id, c.full_label,
        c.prob, c.top2_label, c.top2_prob, c.margin,
      ]),
      symbolSize: 3,
      itemStyle: { color: colorMap[label] ?? "#a0a0a0", opacity: 0.85 },
      emphasis: {
        itemStyle: { borderColor: "#0b0b0b", borderWidth: 1.5, opacity: 1 },
        scale: 1.8,
      },
    }));

    // 选中高亮图层
    if (selectedCells.length > 0) {
      const selData: Record<string, (number | string)[][]> = {};
      for (const c of selectedCells) {
        if (!selData[c.label]) selData[c.label] = [];
        selData[c.label].push([c.x, c.y, c.cell_id, c.full_label, c.prob, c.top2_label, c.top2_prob, c.margin]);
      }
      for (const [label, data] of Object.entries(selData)) {
        series.push({
          name: `${label} (selected)`,
          type: "scatter",
          data: data as number[][],
          symbolSize: 8,
          z: 10,
          itemStyle: {
            color: colorMap[label] ?? "#a0a0a0",
            borderColor: "#0b0b0b",
            borderWidth: 2,
            opacity: 1,
          },
          emphasis: {
            itemStyle: { borderColor: "#e34948", borderWidth: 3, opacity: 1 },
            scale: 1.3,
          },
        });
      }
    }

    const legendData = Object.keys(groupedCells).map((name) => ({
      name,
      icon: "circle" as const,
      itemStyle: { color: colorMap[name] ?? "#a0a0a0" },
    }));

    return {
      backgroundColor: "#fcfcfb",
      legend: {
        data: legendData,
        bottom: 8,
        type: "scroll" as const,
        textStyle: { color: "#52514e", fontSize: 11, fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif" },
        itemWidth: 8, itemHeight: 8, itemGap: 16,
      },
      tooltip: {
        trigger: "item" as const,
        backgroundColor: "#fff",
        borderColor: "rgba(11,11,11,0.10)",
        borderWidth: 1,
        padding: [12, 16],
        textStyle: { color: "#0b0b0b", fontSize: 13, fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif" },
        formatter: (params: unknown) => {
          const p = params as unknown as { data: number[]; seriesName: string; color: string };
          const nm = p.seriesName.replace(" (selected)", "");
          return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${p.color}"></span><strong>${nm}</strong></div><table style="font-size:12px;line-height:1.8;color:#52514e"><tr><td>Cell ID</td><td style="padding-left:16px;color:#0b0b0b;text-align:right">${p.data[2]}</td></tr><tr><td>Confidence</td><td style="padding-left:16px;color:#0b0b0b;text-align:right">${(p.data[4] as number * 100).toFixed(1)}%</td></tr><tr><td>Margin</td><td style="padding-left:16px;color:#0b0b0b;text-align:right">${(p.data[7] as number * 100).toFixed(1)}%</td></tr></table>`;
        },
      },
      brush: {
        toolbox: selectMode === "box" ? ["rect", "clear"] : [],
        brushType: "rect",
        brushMode: "multiple",
        transformable: true,
        throttleType: "debounce",
        throttleDelay: 300,
        brushStyle: { borderWidth: 1.5, color: "rgba(42,120,214,0.15)", borderColor: "#2a78d6" },
        outOfBrush: { color: "#ccc" },
      },
      grid: { left: 8, right: 8, top: 8, bottom: 60 },
      xAxis: { type: "value" as const, show: false, min: bounds.xMin, max: bounds.xMax },
      yAxis: { type: "value" as const, show: false, min: bounds.yMin, max: bounds.yMax },
      dataZoom: [
        { type: "inside" as const, zoomOnMouseWheel: true },
        { type: "slider" as const, bottom: 36, height: 20, borderColor: "transparent", backgroundColor: "rgba(11,11,11,0.04)", fillerColor: "rgba(11,11,11,0.10)", handleStyle: { color: "#52514e", borderColor: "#52514e" }, textStyle: { color: "#898781", fontSize: 10 } },
      ],
      series,
    };
  }, [groupedCells, colorMap, bounds, selectedCells, selectMode]);

  // ECharts 初始化 + 事件绑定
  useEffect(() => {
    if (!chartRef.current || Object.keys(groupedCells).length === 0) return;

    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current);
    }

    const chart = chartInstance.current;

    // 点击事件
    chart.off("click");
    chart.on("click", (params: unknown) => {
      const p = params as { data: number[] };
      if (!p.data?.length) return;
      const cellId = p.data[2] as number;
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(cellId)) next.delete(cellId); else next.add(cellId);
        return next;
      });
    });

    // 框选事件
    chart.off("brushSelected");
    chart.on("brushSelected", (params: unknown) => {
      const p = params as { batch?: { selected?: { dataIndex?: number[] }[] }[] };
      const newIds = new Set<number>();
      // ECharts brushSelected 返回 dataIndex，需要从 series data 中反查 cell_id
      if (p.batch) {
        for (let si = 0; si < p.batch.length; si++) {
          const batch = p.batch[si];
          for (const sel of batch.selected ?? []) {
            for (const idx of sel.dataIndex ?? []) {
              const opt = chart.getOption() as { series?: { data?: (number | string)[][] }[] };
              const sd = opt.series?.[si]?.data;
              if (sd?.[idx]?.[2] !== undefined) {
                newIds.add(sd[idx][2] as number);
              }
            }
          }
        }
      }
      if (newIds.size > 0) {
        setSelectedIds((prev) => {
          const next = new Set(prev);
          newIds.forEach((id) => next.add(id));
          return next;
        });
      }
    });

    // 鼠标悬停
    chart.off("mouseover"); chart.off("mouseout");
    chart.on("mouseover", (params: unknown) => {
      const p = params as { data: number[]; seriesName: string };
      if (p.data?.length) {
        setHoveredCell({
          cell_id: p.data[2], x: p.data[0], y: p.data[1],
          label: p.seriesName.replace(" (selected)", ""),
          full_label: p.data[3] as unknown as string,
          prob: p.data[4], top2_label: p.data[5] as unknown as string,
          top2_prob: p.data[6], margin: p.data[7],
        });
      }
    });
    chart.on("mouseout", () => setHoveredCell(null));

    const isFirst = !chartReady.current;
    chart.setOption(option, isFirst);
    chartReady.current = true;

    const onResize = () => chart.resize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [groupedCells, option]);

  useEffect(() => {
    return () => {
      chartInstance.current?.dispose();
      chartInstance.current = null;
      chartReady.current = false;
    };
  }, []);

  if (loading) return <div className="loading-state"><div className="spinner" /><p>加载数据中…</p></div>;
  if (error) return <div className="error-state"><p>{error}</p><button className="btn-ghost" onClick={() => navigate("/")}>返回上传</button></div>;

  return (
    <div className="result-page">
      <header className="result-topbar">
        <button className="btn-ghost" onClick={() => navigate("/")}>← 返回</button>
        <div className="topbar-info">
          <h1>{name}</h1>
          <span className="badge">{cellCount.toLocaleString()} cells</span>
        </div>
        <div className="topbar-tools">
          <button
            className={`btn-tool ${selectMode === "click" ? "active" : ""}`}
            onClick={() => setSelectMode("click")}
            title="点击选中"
          >
            👆 点选
          </button>
          <button
            className={`btn-tool ${selectMode === "box" ? "active" : ""}`}
            onClick={() => setSelectMode("box")}
            title="框选"
          >
            ⬜ 框选
          </button>
          {selectedIds.size > 0 && (
            <button className="btn-tool" onClick={clearSelection} title="清除选中">
              ✕ 清除 ({selectedIds.size})
            </button>
          )}
        </div>
        <div className="topbar-spacer" />
        <button
          className={selectedIds.size > 0 ? "btn-primary" : "btn-disabled"}
          disabled={selectedIds.size === 0}
          title={selectedIds.size > 0 ? undefined : "请先选中细胞"}
        >
          修改注释
        </button>
      </header>

      <div className="result-body">
        <div className="chart-area" ref={chartRef} />

        <aside className="side-panel">
          <section className="panel-block">
            <h3 className="panel-label">数据集</h3>
            <div className="kv-row"><span className="kv-key">文件</span><span className="kv-val">{name}</span></div>
            <div className="kv-row"><span className="kv-key">细胞</span><span className="kv-val">{cellCount.toLocaleString()}</span></div>
            <div className="kv-row"><span className="kv-key">类型</span><span className="kv-val">{cellTypes.length}</span></div>
          </section>

          <section className="panel-block">
            <h3 className="panel-label">细胞类型</h3>
            <ul className="legend-list">
              {cellTypes.map((t) => (
                <li key={t.name}>
                  <span className="legend-swatch" style={{ background: t.color }} />
                  <span className="legend-name">{t.name}</span>
                  <span className="legend-meta">{t.count.toLocaleString()}<span className="legend-pct"> · {((t.count / cellCount) * 100).toFixed(1)}%</span></span>
                </li>
              ))}
            </ul>
          </section>

          <section className="panel-block">
            <h3 className="panel-label">已选中 ({selectedIds.size})</h3>
            {selectedCells.length > 0 ? (
              <div className="cell-card">
                {selectedCells.slice(0, 20).map((c) => (
                  <div key={c.cell_id} className="selected-row" onClick={() => setSelectedIds((prev) => { const n = new Set(prev); n.delete(c.cell_id); return n; })}>
                    <span className="legend-swatch" style={{ background: colorMap[c.label] ?? "#999" }} />
                    <span className="legend-name">{c.full_label}</span>
                    <span className="legend-meta">ID:{c.cell_id}</span>
                  </div>
                ))}
                {selectedCells.length > 20 && <p className="panel-hint">…还有 {selectedCells.length - 20} 个细胞</p>}
              </div>
            ) : hoveredCell ? (
              <div className="cell-card">
                <div className="kv-row"><span className="kv-key">ID</span><span className="kv-val">{hoveredCell.cell_id}</span></div>
                <div className="kv-row"><span className="kv-key">预测类型</span><span className="kv-val pill">{hoveredCell.full_label}</span></div>
                <div className="kv-row"><span className="kv-key">置信度</span><span className="kv-val">{(hoveredCell.prob * 100).toFixed(1)}%</span></div>
                <div className="kv-row"><span className="kv-key">坐标</span><span className="kv-val mono">{hoveredCell.x.toFixed(0)}, {hoveredCell.y.toFixed(0)}</span></div>
                <div className="kv-row"><span className="kv-key">Top-2 候选</span><span className="kv-val">{hoveredCell.top2_label}</span></div>
                <div className="kv-row"><span className="kv-key">间隔</span><span className="kv-val">{(hoveredCell.margin * 100).toFixed(1)}%</span></div>
              </div>
            ) : (
              <p className="panel-hint">点击或框选细胞点<br />选中后进行修改注释</p>
            )}
          </section>

          <section className="panel-block">
            <button className={selectedIds.size > 0 ? "btn-primary btn-block" : "btn-disabled btn-block"} disabled={selectedIds.size === 0}>
              修改注释
            </button>
            {selectedIds.size === 0 && <p className="panel-hint">请先选中细胞</p>}
          </section>
        </aside>
      </div>
    </div>
  );
}
