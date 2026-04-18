const fs = require('fs');
const path = require('path');

const src = 'C:\\Users\\jessi\\.gemini\\antigravity\\brain\\09f7cc48-d78e-43b6-af36-05ae3bd1d927\\eunaman_forest_bg_1776552691127.png';
const dst = path.join(__dirname, '..', 'public', 'bg-eunaman.png');

try {
  fs.copyFileSync(src, dst);
  console.log('✅ Imagem copiada com sucesso para:', dst);
} catch (err) {
  console.error('❌ Erro ao copiar:', err.message);
}
