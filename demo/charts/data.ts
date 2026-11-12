export type ChartSample = 'normal' | 'zero' | 'empty'
export type ChartScene = 'activity' | 'orders'
export interface ActivityRow {
  date: string
  created: number
  completed: number
  paid: number
  refunded: number
}
/** Stable synthetic records: the graph, summaries and export all consume these rows. */
export function createActivityRows(
  days: number,
  step = 0,
  sample: ChartSample = 'normal',
): ActivityRow[] {
  if (sample === 'empty') return []
  return Array.from({ length: days }, (_, i) => {
    const n = i + step + 30 - days
    const created = 12 + ((n * 7 + 3) % 13)
    return {
      date: new Date(Date.UTC(2026, 10, 12 - days + 1 + i + step)).toISOString().slice(0, 10),
      created: sample === 'zero' ? 0 : created,
      completed: sample === 'zero' ? 0 : created - ((n * 3 + 1) % 7),
      paid: sample === 'zero' ? 0 : 6 + ((n * 5 + 2) % 17),
      refunded: sample === 'zero' ? 0 : n % 3,
    }
  })
}
export function chartSeries(scene: ChartScene) {
  return scene === 'activity'
    ? ([
        { key: 'created', name: '新增任务' },
        { key: 'completed', name: '完成任务' },
      ] as const)
    : ([
        { key: 'paid', name: '支付订单' },
        { key: 'refunded', name: '退款订单' },
      ] as const)
}
export function chartCsv(rows: ActivityRow[], scene: ChartScene) {
  const series = chartSeries(scene)
  return (
    '\uFEFF' +
    [
      ['日期', ...series.map((item) => item.name)],
      ...rows.map((row) => [row.date, ...series.map((item) => row[item.key])]),
    ]
      .map((row) => row.join(','))
      .join('\r\n')
  )
}
