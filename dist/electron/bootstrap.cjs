// CommonJS bootstrap for Electron to load ESM main
const path = require('path');

(async () => {
  const mainPath = path.join(__dirname, 'main.js');
  await import(pathToFileURL(mainPath).href);
})();

function pathToFileURL(p) {
  const isWin = process.platform === 'win32';
  let pathName = p.replace(/\\/g, '/');
  if (!pathName.startsWith('/')) {
    pathName = '/' + pathName;
  }
  return new URL('file://' + (isWin ? pathName.replace(/^\//, '/') : pathName));
}
