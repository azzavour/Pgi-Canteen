import ctypes
from ctypes import wintypes


WM_INPUT = 0x00FF
RIDEV_INPUTSINK = 0x00000100
RID_INPUT = 0x10000003
RIM_TYPEKEYBOARD = 1
RIDI_DEVICENAME = 0x20000007


class RAWINPUTDEVICE(ctypes.Structure):
    _fields_ = [
        ("usUsagePage", wintypes.USHORT),
        ("usUsage", wintypes.USHORT),
        ("dwFlags", wintypes.DWORD),
        ("hwndTarget", wintypes.HWND),
    ]


class RAWKEYBOARD(ctypes.Structure):
    _fields_ = [
        ("MakeCode", wintypes.USHORT),
        ("Flags", wintypes.USHORT),
        ("Reserved", wintypes.USHORT),
        ("VKey", wintypes.USHORT),
        ("Message", wintypes.UINT),
        ("ExtraInformation", wintypes.ULONG),
    ]


class RAWINPUTHEADER(ctypes.Structure):
    _fields_ = [
        ("dwType", wintypes.DWORD),
        ("dwSize", wintypes.DWORD),
        ("hDevice", wintypes.HANDLE),
        ("wParam", wintypes.WPARAM),
    ]


class RAWINPUT_DATA(ctypes.Union):
    _fields_ = [
        ("keyboard", RAWKEYBOARD),
    ]


class RAWINPUT(ctypes.Structure):
    _fields_ = [
        ("header", RAWINPUTHEADER),
        ("data", RAWINPUT_DATA),
    ]


WNDPROC = ctypes.WINFUNCTYPE(
    wintypes.LPARAM, wintypes.HWND, wintypes.UINT, wintypes.WPARAM, wintypes.LPARAM
)


class WNDCLASSEX(ctypes.Structure):
    _fields_ = [
        ("cbSize", wintypes.UINT),
        ("style", wintypes.UINT),
        ("lpfnWndProc", WNDPROC),
        ("cbClsExtra", ctypes.c_int),
        ("cbWndExtra", ctypes.c_int),
        ("hInstance", wintypes.HINSTANCE),
        ("hIcon", wintypes.HANDLE),
        ("hCursor", wintypes.HANDLE),
        ("hbrBackground", wintypes.HANDLE),
        ("lpszMenuName", wintypes.LPCWSTR),
        ("lpszClassName", wintypes.LPCWSTR),
        ("hIconSm", wintypes.HANDLE),
    ]


user32 = ctypes.windll.user32

user32.RegisterRawInputDevices.argtypes = (
    ctypes.POINTER(RAWINPUTDEVICE),
    wintypes.UINT,
    wintypes.UINT,
)
user32.RegisterRawInputDevices.restype = wintypes.BOOL

user32.GetRawInputData.argtypes = (
    wintypes.LPARAM,
    wintypes.UINT,
    wintypes.LPVOID,
    ctypes.POINTER(wintypes.UINT),
    wintypes.UINT,
)
user32.GetRawInputData.restype = wintypes.UINT

user32.GetRawInputDeviceInfoW.argtypes = (
    wintypes.HANDLE,
    wintypes.UINT,
    wintypes.LPVOID,
    ctypes.POINTER(wintypes.UINT),
)
user32.GetRawInputDeviceInfoW.restype = wintypes.UINT

user32.GetKeyboardState.argtypes = (ctypes.POINTER(ctypes.c_ubyte * 256),)
user32.GetKeyboardState.restype = wintypes.BOOL

user32.ToUnicode.argtypes = (
    wintypes.UINT,
    wintypes.UINT,
    ctypes.POINTER(ctypes.c_ubyte),
    wintypes.LPWSTR,
    ctypes.c_int,
    wintypes.UINT,
)
user32.ToUnicode.restype = ctypes.c_int

user32.DefWindowProcW.restype = wintypes.LPARAM
user32.DefWindowProcW.argtypes = (
    wintypes.HWND,
    wintypes.UINT,
    wintypes.WPARAM,
    wintypes.LPARAM,
)


def extract_device_id(device_path: str) -> str:
    try:

        instance_part = device_path.split("#")[2]

        device_id = instance_part.split("&")[1]
        return device_id
    except IndexError:

        print(f"Warning: Could not parse a short ID from device path: {device_path}")
        return device_path


def create_input_window_and_loop(input_callback):

    device_path_cache = {}

    def get_device_path(handle):
        """Looks up the device path from its handle and caches the result."""
        if handle in device_path_cache:
            return device_path_cache[handle]

        size = wintypes.UINT(0)
        user32.GetRawInputDeviceInfoW(handle, RIDI_DEVICENAME, None, ctypes.byref(size))

        if size.value > 0:
            buffer = ctypes.create_unicode_buffer(size.value)
            if (
                user32.GetRawInputDeviceInfoW(
                    handle, RIDI_DEVICENAME, buffer, ctypes.byref(size)
                )
                > 0
            ):
                path = buffer.value
                device_path_cache[handle] = path
                return path

        fallback_path = f"unknown_handle_{handle}"
        device_path_cache[handle] = fallback_path
        return fallback_path

    def wnd_proc(hwnd, msg, wparam, lparam):
        if msg == WM_INPUT:
            size = wintypes.UINT(0)
            user32.GetRawInputData(
                lparam,
                RID_INPUT,
                None,
                ctypes.byref(size),
                ctypes.sizeof(RAWINPUTHEADER),
            )

            if size.value > 0:
                buf = ctypes.create_string_buffer(size.value)
                if (
                    user32.GetRawInputData(
                        lparam,
                        RID_INPUT,
                        buf,
                        ctypes.byref(size),
                        ctypes.sizeof(RAWINPUTHEADER),
                    )
                    == size.value
                ):
                    raw_input = ctypes.cast(buf, ctypes.POINTER(RAWINPUT)).contents
                    header = raw_input.header

                    if header.dwType == RIM_TYPEKEYBOARD:
                        keyboard_data = raw_input.data.keyboard

                        if keyboard_data.Message == 256:
                            vkey = keyboard_data.VKey
                            makecode = keyboard_data.MakeCode

                            keystate = (ctypes.c_ubyte * 256)()
                            if not user32.GetKeyboardState(ctypes.byref(keystate)):
                                return user32.DefWindowProcW(hwnd, msg, wparam, lparam)

                            buffer = ctypes.create_unicode_buffer(5)
                            result = user32.ToUnicode(
                                vkey, makecode, keystate, buffer, len(buffer), 0
                            )

                            if result > 0:
                                full_device_path = get_device_path(header.hDevice)
                                char = buffer.value

                                short_device_id = extract_device_id(full_device_path)
                                input_callback(short_device_id, char)

        return user32.DefWindowProcW(hwnd, msg, wparam, lparam)

    class_name = "RawInputListener"
    h_instance = ctypes.windll.kernel32.GetModuleHandleW(None)

    wnd_class = WNDCLASSEX()
    wnd_class.cbSize = ctypes.sizeof(WNDCLASSEX)
    wnd_class.lpfnWndProc = WNDPROC(wnd_proc)
    wnd_class.lpszClassName = class_name
    wnd_class.hInstance = h_instance

    if not user32.RegisterClassExW(ctypes.byref(wnd_class)):
        raise ctypes.WinError()

    hwnd = user32.CreateWindowExW(
        0, class_name, None, 0, 0, 0, 0, 0, None, None, h_instance, None
    )

    if not hwnd:
        raise ctypes.WinError()

    keyboard_device = RAWINPUTDEVICE(1, 6, RIDEV_INPUTSINK, hwnd)
    if not user32.RegisterRawInputDevices(
        ctypes.byref(keyboard_device), 1, ctypes.sizeof(RAWINPUTDEVICE)
    ):
        raise ctypes.WinError()

    msg = wintypes.MSG()
    while user32.GetMessageW(ctypes.byref(msg), None, 0, 0) != 0:
        user32.TranslateMessage(ctypes.byref(msg))
        user32.DispatchMessageW(ctypes.byref(msg))
