# PNG → JPG Converter — Specification

## Overview
- **Name:** PNG to JPG Converter
- **Type:** Desktop application (macOS)
- **Summary:** Drag-and-drop or browse to convert PNG images to JPG/JPEG files with configurable quality.
- **Target users:** Designers, photographers, developers who need quick batch image conversion on Mac.

---

## UI Specification

### Window
- Single fixed window, 560×420px, non-resizable
- Title: "PNG → JPG Converter"
- Background: #1E1E2E (dark charcoal)
- Corner radius on window: 12px (macOS handled)

### Color Palette
| Element | Color |
|---|---|
| Window background | `#1E1E2E` |
| Card/drop zone background | `#2A2A3E` |
| Card/drop zone border | `#4A4A6A` (dashed, 2px) |
| Primary button | `#6C63FF` |
| Primary button hover | `#5A52E0` |
| Secondary button | `#3A3A5A` |
| Text primary | `#F0F0F5` |
| Text secondary | `#9090AA` |
| Success accent | `#4ADE80` |
| Error accent | `#F87171` |

### Typography
- Title: system font, 18px, semi-bold, `#F0F0F5`
- Labels: system font, 13px, regular, `#9090AA`
- Button text: system font, 14px, medium
- Status text: system font, 12px, regular

### Layout (top to bottom)
1. **Title bar area** — "PNG → JPG Converter" left-aligned, 16px padding top
2. **Drop zone** — centered card (480×160px), dashed border, icon + "Drop PNG files here or click to browse" text
3. **Options row** — JPG quality slider (1–100, default 90) + "Output folder" row with browse button
4. **Action row** — "Convert" primary button (full width), disabled until files selected
5. **Progress/log area** — scrollable list of converted files and errors

---

## Functionality

### Core Features
1. **File selection** — drag-and-drop onto drop zone OR click to open native file picker (multi-select PNG)
2. **Folder selection** — browse button to pick output directory (defaults to source folder or ~/Downloads)
3. **Quality setting** — slider 1–100, default 90, label shows current value
4. **Batch convert** — converts all selected PNG files sequentially
5. **Progress feedback** — filename + status shown in log area as each file converts
6. **Completion summary** — "Done: X files converted, Y failed" shown in green/red

### Conversion Rules
- Output filename: `<original_name>.jpg` in selected output folder
- Transparency: PNG alpha channel → white background composited before JPEG encode
- Quality: passed directly to Pillow JPEG encoder

### Error Handling
- Skip non-PNG files silently (show count in summary)
- Skip files that fail to open (log error, continue batch)
- If no output folder selected: save alongside source files

---

## Technical Specification

### Stack
- **Runtime:** Python 3 (macOS system Python or pyenv)
- **GUI:** PySimpleGUI (macOS tkinter backed)
- **Image processing:** Pillow (PIL)
- **Drag-and-drop:** Tkinter `<<DragFileList>>` virtual event (primary, always active) + optional `tkinterdnd2` DropTarget binding for more explicit handling
- **Packaging:** Platypus (creates .app from script) OR py2app

### Drag-and-Drop Implementation

macOS delivers dragged files to Tk windows via two mechanisms, both handled:

1. **Tk `<<DragFileList>>` virtual event** (always active, no dependencies):
   - Tk fires `<<DragFileList>>` on the root window when Finder drops files onto the app
   - `converter.py` binds this event at the root Tk level via `root.bind("<<DragFileList>>", callback)`
   - `event.data` is a Tcl list of file paths/URLs, split via `root.tk.call("split", event.data)`
   - `file://` URLs are decoded to plain paths using `urllib.parse`

2. **`tkinterdnd2` DropTarget** (optional, installed separately):
   - If `tkinterdnd2` is in the environment, also registers an explicit drop target
   - Provides a `<<Drop>>` callback with file list in `event.data`
   - More explicit than <<DragFileList>> on some macOS configurations

3. **Platypus droplet mode** (command-line arguments, always active):
   - When the `.app` bundle has files dropped on it, Platypus launches the script with file paths as `sys.argv`
   - `converter.py` reads `sys.argv[1:]` at startup and pre-loads those files

#### Why the original approach failed
PySimpleGUI's `DROP_ZONE` with `enable_events=True` fires on mouse click only. The `+DRAG+` pseudo-event does not carry file paths — it only signals that a drag operation entered/exited the element, not the actual dropped data. Real file paths arrive only through the mechanisms above.

### Dependencies
```
PySimpleGUI>=4.60
Pillow>=10.0
tkinterdnd2>=0.4   # optional, for explicit drop target
```

### File Structure (delivered)
```
png-to-jpg-converter/
├── SPEC.md
├── README.md
├── converter.py          # Main application script
├── requirements.txt      # pip install -r requirements.txt
└── build/
    └── BUILD_INSTRUCTIONS.txt
```

### Dependencies
```
PySimpleGUI>=4.60
Pillow>=10.0
```

### macOS Build (Platypus, recommended)
1. Install Platypus from https://sveinbjorn.org/platypus
2. `pip install -r requirements.txt`
3. Open Platypus, fill in:
   - Script path: `converter.py`
   - App name: `PNG to JPG Converter`
   - Icon: optional .icns file
   - Output: `bundle`
   - Check: "Remain running after execution"
4. Click Create → generates `.app`

### macOS Build (py2app, alternative)
```bash
pip install py2app
python setup.py py2app
```

---

## Acceptance Criteria
- [ ] Window opens at correct size with dark theme
- [ ] Drop zone accepts drag-and-drop of PNG files
- [ ] Click on drop zone opens file picker filtered to PNG
- [ ] Quality slider updates label on drag
- [ ] Output folder browse button opens native folder picker
- [ ] Convert button becomes enabled after files are selected
- [ ] Each conversion shows progress in log area
- [ ] Completion summary is accurate
- [ ] Files are correctly saved as .jpg with white background where PNG had transparency
