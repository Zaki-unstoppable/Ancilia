import { initAncilliaScene } from './ancillia-scene';

document.addEventListener('DOMContentLoaded', () => {
  const app = document.getElementById('app');
  if (!app) return;
  initAncilliaScene(app);
});
