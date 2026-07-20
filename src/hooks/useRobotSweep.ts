import { useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { localToLonLat } from '../utils/geo';

// 模拟实时扫图：伪 WebSocket 周期性推送机器人位姿（覆盖路径 + 轨迹累积）
export function useRobotSweep() {
  const sweepOn = useStore((s) => s.sweepOn);
  const pushRobot = useStore((s) => s.pushRobot);
  const tRef = useRef(0);

  useEffect(() => {
    if (!sweepOn) return;
    const id = setInterval(() => {
      tRef.current += 0.03;
      const xm = 300 * Math.sin(0.7 * tRef.current);
      const ym = 220 * Math.sin(1.3 * tRef.current + Math.PI / 4);
      pushRobot(localToLonLat(xm, ym));
    }, 60);
    return () => clearInterval(id);
  }, [sweepOn, pushRobot]);
}
