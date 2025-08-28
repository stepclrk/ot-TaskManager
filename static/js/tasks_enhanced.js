// Enhanced Task Management - Main Integration

let quillEditor = null;
let commentQuillEditor = null;
let selectedDependencies = [];
let isLoadingEnhancedData = false;  // Flag to track if we're loading data

// Make flag globally accessible for enhanced_features.js
window.isLoadingEnhancedData = false;

document.addEventListener('DOMContentLoaded', function() {
    // Initialize enhanced features
    initializeEnhancedFeatures();
    
    // Setup mutation observer to watch for modal display changes
    setupModalObserver();
});

function setupModalObserver() {
    const modal = document.getElementById('taskModal');
    if (!modal) return;
    
    // Create observer to watch for style changes
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                // Check if modal is being shown
                if (modal.style.display === 'block') {
                    // Check if this is a new task (no taskId)
                    const taskId = document.getElementById('taskId')?.value;
                    const modalTitle = document.getElementById('modalTitle')?.textContent;
                    
                    console.log('Modal shown - taskId:', taskId, 'title:', modalTitle);
                    
                    if (!taskId || taskId === '' || modalTitle === 'Add Task') {
                        console.log('New task detected in modal observer - forcing clear');
                        // Force clear all enhanced data
                        forceCompleteDataClear();
                    }
                }
            }
        });
    });
    
    // Start observing
    observer.observe(modal, { 
        attributes: true, 
        attributeFilter: ['style']
    });
}

function forceCompleteDataClear() {
    console.log('Force clearing all enhanced data from modal observer');
    
    // Clear all containers immediately
    const containers = {
        'commentsContainer': '<p class="no-comments">No comments yet</p>',
        'historyTimeline': '<p class="no-history">No history available</p>',
        'attachmentsList': '<p class="no-attachments">No attachments</p>',
        'dependenciesList': '<p class="no-dependencies">No dependencies</p>',
        'blocksList': '<p class="no-blocks">No tasks blocked</p>'
    };
    
    for (const [id, emptyContent] of Object.entries(containers)) {
        const element = document.getElementById(id);
        if (element) {
            // Clear all event listeners by cloning
            const newElement = element.cloneNode(false);
            newElement.innerHTML = emptyContent;
            element.parentNode.replaceChild(newElement, element);
        }
    }
    
    // Clear badges
    document.getElementById('commentCount').textContent = '';
    document.getElementById('attachmentCount').textContent = '';
    
    // Clear editors
    if (window.commentQuillEditor) {
        window.commentQuillEditor.setText('');
    }
}

async function initializeEnhancedFeatures() {
    // Wrap load functions to prevent loading in new task mode
    wrapLoadFunctions();
    
    // Load templates
    const templates = await window.enhancedFeatures.loadTemplates();
    window.enhancedFeatures.populateTemplateSelector(templates);
    
    // Initialize Rich Text Editor
    initializeQuillEditor();
    
    // Setup tab switching
    setupTabSwitching();
    
    // Setup file upload
    setupFileUpload();
    
    // Setup event listeners for enhanced features
    setupEnhancedEventListeners();
    
    // Override the original showAddTaskModal to include template selector
    const originalShowAddTaskModal = window.showAddTaskModal;
    window.showAddTaskModal = async function() {
        console.log('Opening modal for new task - clearing all data');
        
        // CRITICAL: Stop any ongoing loading operations
        isLoadingEnhancedData = false;
        window.isLoadingEnhancedData = false;
        
        // IMMEDIATELY clear all DOM elements before anything else
        // This ensures no stale data is visible
        document.getElementById('commentsContainer').innerHTML = '<p class="no-comments">No comments yet</p>';
        document.getElementById('historyTimeline').innerHTML = '<p class="no-history">No history available</p>';
        document.getElementById('attachmentsList').innerHTML = '<p class="no-attachments">No attachments</p>';
        document.getElementById('dependenciesList').innerHTML = '<p class="no-dependencies">No dependencies</p>';
        document.getElementById('blocksList').innerHTML = '<p class="no-blocks">No tasks blocked</p>';
        document.getElementById('commentCount').textContent = '';
        document.getElementById('attachmentCount').textContent = '';
        
        // Clear the Quill editors
        if (quillEditor) {
            quillEditor.setText('');
            quillEditor.root.innerHTML = '';
        }
        if (commentQuillEditor) {
            commentQuillEditor.setText('');
            commentQuillEditor.root.innerHTML = '';
        }
        
        // Make absolutely sure task ID is empty BEFORE calling original
        document.getElementById('taskId').value = '';
        
        // Set currentTask to null to ensure it's treated as new
        window.currentTask = null;
        
        // Then call original function
        if (originalShowAddTaskModal) originalShowAddTaskModal();
        
        // Reset tabs to default (Details tab)
        resetTabs();
        
        // Show template selector for new tasks
        document.getElementById('templateSelector').style.display = 'block';
        
        // Reload templates when opening modal
        const templates = await window.enhancedFeatures.loadTemplates();
        window.enhancedFeatures.populateTemplateSelector(templates);
    };
    
    // Override the original editTask to load enhanced data
    const originalEditTask = window.editTask;
    window.editTask = function(taskId) {
        // CRITICAL: Stop any ongoing loading operations
        isLoadingEnhancedData = false;
        window.isLoadingEnhancedData = false;
        
        // FIRST: Clear all old data
        clearEnhancedData();
        
        // Then call original function
        if (originalEditTask) originalEditTask(taskId);
        
        // Hide template selector for existing tasks
        document.getElementById('templateSelector').style.display = 'none';
        
        // Now load the enhanced data for this specific task
        // Set flag to indicate we're loading
        isLoadingEnhancedData = true;
        window.isLoadingEnhancedData = true;
        loadEnhancedTaskData(taskId);
        
        // Reset tabs to default
        resetTabs();
    };
    
    // Override save task to include enhanced fields
    const originalSaveTask = window.saveTask;
    window.saveTask = async function(e) {
        e.preventDefault();
        
        // Get rich text content
        if (quillEditor) {
            document.getElementById('description').value = quillEditor.root.innerHTML;
        }
        
        // Call original save
        if (originalSaveTask) await originalSaveTask(e);
    };
    
    // Override closeModal to clear enhanced data
    const originalCloseModal = window.closeModal;
    window.closeModal = function() {
        console.log('Closing modal - clearing all enhanced data');
        
        // CRITICAL: Stop any ongoing loading operations
        isLoadingEnhancedData = false;
        window.isLoadingEnhancedData = false;
        
        // Clear enhanced data when closing modal
        clearEnhancedData();
        
        // Reset currentTask to null
        window.currentTask = null;
        
        // Clear task ID
        const taskIdField = document.getElementById('taskId');
        if (taskIdField) {
            taskIdField.value = '';
        }
        
        // Call original close
        if (originalCloseModal) originalCloseModal();
    };
}

function wrapLoadFunctions() {
    // Wrap each load function to prevent execution in new task mode
    const originalLoadComments = window.enhancedFeatures.loadComments;
    window.enhancedFeatures.loadComments = function(taskId) {
        const modalTitle = document.getElementById('modalTitle')?.textContent;
        const formTaskId = document.getElementById('taskId')?.value;
        
        if (modalTitle === 'Add Task' || !formTaskId) {
            console.log('Wrapped loadComments: Blocking load for new task');
            const container = document.getElementById('commentsContainer');
            if (container) {
                container.innerHTML = '<p class="no-comments">No comments yet</p>';
            }
            return;
        }
        return originalLoadComments.call(this, taskId);
    };
    
    const originalLoadHistory = window.enhancedFeatures.loadHistory;
    window.enhancedFeatures.loadHistory = function(taskId) {
        const modalTitle = document.getElementById('modalTitle')?.textContent;
        const formTaskId = document.getElementById('taskId')?.value;
        
        if (modalTitle === 'Add Task' || !formTaskId) {
            console.log('Wrapped loadHistory: Blocking load for new task');
            const container = document.getElementById('historyTimeline');
            if (container) {
                container.innerHTML = '<p class="no-history">No history available</p>';
            }
            return;
        }
        return originalLoadHistory.call(this, taskId);
    };
    
    const originalLoadAttachments = window.enhancedFeatures.loadAttachments;
    window.enhancedFeatures.loadAttachments = function(taskId) {
        const modalTitle = document.getElementById('modalTitle')?.textContent;
        const formTaskId = document.getElementById('taskId')?.value;
        
        if (modalTitle === 'Add Task' || !formTaskId) {
            console.log('Wrapped loadAttachments: Blocking load for new task');
            const container = document.getElementById('attachmentsList');
            if (container) {
                container.innerHTML = '<p class="no-attachments">No attachments</p>';
            }
            return;
        }
        return originalLoadAttachments.call(this, taskId);
    };
    
    const originalLoadDependencies = window.enhancedFeatures.loadDependencies;
    window.enhancedFeatures.loadDependencies = function(taskId) {
        const modalTitle = document.getElementById('modalTitle')?.textContent;
        const formTaskId = document.getElementById('taskId')?.value;
        
        if (modalTitle === 'Add Task' || !formTaskId) {
            console.log('Wrapped loadDependencies: Blocking load for new task');
            const depsContainer = document.getElementById('dependenciesList');
            const blocksContainer = document.getElementById('blocksList');
            if (depsContainer) {
                depsContainer.innerHTML = '<p class="no-dependencies">No dependencies</p>';
            }
            if (blocksContainer) {
                blocksContainer.innerHTML = '<p class="no-blocks">No tasks blocked</p>';
            }
            return;
        }
        return originalLoadDependencies.call(this, taskId);
    };
}

function initializeQuillEditor() {
    const container = document.getElementById('descriptionEditor');
    if (!container) return;
    
    quillEditor = new Quill('#descriptionEditor', {
        theme: 'snow',
        modules: {
            toolbar: [
                ['bold', 'italic', 'underline', 'strike'],
                ['blockquote', 'code-block'],
                [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                [{ 'header': [1, 2, 3, false] }],
                ['link'],
                ['clean']
            ]
        },
        placeholder: 'Enter task description...'
    });
    
    // Make quillEditor globally accessible for template application
    window.quillEditor = quillEditor;
    
    // Also store reference on the container for backup access
    container.__quill = quillEditor;
}

function setupTabSwitching() {
    document.querySelectorAll('.tab-btn').forEach(button => {
        button.addEventListener('click', function() {
            const tabName = this.dataset.tab;
            
            // Update active button
            document.querySelectorAll('.tab-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            this.classList.add('active');
            
            // Update active panel
            document.querySelectorAll('.tab-panel').forEach(panel => {
                panel.classList.remove('active');
            });
            document.getElementById(tabName + 'Tab').classList.add('active');
        });
    });
}

function resetTabs() {
    // Reset to first tab
    document.querySelectorAll('.tab-btn').forEach((btn, index) => {
        btn.classList.toggle('active', index === 0);
    });
    document.querySelectorAll('.tab-panel').forEach((panel, index) => {
        panel.classList.toggle('active', index === 0);
    });
}

function setupFileUpload() {
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('fileInput');
    
    if (!uploadArea || !fileInput) return;
    
    uploadArea.addEventListener('click', () => fileInput.click());
    
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });
    
    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('dragover');
    });
    
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        
        const files = e.dataTransfer.files;
        handleFileUpload(files);
    });
    
    fileInput.addEventListener('change', (e) => {
        handleFileUpload(e.target.files);
    });
}

async function handleFileUpload(files) {
    const taskId = document.getElementById('taskId').value;
    if (!taskId) {
        alert('Please save the task first before adding attachments');
        return;
    }
    
    for (const file of files) {
        await window.enhancedFeatures.uploadAttachment(taskId, file);
    }
}

function setupEnhancedEventListeners() {
    // Template application
    const applyBtn = document.getElementById('applyTemplateBtn');
    if (applyBtn) {
        applyBtn.addEventListener('click', window.enhancedFeatures.applyTemplate);
    }
    
    // Create from template button
    const templateBtn = document.getElementById('createFromTemplateBtn');
    if (templateBtn) {
        templateBtn.addEventListener('click', () => {
            showAddTaskModal();
            document.getElementById('templateSelector').style.display = 'block';
        });
    }
    
    // AI text enhancement - Disabled to avoid duplicate event listeners
    // The enhance button click handler is already set up in tasks.js
    // This prevents the enhancement type prompt from appearing twice
    
    // Similar tasks detection on title change
    const titleInput = document.getElementById('title');
    if (titleInput) {
        let debounceTimer;
        titleInput.addEventListener('input', () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                const title = titleInput.value;
                const description = quillEditor ? quillEditor.getText() : '';
                const customer = document.getElementById('customerName').value;
                
                if (title.length > 3) {
                    window.enhancedFeatures.checkSimilarTasks(title, description, customer);
                }
            }, 500);
        });
    }
    
    // Initialize comment Quill editor (use global variable)
    if (document.getElementById('commentEditor')) {
        commentQuillEditor = new Quill('#commentEditor', {
            theme: 'snow',
            modules: {
                toolbar: [
                    ['bold', 'italic', 'underline'],
                    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                    ['link', 'blockquote'],
                    ['clean']
                ]
            },
            placeholder: 'Add a comment...'
        });
    }
    
    // Add comment with rich text support
    const addCommentBtn = document.getElementById('addCommentBtn');
    if (addCommentBtn) {
        addCommentBtn.addEventListener('click', async () => {
            const taskId = document.getElementById('taskId').value;
            
            // Get HTML content from Quill editor
            let commentHtml = '';
            if (commentQuillEditor) {
                commentHtml = commentQuillEditor.root.innerHTML;
                // Also update hidden textarea
                document.getElementById('newComment').value = commentHtml;
            } else {
                // Fallback to plain textarea
                commentHtml = document.getElementById('newComment').value;
            }
            
            // Check if comment is not empty (strip HTML tags for check)
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = commentHtml;
            const textContent = tempDiv.textContent || tempDiv.innerText || '';
            
            if (taskId && textContent.trim()) {
                await window.enhancedFeatures.addComment(taskId, commentHtml);
                
                // Clear the editors
                if (commentQuillEditor) {
                    commentQuillEditor.setText('');
                }
                document.getElementById('newComment').value = '';
            }
        });
    }
    
    // Add dependency
    const addDepBtn = document.getElementById('addDependencyBtn');
    if (addDepBtn) {
        addDepBtn.addEventListener('click', showDependencyPicker);
    }
    
    // Dependency modal handlers
    const depModal = document.getElementById('dependencyModal');
    if (depModal) {
        document.getElementById('cancelDepBtn').addEventListener('click', () => {
            depModal.style.display = 'none';
        });
        
        document.getElementById('selectDepBtn').addEventListener('click', () => {
            addSelectedDependencies();
            depModal.style.display = 'none';
        });
    }
}

function clearEnhancedData() {
    console.log('Clearing all enhanced data...', new Date().toISOString());
    console.trace('Called from:');
    
    // Clear comment editor - be extra thorough
    if (commentQuillEditor) {
        try {
            commentQuillEditor.setText('');
            commentQuillEditor.root.innerHTML = '';
            // Delete all content
            commentQuillEditor.deleteText(0, commentQuillEditor.getLength());
        } catch (e) {
            console.log('Error clearing comment editor:', e);
        }
    }
    
    // Clear comments container - use cloneNode to remove all event listeners
    const commentsContainer = document.getElementById('commentsContainer');
    if (commentsContainer) {
        const newContainer = commentsContainer.cloneNode(false);
        newContainer.innerHTML = '<p class="no-comments">No comments yet</p>';
        commentsContainer.parentNode.replaceChild(newContainer, commentsContainer);
    }
    
    // Clear comment count badge
    const commentCount = document.getElementById('commentCount');
    if (commentCount) {
        commentCount.textContent = '';
        commentCount.innerHTML = '';
    }
    
    // Clear attachments - use cloneNode to remove all event listeners
    const attachmentsList = document.getElementById('attachmentsList');
    if (attachmentsList) {
        const newList = attachmentsList.cloneNode(false);
        newList.innerHTML = '<p class="no-attachments">No attachments</p>';
        attachmentsList.parentNode.replaceChild(newList, attachmentsList);
    }
    
    // Clear attachment count badge
    const attachmentCount = document.getElementById('attachmentCount');
    if (attachmentCount) {
        attachmentCount.textContent = '';
        attachmentCount.innerHTML = '';
    }
    
    // Clear history - use cloneNode to remove all event listeners
    const historyTimeline = document.getElementById('historyTimeline');
    if (historyTimeline) {
        const newTimeline = historyTimeline.cloneNode(false);
        newTimeline.innerHTML = '<p class="no-history">No history available</p>';
        historyTimeline.parentNode.replaceChild(newTimeline, historyTimeline);
    }
    
    // Clear dependencies - use cloneNode to remove all event listeners
    const dependenciesList = document.getElementById('dependenciesList');
    if (dependenciesList) {
        const newDeps = dependenciesList.cloneNode(false);
        newDeps.innerHTML = '<p class="no-dependencies">No dependencies</p>';
        dependenciesList.parentNode.replaceChild(newDeps, dependenciesList);
    }
    
    // Clear blocks list - use cloneNode to remove all event listeners
    const blocksList = document.getElementById('blocksList');
    if (blocksList) {
        const newBlocks = blocksList.cloneNode(false);
        newBlocks.innerHTML = '<p class="no-blocks">No tasks blocked</p>';
        blocksList.parentNode.replaceChild(newBlocks, blocksList);
    }
    
    // Reset selected dependencies
    selectedDependencies = [];
    
    // Clear any quill editor content for new comment
    const newCommentField = document.getElementById('newComment');
    if (newCommentField) {
        newCommentField.value = '';
        newCommentField.innerHTML = '';
    }
    
    // Clear the main comment editor element too
    const commentEditor = document.getElementById('commentEditor');
    if (commentEditor) {
        const quillContent = commentEditor.querySelector('.ql-editor');
        if (quillContent) {
            quillContent.innerHTML = '';
        }
    }
}

function loadEnhancedTaskData(taskId) {
    console.log('loadEnhancedTaskData called with taskId:', taskId, new Date().toISOString());
    console.trace('Called from:');
    
    // Don't load any data if no taskId or if it's a new task
    if (!taskId) {
        console.log('No taskId provided, not loading enhanced data');
        clearEnhancedData();
        isLoadingEnhancedData = false;
        window.isLoadingEnhancedData = false;
        return;
    }
    
    // CRITICAL: Verify this is actually the current task being edited
    // Check the modal title to see if we're in edit mode
    const modalTitle = document.getElementById('modalTitle')?.textContent;
    if (modalTitle !== 'Edit Task') {
        console.log('Not in edit mode, not loading enhanced data');
        clearEnhancedData();
        return;
    }
    
    // Check if we should still be loading (may have been cancelled)
    if (!isLoadingEnhancedData) {
        console.log('Loading was cancelled, not loading enhanced data');
        return;
    }
    
    const task = allTasks.find(t => t.id === taskId);
    if (!task) {
        console.log('Task not found, clearing enhanced data');
        clearEnhancedData();
        isLoadingEnhancedData = false;
        window.isLoadingEnhancedData = false;
        return;
    }
    
    // Double check we're still supposed to be loading this task
    if (!isLoadingEnhancedData || document.getElementById('taskId').value !== taskId) {
        console.log('Task changed or loading cancelled, aborting load');
        clearEnhancedData();
        return;
    }
    
    // Load rich text description
    if (quillEditor && task.description) {
        if (task.description.includes('<')) {
            quillEditor.root.innerHTML = task.description;
        } else {
            quillEditor.setText(task.description);
        }
    }
    
    // Load comments - only if we're still loading
    if (isLoadingEnhancedData) {
        window.enhancedFeatures.loadComments(taskId);
        const commentCount = (task.comments || []).length;
        document.getElementById('commentCount').textContent = commentCount > 0 ? commentCount : '';
    }
    
    // Load attachments - only if we're still loading
    if (isLoadingEnhancedData) {
        window.enhancedFeatures.loadAttachments(taskId);
        const attachmentCount = (task.attachments || []).length;
        document.getElementById('attachmentCount').textContent = attachmentCount > 0 ? attachmentCount : '';
    }
    
    // Load history - only if we're still loading
    if (isLoadingEnhancedData) {
        window.enhancedFeatures.loadHistory(taskId);
    }
    
    // Load dependencies - only if we're still loading
    if (isLoadingEnhancedData) {
        window.enhancedFeatures.loadDependencies(taskId);
    }
    
    // Done loading
    isLoadingEnhancedData = false;
    window.isLoadingEnhancedData = false;
}

function showDependencyPicker() {
    const modal = document.getElementById('dependencyModal');
    const list = document.getElementById('depTaskList');
    const currentTaskId = document.getElementById('taskId').value;
    
    // Get current task's dependencies
    const currentTask = currentTaskId ? allTasks.find(t => t.id === currentTaskId) : null;
    const currentDependencies = currentTask?.dependencies || [];
    
    // Populate with available tasks
    const availableTasks = allTasks.filter(t => 
        t.id !== currentTaskId && 
        t.status !== 'Completed'
    );
    
    list.innerHTML = availableTasks.map(task => {
        const isSelected = currentDependencies.includes(task.id);
        return `
            <div class="dep-task-item ${isSelected ? 'selected' : ''}" data-task-id="${task.id}">
                <strong>${escapeHtml(task.title)}</strong>
                <small>${escapeHtml(task.customer_name || 'N/A')}</small>
            </div>
        `;
    }).join('');
    
    // Add click handlers
    list.querySelectorAll('.dep-task-item').forEach(item => {
        item.addEventListener('click', function() {
            this.classList.toggle('selected');
        });
    });
    
    modal.style.display = 'block';
}

function addSelectedDependencies() {
    const selected = document.querySelectorAll('.dep-task-item.selected');
    const taskId = document.getElementById('taskId').value;
    
    // Clear and rebuild the dependencies list based on current selection
    selectedDependencies = [];
    selected.forEach(item => {
        const depId = item.dataset.taskId;
        selectedDependencies.push(depId);
    });
    
    // Update the task with new dependencies and save to server
    if (taskId) {
        const task = allTasks.find(t => t.id === taskId);
        if (task) {
            task.dependencies = selectedDependencies;
            
            // Save dependencies to server
            fetch(`/api/tasks/${taskId}/dependencies`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    dependencies: selectedDependencies
                })
            }).then(response => {
                if (!response.ok) {
                    console.error('Failed to save dependencies');
                }
            }).catch(error => {
                console.error('Error saving dependencies:', error);
            });
        }
    }
    
    // Refresh dependencies display
    window.enhancedFeatures.loadDependencies(taskId);
}