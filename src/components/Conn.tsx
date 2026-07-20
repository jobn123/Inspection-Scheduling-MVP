import { useStore } from '../store/useStore';

export default function Conn() {
  const sweepOn = useStore((s) => s.sweepOn);
  return (
    <div id="conn">
      <span className={'dot' + (sweepOn ? ' on' : '')} />
      <span>{sweepOn ? '实时已连接（模拟）' : '实时未连接'}</span>
    </div>
  );
}
