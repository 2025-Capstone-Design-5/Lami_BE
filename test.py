import sounddevice as sd
import numpy as np
import queue
from faster_whisper import WhisperModel
import requests
from gtts import gTTS
import os
import time

# 설정
SAMPLE_RATE = 16000
BLOCK_SIZE = 1024
BUFFER_DURATION = 5  # 초
OLLAMA_URL = "http://localhost:11434/api/generate"
OLLAMA_MODEL = "llama3"

# 오디오 데이터 저장 큐
audio_queue = queue.Queue()

# Whisper 모델 로딩 (GPU 사용)
try:
    model = WhisperModel("base", device="cuda")
except Exception as e:
    print(f"Whisper 모델 로딩 실패: {e}")
    exit(1)

# 오디오 콜백 함수
def audio_callback(indata, frames, time_info, status):
    if status:
        print(f"[AUDIO STATUS] {status}")
    audio_queue.put(indata.copy())

# LLM 서버로 텍스트 전달하고 응답 받기
def query_ollama(prompt):
    payload = {
        "model": OLLAMA_MODEL,
        "prompt": prompt,
        "stream": False
    }
    try:
        res = requests.post(OLLAMA_URL, json=payload, timeout=60)
        res.raise_for_status()
        return res.json().get("response", "")
    except Exception as e:
        print(f"[LLM ERROR] {e}")
        return "LLM 서버 응답 오류입니다."

# TTS로 응답 읽어주기
def speak(text, filename="response.mp3"):
    try:
        tts = gTTS(text, lang="ko")
        tts.save(filename)
        os.system(f"mpg123 {filename}")
    except Exception as e:
        print(f"[TTS 오류] {e}")

# 실시간 음성 인식 + LLM 통합 루프
def recognize_and_chat():
    print("🎤 실시간 음성 인식 시작 (Ctrl+C로 종료)")
    try:
        with sd.InputStream(samplerate=SAMPLE_RATE, channels=1, callback=audio_callback, blocksize=BLOCK_SIZE):
            audio_buffer = []

            while True:
                while not audio_queue.empty():
                    audio_chunk = audio_queue.get()
                    audio_buffer.extend(audio_chunk.flatten().tolist())

                if len(audio_buffer) > SAMPLE_RATE * BUFFER_DURATION:
                    audio_data = np.array(audio_buffer[:SAMPLE_RATE * BUFFER_DURATION], dtype=np.float32)
                    audio_buffer = audio_buffer[SAMPLE_RATE * BUFFER_DURATION:]

                    if np.max(np.abs(audio_data)) == 0:
                        print("⚠️ 무음 감지: 건너뜀")
                        continue
                    audio_data /= np.max(np.abs(audio_data))

                    try:
                        segments, _ = model.transcribe(audio_data, beam_size=5, temperature=0.2, language="ko")
                        for segment in segments:
                            user_input = segment.text.strip()
                            print(f"👤 사용자: {user_input}")
                            if user_input:
                                llm_response = query_ollama(user_input)
                                print(f"🤖 LLM: {llm_response}")
                                speak(llm_response)
                    except Exception as e:
                        print(f"[Whisper 변환 오류] {e}")
    except KeyboardInterrupt:
        print("\n🛑 인식 중단됨")
    except Exception as e:
        print(f"[오류] {e}")

if __name__ == "__main__":
    recognize_and_chat()
