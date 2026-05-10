# Montage Color Study

A small WebGL video piece made for a graduate film studies course on fashion film. It plays a fixed set of clips fullscreen and lets the viewer push the image warmer/cooler and flatter/harder with pointer movement.

## What It Does

- Autoplays the clip playlist.
- Maps horizontal pointer movement to color temperature.
- Maps vertical pointer movement to contrast.
- Uses arrow keys to cycle through clips.
- Keeps the UI almost invisible so the footage stays the point.

## How It Works

The browser decodes the videos in a hidden `<video>` element. Each frame is uploaded into a WebGL texture, then a fragment shader applies the grade in real time. The shader handles the visual work; the JavaScript mostly wires input, playlist state, and canvas sizing.

## Tech

- Vite for the dev/build pipeline.
- Plain JavaScript modules.
- WebGL fragment shader for the color treatment.
- CSS for the intro and interaction note.
- Local MP4 assets in `vid/`.

## Run It

```bash
npm run dev
```

Build it:

```bash
npm run build
```
