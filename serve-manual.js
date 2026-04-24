const http = require('http')
const fs = require('fs')
http.createServer((req, res) => {
  const file = 'C:/claude/coinbot/public/tester-manual.html'
  try {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(fs.readFileSync(file))
  } catch (e) {
    res.writeHead(404)
    res.end('not found')
  }
}).listen(4567, () => console.log('ready on 4567'))
