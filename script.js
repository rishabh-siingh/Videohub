document.addEventListener('DOMContentLoaded', () => {
    const homeBtn = document.getElementById('homeBtn');
    const shortsBtn = document.getElementById('shortsBtn');
    const homeFeed = document.getElementById('homeFeed');
    const shortsFeed = document.getElementById('shortsFeed');
    const fixedPlayer = document.getElementById('fixedPlayer');
    const mainPlayer = document.getElementById('mainPlayer');
    const closeBtn = document.getElementById('closeBtn');
    const content = document.querySelector('.content');
    const menuBtn = document.querySelector('.menu-btn');
    const menuDropdown = document.querySelector('.menu-dropdown');
    const importHomeBtn = document.getElementById('importHomeBtn');
    const importShortsBtn = document.getElementById('importShortsBtn');
    const homeImportInput = document.getElementById('homeImportInput');
    const shortsImportInput = document.getElementById('shortsImportInput');
    const clearVideosBtn = document.getElementById('clearVideosBtn');

    let currentPlayingShort = null;
    let isScrolling = false;
    let scrollTimeout = null;
    const observer = new IntersectionObserver(handleIntersection, {
        threshold: 0.8,
        rootMargin: '0px'
    });

    function initApp() {
        initializeSampleData();
        loadSavedVideos();
        setupEventListeners();
        showHome();
    }

    function setupEventListeners() {
        homeBtn.addEventListener('click', showHome);
        shortsBtn.addEventListener('click', showShorts);
        closeBtn.addEventListener('click', closeFixedPlayer);
        menuBtn.addEventListener('click', toggleMenu);
        document.addEventListener('click', closeMenu);
        importHomeBtn.addEventListener('click', () => homeImportInput.click());
        importShortsBtn.addEventListener('click', () => shortsImportInput.click());
        homeImportInput.addEventListener('change', (e) => handleFileImport(e, 'home'));
        shortsImportInput.addEventListener('change', (e) => handleFileImport(e, 'shorts'));
        clearVideosBtn.addEventListener('click', clearAllVideos);
        homeFeed.addEventListener('click', handleVideoClick);
        shortsFeed.addEventListener('click', handleShortClick);
        shortsFeed.addEventListener('scroll', handleShortScroll);
        document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    function showHome() {
        homeFeed.style.display = 'grid';
        shortsFeed.style.display = 'none';
        homeBtn.classList.add('active');
        shortsBtn.classList.remove('active');
        document.body.style.overflow = '';
        pauseCurrentShort();
    }

    function showShorts() {
        homeFeed.style.display = 'none';
        shortsFeed.style.display = 'block';
        shortsBtn.classList.add('active');
        homeBtn.classList.remove('active');
        document.body.style.overflow = 'hidden';
        setTimeout(() => {
            shortsFeed.scrollTop = 0;
            playVisibleShort();
        }, 50);
    }

    function handleVideoClick(e) {
        const container = e.target.closest('.video-container');
        if (!container) return;
        
        if (container.classList.contains('playing')) {
            const iframe = container.querySelector('iframe');
            iframe && openVideoInFixedPlayer(iframe.src);
            return;
        }
        
        container.classList.add('playing');
        const iframe = container.querySelector('iframe');
        if (!iframe) return;
        
        iframe.src = iframe.src.includes('?') ? 
            `${iframe.src}&autoplay=1` : 
            `${iframe.src}?autoplay=1`;
    }

    function openVideoInFixedPlayer(src) {
        mainPlayer.src = src.includes('?') ? 
            `${src}&autoplay=1` : 
            `${src}?autoplay=1`;
        fixedPlayer.style.display = 'block';
        content.classList.add('with-fixed-player');
    }

    function closeFixedPlayer() {
        fixedPlayer.style.display = 'none';
        content.classList.remove('with-fixed-player');
        if (mainPlayer.src.includes('youtube.com')) {
            mainPlayer.contentWindow.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*');
        }
        mainPlayer.src = '';
    }

    function handleShortClick(e) {
        const container = e.target.closest('.short-container');
        if (!container) return;
        
        const iframe = container.querySelector('iframe');
        iframe && (iframe === currentPlayingShort ? pauseCurrentShort() : playShort(iframe));
    }

    function handleShortScroll() {
        isScrolling = true;
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
            isScrolling = false;
            playVisibleShort();
        }, 100);
    }

    function handleIntersection(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const iframe = entry.target.querySelector('iframe');
                iframe && playShort(iframe);
            } else {
                const iframe = entry.target.querySelector('iframe');
                if (iframe && iframe === currentPlayingShort) {
                    pauseCurrentShort();
                }
            }
        });
    }

    function playVisibleShort() {
        document.querySelectorAll('.short-container').forEach(short => {
            observer.observe(short);
        });
    }

    function playShort(iframe) {
        pauseCurrentShort();
        currentPlayingShort = iframe;
        const src = iframe.src.split('?')[0] + '?autoplay=1&mute=1';
        iframe.src = src;
        iframe.closest('.short-container').classList.add('playing');
    }

    function pauseCurrentShort() {
        if (currentPlayingShort) {
            const src = currentPlayingShort.src.split('?')[0];
            currentPlayingShort.src = src;
            currentPlayingShort.closest('.short-container').classList.remove('playing');
            currentPlayingShort = null;
        }
    }

    function handleVisibilityChange() {
        document.hidden ? pauseCurrentShort() : playVisibleShort();
    }

    function toggleMenu(e) {
        e.stopPropagation();
        menuDropdown.classList.toggle('show');
    }

    function closeMenu(e) {
        if (!menuBtn.contains(e.target) && !menuDropdown.contains(e.target)) {
            menuDropdown.classList.remove('show');
        }
    }

    async function handleFileImport(event, feedType) {
        try {
            const file = event.target.files[0];
            if (!file) return;

            const text = await file.text();
            const urls = extractValidUrls(text);
            
            if (!urls.length) {
                throw new Error('No valid URLs found');
            }
            
            urls.forEach((url, index) => {
                const convertedUrl = convertToPreviewUrl(url);
                addVideoToFeed(convertedUrl, feedType, index + 1);
                saveVideo(convertedUrl, feedType);
            });
            
            event.target.value = '';
            alert(`${urls.length} videos imported to ${feedType} feed`);
            
            if (feedType === 'home' && homeFeed.style.display !== 'none') {
                showHome();
            } else if (shortsFeed.style.display !== 'none') {
                showShorts();
            }
            
        } catch (error) {
            alert(error.message || 'Import failed');
            event.target.value = '';
        }
    }

    function saveVideo(url, feedType) {
        const storageKey = `${feedType}Videos`;
        const videos = JSON.parse(localStorage.getItem(storageKey)) || [];
        if (!videos.includes(url)) {
            videos.push(url);
            localStorage.setItem(storageKey, JSON.stringify(videos));
        }
    }

    function loadSavedVideos() {
        ['mainVideos', 'shortsVideos'].forEach(key => {
            const videos = JSON.parse(localStorage.getItem(key)) || [];
            videos.forEach((url, index) => {
                addVideoToFeed(url, key === 'mainVideos' ? 'home' : 'shorts', index + 1);
            });
        });
    }

    function addVideoToFeed(url, feedType, index) {
        const feedElement = feedType === 'home' ? homeFeed : shortsFeed;
        const container = document.createElement('div');
        container.className = feedType === 'home' ? 'video-container' : 'short-container';
        
        const thumbnail = document.createElement('img');
        thumbnail.className = 'video-thumbnail';
        thumbnail.alt = 'Video thumbnail';
        
        if (url.includes('youtube.com/embed/')) {
            const videoId = url.split('/embed/')[1].split('?')[0];
            thumbnail.src = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
            thumbnail.onerror = function() {
                this.src = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
            };
        } else {
            thumbnail.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkqAcAAIUAgUW0RjgAAAAASUVORK5CYII=';
        }
        
        const info = document.createElement('div');
        info.className = 'video-info';
        info.textContent = `Video ${index}`;
        
        const iframe = document.createElement('iframe');
        iframe.className = 'video-iframe';
        iframe.src = url;
        iframe.setAttribute('allowfullscreen', '');
        
        if (feedType === 'shorts') {
            iframe.setAttribute('allow', 'autoplay');
            iframe.setAttribute('muted', '');
        }
        
        container.classList.add('loaded');
        container.append(thumbnail, info, iframe);
        feedElement.appendChild(container);
    }

    function extractValidUrls(text) {
        return text.split('\n')
            .map(url => url.trim())
            .filter(url => isValidUrl(url));
    }

    function isValidUrl(string) {
        try {
            new URL(string);
            return true;
        } catch {
            return false;
        }
    }

    function convertToPreviewUrl(url) {
        try {
            const urlObj = new URL(url);
            if (urlObj.hostname.includes('youtube.com') || urlObj.hostname.includes('youtu.be')) {
                const videoId = urlObj.searchParams.get('v') || 
                              urlObj.pathname.split('/').pop().replace(/[?#].*$/, '');
                return `https://www.youtube.com/embed/${videoId}?rel=0&showinfo=0`;
            }
            if (url.includes('drive.google.com')) {
                return url.replace('/view', '/preview').split('&')[0];
            }
            return url;
        } catch {
            return url;
        }
    }

    function initializeSampleData() {
        if (!localStorage.mainVideos && !localStorage.shortsVideos) {
            localStorage.setItem('mainVideos', JSON.stringify([
                'https://www.youtube.com/embed/jfKfPfyJRdk',
                'https://www.youtube.com/embed/5qap5aO4i9A'
            ]));
        }
    }

    function clearAllVideos() {
        if (confirm('Clear all videos?')) {
            localStorage.clear();
            homeFeed.innerHTML = '';
            shortsFeed.innerHTML = '';
            pauseCurrentShort();
            initializeSampleData();
            loadSavedVideos();
            alert('All videos cleared');
        }
    }

    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('sw.js')
                .then(registration => {
                    registration.addEventListener('updatefound', () => {
                        const newWorker = registration.installing;
                        newWorker.addEventListener('statechange', () => {
                            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                confirm('New version available! Reload?') && window.location.reload();
                            }
                        });
                    });
                })
                .catch(console.error);
        });
    }

    initApp();
});

function convertToPreviewUrl(url) {
    try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname;

        if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
            const videoId = urlObj.searchParams.get('v') || urlObj.pathname.split('/').pop().replace(/[?#].*$/, '');
            return `https://www.youtube.com/embed/${videoId}?rel=0&showinfo=0`;
        }

        if (hostname.includes('drive.google.com')) {
            return url.replace('/view', '/preview').split('&')[0];
        }

        if (url.endsWith('.mp4')) {
            return { type: 'native', src: url };
        }

        if (hostname.includes('xhamster')) {
            return { type: 'proxy', src: `https://videohub-mu-smoky.vercel.app/embed?url=${encodeURIComponent(url)}` };
        }

        return url;
    } catch {
        return url;
    }
}
