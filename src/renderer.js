import { FRAME_RATE } from './config.js';
import { getVideoSize } from './media.js';

// The vertex shader keeps the quad full-screen and remaps texture coordinates
// so each video covers the viewport without stretching.
const VERTEX_SHADER = `
    attribute vec2 a_position;

    uniform vec2 u_resolution;
    uniform vec2 u_mediaSize;

    varying vec2 v_texCoord;

    void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);

        float viewportAspect = u_resolution.x / u_resolution.y;
        float mediaAspect = u_mediaSize.x / u_mediaSize.y;

        vec2 texCoord = vec2((a_position.x + 1.0) / 2.0, (1.0 - a_position.y) / 2.0);
        vec2 scale = vec2(1.0);

        if (viewportAspect > mediaAspect) {
            scale.x = mediaAspect / viewportAspect;
        } else {
            scale.y = viewportAspect / mediaAspect;
        }

        v_texCoord = (texCoord - 0.5) * (1.0 / scale) + 0.5;
    }
`;

const FRAGMENT_SHADER = `
    precision mediump float;

    uniform sampler2D u_videoTexture;
    uniform vec2 u_mouse;

    varying vec2 v_texCoord;

    bool isValidTexCoord(vec2 coord) {
        return coord.x >= 0.0 && coord.x <= 1.0 &&
               coord.y >= 0.0 && coord.y <= 1.0;
    }

    // Contrast is modeled as lift/gamma/gain plus a mild highlight rolloff.
    // This gives useful visual range without crushing the fashion footage.
    vec3 sophisticatedContrast(vec3 color, float contrastLevel) {
        float invertedContrast = 1.0 - contrastLevel;
        float basicContrast = mix(0.95, 1.05, invertedContrast);
        float lift = mix(-0.02, 0.01, invertedContrast);
        float gamma = mix(1.02, 0.98, invertedContrast);
        float gain = mix(0.98, 1.02, invertedContrast);

        color = pow(max(vec3(0.0), color + lift), vec3(1.0 / gamma)) * gain;
        color = pow(max(vec3(0.0), color), vec3(basicContrast));

        float highlightCompress = mix(1.02, 0.98, invertedContrast);
        vec3 highlights = smoothstep(0.8, 0.95, color);
        color = mix(color, pow(max(vec3(0.0), color), vec3(highlightCompress)), highlights);

        float saturationCompensation = mix(1.02, 0.98, invertedContrast);
        vec3 desaturated = vec3(dot(color, vec3(0.2126, 0.7152, 0.0722)));
        return mix(desaturated, color, saturationCompensation);
    }

    // Temperature is split by luminance so highlights and shadows can lean
    // warm/cool differently instead of applying a flat RGB tint.
    vec3 colorGrade(vec3 color, float temperature) {
        vec3 coolHighlights = vec3(0.85, 0.95, 1.15);
        vec3 coolShadows = vec3(0.85, 0.95, 1.1);
        vec3 warmHighlights = vec3(1.15, 0.95, 0.85);
        vec3 warmShadows = vec3(1.1, 0.95, 0.85);

        float luminance = dot(color, vec3(0.2126, 0.7152, 0.0722));
        vec3 highlights = mix(coolHighlights, warmHighlights, smoothstep(0.2, 0.8, temperature));
        vec3 shadows = mix(coolShadows, warmShadows, smoothstep(0.2, 0.8, temperature));
        vec3 highlightAdjust = mix(vec3(1.0), highlights, smoothstep(0.4, 0.9, luminance));
        vec3 shadowAdjust = mix(vec3(1.0), shadows, smoothstep(0.8, 0.2, luminance));

        return color * highlightAdjust * shadowAdjust;
    }

    void main() {
        if (!isValidTexCoord(v_texCoord)) {
            gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
            return;
        }

        vec3 color = texture2D(u_videoTexture, v_texCoord).rgb;
        color = colorGrade(color, u_mouse.x);
        color = sophisticatedContrast(color, u_mouse.y);

        gl_FragColor = vec4(color, 1.0);
    }
`;

const createShader = (gl, type, source) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const message = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        throw new Error(message || 'Shader failed to compile');
    }

    return shader;
};

const createProgram = (gl) => {
    const vertexShader = createShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    const program = gl.createProgram();

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        const message = gl.getProgramInfoLog(program);
        gl.deleteProgram(program);
        throw new Error(message || 'Shader program failed to link');
    }

    return program;
};

const bindGeometry = (gl, program) => {
    const positions = new Float32Array([
        -1, -1,
        1, -1,
        -1, 1,
        -1, 1,
        1, -1,
        1, 1,
    ]);

    const positionBuffer = gl.createBuffer();
    const positionLocation = gl.getAttribLocation(program, 'a_position');

    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
};

const createVideoTexture = (gl) => {
    const texture = gl.createTexture();

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    // Seed with a valid pixel so the first frame can render before video data arrives.
    gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        1,
        1,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        new Uint8Array([0, 0, 0, 255]),
    );

    return texture;
};

export const createRenderer = (canvas) => {
    const gl = canvas.getContext('webgl');

    if (!gl) {
        throw new Error('WebGL not supported');
    }

    const program = createProgram(gl);
    gl.useProgram(program);
    bindGeometry(gl, program);

    const texture = createVideoTexture(gl);
    const uniforms = {
        videoTexture: gl.getUniformLocation(program, 'u_videoTexture'),
        resolution: gl.getUniformLocation(program, 'u_resolution'),
        mediaSize: gl.getUniformLocation(program, 'u_mediaSize'),
        mouse: gl.getUniformLocation(program, 'u_mouse'),
    };

    gl.uniform1i(uniforms.videoTexture, 0);
    gl.uniform2f(uniforms.mediaSize, 1, 1);
    gl.uniform2f(uniforms.mouse, 0.5, 0.5);
    gl.clearColor(0, 0, 0, 1);

    let source = null;
    let mouse = { x: 0.5, y: 0.5 };
    let running = false;
    let animationFrame = null;
    let lastRenderTime = 0;
    const frameInterval = 1000 / FRAME_RATE;

    const resize = () => {
        const container = canvas.parentElement || canvas;
        const pixelRatio = window.devicePixelRatio || 1;
        const width = Math.max(1, Math.floor(container.clientWidth * pixelRatio));
        const height = Math.max(1, Math.floor(container.clientHeight * pixelRatio));

        if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width;
            canvas.height = height;
        }

        // Canvas buffer size, viewport, and shader resolution must move together.
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
    };

    const uploadVideoFrame = () => {
        if (!source || source.readyState < source.HAVE_CURRENT_DATA) {
            return;
        }

        const size = getVideoSize(source);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        // Uploading the current HTMLVideoElement frame is the bridge from browser
        // decoding into the shader pipeline.
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
        gl.uniform2f(uniforms.mediaSize, size.width, size.height);
    };

    const render = (timestamp = 0) => {
        if (!running) {
            return;
        }

        if (!lastRenderTime || timestamp - lastRenderTime >= frameInterval) {
            lastRenderTime = timestamp;
            // Resize inside the loop so CSS/device-pixel changes are picked up
            // even when the browser does not emit a clean resize event.
            resize();
            uploadVideoFrame();
            gl.uniform2f(uniforms.mouse, mouse.x, mouse.y);
            gl.clear(gl.COLOR_BUFFER_BIT);
            gl.drawArrays(gl.TRIANGLES, 0, 6);
        }

        animationFrame = window.requestAnimationFrame(render);
    };

    return {
        setSource(video) {
            source = video;
            const size = getVideoSize(video);
            gl.uniform2f(uniforms.mediaSize, size.width, size.height);
            uploadVideoFrame();
        },

        setMouse(nextMouse) {
            mouse = nextMouse;
        },

        resize,

        start() {
            if (running) {
                return;
            }

            running = true;
            animationFrame = window.requestAnimationFrame(render);
        },

        stop() {
            running = false;

            if (animationFrame) {
                window.cancelAnimationFrame(animationFrame);
                animationFrame = null;
            }
        },

        dispose() {
            running = false;

            if (animationFrame) {
                window.cancelAnimationFrame(animationFrame);
                animationFrame = null;
            }

            gl.deleteTexture(texture);
            gl.deleteProgram(program);
        },
    };
};
