const fs = require('fs');
const lines = fs.readFileSync('server.js', 'utf8').split('\n');
const newLines = lines.slice(0, 604);
newLines.push(
  '    console.error("AI Chat Error:", error);',
  '    res.status(500).json({ error: "Error communicating with AI service" });',
  '  }',
  '});',
  '',
  '// Health Check',
  "app.get('/', (req, res) => res.json({ message: '✅ TaskSync API is running!' }));",
  '',
  'const PORT = process.env.PORT || 5000;',
  'app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));'
);
fs.writeFileSync('server.js', newLines.join('\n'));
console.log('Fixed server.js');
