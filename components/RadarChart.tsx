'use client';

import { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { Badge } from './ui/badge';
import type { RadarChartData, DimensionScore } from '@/store/resumeAnalysisStore';

interface RadarChartProps {
  data: RadarChartData | null;
  dimensionScores: DimensionScore[];
}

const LEVEL_LABELS: Record<string, string> = {
  JUNIOR: '初级',
  MID: '中级',
  SENIOR: '高级',
  EXPERT: '专家',
};

const LEVEL_COLORS: Record<string, string> = {
  JUNIOR: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  MID: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
  SENIOR: 'bg-primary/10 text-primary',
  EXPERT: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
};

export function RadarChart({ data, dimensionScores }: RadarChartProps) {
  const chartOption = useMemo(() => {
    if (!data) {
      const dimensions: DimensionScore[] = dimensionScores.length > 0 ? dimensionScores : [
        { name: '技能', key: 'skill', score: 0, comment: '' },
        { name: '经验', key: 'exp', score: 0, comment: '' },
        { name: '背景', key: 'bg', score: 0, comment: '' },
        { name: '潜力', key: 'potential', score: 0, comment: '' },
      ];
      return buildOption(dimensions);
    }
    return buildOption(data.dimensions);
  }, [data, dimensionScores]);

  const overallLevel = data?.overallLevel;
  const overallScore = data?.overallScore;

  return (
    <div className="overflow-hidden rounded-2xl border border-border/70 bg-card/90 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/50 bg-gradient-to-r from-primary/[0.04] to-transparent px-5 py-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.12em] text-primary/70">Analysis</p>
          <h3 className="text-base font-semibold text-foreground">综合评分</h3>
        </div>
        {overallLevel && (
          <Badge
            variant="secondary"
            className={`rounded-full text-xs font-medium ${LEVEL_COLORS[overallLevel] || ''}`}
          >
            {LEVEL_LABELS[overallLevel] || overallLevel}
          </Badge>
        )}
      </div>

      {/* Chart */}
      <div className="px-5 py-4">
        <div className="flex justify-center">
          <ReactECharts
            option={chartOption}
            style={{ width: '100%', height: 280 }}
            opts={{ renderer: 'svg' }}
          />
        </div>

        {/* Score display */}
        {overallScore !== undefined && (
          <div className="mt-2 flex items-center justify-center gap-2">
            <span className="text-3xl font-bold text-primary">
              {overallScore}
            </span>
            <span className="text-sm text-muted-foreground">分</span>
          </div>
        )}
      </div>
    </div>
  );
}

function buildOption(dimensions: DimensionScore[]) {
  const indicators = dimensions.map((d) => ({
    name: d.name,
    max: 100,
  }));

  const values = dimensions.map((d) => d.score);

  return {
    radar: {
      indicator: indicators,
      shape: 'polygon',
      splitNumber: 5,
      axisName: {
        color: '#64748B',
        fontSize: 12,
        fontWeight: 500,
      },
      splitLine: {
        lineStyle: {
          color: '#E2E8F0',
        },
      },
      splitArea: {
        areaStyle: {
          color: ['rgba(8, 145, 178, 0.03)', 'rgba(8, 145, 178, 0.06)'],
        },
      },
      axisLine: {
        lineStyle: {
          color: '#E2E8F0',
        },
      },
    },
    series: [
      {
        type: 'radar',
        data: [
          {
            value: values,
            name: '评分',
            areaStyle: {
              color: 'rgba(8, 145, 178, 0.15)',
            },
            lineStyle: {
              color: '#0891B2',
              width: 2,
            },
            itemStyle: {
              color: '#0891B2',
              borderColor: '#fff',
              borderWidth: 2,
            },
            symbol: 'circle',
            symbolSize: 6,
          },
        ],
      },
    ],
  };
}