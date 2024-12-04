(() => {
    'use strict';
  
    // Add these at the very top of your IIFE
    let isDragging = false;
    let dividerPosition = 50; // Start at 50%
    let isSpaceMode = false;
    let isTimeMode = false;
  
    // At the very top of your IIFE, declare these ONCE:
    let audioStream = null;
    let audioContext, sourceNode, analyserNode;
    let lastBeatTime = 0;
    let chromaticStrength = 0;
    let lastVideoTime = 0;
    let currentTexture = null;
    let isImageLoaded = false;
    let mediaSizeLocation;
    let isAudioInitialized = false;
    let isAudioConnected = false;
    let reconnectAttempts = 0;
    let webcamStream = null;
    let webcamVideo = null;
    let startTime = null;
    let audioFrequency = 0;
    let timeOffset = 0;
    let timeOffsetLocation;
    let lastFrameTexture = null;
    let gl, program, videoTexture, webcamTexture;
    let resolutionLocation;
    let isSpaceModeLocation;
  
    // Add these variables at the top level inside the IIFE
    const BEAT_THRESHOLD = 0.80;  // Higher threshold for only strong beats
    const MIN_BEAT_INTERVAL = 100;  // Shorter interval to allow quick changes on strong beats
    const CHROMATIC_THRESHOLD = 0.80;  // Medium-strong beats threshold
  
    // Add at the top level inside the IIFE
    const videoTimestamps = new Map(); // Stores the last timestamp for each video URL
  
    // Add at the top level of your IIFE
    let mediaSources = [];  // Add this line to store both video and image sources
  
    // Add these state tracking variables at the top (around line 5-7)
    const MAX_RECONNECT_ATTEMPTS = 3;
  
    // Add these variables at the top with your other variables
  
    // Add this helper function to safely disconnect nodes
    function safeDisconnectNode(node) {
        if (node) {
            try {
                node.disconnect();
            } catch (err) {
                console.log('Node already disconnected');
            }
        }
    }
  
    // Functional helper to create and configure a video element
    const createVideoElement = (src) => {
      const video = document.createElement('video');
      video.src = src;
      video.crossOrigin = 'anonymous';
      video.loop = true;
      video.muted = true;
      video.autoplay = true;
      video.playsInline = true;
      document.body.appendChild(video);
      
      console.log('Created video element with src:', src);
      
      return video;
    };
  
    // Main function to initialize and run the application
    const init = async () => {
      const canvas = document.getElementById('glCanvas');
      gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
  
      if (!gl) {
        console.error('WebGL not supported');
        return;
      }
  
      // Adjust canvas size
      const resizeCanvas = () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      };
      window.addEventListener('resize', resizeCanvas);
      resizeCanvas();
  
      // Video sources array
      let videoSources = [
          'vid/C0008.MP4_Rendered_001.mp4', 
          'vid/C0016.MP4_Rendered_001.mp4', 
          'vid/C0014.MP4_Rendered_001.mp4', 
          'vid/C0022.MP4_Rendered_001.mp4'
      ];

      // Initialize mediaSources with the default videos
      mediaSources = videoSources.map(url => ({
          url: url,
          type: 'video'
      }));

      let currentVideoIndex = 0;

      // Initialize video with proper event handling
      let video = createVideoElement(videoSources[currentVideoIndex]);
      video.addEventListener('loadeddata', () => {
          isImageLoaded = true;
          currentTexture = video;
          gl.useProgram(program);
          gl.uniform2f(mediaSizeLocation, video.videoWidth, video.videoHeight);
          gl.bindTexture(gl.TEXTURE_2D, videoTexture);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
          
          // Set texture parameters
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

          // Start the render loop only after the first video is loaded
          requestAnimationFrame(render);
      });

      // Make sure video starts playing
      video.play().catch(err => {
          console.error('Error playing initial video:', err);
      });
  
      // Modified initAudio function
      const initAudio = async () => {
        try {
            if (!audioContext) {
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
                await audioContext.resume();
            }
            
            if (!analyserNode) {
                analyserNode = audioContext.createAnalyser();
                analyserNode.fftSize = 256;
            }
            
            if (!sourceNode && video && !audioStream) {
                sourceNode = audioContext.createMediaElementSource(video);
                sourceNode.connect(analyserNode);
            }
            
            return true;
        } catch (err) {
            console.error('Audio initialization failed:', err);
            return false;
        }
      };
  
      // Modified audio capture button listeners
      document.getElementById('startAudio').addEventListener('click', async () => {
        try {
            // Clean up existing connections first
            if (sourceNode) {
                safeDisconnectNode(sourceNode);
                sourceNode = null;
            }
            if (analyserNode) {
                safeDisconnectNode(analyserNode);
                analyserNode = null;
            }

            // Create new analyzer
            analyserNode = audioContext.createAnalyser();
            analyserNode.fftSize = 256;

            const stream = await navigator.mediaDevices.getDisplayMedia({ 
                video: true,
                audio: true 
            });
            
            const audioTrack = stream.getAudioTracks()[0];
            if (audioTrack) {
                audioStream = new MediaStream([audioTrack]);
                sourceNode = audioContext.createMediaStreamSource(audioStream);
                sourceNode.connect(analyserNode);
                
                document.getElementById('startAudio').style.display = 'none';
                document.getElementById('stopAudio').style.display = 'block';
            }
            
            stream.getVideoTracks().forEach(track => track.stop());
            
        } catch (error) {
            console.error('Error starting audio capture:', error);
            // Reset nodes on error
            sourceNode = null;
            analyserNode = null;
            document.getElementById('startAudio').style.display = 'block';
            document.getElementById('stopAudio').style.display = 'none';
        }
        updateControlsVisibility();
      });
  
      // Modified stop audio handler
      document.getElementById('stopAudio').addEventListener('click', () => {
        if (audioStream) {
            audioStream.getTracks().forEach(track => track.stop());
            audioStream = null;
        }
        
        safeDisconnectNode(sourceNode);
        sourceNode = null;
        
        safeDisconnectNode(analyserNode);
        analyserNode = null;
        
        document.getElementById('startAudio').style.display = 'block';
        document.getElementById('stopAudio').style.display = 'none';
        updateControlsVisibility();
      });
  
      // Add shader sources here
      const vertexShaderSource = `
          attribute vec2 a_position;
          varying vec2 v_texCoord;
          uniform vec2 u_resolution;
          uniform vec2 u_mediaSize;
          uniform bool u_isSpaceMode;

          void main() {
              // Calculate aspect ratios
              float viewportAspect = u_resolution.x / u_resolution.y;
              float mediaAspect = u_mediaSize.x / u_mediaSize.y;
              
              vec2 scale;
              if (u_isSpaceMode) {
                  // In space mode, use half the viewport width
                  viewportAspect *= 0.5;  // Half the viewport aspect
              }
              
              // Scale to fit viewport while maintaining aspect ratio
              if (mediaAspect > viewportAspect) {
                  // Media is wider than viewport
                  scale = vec2(1.0, 1.0 / mediaAspect * viewportAspect);
              } else {
                  // Media is taller than viewport
                  scale = vec2(mediaAspect / viewportAspect, 1.0);
              }
              
              gl_Position = vec4(a_position * scale, 0, 1);
              v_texCoord = (a_position + 1.0) / 2.0;
          }
      `;

      const fragmentShaderSource = `
          precision mediump float;
          uniform sampler2D u_videoTexture;
          uniform vec2 u_mouse;
          uniform float u_audioFreq;
          uniform float u_timeOffset;
          uniform float u_chromaticStrength;
          uniform bool u_isSpaceMode;
          varying vec2 v_texCoord;

          void main() {
              vec2 texCoord = v_texCoord;
              
              if (u_isSpaceMode && gl_FragCoord.x > gl_FragCoord.y / 2.0) {
                  discard;
              }
              
              vec4 videoColor = texture2D(u_videoTexture, texCoord);
              gl_FragColor = videoColor;
          }
      `;

      // Create shader program
      const createShader = (gl, type, source) => {
          const shader = gl.createShader(type);
          gl.shaderSource(shader, source);
          gl.compileShader(shader);
          
          if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
              console.error(gl.getShaderInfoLog(shader));
              gl.deleteShader(shader);
              return null;
          }
          return shader;
      };

      const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
      const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
      
      program = gl.createProgram();
      gl.attachShader(program, vertexShader);
      gl.attachShader(program, fragmentShader);
      gl.linkProgram(program);
      
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
          console.error('Unable to initialize the shader program:', gl.getProgramInfoLog(program));
          return;
      }
      
      gl.useProgram(program);
      
      // Get uniform locations
      isSpaceModeLocation = gl.getUniformLocation(program, 'u_isSpaceMode');
      resolutionLocation = gl.getUniformLocation(program, 'u_resolution');
      mediaSizeLocation = gl.getUniformLocation(program, 'u_mediaSize');

      // Set up buffers
      const positionBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      const positions = new Float32Array([
          -1, -1,
           1, -1,
          -1,  1,
          -1,  1,
           1, -1,
           1,  1,
      ]);
      gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

      const texCoordBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
      const texCoords = new Float32Array([
          0, 1,
          1, 1,
          0, 0,
          0, 0,
          1, 1,
          1, 0,
      ]);
      gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW);

      // Set up attributes
      const positionLocation = gl.getAttribLocation(program, 'a_position');
      const texCoordLocation = gl.getAttribLocation(program, 'a_texCoord');

      // Set up uniforms
      const mouseLocation = gl.getUniformLocation(program, 'u_mouse');
      const timeLocation = gl.getUniformLocation(program, 'u_time');
      const audioFreqLocation = gl.getUniformLocation(program, 'u_audioFreq');
      const cursorSpeedLocation = gl.getUniformLocation(program, 'u_cursorSpeed');
      const oldFilmEffectLocation = gl.getUniformLocation(program, 'u_oldFilmEffect');
      const chromaticStrengthLocation = gl.getUniformLocation(program, 'u_chromaticStrength');
      const timeOffsetLocation = gl.getUniformLocation(program, 'u_timeOffset');
      const lastFrameTextureLocation = gl.getUniformLocation(program, 'u_lastFrameTexture');

      // Create and set up texture
      const videoTexture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, videoTexture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

      // Mouse tracking
      const mouse = {
          x: 0.5,
          y: 0.5,
          lastX: 0,
          lastY: 0,
          velocity: 0,
          lastTime: 0
      };

      let oldFilmEffect = false;

      // Event listeners
      window.addEventListener('mousemove', (e) => {
          const currentTime = performance.now();
          const deltaTime = (currentTime - mouse.lastTime) / 1000;
          
          const dx = e.clientX - mouse.lastX;
          const dy = e.clientY - mouse.lastY;
          mouse.velocity = Math.sqrt(dx*dx + dy*dy) / deltaTime;
          mouse.velocity = Math.min(mouse.velocity / 1000, 1.0);
          
          mouse.lastX = e.clientX;
          mouse.lastY = e.clientY;
          mouse.x = e.clientX / gl.canvas.width;
          mouse.y = 1 - e.clientY / gl.canvas.height;
          mouse.lastTime = currentTime;

          // Update UI to reflect cursor position
          if (!audioStream) {
              // Update temperature bar (mouse.x)
              const tempFill = document.querySelector('.temp-fill');
              const tempValue = document.querySelector('.temp-value');
              const tempPercentage = Math.round(mouse.x * 100);
              tempFill.style.width = `${tempPercentage}%`;
              tempValue.textContent = `${tempPercentage}%`;

              // Update contrast bar (mouse.y)
              const contrastFill = document.querySelector('.contrast-fill');
              const contrastValue = document.querySelector('.contrast-value');
              const contrastPercentage = Math.round(mouse.y * 100);
              contrastFill.style.width = `${contrastPercentage}%`;
              contrastValue.textContent = `${contrastPercentage}%`;
          }
      });

      canvas.addEventListener('click', (e) => {
          // Only toggle if the click was on the canvas, not the buttons
          if (e.target === canvas) {
              oldFilmEffect = !oldFilmEffect;
          }
      });

      // Modified double-click handler
      window.addEventListener('dblclick', () => {
          video.pause();
          currentVideoIndex = (currentVideoIndex + 1) % videoSources.length;
          video.src = videoSources[currentVideoIndex];
          video.play();
          
          // Don't reinitialize audio if we have a stream
          if (!audioStream) {
              initAudio();
          }
      });

      // Add at the top with your other variables
      let audioFrequency = 0;  // Default value when no audio

      // NOW define the render function
      const render = (timestamp) => {
          if (!startTime) startTime = timestamp;
          
          // Set viewport based on mode
          if (isSpaceMode) {
              gl.viewport(0, 0, gl.canvas.width / 2, gl.canvas.height);
          } else {
              gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
          }
          
          gl.clear(gl.COLOR_BUFFER_BIT);
          
          // Update uniforms
          gl.uniform2f(resolutionLocation, isSpaceMode ? gl.canvas.width / 2 : gl.canvas.width, gl.canvas.height);
          gl.uniform1i(isSpaceModeLocation, isSpaceMode ? 1 : 0);
          
          if (video.readyState >= video.HAVE_METADATA) {
              gl.uniform2f(mediaSizeLocation, video.videoWidth, video.videoHeight);
          }
          
          // Draw
          if (mediaSources[currentVideoIndex]?.type === 'video' && video.readyState >= video.HAVE_CURRENT_DATA) {
              gl.bindTexture(gl.TEXTURE_2D, videoTexture);
              gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
          }
          
          gl.drawArrays(gl.TRIANGLES, 0, 6);
          requestAnimationFrame(render);
      };

      // Start render loop
      requestAnimationFrame(render);

      // Update the video canplay listener to only init audio after user interaction
      video.addEventListener('canplay', () => {
          requestAnimationFrame(render);
      });

      // Add this event listener after your other event listeners
      window.addEventListener('keydown', (e) => {
          console.log('Key pressed:', e.code); // Debug log
          
          // Only allow arrow key controls when not connected to audio
          if (!audioStream) {
              console.log('No audio stream, should change video'); // Debug log
              let newIndex;
              switch(e.code) {
                  case 'ArrowRight':
                  case 'ArrowDown':
                      console.log('Current index:', currentVideoIndex); // Debug log
                      console.log('Media sources:', mediaSources); // Debug log
                      newIndex = (currentVideoIndex + 1) % mediaSources.length;
                      console.log('New index:', newIndex); // Debug log
                      loadMedia(newIndex);
                      break;
                      
                  case 'ArrowLeft':
                  case 'ArrowUp':
                      console.log('Current index:', currentVideoIndex); // Debug log
                      newIndex = (currentVideoIndex - 1 + mediaSources.length) % mediaSources.length;
                      console.log('New index:', newIndex); // Debug log
                      loadMedia(newIndex);
                      break;
              }
          } else {
              console.log('Audio stream connected, ignoring arrow keys'); // Debug log
          }
      });

      // Add at the top level inside init()
      const videoControls = document.querySelector('.video-controls');
      const tempBar = document.querySelector('.temp-bar');
      const contrastBar = document.querySelector('.contrast-bar');
      const tempValue = document.querySelector('.temp-value');
      const contrastValue = document.querySelector('.contrast-value');

      // Show/hide controls based on audio connection
      const updateControlsVisibility = () => {
          videoControls.style.display = audioStream ? 'none' : 'block';
      };

      // Update initial visibility
      updateControlsVisibility();

      // Handle control bar clicks
      const handleBarClick = (e, bar, fill, value, isTemp) => {
          const rect = bar.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
          
          fill.style.width = `${percentage}%`;
          value.textContent = `${Math.round(percentage)}%`;
          
          if (isTemp) {
              mouse.x = percentage / 100;
          } else {
              mouse.y = percentage / 100;
          }
      };

      tempBar.addEventListener('click', (e) => {
          if (!audioStream) {
              handleBarClick(e, tempBar, tempBar.querySelector('.temp-fill'), tempValue, true);
          }
      });

      contrastBar.addEventListener('click', (e) => {
          if (!audioStream) {
              handleBarClick(e, contrastBar, contrastBar.querySelector('.contrast-fill'), contrastValue, false);
          }
      });

      // Add to your JavaScript initialization
      const mediaUpload = document.getElementById('mediaUpload');
      if (mediaUpload) {
          mediaUpload.addEventListener('change', (e) => {
              const files = Array.from(e.target.files);
              
              if (files.length > 0) {
                  // Filter for both video and image files
                  const newMediaSources = files
                      .filter(file => file.type.startsWith('video/') || file.type.startsWith('image/'))
                      .map(file => ({
                          url: URL.createObjectURL(file),
                          type: file.type.startsWith('video/') ? 'video' : 'image'
                      }));
                  
                  if (newMediaSources.length > 0) {
                      // Clean up old object URLs
                      videoSources.forEach(url => {
                          if (url.startsWith('blob:')) {
                              URL.revokeObjectURL(url);
                          }
                      });
                      
                      // Store all media sources
                      mediaSources = newMediaSources;
                      videoSources = newMediaSources.map(media => media.url);
                      currentVideoIndex = 0;
                      
                      // Load first media
                      loadMedia(0);
                  }
              }
          });
      } else {
          console.log('Upload element not found');
      }

      // Add cleanup on page unload
      window.addEventListener('beforeunload', () => {
          videoSources.forEach(url => {
              if (url.startsWith('blob:')) {
                  URL.revokeObjectURL(url);
              }
          });
      });

      // Add to your init function
      window.addEventListener('load', () => {
          // Remove banner after animation
          setTimeout(() => {
              const banner = document.querySelector('.intro-banner');
              if (banner) {
                  banner.remove();
              }
          }, 2500); // Slightly longer than animation to ensure smooth fade
      });

      // Update the loadMedia function
      function loadMedia(index) {
          console.log('Loading media at index:', index);
          const media = mediaSources[index];
          console.log('Media to load:', media);
          currentVideoIndex = index;

          if (media.type === 'video') {
              video.pause();
              video.src = media.url;
              video.load();
              console.log('Video element:', video);
              console.log('Video src set to:', media.url);
              
              video.onloadeddata = () => {
                  console.log('Video loaded data');
                  isImageLoaded = true;
                  gl.uniform2f(mediaSizeLocation, video.videoWidth, video.videoHeight);
                  video.play().catch(e => console.error('Video play error:', e));
              };
          } else if (media.type === 'image') {
              // For images
              video.pause();
              video.src = '';
              video.load();
              video.style.display = 'none';
              
              const img = new Image();
              img.crossOrigin = 'anonymous';
              
              img.onerror = (err) => {
                  console.error('Error loading image:', err);
                  isImageLoaded = false;
              };
              
              img.onload = () => {
                  try {
                      isImageLoaded = true;
                      currentTexture = img;
                      gl.useProgram(program);
                      gl.uniform2f(mediaSizeLocation, img.naturalWidth, img.naturalHeight);
                      gl.bindTexture(gl.TEXTURE_2D, videoTexture);
                      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
                      
                      // Set texture parameters
                      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
                      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
                  } catch (err) {
                      console.error('Error binding image to texture:', err);
                      isImageLoaded = false;
                  }
              };
              
              img.src = media.url;
          }
      }

      // Update video ended handler (around line 787-792)
      video.addEventListener('ended', () => {
          const fileName = video.src.split('/').pop();
          videoTimestamps.set(fileName, 0);  // Reset timestamp when video ends
          video.currentTime = 0;
          video.play();
      });

      // Debug helper
      function logTimestamps() {
          console.log('Current timestamps:');
          videoTimestamps.forEach((time, url) => {
              console.log(url, ':', Math.round(time * 100) + '%');
          });
      }

      // Make sure video is ready to seek
      video.preload = 'auto';
    };
  
    // Run the application
    window.addEventListener('load', init);

    // Add these right after your init() function
    document.addEventListener('DOMContentLoaded', () => {
        console.log('Setting up event listeners');
        
        // Add these two lines right after console.log('Setting up event listeners');
        let isDragging = false;
        let dividerPosition = 50; // Start at 50%

        // Add divider element
        document.body.insertAdjacentHTML('beforeend', `
            <div id="videosDivider" style="
                display: none;
                position: fixed;
                top: 0;
                left: 50%;
                width: 4px;
                height: 100vh;
                background: rgba(255, 255, 255, 0.5);
                cursor: ew-resize;
                z-index: 100;
            "></div>
        `);

        // Add this HTML after the divider is created
        document.body.insertAdjacentHTML('beforeend', `
            <div id="dragGuide" style="
                display: none;
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: rgba(0,0,0,0.7);
                color: white;
                padding: 15px 25px;
                border-radius: 25px;
                font-family: 'Bodoni Moda', serif;
                letter-spacing: 2px;
                z-index: 101;
                opacity: 0;
                transition: opacity 0.5s ease;
            ">
                drag to adjust split
            </div>
        `);

        // Add this HTML for the space mode options
        document.body.insertAdjacentHTML('beforeend', `
            <div id="spaceOptions" style="
                display: none;
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: rgba(0,0,0,0.9);
                color: white;
                padding: 30px;
                border-radius: 15px;
                font-family: 'Bodoni Moda', serif;
                z-index: 101;
                text-align: center;
            ">
                <h3 style="margin: 0 0 20px 0; letter-spacing: 2px;">CHOOSE SPACE SOURCE</h3>
                <button id="useWebcamSpace" class="mode-btn" style="margin: 10px;">USE WEBCAM</button>
                <button id="uploadVideoSpace" class="mode-btn" style="margin: 10px;">UPLOAD VIDEO</button>
                <input type="file" id="spaceVideoUpload" accept="video/*" style="display: none;">
            </div>
        `);

        // Update the remixSpace click handler
        document.getElementById('remixSpace').addEventListener('click', () => {
            document.getElementById('spaceOptions').style.display = 'block';
            document.querySelector('.mode-selection').style.display = 'none';
        });

        // Add handlers for the new buttons
        document.getElementById('useWebcamSpace').addEventListener('click', async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                webcamStream = stream;
                webcamVideo = document.getElementById('webcamVideo');
                webcamVideo.srcObject = stream;
                
                // Show webcam and divider
                webcamVideo.style.display = 'block';
                document.getElementById('webcamContainer').style.display = 'block';
                document.getElementById('videosDivider').style.display = 'block';
                document.getElementById('spaceOptions').style.display = 'none';
                
                // Setup drag handlers
                document.getElementById('videosDivider').addEventListener('mousedown', startDragging);
                document.addEventListener('mousemove', handleDrag);
                document.addEventListener('mouseup', () => isDragging = false);
                
                isSpaceMode = true;
                
                // Show drag guide
                const dragGuide = document.getElementById('dragGuide');
                dragGuide.style.display = 'block';
                setTimeout(() => {
                    dragGuide.style.opacity = '1';
                    setTimeout(() => {
                        dragGuide.style.opacity = '0';
                        setTimeout(() => {
                            dragGuide.style.display = 'none';
                        }, 500);
                    }, 2000);
                }, 100);
                
            } catch (err) {
                console.error('Webcam error:', err);
            }
        });

        document.getElementById('uploadVideoSpace').addEventListener('click', () => {
            document.getElementById('spaceVideoUpload').click();
        });

        document.getElementById('spaceVideoUpload').addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                const file = e.target.files[0];
                const url = URL.createObjectURL(file);
                
                webcamVideo = document.getElementById('webcamVideo');
                webcamVideo.src = url;
                webcamVideo.style.display = 'block';
                document.getElementById('webcamContainer').style.display = 'block';
                document.getElementById('videosDivider').style.display = 'block';
                document.getElementById('spaceOptions').style.display = 'none';
                
                // Setup drag handlers
                document.getElementById('videosDivider').addEventListener('mousedown', startDragging);
                document.addEventListener('mousemove', handleDrag);
                document.addEventListener('mouseup', () => isDragging = false);
                
                isSpaceMode = true;
                
                // Show drag guide
                const dragGuide = document.getElementById('dragGuide');
                dragGuide.style.display = 'block';
                setTimeout(() => {
                    dragGuide.style.opacity = '1';
                    setTimeout(() => {
                        dragGuide.style.opacity = '0';
                        setTimeout(() => {
                            dragGuide.style.display = 'none';
                        }, 500);
                    }, 2000);
                }, 100);
            }
        });

        // Add these inside your existing DOMContentLoaded event handler, 
        // right after console.log('Setting up event listeners');
        document.addEventListener('mousedown', (e) => {
            if (e.target.id === 'videosDivider') {
                isDragging = true;
            }
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging || !isSpaceMode) return;
            
            dividerPosition = (e.clientX / window.innerWidth) * 100;
            dividerPosition = Math.max(20, Math.min(80, dividerPosition));
            
            const glCanvas = document.getElementById('glCanvas');
            const divider = document.getElementById('videosDivider');
            const webcamContainer = document.getElementById('webcamContainer');
            
            // Update WebGL canvas
            glCanvas.style.width = `${dividerPosition}%`;
            glCanvas.width = Math.floor(window.innerWidth * (dividerPosition / 100));
            gl.viewport(0, 0, glCanvas.width, glCanvas.height);
            
            // Update webcam container
            webcamContainer.style.width = `${100 - dividerPosition}%`;
            
            // Update divider position
            divider.style.left = `${dividerPosition}%`;
        });

        document.addEventListener('mouseup', () => {
            isDragging = false;
        });

        // Add this HTML for the time mode options (add near line 726)
        document.body.insertAdjacentHTML('beforeend', `
            <div id="timeOptions" style="
                display: none;
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: rgba(0,0,0,0.9);
                color: white;
                padding: 30px;
                border-radius: 15px;
                font-family: 'Bodoni Moda', serif;
                z-index: 101;
                text-align: center;
            ">
                <h3 style="margin: 0 0 20px 0; letter-spacing: 2px;">CHOOSE TIME SOURCE</h3>
                <button id="useWebcamTime" class="mode-btn" style="margin: 10px;">USE WEBCAM</button>
                <button id="uploadVideoTime" class="mode-btn" style="margin: 10px;">UPLOAD VIDEO</button>
                <input type="file" id="timeVideoUpload" accept="video/*" style="display: none;">
            </div>
        `);

        // Modify the remixTime click handler (around line 866)
        document.getElementById('remixTime').addEventListener('click', () => {
            document.getElementById('timeOptions').style.display = 'block';
            document.querySelector('.mode-selection').style.display = 'none';
        });

        // Add handlers for time mode options
        document.getElementById('useWebcamTime').addEventListener('click', async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                webcamStream = stream;
                webcamVideo = document.getElementById('webcamVideo');
                webcamVideo.srcObject = stream;
                webcamVideo.style.display = 'block';
                document.getElementById('webcamContainer').style.display = 'block';
                document.getElementById('timeOptions').style.display = 'none';
                
                isTimeMode = true;
                isSpaceMode = false;
                
                startTimeOverlay();
                
            } catch (err) {
                console.error('Webcam error:', err);
            }
        });

        document.getElementById('uploadVideoTime').addEventListener('click', () => {
            document.getElementById('timeVideoUpload').click();
        });

        document.getElementById('timeVideoUpload').addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                const file = e.target.files[0];
                const url = URL.createObjectURL(file);
                
                webcamVideo = document.getElementById('webcamVideo');
                webcamVideo.src = url;
                webcamVideo.style.display = 'block';
                document.getElementById('webcamContainer').style.display = 'block';
                document.getElementById('timeOptions').style.display = 'none';
                
                isTimeMode = true;
                isSpaceMode = false;
                
                startTimeOverlay();
            }
        });
    });

    // Add window resize handler
    window.addEventListener('resize', () => {
        const glCanvas = document.getElementById('glCanvas');
        if (glCanvas) {
            glCanvas.width = window.innerWidth;
            glCanvas.height = window.innerHeight;
            if (isSpaceMode) {
                gl.viewport(0, 0, glCanvas.width / 2, glCanvas.height);
            } else {
                gl.viewport(0, 0, glCanvas.width, glCanvas.height);
            }
        }
    });

    // Add this function to handle the temporal overlay
    function startTimeOverlay() {
        let startTime = performance.now();
        let randomOffset = 0;

        function updateOpacity() {
            if (!isTimeMode) return;
            
            const time = performance.now() - startTime;
            // Slower, more ethereal oscillation
            const base = Math.sin(time * 0.0002 * Math.PI / 2); // Even slower cycle
            const secondary = Math.cos(time * 0.0001 * Math.PI / 2); // Secondary wave
            
            // Create a dreamy compound wave
            const dreamyWave = (base * 0.7 + secondary * 0.3);
            
            // Add subtle random variation for organic feel
            if (base < -0.95) randomOffset = Math.random() * 0.15;
            
            // Softer opacity range for dreamier look
            const opacity = Math.max(0.1, Math.min(0.75, (dreamyWave + 1) * 0.35 + randomOffset));
            
            if (webcamVideo && document.getElementById('webcamContainer')) {
                const container = document.getElementById('webcamContainer');
                container.style.opacity = opacity.toString();
                // Dreamy blend modes that cycle
                const blendModes = ['soft-light', 'overlay', 'screen'];
                const blendIndex = Math.floor((time * 0.001) % blendModes.length);
                container.style.mixBlendMode = blendModes[blendIndex];
                
                // Add a subtle blur that varies with the opacity
                const blurAmount = (1 - opacity) * 5;
                container.style.filter = `blur(${blurAmount}px) brightness(1.1)`;
                
                // Add subtle scale animation
                const scale = 1 + Math.sin(time * 0.0003) * 0.05;
                webcamVideo.style.transform = `scaleX(-1) scale(${scale})`;
                webcamVideo.style.transition = 'transform 0.5s ease-out';
            }
            
            requestAnimationFrame(updateOpacity);
        }

        requestAnimationFrame(updateOpacity);
    }

    // Add this new function for space mode effects
    function startSpaceOverlay() {
        let startTime = performance.now();
        let randomOffset = 0;

        function updateDyptich() {
            if (!isSpaceMode) return;
            
            const time = performance.now() - startTime;
            const base = Math.sin(time * 0.0002 * Math.PI / 2);
            const secondary = Math.cos(time * 0.0001 * Math.PI / 2);
            
            // Create dreamy compound wave
            const dreamyWave = (base * 0.7 + secondary * 0.3);
            
            if (base < -0.95) randomOffset = Math.random() * 0.15;
            
            const opacity = Math.max(0.1, Math.min(0.75, (dreamyWave + 1) * 0.35 + randomOffset));
            
            if (webcamVideo && document.getElementById('webcamContainer')) {
                const container = document.getElementById('webcamContainer');
                container.style.opacity = opacity.toString();
                
                // Cycle through blend modes
                const blendModes = ['soft-light', 'overlay', 'screen'];
                const blendIndex = Math.floor((time * 0.001) % blendModes.length);
                container.style.mixBlendMode = blendModes[blendIndex];
                
                // Dynamic blur effect
                const blurAmount = (1 - opacity) * 5;
                container.style.filter = `blur(${blurAmount}px) brightness(1.1)`;
                
                // Subtle scale breathing animation
                const scale = 1 + Math.sin(time * 0.0003) * 0.05;
                webcamVideo.style.transform = `scaleX(-1) scale(${scale})`;
                webcamVideo.style.transition = 'transform 0.5s ease-out';
                
                // Add subtle position drift
                const drift = Math.sin(time * 0.0001) * 2;
                container.style.transform = `translateX(${drift}px)`;
                container.style.transition = 'transform 1s ease-out';
            }
            
            requestAnimationFrame(updateDyptich);
        }

        requestAnimationFrame(updateDyptich);
    }

    function startDragging() {
        isDragging = true;
    }

    function handleDrag(e) {
        if (!isDragging || !isSpaceMode) return;
        
        dividerPosition = (e.clientX / window.innerWidth) * 100;
        dividerPosition = Math.max(20, Math.min(80, dividerPosition));
        
        const glCanvas = document.getElementById('glCanvas');
        const divider = document.getElementById('videosDivider');
        const webcamContainer = document.getElementById('webcamContainer');
        
        // Update WebGL canvas
        glCanvas.style.width = `${dividerPosition}%`;
        glCanvas.width = Math.floor(window.innerWidth * (dividerPosition / 100));
        gl.viewport(0, 0, glCanvas.width, glCanvas.height);
        
        // Update webcam container
        webcamContainer.style.width = `${100 - dividerPosition}%`;
        
        // Update divider position
        divider.style.left = `${dividerPosition}%`;
    }

    // Add these event listeners at the document level
    document.addEventListener('mousedown', (e) => {
        if (e.target.id === 'videosDivider') {
            isDragging = true;
        }
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging || !isSpaceMode) return;
        
        dividerPosition = (e.clientX / window.innerWidth) * 100;
        dividerPosition = Math.max(20, Math.min(80, dividerPosition));
        
        const glCanvas = document.getElementById('glCanvas');
        const divider = document.getElementById('videosDivider');
        const webcamContainer = document.getElementById('webcamContainer');
        
        // Update WebGL canvas
        glCanvas.style.width = `${dividerPosition}%`;
        glCanvas.width = Math.floor(window.innerWidth * (dividerPosition / 100));
        gl.viewport(0, 0, glCanvas.width, glCanvas.height);
        
        // Update webcam container
        webcamContainer.style.width = `${100 - dividerPosition}%`;
        
        // Update divider position
        divider.style.left = `${dividerPosition}%`;
    });

    document.addEventListener('mouseup', () => {
        isDragging = false;
    });
  })();