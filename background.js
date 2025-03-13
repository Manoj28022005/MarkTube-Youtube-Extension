chrome.runtime.onInstalled.addListener(() => {
    console.log("Extension installed");
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab && tab.url && tab.url.includes("youtube.com/watch")) {
        // Extract the video ID from YouTube URL
        const queryParameters = tab.url.split("?")[1];
        const urlParameters = new URLSearchParams(queryParameters);
        const videoId = urlParameters.get("v");
        
        if (videoId) {
            // Execute content script and notify about new video
            chrome.scripting.executeScript({
                target: { tabId: tabId },
                files: ['contentScript.js']
            }).then(() => {
                // Send message after script is executed
                chrome.tabs.sendMessage(tabId, {
                    type: "NEW",
                    videoId: videoId
                });
            }).catch(err => {
                console.error("Error executing script: ", err);
            });
        }
    }
});

// These functions are not being used correctly in this context
// They should be in popup.js or should be modified to work with messages
function saveBookmark(videoId, timestamp) {
    const bookmark = { videoId, timestamp };
    chrome.storage.sync.get([videoId], (result) => {
        const bookmarks = result[videoId] ? JSON.parse(result[videoId]) : [];
        bookmarks.push(bookmark);
        chrome.storage.sync.set({ [videoId]: JSON.stringify(bookmarks) }, () => {
            console.log('Bookmark saved:', bookmark);
        });
    });
}