import { useStore, type Mode } from '../store/useStore';

const BUTTONS: { mode: Mode; label: string }[] = [
  { mode: 'inspection', label: '+ 巡检点' },
  { mode: 'charging', label: '+ 充电点' },
  { mode: 'noGo', label: '▱ 禁区' },
  { mode: 'select', label: '⌖ 选择/定位' },
];

export default function Toolbar() {
  const mode = useStore((s) => s.mode);
  const setMode = useStore((s) => s.setMode);
  const sweepOn = useStore((s) => s.sweepOn);
  const setSweep = useStore((s) => s.setSweep);
  const clearAll = useStore((s) => s.clearAll);
  const setView = useStore((s) => s.setView);
  const baseMap = useStore((s) => s.baseMap);
  const setBaseMap = useStore((s) => s.setBaseMap);
  const setFinishNoGo = useStore((s) => s.setFinishNoGo);
  const osmBuildings = useStore((s) => s.osmBuildings);
  const setOsmBuildings = useStore((s) => s.setOsmBuildings);

  return (
    <div id="toolbar">
      <div className="tb-title">巡检调度 MVP</div>
      {BUTTONS.map((b) => (
        <button
          key={b.mode}
          className={'tool' + (mode === b.mode ? ' active' : '')}
          onClick={() => setMode(mode === b.mode ? 'select' : b.mode)}
          title={mode === b.mode ? '点击取消当前工具' : ''}
        >
          {b.label}
        </button>
      ))}
      <button className="tool accent" onClick={() => setSweep(!sweepOn)}>
        {sweepOn ? '⏸ 停止扫图' : '▶ 实时扫图'}
      </button>
      <button className="tool danger" onClick={clearAll}>
        清除全部
      </button>
      <span className="tb-sep" />
      <button className={'tool' + (osmBuildings ? ' active' : '')} onClick={() => setOsmBuildings(!osmBuildings)} title="加载 Cesium OSM Buildings 全球 3D 建筑（需 Ion token）">
        3D 建筑
      </button>
      <span className="tb-sep" />
      <span className="tb-sub">底图</span>
      <button className={'tool' + (baseMap === 'amapVec' ? ' active' : '')} onClick={() => setBaseMap('amapVec')}>
        高德矢量
      </button>
      <button className={'tool' + (baseMap === 'amapSat' ? ' active' : '')} onClick={() => setBaseMap('amapSat')}>
        高德卫星
      </button>
      <span className="tb-sep" />
      <button className="tool" onClick={() => setView('flow')}>
        任务编排
      </button>
      <button className="tool" onClick={() => setView('schedule')}>
        任务计划表
      </button>
      {mode === 'noGo' && (
        <button className="tool accent" onClick={() => setFinishNoGo(true)} title="把已画的禁区提交到地图">
          完成禁区
        </button>
      )}
    </div>
  );
}
