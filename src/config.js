// Keep this order stable: the keyboard controls and visual rhythm depend on it.
// Using static URL expressions lets Vite copy the MP4s into production builds.
export const DEFAULT_PLAYLIST = [
    { type: 'video', url: new URL('../vid/C0022.MP4_Rendered_001.mp4', import.meta.url).href },
    { type: 'video', url: new URL('../vid/C0016.MP4_Rendered_001.mp4', import.meta.url).href },
    { type: 'video', url: new URL('../vid/C0014.MP4_Rendered_001.mp4', import.meta.url).href },
    { type: 'video', url: new URL('../vid/C0008.MP4_Rendered_001.mp4', import.meta.url).href },
];

export const FRAME_RATE = 30;
export const INTRO_DURATION_MS = 2500;
