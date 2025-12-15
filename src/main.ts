import { initAncilliaScene } from './ancillia-scene';
import { initDeviceDustDemo } from './ancillia-device-dust';

document.addEventListener('DOMContentLoaded', () => {
  const moduleContainer = document.getElementById('module-scene');
  const dustContainer = document.getElementById('dust-scene');
  const moduleTab = document.getElementById('tab-module');
  const dustTab = document.getElementById('tab-dust');

  if (!moduleContainer || !dustContainer || !moduleTab || !dustTab) return;

  if (!moduleContainer.dataset.initialized) {
    initAncilliaScene(moduleContainer);
    moduleContainer.dataset.initialized = 'true';
  }

  const ensureDustInitialized = () => {
    if (dustContainer.dataset.initialized) return;
    initDeviceDustDemo(dustContainer);
    dustContainer.dataset.initialized = 'true';
  };

  const showScene = (scene: 'module' | 'dust') => {
    const isModule = scene === 'module';
    if (!isModule) ensureDustInitialized();
    moduleContainer.classList.toggle('hidden', !isModule);
    dustContainer.classList.toggle('hidden', isModule);
    moduleTab.classList.toggle('active', isModule);
    dustTab.classList.toggle('active', !isModule);
  };

  moduleTab.addEventListener('click', () => showScene('module'));
  dustTab.addEventListener('click', () => showScene('dust'));

  // Ensure default view matches initial tab styling.
  showScene('module');
});
