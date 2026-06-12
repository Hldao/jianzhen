// 轻量提示音：倒计时催促「嘀」与归零长鸣
// InnerAudioContext 复用单例，避免每次 new 的创建开销与首播延迟。
// 音频由 assets/sound/_gen_beep.js 生成（纯 WAV，无第三方依赖）。
// 注意：默认遵循系统静音开关，静音时不响——震动作为始终在线的第二通道。
let _beep = null
let _end = null

function _ctx(src) {
  const a = wx.createInnerAudioContext()
  a.src = src
  return a
}

function _play(ctx) {
  if (!ctx) return
  // 短提示音间隔 ≥1s、播完即止，直接 play() 即可从头重放
  try { ctx.play() } catch (e) {}
}

module.exports = {
  // 训练页 onLoad 调用，预热单例，首次催促无延迟
  preload() {
    if (!_beep) _beep = _ctx('/assets/sound/beep.wav')
    if (!_end)  _end  = _ctx('/assets/sound/beep_end.wav')
  },
  beep() { this.preload(); _play(_beep) },
  end()  { this.preload(); _play(_end) },
  dispose() {
    if (_beep) { _beep.destroy(); _beep = null }
    if (_end)  { _end.destroy();  _end = null }
  },
}
