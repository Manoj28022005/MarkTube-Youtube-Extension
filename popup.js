import { getActiveTabURL } from "./utils.js";

const addNewBookmark = (bookmarks, bookmark) => {
  const bookmarkTitleElement = document.createElement("div");
  const controlsElement = document.createElement("div");
  const newBookmarkElement = document.createElement("div");

  bookmarkTitleElement.textContent = bookmark.desc;
  bookmarkTitleElement.className = "bookmark-title";
  controlsElement.className = "bookmark-controls";

  setBookmarkAttributes("play", onPlay, controlsElement);
  setBookmarkAttributes("delete", onDelete, controlsElement);

  newBookmarkElement.id = "bookmark-" + bookmark.time;
  newBookmarkElement.className = "bookmark";
  newBookmarkElement.setAttribute("timestamp", bookmark.time);

  newBookmarkElement.appendChild(bookmarkTitleElement);
  newBookmarkElement.appendChild(controlsElement);
  bookmarks.appendChild(newBookmarkElement);
};

const viewBookmarks = (currentBookmarks=[]) => {
  const bookmarksElement = document.getElementById("bookmarks");
  bookmarksElement.innerHTML = "";

  if (currentBookmarks.length > 0) {
    for (let i = 0; i < currentBookmarks.length; i++) {
      const bookmark = currentBookmarks[i];
      addNewBookmark(bookmarksElement, bookmark);
    }
  } else {
    bookmarksElement.innerHTML = '<div class="empty-bookmarks">No bookmarks for this video yet</div>';
  }
};

const onPlay = async e => {
  const bookmarkTime = e.target.parentNode.parentNode.getAttribute("timestamp");
  const activeTab = await getActiveTabURL();

  chrome.tabs.sendMessage(activeTab.id, {
    type: "PLAY",
    value: bookmarkTime,
  });
};

const onDelete = async e => {
  const activeTab = await getActiveTabURL();
  const bookmarkTime = e.target.parentNode.parentNode.getAttribute("timestamp");
  const bookmarkElementToDelete = document.getElementById(
    "bookmark-" + bookmarkTime
  );

  bookmarkElementToDelete.parentNode.removeChild(bookmarkElementToDelete);

  chrome.tabs.sendMessage(activeTab.id, {
    type: "DELETE",
    value: parseFloat(bookmarkTime),
  }, (updatedBookmarks) => {
    if (updatedBookmarks) {
      viewBookmarks(updatedBookmarks);
    }
  });
};

const setBookmarkAttributes = (src, eventListener, controlParentElement) => {
  const controlElement = document.createElement("img");

  controlElement.src = "assets/" + src + ".png";
  controlElement.title = src;
  controlElement.addEventListener("click", eventListener);
  controlParentElement.appendChild(controlElement);
};

// Function to get time in HH:MM:SS format
const formatTime = (t) => {
  let date = new Date(0);
  date.setSeconds(t);
  return date.toISOString().substr(11, 8);
};

// Function to create a clickable timestamp URL
const getTimestampUrl = (videoUrl, seconds) => {
  // Make sure we're not duplicating timestamp parameters
  let baseUrl = videoUrl.split('&t=')[0];
  return `${baseUrl}&t=${Math.floor(seconds)}s`;
};

// Create PDF-like bookmarks document
const generateBookmarksDocument = (videoTitle, videoUrl, bookmarks) => {
  // Create HTML content
  let htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>${videoTitle} - Bookmarks</title>
      <style>
        @page { margin: 1cm; }
        body {
          font-family: 'Segoe UI', Arial, sans-serif;
          line-height: 1.5;
          margin: 0;
          padding: 20px;
          background-color: white;
          color: #333;
        }
        h1 { 
          color: #cc0000; 
          border-bottom: 1px solid #ddd;
          padding-bottom: 10px;
          font-size: 24px;
        }
        h2 {
          font-size: 18px;
          margin-top: 20px;
        }
        .bookmark { 
          border: 1px solid #e0e0e0; 
          border-radius: 6px; 
          padding: 15px; 
          margin-bottom: 15px;
          background-color: #f9f9f9;
          page-break-inside: avoid;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .bookmark p {
          margin: 5px 0;
        }
        .timestamp { 
          color: #0066cc; 
          font-weight: bold;
        }
        .video-info {
          background-color: #f5f5f5;
          padding: 15px;
          border-radius: 6px;
          margin-bottom: 20px;
          border-left: 4px solid #cc0000;
        }
        .video-info p {
          margin: 5px 0;
        }
        .footer { 
          margin-top: 30px; 
          color: #666; 
          font-size: 12px;
          text-align: center;
          border-top: 1px solid #ddd;
          padding-top: 15px;
        }
        .empty-message {
          font-style: italic;
          color: #666;
          text-align: center;
          padding: 20px;
        }
      </style>
    </head>
    <body>
      <h1>YouTube Bookmarks</h1>
      <div class="video-info">
        <p><strong>Video Title:</strong> ${videoTitle}</p>
        <p><strong>Video URL:</strong> ${videoUrl}</p>
      </div>
      <h2>Timestamps</h2>
  `;
  
  if (bookmarks.length > 0) {
    bookmarks.forEach(bookmark => {
      htmlContent += `
        <div class="bookmark">
          <p><strong>${bookmark.desc}</strong></p>
          <p class="timestamp">Timestamp: ${formatTime(bookmark.time)}</p>
        </div>
      `;
    });
  } else {
    htmlContent += `<p class="empty-message">No bookmarks for this video.</p>`;
  }
  
  const today = new Date().toLocaleDateString();
  htmlContent += `
      <div class="footer">Generated by MarkTube Chrome Extension - ${today}</div>
    </body>
    </html>
  `;
  
  return htmlContent;
};

document.addEventListener("DOMContentLoaded", async () => {
  const activeTab = await getActiveTabURL();
  let currentVideo = "";
  let currentVideoBookmarks = [];
  
  if (activeTab.url && activeTab.url.includes("youtube.com/watch")) {
    const queryParameters = activeTab.url.split("?")[1];
    const urlParameters = new URLSearchParams(queryParameters);
    currentVideo = urlParameters.get("v");

    if (currentVideo) {
      chrome.storage.sync.get([currentVideo], (data) => {
        currentVideoBookmarks = data[currentVideo] ? JSON.parse(data[currentVideo]) : [];
        viewBookmarks(currentVideoBookmarks);
      });
    }
  } else {
    const container = document.getElementsByClassName("container")[0];
    container.innerHTML = '<div class="title">This is not a YouTube video page</div>';
  }
  
  // Add event listener for share button
  const shareBtn = document.getElementById("shareBtn");
  if (shareBtn) {
    shareBtn.addEventListener("click", async () => {
      try {
        if (currentVideo && currentVideoBookmarks.length > 0) {
          // Update button state
          const originalText = shareBtn.innerHTML;
          shareBtn.innerHTML = '<img src="assets/share.png" alt="Share" /> Generating PDF...';
          shareBtn.disabled = true;
          
          // Get video info
          const videoTitle = activeTab.title.replace(" - YouTube", "");
          const videoUrl = activeTab.url;
          
          // Generate document
          const htmlContent = generateBookmarksDocument(videoTitle, videoUrl, currentVideoBookmarks);
          
          // Create the blob and URL
          const blob = new Blob([htmlContent], { type: 'text/html' });
          const blobUrl = URL.createObjectURL(blob);
          
          // Create sanitized filename
          const sanitizedTitle = videoTitle.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-');
          const filename = `${sanitizedTitle}_bookmarks.pdf`;
          
          // Download the file
          chrome.downloads.download({
            url: blobUrl,
            filename: filename,
            saveAs: true
          }, (downloadId) => {
            if (chrome.runtime.lastError) {
              console.error("Download error:", chrome.runtime.lastError);
              alert("Error generating PDF. Please try again.");
            }
            
            // Clean up the blob URL
            URL.revokeObjectURL(blobUrl);
          });
        } else {
          alert("No bookmarks to export.");
        }
      } catch (error) {
        console.error("Export error:", error);
        alert("Error exporting bookmarks. Please try again.");
      } finally {
        // Reset button state
        shareBtn.innerHTML = '<img src="assets/share.png" alt="Share" /> Export as PDF';
        shareBtn.disabled = false;
      }
    });
  }
});