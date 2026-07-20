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
    // 轨迹限定在示例园区围墙内（围墙约 ±150m(X) × ±120m(Y)），留 25~20m 余量
    const id = setInterval(() => {
      tRef.current += 0.03;
      const xm = 125 * Math.sin(0.7 * tRef.current);
      const ym = 100 * Math.sin(1.3 * tRef.current + Math.PI / 4);
      pushRobot(localToLonLat(xm, ym));
    }, 60);
    return () => clearInterval(id);
  }, [sweepOn, pushRobot]);
}
