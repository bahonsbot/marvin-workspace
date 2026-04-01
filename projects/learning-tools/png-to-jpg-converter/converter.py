#!/usr/bin/env python3
"""
PNG → JPG Converter
A simple Mac OS app to batch convert PNG files to JPG/JPEG.
Run directly: python3 converter.py
Build as macOS app: use Platypus (https://sveinbjorn.org/platypus)
  - Settings: "Remain running after execution" = ON
  - "Droplet" mode: files dropped on the app icon are passed as CLI args

Dependencies: Pillow only (pip install Pillow).
No external GUI library required — uses tkinter (built into macOS Python).
"""

from __future__ import annotations

import os
import sys
import shutil
import threading
from pathlib import Path

# ── Pillow check ──────────────────────────────────────────────────────────────
try:
    from PIL import Image
except ImportError:
    print("Pillow is not installed.")
    print("Run: pip install Pillow")
    sys.exit(1)


# ── Helpers ───────────────────────────────────────────────────────────────────

def get_default_output_dir() -> str:
    downloads = Path.home() / "Downloads"
    return str(downloads) if downloads.exists() else str(Path.home())


def convert_png_to_jpg(png_path: str, output_dir: str, quality: int) -> tuple[bool, str]:
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
        return True, f"✓  {stem}.jpg"
    except Exception as e:
        return False, f"✗  {Path(png_path).name}: {e}"


def thread_safe_converter(
    file_list: list[str],
    output_dir: str,
    quality: int,
    progress_callback,
    done_callback,
):
    """Run conversions in a background thread so the UI stays responsive."""
    total = len(file_list)
    success_count = 0

    def run():
        for i, path in enumerate(file_list, 1):
            ok, msg = convert_png_to_jpg(path, output_dir, quality)
            if ok:
                success_count += 1
            # progress_callback(percent, message)
            progress_callback(int(i / total * 100), msg)

        done_callback(success_count, total)

    threading.Thread(target=run, daemon=True).start()


# ── GUI (tkinter only — no external GUI dependency) ─────────────────────────

try:
    import tkinter as tk
    from tkinter import ttk, filedialog, messagebox, scrolledtext
except ImportError:
    print("tkinter is not available. This app requires macOS Python or a GUI environment.")
    sys.exit(1)


class ConverterApp:
    def __init__(self, initial_files: list[str] | None = None):
        self.root = tk.Tk()
        self.root.title("PNG → JPG Converter")
        self.root.geometry("680x520")
        self.root.configure(bg="#1E1E2E")
        self.root.resizable(False, False)

        # Make window appear centered on macOS
        self.root.eval("tk::PlaceWindow . center")

        self.file_list: list[str] = list(initial_files) if initial_files else []
        self.output_dir = tk.StringVar(value=get_default_output_dir())
        self.quality = tk.IntVar(value=92)
        self.converting = False

        self._build_ui()

        if self.file_list:
            self._refresh_file_listbox()

    # ── UI construction ─────────────────────────────────────────────────────

    def _build_ui(self):
        style = {
            "bg": "#1E1E2E",
            "fg": "#F0F0F5",
            "font": ("system-ui", 12),
        }
        entry_style = {
            "bg": "#2A2A3E",
            "fg": "#F0F0F5",
            "insertbackground": "#F0F0F5",
            "relief": "flat",
            "bd": 0,
            "font": ("system-ui", 12),
        }

        # ── Title bar ──────────────────────────────────────────────────────
        title_frame = tk.Frame(self.root, bg="#1E1E2E", height=48)
        title_frame.pack(fill="x", padx=20, pady=(16, 8))
        title_frame.pack_propagate(False)

        tk.Label(
            title_frame,
            text="PNG → JPG Converter",
            bg="#1E1E2E",
            fg="#6C63FF",
            font=("system-ui", 16, "bold"),
        ).pack(side="left")

        tk.Label(
            title_frame,
            text="Drag & drop PNG files below",
            bg="#1E1E2E",
            fg="#9090AA",
            font=("system-ui", 10),
        ).pack(side="right", pady=4)

        # ── Drop zone ──────────────────────────────────────────────────────
        drop_frame = tk.Frame(self.root, bg="#2A2A3E", bd=2, relief="groove")
        drop_frame.pack(fill="x", padx=20, pady=(0, 8))
        drop_frame.configure(highlightbackground="#4A4A6A", highlightthickness=2)

        self.listbox = tk.Listbox(
            drop_frame,
            bg="#2A2A3E",
            fg="#F0F0F5",
            font=("system-ui", 11),
            selectbackground="#6C63FF",
            selectforeground="#FFFFFF",
            relief="flat",
            bd=0,
            height=6,
        )
        self.listbox.pack(fill="x", padx=8, pady=6)
        self._setup_dnd()

        # Bind drag enter/leave for highlight
        for widget in (drop_frame, self.listbox):
            widget.bind("<Enter>", lambda e: drop_frame.configure(highlightbackground="#6C63FF"))
            widget.bind("<Leave>", lambda e: drop_frame.configure(highlightbackground="#4A4A6A"))

        # ── Buttons row ────────────────────────────────────────────────────
        btn_frame = tk.Frame(self.root, bg="#1E1E2E")
        btn_frame.pack(fill="x", padx=20, pady=(0, 8))

        for text, cmd in [
            ("Add Files…",    self._add_files),
            ("Remove Selected", self._remove_selected),
            ("Clear All",    self._clear_all),
        ]:
            tk.Button(
                btn_frame,
                text=text,
                command=cmd,
                bg="#2A2A3E",
                fg="#F0F0F5",
                activebackground="#3A3A5A",
                activeforeground="#F0F0F5",
                relief="flat",
                font=("system-ui", 11),
                padx=12,
                pady=4,
            ).pack(side="left", padx=(0, 8))

        # ── Output dir ─────────────────────────────────────────────────────
        dir_frame = tk.Frame(self.root, bg="#1E1E2E")
        dir_frame.pack(fill="x", padx=20, pady=(0, 8))

        tk.Label(dir_frame, text="Output folder:", bg="#1E1E2E", fg="#9090AA",
                 font=("system-ui", 11)).pack(side="left", padx=(0, 8))

        dir_entry = tk.Entry(dir_frame, textvariable=self.output_dir, **entry_style)
        dir_entry.pack(side="left", fill="x", expand=True, padx=(0, 8))

        tk.Button(
            dir_frame,
            text="Browse…",
            command=self._browse_output,
            bg="#2A2A3E",
            fg="#F0F0F5",
            activebackground="#3A3A5A",
            activeforeground="#F0F0F5",
            relief="flat",
            font=("system-ui", 11),
            padx=12,
            pady=2,
        ).pack(side="right")

        # ── Quality slider ─────────────────────────────────────────────────
        quality_frame = tk.Frame(self.root, bg="#1E1E2E")
        quality_frame.pack(fill="x", padx=20, pady=(0, 12))

        tk.Label(quality_frame, text="Quality:", bg="#1E1E2E", fg="#9090AA",
                 font=("system-ui", 11)).pack(side="left", padx=(0, 8))

        self.quality_label = tk.Label(
            quality_frame, text=f"{self.quality.get()}%",
            bg="#1E1E2E", fg="#F0F0F5", font=("system-ui", 11, "bold"),
        )
        self.quality_label.pack(side="left", padx=(0, 12))

        quality_slider = ttk.Scale(
            quality_frame,
            from_=30,
            to=100,
            orient="horizontal",
            variable=self.quality,
            command=lambda v: self.quality_label.configure(text=f"{self.quality.get()}%"),
        )
        quality_slider.pack(side="left", fill="x", expand=True)

        # ── Progress bar ────────────────────────────────────────────────────
        self.progress = ttk.Progressbar(self.root, mode="determinate", length=100)
        self.progress.pack(fill="x", padx=20, pady=(0, 4))

        self.progress_label = tk.Label(
            self.root, text="", bg="#1E1E2E", fg="#9090AA",
            font=("system-ui", 10), anchor="w",
        )
        self.progress_label.pack(fill="x", padx=20, pady=(0, 12))

        # ── Log output ─────────────────────────────────────────────────────
        log_frame = tk.Frame(self.root, bg="#1E1E2E")
        log_frame.pack(fill="both", expand=True, padx=20, pady=(0, 12))

        self.log = scrolledtext.ScrolledText(
            log_frame,
            bg="#16161E",
            fg="#4ADE80",
            font=("Menlo", 10),
            relief="flat",
            bd=0,
            state="disabled",
            height=6,
        )
        self.log.pack(fill="both", expand=True)

        # ── Convert button ─────────────────────────────────────────────────
        self.convert_btn = tk.Button(
            self.root,
            text="Convert to JPG",
            command=self._start_conversion,
            bg="#6C63FF",
            fg="#FFFFFF",
            activebackground="#5A52E0",
            activeforeground="#FFFFFF",
            relief="flat",
            font=("system-ui", 13, "bold"),
            padx=20,
            pady=8,
            cursor="hand2",
        )
        self.convert_btn.pack(pady=(0, 16))

    # ── Drag and drop ────────────────────────────────────────────────────────

    def _setup_dnd(self):
        # macOS drag-and-drop via Tk's virtual events
        self.listbox.bind("<<ListboxSelect>>", lambda e: None)

        def on_drop(event):
            if self.converting:
                return
            # Tk drops a list of file paths into the event's "data" field
            data = self.listbox.tk.eval("puts $::tk::DropEventData")
            # Parse newline-separated paths
            for line in data.strip().splitlines():
                path = line.strip().strip('"')
                if path and os.path.isfile(path):
                    self._add_file(path)

        self.listbox.bind("<Double-Button-1>", lambda e: self._open_file())
        self.listbox.bind("<<Dropdown>>", on_drop)

    def _add_file(self, path: str):
        if path.lower().endswith((".png", ".PNG")) and path not in self.file_list:
            self.file_list.append(path)
            self._refresh_file_listbox()

    def _add_files(self):
        paths = filedialog.askopenfilenames(
            title="Select PNG files",
            filetypes=[("PNG images", "*.png;*.PNG"), ("All files", "*")],
        )
        for p in paths:
            self._add_file(p)

    def _remove_selected(self):
        sel = self.listbox.curselection()
        for i in reversed(sel):
            self.file_list.pop(i)
        self._refresh_file_listbox()

    def _clear_all(self):
        self.file_list.clear()
        self._refresh_file_listbox()

    def _open_file(self):
        sel = self.listbox.curselection()
        if sel:
            path = self.file_list[sel[0]]
            os.system(f"open '{path}'")  # macOS: open with default app

    def _browse_output(self):
        folder = filedialog.askdirectory(title="Choose output folder")
        if folder:
            self.output_dir.set(folder)

    def _refresh_file_listbox(self):
        self.listbox.delete(0, "end")
        for f in self.file_list:
            self.listbox.insert("end", f"  {Path(f).name}")

    def _log_write(self, msg: str):
        self.log.configure(state="normal")
        self.log.insert("end", msg + "\n")
        self.log.see("end")
        self.log.configure(state="disabled")

    # ── Conversion ──────────────────────────────────────────────────────────

    def _start_conversion(self):
        if not self.file_list:
            messagebox.showwarning("No files", "Add some PNG files first.")
            return

        out_dir = self.output_dir.get()
        if not os.path.isdir(out_dir):
            try:
                os.makedirs(out_dir, exist_ok=True)
            except Exception as e:
                messagebox.showerror("Error", f"Cannot create output folder:\n{e}")
                return

        self.converting = True
        self.convert_btn.configure(state="disabled", text="Converting…")
        self.progress["value"] = 0
        self.progress_label.configure(text="Starting…")
        self._log_write(f"Output: {out_dir}\n")

        thread_safe_converter(
            file_list=self.file_list,
            output_dir=out_dir,
            quality=self.quality.get(),
            progress_callback=self._on_progress,
            done_callback=self._on_done,
        )

    def _on_progress(self, percent: int, msg: str):
        # Called from background thread — schedule UI update on main thread
        self.root.after(0, lambda: self._update_progress(percent, msg))

    def _update_progress(self, percent: int, msg: str):
        self.progress["value"] = percent
        self.progress_label.configure(text=f"{percent}%")
        color = "#4ADE80" if msg.startswith("✓") else "#F87171"
        self.log.configure(state="normal")
        self.log.insert("end", msg + "\n")
        self.log.tag_add(msg, "end-1l", "end")
        self.log.tag_config(msg, foreground=color)
        self.log.see("end")
        self.log.configure(state="disabled")

    def _on_done(self, success: int, total: int):
        self.root.after(0, lambda: self._show_done(success, total))

    def _show_done(self, success: int, total: int):
        self.converting = False
        self.convert_btn.configure(state="normal", text="Convert to JPG")
        self.progress["value"] = 100
        self._log_write(f"\nDone — {success}/{total} files converted.")
        messagebox.showinfo(
            "Complete",
            f"{success} of {total} files converted.\n\nSaved to:\n{self.output_dir.get()}",
        )

    # ── Run ─────────────────────────────────────────────────────────────────

    def run(self):
        self.root.mainloop()


# ── Entry point ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    # Collect files passed as command-line arguments (Platypus droplet mode).
    cli_files = [a for a in sys.argv[1:] if os.path.isfile(a)]
    app = ConverterApp(initial_files=cli_files)
    app.run()
