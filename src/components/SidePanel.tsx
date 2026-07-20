import { useStore } from '../store/useStore';

export default function SidePanel() {
  const points = useStore((s) => s.points);
  const zones = useStore((s) => s.zones);
  const setFlyTo = useStore((s) => s.setFlyTo);

  const inspectionCount = points.filter((p) => p.kind === 'inspection').length;
  const chargingCount = points.filter((p) => p.kind === 'charging').length;

  const items = [...points, ...zones];

  let clock = 8 * 60; // 从 08:00 起排

  return (
    <div id="panel">
      <div className="stat">
        巡检点 {inspectionCount} · 充电点 {chargingCount} · 禁区 {zones.length}
      </div>

      <div className="section">
        <div className="section-title">要素列表（点击飞行定位）</div>
        <div className="list">
          {items.map((it) => {
            const isPoint = 'kind' in it;
            const kind = isPoint ? (it as any).kind : 'noGo';
            const tagText = kind === 'charging' ? '充电' : kind === 'inspection' ? '巡检' : '禁区';
            const lon = isPoint ? (it as any).lon : (it as any).positions[0][0];
            const lat = isPoint ? (it as any).lat : (it as any).positions[0][1];
            return (
              <div key={it.id} className="row" onClick={() => setFlyTo([lon, lat])}>
                <span className={'tag ' + kind}>{tagText}</span> {it.name}
                <span className="meta">
                  {lon.toFixed(4)},{lat.toFixed(4)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="section">
        <div className="section-title">任务计划表（示例）</div>
        <table id="taskTable">
          <thead>
            <tr>
              <th>任务</th>
              <th>类型</th>
              <th>计划时间</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => {
              const hh = String(Math.floor(clock / 60)).padStart(2, '0');
              const mm = String(clock % 60).padStart(2, '0');
              clock += 25;
              return (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td>{p.kind === 'charging' ? '充电' : '巡检'}</td>
                  <td>{hh}:{mm}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="hint" id="hint">
        提示：选择工具后在地球上操作。禁区：左键加点（≥3 点），点工具栏「完成禁区」或右键完成；未点时直接点别的按钮即取消，已画的点会自动落成一个禁区。
      </div>
    </div>
  );
}
