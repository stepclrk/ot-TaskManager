// Funny Character Module - Adds personality to the task manager!
let characterData = null;
let characterTimer = null;
let overdueCheckTimer = null;
let lastShownCommentId = null;
let characterEnabled = true;
let shownComments = [];
let isCharacterVisible = false;
let lastOverdueNotification = null;
let notifiedTasks = new Set();
let aiChatEnabled = false;
let chatHistory = [];
let isTyping = false;
let chatMode = false;

// Check if AI chat is available
async function checkAIChatAvailability() {
    try {
        const response = await fetch('/api/settings');
        if (response.ok) {
            const settings = await response.json();
            aiChatEnabled = settings.ai_provider === 'claude' && settings.api_key && settings.api_key !== '';
            return aiChatEnabled;
        }
    } catch (error) {
        console.log('Could not check AI availability:', error);
    }
    return false;
}

// Load chat history from localStorage
function loadChatHistory() {
    const saved = localStorage.getItem('taskyChatHistory');
    if (saved) {
        try {
            chatHistory = JSON.parse(saved);
            // Keep only last 50 messages
            if (chatHistory.length > 50) {
                chatHistory = chatHistory.slice(-50);
                saveChatHistory();
            }
        } catch (e) {
            chatHistory = [];
        }
    }
}

// Save chat history to localStorage
function saveChatHistory() {
    localStorage.setItem('taskyChatHistory', JSON.stringify(chatHistory));
}

// Initialize the funny character system
async function initializeFunnyCharacter() {
    // Load character preferences from localStorage
    const savedPrefs = localStorage.getItem('characterPreferences');
    if (savedPrefs) {
        const prefs = JSON.parse(savedPrefs);
        characterEnabled = prefs.enabled !== false;
    }
    
    if (!characterEnabled) {
        console.log('Funny character is disabled');
        return;
    }
    
    // Check if AI chat is available
    await checkAIChatAvailability();
    
    // Load chat history if AI is enabled
    if (aiChatEnabled) {
        loadChatHistory();
    }
    
    // Create character UI if it doesn't exist
    if (!document.getElementById('funnyCharacter')) {
        createCharacterUI();
    }
    
    // Create floating icon if AI is enabled
    if (aiChatEnabled && !document.getElementById('floatingChatIcon')) {
        createFloatingIcon();
    }
    
    // Load comments from server
    await loadFunnyComments();
    
    // Try to sync from FTP (if enabled)
    await syncFunnyComments();
    
    // Start the random timer (only if AI chat is not enabled)
    if (!aiChatEnabled) {
        startCharacterTimer();
    }
    
    // Start checking for overdue tasks (works regardless of AI settings)
    startOverdueTaskChecker();
    
    // Show welcome message on first load
    const hasSeenWelcome = localStorage.getItem('hasSeenCharacterWelcome');
    if (!hasSeenWelcome && !aiChatEnabled) {
        setTimeout(() => {
            showCharacterMessage(null, true); // Show welcome message
            localStorage.setItem('hasSeenCharacterWelcome', 'true');
        }, 3000);
    }
}

// Create floating chat icon
function createFloatingIcon() {
    const iconHTML = `
        <div id="floatingChatIcon" class="floating-chat-icon" onclick="toggleChatMode()" title="Chat with Tasky AI">
            <img src="/static/images/tasky.png" alt="Tasky" class="tasky-image-icon">
            <div class="chat-notification-badge hidden">!</div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', iconHTML);
}

// Create the character UI elements
function createCharacterUI() {
    const characterHTML = `
        <div id="funnyCharacter" class="character-container hidden">
            <div class="character-wrapper">
                <div class="character-avatar">
                    <img src="/static/images/tasky.png" alt="Tasky" class="tasky-image">
                    <div class="character-animation"></div>
                </div>
                <div class="character-bubble">
                    <button class="character-close" onclick="dismissCharacter()" title="Close">×</button>
                    <div class="character-name">Tasky${aiChatEnabled ? ' AI Assistant' : ''}</div>
                    
                    <!-- Regular message mode -->
                    <div id="regularMode" class="character-mode">
                        <p id="characterMessage"></p>
                        <div class="character-actions">
                            <button class="btn-small" onclick="tellMeAnother()">
                                <span>🎲</span> Another!
                            </button>
                            <button class="btn-small" onclick="reactToComment('like')">
                                <span>👍</span>
                            </button>
                            <button class="btn-small" onclick="reactToComment('laugh')">
                                <span>😄</span>
                            </button>
                            <button class="btn-small" onclick="muteCharacter()">
                                <span>🔇</span> Mute
                            </button>
                        </div>
                    </div>
                    
                    <!-- Chat mode (only shown when AI is enabled) -->
                    <div id="chatMode" class="character-mode hidden">
                        <div class="chat-messages" id="chatMessages">
                            <div class="chat-welcome">Hi! I'm Tasky AI, your intelligent task assistant. Ask me anything about your tasks, projects, or productivity!</div>
                        </div>
                        <div class="chat-typing hidden" id="chatTyping">
                            <span class="typing-dot"></span>
                            <span class="typing-dot"></span>
                            <span class="typing-dot"></span>
                        </div>
                        <div class="chat-input-container">
                            <input type="text" id="chatInput" class="chat-input" placeholder="Ask about your tasks..." onkeypress="handleChatKeypress(event)">
                            <button class="chat-send-btn" onclick="sendChatMessage()">
                                <span>📤</span>
                            </button>
                        </div>
                        <div class="chat-actions">
                            <button class="btn-small" onclick="clearChatHistory()">
                                <span>🗑️</span> Clear
                            </button>
                            <button class="btn-small" onclick="exportChatHistory()">
                                <span>💾</span> Export
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Add to body
    document.body.insertAdjacentHTML('beforeend', characterHTML);
    
    // Add CSS styles
    addCharacterStyles();
}

// Add CSS styles for the character
function addCharacterStyles() {
    const styles = `
        <style>
            .character-container {
                position: fixed;
                bottom: 30px;
                left: 30px;
                z-index: 9999;
                transition: all 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55);
                transform: translateY(0);
            }
            
            .character-container.hidden {
                transform: translateY(150%);
                opacity: 0;
                pointer-events: none;
            }
            
            .character-wrapper {
                display: flex;
                flex-direction: row-reverse;
                align-items: flex-end;
                gap: 15px;
            }
            
            .character-avatar {
                position: relative;
                width: 80px;
                height: 80px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 10px 25px rgba(0,0,0,0.2);
                animation: float 3s ease-in-out infinite;
                cursor: pointer;
                transition: transform 0.3s;
            }
            
            .character-avatar:hover {
                transform: scale(1.1) rotate(10deg);
            }
            
            .character-emoji {
                font-size: 40px;
                user-select: none;
                animation: wobble 5s ease-in-out infinite;
            }
            
            .tasky-image {
                width: 60px;
                height: 60px;
                object-fit: contain;
                user-select: none;
                animation: wobble 5s ease-in-out infinite;
            }
            
            .tasky-image-icon {
                width: 40px;
                height: 40px;
                object-fit: contain;
                user-select: none;
            }
            
            .character-bubble {
                background: white;
                border-radius: 20px;
                padding: 20px;
                max-width: 350px;
                box-shadow: 0 10px 30px rgba(0,0,0,0.15);
                position: relative;
                animation: slideInRight 0.5s ease;
            }
            
            .character-bubble::before {
                content: '';
                position: absolute;
                bottom: 20px;
                right: -10px;
                width: 0;
                height: 0;
                border-style: solid;
                border-width: 10px 0 10px 15px;
                border-color: transparent transparent transparent white;
            }
            
            .character-close {
                position: absolute;
                top: 10px;
                right: 10px;
                background: none;
                border: none;
                font-size: 24px;
                cursor: pointer;
                color: #999;
                transition: color 0.3s;
                padding: 0;
                width: 25px;
                height: 25px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .character-close:hover {
                color: #333;
                transform: scale(1.2);
            }
            
            .character-name {
                font-weight: bold;
                color: #667eea;
                margin-bottom: 10px;
                font-size: 14px;
            }
            
            #characterMessage {
                margin: 10px 0 15px 0;
                color: #333;
                line-height: 1.5;
                font-size: 15px;
            }
            
            .character-actions {
                display: flex;
                gap: 8px;
                flex-wrap: wrap;
            }
            
            .character-actions .btn-small {
                padding: 5px 10px;
                background: #f0f0f0;
                border: none;
                border-radius: 15px;
                cursor: pointer;
                font-size: 13px;
                transition: all 0.3s;
                display: flex;
                align-items: center;
                gap: 5px;
            }
            
            .character-actions .btn-small:hover {
                background: #667eea;
                color: white;
                transform: scale(1.05);
            }
            
            @keyframes float {
                0%, 100% { transform: translateY(0); }
                50% { transform: translateY(-10px); }
            }
            
            @keyframes wobble {
                0%, 100% { transform: rotate(0deg); }
                25% { transform: rotate(-5deg); }
                75% { transform: rotate(5deg); }
            }
            
            @keyframes slideInRight {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
            
            .character-animation {
                position: absolute;
                top: -5px;
                right: -5px;
                width: 20px;
                height: 20px;
                background: #4CAF50;
                border-radius: 50%;
                animation: pulse 2s infinite;
            }
            
            @keyframes pulse {
                0% {
                    transform: scale(1);
                    opacity: 1;
                }
                50% {
                    transform: scale(1.5);
                    opacity: 0.5;
                }
                100% {
                    transform: scale(1);
                    opacity: 1;
                }
            }
            
            /* Chat mode styles */
            .character-mode {
                display: block;
            }
            
            .character-mode.hidden {
                display: none;
            }
            
            .chat-messages {
                max-height: 300px;
                overflow-y: auto;
                margin: 10px 0;
                padding: 10px;
                background: #f8f9fa;
                border-radius: 10px;
            }
            
            .chat-message {
                margin: 8px 0;
                padding: 8px 12px;
                border-radius: 12px;
                animation: fadeIn 0.3s;
            }
            
            .chat-message.user {
                background: #667eea;
                color: white;
                margin-left: 20%;
                text-align: right;
            }
            
            .chat-message.assistant {
                background: white;
                border: 1px solid #e0e0e0;
                margin-right: 20%;
                line-height: 1.6;
            }
            
            /* Formatted text styles */
            .chat-message p {
                margin: 0 0 8px 0;
            }
            
            .chat-message p:last-child {
                margin-bottom: 0;
            }
            
            .chat-message strong {
                font-weight: 600;
                color: #2c3e50;
            }
            
            .chat-message em {
                font-style: italic;
                color: #555;
            }
            
            .chat-message code {
                background: #f4f4f4;
                padding: 2px 6px;
                border-radius: 3px;
                font-family: 'Courier New', monospace;
                font-size: 0.9em;
                color: #d73a49;
            }
            
            .chat-message ul, .chat-message ol {
                margin: 8px 0;
                padding-left: 20px;
            }
            
            .chat-message li {
                margin: 4px 0;
                line-height: 1.5;
            }
            
            .chat-message ul li {
                list-style-type: disc;
            }
            
            .chat-message ol li {
                list-style-type: decimal;
            }
            
            .chat-message br {
                display: block;
                margin: 4px 0;
                content: "";
            }
            
            .chat-welcome {
                text-align: center;
                color: #666;
                font-style: italic;
                padding: 20px;
            }
            
            .chat-input-container {
                display: flex;
                gap: 8px;
                margin: 10px 0;
            }
            
            .chat-input {
                flex: 1;
                padding: 8px 12px;
                border: 1px solid #ddd;
                border-radius: 20px;
                font-size: 14px;
                outline: none;
                transition: border-color 0.3s;
            }
            
            .chat-input:focus {
                border-color: #667eea;
            }
            
            .chat-send-btn {
                background: #667eea;
                border: none;
                border-radius: 50%;
                width: 36px;
                height: 36px;
                cursor: pointer;
                transition: transform 0.2s;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .chat-send-btn:hover {
                transform: scale(1.1);
            }
            
            .chat-typing {
                display: flex;
                gap: 4px;
                padding: 10px;
                align-items: center;
            }
            
            .typing-dot {
                width: 8px;
                height: 8px;
                background: #999;
                border-radius: 50%;
                animation: typing 1.4s infinite;
            }
            
            .typing-dot:nth-child(2) {
                animation-delay: 0.2s;
            }
            
            .typing-dot:nth-child(3) {
                animation-delay: 0.4s;
            }
            
            @keyframes typing {
                0%, 60%, 100% {
                    transform: translateY(0);
                    opacity: 0.7;
                }
                30% {
                    transform: translateY(-10px);
                    opacity: 1;
                }
            }
            
            @keyframes fadeIn {
                from { opacity: 0; transform: translateY(10px); }
                to { opacity: 1; transform: translateY(0); }
            }
            
            /* Floating icon styles */
            .floating-chat-icon {
                position: fixed;
                bottom: 30px;
                left: 30px;
                width: 60px;
                height: 60px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                box-shadow: 0 4px 20px rgba(0,0,0,0.2);
                z-index: 9998;
                transition: transform 0.3s;
                animation: floatIcon 3s ease-in-out infinite;
            }
            
            .floating-chat-icon:hover {
                transform: scale(1.1);
            }
            
            .chat-icon-emoji {
                font-size: 30px;
                user-select: none;
            }
            
            .chat-notification-badge {
                position: absolute;
                top: 0;
                right: 0;
                width: 20px;
                height: 20px;
                background: #ff4444;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-size: 12px;
                font-weight: bold;
            }
            
            @keyframes floatIcon {
                0%, 100% { transform: translateY(0); }
                50% { transform: translateY(-5px); }
            }
            
            /* Expanded chat mode */
            .character-container.chat-expanded .character-bubble {
                max-width: 450px;
                min-height: 500px;
            }
            
            .character-container.chat-expanded .chat-messages {
                max-height: 350px;
            }
            
            .chat-actions {
                display: flex;
                gap: 8px;
                margin-top: 10px;
            }
            
            @media (max-width: 600px) {
                .character-container {
                    bottom: 20px;
                    left: 20px;
                    right: 20px;
                }
                
                .character-bubble {
                    max-width: calc(100vw - 140px);
                }
                
                .floating-chat-icon {
                    bottom: 20px;
                    left: 20px;
                }
                
                .character-container.chat-expanded .character-bubble {
                    max-width: calc(100vw - 60px);
                }
            }
        </style>
    `;
    
    document.head.insertAdjacentHTML('beforeend', styles);
}

// Load funny comments from the server
async function loadFunnyComments() {
    try {
        const response = await fetch('/api/funny-comments');
        if (response.ok) {
            characterData = await response.json();
            console.log(`Loaded ${characterData.comments.length} funny comments`);
            
            // Update character name if provided (emoji is now replaced with image)
            if (characterData.settings) {
                const nameElement = document.querySelector('.character-name');
                
                if (nameElement && characterData.settings.character_name) {
                    nameElement.textContent = characterData.settings.character_name;
                }
                // Note: Character emoji setting is ignored as we now use the tasky.png image
            }
        }
    } catch (error) {
        console.error('Error loading funny comments:', error);
        // Use fallback comments
        characterData = {
            comments: [
                { id: '1', text: 'Hello! I\'m here to brighten your day!', category: 'greeting', mood: 'cheerful' }
            ],
            settings: {
                min_interval_minutes: 10,
                max_interval_minutes: 30,
                character_name: 'Tasky',
                character_emoji: '🤖'
            }
        };
    }
}

// Sync funny comments from FTP
async function syncFunnyComments() {
    try {
        const response = await fetch('/api/funny-comments/sync', {
            method: 'POST'
        });
        
        if (response.ok) {
            console.log('Funny comments synced from FTP');
            // Reload comments after sync
            await loadFunnyComments();
        } else if (response.status === 404) {
            console.log('No funny comments file on FTP yet');
        }
    } catch (error) {
        console.log('Could not sync funny comments from FTP:', error);
    }
}

// Start the random timer for showing character
function startCharacterTimer() {
    if (!characterEnabled || !characterData) return;
    
    // Clear existing timer
    if (characterTimer) {
        clearTimeout(characterTimer);
    }
    
    // Calculate random interval
    const minMinutes = characterData.settings?.min_interval_minutes || 10;
    const maxMinutes = characterData.settings?.max_interval_minutes || 30;
    const randomMinutes = Math.random() * (maxMinutes - minMinutes) + minMinutes;
    const randomMs = randomMinutes * 60 * 1000;
    
    console.log(`Next character appearance in ${randomMinutes.toFixed(1)} minutes`);
    
    // Set timer
    characterTimer = setTimeout(() => {
        if (characterEnabled && !isCharacterVisible) {
            showCharacterMessage();
        }
        // Restart timer for next appearance
        startCharacterTimer();
    }, randomMs);
}

// Show character with a message
function showCharacterMessage(specificComment = null, isWelcome = false) {
    if (!characterEnabled || !characterData || characterData.comments.length === 0) return;
    
    const characterElement = document.getElementById('funnyCharacter');
    const messageElement = document.getElementById('characterMessage');
    
    if (!characterElement || !messageElement) return;
    
    let comment;
    let isOverdueNotification = false;
    
    if (isWelcome) {
        // Show a welcome message
        comment = {
            text: `Hi there! I'm ${characterData.settings?.character_name || 'Tasky'}, your friendly task companion! I'll pop by occasionally with fun facts and encouragement. You can mute me anytime if you need to focus! 🎉`
        };
    } else if (specificComment) {
        comment = specificComment;
        isOverdueNotification = specificComment.isOverdue || false;
    } else {
        // Get a random comment that hasn't been shown recently
        const availableComments = characterData.comments.filter(c => 
            !shownComments.includes(c.id) || shownComments.length >= characterData.comments.length - 2
        );
        
        if (availableComments.length === 0) {
            // Reset shown comments if we've shown them all
            shownComments = [];
            comment = characterData.comments[Math.floor(Math.random() * characterData.comments.length)];
        } else {
            comment = availableComments[Math.floor(Math.random() * availableComments.length)];
        }
    }
    
    // Update message
    messageElement.textContent = comment.text;
    
    // Track shown comment
    if (comment.id) {
        lastShownCommentId = comment.id;
        shownComments.push(comment.id);
        // Keep only last 10 shown comments
        if (shownComments.length > 10) {
            shownComments.shift();
        }
    }
    
    // Update action buttons for overdue notifications
    if (isOverdueNotification) {
        const actionsDiv = document.querySelector('.character-actions');
        if (actionsDiv) {
            // Add a "View Tasks" button for overdue notifications
            const viewTasksBtn = actionsDiv.querySelector('.btn-view-tasks');
            if (!viewTasksBtn) {
                const btn = document.createElement('button');
                btn.className = 'btn-small btn-view-tasks';
                btn.innerHTML = '<span>📋</span> View Tasks';
                btn.onclick = () => {
                    window.location.href = '/?filter=overdue';
                    dismissCharacter();
                };
                actionsDiv.insertBefore(btn, actionsDiv.firstChild);
            }
        }
    }
    
    // Show character with animation
    characterElement.classList.remove('hidden');
    isCharacterVisible = true;
    
    // Play a subtle sound if enabled (optional)
    playCharacterSound();
    
    // Auto-hide after some time (optional)
    // Uncomment if you want auto-hide:
    // setTimeout(() => {
    //     if (isCharacterVisible) {
    //         dismissCharacter();
    //     }
    // }, 30000); // Hide after 30 seconds
}

// Dismiss the character
function dismissCharacter() {
    const characterElement = document.getElementById('funnyCharacter');
    if (characterElement) {
        characterElement.classList.add('hidden');
        characterElement.classList.remove('chat-expanded');
        isCharacterVisible = false;
        chatMode = false;
        
        // Reset to regular mode for next time
        const regularMode = document.getElementById('regularMode');
        const chatModeElement = document.getElementById('chatMode');
        if (regularMode) regularMode.classList.remove('hidden');
        if (chatModeElement) chatModeElement.classList.add('hidden');
        
        // Remove the View Tasks button if it exists
        const viewTasksBtn = document.querySelector('.btn-view-tasks');
        if (viewTasksBtn) {
            viewTasksBtn.remove();
        }
    }
}

// Show another random message
function tellMeAnother() {
    // Hide current message briefly for animation effect
    const characterElement = document.getElementById('funnyCharacter');
    characterElement.style.transform = 'scale(0.95)';
    
    setTimeout(() => {
        characterElement.style.transform = 'scale(1)';
        showCharacterMessage();
    }, 200);
}

// React to a comment
function reactToComment(reaction) {
    console.log(`User reacted with: ${reaction} to comment ${lastShownCommentId}`);
    
    // Store reaction (could be sent to server for analytics)
    const reactions = JSON.parse(localStorage.getItem('commentReactions') || '{}');
    if (lastShownCommentId) {
        if (!reactions[lastShownCommentId]) {
            reactions[lastShownCommentId] = {};
        }
        reactions[lastShownCommentId][reaction] = (reactions[lastShownCommentId][reaction] || 0) + 1;
        localStorage.setItem('commentReactions', JSON.stringify(reactions));
    }
    
    // Show thank you message briefly
    const messageElement = document.getElementById('characterMessage');
    const originalMessage = messageElement.textContent;
    messageElement.textContent = reaction === 'like' ? 'Thanks! Glad you liked it! 😊' : 'Haha, happy to make you smile! 😄';
    
    setTimeout(() => {
        dismissCharacter();
    }, 2000);
}

// Mute/unmute the character
function muteCharacter() {
    characterEnabled = false;
    
    // Save preference
    const prefs = JSON.parse(localStorage.getItem('characterPreferences') || '{}');
    prefs.enabled = false;
    localStorage.setItem('characterPreferences', JSON.stringify(prefs));
    
    // Clear timers
    if (characterTimer) {
        clearTimeout(characterTimer);
    }
    stopOverdueTaskChecker();
    
    // Show goodbye message
    const messageElement = document.getElementById('characterMessage');
    messageElement.textContent = 'No problem! I\'ll be quiet now. You can enable me again in Settings if you miss me! 👋';
    
    setTimeout(() => {
        dismissCharacter();
    }, 3000);
}

// Enable the character (called from settings)
function enableCharacter() {
    characterEnabled = true;
    
    // Save preference
    const prefs = JSON.parse(localStorage.getItem('characterPreferences') || '{}');
    prefs.enabled = true;
    localStorage.setItem('characterPreferences', JSON.stringify(prefs));
    
    // Restart system
    initializeFunnyCharacter();
}

// Play a subtle sound when character appears (optional)
function playCharacterSound() {
    // Only play if sound is enabled
    const prefs = JSON.parse(localStorage.getItem('characterPreferences') || '{}');
    if (prefs.soundEnabled === false) return;
    
    // Create a simple beep sound using Web Audio API
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = 800; // Frequency in Hz
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.2);
    } catch (error) {
        // Silently fail if audio is not supported
        console.log('Audio not supported');
    }
}

// Check for overdue tasks
async function checkForOverdueTasks() {
    if (!characterEnabled || isCharacterVisible) return;
    
    try {
        // Fetch tasks summary which includes overdue tasks
        const response = await fetch('/api/tasks/summary');
        if (!response.ok) return;
        
        const data = await response.json();
        const overdueTasks = data.overdue_tasks || [];
        
        if (overdueTasks.length === 0) {
            // Clear notified tasks if no overdue tasks
            notifiedTasks.clear();
            return;
        }
        
        // Find tasks we haven't notified about yet
        const newOverdueTasks = overdueTasks.filter(task => !notifiedTasks.has(task.id));
        
        if (newOverdueTasks.length > 0) {
            // Get the most urgent task (first one)
            const urgentTask = newOverdueTasks[0];
            
            // Add to notified list
            notifiedTasks.add(urgentTask.id);
            
            // Create custom message based on how overdue it is
            const overdueMessage = createOverdueMessage(urgentTask);
            
            // Show the character with overdue notification
            showCharacterMessage({ text: overdueMessage, isOverdue: true });
            
            // Update last notification time
            lastOverdueNotification = Date.now();
        }
    } catch (error) {
        console.log('Error checking overdue tasks:', error);
    }
}

// Create a custom message for overdue tasks
function createOverdueMessage(task) {
    const messages = [
        `🚨 Hey! "${task.title}" is overdue! Time to tackle it before it grows legs and runs away!`,
        `⏰ Psst... "${task.title}" missed its deadline. Want me to remind you again in 10 minutes, or should we handle it now?`,
        `📅 Uh oh! "${task.title}" is playing hide and seek with its deadline. It's been hiding for a while now!`,
        `🎯 Friendly nudge: "${task.title}" needs your attention! It's been waiting patiently (or not so patiently).`,
        `💡 Quick reminder: "${task.title}" is overdue. Sometimes the hardest part is just starting!`,
        `🔔 "${task.title}" is waving frantically for attention! It's past its follow-up date.`,
        `⚡ Alert! "${task.title}" has crossed into the overdue zone. Let's bring it back!`,
        `🌟 "${task.title}" is overdue but hey, better late than never, right? Let's do this!`
    ];
    
    // Calculate how overdue it is
    const followUpDate = new Date(task.follow_up_date);
    const now = new Date();
    const daysOverdue = Math.floor((now - followUpDate) / (1000 * 60 * 60 * 24));
    
    let message = messages[Math.floor(Math.random() * messages.length)];
    
    // Add urgency based on how overdue
    if (daysOverdue > 7) {
        message += ` (It's been ${daysOverdue} days! 😱)`;
    } else if (daysOverdue > 3) {
        message += ` (${daysOverdue} days overdue)`;
    } else if (daysOverdue === 1) {
        message += ` (Since yesterday)`;
    } else if (daysOverdue === 0) {
        message += ` (Due today!)`;
    }
    
    return message;
}

// Start the overdue task checker
function startOverdueTaskChecker() {
    if (!characterEnabled) return;
    
    // Clear existing timer
    if (overdueCheckTimer) {
        clearInterval(overdueCheckTimer);
    }
    
    // Check immediately on start
    setTimeout(() => {
        checkForOverdueTasks();
    }, 10000); // Wait 10 seconds after init
    
    // Then check every 15 minutes
    overdueCheckTimer = setInterval(() => {
        checkForOverdueTasks();
    }, 15 * 60 * 1000); // 15 minutes
}

// Stop the overdue task checker
function stopOverdueTaskChecker() {
    if (overdueCheckTimer) {
        clearInterval(overdueCheckTimer);
        overdueCheckTimer = null;
    }
}

// Toggle chat mode
function toggleChatMode() {
    const characterElement = document.getElementById('funnyCharacter');
    const regularMode = document.getElementById('regularMode');
    const chatModeElement = document.getElementById('chatMode');
    
    if (!characterElement || !aiChatEnabled) return;
    
    // Toggle visibility
    if (isCharacterVisible && chatMode) {
        // Hide if already in chat mode
        dismissCharacter();
    } else {
        // Show in chat mode
        chatMode = true;
        isCharacterVisible = true;
        
        // Hide regular mode, show chat mode
        if (regularMode) regularMode.classList.add('hidden');
        if (chatModeElement) chatModeElement.classList.remove('hidden');
        
        // Add expanded class for chat
        characterElement.classList.add('chat-expanded');
        characterElement.classList.remove('hidden');
        
        // Load chat history
        displayChatHistory();
        
        // Focus input
        setTimeout(() => {
            const input = document.getElementById('chatInput');
            if (input) input.focus();
        }, 100);
    }
}

// Format text with basic markdown support
function formatChatText(text) {
    // Escape HTML first
    let formatted = text.replace(/&/g, '&amp;')
                       .replace(/</g, '&lt;')
                       .replace(/>/g, '&gt;');
    
    // Convert markdown-style formatting
    // Bold: **text** or __text__
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    formatted = formatted.replace(/__(.*?)__/g, '<strong>$1</strong>');
    
    // Italic: *text* or _text_
    formatted = formatted.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    formatted = formatted.replace(/_([^_]+)_/g, '<em>$1</em>');
    
    // Code: `code`
    formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // Bullet points: lines starting with - or •
    formatted = formatted.replace(/^[-•]\s+(.+)$/gm, '<li>$1</li>');
    formatted = formatted.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
    
    // Numbered lists: lines starting with number.
    formatted = formatted.replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>');
    
    // Line breaks
    formatted = formatted.replace(/\n\n/g, '</p><p>');
    formatted = formatted.replace(/\n/g, '<br>');
    
    // Wrap in paragraph if not already wrapped
    if (!formatted.startsWith('<ul>') && !formatted.startsWith('<ol>')) {
        formatted = '<p>' + formatted + '</p>';
    }
    
    return formatted;
}

// Display chat history
function displayChatHistory() {
    const messagesContainer = document.getElementById('chatMessages');
    if (!messagesContainer) return;
    
    // Clear current display
    messagesContainer.innerHTML = '';
    
    if (chatHistory.length === 0) {
        messagesContainer.innerHTML = '<div class="chat-welcome">Hi! I\'m Tasky AI, your intelligent task assistant. Ask me anything about your tasks, projects, or productivity!</div>';
    } else {
        chatHistory.forEach(msg => {
            const msgDiv = document.createElement('div');
            msgDiv.className = `chat-message ${msg.role}`;
            
            // Use formatted text for assistant messages, plain text for user
            if (msg.role === 'assistant') {
                msgDiv.innerHTML = formatChatText(msg.content);
            } else {
                msgDiv.textContent = msg.content;
            }
            
            messagesContainer.appendChild(msgDiv);
        });
        
        // Scroll to bottom
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
}

// Handle chat input keypress
function handleChatKeypress(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendChatMessage();
    }
}

// Send chat message
async function sendChatMessage() {
    const input = document.getElementById('chatInput');
    const messagesContainer = document.getElementById('chatMessages');
    const typingIndicator = document.getElementById('chatTyping');
    
    if (!input || !input.value.trim() || isTyping) return;
    
    const message = input.value.trim();
    input.value = '';
    
    // Add user message to history
    const userMsg = { role: 'user', content: message, timestamp: new Date().toISOString() };
    chatHistory.push(userMsg);
    
    // Display user message
    const userDiv = document.createElement('div');
    userDiv.className = 'chat-message user';
    userDiv.textContent = message;
    messagesContainer.appendChild(userDiv);
    
    // Show typing indicator
    isTyping = true;
    if (typingIndicator) typingIndicator.classList.remove('hidden');
    
    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    try {
        // Send to API
        const response = await fetch('/api/ai/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: message,
                context: 'task_assistant'
            })
        });
        
        if (response.ok) {
            const data = await response.json();
            
            // Add assistant response to history
            const assistantMsg = { role: 'assistant', content: data.response, timestamp: new Date().toISOString() };
            chatHistory.push(assistantMsg);
            
            // Keep only last 50 messages
            if (chatHistory.length > 50) {
                chatHistory = chatHistory.slice(-50);
            }
            
            // Save history
            saveChatHistory();
            
            // Display assistant message with formatting
            const assistantDiv = document.createElement('div');
            assistantDiv.className = 'chat-message assistant';
            assistantDiv.innerHTML = formatChatText(data.response);
            messagesContainer.appendChild(assistantDiv);
        } else {
            // Handle error
            const errorDiv = document.createElement('div');
            errorDiv.className = 'chat-message assistant';
            errorDiv.textContent = 'Sorry, I encountered an error. Please make sure AI is properly configured in settings.';
            messagesContainer.appendChild(errorDiv);
        }
    } catch (error) {
        console.error('Chat error:', error);
        const errorDiv = document.createElement('div');
        errorDiv.className = 'chat-message assistant';
        errorDiv.textContent = 'Sorry, I couldn\'t connect to the server. Please try again.';
        messagesContainer.appendChild(errorDiv);
    } finally {
        // Hide typing indicator
        isTyping = false;
        if (typingIndicator) typingIndicator.classList.add('hidden');
        
        // Scroll to bottom
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
}

// Clear chat history
function clearChatHistory() {
    if (confirm('Are you sure you want to clear the chat history?')) {
        chatHistory = [];
        saveChatHistory();
        displayChatHistory();
    }
}

// Export chat history
function exportChatHistory() {
    if (chatHistory.length === 0) {
        alert('No chat history to export');
        return;
    }
    
    const exportData = {
        exported_at: new Date().toISOString(),
        messages: chatHistory
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tasky-chat-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Wait a bit before initializing to let main app load
    setTimeout(() => {
        initializeFunnyCharacter();
    }, 5000);
});

// Export functions for use in other modules
window.funnyCharacter = {
    enable: enableCharacter,
    disable: muteCharacter,
    show: showCharacterMessage,
    dismiss: dismissCharacter,
    reload: loadFunnyComments,
    checkOverdue: checkForOverdueTasks
};