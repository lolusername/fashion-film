export const createVideoElement = () => {
    const video = document.createElement('video');

    video.crossOrigin = 'anonymous';
    video.loop = false;
    video.muted = true;
    video.autoplay = true;
    video.playsInline = true;
    video.preload = 'auto';
    // The video is only a decode source; the canvas is the visible output.
    video.style.display = 'none';
    document.body.appendChild(video);

    return video;
};

const waitForVideoMetadata = (video) => {
    if (video.readyState >= video.HAVE_METADATA) {
        return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
        const cleanup = () => {
            video.removeEventListener('loadedmetadata', handleLoad);
            video.removeEventListener('error', handleError);
        };

        const handleLoad = () => {
            cleanup();
            resolve();
        };

        const handleError = () => {
            cleanup();
            reject(new Error('Video failed to load'));
        };

        video.addEventListener('loadedmetadata', handleLoad, { once: true });
        video.addEventListener('error', handleError, { once: true });
    });
};

const playVideo = async (video) => {
    try {
        await video.play();
    } catch (error) {
        console.error('Video play failed:', error);
    }
};

export const getVideoSize = (video) => {
    return {
        width: video.videoWidth || 1,
        height: video.videoHeight || 1,
    };
};

export const createPlaylist = ({ sources, renderer }) => {
    const video = createVideoElement();
    let currentIndex = 0;
    // Guards against older async loads winning after a quick next/previous.
    let loadToken = 0;

    const load = async (index) => {
        if (!sources.length) {
            return;
        }

        const token = ++loadToken;
        const source = sources[index];
        currentIndex = index;

        video.src = source.url;
        video.load();
        // WebGL needs real video dimensions before the shader can preserve aspect ratio.
        await waitForVideoMetadata(video);

        if (token !== loadToken) {
            return;
        }

        renderer.setSource(video);
        await playVideo(video);
    };

    const next = () => load((currentIndex + 1) % sources.length);
    const previous = () => load((currentIndex - 1 + sources.length) % sources.length);

    video.addEventListener('ended', () => {
        // The original experience flows through the playlist instead of looping one clip.
        next();
    });

    return {
        load,
        next,
        previous,
        get currentIndex() {
            return currentIndex;
        },
        get activeMedia() {
            return video;
        },
    };
};
