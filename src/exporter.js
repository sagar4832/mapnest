// ============================================================
// exporter.js — SVG serialization and download
// ============================================================

export function exportSVG(svgElement, filename = 'map') {
  const clone = svgElement.cloneNode(true);
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');

  const serializer = new XMLSerializer();
  const raw = serializer.serializeToString(clone);
  const svgStr = '<?xml version="1.0" encoding="UTF-8"?>\n' + raw;

  const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
  const url  = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename.replace(/[^a-z0-9_-]/gi, '-').toLowerCase() + '.svg';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 200);
}
