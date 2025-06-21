(() => {
    'use strict';
    
    let isEnabled = true;
    let observer = null;
    let animationId = null;
    const processedVideos = new WeakSet();
    
    console.log('ReelBar Extension loaded');
    
    init();
    
    function init() {
        chrome.storage.sync.get(['enabled'], (result) => {
            isEnabled = result.enabled !== false; 
            console.log('Extension enabled:', isEnabled);
            
            if (isEnabled) {
                startExtension();
            }
        });
        
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            if (request.action === 'toggle') {
                isEnabled = request.enabled;
                console.log('Toggle received:', isEnabled);
                
                if (isEnabled) {
                    startExtension();
                } else {
                    stopExtension();
                }
                
                sendResponse({success: true});
            }
            return true;
        });
    }
    
    function startExtension() {
        console.log('Starting extension...');
        
        processAllVideos();
        
        startObserver();
        
        startAnimationLoop();
    }
    
    function stopExtension() {
        console.log('Stopping extension...');
        
        if (observer) {
            observer.disconnect();
            observer = null;
        }
        
        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }
        
        removeAllSeekBars();
    }
    
    function startObserver() {
        if (observer) observer.disconnect();
        
        observer = new MutationObserver((mutations) => {
            if (!isEnabled) return;
            
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        // Check if it's a video
                        if (node.tagName === 'VIDEO') {
                            processVideo(node);
                        }
                        
                        // Check for videos inside the node
                        if (node.querySelectorAll) {
                            const videos = node.querySelectorAll('video');
                            videos.forEach(processVideo);
                        }
                    }
                });
            });
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
    
    function processAllVideos() {
        const videos = document.querySelectorAll('video');
        console.log('Found', videos.length, 'videos');
        videos.forEach(processVideo);
    }
    
    function processVideo(video) {
        if (!video || processedVideos.has(video) || video.dataset.seekBarAdded) {
            return;
        }
        
        console.log('Processing video:', video);
        
        processedVideos.add(video);
        video.dataset.seekBarAdded = 'true';
        
        createSeekBar(video);
    }
    
    function createSeekBar(video) {
        const container = document.createElement('div');
        container.className = 'ig-seek-container';
        
        const seekBar = document.createElement('input');
        seekBar.type = 'range';
        seekBar.min = '0';
        seekBar.max = '100';
        seekBar.value = '0';
        seekBar.className = 'ig-seek-bar';
        
        const timeDisplay = document.createElement('div');
        timeDisplay.className = 'ig-time-display';
        timeDisplay.textContent = '0:00 / 0:00';
        
        container.appendChild(seekBar);
        container.appendChild(timeDisplay);
        
        const videoContainer = video.closest('div[style*="position"]') || video.parentElement;
        
        if (videoContainer) {
            const style = getComputedStyle(videoContainer);
            if (style.position === 'static') {
                videoContainer.style.position = 'relative';
            }
            videoContainer.appendChild(container);
        }
        
        
        video.seekBarContainer = container;
        video.seekBarElement = seekBar;
        video.timeDisplayElement = timeDisplay;
        
        setupSeekBarEvents(video, seekBar, timeDisplay);
    }
    
    function setupSeekBarEvents(video, seekBar, timeDisplay) {
        let isDragging = false;
        
        seekBar.addEventListener('mousedown', () => {
            isDragging = true;
        });
        
        seekBar.addEventListener('mouseup', () => {
            isDragging = false;
        });
        
        seekBar.addEventListener('input', () => {
            if (video.duration) {
                const time = (seekBar.value / 100) * video.duration;
                video.currentTime = time;
                updateTimeDisplay(video, timeDisplay);
            }
        });
        
        video.addEventListener('loadedmetadata', () => {
            updateSeekBar(video, seekBar, timeDisplay);
        });
        
        video.addEventListener('timeupdate', () => {
            if (!isDragging) {
                updateSeekBar(video, seekBar, timeDisplay);
            }
        });
    }
    
    function updateSeekBar(video, seekBar, timeDisplay) {
        if (video.duration && !isNaN(video.duration)) {
            const progress = (video.currentTime / video.duration) * 100;
            seekBar.value = progress;
            updateTimeDisplay(video, timeDisplay);
        }
    }
    
    function updateTimeDisplay(video, timeDisplay) {
        const current = formatTime(video.currentTime || 0);
        const duration = formatTime(video.duration || 0);
        timeDisplay.textContent = `${current} / ${duration}`;
    }
    
    function formatTime(seconds) {
        if (isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    
    function startAnimationLoop() {
        function animate() {
            if (!isEnabled) {
                animationId = requestAnimationFrame(animate);
                return;
            }
            
            const videos = document.querySelectorAll('video[data-seek-bar-added]');
            videos.forEach(video => {
                if (video.seekBarElement && video.timeDisplayElement && !video.paused) {
                    updateSeekBar(video, video.seekBarElement, video.timeDisplayElement);
                }
            });
            
            animationId = requestAnimationFrame(animate);
        }
        
        if (animationId) cancelAnimationFrame(animationId);
        animationId = requestAnimationFrame(animate);
    }
    
    function removeAllSeekBars() {
        
        const containers = document.querySelectorAll('.ig-seek-container');
        containers.forEach(container => container.remove());
        
       
        const videos = document.querySelectorAll('video[data-seek-bar-added]');
        videos.forEach(video => {
            delete video.dataset.seekBarAdded;
            delete video.seekBarContainer;
            delete video.seekBarElement;
            delete video.timeDisplayElement;
            processedVideos.delete(video);
        });
        
        console.log('All seek bars removed');
    }
})();