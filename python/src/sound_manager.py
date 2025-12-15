import os
import queue
import threading
import time
import pygame


class SoundManager:
    def __init__(self, asset_dir="assets"):
        self.asset_dir = asset_dir
        self.sounds = {}
        self.sound_queue = queue.Queue()
        self._initialize_mixer()
        self._load_sounds()

    def _initialize_mixer(self):
        print("Initializing pygame mixer...")
        try:
            pygame.mixer.init()
            print("Pygame mixer initialized.")
        except pygame.error as e:
            print(f"Error initializing pygame mixer: {e}")
            raise

    def _load_sounds(self):
        sound_files = {
            "success": "success.wav",
            "failure": "failed.wav",
            "limit_reached": "failed.wav",
            "unrecognized": "failed.wav",
        }
        print("Loading sounds...")
        try:
            for name, filename in sound_files.items():
                path = os.path.join(self.asset_dir, filename)
                self.sounds[name] = pygame.mixer.Sound(path)
            print("Sounds loaded successfully.")
        except pygame.error as e:
            print(
                f"Error: A sound file was not found or is invalid. Please check the '{self.asset_dir}' directory. Details: {e}"
            )
            raise

    def _sound_worker(self):
        while True:
            item = self.sound_queue.get()
            try:
                if isinstance(item, dict):
                    sound_name = item.get("sound") or item.get("name")
                    metadata = item.get("metadata") or {}
                else:
                    sound_name = item
                    metadata = {}
                sound_object = self.sounds.get(sound_name)
                if sound_object:
                    while pygame.mixer.get_busy():
                        pygame.time.wait(10)
                    tap_id = metadata.get("tap_id")
                    t_sound_played = int(time.time() * 1000)
                    if tap_id:
                        print(
                            f"[sound_play] sound={sound_name} tap_id={tap_id} t_sound_played={t_sound_played}"
                        )
                    else:
                        print(
                            f"[sound_play] sound={sound_name} tap_id=NA t_sound_played={t_sound_played}"
                        )
                    sound_object.play()
                else:
                    print(f"Warning: Sound '{sound_name}' not found.")
            except Exception as e:
                print(f"Error playing sound: {e}")
            finally:
                self.sound_queue.task_done()

    def start_worker(self):
        sound_thread = threading.Thread(target=self._sound_worker, daemon=True)
        sound_thread.start()
        print("Sound worker thread started.")

    def _queue_sound(self, sound_name: str, metadata: dict | None = None):
        if sound_name not in self.sounds:
            print(f"Attempted to play non-existent sound: '{sound_name}'")
            return
        payload = {"sound": sound_name, "metadata": metadata or {}}
        self.sound_queue.put(payload)

    def play(self, sound_name: str, metadata: dict | None = None):
        self._queue_sound(sound_name, metadata)

    def play_success(self, metadata: dict | None = None):
        self._queue_sound("success", metadata)

    def play_failed(self, metadata: dict | None = None):
        self._queue_sound("failure", metadata)

    def play_limit_reached(self, metadata: dict | None = None):
        self._queue_sound("limit_reached", metadata)

    def play_unrecognized(self, metadata: dict | None = None):
        self._queue_sound("unrecognized", metadata)
