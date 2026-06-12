# 生成倒计时提示音（无第三方依赖，纯标准库 wave）
# beep.wav     —— 短「嘀」：剩10秒 / 最后5秒每秒催促
# beep_end.wav —— 长鸣「嘀——」：归零
import wave, math, struct

SR = 16000

def write_wav(path, freq, dur, gain=0.6):
    frames = bytearray()
    n = int(SR * dur)
    fade = int(SR * 0.006)  # 6ms 淡入淡出去爆音
    for i in range(n):
        s = math.sin(2 * math.pi * freq * (i / SR))
        env = 1.0
        if i < fade:
            env = i / fade
        elif i > n - fade:
            env = max(0.0, (n - i) / fade)
        val = int(max(-1.0, min(1.0, s * gain * env)) * 32767)
        frames += struct.pack('<h', val)
    with wave.open(path, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(bytes(frames))

write_wav('beep.wav', 880, 0.12)      # 短嘀
write_wav('beep_end.wav', 660, 0.55)  # 长鸣
print('OK')
