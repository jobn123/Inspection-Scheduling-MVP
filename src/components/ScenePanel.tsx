import { useRef, useState, type ChangeEvent } from 'react';
import { useStore } from '../store/useStore';
import { ORIGIN } from '../utils/geo';

export default function ScenePanel() {
  const scenes = useStore((s) => s.scenes);
  const addScene = useStore((s) => s.addScene);
  const removeScene = useStore((s) => s.removeScene);
  const flyTo = useStore((s) => s.setFlyTo);
  const setLocateSample = useStore((s) => s.setLocateSample);
  const hasSample = scenes.some((s) => s.type === 'sample');

  const [tilesUrl, setTilesUrl] = useState('');
  const [modelUrl, setModelUrl] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    const ext = f.name.split('.').pop()?.toLowerCase() ?? '';
    const type = ext === 'json' ? 'tiles' : 'model';
    addScene({ name: f.name, type, url, ext });
    e.target.value = '';
  };

  const typeLabel = (t: string) => (t === 'sample' ? '示例' : t === 'tiles' ? 'Tiles' : '模型');

  return (
    <div id="scenePanel">
      <div className="section-title">场景加载（数字孪生）</div>

      <button
        className="btn block"
        onClick={() => {
          if (hasSample) {
            setLocateSample(true);
          } else {
            addScene({ name: '示例园区', type: 'sample' });
          }
        }}
      >
        {hasSample ? '⌖ 定位到示例园区' : '＋ 加载示例场景'}
      </button>

      <div className="field">
        <input
          placeholder="3D Tiles URL (tileset.json)"
          value={tilesUrl}
          onChange={(e) => setTilesUrl(e.target.value)}
        />
        <button
          className="btn sm"
          onClick={() => {
            if (tilesUrl) {
              addScene({ name: 'Tiles 场景', type: 'tiles', url: tilesUrl });
              setTilesUrl('');
            }
          }}
        >
          加载
        </button>
      </div>

      <div className="field">
        <input
          placeholder="glTF / glb 模型 URL"
          value={modelUrl}
          onChange={(e) => setModelUrl(e.target.value)}
        />
        <button
          className="btn sm"
          onClick={() => {
            if (modelUrl) {
              addScene({ name: '模型', type: 'model', url: modelUrl });
              setModelUrl('');
            }
          }}
        >
          加载
        </button>
      </div>

      <div className="field">
        <button className="btn sm" onClick={() => fileRef.current?.click()}>
          选择本地文件 (.glb / .gltf / .json)
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".glb,.gltf,.json"
          style={{ display: 'none' }}
          onChange={onFile}
        />
      </div>

      <div className="section-title" style={{ marginTop: 10 }}>
        已加载场景
      </div>
      <div className="list">
        {scenes.length === 0 && <div className="row muted">暂无，点击上方加载</div>}
        {scenes.map((s) => (
          <div key={s.id} className="row" onClick={() => removeScene(s.id)} title="点击移除">
            <span className={'tag scene'}>{typeLabel(s.type)}</span> {s.name}
            <span className="rm">✕</span>
          </div>
        ))}
      </div>
    </div>
  );
}
