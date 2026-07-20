import MapView from './components/MapView';
import Toolbar from './components/Toolbar';
import SidePanel from './components/SidePanel';
import ScenePanel from './components/ScenePanel';
import Orchestrator from './components/Orchestrator';
import ScheduleView from './components/ScheduleView';
import Conn from './components/Conn';
import { useRobotSweep } from './hooks/useRobotSweep';
import { useStore } from './store/useStore';

export default function App() {
  useRobotSweep();
  const view = useStore((s) => s.view);
  if (view === 'flow') {
    return (
      <>
        <Orchestrator />
      </>
    );
  }
  if (view === 'schedule') {
    return (
      <>
        <ScheduleView />
      </>
    );
  }
  return (
    <>
      <MapView />
      <Toolbar />
      <ScenePanel />
      <SidePanel />
      <Conn />
    </>
  );
}
