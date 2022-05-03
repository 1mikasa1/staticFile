const http = require('http')
const fs = require('fs')
const { config, mimeTypes } = require('./config')
const path = require('path')
class StaticServer {
  constructor() {
    this.port = config.port
    this.enableExpires = config.enableExpires
    this.enableCacheControl = config.enableCacheControl
    this.enableETag = config.enableETag
    this.enableLastModified = config.enableLastModified
    this.maxAge = config.maxAge
  }
  static getType(path) {
    return mimeTypes[path.split('.')[1]]
  }
  resErr(err, res) {
    res.writeHead(500)
    res.end(err)
  }
  notFound(req, res) {
    res.writeHead(404, {
      'Content-Type':'text/html;charset=UTF-8'
    })
    res.end('文件未找到')
  }
  renderDir(pathname, req, res) {
    fs.readdir(pathname, (err, files) => {
      if(err) {
        this.resErr(err, res)
      }else {
        let content = `<h1>当前位于${pathname}目录中</h1>`
        files.forEach(file => {
          if(!config.ignore.includes(file.charAt(0))) {
            const link = path.join(pathname, file)
            content += `<p><a href='${link}'>${file}</a></p>`
          }
        })
        res.writeHead(200, {
          'Content-Type':'text/html;charset=UTF-8',
        })
        res.end(content)
      }
    })
  }
  renderFile(path, req, res) {
    let readStream
    res.writeHead(200, {
      'Content-type':`${StaticServer.getType(path)};charset=UTF-8`,
      // 标识自身支持范围请求，当浏览器发现了该响应头以后，会尝试进行中断了的下载，而不是重新开始
      'Accept-Ranges': 'bytes'
    })
    // 告知服务器返回文件的哪一部分
    if(req.headers['range']) {
      readStream = this.rangeHandler(path, req.headers['range'], stat.size, res)
    }else {
      readStream = fs.createReadStream(path)
    }
    //  res 是一个可写流对象
    readStream.pipe(res)
  }
  rangeHandler(path, rangeText, totalSize, res) {
    const { start, end } = this.getRange(rangeText)
    if(start > totalSize || end>totalSize || start>end) {
      res.statusCode = 416
      // 显示当前数据片段在文件中的位置
      res.setHeader('Content-Range', `bytes */${totalSize}`)
    }else {
      res.statusCode = 206
      res.setHeader('Content-Range', `bytes */${start}-${end}/${totalSize}`)
      return fs.createReadStream(path, { start,end})
    }
  }
  getRange(rangeText) {
    const rangeRes = rangeText.match(/bytes=([0-9]*)-([0-9]*)/)
    let start = rangeRes[1]
    let end = rangeRes[2]
    if(isNaN(start) && !isNaN(end)) {
      start = totalSize-end
      end=totalSize-1
    }else if(isNaN(end) && !isNaN(start)) {
      end = totalSize-1
    }
    return {
      start,end
    }
  }
  render(path, req, res) {
    fs.stat(path, (err, stat) => {
      if(err) return this.resErr(err, res)
      this.setHeaders(stat, res)
      // 协商缓存判断 注：强缓存由浏览器来判断，如果强缓存命中请求都不会走到服务器
      if(this.isFresh(req.headers, res._headers)) {
        this.resNotModified(res)
      }else {
        this.renderFile(path, req, res)
      }
    })
  }
  isFresh(reqHeader, resHeader) {
    console.log(resHeader)
    const ETag = reqHeader['if-none-match']
    const LastModified = reqHeader['if-modified-since']
    if(!(ETag || LastModified)) return false
    if(ETag === resHeader['etag']) {
      return true
    }else if(LastModified === resHeader['last-modified']) {
      return true
    }
    return false
  }
  resNotModified(res) {
    res.statusCode = 304
    res.end()
  }
  setHeaders(stat, res) {
    if(this.enableCacheControl) {
      res.setHeader('Cache-Control',`public, max-age=${this.maxAge}`)
    }
    if(this.enableExpires) {
      res.setHeader('Expires',new Date(Date.now() + this.maxAge*1000).toUTCString())
    }
    if(this.enableETag) {
      res.setHeader('ETag', this.getETag(stat))
    }
    if(this.enableLastModified) {
      res.setHeader('Last-Modified', stat.mtime.toUTCString())
    }
  }
  getETag(stat) {
    const mtime = stat.mtime.toUTCString(16)
    const size = stat.size.toString(16)
    // if-not-match可能会包含w/,来提示使用的是弱比较算法。弱比较算法：即文件内容一样或字节数一样都可以判断为相同
    return `W/"${size}-${mtime}"`
  }
  pathHandle(path, req, res) {
    fs.stat(path,(err, stats) => {
      if(!err) {
        if(stats.isDirectory()) {
          this.renderDir(path,req,res)
        }else if(stats.isFile()) {
          this.render(path, req, res)
        }
      }else {
        this.notFound(req, res)
      }
    })
  }
  start() {
    http.createServer((req, res) => {
      // 解决中文乱码问题
      const pathname = decodeURI(req.url)
      this.pathHandle(pathname, req, res)
    }).listen(this.port, () => {
      console.log(`文件系统已经开启在${this.port}端口`)
    })
  }
}

module.exports = StaticServer