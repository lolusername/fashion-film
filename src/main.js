import './styles.css';
import { DEFAULT_PLAYLIST, INTRO_DURATION_MS } from './config.js';
import { getById } from './dom.js';
import { normalizePointer } from './math.js';
import { createPlaylist } from './media.js';
import { createRenderer } from './renderer.js';

const animateIntro = () => {
    const lines = Array.from(document.querySelectorAll('.intro-text'));

    lines.forEach((line, index) => {
        window.setTimeout(() => {
            line.classList.add('intro-text--visible');
        }, index * 200);
    });

    window.setTimeout(() => {
        document.documentElement.style.setProperty('--banner-opacity', '0');
    }, INTRO_DURATION_MS);
};

const initializeApp = async () => {
    const canvas = getById('glCanvas');
    const renderer = createRenderer(canvas);
    const playlist = createPlaylist({ sources: DEFAULT_PLAYLIST, renderer });

    const updatePointer = (event) => {
        renderer.setMouse(normalizePointer(event, canvas));
    };

    window.addEventListener('mousemove', updatePointer);
    window.addEventListener('touchstart', (event) => {
        // On touch devices the gesture controls the grade, not page scrolling.
        event.preventDefault();
        updatePointer(event);
    }, { passive: false });
    window.addEventListener('touchmove', (event) => {
        event.preventDefault();
        updatePointer(event);
    }, { passive: false });

    window.addEventListener('keydown', (event) => {
        // Keep keyboard navigation intentionally small: only playlist cycling.
        if (event.code === 'ArrowRight' || event.code === 'ArrowDown') {
            playlist.next();
        }

        if (event.code === 'ArrowLeft' || event.code === 'ArrowUp') {
            playlist.previous();
        }
    });

    window.addEventListener('resize', renderer.resize);
    window.addEventListener('orientationchange', renderer.resize);
    window.addEventListener('beforeunload', () => {
        renderer.dispose();
    });

    animateIntro();
    renderer.start();
    await playlist.load(0);
};

window.addEventListener('DOMContentLoaded', () => {
    initializeApp().catch((error) => {
        console.error('App failed to initialize:', error);
    });
});
