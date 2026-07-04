import { useEffect, useState, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import * as echarts from "echarts";
import type { EChartsOption } from "echarts";
import { fetchCells, type Cell, type CellType } from "../api";

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
        setCellTypes(data.cell_types);

        // 按 label 分组
        const groups: Record<string, Cell[]> = {};
        for (const c of data.cells) {
          if (!groups[c.label]) groups[c.label] = [];
          groups[c.label].push(c);
        }
        setGroupedCells(groups);
        setLoading(false);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "加载失败");
        setLoading(false);
      });
  }, [id]);

  // 颜色映射
  const colorMap = useMemo(() => {
    const map: Record<string, string> = {};
    cellTypes.forEach((t) => { map[t.name] = t.color; });
    return map;
  }, [cellTypes]);

  // ECharts 配置
  const option: EChartsOption = useMemo(() => {
    if (Object.keys(groupedCells).length === 0) return {};

    const series = Object.entries(groupedCells).map(([label, cells]) => ({
      name: label,
      type: "scatter" as const,
      data: cells.map((c) => [c.x, c.y, c.cell_id, c.full_label, c.prob, c.top2_label, c.top2_prob, c.margin]),
      symbolSize: 3,
      itemStyle: { color: colorMap[label] || "#999" },
      emphasis: { itemStyle: { borderColor: "#000", borderWidth: 1 } },
    }));

    return {
      tooltip: {
        trigger: "item" as const,
        formatter: (params: unknown) => {
          const p = params as unknown as { data: number[]; seriesName: string };
          return `
            <b>${p.seriesName}</b><br/>
            细胞 ID: ${p.data[2]}<br/>
            置信度: ${(p.data[4] as number * 100).toFixed(1)}%<br/>
            Top2: ${p.data[5]} (${(p.data[6] as number * 100).toFixed(1)}%)
          `.trim();
        },
      },
      legend: {
        bottom: 10,
        type: "scroll" as const,
        textStyle: { fontSize: 11 },
      },
      grid: { left: 20, right: 20, top: 20, bottom: 60 },
      xAxis: {
        type: "value" as const,
        show: false,
        min: (v: { min: number }) => v.min - 50,
        max: (v: { max: number }) => v.max + 50,
      },
      yAxis: {
        type: "value" as const,
        show: false,
        min: (v: { min: number }) => v.min - 50,
        max: (v: { max: number }) => v.max + 50,
      },
      dataZoom: [
        { type: "inside" as const },
        { type: "slider" as const, bottom: 40 },
      ],
      series,
    };
  }, [groupedCells, colorMap]);

  // ECharts 初始化与更新
  useEffect(() => {
    if (!chartRef.current || Object.keys(groupedCells).length === 0) return;

    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current);
    }

    // 绑定悬停事件
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

    chartInstance.current.setOption(option);

    const handleResize = () => chartInstance.current?.resize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [groupedCells, option]);

  // 清理图表实例
  useEffect(() => {
    return () => {
      chartInstance.current?.dispose();
      chartInstance.current = null;
    };
  }, []);

  if (loading) {
    return <div className="loading">加载中...</div>;
  }

  if (error) {
    return (
      <div className="error-page">
        <p>❌ {error}</p>
        <button onClick={() => navigate("/")}>返回上传页</button>
      </div>
    );
  }

  return (
    <div className="result-page">
      {/* 顶部栏 */}
      <header className="result-header">
        <button className="btn-back" onClick={() => navigate("/")}>← 返回</button>
        <h1>📊 {name}</h1>
        <span className="cell-count">{cellCount.toLocaleString()} 个细胞</span>
        <button className="btn-modify" disabled title="功能开发中">
          ✏️ 修改注释
        </button>
      </header>

      <div className="result-body">
        {/* 左侧：散点图 */}
        <div className="chart-area" ref={chartRef} />

        {/* 右侧：信息面板 */}
        <aside className="info-panel">
          {/* 数据集概览 */}
          <section className="panel-section">
            <h3>📋 数据集概览</h3>
            <div className="stat-row">
              <span>文件名</span>
              <span className="stat-value">{name}</span>
            </div>
            <div className="stat-row">
              <span>总细胞数</span>
              <span className="stat-value">{cellCount.toLocaleString()}</span>
            </div>
            <div className="stat-row">
              <span>细胞类型</span>
              <span className="stat-value">{cellTypes.length} 种</span>
            </div>
          </section>

          {/* 图例 */}
          <section className="panel-section">
            <h3>🎨 细胞类型</h3>
            <ul className="legend-list">
              {cellTypes.map((t) => (
                <li key={t.name}>
                  <span className="legend-dot" style={{ background: t.color }} />
                  <span className="legend-name">{t.name}</span>
                  <span className="legend-count">{t.count.toLocaleString()}</span>
                  <span className="legend-pct">
                    {((t.count / cellCount) * 100).toFixed(1)}%
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {/* 选中细胞详情 */}
          <section className="panel-section">
            <h3>🔍 选中细胞</h3>
            {hoveredCell ? (
              <div className="cell-detail">
                <div className="detail-row">
                  <span>Cell ID</span>
                  <span>{hoveredCell.cell_id}</span>
                </div>
                <div className="detail-row">
                  <span>AI 预测</span>
                  <span className="label-tag">{hoveredCell.full_label}</span>
                </div>
                <div className="detail-row">
                  <span>置信度</span>
                  <span>{(hoveredCell.prob * 100).toFixed(1)}%</span>
                </div>
                <div className="detail-row">
                  <span>坐标</span>
                  <span>
                    {hoveredCell.x.toFixed(0)}, {hoveredCell.y.toFixed(0)}
                  </span>
                </div>
                <div className="detail-row">
                  <span>Top2 候选</span>
                  <span>{hoveredCell.top2_label}</span>
                </div>
                <div className="detail-row">
                  <span>置信度间隔</span>
                  <span>{(hoveredCell.margin * 100).toFixed(1)}%</span>
                </div>
              </div>
            ) : (
              <p className="hint-text">鼠标悬停散点图中的细胞点查看详情</p>
            )}
          </section>

          {/* 操作区 */}
          <section className="panel-section">
            <button className="btn-modify-full" disabled title="功能开发中">
              ✏️ 修改注释
            </button>
            <p className="hint-text">此功能将在后续版本中开放</p>
          </section>
        </aside>
      </div>
    </div>
  );
}
