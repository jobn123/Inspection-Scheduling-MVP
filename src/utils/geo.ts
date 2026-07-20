// 演示中心（深圳某园区）
export const ORIGIN = { lon: 114.06, lat: 22.54 };

// 局部坐标(米) -> WGS84（演示用等距近似）
// 生产环境应使用 Cesium.Transforms.headingPitchRollToFixedFrame / 局部 ENU 对齐机器人坐标系
export function localToLonLat(xm: number, ym: number): [number, number] {
  const lat = ORIGIN.lat + ym / 111320;
  const lon = ORIGIN.lon + xm / (111320 * Math.cos((ORIGIN.lat * Math.PI) / 180));
  return [lon, lat];
}
