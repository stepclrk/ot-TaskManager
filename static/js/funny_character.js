// Funny Character Module - Adds personality to the task manager!
let characterData = null;
let characterTimer = null;
let lastShownCommentId = null;
let characterEnabled = true;
let shownComments = [];
let isCharacterVisible = false;

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
    
    // Create character UI if it doesn't exist
    if (!document.getElementById('funnyCharacter')) {
        createCharacterUI();
    }
    
    // Load comments from server
    await loadFunnyComments();
    
    // Try to sync from FTP (if enabled)
    await syncFunnyComments();
    
    // Start the random timer
    startCharacterTimer();
    
    // Show welcome message on first load
    const hasSeenWelcome = localStorage.getItem('hasSeenCharacterWelcome');
    if (!hasSeenWelcome) {
        setTimeout(() => {
            showCharacterMessage(null, true); // Show welcome message
            localStorage.setItem('hasSeenCharacterWelcome', 'true');
        }, 3000);
    }
}

// Create the character UI elements
function createCharacterUI() {
    const characterHTML = `
        <div id="funnyCharacter" class="character-container hidden">
            <div class="character-wrapper">
                <div class="character-avatar">
                    <span class="character-emoji">🤖</span>
                    <div class="character-animation"></div>
                </div>
                <div class="character-bubble">
                    <button class="character-close" onclick="dismissCharacter()" title="Close">×</button>
                    <div class="character-name">Tasky</div>
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
                right: 30px;
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
                left: -10px;
                width: 0;
                height: 0;
                border-style: solid;
                border-width: 10px 15px 10px 0;
                border-color: transparent white transparent transparent;
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
            
            @media (max-width: 600px) {
                .character-container {
                    bottom: 20px;
                    right: 20px;
                    left: 20px;
                }
                
                .character-bubble {
                    max-width: calc(100vw - 140px);
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
            
            // Update character name and emoji if provided
            if (characterData.settings) {
                const nameElement = document.querySelector('.character-name');
                const emojiElement = document.querySelector('.character-emoji');
                
                if (nameElement && characterData.settings.character_name) {
                    nameElement.textContent = characterData.settings.character_name;
                }
                if (emojiElement && characterData.settings.character_emoji) {
                    emojiElement.textContent = characterData.settings.character_emoji;
                }
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
    
    if (isWelcome) {
        // Show a welcome message
        comment = {
            text: `Hi there! I'm ${characterData.settings?.character_name || 'Tasky'}, your friendly task companion! I'll pop by occasionally with fun facts and encouragement. You can mute me anytime if you need to focus! 🎉`
        };
    } else if (specificComment) {
        comment = specificComment;
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
        isCharacterVisible = false;
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
    
    // Clear timer
    if (characterTimer) {
        clearTimeout(characterTimer);
    }
    
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
    reload: loadFunnyComments
};