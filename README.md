# SVG Path Connector

Connects SVG paths whose endpoints overlap into single continuous paths. Works as a **CLI tool** or a **browser-based web UI** (no server required).

## What it does

SVG editors and CAD tools often export shapes as many short disconnected paths instead of one continuous path. A concrete example is the **LC Interlocking workbench in FreeCAD**, which exports finger-joint cuts as individual path segments — making further post-processing in Inkscape (e.g. applying offsets or boolean operations on whole shapes) impossible without first merging them.

This tool finds paths within the same `<g>` group whose start/end points are within a configurable tolerance, and joins them together — including reversing paths when needed to make them connect.

**Before:**
```xml
<g>
  <path d="M 0,0 L 50,50"/>
  <path d="M 100,0 L 50,50"/>   <!-- ends at the same point -->
</g>
```
**After:**
```xml
<g>
  <path d="M 0,0 L 50,50 L 100,0"/>
</g>
```

Supported path commands: `M`, `L`, `H`, `V`, `C`, `S`, `Q`, `T`, `A`, `Z` (relative and absolute).

## Web UI

Open [`index.html`](index.html) locally or visit the [GitHub Pages site](https://martin-omacht.github.io/svg-connect).

1. Drop an SVG file onto the page (or click to browse)
2. Adjust the **tolerance** if needed (default `0.2` SVG units)
3. Click **Connect Paths**
4. Download the result as `<filename>_connected.svg`

All processing happens in the browser — no files are uploaded anywhere.

## CLI

### Install

```bash
git clone https://github.com/martin-omacht/svg-connect.git
cd svg-connect
npm install
```

### Usage

```bash
node svg-connect.js <input.svg> [output.svg] [--tolerance=N]
```

| Argument | Description | Default |
|---|---|---|
| `input.svg` | Input SVG file | *(required)* |
| `output.svg` | Output file path. Omit to write to stdout | — |
| `--tolerance=N` | Max distance (SVG units) between endpoints to consider them overlapping | `0.2` |

### Examples

```bash
# Save result alongside original
node svg-connect.js drawing.svg drawing_connected.svg

# Pipe to another tool
node svg-connect.js drawing.svg | svgo -i - -o optimized.svg

# Higher tolerance for imprecise exports
node svg-connect.js drawing.svg out.svg --tolerance=1.0
```

Progress is printed to stderr:
```
Merged 116 path connection(s) (tolerance: 0.2)
```

## How it works

1. Parses the SVG into a DOM tree
2. For each `<g>` group, collects direct `<path>` children
3. Converts all path commands to absolute coordinates
4. Greedily finds pairs of paths whose endpoints are within tolerance:
   - `A.end → B.start` — append B to A
   - `A.end → B.end` — reverse B, then append
   - `B.end → A.start` — append A to B
   - `A.start → B.start` — reverse A, then append
5. Repeats until no more connections can be made
6. Serializes the modified DOM back to SVG

Only paths within the **same group** are connected. Paths outside any group, and all non-path elements, are left untouched.

## Project structure

```
svg-connect/
├── index.html        # Web UI markup
├── style.css         # Web UI styles
├── app.js            # Web UI logic
├── merge.js          # Core merge algorithm (shared by CLI and browser)
└── svg-connect.js    # CLI entry point
```
