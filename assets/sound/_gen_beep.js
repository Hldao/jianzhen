// 生成倒计时提示音（无第三方依赖，纯 Node fs/Buffer 写 WAV）
// beep.wav     —— 短「嘀」：剩10秒 / 最后5秒每秒催促
// beep_end.wav —— 长鸣「嘀——」：归零
// 与 _gen_beep.py 等价（python 在本机不可用，改用 node）
const fs = require('fs')
const path = require('path')

const SR = 16000

function writeWav(file, freq, dur, gain = 0.6) {
  const n = Math.floor(SR * dur)
  const fade = Math.floor(SR * 0.006) // 6ms 淡入淡出去爆音
  const data = Buffer.alloc(n * 2)
  for (let i = 0; i < n; i++) {
    const s = Math.sin(2 * Math.PI * freq * (i / SR))
    let env = 1.0
    if (i < fade) env = i / fade
    else if (i > n - fade) env = Math.max(0, (n - i) / fade)
    let val = Math.round(Math.max(-1, Math.min(1, s * gain * env)) * 32767)
    data.writeInt16LE(val, i * 2)
  }
  const byteRate = SR * 2
  const header = Buffer.alloc(44)
  header.write('RIFF', 0)
  header.writeUInt32LE(36 + data.length, 4)
  header.write('WAVE', 8)
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16)      // PCM fmt chunk size
  header.writeUInt16LE(1, 20)       // PCM
  header.writeUInt16LE(1, 22)       // mono
  header.writeUInt32LE(SR, 24)
  header.writeUInt32LE(byteRate, 28)
  header.writeUInt16LE(2, 32)       // block align
  header.writeUInt16LE(16, 34)      // bits per sample
  header.write('data', 36)
  header.writeUInt32LE(data.length, 40)
  fs.writeFileSync(path.join(__dirname, file), Buffer.concat([header, data]))
}

writeWav('beep.wav', 880, 0.12)     // 短嘀
writeWav('beep_end.wav', 660, 0.55) // 长鸣
console.log('OK')
