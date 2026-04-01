# PNG → JPG Converter

A native macOS app to batch convert PNG images to JPG/JPEG with adjustable quality.

---

## Features

- **Drag & drop** PNG files directly onto the window
- **Batch convert** any number of files at once
- **Quality slider** — 30–100 JPEG quality (default 92)
- **Custom output folder** — choose where JPGs are saved
- **Transparency handling** — PNG alpha composited over white background before JPEG encode
- **Progress log** — see each file as it converts

---

## Quick Start (run from source)

```bash
# 1. Create a virtual environment
python3 -m venv .venv
source .venv/bin/activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Run
python3 converter.py
```

> **No external GUI library needed** — uses tkinter, which ships with macOS Python.

---

## Build as macOS App (.app) — Platypus (recommended)

[Platypus](https://sveinbjorn.org/platypus) creates a native macOS app wrapper from a Python script.

### Steps

1. **Download Platypus** from https://sveinbjorn.org/platypus
2. Install and open Platypus
3. Fill in the fields:

   | Field | Value |
   |---|---|
   | App Name | `PNG to JPG Converter` |
   | Script Path | `/path/to/converter.py` |
   | Interpreter | `/usr/bin/python3` |
   | Runtime Output | `Bundle` |
   | Remain running after execution | ☑ checked |

4. *(Optional)* Add an icon — download a free `.icns` or use the built-in Platypus icon
5. Click **Create** → saves a `.app` to your chosen location
6. Double-click the `.app` to launch — no terminal needed

### Notes
- First launch on macOS may show "app is from unidentified developer" — go to **System Preferences → Security & Privacy → Open Anyway**
- Keep the `.app` in `/Applications` or `~/Applications` for easy access

---

## Build as macOS App — py2app (alternative)

```bash
pip install py2app
```

Then in the converter directory create `setup.py`:

```python
from setuptools import setup
setup(app=['converter.py'], setup_requires=['py2app'])
```

```bash
python setup.py py2app
# Output: dist/PNG_to_JPG_Converter.app
```

---

## Troubleshooting

| Problem | Solution |
|---|---|
| `ModuleNotFoundError: No module named 'PIL'` | Run `pip install Pillow` |
| App won't launch / tkinter error | Make sure you're using the macOS system Python3 (`/usr/bin/python3`) which includes tkinter |
| Drop zone doesn't respond to drag | Use the **Add Files…** button to browse instead |
| Quality slider has no effect | Drag the slider handle, don't just click |

---

## File Structure

```
png-to-jpg-converter/
├── converter.py       # Main application
├── requirements.txt   # pip dependencies
├── README.md          # This file
└── SPEC.md            # Full design specification
```
