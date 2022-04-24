const config = {
  port:3003,
  enableExpires:true,
  enableCacheControl:true,
  enableLastModified:true,
  enableETag:true,
  maxAge:600,
  ignore:['.','~']
}
const mimeTypes = {
  'css':'text/css',
  'txt':'text/plain',
  'js':'text/javascript',
  'html':'text/html',
  'jpg':'img/jpeg',
  'jpeg':'img/jpeg',
  'png':'img/png'
}
module.exports = {
  config,
  mimeTypes
}