let currentConfig = {};
let currentSettings = {};
let currentTemplates = [];
let hasUnsavedChanges = false;

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    // Add to page
    document.body.appendChild(notification);
    
    // Show animation
    setTimeout(() => notification.classList.add('show'), 10);
    
    // Remove after 6 seconds
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            if (document.body.contains(notification)) {
                notification.remove();
            }
        }, 300);
    }, 6000);
}

function showSaveIndicator(indicatorId) {
    const indicator = document.getElementById(indicatorId);
    if (indicator) {
        indicator.classList.add('show');
        setTimeout(() => {
            indicator.classList.remove('show');
        }, 2000);
    }
}

function markUnsavedChanges() {
    hasUnsavedChanges = true;
    const unsavedIndicator = document.getElementById('unsavedIndicator');
    if (unsavedIndicator) {
        unsavedIndicator.classList.add('show');
    }
}

function clearUnsavedChanges() {
    hasUnsavedChanges = false;
    const unsavedIndicator = document.getElementById('unsavedIndicator');
    if (unsavedIndicator) {
        unsavedIndicator.classList.remove('show');
    }
}

async function testNotification() {
    try {
        const response = await fetch('/api/test-notification');
        const result = await response.json();
        
        if (result.success) {
            showNotification('Notification test sent! Check your system notifications.', 'success');
        } else {
            showNotification('Failed to send test notification: ' + (result.error || 'Unknown error'), 'error');
        }
    } catch (error) {
        showNotification('Error testing notification: ' + error.message, 'error');
    }
}

document.addEventListener('DOMContentLoaded', function() {
    loadSettings();
    loadConfig();
    loadTemplates();
    loadSyncConfig();
    loadSyncLog();
    
    document.getElementById('apiSettingsForm').addEventListener('submit', saveApiSettings);
    document.getElementById('notificationSettingsForm').addEventListener('submit', saveNotificationSettings);
    document.getElementById('testApiKeyBtn').addEventListener('click', testApiKey);
    document.getElementById('syncSettingsForm').addEventListener('submit', saveSyncSettings);
    document.getElementById('testFtpBtn').addEventListener('click', testFtpConnection);
    document.getElementById('refreshSyncLogBtn').addEventListener('click', loadSyncLog);
    
    // AI Provider selection handler
    document.getElementById('aiProvider').addEventListener('change', handleAiProviderChange);
    
    // Task configuration
    document.getElementById('addCategoryBtn').addEventListener('click', () => addItem('categories'));
    document.getElementById('addStatusBtn').addEventListener('click', () => addItem('statuses'));
    document.getElementById('addPriorityBtn').addEventListener('click', () => addItem('priorities'));
    document.getElementById('addTagBtn').addEventListener('click', () => addItem('tags'));
    
    // Deal configuration
    document.getElementById('addDealCustomerTypeBtn').addEventListener('click', () => addItem('dealCustomerTypes'));
    document.getElementById('addDealTypeBtn').addEventListener('click', () => addItem('dealTypes'));
    document.getElementById('addDealStatusBtn').addEventListener('click', () => addItem('dealStatuses'));
    document.getElementById('addCsmLocationBtn').addEventListener('click', () => addItem('csmLocations'));
    
    document.getElementById('addTemplateBtn').addEventListener('click', addTemplate);
    
    // Character settings
    initializeCharacterSettings();
    
    document.getElementById('saveAllBtn').addEventListener('click', saveAllConfig);
    document.getElementById('resetBtn').addEventListener('click', resetToDefaults);
    
    // Task configuration enter key handlers
    document.getElementById('newCategory').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addItem('categories');
    });
    document.getElementById('newStatus').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addItem('statuses');
    });
    document.getElementById('newPriority').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addItem('priorities');
    });
    document.getElementById('newTag').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addItem('tags');
    });
    
    // Deal configuration enter key handlers
    document.getElementById('newDealCustomerType').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addItem('dealCustomerTypes');
    });
    document.getElementById('newDealType').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addItem('dealTypes');
    });
    document.getElementById('newDealStatus').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addItem('dealStatuses');
    });
    document.getElementById('newCsmLocation').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addItem('csmLocations');
    });
    
    // Warn about unsaved changes
    window.addEventListener('beforeunload', (e) => {
        if (hasUnsavedChanges) {
            e.preventDefault();
            e.returnValue = '';
        }
    });
});

async function loadSettings() {
    try {
        const response = await fetch('/api/settings');
        currentSettings = await response.json();
        
        // Set AI provider
        const aiProvider = currentSettings.ai_provider || 'claude';
        document.getElementById('aiProvider').value = aiProvider;
        
        document.getElementById('apiKey').value = currentSettings.api_key || '';
        document.getElementById('notificationsEnabled').checked = currentSettings.notifications_enabled;
        document.getElementById('checkInterval').value = currentSettings.check_interval || 60;
        
        // Show/hide appropriate configuration section
        handleAiProviderChange();
        
        // Update AI status message
        updateAiStatusMessage();
        
    } catch (error) {
        console.error('Error loading settings:', error);
    }
}

function updateAiStatusMessage() {
    const statusMessage = document.getElementById('aiStatusMessage');
    const aiProvider = document.getElementById('aiProvider').value;
    
    if (aiProvider === 'claude') {
        if (currentSettings.api_key && currentSettings.api_key !== '') {
            statusMessage.style.display = 'block';
            statusMessage.style.background = '#d4edda';
            statusMessage.style.color = '#155724';
            statusMessage.innerHTML = '✅ <strong>Claude AI Enabled</strong> - Your API key is configured.';
        } else {
            statusMessage.style.display = 'block';
            statusMessage.style.background = '#fff3cd';
            statusMessage.style.color = '#856404';
            statusMessage.innerHTML = '⚠️ <strong>Claude AI Disabled</strong> - Add your API key to enable AI features.';
        }
    } else if (aiProvider === 'none') {
        statusMessage.style.display = 'block';
        statusMessage.style.background = '#d1ecf1';
        statusMessage.style.color = '#0c5460';
        statusMessage.innerHTML = '📊 <strong>Template Mode</strong> - Fast local processing without AI.';
    }
}

function handleAiProviderChange() {
    const provider = document.getElementById('aiProvider').value;
    const claudeConfig = document.getElementById('claudeConfig');
    const noneConfig = document.getElementById('noneConfig');
    
    // Hide all configs first
    claudeConfig.style.display = 'none';
    noneConfig.style.display = 'none';
    
    // Show the appropriate one
    if (provider === 'claude') {
        claudeConfig.style.display = 'block';
    } else if (provider === 'none') {
        noneConfig.style.display = 'block';
    }
    
    updateAiStatusMessage();
}

async function loadConfig() {
    try {
        const response = await fetch('/api/config');
        currentConfig = await response.json();
        
        // Display task configurations
        displayList('categories', currentConfig.categories);
        displayList('statuses', currentConfig.statuses);
        displayList('priorities', currentConfig.priorities);
        displayList('tags', currentConfig.tags);
        
        // Display deal configurations
        displayList('dealCustomerTypes', currentConfig.dealCustomerTypes || ['New Customer', 'Existing Customer']);
        displayList('dealTypes', currentConfig.dealTypes || ['BNCE', 'BNCF', 'Advisory', 'RTS']);
        displayList('dealStatuses', currentConfig.dealStatuses || ['Open', 'Won', 'Lost']);
        displayList('csmLocations', currentConfig.csmLocations || ['Onshore', 'Offshore']);
    } catch (error) {
        console.error('Error loading config:', error);
    }
}

function displayList(type, items) {
    const container = document.getElementById(`${type}List`);
    if (!container) return;
    
    container.innerHTML = items.map((item, index) => `
        <div class="list-item">
            <span>${escapeHtml(item)}</span>
            <button class="remove-btn" onclick="removeItem('${type}', ${index})">Remove</button>
        </div>
    `).join('');
}

function addItem(type) {
    const inputId = type === 'categories' ? 'newCategory' :
                   type === 'statuses' ? 'newStatus' :
                   type === 'priorities' ? 'newPriority' :
                   type === 'tags' ? 'newTag' :
                   type === 'dealCustomerTypes' ? 'newDealCustomerType' :
                   type === 'dealTypes' ? 'newDealType' :
                   type === 'dealStatuses' ? 'newDealStatus' :
                   type === 'csmLocations' ? 'newCsmLocation' : '';
    
    const input = document.getElementById(inputId);
    if (!input) return;
    
    const value = input.value.trim();
    
    if (!value) return;
    
    // Initialize array if it doesn't exist (for new deal configs)
    if (!currentConfig[type]) {
        currentConfig[type] = [];
    }
    
    if (!currentConfig[type].includes(value)) {
        currentConfig[type].push(value);
        displayList(type, currentConfig[type]);
        input.value = '';
        markUnsavedChanges();
    } else {
        alert('This item already exists');
    }
}

function removeItem(type, index) {
    if (!currentConfig[type]) return;
    
    currentConfig[type].splice(index, 1);
    displayList(type, currentConfig[type]);
    markUnsavedChanges();
}

async function testApiKey() {
    const aiProvider = document.getElementById('aiProvider').value;
    const apiKey = document.getElementById('apiKey').value;
    const button = document.getElementById('testApiKeyBtn');
    const statusDiv = document.getElementById('aiStatusMessage');
    
    if (aiProvider === 'claude' && (!apiKey || apiKey === '')) {
        alert('Please enter an API key first');
        return;
    }
    
    if (aiProvider === 'none') {
        // Local summary mode is always ready
        statusDiv.style.display = 'block';
        statusDiv.style.background = '#d4edda';
        statusDiv.style.color = '#155724';
        statusDiv.innerHTML = '✅ <strong>Local Summary Mode Ready!</strong> - Summaries will be generated locally without AI.';
        button.disabled = false;
        button.textContent = 'Test Configuration';
        
        setTimeout(() => {
            statusDiv.style.display = 'none';
        }, 3000);
        return;
    }
    
    // Show loading state
    button.disabled = true;
    button.textContent = 'Testing...';
    statusDiv.style.display = 'block';
    statusDiv.style.background = '#e3f2fd';
    statusDiv.style.color = '#1976d2';
    statusDiv.innerHTML = 'Testing API key...';
    
    try {
        const response = await fetch('/api/ai/test', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                api_key: apiKey,
                ai_provider: aiProvider
            })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            statusDiv.style.background = '#e8f5e9';
            statusDiv.style.color = '#2e7d32';
            statusDiv.innerHTML = '✅ API key is valid and working!';
            button.style.background = '#27ae60';
            button.textContent = '✓ Valid';
        } else {
            statusDiv.style.background = '#ffebee';
            statusDiv.style.color = '#c62828';
            statusDiv.innerHTML = `❌ ${data.error || 'API key test failed'}`;
            button.style.background = '#e74c3c';
            button.textContent = '✗ Invalid';
        }
        
        setTimeout(() => {
            button.style.background = '';
            button.textContent = 'Test Configuration';
        }, 3000);
        
    } catch (error) {
        statusDiv.style.background = '#ffebee';
        statusDiv.style.color = '#c62828';
        statusDiv.innerHTML = `❌ Error testing API key: ${error.message}`;
        button.textContent = 'Test Failed';
    } finally {
        button.disabled = false;
        
        // Hide status message after 5 seconds
        setTimeout(() => {
            statusDiv.style.display = 'none';
        }, 5000);
    }
}

async function saveApiSettings(e) {
    e.preventDefault();
    
    const aiProvider = document.getElementById('aiProvider').value;
    const apiKey = document.getElementById('apiKey').value;
    
    currentSettings.ai_provider = aiProvider;
    
    if (!apiKey.startsWith('***')) {
        currentSettings.api_key = apiKey;
    }
    
    try {
        const response = await fetch('/api/settings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                api_key: apiKey,
                ai_provider: aiProvider
            })
        });
        
        if (response.ok) {
            showSaveIndicator('aiSaveIndicator');
            if (aiProvider === 'none') {
                showNotification('Local Summary Mode enabled - summaries will be generated without external AI.', 'success');
            } else if (apiKey && apiKey !== '') {
                showNotification('Claude AI features are now enabled!', 'success');
            } else {
                showNotification('API key removed. AI features have been disabled.', 'info');
            }
            loadSettings();
        }
    } catch (error) {
        console.error('Error saving API settings:', error);
        showNotification('Error saving API settings', 'error');
    }
}

async function saveNotificationSettings(e) {
    e.preventDefault();
    
    const settings = {
        notifications_enabled: document.getElementById('notificationsEnabled').checked,
        check_interval: parseInt(document.getElementById('checkInterval').value)
    };
    
    try {
        const response = await fetch('/api/settings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(settings)
        });
        
        if (response.ok) {
            showSaveIndicator('notificationSaveIndicator');
            showNotification('Notification settings saved successfully', 'success');
        }
    } catch (error) {
        console.error('Error saving notification settings:', error);
        showNotification('Error saving notification settings', 'error');
    }
}

async function saveAllConfig() {
    try {
        const response = await fetch('/api/config', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(currentConfig)
        });
        
        if (response.ok) {
            clearUnsavedChanges();
            
            // Show save indicators for visible sections
            showSaveIndicator('taskConfigSaveIndicator');
            showSaveIndicator('dealConfigSaveIndicator');
            
            showNotification('All configurations saved successfully!', 'success');
            
            // Trigger a custom event so other pages know config has changed
            window.dispatchEvent(new Event('configUpdated'));
        }
    } catch (error) {
        console.error('Error saving config:', error);
        showNotification('Error saving configuration', 'error');
    }
}

function resetToDefaults() {
    if (!confirm('Are you sure you want to reset all configuration to defaults?')) return;
    
    currentConfig = {
        categories: ['Development', 'Support', 'Bug', 'Feature', 'Documentation'],
        statuses: ['Open', 'In Progress', 'Pending', 'Completed', 'Cancelled'],
        priorities: ['Low', 'Medium', 'High', 'Urgent'],
        tags: ['Frontend', 'Backend', 'Database', 'API', 'UI', 'Security'],
        dealCustomerTypes: ['New Customer', 'Existing Customer'],
        dealTypes: ['BNCE', 'BNCF', 'Advisory', 'RTS'],
        dealStatuses: ['Open', 'Won', 'Lost'],
        csmLocations: ['Onshore', 'Offshore']
    };
    
    // Display task configurations
    displayList('categories', currentConfig.categories);
    displayList('statuses', currentConfig.statuses);
    displayList('priorities', currentConfig.priorities);
    displayList('tags', currentConfig.tags);
    
    // Display deal configurations
    displayList('dealCustomerTypes', currentConfig.dealCustomerTypes);
    displayList('dealTypes', currentConfig.dealTypes);
    displayList('dealStatuses', currentConfig.dealStatuses);
    displayList('csmLocations', currentConfig.csmLocations);
    
    saveAllConfig();
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
}

// Template Management Functions
async function loadTemplates() {
    try {
        const response = await fetch('/api/templates');
        if (response.ok) {
            const data = await response.json();
            // Ensure currentTemplates is always an array
            currentTemplates = Array.isArray(data) ? data : [];
            displayTemplates();
        }
    } catch (error) {
        console.error('Error loading templates:', error);
        currentTemplates = []; // Initialize as empty array on error
    }
}

function displayTemplates() {
    const container = document.getElementById('templatesList');
    if (!container) return;
    
    if (currentTemplates.length === 0) {
        container.innerHTML = '<p>No templates defined yet.</p>';
        return;
    }
    
    container.innerHTML = currentTemplates.map((template, index) => `
        <div class="template-item">
            <div class="template-header">
                <strong>${escapeHtml(template.name)}</strong>
                <button class="remove-btn" onclick="removeTemplate(${index})">Remove</button>
            </div>
            <div class="template-details">
                <small>Title: ${escapeHtml(template.title_pattern)}</small>
                ${template.description ? `<br><small>Description: ${escapeHtml(template.description.substring(0, 100))}...</small>` : ''}
            </div>
        </div>
    `).join('');
}

async function addTemplate() {
    const name = document.getElementById('newTemplateName').value.trim();
    const titlePattern = document.getElementById('newTemplateTitle').value.trim();
    const description = document.getElementById('newTemplateDescription').value.trim();
    
    if (!name || !titlePattern) {
        alert('Template name and title pattern are required');
        return;
    }
    
    const template = {
        name: name,
        title_pattern: titlePattern,
        description: description,
        category: currentConfig.categories[0] || '',
        priority: currentConfig.priorities[1] || 'Medium',
        tags: []
    };
    
    try {
        const response = await fetch('/api/templates', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(template)
        });
        
        if (response.ok) {
            currentTemplates.push(template);
            displayTemplates();
            
            // Clear form
            document.getElementById('newTemplateName').value = '';
            document.getElementById('newTemplateTitle').value = '';
            document.getElementById('newTemplateDescription').value = '';
            
            showSaveIndicator('templateSaveIndicator');
            showNotification('Template added successfully', 'success');
        } else {
            showNotification('Failed to add template', 'error');
        }
    } catch (error) {
        console.error('Error adding template:', error);
        showNotification('Error adding template', 'error');
    }
}

async function removeTemplate(index) {
    if (!confirm('Are you sure you want to remove this template?')) return;
    
    const template = currentTemplates[index];
    
    try {
        const response = await fetch(`/api/templates/${encodeURIComponent(template.name)}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            currentTemplates.splice(index, 1);
            displayTemplates();
            showNotification('Template removed successfully', 'success');
        } else {
            showNotification('Failed to remove template', 'error');
        }
    } catch (error) {
        console.error('Error removing template:', error);
        showNotification('Error removing template', 'error');
    }
}

// ========= FTP SYNC CONFIGURATION =========

let syncConfig = null;

async function loadSyncConfig() {
    try {
        const response = await fetch('/api/sync/config');
        if (response.ok) {
            syncConfig = await response.json();
            displaySyncConfig();
        }
    } catch (error) {
        console.error('Error loading sync config:', error);
    }
}

function displaySyncConfig() {
    if (!syncConfig) return;
    
    document.getElementById('syncUserId').value = syncConfig.user_id || '';
    document.getElementById('syncTeamIds').value = (syncConfig.team_ids || []).join(', ');
    document.getElementById('ftpHost').value = syncConfig.ftp_config?.host || '';
    document.getElementById('ftpPort').value = syncConfig.ftp_config?.port || 21;
    document.getElementById('ftpUsername').value = syncConfig.ftp_config?.username || '';
    document.getElementById('ftpRemoteDir').value = syncConfig.ftp_config?.remote_dir || '/shared/taskmanager/deals/';
    document.getElementById('ftpUseTls').checked = syncConfig.ftp_config?.use_tls !== false;
    document.getElementById('syncConflictStrategy').value = syncConfig.sync_settings?.conflict_strategy || 'newest_wins';
    document.getElementById('syncKeepDays').value = syncConfig.sync_settings?.keep_days || 7;
    document.getElementById('syncAutoInterval').value = syncConfig.sync_settings?.auto_sync_interval || 300;
}

async function saveSyncSettings(event) {
    event.preventDefault();
    
    const config = {
        user_id: document.getElementById('syncUserId').value,
        team_ids: document.getElementById('syncTeamIds').value.split(',').map(id => id.trim()).filter(id => id),
        sync_enabled: true,
        sync_mode: 'ftp',
        ftp_config: {
            host: document.getElementById('ftpHost').value,
            port: parseInt(document.getElementById('ftpPort').value),
            username: document.getElementById('ftpUsername').value,
            password: document.getElementById('ftpPassword').value,
            remote_dir: document.getElementById('ftpRemoteDir').value,
            use_tls: document.getElementById('ftpUseTls').checked
        },
        sync_settings: {
            conflict_strategy: document.getElementById('syncConflictStrategy').value,
            keep_days: parseInt(document.getElementById('syncKeepDays').value),
            auto_sync_interval: parseInt(document.getElementById('syncAutoInterval').value),
            upload_on_change: true
        }
    };
    
    try {
        const response = await fetch('/api/sync/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config)
        });
        
        if (response.ok) {
            showNotification('Sync settings saved successfully!', 'success');
            showSaveIndicator('syncSaveIndicator');
        } else {
            const error = await response.json();
            showNotification('Failed to save sync settings: ' + error.error, 'error');
        }
    } catch (error) {
        console.error('Error saving sync settings:', error);
        showNotification('Failed to save sync settings', 'error');
    }
}

async function testFtpConnection() {
    // Save settings first
    await saveSyncSettings(new Event('submit'));
    
    try {
        const response = await fetch('/api/sync/upload', {
            method: 'POST'
        });
        
        if (response.ok) {
            showNotification('FTP connection successful! Test file uploaded.', 'success');
        } else {
            const error = await response.json();
            showNotification('FTP connection failed: ' + error.error, 'error');
        }
    } catch (error) {
        showNotification('FTP connection test failed', 'error');
    }
}

// ========= SYNC LOG VIEWER =========

async function loadSyncLog() {
    try {
        const response = await fetch('/api/sync/status');
        if (response.ok) {
            const status = await response.json();
            displaySyncLog(status);
        }
    } catch (error) {
        console.error('Error loading sync log:', error);
    }
}

function displaySyncLog(status) {
    const logContainer = document.getElementById('syncLogContainer');
    if (!logContainer) return;
    
    let html = '<div class="sync-log-header">';
    html += `<p><strong>User ID:</strong> ${status.user_id || 'Not configured'}</p>`;
    html += `<p><strong>Team Members:</strong> ${(status.team_members || []).join(', ') || 'None'}</p>`;
    html += `<p><strong>Last Sync:</strong> ${status.last_sync ? new Date(status.last_sync).toLocaleString() : 'Never'}</p>`;
    html += '</div>';
    
    if (status.sync_history && status.sync_history.length > 0) {
        html += '<div class="sync-log-entries">';
        html += '<h4>Recent Sync Activity</h4>';
        html += '<table class="sync-log-table">';
        html += '<thead><tr><th>Time</th><th>Action</th><th>User</th><th>Deals</th><th>File</th></tr></thead>';
        html += '<tbody>';
        
        status.sync_history.reverse().forEach(entry => {
            const time = new Date(entry.timestamp).toLocaleString();
            const actionClass = entry.action === 'upload' ? 'upload' : 'download';
            html += `<tr class="sync-${actionClass}">`;
            html += `<td>${time}</td>`;
            html += `<td><span class="sync-action-badge ${actionClass}">${entry.action}</span></td>`;
            html += `<td>${entry.user_id}</td>`;
            html += `<td>${entry.deal_count || 0}</td>`;
            html += `<td class="sync-filename">${entry.filename || '-'}</td>`;
            html += '</tr>';
        });
        
        html += '</tbody></table>';
        html += '</div>';
    } else {
        html += '<div class="sync-log-empty">No sync activity yet</div>';
    }
    
    logContainer.innerHTML = html;
}

// Character Settings Functions
function initializeCharacterSettings() {
    // Load saved preferences
    const prefs = JSON.parse(localStorage.getItem('characterPreferences') || '{}');
    
    // Set form values
    document.getElementById('characterEnabled').checked = prefs.enabled !== false;
    document.getElementById('characterSoundEnabled').checked = prefs.soundEnabled === true;
    
    // Set frequency
    if (prefs.frequency) {
        document.getElementById('characterFrequency').value = prefs.frequency;
    }
    
    // Add event listeners
    document.getElementById('characterSettingsForm').addEventListener('submit', saveCharacterSettings);
    document.getElementById('testCharacterBtn').addEventListener('click', testCharacter);
    document.getElementById('syncCommentsBtn').addEventListener('click', syncFunnyComments);
}

async function saveCharacterSettings(e) {
    e.preventDefault();
    
    const prefs = {
        enabled: document.getElementById('characterEnabled').checked,
        soundEnabled: document.getElementById('characterSoundEnabled').checked,
        frequency: document.getElementById('characterFrequency').value
    };
    
    // Save to localStorage
    localStorage.setItem('characterPreferences', JSON.stringify(prefs));
    
    // Apply settings immediately
    if (window.funnyCharacter) {
        if (prefs.enabled) {
            window.funnyCharacter.enable();
        } else {
            window.funnyCharacter.disable();
        }
    }
    
    showSaveIndicator('characterSaveIndicator');
    showNotification('Character settings saved!', 'success');
}

function testCharacter() {
    // Show the character immediately for testing
    if (window.funnyCharacter) {
        window.funnyCharacter.show(null, false);
    } else {
        showNotification('Character not loaded yet. Please refresh the page.', 'warning');
    }
}

async function syncFunnyComments() {
    try {
        const response = await fetch('/api/funny-comments/sync', {
            method: 'POST'
        });
        
        if (response.ok) {
            showNotification('Funny comments synced from FTP!', 'success');
            // Reload comments in character
            if (window.funnyCharacter) {
                window.funnyCharacter.reload();
            }
        } else if (response.status === 404) {
            showNotification('No funny comments file found on FTP', 'info');
        } else {
            showNotification('Failed to sync funny comments', 'error');
        }
    } catch (error) {
        console.error('Error syncing funny comments:', error);
        showNotification('Error syncing funny comments', 'error');
    }
}