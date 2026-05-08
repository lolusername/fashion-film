(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const o of document.querySelectorAll('link[rel="modulepreload"]'))r(o);new MutationObserver(o=>{for(const n of o)if(n.type==="childList")for(const c of n.addedNodes)c.tagName==="LINK"&&c.rel==="modulepreload"&&r(c)}).observe(document,{childList:!0,subtree:!0});function i(o){const n={};return o.integrity&&(n.integrity=o.integrity),o.referrerPolicy&&(n.referrerPolicy=o.referrerPolicy),o.crossOrigin==="use-credentials"?n.credentials="include":o.crossOrigin==="anonymous"?n.credentials="omit":n.credentials="same-origin",n}function r(o){if(o.ep)return;o.ep=!0;const n=i(o);fetch(o.href,n)}})();const x=[{type:"video",url:new URL("/assets/C0022.MP4_Rendered_001-BpawasVQ.mp4",import.meta.url).href},{type:"video",url:new URL("/assets/C0016.MP4_Rendered_001-eXdqX6LN.mp4",import.meta.url).href},{type:"video",url:new URL("/assets/C0014.MP4_Rendered_001-D37TiLwW.mp4",import.meta.url).href},{type:"video",url:new URL("/assets/C0008.MP4_Rendered_001-6c_si4_N.mp4",import.meta.url).href}],A=30,R=2500,g=e=>{const t=document.getElementById(e);if(!t)throw new Error(`Missing required element: #${e}`);return t},E=(e,t,i)=>Math.max(t,Math.min(i,e)),y=e=>{var t;return(t=e.touches)!=null&&t.length?{x:e.touches[0].clientX,y:e.touches[0].clientY}:{x:e.clientX,y:e.clientY}},L=(e,t)=>{const i=y(e),r=t.getBoundingClientRect();return{x:E((i.x-r.left)/r.width,0,1),y:E(1-(i.y-r.top)/r.height,0,1)}},S=()=>{const e=document.createElement("video");return e.crossOrigin="anonymous",e.loop=!1,e.muted=!0,e.autoplay=!0,e.playsInline=!0,e.preload="auto",e.style.display="none",document.body.appendChild(e),e},C=e=>e.readyState>=e.HAVE_METADATA?Promise.resolve():new Promise((t,i)=>{const r=()=>{e.removeEventListener("loadedmetadata",o),e.removeEventListener("error",n)},o=()=>{r(),t()},n=()=>{r(),i(new Error("Video failed to load"))};e.addEventListener("loadedmetadata",o,{once:!0}),e.addEventListener("error",n,{once:!0})}),P=async e=>{try{await e.play()}catch(t){console.error("Video play failed:",t)}},T=e=>({width:e.videoWidth||1,height:e.videoHeight||1}),U=({sources:e,renderer:t})=>{const i=S();let r=0,o=0;const n=async s=>{if(!e.length)return;const l=++o,m=e[s];r=s,i.src=m.url,i.load(),await C(i),l===o&&(t.setSource(i),await P(i))},c=()=>n((r+1)%e.length),d=()=>n((r-1+e.length)%e.length);return i.addEventListener("ended",()=>{c()}),{load:n,next:c,previous:d,get currentIndex(){return r},get activeMedia(){return i}}},D=`
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
`,I=`
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
`,_=(e,t,i)=>{const r=e.createShader(t);if(e.shaderSource(r,i),e.compileShader(r),!e.getShaderParameter(r,e.COMPILE_STATUS)){const o=e.getShaderInfoLog(r);throw e.deleteShader(r),new Error(o||"Shader failed to compile")}return r},M=e=>{const t=_(e,e.VERTEX_SHADER,D),i=_(e,e.FRAGMENT_SHADER,I),r=e.createProgram();if(e.attachShader(r,t),e.attachShader(r,i),e.linkProgram(r),e.deleteShader(t),e.deleteShader(i),!e.getProgramParameter(r,e.LINK_STATUS)){const o=e.getProgramInfoLog(r);throw e.deleteProgram(r),new Error(o||"Shader program failed to link")}return r},b=(e,t)=>{const i=new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),r=e.createBuffer(),o=e.getAttribLocation(t,"a_position");e.bindBuffer(e.ARRAY_BUFFER,r),e.bufferData(e.ARRAY_BUFFER,i,e.STATIC_DRAW),e.enableVertexAttribArray(o),e.vertexAttribPointer(o,2,e.FLOAT,!1,0,0)},F=e=>{const t=e.createTexture();return e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,t),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),e.texImage2D(e.TEXTURE_2D,0,e.RGBA,1,1,0,e.RGBA,e.UNSIGNED_BYTE,new Uint8Array([0,0,0,255])),t},X=e=>{const t=e.getContext("webgl");if(!t)throw new Error("WebGL not supported");const i=M(t);t.useProgram(i),b(t,i);const r=F(t),o={videoTexture:t.getUniformLocation(i,"u_videoTexture"),resolution:t.getUniformLocation(i,"u_resolution"),mediaSize:t.getUniformLocation(i,"u_mediaSize"),mouse:t.getUniformLocation(i,"u_mouse")};t.uniform1i(o.videoTexture,0),t.uniform2f(o.mediaSize,1,1),t.uniform2f(o.mouse,.5,.5),t.clearColor(0,0,0,1);let n=null,c={x:.5,y:.5},d=!1,s=null,l=0;const m=1e3/A,h=()=>{const a=e.parentElement||e,u=window.devicePixelRatio||1,w=Math.max(1,Math.floor(a.clientWidth*u)),v=Math.max(1,Math.floor(a.clientHeight*u));(e.width!==w||e.height!==v)&&(e.width=w,e.height=v),t.viewport(0,0,e.width,e.height),t.uniform2f(o.resolution,e.width,e.height)},f=()=>{if(!n||n.readyState<n.HAVE_CURRENT_DATA)return;const a=T(n);t.activeTexture(t.TEXTURE0),t.bindTexture(t.TEXTURE_2D,r),t.texImage2D(t.TEXTURE_2D,0,t.RGBA,t.RGBA,t.UNSIGNED_BYTE,n),t.uniform2f(o.mediaSize,a.width,a.height)},p=(a=0)=>{d&&((!l||a-l>=m)&&(l=a,h(),f(),t.uniform2f(o.mouse,c.x,c.y),t.clear(t.COLOR_BUFFER_BIT),t.drawArrays(t.TRIANGLES,0,6)),s=window.requestAnimationFrame(p))};return{setSource(a){n=a;const u=T(a);t.uniform2f(o.mediaSize,u.width,u.height),f()},setMouse(a){c=a},resize:h,start(){d||(d=!0,s=window.requestAnimationFrame(p))},stop(){d=!1,s&&(window.cancelAnimationFrame(s),s=null)},dispose(){d=!1,s&&(window.cancelAnimationFrame(s),s=null),t.deleteTexture(r),t.deleteProgram(i)}}},N=()=>{Array.from(document.querySelectorAll(".intro-text")).forEach((t,i)=>{window.setTimeout(()=>{t.classList.add("intro-text--visible")},i*200)}),window.setTimeout(()=>{document.documentElement.style.setProperty("--banner-opacity","0")},R)},z=async()=>{const e=g("glCanvas"),t=X(e),i=U({sources:x,renderer:t}),r=o=>{t.setMouse(L(o,e))};window.addEventListener("mousemove",r),window.addEventListener("touchstart",o=>{o.preventDefault(),r(o)},{passive:!1}),window.addEventListener("touchmove",o=>{o.preventDefault(),r(o)},{passive:!1}),window.addEventListener("keydown",o=>{(o.code==="ArrowRight"||o.code==="ArrowDown")&&i.next(),(o.code==="ArrowLeft"||o.code==="ArrowUp")&&i.previous()}),window.addEventListener("resize",t.resize),window.addEventListener("orientationchange",t.resize),window.addEventListener("beforeunload",()=>{t.dispose()}),N(),t.start(),await i.load(0)};window.addEventListener("DOMContentLoaded",()=>{z().catch(e=>{console.error("App failed to initialize:",e)})});
