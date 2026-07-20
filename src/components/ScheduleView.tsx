import { useMemo } from 'react';
import { useStore } from '../store/useStore';
import { buildSequence, buildSchedule, type SchedTask } from '../utils/flow';

const KIND_COLOR: Record<string, string> = {
  start: '#4fd99a',
  point: '#36c5f0',
  action: '#f5a623',
  end: '#ef476f',
};

function barColor(t: SchedTask): string {
  if (t.move) return '#6b7785';
  if (t.kind === 'point') return t.pointKind === 'charging' ? '#f5a623' : '#36c5f0';
  return KIND_COLOR[t.kind] || '#36c5f0';
}

function typeLabel(t: SchedTask): string {
  if (t.move) return '';
  if (t.kind === 'end') return '回库';
  if (t.kind === 'action') return '采集';
  return t.pointKind === 'charging' ? '充电' : '巡检';
}

export default function ScheduleView() {
  const points = useStore((s) => s.points);
  const flowNodes = useStore((s) => s.flowNodes);
  const flowEdges = useStore((s) => s.flowEdges);
  const robotCount = useStore((s) => s.robotCount);
  const setRobotCount = useStore((s) => s.setRobotCount);
  const setView = useStore((s) => s.setView);

  const sched = useMemo(() => {
    const seq = buildSequence(flowNodes, flowEdges, points);
    return buildSchedule(seq, robotCount);
  }, [flowNodes, flowEdges, points, robotCount]);

  const total = sched.totalMin;
  const ticks: number[] = [];
  for (let m = 0; m <= total; m += 30) ticks.push(m);
  const robots = Array.from({ length: sched.robotCount }, (_, i) => i + 1);
  const detail = sched.tasks.filter((t) => !t.move);

  return (
    <div id="sched">
      <div className="sched-head">
        <button className="btn sm" onClick={() => setView('map')}>
          ← 返回地图
        </button>
        <button className="btn sm" onClick={() => setView('flow')}>
          ← 任务编排
        </button>
        <span className="sched-title">任务计划表（甘特排程）</span>
        <span className="sched-robot">机器人</span>
        {[1, 2, 3].map((n) => (
          <button
            key={n}
            className={'btn sm' + (robotCount === n ? ' active' : '')}
            onClick={() => setRobotCount(n)}
          >
            {n} 台
          </button>
        ))}
      </div>

      <div className="sched-body">
        <div className="gantt">
          <div className="gantt-axis">
            <div className="gantt-axis-label">机器人 / 时间(min)</div>
            <div className="gantt-axis-track">
              {ticks.map((m) => (
                <div key={m} className="tick" style={{ left: (m / total) * 100 + '%' }}>
                  {m}
                </div>
              ))}
            </div>
          </div>
          {robots.map((r) => (
            <div key={r} className="gantt-row">
              <div className="gantt-row-label">机器人 {r}</div>
              <div className="gantt-row-track">
                {ticks.map((m) => (
                  <div key={m} className="grid" style={{ left: (m / total) * 100 + '%' }} />
                ))}
                {sched.tasks
                  .filter((t) => t.robot === r)
                  .map((t) => (
                    <div
                      key={t.id}
                      className={'bar' + (t.move ? ' move' : '')}
                      style={{
                        left: (t.startMin / total) * 100 + '%',
                        width: ((t.endMin - t.startMin) / total) * 100 + '%',
                        background: barColor(t),
                      }}
                      title={`${t.label}  ${t.startMin}-${t.endMin}min`}
                    >
                      {!t.move && <span className="bar-label">{t.label}</span>}
                    </div>
                  ))}
              </div>
            </div>
          ))}
          {robots.length === 0 && <div className="row muted">无排程</div>}
        </div>

        <div className="sched-table">
          <div className="section-title">任务明细</div>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>任务</th>
                <th>类型</th>
                <th>起(min)</th>
                <th>止(min)</th>
                <th>时长</th>
                <th>机器人</th>
              </tr>
            </thead>
            <tbody>
              {detail.map((t, i) => (
                <tr key={t.id}>
                  <td>{i + 1}</td>
                  <td>{t.label}</td>
                  <td>{typeLabel(t)}</td>
                  <td>{t.startMin}</td>
                  <td>{t.endMin}</td>
                  <td>{t.endMin - t.startMin}</td>
                  <td>R{t.robot}</td>
                </tr>
              ))}
              {detail.length === 0 && (
                <tr>
                  <td colSpan={7} className="muted">
                    先在「任务编排」连线生成任务序列
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
