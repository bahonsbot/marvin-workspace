# Daily Creative Challenge Generator

A simple, self-contained tool that assigns one creative challenge per day across six categories.

## Categories

- **Blender** — 3D modeling, animation, and rendering
- **After Effects** — Motion graphics and video compositing
- **Unreal Engine** — Real-time 3D environments and interactions
- **Illustrator** — Vector graphics and brand design
- **Commercial Copywriting** — Marketing copy, emails, and landing pages
- **Storytelling & Novel Writing** — Fiction, character development, and narrative

## How It Works

The tool uses a deterministic algorithm based on the current date:

1. **Day of year** determines which category is selected
2. **Week number** determines which challenge within that category

This means:
- Every day shows exactly ONE category and ONE challenge
- The same challenge repeats every 7 days for each category
- No user selection required — just open and practice

## Usage

Simply open `index.html` in any modern web browser. No server or installation required.

```bash
# Open directly (macOS)
open index.html

# Or with a local server (Python)
python -m http.server 8000
# Then visit http://localhost:8000
```

## Challenge Structure

Each challenge includes:
- **Title** — Clear, inspiring goal
- **Description** — What you're making/doing
- **Requirements** — Specific, actionable steps (3-5 items)
- **Time estimate** — Realistic duration

## Adding More Challenges

Edit the `categories` array in `index.html`. Each category supports unlimited challenges:

```javascript
{
    id: 'category-name',
    name: 'Display Name',
    class: 'category-css-class',
    challenges: [
        {
            title: "Challenge Title",
            description: "Description here",
            requirements: ["Req 1", "Req 2"],
            time: "30-45 minutes"
        },
        // ... more challenges
    ]
}
```

## Notes

- Fully offline — no backend required
- All data embedded in the single HTML file
- Responsive design works on mobile and desktop
- Designed for Philippe's creative practice goals