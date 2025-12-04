import os
import queue
import threading
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
            sound_name = self.sound_queue.get()
            try:
                sound_object = self.sounds.get(sound_name)
                if sound_object:
                    while pygame.mixer.get_busy():
                        pygame.time.wait(10)
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

    def play(self, sound_name: str):
        if sound_name not in self.sounds:
            print(f"Attempted to play non-existent sound: '{sound_name}'")
            return
        self.sound_queue.put(sound_name)

    def play_success(self):
        sound_name = "success"
        if sound_name not in self.sounds:
            print(f"Attempted to play non-existent sound: '{sound_name}'")
            return
        self.sound_queue.put(sound_name)

    def play_failed(self):
        sound_name = "failure"
        if sound_name not in self.sounds:
            print(f"Attempted to play non-existent sound: '{sound_name}'")
            return
        self.sound_queue.put(sound_name)

    def play_limit_reached(self):
        sound_name = "limit_reached"
        if sound_name not in self.sounds:
            print(f"Attempted to play non-existent sound: '{sound_name}'")
            return
        self.sound_queue.put(sound_name)

    def play_unrecognized(self):
        sound_name = "unrecognized"
        if sound_name not in self.sounds:
            print(f"Attempted to play non-existent sound: '{sound_name}'")
            return
        self.sound_queue.put(sound_name)
