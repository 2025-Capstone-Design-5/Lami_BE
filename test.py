# 실시간 음성 인식을 하고 자연어(한국어)로 변환 하는 코드
# 마이크로부터 음성을 입력받아 Whisper 모델을 사용하여 실시간으로 텍스트로 변환    

import sounddevice as sd
import numpy as np
import queue
from faster_whisper import WhisperModel

# 설정
SAMPLE_RATE = 16000  # Whisper 모델에 적합한 샘플링 레이트
BLOCK_SIZE = 1024    # 마이크로부터 읽어오는 블록 크기

# 오디오 데이터를 저장하는 큐
audio_queue = queue.Queue()

# Whisper 모델 로드 (GPU를 사용하는 경우 "cuda"로 설정)
try:
    model = WhisperModel("base", device="cuda")
except Exception as e:
    print(f"Error loading Whisper model: {e}")
    exit(1)

# 오디오 콜백 함수
def audio_callback(indata, frames, time, status):
    if status:
        print(f"Audio status: {status}")
    audio_queue.put(indata.copy())

# 실시간 음성 인식 함수
def recognize_from_mic():
    print("Listening... (Press Ctrl+C to stop)")
    try:
        with sd.InputStream(samplerate=SAMPLE_RATE, channels=1, callback=audio_callback, blocksize=BLOCK_SIZE) as stream:
            audio_buffer = []

            while True:
                # 큐에서 오디오 데이터를 읽어옴
                while not audio_queue.empty():
                    audio_chunk = audio_queue.get()
                    audio_buffer.extend(audio_chunk.flatten().tolist())

                # 오디오 버퍼가 일정 길이를 넘으면 변환 수행
                if len(audio_buffer) > SAMPLE_RATE * 5:  # 5초 분량
                    audio_data = np.array(audio_buffer[:SAMPLE_RATE * 5], dtype=np.float32)
                    audio_buffer = audio_buffer[SAMPLE_RATE * 5:]

                    # 정규화 수행
                    if np.max(np.abs(audio_data)) > 0:
                        audio_data = audio_data / np.max(np.abs(audio_data))
                    else:
                        print("Warning: Silent audio detected, skipping transcription.")
                        continue

                    # Whisper 모델로 변환
                    try:
                        segments, _ = model.transcribe(audio_data, beam_size=5, temperature=0.2)
                        for segment in segments:
                            print(f"[{segment.start:.2f}s -> {segment.end:.2f}s] {segment.text}")
                    except Exception as e:
                        print(f"Error during transcription: {e}")

    except KeyboardInterrupt:
        print("Stopped listening.")
    except sd.PortAudioError as e:
        print(f"Audio Error: {e}")
    except Exception as e:
        print(f"Unexpected Error: {e}")

if __name__ == "__main__":
    try:
        recognize_from_mic()
    except Exception as e:
        print(f"Failed to start recognition: {e}")
