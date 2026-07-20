import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { useStore } from './store/useStore';
import './index.css';

const container = document.getElementById('root');
if (!container) throw new Error('root not found');
createRoot(container).render(<App />);

// 仅开发模式暴露 store，便于自动化验证（生产不污染全局）
if (import.meta.env.DEV) (window as any).__store = useStore;
