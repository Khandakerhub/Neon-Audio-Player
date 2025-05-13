// Declare this variable in the outer scope, within the DOMContentLoaded listener
		let zeroGainPixelTop = 0; // Variable to store the pixel top position corresponding to 0 dB
		//  All scope variables ...
		document.addEventListener('DOMContentLoaded', () => {
			// --- DOM Element Selection ---
			const audioElement = document.getElementById('audioElement');
			const playPauseBtn = document.getElementById('playPauseBtn');
			const prevBtn = document.getElementById('prevBtn');
			const nextBtn = document.getElementById('nextBtn');
			const loopBtn = document.getElementById('loopBtn');
			const shuffleBtn = document.getElementById('shuffleBtn');
			const volumeSlider = document.getElementById('volumeSlider');
			const seekBar = document.getElementById('seekBar');
			const currentTimeDisplay = document.getElementById('currentTime');
			const totalDurationDisplay = document.getElementById('totalDuration');
			const albumArt = document.getElementById('albumArt');
			const trackTitle = document.getElementById('trackTitle');
			const trackArtist = document.getElementById('trackArtist');
			const trackAlbumSpan = document.getElementById('trackAlbum'); // Span for Album Name
			const playlistContainer = document.getElementById('playlist');
			const addFilesInput = document.getElementById('addFilesInput');
			const toggleEqBtn = document.getElementById('toggleEqBtn');
			const volumeDownIcon = document.getElementById('volumeDownIcon');
			const volumeUpIcon = document.getElementById('volumeUpIcon'); // Get the volume up icon
			const volumeMuteIcon = document.getElementById('volumeMuteIcon'); // Get the volume mute icon
			const equalizerContainer = document.getElementById('equalizerContainer');
			const eqSliders = document.querySelectorAll('.eq-slider');
			const resetEqBtn = document.getElementById('resetEqBtn');
			const analyzerCanvas = document.getElementById('analyzerCanvas');
			const customEqSliders = document.querySelectorAll('.custom-eq-slider'); // Select all custom slider containers
			let activeSlider = null; // To track which slider is currently being dragged
			let startDragY = 0; // Starting Y position of the mouse when drag begins
			let startThumbTop = 0; // Starting top position of the thumb when drag begins
			let eqBandFrequencies = []; // Array to store the frequencies of the 10 bands
			let eqMinGain = -15; // Minimum gain in dB
			let eqMaxGain = 15; // Maximum gain in dB
			// --- Check if elements exist (Basic Debugging) ---
			if (!audioElement || !playPauseBtn || !prevBtn || !nextBtn || !loopBtn || !shuffleBtn || !volumeSlider || !seekBar || !playlistContainer || !addFilesInput || !analyzerCanvas) {
				console.error("Critical Player UI Element not found! Check HTML IDs.");
				// Optional: Display an error message to the user
				return; // Stop script execution if core elements are missing
			}
			const canvasCtx = analyzerCanvas.getContext('2d');
			if (!canvasCtx) {
				console.error("Could not get 2D context for Analyzer Canvas."); randomBtn
			}

			// --- State Management Variables ---
			let playlist = []; // Array to hold track objects: { file, title, artist, duration, url, artworkDataUrl }
			let currentTrackIndex = -1;
			let isPlaying = false;
			let isShuffle = false; // Variable to track shuffle state (default: off)
			let loopState = 'none'; // 'none', 'one', 'all'
			let audioContext;
			let analyserNode;
			let sourceNode;
			let eqBands = []; // Array to hold BiquadFilterNodes for EQ
			let gainNode; // Master gain node for volume control
			let animationFrameId; // For visualizer animation loop
			let lastVolume = volumeSlider ? parseFloat(volumeSlider.value) : 0.5; // Store the last non-zero volume
			const defaultArtwork = 'https://i.postimg.cc/7h0F4ZzC/Placeholder.png'; // Path to your placeholder image

			// --- Web Audio API Initialization ---
			function setupAudioContext() {
				if (audioContext) return; // Already initialized
				try {
					window.AudioContext = window.AudioContext || window.webkitAudioContext;
					if (!window.AudioContext) {
						console.warn("Web Audio API not supported. EQ and Visualizer disabled.");
						// Set volume directly on the audio element as fallback
						audioElement.volume = volumeSlider.value;
						return; // Exit setup if API not supported
					}
					audioContext = new AudioContext();
					analyserNode = audioContext.createAnalyser();
					analyserNode.fftSize = 256;
					analyserNode.smoothingTimeConstant = 0.85;
					gainNode = audioContext.createGain(); // Master volume
					// Frequencies for 10 EQ bands (common values)
					const frequencies = [31, 63, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
					eqBandFrequencies = frequencies; // Store frequencies in the variable

					eqBands = frequencies.map(freq => {
						const filter = audioContext.createBiquadFilter();
						filter.type = 'peaking'; // Bell curve filter type
						filter.frequency.value = freq;
						filter.Q.value = 1; // Quality factor/bandwidth (adjust Q for wider/narrower bands)
						filter.gain.value = 0; // Start at 0 dB gain
						return filter;
					});
					console.log("DEBUG: setupAudioContext - eqBands created:", eqBands);
					// Connect Audio Nodes: source -> eq bands -> gain -> analyser -> destination
					// Create source node from audio element - do this only once
					if (!sourceNode || !sourceNode.mediaElement) {
						sourceNode = audioContext.createMediaElementSource(audioElement);
					}
					// Connect source through each filter sequentially
					let currentNode = sourceNode;
					eqBands.forEach(filter => {
						currentNode.connect(filter);
						currentNode = filter;
					});

					currentNode.connect(gainNode); // Connect last filter to gain node
					gainNode.connect(analyserNode); // Connect gain node to analyser
					analyserNode.connect(audioContext.destination); // Connect analyser to speakers
					// Set initial volume using the GainNode if context is ready
					if (audioContext.state !== 'suspended') {
						gainNode.gain.value = parseFloat(volumeSlider.value);
					}
					initializeCustomSliders(); // INITIALIZE CUSTOM SLIDER VISUALS
					attachEqSliderListeners(); // Attach listeners now that eqBands is ready
				} catch (e) {
					console.error("Error initializing Web Audio API:", e);
					audioContext = null; // Ensure context is null if setup failed
					// Fallback to element volume
					audioElement.volume = volumeSlider.value;
					alert("Audio processing features (EQ, Visualizer) may not work correctly.");
				}
			}
			// [f] Initializes the visual state of custom EQ sliders to 0 dB
			function initializeCustomSliders() {
				if (!customEqSliders) return;

				customEqSliders.forEach(sliderContainer => {
					const thumb = sliderContainer.querySelector('.custom-slider-thumb');
					const progress = sliderContainer.querySelector('.custom-slider-progress');
					const valueSpan = sliderContainer.querySelector('.eq-value');
					const track = sliderContainer.querySelector('.custom-slider-track');

					if (thumb && progress && valueSpan && track) {
						const trackHeight = track.offsetHeight;
						const thumbHeight = thumb.offsetHeight;
						const middleOfTrack = trackHeight / 2;
						const thumbMiddleOffset = thumbHeight / 2;
						// Calculate top position for the thumb at 0 dB (middle of the track)
						const thumbTop = middleOfTrack - thumbMiddleOffset;
						// Calculate progress height for 0 dB (should fill up to the middle)
						const progressHeight = middleOfTrack; // Fills half the track

						thumb.style.top = `${thumbTop}px`;
						progress.style.height = `${progressHeight}px`;
						valueSpan.textContent = '0 dB'; // Set initial value text
					}
				});
				console.log("Custom EQ sliders initialized to 0 dB.");
			}
			// [f] Helper function to map a vertical pixel position to a dB gain value
			function pixelToGain(pixelTop, trackHeight, thumbHeight, minGain, maxGain) {
				const thumbCenterY = pixelTop + (thumbHeight / 2);
				// Normalize position (0 at bottom, 1 at top)
				const normalizedPosition = 1 - (thumbCenterY / trackHeight); // 1 - because Y=0 is at the top
				// Map normalized position to the gain range [minGain, maxGain]
				const gain = minGain + normalizedPosition * (maxGain - minGain);
				// Round gain to nearest step (e.g., 0.5 or 1)
				// Assuming step is 1 for simplicity based on your HTML comment, adjust if needed
				const step = 1; // Or get this from a data attribute if you change step per slider
				return Math.round(gain / step) * step;
			}
			// Helper function to map a dB gain value to a vertical pixel position for the thumb
			function gainToPixel(gain, trackHeight, thumbHeight, minGain, maxGain) {
				// Normalize gain (0 at minGain, 1 at maxGain)
				const normalizedGain = (gain - minGain) / (maxGain - minGain);
				// Calculate thumb center Y position (0 at bottom, trackHeight at top)
				const thumbCenterY = (1 - normalizedGain) * trackHeight; // 1 - because Y=0 is at the top
				// Calculate thumb top position
				const pixelTop = thumbCenterY - (thumbHeight / 2);

				return pixelTop;
			}
			// --- UPDATED FUNCTIONS AND EVENT LISTENERS FOR DRAGGING ---
			// Helper function to map a vertical pixel position to a dB gain value
			// Helper function to map a vertical pixel position (thumb top) to a dB gain value
			// pixelTop ranges from 0 (top of track) to trackHeight - thumbHeight (bottom of track)
			function pixelToGain(pixelTop, trackHeight, thumbHeight, minGain, maxGain) {
				// The effective height of the track for thumb movement is trackHeight - thumbHeight
				const effectiveTrackHeight = trackHeight - thumbHeight;
				if (effectiveTrackHeight <= 0) return 0; // Avoid division by zero
				// Normalize position based on thumb top (0 at top, 1 at bottom)
				let normalizedPosition = pixelTop / effectiveTrackHeight;
				// Clamp normalized position to be strictly between 0 and 1
				normalizedPosition = Math.max(0, normalizedPosition);
				normalizedPosition = Math.min(1, normalizedPosition);
				// Map normalized position to the gain range [minGain, maxGain]
				// Since pixelTop=0 is maxGain, and pixelTop=effectiveTrackHeight is minGain, the mapping is reversed.
				const gain = minGain + (1 - normalizedPosition) * (maxGain - minGain);
				// Round gain to nearest step
				const step = 1; // Or get this from a data attribute
				return Math.round(gain / step) * step;
			}
			// Helper function to map a dB gain value to a vertical pixel position for the thumb top
			// Returns a pixelTop value ranging from 0 to trackHeight - thumbHeight
			function gainToPixel(gain, trackHeight, thumbHeight, minGain, maxGain) {
				// Normalize gain (0 at minGain, 1 at maxGain)
				// Ensure division by zero safety if minGain === maxGain
				const gainRange = maxGain - minGain;
				let normalizedGain = (gainRange !== 0) ? (gain - minGain) / gainRange : 0.5; // Default to middle if range is zero
				// Clamp normalized gain to be strictly between 0 and 1
				normalizedGain = Math.max(0, normalizedGain);
				normalizedGain = Math.min(1, normalizedGain);
				// The effective height of the track for thumb movement is trackHeight - thumbHeight
				const effectiveTrackHeight = trackHeight - thumbHeight;
				if (effectiveTrackHeight <= 0) return 0; // Avoid issues if effective height is zero
				// Map normalized gain to pixelTop range [0, effectiveTrackHeight]
				// Since normalizedGain=0 (minGain) should be at pixelTop=effectiveTrackHeight, and normalizedGain=1 (maxGain) should be at pixelTop=0, the mapping is reversed.
				const pixelTop = (1 - normalizedGain) * effectiveTrackHeight;

				return pixelTop;
			}
			// Store references to elements of the active slider
			let activeSliderElements = {
				container: null, // The .eq-band element
				customSliderDiv: null, // The .custom-eq-slider div
				thumb: null,
				progress: null,
				valueSpan: null,
				track: null
			};

			// Attaches the dragging event listeners to the custom EQ sliders
			function attachEqSliderListeners() {
				if (!customEqSliders || customEqSliders.length === 0) {
					console.warn("Cannot attach EQ slider listeners: No custom sliders found.");
					return;
				}
				console.log("Attaching EQ slider dragging listeners...");

				customEqSliders.forEach(customSliderDiv => {
					const thumb = customSliderDiv.querySelector('.custom-slider-thumb');
					if (thumb) {
						thumb.addEventListener('pointerdown', (e) => {
							if (e.button !== 0) return;
							e.preventDefault();
							// Find the parent .eq-band container
							const eqBandContainer = customSliderDiv.closest('.eq-band');
							if (!eqBandContainer) {
								console.error("Could not find parent .eq-band container for drag start.");
								return;
							}
							// Store references to all necessary elements for the active slider
							activeSliderElements.container = eqBandContainer;
							activeSliderElements.customSliderDiv = customSliderDiv;
							activeSliderElements.thumb = thumb;
							activeSliderElements.progress = customSliderDiv.querySelector('.custom-slider-progress');
							activeSliderElements.track = customSliderDiv.querySelector('.custom-slider-track');
							activeSliderElements.valueSpan = eqBandContainer.querySelector('.eq-value');
							// Basic check if all elements were found
							if (!activeSliderElements.thumb || !activeSliderElements.progress || !activeSliderElements.track || !activeSliderElements.valueSpan) {
								console.error("DEBUG: Missing elements when starting drag (in attach listeners).", activeSliderElements);
								// Clean up partially stored elements
								activeSliderElements = {};
								return;
							}

							startDragY = e.clientY;
							startThumbTop = parseFloat(activeSliderElements.thumb.style.top) || 0;
							// Add event listeners to the document for pointermove and pointerup
							document.addEventListener('pointermove', onDragging);
							document.addEventListener('pointerup', onStopDragging);

							activeSliderElements.container.classList.add('dragging');
							console.log("DEBUG: Started dragging slider for frequency:", customSliderDiv.dataset.frequency);
						});
					} else {
						console.warn("Cannot find thumb within custom slider div:", customSliderDiv);
					}
				});
				console.log("EQ slider dragging listeners attached.");
			}
			// --- END NEW FUNCTION ---
			// Function executed while dragging
			function onDragging(e) {
				// Use the stored references directly
				if (!activeSliderElements.container) return;

				const { container, customSliderDiv, thumb, progress, valueSpan, track } = activeSliderElements;
				// Double-check elements are valid (should be if start was successful, but adds safety)
				if (!thumb || !progress || !track || !valueSpan) {
					console.error("DEBUG: Missing elements during drag (unexpected).", activeSliderElements);
					onStopDragging();
					return;
				}

				const trackRect = track.getBoundingClientRect();
				const thumbHeight = thumb.offsetHeight;

				let mouseYRelativeToTrack = e.clientY - trackRect.top;
				// Calculate a normalized position based on mouse Y relative to track height (0 to 1)
				let normalizedPosition = mouseYRelativeToTrack / trackRect.height;
				// Clamp the normalized position to be strictly between 0 and 1
				normalizedPosition = Math.max(0, normalizedPosition);
				normalizedPosition = Math.min(1, normalizedPosition);
				// --- REVISED GAIN CALCULATION WITH FORCING AT LIMITS ---
				let currentGain = eqMinGain + (1 - normalizedPosition) * (eqMaxGain - eqMinGain);
				// Use a small tolerance for comparing floats
				const normalizedTolerance = 0.001; // Or a slightly larger value like 0.005 if needed
				if (Math.abs(normalizedPosition - 0) < normalizedTolerance) {
					currentGain = eqMaxGain; // At the very top of the track
				} else if (Math.abs(normalizedPosition - 1) < normalizedTolerance) {
					currentGain = eqMinGain; // At the very bottom of the track
				} else {
					// Otherwise, round gain to nearest step (e.g., 0.5 or 1)
					const step = 1;
					currentGain = Math.round(currentGain / step) * step;
				}
				console.log(`DEBUG: Dragging - mouseYRelativeToTrack: ${mouseYRelativeToTrack.toFixed(2)}, normalizedPosition (clamped): ${normalizedPosition.toFixed(2)}, currentGain (forced/rounded): ${currentGain}`);
				console.log(`DEBUG: Dragging - trackHeight: ${trackRect.height}, thumbHeight: ${thumbHeight}`);
				// --- NOW CALCULATE THE THUMB'S TOP POSITION BASED ON THE CALCULATED GAIN ---
				let newThumbTop = gainToPixel(currentGain, trackRect.height, thumbHeight, eqMinGain, eqMaxGain);
				// Although gainToPixel should return values in this range based on min/max gain,
				// this adds an extra layer of safety just before applying the style.
				const maxThumbTop = trackRect.height - thumbHeight;
				newThumbTop = Math.max(0, newThumbTop);
				newThumbTop = Math.min(maxThumbTop, newThumbTop);

				console.log(`DEBUG: Dragging - newThumbTop (calculated from gain, then clamped): ${newThumbTop.toFixed(2)}`); // Log the final applied top

				// Math.round might help the visual pixel placement.
				thumb.style.top = `${Math.round(newThumbTop)}px`;
				// Find the corresponding Web Audio API filter and update its gain
				const frequency = parseFloat(activeSliderElements.customSliderDiv.dataset.frequency);
				const tolerance = 0.001;
				const filter = eqBands.find(f => Math.abs(f.frequency.value - frequency) < tolerance);

				if (filter) {
					filter.gain.value = currentGain;
				} else {
					console.warn(`DEBUG: EQ filter not found for frequency: ${frequency}Hz (after tolerance check)`);
				}
				// Update the progress bar visual
				const middleOfTrack = trackRect.height / 2;
				let progressHeight;
				let progressBottom = 0;
				// Re-calculate progress height based on the *currentGain* value
				if (currentGain >= 0) {
					const normalizedPositiveGain = eqMaxGain !== 0 ? currentGain / eqMaxGain : 0;
					progressHeight = middleOfTrack + normalizedPositiveGain * (trackRect.height - middleOfTrack);
					progressBottom = 0;
				} else {
					const normalizedNegativeGain = (eqMinGain !== 0 && 0 - eqMinGain !== 0) ? (currentGain - eqMinGain) / (0 - eqMinGain) : 0;
					progressHeight = normalizedNegativeGain * middleOfTrack;
					progressBottom = 0;
				}

				progress.style.height = `${progressHeight}px`;
				progress.style.bottom = `${progressBottom}px`;
				// Update the dB value display (round to 1 decimal place for display)
				valueSpan.textContent = `${currentGain.toFixed(1)} dB`;
			}
			// Stop dragging when mouse button is released
			function onStopDragging() {
				if (activeSliderElements.container) {
					document.removeEventListener('pointermove', onDragging);
					document.removeEventListener('pointerup', onStopDragging);

					activeSliderElements.container.classList.remove('dragging'); // Remove class from the eq-band

					// Clear stored references
					activeSliderElements = {};
					console.log("DEBUG: Stopped dragging slider.");
				}
			}
			// --- Visualizer Drawing Function ---
			function drawVisualizer() {
				// Stop if not playing, or if context/analyser isn't ready
				if (!isPlaying || !audioContext || !analyserNode || audioContext.state === 'suspended') {
					if (canvasCtx) {
						canvasCtx.clearRect(0, 0, analyzerCanvas.width, analyzerCanvas.height);
					}
					cancelAnimationFrame(animationFrameId); // Ensure loop stops
					return;
				}

				animationFrameId = requestAnimationFrame(drawVisualizer); // Continue loop
				const bufferLength = analyserNode.frequencyBinCount;
				const dataArray = new Uint8Array(bufferLength);
				analyserNode.getByteFrequencyData(dataArray);
				canvasCtx.clearRect(0, 0, analyzerCanvas.width, analyzerCanvas.height);
				canvasCtx.fillStyle = 'rgba(0, 0, 0, 0.1)';
				canvasCtx.fillRect(0, 0, analyzerCanvas.width, analyzerCanvas.height);

				const barWidth = (analyzerCanvas.width / bufferLength) * 1.5;
				let barHeight;
				let x = 0;

				canvasCtx.shadowBlur = 5; // Apply shadow once for all bars
				canvasCtx.shadowColor = 'rgba(255, 255, 255, 0.5)';

				for (let i = 0; i < bufferLength; i++) {
					barHeight = (dataArray[i] / 255) * analyzerCanvas.height * 0.9;

					const gradient = canvasCtx.createLinearGradient(x, analyzerCanvas.height, x, analyzerCanvas.height - barHeight);
					gradient.addColorStop(0, 'rgba(200, 200, 255, 0.6)');
					gradient.addColorStop(0.7, 'rgba(255, 255, 255, 0.9)');
					gradient.addColorStop(1, '#ffffff');
					canvasCtx.fillStyle = gradient;
					canvasCtx.fillRect(x, analyzerCanvas.height - barHeight, barWidth, barHeight);
					x += barWidth + 1;
				}
				// Reset shadow after drawing all bars
				canvasCtx.shadowBlur = 0;
				canvasCtx.shadowColor = 'transparent';
			}
			// --- Event Listeners for UI Elements ---
			seekBar.addEventListener('input', () => {
				updateSeekBarGradient();
			});

			audioElement.addEventListener('timeupdate', () => {
				if (!isNaN(audioElement.duration)) {
					seekBar.value = audioElement.currentTime;
					updateSeekBarGradient();
				}
			});
			// --- Core Playback Control Functions ---
			/**
					 * Loads a specific track into the audio element and updates UI.
					 * @param {number} index - The index of the track in the playlist.
					 */
			function loadTrack(index) {
				if (index < 0 || index >= playlist.length || !playlist[index]) {
					console.warn(`loadTrack: Invalid index ${index}`);
					// If current track was invalid, reset UI
					if (index === currentTrackIndex) {
						resetPlayerUI();
						currentTrackIndex = -1; // Ensure index is reset
					} else if (playlist.length === 0) {
						// If playlist is empty, reset UI
						resetPlayerUI();
						currentTrackIndex = -1;
					}
					return;
				}
				currentTrackIndex = index;
				const track = playlist[currentTrackIndex];
				if (!track || !track.url) {
					console.error(`loadTrack: Track data or URL missing for index ${index}`);
					resetPlayerUI(); // Reset UI as track data is bad
					return;
				}
				audioElement.src = track.url;
				audioElement.load(); // Important: Signals the browser to load the new source
				// --- Update Info Display ---
				console.log("DEBUG: loadTrack - Updating Info Display"); // Debug Log 9
				if (trackTitle) {
					trackTitle.textContent = track.title || 'Unknown Title';
					console.log("DEBUG: loadTrack - trackTitle updated:", trackTitle.textContent); // Debug Log 10
				}
				if (trackArtist) {
					trackArtist.textContent = track.artist || 'Unknown Artist';
					console.log("DEBUG: loadTrack - trackArtist updated:", trackArtist.textContent); // Debug Log 11
				}
				// --- ALBUM NAME UPDATE CODE ---
				console.log("DEBUG: loadTrack - Attempting to update trackAlbumSpan"); // Debug Log 12
				if (trackAlbumSpan) {
					console.log("DEBUG: loadTrack - trackAlbumSpan element found."); // Debug Log 13
					console.log("DEBUG: loadTrack - Updating trackAlbumSpan with:", track.album || 'Unknown Album'); // Debug Log 14
					trackAlbumSpan.textContent = track.album || 'Unknown Album'; // This line updates the UI
					console.log("DEBUG: loadTrack - trackAlbumSpan updated. New textContent:", trackAlbumSpan.textContent); // Debug Log 15
				} else {
					console.warn("trackAlbum element with ID 'trackAlbum' not found on track load."); // Debug Log 16
				}
				// --- END ALBUM NAME UPDATE CODE ---
				if (albumArt) {
					albumArt.src = track.artworkDataUrl || defaultArtwork;
					albumArt.alt = `Album art for ${track.title}`;
					console.log("DEBUG: loadTrack - albumArt updated. src:", albumArt.src); // Debug Log 17
				}
				// Reset Time & Seek Bar
				console.log("DEBUG: loadTrack - Updating Seek Bar and Time Display"); // Debug Log 18
				if (seekBar) {
					seekBar.value = 0;
					seekBar.max = track.duration || 0; // Set max based on loaded metadata or 0
					console.log("DEBUG: loadTrack - seekBar updated. value:", seekBar.value, "max:", seekBar.max); // Debug Log 19
				}
				if (currentTimeDisplay) {
					currentTimeDisplay.textContent = formatTime(0);
					console.log("DEBUG: loadTrack - currentTimeDisplay updated:", currentTimeDisplay.textContent); // Debug Log 20
				}
				if (totalDurationDisplay) {
					totalDurationDisplay.textContent = formatTime(track.duration);
					console.log("DEBUG: loadTrack - totalDurationDisplay updated:", totalDurationDisplay.textContent); // Debug Log 21
				}
				// Update seek bar gradient based on initial state (0 progress)
				console.log("DEBUG: loadTrack - Calling updateSeekBarGradient"); // Debug Log 22
				updateSeekBarGradient();
				console.log("DEBUG: loadTrack - Updating playlist highlight and buttons"); // Debug Log 23
				updatePlaylistHighlight();
				updatePlayPauseButtons(); // Ensure main play/pause button reflects the new loaded state (usually 'play')
				updatePlayPauseButtonsInPlaylist(); // Update play/pause buttons in the playlist
				// Attach event listener for loadedmetadata if not already done globally
				console.log("DEBUG: loadTrack - Setting up onloadedmetadata and onerror listeners"); // Debug Log 24
				audioElement.onloadedmetadata = () => {
					console.log("DEBUG: audioElement onloadedmetadata fired."); // Debug Log 25
					if (!isNaN(audioElement.duration)) {
						if (seekBar) seekBar.max = audioElement.duration;
						if (totalDurationDisplay) totalDurationDisplay.textContent = formatTime(audioElement.duration);
						console.log("DEBUG: onloadedmetadata - Duration set:", audioElement.duration); // Debug Log 26
					}
				};
				// Handle errors loading the audio source
				audioElement.onerror = (e) => {
					console.error(`Error loading audio source for ${track ? track.title : 'unknown track'}:`, e); // Debug Log 27
					// Attempt to load the next track automatically on error
					playNextTrack();
				};
				console.log("---- DEBUG: Exiting loadTrack function ----"); // Debug Log 28
			}
			// Updates play/pause icons within the playlist items
			function updatePlayPauseButtonsInPlaylist() {
				// console.log("DEBUG: updatePlayPauseButtonsInPlaylist called."); // Optional debug log
				const playlistItems = playlistContainer.querySelectorAll('.playlist-item');
				playlistItems.forEach((item, index) => {
					const itemPlayPauseButton = item.querySelector('.item-play-pause');
					const itemPlayIcon = itemPlayPauseButton ? itemPlayPauseButton.querySelector('.fa-play') : null;
					const itemPauseIcon = itemPlayPauseButton ? itemPlayPauseButton.querySelector('.fa-pause') : null;
					// Ensure buttons and icons exist before trying to modify
					if (!itemPlayPauseButton || !itemPlayIcon || !itemPauseIcon) {
						// console.warn("Missing play/pause button or icons in playlist item", index); // Optional warning
						return;
					}


					if (index === currentTrackIndex && isPlaying) {
						// This is the currently playing track
						itemPlayIcon.style.display = 'none';
						itemPauseIcon.style.display = 'inline-block';
						if (playlist[index]) { // Safety check for track data
							itemPlayPauseButton.setAttribute('aria-label', `Pause ${playlist[index].title || ''}`);
						}
					} else {
						// Other tracks or the current track is paused
						itemPlayIcon.style.display = 'inline-block';
						itemPauseIcon.style.display = 'none';
						if (playlist[index]) { // Safety check for track data
							itemPlayPauseButton.setAttribute('aria-label', `Play ${playlist[index].title || ''}`);
						}
					}
				});
			}

			function updateSeekBarGradient() {
				const value = parseFloat(seekBar.value);
				const max = parseFloat(seekBar.max);

				if (!isNaN(value) && !isNaN(max) && max > 0) {
					const progressPercent = (value / max) * 100;
					const gradient = `linear-gradient(to right,
                    #808080 0%,
                    #f8fc01 ${progressPercent}%,
                    #fd0101 ${progressPercent}%,
                    #fd0101 ${50 + progressPercent}%,
                    #fd0101 ${100 - (100 - progressPercent / .5)}%,
                    #808080 ${100}%)`;
					seekBar.style.background = gradient;
				} else {
					// Set to default gray if no progress or max
					seekBar.style.background = '#808080';
				}
			}
			// Call updateSeekBarGradient on initial load if needed
			if (seekBar.max > 0) {
				updateSeekBarGradient();
			}
			// --- Playlist Management ---
			function addFiles(files) {
				const newTracks = [];
				let loadPromises = [];

				for (const file of files) {
					if (file.type.startsWith('audio/')) {
						const track = {
							file: file,
							title: file.name.replace(/\.[^/.]+$/, ""), // Basic title
							artist: 'Unknown Artist',
							album: 'Unknown Album',
							duration: 0,
							url: URL.createObjectURL(file),
							artworkDataUrl: defaultArtwork
						};
						newTracks.push(track);
						loadPromises.push(loadMetadata(track));
					} else {
						console.warn(`Skipped non-audio file: ${file.name}`);
					}
				}

				Promise.all(loadPromises).then(() => {
					playlist = playlist.concat(newTracks);
					renderPlaylist();
					if (currentTrackIndex === -1 && playlist.length > 0) {
						loadTrack(0); // Auto-load the first track
					}
				}).catch(error => {
					console.error("Error loading metadata for one or more files:", error);
					// Still add tracks even if metadata fails
					playlist = playlist.concat(newTracks);
					renderPlaylist();
					if (currentTrackIndex === -1 && playlist.length > 0) loadTrack(0);
				});
			}

			function loadMetadata(track) {
				return new Promise((resolve) => { // Always resolve, even on error
					const tempAudio = new Audio();
					tempAudio.preload = "metadata";
					tempAudio.src = track.url;

					tempAudio.onloadedmetadata = () => {
						track.duration = tempAudio.duration;
						// Try reading tags only if jsmediatags is loaded
						if (window.jsmediatags) {
							window.jsmediatags.read(track.file, {
								onSuccess: (tag) => {
									track.title = tag.tags.title || track.title; // Keep filename title if tag missing
									track.artist = tag.tags.artist || 'Unknown Artist';
									track.album = tag.tags.album || 'Unknown Album'; // Extract and store album
									console.log("jsmediatags onSuccess: Album found:", tag.tags.album, "Stored in track.album:", track.album);
									console.log("DEBUG: jsmediatags onSuccess - Tag album:", tag.tags.album, "Stored in track.album:", track.album);
									const picture = tag.tags.picture;
									if (picture) {
										try {
											let base64String = btoa(picture.data.reduce((str, byte) => str + String.fromCharCode(byte), ''));
											track.artworkDataUrl = `data:${picture.format};base64,${base64String}`;
										} catch (e) {
											console.warn("Could not process artwork for:", track.title, e);
										}
									}
									resolve();
								},
								onError: (error) => {
									console.warn(`jsmediatags Error for ${track.title}:`, error.type, error.info);
									resolve(); // Resolve anyway
								}
							});
						} else {
							console.warn("jsmediatags library not found. Skipping tag reading.");
							resolve(); // Resolve if library missing
						}
					};
					tempAudio.onerror = (e) => {
						console.error("Error loading audio duration for:", track.title, e);
						track.duration = 0; // Indicate error or unknown duration
						resolve(); // Resolve even if duration fails
					};
				});
			}

			function renderPlaylist() {
				const listNumberSpan = document.getElementById('listNumber');
				if (listNumberSpan) {
					listNumberSpan.textContent = `(${playlist.length})`;
				}
				if (!playlistContainer) return;
				playlistContainer.innerHTML = '';
				playlist.forEach((track, index) => {
					const item = document.createElement('div');
					item.className = 'playlist-item';
					item.dataset.index = index;
					if (index === currentTrackIndex) {
						item.classList.add('playing');
					}
					const isCurrentAndPlaying = (index === currentTrackIndex && isPlaying);
					item.innerHTML = `
                        <div class="item-controls">
                            <div class="led-indicator"></div>
                            <button class="item-play-pause" aria-label="${isCurrentAndPlaying ? 'Pause' : 'Play'} ${track.title}">
                                <i class="fas fa-${isCurrentAndPlaying ? 'pause' : 'play'}"></i>
                            </button>
                        </div>
                        <div class="item-details">
                            <span class="item-title">${track.title || 'Unknown Title'}</span>
                            <span class="item-artist">${track.artist || 'Unknown Artist'}</span>
                        </div>
                        <div class="item-actions">
                        <span class="item-duration">${formatTime(track.duration)}</span>
                        <button class="delete-track-btn" data-index="${index}" aria-label="Remove ${track.title} from playlist">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                    `;
					// Listener for the whole item (excluding controls)
					item.addEventListener('click', (e) => {
						if (e.target.closest('.item-controls') || e.target.closest('.item-actions')) return;
						if (index !== currentTrackIndex) {
							loadTrack(index);
							playAudio();
						} else {
							togglePlayPause();
						}
					});

					playlistContainer.appendChild(item);
				});
			}
			// Add event listener for delete buttons using event delegation
			playlistContainer.addEventListener('click', function (event) {
				if (event.target.classList.contains('fa-trash') || event.target.classList.contains('delete-track-btn')) {
					const deleteButton = event.target.classList.contains('fa-trash') ? event.target.parentNode : event.target;
					const indexToRemove = parseInt(deleteButton.dataset.index);
					if (!isNaN(indexToRemove)) {
						console.log("Attempting to remove index:", indexToRemove);
						removeTrackFromPlaylist(indexToRemove);
						event.stopPropagation(); // Add this line to stop further propagation
					}
				}
			});

			// [f] Track Removal Logic Function
			function removeTrackFromPlaylist(indexToRemove) {
				if (indexToRemove >= 0 && indexToRemove < playlist.length) {
					const removedTrack = playlist.splice(indexToRemove, 1)[0];
					console.log(`Removed track at index ${indexToRemove}: ${removedTrack.title}`);
					// Adjust currentTrackIndex if the removed track was before or the current one
					if (currentTrackIndex > indexToRemove) {
						currentTrackIndex--;
					} else if (currentTrackIndex === indexToRemove) {
						// If the currently playing track was removed
						if (playlist.length > 0) {
							// Load the next track (or the first if it was the last)
							const newIndex = Math.min(currentTrackIndex, playlist.length - 1);
							loadTrack(newIndex);
							playAudio(); // Or maybe just load and stop? You can decide the behavior
						} else {
							// Playlist is now empty
							resetPlayerUI(); // You might want to create a function to reset the UI
							currentTrackIndex = -1;
						}
					}
					renderPlaylist(); // Re-render the playlist to update the view
				} else {
					console.warn(`Invalid index to remove: ${indexToRemove}`);
				}
			}

			function resetPlayerUI() {
				audioElement.pause();
				isPlaying = false;
				updatePlayPauseButtons();
				seekBar.value = 0;
				currentTimeDisplay.textContent = formatTime(0);
				totalDurationDisplay.textContent = formatTime(0);
				trackTitle.textContent = 'No track loaded';
				trackArtist.textContent = '';
				albumArt.src = defaultArtwork;
			}
			// --- Mute/Unmute Volume Logic --- Ensure initial state matches slider value
			if (volumeSlider && volumeSlider.value == 0 && volumeMuteIcon && volumeUpIcon) {
				volumeUpIcon.style.display = 'none';
				//volumeDownIcon.style.display = 'none';
				volumeMuteIcon.style.display = 'inline-block'; // Or 'block' depending on your layout
			} else if (volumeSlider && volumeSlider.value > 0 && volumeMuteIcon && volumeUpIcon) {
				volumeUpIcon.style.display = 'none';
				//volumeDownIcon.style.display = 'inline-block';
				volumeMuteIcon.style.display = 'none';
			}

			// [f] Function to toggle mute state
			function toggleMute() {
				if (!audioElement || !volumeUpIcon || !volumeMuteIcon || !volumeSlider) {
					console.error("Volume control elements not found.");
					return;
				}

				if (audioElement.volume > 0) {
					// Muting
					lastVolume = audioElement.volume; // Save the current volume
					audioElement.volume = 0;
					volumeSlider.value = 0; // Update slider position
					volumeUpIcon.style.display = 'none';
					volumeMuteIcon.style.display = 'inline-block'; // Show mute icon
					console.log("Audio muted. Last volume:", lastVolume);
				} else {
					// Unmuting
					console.log("Attempting to unmute...");
					console.log("Current lastVolume:", lastVolume);
					// Check if lastVolume is valid and greater than 0
					const restoreVolume = (typeof lastVolume === 'number' && lastVolume > 0) ? lastVolume : (volumeSlider ? parseFloat(volumeSlider.max) * 0.7 : 0.7);
					console.log("Calculated restoreVolume:", restoreVolume);
					audioElement.volume = restoreVolume;
					volumeSlider.value = restoreVolume; // Update slider position
					console.log("AudioElement volume after setting:", audioElement.volume);
					console.log("VolumeSlider value after setting:", volumeSlider.value);
					volumeMuteIcon.style.display = 'none';
					volumeUpIcon.style.display = 'inline-block'; // Show volume up icon
					console.log("Icons updated for unmuting.");
				}
				console.log("--- toggleMute finished ---"); // Log end of function
			}
			// Add event listener to the volume up icon for toggling mute
			if (volumeUpIcon) {
				volumeUpIcon.style.cursor = 'pointer'; // Indicate it's clickable
				volumeUpIcon.addEventListener('click', toggleMute);
			} else {
				console.error("Volume up icon with ID 'volumeUpIcon' not found.");
			}
			// Add event listener to the volume mute icon for toggling mute
			if (volumeMuteIcon) {
				volumeMuteIcon.style.cursor = 'pointer'; // Indicate it's clickable
				volumeMuteIcon.addEventListener('click', toggleMute);
			} else {
				console.error("Volume mute icon with ID 'volumeMuteIcon' not found.");
			}

			// Optional: Update the mute/unmute icon when the slider is dragged to 0
			if (volumeSlider && volumeMuteIcon && volumeUpIcon && audioElement) { // Added audioElement check
				volumeSlider.addEventListener('input', () => {
					const sliderValue = parseFloat(volumeSlider.value);

					// **Crucial:** Update the actual audio volume based on the slider value
					audioElement.volume = sliderValue; // Update HTML element volume

					// If Web Audio API is active and gainNode is used for master volume, update it too
					if (typeof audioContext !== 'undefined' && audioContext !== null && audioContext.state !== 'closed' && typeof gainNode !== 'undefined' && gainNode !== null) {
						gainNode.gain.value = sliderValue;
						// console.log("Volume slider input: Web Audio GainNode set to:", sliderValue); // Optional log
					} else {
						console.log("Volume slider input: Controlling audioElement.volume only:", sliderValue); // Optional log
					}
					// Update the mute/unmute icon based on the slider value
					if (sliderValue === 0) {
						// Muting via slider
						if (volumeUpIcon.style.display !== 'none') { // Prevent redundant updates
							volumeUpIcon.style.display = 'none';
							volumeMuteIcon.style.display = 'inline-block';
							// console.log("Volume slider input: Muted icon shown."); // Optional log
						}
					} else {
						// Unmuting via slider (or just adjusting volume)
						if (volumeMuteIcon.style.display !== 'none') { // Prevent redundant updates
							volumeMuteIcon.style.display = 'none';
							volumeUpIcon.style.display = 'inline-block';
						}
					}
					// returns to the adjusted volume.
					if (sliderValue > 0) {
						lastVolume = sliderValue;
						// console.log("Volume slider input: lastVolume updated to:", lastVolume); // Optional log
					}
				});
			}
			// Ensure the icon state is correct if volume is changed programmatically or by the slider
			if (audioElement && volumeUpIcon && volumeMuteIcon) {
				audioElement.addEventListener('volumechange', () => {
					if (audioElement.volume > 0 && volumeUpIcon.style.display === 'none') {
						console.log("VolumeChange: Unmuted detected, showing volume up icon.");
						volumeMuteIcon.style.display = 'none';
						volumeUpIcon.style.display = 'inline-block';
					} else if (audioElement.volume === 0 && volumeMuteIcon.style.display === 'none') {
						console.log("VolumeChange: Muted detected, showing mute icon.");
						volumeUpIcon.style.display = 'none';
						volumeMuteIcon.style.display = 'inline-block';
					}
				});
			}

			//[f] Toggles between play and pause states.
			function togglePlayPause() {
				console.log("togglePlayPause called. isPlaying:", isPlaying);
				if (isPlaying) {
					pauseAudio();
				} else {
					playAudio();
				}
			}
			//Starts or resumes audio playback. Handles AudioContext setup/resume.            
			function playAudio() {
				// If no track is selected, try loading the first one
				if (currentTrackIndex === -1 && playlist.length > 0) {
					loadTrack(0);
				}
				// If still no track (empty playlist or load failed), do nothing
				if (currentTrackIndex === -1 || !playlist[currentTrackIndex]) {
					console.warn("playAudio: No track loaded or playlist empty.");
					return;
				}
				// Initialize AudioContext on first user interaction (required by many browsers)
				if (!audioContext && window.AudioContext) {
					console.log("DEBUG: Calling setupAudioContext for the first time."); // <<< ADD THIS LOG
					setupAudioContext();
				}
				// Resume AudioContext if it's suspended (required by browsers)
				if (audioContext && audioContext.state === 'suspended') {
					console.log("DEBUG: Attempting to resume AudioContext."); // <<< ADD THIS LOG
					audioContext.resume().then(() => {
						console.log("DEBUG: AudioContext resumed successfully. Initiating playback.");
						_initiatePlayback(); // Assuming you have this internal function
					}).catch(err => {
						console.error("DEBUG: Failed to resume AudioContext:", err);
						_initiatePlayback();
					});
				} else {
					// Context is running or doesn't exist/supported, proceed
					console.log("DEBUG: AudioContext is running or not supported. Initiating playback."); // <<< ADD THIS LOG
					_initiatePlayback(); // Assuming you have this internal function
				}
				console.log("DEBUG: Exiting playAudio function."); // <<< ADD THIS LOG
			}
			// Internal function to handle the actual audioElement.play() call
			function _initiatePlayback() {
				if (!audioElement) return; // Safety check

				const playPromise = audioElement.play();

				if (playPromise !== undefined) {
					playPromise.then(() => {
						// Playback started successfully
						isPlaying = true;
						updatePlayPauseButtons();
						if (audioContext && analyserNode) { // Start visualizer only if context is ready
							requestAnimationFrame(drawVisualizer);
						}
						console.log(`Playing: ${playlist[currentTrackIndex]?.title}`);
					}).catch(error => {
						// Playback failed (e.g., user hasn't interacted, file error)
						console.error("Audio playback failed:", error);
						isPlaying = false;
						updatePlayPauseButtons();
						// Optionally alert the user or retry
						// alert("Could not play audio. Please interact with the page first or check the file.");
					});
				} else {
					isPlaying = false;
					updatePlayPauseButtons();
				}
			}
			// Pauses audio playback [f].
			function pauseAudio() {
				if (!audioElement) return;
				audioElement.pause();
				isPlaying = false;
				updatePlayPauseButtons();
				cancelAnimationFrame(animationFrameId); // Stop visualizer animation
				if (canvasCtx) { // Clear canvas on pause
					canvasCtx.clearRect(0, 0, analyzerCanvas.width, analyzerCanvas.height);
				}
				console.log(`Paused: ${playlist[currentTrackIndex]?.title}`);
			}
			// Shuffle Button Logic [f]
			function toggleShuffle() {
				isShuffle = !isShuffle; // Toggle the shuffle state (true/false)
				console.log("--- toggleShuffle called ---");
				console.log("Shuffle state is now:", isShuffle);
				// Update the button's appearance (e.g., add/remove an 'active' class)
				if (isShuffle) {
					shuffleBtn.classList.add('active'); // You'll need to define the 'active' class in your CSS
				} else {
					shuffleBtn.classList.remove('active');
				}
			}
			// Plays the next track based on shuffle/loop settings [f]
			function playNext() {
				console.log("--- playNext called ---"); // Log start of function
				console.log("Current track index:", currentTrackIndex, "Playlist length:", playlist.length);
				// Log the crucial states it depends on:
				console.log("Shuffle status:", isShuffle, "Loop status:", loopState);
				// 1. Check if there are any tracks to play
				if (playlist.length === 0) {
					console.log("playNext: Playlist empty, returning.");
					return; // Nothing to do
				}
				let newIndex; // Variable to store the index of the next track
				// 2. Determine next index based on Shuffle state
				if (isShuffle) {
					// --- Shuffle Logic ---
					console.log("playNext: Entering SHUFFLE logic.");
					if (playlist.length === 1) {
						// If only one track, shuffle doesn't really do anything
						newIndex = 0;
						console.log("playNext (shuffle): Only 1 track, index:", newIndex);
					} else {
						// Pick a random index DIFFERENT from the current one
						let attempts = 0; // Safety counter
						do {
							newIndex = Math.floor(Math.random() * playlist.length);
							attempts++;
						} while (newIndex === currentTrackIndex && attempts < playlist.length * 2); // Ensure it's different & prevent infinite loop
						console.log(`playNext (shuffle): Selected different index: ${newIndex} (after ${attempts} attempts)`);
					}
				} else {
					// --- Sequential Logic (Shuffle is OFF) ---
					console.log("playNext: Entering SEQUENTIAL logic.");
					newIndex = currentTrackIndex + 1; // Calculate the next index in order
					// 3. Handle reaching the end of the playlist
					if (newIndex >= playlist.length) {
						console.log("playNext (sequential): Reached end of playlist.");
						// Check if Loop All is enabled
						if (loopState === 'all') {
							console.log("playNext (sequential): Loop All enabled, wrapping to index 0.");
							newIndex = 0; // Go back to the first track
						} else {
							// Loop All is OFF (or Loop One, which doesn't apply here)
							console.log("playNext (sequential): Loop All disabled, stopping playback.");
							pauseAudio(); // Stop playback
							loadTrack(0); // Visually load the first track (but don't play)
							return; // Exit the playNext function, stopping the sequence
						}
					} else {
						console.log("playNext (sequential): Moving to index:", newIndex);
					}
				}
				// 4. Load and Play the determined track
				console.log(`playNext: Determined next index is ${newIndex}. Loading track...`);
				loadTrack(newIndex); // Load the track data and update UI
				playAudio();       // Start playback
			}
			// If you have shuffle logic in playPrev, add similar logs there too [f]
			function playPrev() {
				console.log("--- playPrev called ---");
				console.log("Shuffle status:", isShuffle);
				if (playlist.length === 0) return;
				// If played for more than ~3 seconds, restart current track (standard behavior often ignores shuffle here)
				if (audioElement.currentTime > 3 /* && !isShuffling */) { // Optional: only restart if NOT shuffling?
					console.log("playPrev: Restarting current track (played > 3s).");
					audioElement.currentTime = 0;
					playAudio(); // Ensure it starts playing if paused
				} else {
					console.log("playPrev: Going to previous track.");
					let newIndex;
					if (isShuffle) {
						console.log("playPrev: Entering SHUFFLE logic.");
						if (playlist.length === 1) {
							newIndex = 0;
						} else {
							let attempts = 0;
							do {
								newIndex = Math.floor(Math.random() * playlist.length);
								attempts++;
							} while (newIndex === currentTrackIndex && attempts < playlist.length * 2);
							console.log(`playPrev (shuffle): Selected index: ${newIndex}`);
						}
					} else {
						console.log("playPrev: Entering SEQUENTIAL logic.");
						newIndex = currentTrackIndex - 1;
						if (newIndex < 0) {
							newIndex = playlist.length - 1; // Wrap around to the end
							console.log("playPrev (sequential): Wrapping to last track, index:", newIndex);
						} else {
							console.log("playPrev (sequential): Moving to index:", newIndex);
						}
					}
					loadTrack(newIndex);
					playAudio();
				}
			}
			//[f] Updates the main play/pause button and individual track buttons icons
			function updatePlayPauseButtons() {
				// Main Button
				const mainIcon = playPauseBtn?.querySelector('i'); // Use optional chaining
				if (mainIcon) {
					mainIcon.classList.remove('fa-play', 'fa-pause');
					mainIcon.classList.add(isPlaying ? 'fa-pause' : 'fa-play');
					playPauseBtn.setAttribute('aria-label', isPlaying ? 'Pause' : 'Play');
				}
				// Playlist Item Buttons
				document.querySelectorAll('.playlist-item').forEach((item) => {
					const index = parseInt(item.dataset.index, 10);
					const btnIcon = item.querySelector('.item-play-pause i');
					const itemPlayPauseBtn = item.querySelector('.item-play-pause');
					if (btnIcon && itemPlayPauseBtn) {
						const isCurrentAndPlaying = (index === currentTrackIndex && isPlaying);
						btnIcon.classList.remove('fa-play', 'fa-pause');
						btnIcon.classList.add(isCurrentAndPlaying ? 'fa-pause' : 'fa-play');
						itemPlayPauseBtn.setAttribute('aria-label', `${isCurrentAndPlaying ? 'Pause' : 'Play'} ${playlist[index]?.title || ''}`);
					}
				});
			}

			//[f] Highlights the currently playing track in the playlist.
			function updatePlaylistHighlight() {
				document.querySelectorAll('.playlist-item').forEach((item) => {
					const index = parseInt(item.dataset.index, 10);
					if (index === currentTrackIndex) {
						item.classList.add('playing');
						// Optional: Scroll into view
						// item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
					} else {
						item.classList.remove('playing');
					}
				});
			}
			/**
			 * [f] Formats time in seconds to M:SS format.
			 * @param {number} seconds - Time in seconds.
			 * @returns {string} Formatted time string.
			 */
			function formatTime(seconds) {
				if (isNaN(seconds) || !isFinite(seconds) || seconds < 0) return "0:00";
				const minutes = Math.floor(seconds / 60);
				const secs = Math.floor(seconds % 60);
				return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
			}

			//[f] Resets the player UI to its initial state (no track loaded)
			function resetPlayerUI() {
				trackTitle.textContent = 'No Track Loaded';
				trackArtist.textContent = 'Unknown Artist';
				trackAlbum.textContent = 'Unknown Album';
				albumArt.src = defaultArtwork;
				albumArt.alt = 'Album Art';
				currentTimeDisplay.textContent = '0:00';
				totalDurationDisplay.textContent = '0:00';
				seekBar.value = 0;
				seekBar.max = 0;
				if (canvasCtx) {
					canvasCtx.clearRect(0, 0, analyzerCanvas.width, analyzerCanvas.height);
				}
				updatePlayPauseButtons(); // Ensure main button is 'play'
				updatePlaylistHighlight(); // Remove any highlight
			}

			// --EVENT LISTENERS--Playback Controls
			playPauseBtn.addEventListener('click', () => {
				console.log("Play/Pause button CLICKED");
				togglePlayPause();
			});
			prevBtn.addEventListener('click', () => {
				console.log("Previous button CLICKED");
				playPrev();
			});
			nextBtn.addEventListener('click', () => {
				console.log("Next button CLICKED");
				playNext();
			});
			shuffleBtn.addEventListener('click', () => {
				console.log("Shuffle Button Clicked");
				toggleShuffle();
			})
			loopBtn.addEventListener('click', () => {
				console.log("Loop button CLICKED. Current state:", loopState);
				loopBtn.classList.remove('active'); // Reset active state before deciding the next state
				loopBtn.innerHTML = ''; // Clear previous icon/text reliably

				if (loopState === 'none') {
					// --- Stage 1: Activate LOOP ALL (Playlist) ---
					loopState = 'all';
					loopBtn.dataset.loopState = 'all';
					loopBtn.innerHTML = '<i class="fa-solid fa-rotate" aria-hidden="true"></i>'; // Loop ALL icon
					loopBtn.setAttribute('aria-label', 'Loop All Enabled');
					loopBtn.classList.add('active'); // Make button visually active
					audioElement.loop = false; // Playlist loop is handled manually in 'playNext'
					console.log("Loop state changed to: ALL");
				} else if (loopState === 'all') {
					// --- Stage 2: Activate LOOP ONE (Single Track) ---
					loopState = 'one';
					loopBtn.dataset.loopState = 'one';
					// Use the 'redo' icon again, but add text '1' to differentiate
					loopBtn.innerHTML = '<i class="fa-solid fa-rotate-right" aria-hidden="true"></i>';
					loopBtn.setAttribute('aria-label', 'Loop One Enabled');
					loopBtn.classList.add('active'); // Keep button visually active
					audioElement.loop = true; // Enable the native HTML5 loop property for single track repeat
					console.log("Loop state changed to: ONE");
				} else { // Current state was 'one'
					// --- Stage 3: Deactivate Loop (Back to NONE) ---
					loopState = 'none';
					loopBtn.dataset.loopState = 'none';
					loopBtn.innerHTML = '<i class="fa-solid fa-repeat" aria-hidden="true"></i>'; // Loop OFF icon
					loopBtn.setAttribute('aria-label', 'Loop Disabled');
					loopBtn.classList.remove('active'); // Make button visually inactive
					audioElement.loop = false;

					console.log("Loop state changed to: NONE");
				}
			});

			//[f] --- Initial State Setup (within the init() function) ---
			function init() {
				// ... other initializations ...
				loopBtn.dataset.loopState = 'none';
				loopBtn.innerHTML = '<i class="fa-solid fa-repeat" aria-hidden="true"></i>'; // Loop OFF icon
				loopBtn.setAttribute('aria-label', 'Loop Disabled');
				loopBtn.classList.remove('active');
				audioElement.loop = false;
				// ... rest of init ...
			}
			// Volume Control
			volumeSlider.addEventListener('input', () => {
				const volumeValue = parseFloat(volumeSlider.value);
				if (gainNode && audioContext && audioContext.state === 'running') {
					gainNode.gain.value = volumeValue; // Use GainNode if available
				} else {
					audioElement.volume = volumeValue; // Fallback to element volume
				}
				// console.log("Volume changed:", volumeValue); // Optional log
			});
			// Seek Bar Control
			seekBar.addEventListener('input', () => {
				if (!isNaN(audioElement.duration)) { // Only seek if duration is known
					audioElement.currentTime = parseFloat(seekBar.value);
				}
			});
			// Audio Element Events
			audioElement.addEventListener('timeupdate', () => {
				if (!isNaN(audioElement.duration)) {
					seekBar.value = audioElement.currentTime;
					currentTimeDisplay.textContent = formatTime(audioElement.currentTime);
				}
			});
			audioElement.addEventListener('loadedmetadata', () => {
				console.log(`Metadata loaded for: ${playlist[currentTrackIndex]?.title}`);
				const duration = audioElement.duration;
				if (!isNaN(duration)) {
					totalDurationDisplay.textContent = formatTime(duration);
					seekBar.max = duration;
					// Update duration in the playlist object if it wasn't read correctly before
					if (currentTrackIndex !== -1 && playlist[currentTrackIndex] && !isNaN(duration)) {
						if (playlist[currentTrackIndex].duration !== duration) {
							console.log(`Updating duration for ${playlist[currentTrackIndex].title} from metadata.`);
							playlist[currentTrackIndex].duration = duration;
							// Optionally re-render the specific playlist item's duration?
							const itemDurationSpan = playlistContainer.querySelector(`.playlist-item[data-index="${currentTrackIndex}"] .item-duration`);
							if (itemDurationSpan) itemDurationSpan.textContent = formatTime(duration);
						}
					}
				} else {
					console.warn("loadedmetadata event fired, but duration is still NaN.");
				}
			});
			// Handle errors during playback/loading
			audioElement.addEventListener('error', (e) => {
				console.error("Audio Element Error:", audioElement.error, e);
				// Determine the type of error if possible
				let errorMessage = "An error occurred while loading or playing the audio.";
				if (audioElement.error) {
					switch (audioElement.error.code) {
						case MediaError.MEDIA_ERR_ABORTED:
							errorMessage = 'Audio playback aborted.';
							break;
						case MediaError.MEDIA_ERR_NETWORK:
							errorMessage = 'A network error caused the audio download to fail.';
							break;
						case MediaError.MEDIA_ERR_DECODE:
							errorMessage = 'The audio playback was aborted due to a corruption problem or because the audio used features your browser did not support.';
							break;
						case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
							errorMessage = 'The audio could not be loaded, either because the server or network failed or because the format is not supported.';
							break;
						default:
							errorMessage = 'An unknown error occurred.';
							break;
					}
				}
				alert(errorMessage + ` (Track: ${playlist[currentTrackIndex]?.title || 'Unknown'})`);
				// Optionally try to play next track or reset UI
				isPlaying = false;
				updatePlayPauseButtons();
				// Maybe try playNext()? Be careful of error loops.
			});
			// Event for when playback actually starts (useful after play() promise or for older browsers)
			audioElement.addEventListener('playing', () => {
				console.log("Audio 'playing' event fired.");
				isPlaying = true; // Ensure state is correct
				updatePlayPauseButtons();
				if (audioContext && analyserNode && audioContext.state === 'running') {
					requestAnimationFrame(drawVisualizer); // Start visualizer if not already running
				}
			});
			// Event for when playback pauses for any reason (including reaching the end if not looping)
			audioElement.addEventListener('pause', () => {
				// Don't log if pause was intentional via pauseAudio() as it logs itself
				// Only log unexpected pauses (like reaching the end without looping)
				if (isPlaying && audioElement.ended && loopState !== 'one' && loopState !== 'all') {
					console.log("Audio 'pause' event fired (reached end, no loop).");
				} else if (isPlaying) {
					// This might indicate a pause due to buffering or other reasons
					console.log("Audio 'pause' event fired unexpectedly.");
				}
				isPlaying = false; // Ensure state is correct
				updatePlayPauseButtons();
				cancelAnimationFrame(animationFrameId); // Ensure visualizer stops
			});
			// Handle track ending
			audioElement.addEventListener('ended', () => {
				console.log(`Track ended: ${playlist[currentTrackIndex]?.title}`);
				if (loopState === 'one') {
					console.log("Looping single track.");
					audioElement.currentTime = 0; // Reset time
					playAudio(); // Replay the same track
				} else {
					// Move to the next track (playNext handles 'all' loop state)
					playNext();
				}
			});

			// File Input
			addFilesInput.addEventListener('change', (event) => {
				if (event.target.files.length > 0) {
					console.log(`Adding ${event.target.files.length} files.`);
					addFiles(event.target.files);
					event.target.value = null; // Allow adding the same file again
				}
			});

			// Equalizer Controls
			toggleEqBtn.addEventListener('click', () => {
				const isVisible = equalizerContainer.classList.toggle('visible');
				toggleEqBtn.classList.toggle('expanded', isVisible);
				toggleEqBtn.setAttribute('aria-expanded', isVisible);
				if (resetEqBtn.style.display === "block") {
					resetEqBtn.style.display = "none";
				} else {
					resetEqBtn.style.display = "block";
				}
			});

			eqSliders.forEach(slider => {
				const bandIndex = parseInt(slider.dataset.eqBand, 10);
				const valueDisplay = slider.parentElement.querySelector('.eq-value');
				slider.addEventListener('input', () => {
					if (!audioContext) return; // Do nothing if EQ not initialized
					const gainValue = parseFloat(slider.value);
					if (eqBands[bandIndex] && audioContext.state === 'running') {
						eqBands[bandIndex].gain.linearValue = Math.pow(10, gainValue / 20); // Gain is logarithmic (dB)
						eqBands[bandIndex].gain.value = gainValue; // Set gain directly in dB
					}
					if (valueDisplay) {
						valueDisplay.textContent = `${gainValue >= 0 ? '+' : ''}${gainValue.toFixed(1)} dB`;
					}
				});
				// Update display on initial load if value is not 0
				const initialGain = parseFloat(slider.value);
				if (valueDisplay && initialGain !== 0) {
					valueDisplay.textContent = `${initialGain >= 0 ? '+' : ''}${initialGain.toFixed(1)} dB`;
				}
			});

			// Resets all EQ sliders (custom) and filter gains to 0
			resetEqBtn.addEventListener('click', resetEqualizer);

			function resetEqualizer() {
				console.log("DEBUG: resetEqualizer function called.");
				const eqBandContainers = document.querySelectorAll('.eq-band');
				if (!eqBandContainers || eqBandContainers.length === 0 || eqBands.length === 0) {
					console.warn("Cannot reset equalizer: EQ band containers or filters not found.");
					return;
				}

				eqBandContainers.forEach((eqBandContainer, index) => {
					const customSliderDiv = eqBandContainer.querySelector('.custom-eq-slider');
					const thumb = eqBandContainer.querySelector('.custom-slider-thumb');
					const progress = eqBandContainer.querySelector('.custom-slider-progress');
					const valueSpan = eqBandContainer.querySelector('.eq-value'); // <-- Query for valueSpan
					const track = eqBandContainer.querySelector('.custom-slider-track');
					// Check if all expected elements for this band are found
					// We specifically check for valueSpan here
					if (thumb && progress && valueSpan && track && eqBands[index]) {
						console.log(`DEBUG: Resetting band ${index}. All required elements found.`); // Debug Log
						console.log(`DEBUG: Resetting band ${index}. valueSpan element found: `, valueSpan); // Log the actual element
						console.log(`DEBUG: Resetting band ${index}. Current valueSpan textContent: "${valueSpan.textContent}"`); // Debug Log before setting text
						const trackHeight = track.offsetHeight;
						const thumbHeight = thumb.offsetHeight;
						const middleOfTrack = trackHeight / 2;
						const thumbMiddleOffset = thumbHeight / 2;
						// Calculate top position for the thumb at 0 dB
						const thumbTop = middleOfTrack - thumbMiddleOffset;
						// Calculate progress height for 0 dB
						const progressHeight = middleOfTrack;
						// Update visual state to 0 dB
						thumb.style.top = `${thumbTop}px`;
						progress.style.height = `${progressHeight}px`;
						progress.style.bottom = '0px'; // Ensure progress starts from the bottom
						console.log(`DEBUG: Resetting band ${index}. Setting valueSpan textContent to '0 dB'`); // Debug Log before setting text
						valueSpan.textContent = '0 dB'; // Set value text
						console.log(`DEBUG: Resetting band ${index}. valueSpan textContent is now: "${valueSpan.textContent}"`); // Debug Log after setting text
						// Set the corresponding filter's gain to 0
						eqBands[index].gain.value = 0;
					} else {
						// This warning would appear if valueSpan or other elements are NOT found for a band
						console.warn("DEBUG: Missing elements in EQ band container during reset loop:", { index: index, thumb: !!thumb, progress: !!progress, valueSpan: !!valueSpan, track: !!track, filter: !!eqBands[index], container: eqBandContainer });
					}
				});
				console.log("Equalizer reset to 0 dB.");
			}

			//[f] --- Initialization ---
			function init() {
				console.log("Initializing Audio Player...");
				// Set initial volume (both element and GainNode if available later)
				audioElement.volume = parseFloat(volumeSlider.value);
				if (gainNode) gainNode.gain.value = parseFloat(volumeSlider.value);
				// Set initial seek bar state
				seekBar.value = 0;
				seekBar.max = 0; // Will be set on loadedmetadata
				currentTimeDisplay.textContent = formatTime(0);
				totalDurationDisplay.textContent = formatTime(0);
				// Set initial button states visually
				loopBtn.dataset.loopState = 'none';
				loopBtn.innerHTML = '<i class="fa-solid fa-repeat" aria-hidden="true"></i>'; // Ensure correct initial icon & content
				loopBtn.setAttribute('aria-label', 'Loop Disabled');
				shuffleBtn.classList.remove('active');
				shuffleBtn.setAttribute('aria-pressed', 'false');
				shuffleBtn.setAttribute('aria-label', 'Shuffle Disabled');
				// Initial UI state for no track loaded
				resetPlayerUI();
				// Render empty playlist initially
				renderPlaylist();
				// Optionally pre-setup AudioContext if preferred, but generally better on interaction
				// setupAudioContext();
				console.log("Audio Player Initialized.");
			}
			// Run initialization
			init();
		});