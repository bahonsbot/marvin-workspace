#!/usr/bin/env python3
"""
PNG → JPG Converter
A simple Mac OS app to batch convert PNG files to JPG/JPEG.
Run directly: python3 converter.py
Build as macOS app: use Platypus (https://sveinbjorn.org/platypus)
  - Settings: "Remain running after execution" = ON
  - "Droplet" mode: files dropped on the app icon are passed as CLI args
Drag-and-drop is handled via tkinter's <<DragFileList>> virtual event,
which is the correct low-level mechanism for receiving dropped files on macOS.
"""

import os
import sys
import platform
from pathlib import Path

# ── Check dependencies ────────────────────────────────────────────────────────

try:
    import PySimpleGUI as sg
except ImportError:
    print("PySimpleGUI is not installed.")
    print("Run: pip install PySimpleGUI")
    sys.exit(1)

try:
    from PIL import Image
except ImportError:
    print("Pillow is not installed.")
    print("Run: pip install Pillow")
    sys.exit(1)

# ── Theme / Colors ────────────────────────────────────────────────────────────

COLORS = {
    "window_bg":       "#1E1E2E",
    "card_bg":         "#2A2A3E",
    "card_border":     "#4A4A6A",
    "primary":         "#6C63FF",
    "primary_hover":   "#5A52E0",
    "secondary":       "#3A3A5A",
    "text_primary":    "#F0F0F5",
    "text_secondary":  "#9090AA",
    "success":         "#4ADE80",
    "error":           "#F87171",
    "progress_fill":   "#6C63FF",
}

# ── Helpers ───────────────────────────────────────────────────────────────────

def get_default_output_dir() -> str:
    home = Path.home()
    downloads = home / "Downloads"
    return str(downloads) if downloads.exists() else str(home)


def convert_png_to_jpg(
    png_path: str,
    output_dir: str,
    quality: int,
) -> tuple[bool, str]:
    """Convert a PNG file to JPG. Returns (success, message)."""
    try:
        img = Image.open(png_path)
        if img.mode in ("RGBA", "LA", "P"):
            if img.mode == "P":
                img = img.convert("RGBA")
            background = Image.new("RGB", img.size, (255, 255, 255))
            if img.mode == "RGBA":
                background.paste(img, mask=img.split()[3])
            else:
                background.paste(img)
            final_img = background
        elif img.mode == "RGB":
            final_img = img
        else:
            final_img = img.convert("RGB")

        stem = Path(png_path).stem
        jpg_path = os.path.join(output_dir, f"{stem}.jpg")
        final_img.save(jpg_path, "JPEG", quality=quality)
        return True, f"✓ Saved: {stem}.jpg"
    except Exception as e:
        return False, f"✗ Error: {Path(png_path).name} — {e}"


def _drag_icon_svg() -> bytes:
    """Return a small base64 PNG of a drag-arrow icon."""
    import base64
    data = (
        "iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAABHNCSVQICAgIfAhkiAAAAAlwSFlz"
        "AAAOxAAADsQBlSsOGwAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAGfSURB"
        "VFiF7Za9TsMwGIafu0kIoaFqcOJGuHAj3Ag6dJQ6dJQ6dJQ6dJQ6dJQ6dJQ6dJQ6dJQ6dJQ6dJQ6"
        "dJQ6dJQ6dJQ6dJQ6dJQ6dJQ6dJQ6dJQ6dJQ6dJQ6dJQ6dJQ6dJQ6dJQ6dJQ6dJQ6dJQ6dJQ6dJQ6"
        "dJQ6dJQ6dJQ6dJQ6dJQ6dJQ6dJQ6dJQ6dJQ6dJQ6dJQ6dJQ6dJQ6dJQ6dJQ6dJQ6dJQ6dJQ6dJQ6"
        "dJQ6dJQ6dJQ6dJQ6dJQ6dJQ6dJQ6dJQ6dJQ6dJQ6dJQ6dJQ6dJQ6dJQ6dJQ6dJQ6dJQ6dJQ6dJQ6"
        "dJQ6dJQ6dJQ6dJQ6dJQ6dJQ6dJQ6dJQ6dJQ6dJQ6dJQ6dJQ6dJQ6dJQ6dJQ6dJQ6dJQ6dJQ6dJRA"
        "AEqM0f8AAAAASUVORK5CYII="
    )
    return base64.b64decode(data)


# ── Window builder ─────────────────────────────────────────────────────────────

def build_window(initial_files: list[str] | None = None):
    """Construct the main application window."""
    initial_files = initial_files or []

    font_main   = ("system-ui", 13)
    font_title  = ("system-ui", 17, "bold")
    font_button = ("system-ui", 14, "bold")
    font_small  = ("system-ui", 12)
    font_tiny   = ("system-ui", 11)

    # ── Drop zone card ──────────────────────────────────────────────────────
    drop_zone = sg.Column(
        [
            [
                sg.Column(
                    [
                        [sg.Image(data=_drag_icon_svg(), subsample=2, pad=(0, 6))],
                        [
                            sg.Text(
                                "Drop PNG files here",
                                font=("system-ui", 15, "bold"),
                                text_color=COLORS["text_primary"],
                                pad=(0, 4),
                            )
                        ],
                        [
                            sg.Text(
                                "or click to browse",
                                font=font_small,
                                text_color=COLORS["text_secondary"],
                            )
                        ],
                    ],
                    elementjustification="center",
                    pad=((10, 10), (16, 16)),
                )
            ]
        ],
        key="DROP_ZONE",
        size=(480, 130),
        pad=(0, 0),
        background_color=COLORS["card_bg"],
        border_color=COLORS["card_border"],
        enable_events=True,
    )

    drop_zone_wrapper = sg.Column(
        [[drop_zone]],
        size=(500, 140),
        pad=(30, 0),
        background_color=COLORS["window_bg"],
        element_justification="center",
    )

    # ── File list ────────────────────────────────────────────────────────────
    file_list_col = sg.Column(
        [
            [
                sg.Text(
                    "Selected files:",
                    font=font_tiny,
                    text_color=COLORS["text_secondary"],
                    pad=((0, 0), (0, 2)),
                )
            ],
            [
                sg.Listbox(
                    [],
                    key="FILE_LIST",
                    size=(56, 4),
                    font=font_tiny,
                    text_color=COLORS["text_primary"],
                    background_color=COLORS["card_bg"],
                    border_width=0,
                    no_scrollbar=True,
                    visible=False,
                )
            ],
        ],
        pad=(30, (6, 0)),
        visible=False,
        key="FILE_LIST_COL",
    )

    # ── Options row ──────────────────────────────────────────────────────────
    quality_label = sg.Text(
        "Quality: 90",
        font=font_small,
        text_color=COLORS["text_primary"],
        size=(12, 1),
        key="QUALITY_LABEL",
    )
    quality_slider = sg.Slider(
        range=(1, 100),
        default_value=90,
        orientation="horizontal",
        size=(28, 20),
        key="QUALITY_SLIDER",
        text_color=COLORS["primary"],
        background_color=COLORS["card_bg"],
        trough_color=COLORS["secondary"],
        pad=(0, 0),
        enable_events=True,
    )

    output_label = sg.Text(
        "Output: —",
        font=font_tiny,
        text_color=COLORS["text_secondary"],
        size=(30, 1),
        key="OUTPUT_LABEL",
    )
    output_browse = sg.Button(
        "Choose…",
        key="BROWSE_OUTPUT",
        font=font_small,
        button_color=(COLORS["text_primary"], COLORS["secondary"]),
        border_width=0,
        pad=(4, 0),
    )

    options_layout = [
        [
            sg.Text("JPG Quality", font=font_small,
                    text_color=COLORS["text_secondary"], pad=((0, 8), (0, 0))),
            quality_label,
            quality_slider,
        ],
        [
            sg.Text("Save to", font=font_small,
                    text_color=COLORS["text_secondary"], pad=((0, 8), (0, 0))),
            output_label,
            output_browse,
        ],
    ]
    options_col = sg.Column(
        options_layout,
        pad=(30, (10, 6)),
        background_color=COLORS["window_bg"],
        element_justification="left",
    )

    # ── Progress / log area ─────────────────────────────────────────────────
    log_area = sg.Multiline(
        "",
        key="LOG",
        size=(62, 7),
        font=font_tiny,
        text_color=COLORS["text_primary"],
        background_color=COLORS["card_bg"],
        border_width=0,
        autoscroll=True,
        readonly=True,
        pad=(4, 4),
    )
    log_col = sg.Column(
        [[log_area]],
        pad=(30, (4, 0)),
        background_color=COLORS["window_bg"],
        visible=False,
        key="LOG_COL",
    )

    # ── Status bar ──────────────────────────────────────────────────────────
    status_text = sg.Text(
        "",
        font=font_tiny,
        text_color=COLORS["text_secondary"],
        key="STATUS",
        pad=(30, (4, 8)),
    )

    # ── Convert button ──────────────────────────────────────────────────────
    convert_btn = sg.Button(
        "Convert to JPG",
        key="CONVERT",
        font=font_button,
        button_color=(COLORS["text_primary"], COLORS["primary"]),
        border_width=0,
        size=(30, 1),
        disabled=True,
        pad=(0, 6),
    )
    btn_row = sg.Column(
        [[convert_btn]],
        pad=(30, (2, 10)),
        element_justification="center",
        background_color=COLORS["window_bg"],
    )

    # ── Assemble ────────────────────────────────────────────────────────────
    layout = [
        [
            sg.Text(
                "PNG → JPG Converter",
                font=font_title,
                text_color=COLORS["text_primary"],
                pad=(30, (18, 10)),
            )
        ],
        [drop_zone_wrapper],
        [file_list_col],
        [options_col],
        [log_col],
        [status_text],
        [btn_row],
    ]

    window = sg.Window(
        "PNG → JPG Converter",
        layout,
        size=(560, 460),
        background_color=COLORS["window_bg"],
        resizable=False,
        finalize=True,
        element_justification="left",
        border_depth=0,
    )

    # Default output folder
    default_out = get_default_output_dir()
    window["OUTPUT_LABEL"].update(f"Output: {default_out}")
    window.metadata = {
        "files": [],
        "output_dir": default_out,
        "quality": 90,
    }

    # ── Set up native macOS drag-and-drop via tkinter <<DragFileList>> ──────
    # This is the correct low-level mechanism for receiving dropped files on macOS.
    # Tkinter fires <<DragFileList>> when the Finder sends a file list to the window.
    _setup_native_dnd(window, initial_files)

    # If files were passed on command line (Platypus droplet mode), load them
    if initial_files:
        _set_files(window, initial_files)

    return window


def _setup_native_dnd(window, initial_files: list[str]):
    """
    Bind <<DragFileList>> on the root tkinter window.
    This is the platform-native way to receive dragged file paths on macOS.
    The event carries a list of file paths as a Tcl list in event.data.
    """
    try:
        root = window.TKroot
    except Exception:
        # Fallback for non-TK windows (shouldn't happen in PySimpleGUI)
        return

    def _on_drag_file_list(event):
        """Handle the <<DragFileList>> virtual event fired by tkinter on file drop."""
        # event.data is a Tcl list of file paths (as strings or Path objects on macOS)
        # We need to extract it via the tkinter widget'stk.call or by evaluating the Tcl list.
        try:
            # Get the raw data from the tkinter event
            data = root.tk.call("split", event.data)
            # data is a Python list of file path strings (URLs or paths)
            # Convert to plain paths, handling macOS file:// URLs
            paths = []
            for item in data:
                s = str(item)
                if s.startswith("file://"):
                    # Decode file:// URL to path
                    import urllib.parse
                    s = urllib.parse.unquote(urllib.parse.urlparse(s).path)
                paths.append(s)

            # Filter to PNG files only
            pngs = [p for p in paths if p.lower().endswith(".png") and os.path.isfile(p)]

            if pngs:
                _set_files(window, pngs)
        except Exception as e:
            # Silently fail — don't crash the app on a bad drop
            print(f"[DND] Could not process dropped files: {e}", file=sys.stderr)

    # Bind to <<DragFileList>> — this is the canonical Tk virtual event for file drops
    root.bind("<<DragFileList>>", _on_drag_file_list)

    # Also register as a drop target via tk_dnd if available (more explicit)
    try:
        import tkinterdnd2 as tkdnd
        # tkinterdnd2 provides a more explicit drop target registration
        dnd = tkdnd.DnD(timeout=20)
        dnd.register_drop_target(window.TKroot)
        # The callback for tkinterdnd2 is a function that receives (event)
        # and can query event.data for the file list
        def _tkdnd_drop(event):
            try:
                # tkinterdnd2 puts the file list in event.data as a list
                raw = getattr(event, "data", None)
                if raw is None:
                    return
                # raw can be a string (space-separated paths) or a list
                if isinstance(raw, str):
                    import urllib.parse
                    parts = raw.split()
                    paths = []
                    for p in parts:
                        if p.startswith("file://"):
                            p = urllib.parse.unquote(urllib.parse.urlparse(p).path)
                        paths.append(p)
                else:
                    paths = list(raw)

                pngs = [pt for pt in paths if str(pt).lower().endswith(".png") and os.path.isfile(pt)]
                if pngs:
                    _set_files(window, pngs)
            except Exception as e:
                print(f"[tkdnd] Drop error: {e}", file=sys.stderr)

        window.TKroot.dnd_bind("<<Drop>>", _tkdnd_drop)
    except ImportError:
        # tkinterdnd2 not installed — <<DragFileList>> binding is our fallback
        pass


# ── File management ───────────────────────────────────────────────────────────

def _set_files(window, paths: list):
    """Populate the file list and enable the convert button."""
    pngs = [p for p in paths if str(p).lower().endswith(".png") and os.path.isfile(p)]
    if not pngs:
        sg.popup_ok(
            "No valid PNG files found.",
            background_color=COLORS["window_bg"],
            title="Notice",
        )
        return

    window.metadata["files"] = pngs

    display = [Path(p).name for p in pngs]
    if len(display) > 10:
        display = display[:10] + [f"… and {len(display) - 10} more"]

    window["FILE_LIST"].update(values=display)
    window["FILE_LIST_COL"].update(visible=True)
    window["LOG_COL"].update(visible=True)
    window["LOG"].update("")
    window["CONVERT"].update(disabled=False)
    window["STATUS"].update(
        f"{len(pngs)} PNG file(s) ready — drop more to add",
        text_color=COLORS["text_secondary"],
    )


# ── Conversion ─────────────────────────────────────────────────────────────────

def _run_conversion(window):
    """Execute the batch conversion for the currently loaded files."""
    files = window.metadata.get("files", [])
    if not files:
        return

    output_dir = window.metadata["output_dir"]
    quality = window.metadata["quality"]

    window["LOG"].update("")
    window["STATUS"].update("Converting…", text_color=COLORS["text_secondary"])
    window["CONVERT"].update(disabled=True)
    window.refresh()

    converted = 0
    failed = 0
    skipped = 0

    for i, fpath in enumerate(files):
        fname = Path(fpath).name
        window["STATUS"].update(
            f"[{i + 1}/{len(files)}] {fname}",
            text_color=COLORS["text_secondary"],
        )
        window.refresh()

        if not str(fpath).lower().endswith(".png"):
            skipped += 1
            window["LOG"].print(f"⊘ Skipped (not PNG): {fname}")
            continue

        ok, msg = convert_png_to_jpg(fpath, output_dir, quality)
        if ok:
            converted += 1
            window["LOG"].print(
                f"✓ {Path(fpath).stem}.jpg",
                text_color=COLORS["success"],
            )
        else:
            failed += 1
            window["LOG"].print(msg, text_color=COLORS["error"])

    parts = []
    if converted:
        parts.append(f"{converted} converted")
    if failed:
        parts.append(f"{failed} failed")
    if skipped:
        parts.append(f"{skipped} skipped")
    summary = "Done — " + ", ".join(parts)
    color = COLORS["success"] if not failed else COLORS["error"]
    window["STATUS"].update(summary, text_color=color)
    window["CONVERT"].update(disabled=False)


# ── Main event loop ────────────────────────────────────────────────────────────

def main():
    sg.theme("DarkGrey13")
    sg.set_options(font=("system-ui", 13))

    # Collect files passed as command-line arguments (Platypus droplet mode).
    # When a file is dropped on the app bundle, macOS launches the app with
    # the file path(s) as arguments.
    cli_files = [a for a in sys.argv[1:] if os.path.isfile(a)]
    window = build_window(initial_files=cli_files)

    while True:
        event, values = window.read()

        if event in (sg.WIN_CLOSED, "Exit"):
            break

        if event == "QUALITY_SLIDER":
            q = int(values["QUALITY_SLIDER"])
            window["QUALITY_LABEL"].update(f"Quality: {q}")
            window.metadata["quality"] = q

        elif event == "BROWSE_OUTPUT":
            folder = sg.popup_get_folder(
                "Choose output folder",
                initial_folder=window.metadata["output_dir"],
                background_color=COLORS["window_bg"],
            )
            if folder:
                window.metadata["output_dir"] = folder
                short = folder if len(folder) <= 40 else "…" + folder[-37:]
                window["OUTPUT_LABEL"].update(f"Output: {short}")

        elif event == "DROP_ZONE":
            files = sg.popup_get_file(
                "Select PNG files to convert",
                multiple_files=True,
                file_types=(("PNG Images", "*.png"), ("All Files", "*.*")),
                background_color=COLORS["window_bg"],
            )
            if files:
                if ";" in files:
                    selected = [f.strip() for f in files.split(";")]
                else:
                    selected = [files]
                # Append to existing selection rather than replacing
                existing = window.metadata.get("files", [])
                all_files = existing + [f for f in selected
                                         if f not in existing
                                         and f.lower().endswith(".png")]
                if all_files:
                    _set_files(window, all_files)

        elif event == "CONVERT":
            _run_conversion(window)

        # Any unrecognized event → ignore
        else:
            pass

    window.close()


if __name__ == "__main__":
    main()
