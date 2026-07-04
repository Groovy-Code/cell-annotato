import { useEffect, useState, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import * as echarts from "echarts";
import type { EChartsOption } from "echarts";
import { fetchCells, type Cell, type CellType } from "../api";

// dataviz 方法验证通过的 8 色调色板（参考 palette.md）
const CATEGORY_COLORS: Record<string, string> = {
  Hepatocytes: "#2a78d6",
  Monocytes: "#eb6834",
  "Stromal cells": "#1baf7a",
  "B cells": "#4a3aa7",
  "Endothelial cells": "#e34948",
  "T cells": "#eda100",
  "Kupffer cells": "#e87ba4",
  Other: "#a0a0a0",
};

function pickColor(label: string): string {
  // 主类型直接命中；其余折叠为 Other
  return CATEGORY_COLORS[label] ?? CATEGORY_COLORS["Other"];
}

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

  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!id) return;
    fetchCells(id)
      .then((data) => {
        setName(data.name);
        setCellCount(data.cell_count);

        // 重新构建 cell_types：折叠稀有类型
        const groups: Record<string, Cell[]> = {};
        for (const c of data.cells) {
          const label = pickColor(c.label) === CATEGORY_COLORS["Other"]
            ? "Other"
            : c.label;
          if (!groups[label]) groups[label] = [];
          groups[label].push(c);
        }

        const types: CellType[] = Object.entries(groups)
          .map(([name, cells]) => ({
            name,
            count: cells.length,
            color: CATEGORY_COLORS[name] ?? CATEGORY_COLORS["Other"],
          }))
          .sort((a, b) => b.count - a.count);

        setCellTypes(types);
        setGroupedCells(groups);
        setLoading(false);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "加载失败");
        setLoading(false);
      });
  }, [id]);

  const option: EChartsOption = useMemo(() => {
    if (Object.keys(groupedCells).length === 0) return {};

    const series = Object.entries(groupedCells).map(([label, cells]) => ({
      name: label,
      type: "scatter" as const,
      data: cells.map((c) => [
        c.x,
        c.y,
        c.cell_id,
        c.full_label,
        c.prob,
        c.top2_label,
        c.top2_prob,
        c.margin,
      ]),
      symbolSize: label === "Other" ? 2 : 3,
      itemStyle: {
        color: CATEGORY_COLORS[label] ?? CATEGORY_COLORS["Other"],
        opacity: label === "Other" ? 0.5 : 0.85,
      },
      emphasis: {
        itemStyle: {
          borderColor: "#0b0b0b",
          borderWidth: 1.5,
          opacity: 1,
        },
        scale: 1.8,
      },
    }));

    return {
      backgroundColor: "#fcfcfb",
      tooltip: {
        trigger: "item" as const,
        backgroundColor: "#fff",
        borderColor: "rgba(11,11,11,0.10)",
        borderWidth: 1,
        padding: [12, 16],
        textStyle: {
          color: "#0b0b0b",
          fontSize: 13,
          fontFamily:
            "system-ui, -apple-system, 'Segoe UI', sans-serif",
        },
        formatter: (params: unknown) => {
          const p = params as unknown as {
            data: number[];
            seriesName: string;
            color: string;
          };
          return `
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
              <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${p.color}"></span>
              <strong>${p.seriesName}</strong>
            </div>
            <table style="font-size:12px;line-height:1.8;color:#52514e">
              <tr><td>Cell ID</td><td style="padding-left:16px;color:#0b0b0b;text-align:right">${p.data[2]}</td></tr>
              <tr><td>Confidence</td><td style="padding-left:16px;color:#0b0b0b;text-align:right">${(p.data[4] as number * 100).toFixed(1)}%</td></tr>
              <tr><td>Margin</td><td style="padding-left:16px;color:#0b0b0b;text-align:right">${(p.data[7] as number * 100).toFixed(1)}%</td></tr>
            </table>`;
        },
      },
      grid: { left: 8, right: 8, top: 8, bottom: 48 },
      xAxis: {
        type: "value" as const,
        show: false,
        min: (v: { min: number }) => v.min - 100,
        max: (v: { max: number }) => v.max + 100,
      },
      yAxis: {
        type: "value" as const,
        show: false,
        min: (v: { min: number }) => v.min - 100,
        max: (v: { max: number }) => v.max + 100,
      },
      dataZoom: [
        { type: "inside" as const },
        {
          type: "slider" as const,
          bottom: 8,
          height: 20,
          borderColor: "transparent",
          backgroundColor: "rgba(11,11,11,0.04)",
          fillerColor: "rgba(11,11,11,0.10)",
          handleStyle: { color: "#52514e", borderColor: "#52514e" },
          textStyle: { color: "#898781", fontSize: 10 },
        },
      ],
      series,
    };
  }, [groupedCells]);

  // ECharts 初始化
  useEffect(() => {
    if (!chartRef.current || Object.keys(groupedCells).length === 0) return;

    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current);
    }

    chartInstance.current.off("mouseover");
    chartInstance.current.off("mouseout");
    chartInstance.current.on("mouseover", (params: unknown) => {
      const p = params as { data: number[]; seriesName: string };
      if (p.data?.length) {
        setHoveredCell({
          cell_id: p.data[2],
          x: p.data[0],
          y: p.data[1],
          label: p.seriesName,
          full_label: p.data[3] as unknown as string,
          prob: p.data[4],
          top2_label: p.data[5] as unknown as string,
          top2_prob: p.data[6],
          margin: p.data[7],
        });
      }
    });
    chartInstance.current.on("mouseout", () => setHoveredCell(null));

    chartInstance.current.setOption(option, true);

    const handleResize = () => chartInstance.current?.resize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [groupedCells, option]);

  useEffect(() => {
    return () => {
      chartInstance.current?.dispose();
      chartInstance.current = null;
    };
  }, []);

  if (loading) {
    return (
      <div className="loading-state">
        <div className="spinner" />
        <p>加载数据中…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-state">
        <p>{error}</p>
        <button className="btn-ghost" onClick={() => navigate("/")}>
          返回上传
        </button>
      </div>
    );
  }

  return (
    <div className="result-page">
      <header className="result-topbar">
        <button className="btn-ghost" onClick={() => navigate("/")}>
          ← 返回
        </button>
        <div className="topbar-info">
          <h1>{name}</h1>
          <span className="badge">{cellCount.toLocaleString()} cells</span>
        </div>
        <div className="topbar-spacer" />
        <button className="btn-disabled" disabled title="功能开发中">
          修改注释
        </button>
      </header>

      <div className="result-body">
        <div className="chart-area" ref={chartRef} />

        <aside className="side-panel">
          <section className="panel-block">
            <h3 className="panel-label">数据集</h3>
            <div className="kv-row">
              <span className="kv-key">文件</span>
              <span className="kv-val">{name}</span>
            </div>
            <div className="kv-row">
              <span className="kv-key">细胞</span>
              <span className="kv-val">{cellCount.toLocaleString()}</span>
            </div>
            <div className="kv-row">
              <span className="kv-key">类型</span>
              <span className="kv-val">{cellTypes.length}</span>
            </div>
          </section>

          <section className="panel-block">
            <h3 className="panel-label">细胞类型</h3>
            <ul className="legend-list">
              {cellTypes.map((t) => (
                <li key={t.name}>
                  <span
                    className="legend-swatch"
                    style={{ background: t.color }}
                  />
                  <span className="legend-name">{t.name}</span>
                  <span className="legend-meta">
                    {t.count.toLocaleString()}
                    <span className="legend-pct">
                      {" "}
                      · {((t.count / cellCount) * 100).toFixed(1)}%
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="panel-block">
            <h3 className="panel-label">选中细胞</h3>
            {hoveredCell ? (
              <div className="cell-card">
                <div className="kv-row">
                  <span className="kv-key">ID</span>
                  <span className="kv-val">{hoveredCell.cell_id}</span>
                </div>
                <div className="kv-row">
                  <span className="kv-key">预测类型</span>
                  <span className="kv-val pill">
                    {hoveredCell.full_label}
                  </span>
                </div>
                <div className="kv-row">
                  <span className="kv-key">置信度</span>
                  <span className="kv-val">
                    {(hoveredCell.prob * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="kv-row">
                  <span className="kv-key">坐标</span>
                  <span className="kv-val mono">
                    {hoveredCell.x.toFixed(0)}, {hoveredCell.y.toFixed(0)}
                  </span>
                </div>
                <div className="kv-row">
                  <span className="kv-key">Top-2 候选</span>
                  <span className="kv-val">{hoveredCell.top2_label}</span>
                </div>
                <div className="kv-row">
                  <span className="kv-key">间隔</span>
                  <span className="kv-val">
                    {(hoveredCell.margin * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            ) : (
              <p className="panel-hint">
                鼠标悬停散点图中的细胞点
                <br />
                查看详细信息
              </p>
            )}
          </section>

          <section className="panel-block">
            <button className="btn-disabled btn-block" disabled>
              修改注释
            </button>
            <p className="panel-hint">功能开发中</p>
          </section>
        </aside>
      </div>
    </div>
  );
}
