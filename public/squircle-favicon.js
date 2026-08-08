const canvas = document.createElement('canvas');
canvas.width = 64;
canvas.height = 64;
const ctx = canvas.getContext('2d');

// Draw squircle rounded rectangle shape (ChatGPT style icon background)
const radius = 15;
ctx.beginPath();
ctx.moveTo(radius, 0);
ctx.lineTo(64 - radius, 0);
ctx.quadraticCurveTo(64, 0, 64, radius);
ctx.lineTo(64, 64 - radius);
ctx.quadraticCurveTo(64, 64, 64 - radius, 64);
ctx.lineTo(radius, 64);
ctx.quadraticCurveTo(0, 64, 0, 64 - radius);
ctx.lineTo(0, radius);
ctx.quadraticCurveTo(0, 0, radius, 0);
ctx.closePath();
ctx.clip();

const img = new Image();
img.src = 'savewave-light.png';
img.onload = () => {
  ctx.drawImage(img, 0, 0, 64, 64);
  const link = document.querySelector("link[rel*='icon']") || document.createElement('link');
  link.type = 'image/png';
  link.rel = 'shortcut icon';
  link.href = canvas.toDataURL('image/png');
  document.getElementsByTagName('head')[0].appendChild(link);
};
