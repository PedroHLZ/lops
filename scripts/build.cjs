const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const files = ['index.html', 'css/style.css', 'css/section.css', 'css/media.css', 'js/script.js', ...new Set([...html.matchAll(/(?:src|href)="(img\/[^"?#]+)"/g)].map(m => m[1]))];
for (const file of files) {
 if (!fs.existsSync(path.join(root, file))) throw new Error('Arquivo ausente: ' + file);
 const target = path.join(root, 'dist', file);
 fs.mkdirSync(path.dirname(target), {recursive:true});
 fs.copyFileSync(path.join(root, file), target);
}
console.log('Site preparado: ' + files.length + ' arquivos públicos.');
