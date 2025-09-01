// Member Details Page JavaScript

let memberData = null;
let allTasks = [];
let assignedTasks = [];
let relatedTasks = [];

document.addEventListener('DOMContentLoaded', function() {
    // Load member data
    loadMemberData();
    
    // Setup event listeners
    setupEventListeners();
});

function setupEventListeners() {
    // Single filter for all tasks
    const filterSelect = document.getElementById('tasksFilter');
    if (filterSelect) {
        filterSelect.addEventListener('change', function() {
            displayAllTasks(this.value);
        });
    }
}

async function loadMemberData() {
    try {
        // Get member ID from the page (set by the template)
        if (!memberId) {
            console.error('No member ID provided');
            return;
        }
        
        // Load member details
        const memberResponse = await fetch(`/api/members/${memberId}`);
        if (!memberResponse.ok) {
            throw new Error('Failed to load member data');
        }
        memberData = await memberResponse.json();
        
        // Display member info
        displayMemberInfo();
        
        // Load all tasks
        const tasksResponse = await fetch('/api/tasks');
        if (!tasksResponse.ok) {
            throw new Error('Failed to load tasks');
        }
        allTasks = await tasksResponse.json();
        
        console.log('Loaded tasks:', allTasks.length);
        console.log('Member name:', memberData.name);
        
        // Filter tasks for this member
        filterMemberTasks();
        
        // Display all tasks in unified view
        setTimeout(() => {
            displayAllTasks('all');
        }, 100);
        
        // Update statistics
        updateStatistics();
        
    } catch (error) {
        console.error('Error loading member data:', error);
        showError('Failed to load member details');
    }
}

function displayMemberInfo() {
    // Set avatar
    const avatar = document.getElementById('memberAvatar');
    avatar.style.background = memberData.avatar_color || generateColor(memberData.name);
    avatar.textContent = getInitials(memberData.name);
    
    // Set member details
    document.getElementById('memberName').textContent = memberData.name;
    document.getElementById('memberRole').innerHTML = `<i class="fas fa-briefcase"></i> ${memberData.role || 'Team Member'}`;
    document.getElementById('memberEmail').innerHTML = `<i class="fas fa-envelope"></i> ${memberData.email}`;
    document.getElementById('memberDepartment').innerHTML = `<i class="fas fa-building"></i> ${memberData.department || 'No Department'}`;
}

function filterMemberTasks() {
    // Filter assigned tasks
    assignedTasks = allTasks.filter(task => {
        const taskAssignedTo = (task.assigned_to || '').toLowerCase().trim();
        const memberName = (memberData.name || '').toLowerCase().trim();
        const memberEmail = (memberData.email || '').toLowerCase().trim();
        
        return taskAssignedTo === memberName || 
               taskAssignedTo === memberEmail ||
               task.assigned_to_id === memberData.id;
    });
    
    // Filter related tasks (excluding those already in assigned)
    relatedTasks = allTasks.filter(task => {
        const taskRelatedTo = (task.related_to || '').toLowerCase().trim();
        const memberName = (memberData.name || '').toLowerCase().trim();
        const memberEmail = (memberData.email || '').toLowerCase().trim();
        
        const isRelated = taskRelatedTo === memberName || 
                         taskRelatedTo === memberEmail;
        
        // Don't include if already in assigned tasks
        const isAssigned = assignedTasks.some(t => t.id === task.id);
        
        return isRelated && !isAssigned;
    });
    
    console.log('Assigned tasks found:', assignedTasks.length);
    console.log('Related tasks found:', relatedTasks.length);
    
    // Update counts
    document.getElementById('assignedCount').textContent = assignedTasks.length;
    document.getElementById('relatedCount').textContent = relatedTasks.length;
}

function displayAllTasks(filter = 'all') {
    console.log('displayAllTasks called with filter:', filter);
    
    // Combine both assigned and related tasks
    const allMemberTasks = [
        ...assignedTasks.map(t => ({...t, relationship: 'assigned'})),
        ...relatedTasks.map(t => ({...t, relationship: 'related'}))
    ];
    
    console.log('Total member tasks:', allMemberTasks.length);
    
    let filteredTasks = [...allMemberTasks];
    
    // Apply filter
    switch(filter) {
        case 'assigned':
            filteredTasks = filteredTasks.filter(t => t.relationship === 'assigned');
            break;
        case 'related':
            filteredTasks = filteredTasks.filter(t => t.relationship === 'related');
            break;
        case 'active':
            filteredTasks = filteredTasks.filter(t => 
                t.status !== 'Completed' && t.status !== 'Cancelled' && t.status !== 'Closed'
            );
            break;
        case 'completed':
            filteredTasks = filteredTasks.filter(t => t.status === 'Completed');
            break;
        case 'overdue':
            filteredTasks = filteredTasks.filter(t => 
                t.follow_up_date && 
                new Date(t.follow_up_date) < new Date() && 
                t.status !== 'Completed'
            );
            break;
    }
    
    console.log('Filtered tasks:', filteredTasks.length);
    
    const list = document.getElementById('allTasksList');
    if (!list) {
        console.error('allTasksList element not found!');
        return;
    }
    
    if (filteredTasks.length === 0) {
        list.innerHTML = `
            <div class="empty-message">
                <i class="fas fa-tasks"></i>
                <p>No tasks found</p>
            </div>
        `;
        return;
    }
    
    // Generate HTML with clear distinction between assigned and related
    list.innerHTML = filteredTasks.map(task => {
        const isOverdue = task.follow_up_date && 
            new Date(task.follow_up_date) < new Date() && 
            task.status !== 'Completed';
        
        const statusClass = isOverdue ? 'overdue' : 
            task.status === 'Completed' ? 'completed' : 
            task.status === 'In Progress' ? 'in-progress' : 'pending';
        
        const relationshipClass = task.relationship === 'assigned' ? 'assigned-task' : 'related-task';
        const relationshipBadge = task.relationship === 'assigned' ? 
            '<span class="task-relationship assigned"><i class="fas fa-user-check"></i> Assigned</span>' :
            '<span class="task-relationship related"><i class="fas fa-link"></i> Related</span>';
        
        return `
            <div class="task-item ${relationshipClass}" onclick="viewTask('${task.id}')">
                <div class="task-info">
                    <div class="task-title">
                        ${relationshipBadge}
                        ${escapeHtml(task.title)}
                    </div>
                    <div class="task-meta">
                        <span class="task-status ${statusClass}">${task.status}</span>
                        <span><i class="fas fa-calendar"></i> ${formatDate(task.follow_up_date)}</span>
                        <span><i class="fas fa-flag"></i> ${task.priority}</span>
                        ${task.customer_name ? `<span><i class="fas fa-user"></i> ${escapeHtml(task.customer_name)}</span>` : ''}
                    </div>
                </div>
                <div class="task-actions">
                    <button class="view-btn" onclick="event.stopPropagation(); viewTask('${task.id}')">
                        <i class="fas fa-eye"></i> View
                    </button>
                </div>
            </div>
        `;
    }).join('');
    
    console.log('Tasks displayed successfully');
}

// Keep old function for compatibility but redirect to new one
function displayAssignedTasks(filter = 'all') {
    // This function is no longer used but kept for compatibility
    displayAllTasks(filter);
}

// Keep old function for compatibility but redirect to new one  
function displayRelatedTasks(filter = 'all') {
    // This function is no longer used but kept for compatibility
    displayAllTasks(filter);
}


function updateStatistics() {
    const totalTasks = assignedTasks.length;
    const completedTasks = assignedTasks.filter(t => t.status === 'Completed').length;
    const overdueTasks = assignedTasks.filter(t => 
        t.follow_up_date && 
        new Date(t.follow_up_date) < new Date() && 
        t.status !== 'Completed'
    ).length;
    
    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    
    document.getElementById('totalTasksStat').textContent = totalTasks;
    document.getElementById('completedTasksStat').textContent = completedTasks;
    document.getElementById('overdueTasksStat').textContent = overdueTasks;
    document.getElementById('completionRateStat').textContent = completionRate + '%';
}


function viewTask(taskId) {
    // Store task ID to open
    sessionStorage.setItem('openTaskId', taskId);
    // Redirect to tasks page
    window.location.href = '/tasks';
}

function createTaskForMember() {
    // Open modal and pre-fill assigned member
    openTaskModal();
}

function editMember() {
    // Redirect to teams page with edit flag
    sessionStorage.setItem('editMemberId', memberData.id);
    window.location.href = '/teams';
}

function formatDate(dateStr) {
    if (!dateStr) return 'No date';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getInitials(name) {
    if (!name) return '?';
    const parts = name.split(' ');
    if (parts.length > 1) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
}

function generateColor(name) {
    const colors = [
        '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
        '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2',
        '#F8B739', '#52B788', '#E76F51', '#A8DADC', '#F1FAEE'
    ];
    
    if (!name) return colors[0];
    
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    return colors[Math.abs(hash) % colors.length];
}

function escapeHtml(text) {
    if (!text) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.toString().replace(/[&<>"']/g, m => map[m]);
}

function showError(message) {
    // You can implement a toast notification here
    console.error(message);
    alert(message);
}

function showSuccess(message) {
    // You can implement a toast notification here
    console.log(message);
    alert(message);
}

// Modal Functions
function openTaskModal() {
    const modal = document.getElementById('taskModal');
    if (!modal) {
        console.error('Task modal not found');
        return;
    }
    
    // Reset form
    document.getElementById('taskForm').reset();
    
    // Pre-fill assigned member
    document.getElementById('taskAssignedTo').value = memberData.name;
    
    // Load categories
    loadCategories();
    
    // Show modal
    modal.style.display = 'block';
    
    // Focus on title field
    setTimeout(() => {
        document.getElementById('taskTitle').focus();
    }, 100);
}

function closeTaskModal() {
    const modal = document.getElementById('taskModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

async function loadCategories() {
    try {
        const response = await fetch('/api/config');
        if (!response.ok) throw new Error('Failed to load config');
        
        const config = await response.json();
        const categorySelect = document.getElementById('taskCategory');
        
        // Clear existing options
        categorySelect.innerHTML = '<option value="">Select Category</option>';
        
        // Add categories
        if (config.categories && Array.isArray(config.categories)) {
            config.categories.forEach(category => {
                const option = document.createElement('option');
                option.value = category;
                option.textContent = category;
                categorySelect.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading categories:', error);
    }
}

async function saveTask() {
    const form = document.getElementById('taskForm');
    
    // Validate required fields
    const title = document.getElementById('taskTitle').value.trim();
    if (!title) {
        showError('Task title is required');
        return;
    }
    
    // Gather form data
    const taskData = {
        title: title,
        description: document.getElementById('taskDescription').value.trim(),
        assigned_to: document.getElementById('taskAssignedTo').value.trim(),
        related_to: document.getElementById('taskRelatedTo').value.trim(),
        priority: document.getElementById('taskPriority').value,
        status: document.getElementById('taskStatus').value,
        follow_up_date: document.getElementById('taskFollowUpDate').value || null,
        due_date: document.getElementById('taskDueDate').value || null,
        category: document.getElementById('taskCategory').value || null,
        customer_name: document.getElementById('taskCustomerName').value.trim() || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    };
    
    try {
        // Send to server
        const response = await fetch('/api/tasks', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(taskData)
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to create task');
        }
        
        const newTask = await response.json();
        console.log('Task created successfully:', newTask);
        
        // Close modal
        closeTaskModal();
        
        // Show success message
        showSuccess('Task created successfully!');
        
        // Reload tasks to show the new one
        await reloadTasks();
        
    } catch (error) {
        console.error('Error creating task:', error);
        showError('Failed to create task: ' + error.message);
    }
}

async function reloadTasks() {
    try {
        // Reload all tasks
        const tasksResponse = await fetch('/api/tasks');
        if (!tasksResponse.ok) {
            throw new Error('Failed to reload tasks');
        }
        allTasks = await tasksResponse.json();
        
        // Re-filter for this member
        filterMemberTasks();
        
        // Re-display with current filter
        const currentFilter = document.getElementById('tasksFilter')?.value || 'all';
        displayAllTasks(currentFilter);
        
        // Update statistics
        updateStatistics();
        
    } catch (error) {
        console.error('Error reloading tasks:', error);
    }
}

// Close modal when clicking outside of it
window.onclick = function(event) {
    const modal = document.getElementById('taskModal');
    if (event.target === modal) {
        closeTaskModal();
    }
}

// Handle Enter key in form
document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('taskForm');
    if (form) {
        form.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
                e.preventDefault();
                saveTask();
            }
        });
    }
});