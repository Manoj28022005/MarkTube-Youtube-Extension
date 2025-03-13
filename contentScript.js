(() => {
    let youtubeLeftControls, youtubePlayer;
    let currentVideo = "";
    let currentVideoBookmarks = [];

    const fetchBookmarks = () => {
        return new Promise((resolve) => {
            chrome.storage.sync.get([currentVideo], (obj) => {
                resolve(obj[currentVideo] ? JSON.parse(obj[currentVideo]) : []);
            });
        });
    };

    // Create notification function
    const showNotification = (message, duration = 3000) => {
        // Check if notification already exists and remove it
        const existingNotification = document.getElementById('yt-bookmark-notification');
        if (existingNotification) {
            existingNotification.remove();
        }

        // Create notification element
        const notification = document.createElement('div');
        notification.id = 'yt-bookmark-notification';
        notification.textContent = message;
        
        // Style the notification
        notification.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            background-color: rgba(0, 0, 0, 0.7);
            color: white;
            padding: 12px 20px;
            border-radius: 4px;
            z-index: 9999;
            font-family: 'Roboto', Arial, sans-serif;
            font-size: 14px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
            display: flex;
            align-items: center;
            animation: fadeIn 0.3s ease-out;
        `;

        // Add a check mark icon
        const checkmark = document.createElement('span');
        checkmark.innerHTML = '✓';
        checkmark.style.cssText = `
            margin-right: 8px;
            color: #4CAF50;
            font-size: 16px;
            font-weight: bold;
        `;
        
        notification.prepend(checkmark);

        // Add animation styles
        const style = document.createElement('style');
        style.textContent = `
            @keyframes fadeIn {
                from { opacity: 0; transform: translateY(-20px); }
                to { opacity: 1; transform: translateY(0); }
            }
            @keyframes fadeOut {
                from { opacity: 1; transform: translateY(0); }
                to { opacity: 0; transform: translateY(-20px); }
            }
        `;
        document.head.appendChild(style);

        // Add to page
        document.body.appendChild(notification);

        // Remove after duration
        setTimeout(() => {
            notification.style.animation = 'fadeOut 0.3s ease-out';
            setTimeout(() => notification.remove(), 300);
        }, duration);
    };

    const addNewBookmarkEventHandler = async () => {
        const currentTime = youtubePlayer.currentTime;
        const newBookmark = {
            time: currentTime,
            desc: "Bookmark at " + getTime(currentTime),
            videoTitle: document.title.replace(" - YouTube", "")
        };

        currentVideoBookmarks = await fetchBookmarks();

        chrome.storage.sync.set({
            [currentVideo]: JSON.stringify([...currentVideoBookmarks, newBookmark].sort((a, b) => a.time - b.time))
        });

        // Show notification when bookmark is added
        showNotification("Bookmark added at " + getTime(currentTime));
    };

    const newVideoLoaded = async () => {
        console.log("New video detected, setting up UI...");

        const bookmarkBtnExists = document.getElementsByClassName("bookmark-btn")[0];
        
        if (bookmarkBtnExists) {
            bookmarkBtnExists.remove();
        }

        youtubeLeftControls = document.getElementsByClassName("ytp-left-controls")[0];
        youtubePlayer = document.getElementsByClassName('video-stream')[0];

        if (!youtubeLeftControls || !youtubePlayer) {
            console.warn("YouTube controls or player not found, retrying...");
            setTimeout(newVideoLoaded, 1000);
            return;
        }

        const bookmarkBtn = document.createElement("button");
        bookmarkBtn.className = "ytp-button bookmark-btn";
        bookmarkBtn.title = "Click to bookmark current timestamp";
        
        // Match YouTube button styling
        bookmarkBtn.style.cssText = `
            background: transparent;
            border: none;
            cursor: pointer;
            padding: 0;
            margin: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            width: 36px;
            height: 36px;
        `;
        
        // Create SVG icon (bookmark icon)
        const svgIcon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svgIcon.setAttribute("viewBox", "0 0 24 24");
        svgIcon.setAttribute("width", "22");
        svgIcon.setAttribute("height", "22");
        svgIcon.setAttribute("fill", "white");
        
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", "M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z");
        
        svgIcon.appendChild(path);
        bookmarkBtn.appendChild(svgIcon);
        
        youtubeLeftControls.appendChild(bookmarkBtn);
        bookmarkBtn.addEventListener("click", addNewBookmarkEventHandler);
        
        console.log("Bookmark button added");
    };

    chrome.runtime.onMessage.addListener((obj, sender, response) => {
        console.log("Message received in content script:", obj);
        const { type, value, videoId } = obj;

        if (type === "NEW") {
            currentVideo = videoId;
            newVideoLoaded();
        } else if (type === "PLAY") {
            console.log("Seeking to:", value);
            youtubePlayer.currentTime = value;
            // Show notification when seeking to a bookmark
            showNotification("Playing from bookmark");
        } else if (type === "DELETE") {
            console.log("Deleting bookmark at:", value);
            currentVideoBookmarks = currentVideoBookmarks.filter((b) => b.time != value);
            chrome.storage.sync.set({ [currentVideo]: JSON.stringify(currentVideoBookmarks) });
            // Show notification when deleting a bookmark
            showNotification("Bookmark deleted");
            response(currentVideoBookmarks);
        }
        
        return true; // Important for async response
    });

    // Check if we're already on a video page when content script loads
    if (window.location.href.includes("youtube.com/watch")) {
        const queryParameters = window.location.search.substring(1);
        const urlParameters = new URLSearchParams(queryParameters);
        const videoId = urlParameters.get("v");
        
        if (videoId) {
            currentVideo = videoId;
            newVideoLoaded();
        }
    }
})();

const getTime = (t) => {
    let date = new Date(0);
    date.setSeconds(t);
    return date.toISOString().substr(11, 8);
};