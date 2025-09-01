/**
 * Project Task Management
 * Enhanced task creation and management within project context
 */

class ProjectTaskManager {
    constructor() {
        this.currentProjectId = null;
        this.currentTaskId = null;
        this.allTasks = [];
        this.projectTasks = [];
        this.taskEditor = null;
    }
    
    /**
     * Initialize task modal for project context
     */
    initializeProjectTaskModal(projectId) {
        this.currentProjectId = projectId;
        this.loadProjectTasks();
        
        // Create or update modal with project-specific fields
        const existingModal = document.getElementById('projectTaskModal');
        if (existingModal) {
            existingModal.remove();
        }
        
        this.createProjectTaskModal();
    }
    
    createProjectTaskModal() {
        const modalHtml = `
            <div id="projectTaskModal" class="modal">
                <div class="modal-content large-modal">
                    <div class="modal-header">
                        <h2 id="taskModalTitle">Create Project Task</h2>
                        <span class="close" onclick="projectTaskManager.closeTaskModal()">&times;</span>
                    </div>
                    
                    <div class="modal-tabs">
                        <button class="tab-btn active" data-tab="basic">Basic Info</button>
                        <button class="tab-btn" data-tab="schedule">Schedule & Duration</button>
                        <button class="tab-btn" data-tab="dependencies">Dependencies</button>
                        <button class="tab-btn" data-tab="resources">Resources</button>
                        <button class="tab-btn" data-tab="advanced">Advanced</button>
                    </div>
                    
                    <div class="modal-body">
                        <!-- Basic Info Tab -->
                        <div class="tab-content active" id="basic-tab">
                            <form id="taskBasicForm">
                                <div class="form-group">
                                    <label>Task Title *</label>
                                    <input type="text" id="taskTitle" class="form-control" required>
                                </div>
                                
                                <div class="form-group">
                                    <label>Description</label>
                                    <div id="taskDescription"></div>
                                </div>
                                
                                <div class="form-row">
                                    <div class="form-group">
                                        <label>Category</label>
                                        <select id="taskCategory" class="form-control">
                                            <option value="Development">Development</option>
                                            <option value="Design">Design</option>
                                            <option value="Testing">Testing</option>
                                            <option value="Documentation">Documentation</option>
                                            <option value="Review">Review</option>
                                        </select>
                                    </div>
                                    <div class="form-group">
                                        <label>Priority</label>
                                        <select id="taskPriority" class="form-control">
                                            <option value="Low">Low</option>
                                            <option value="Medium" selected>Medium</option>
                                            <option value="High">High</option>
                                            <option value="Critical">Critical</option>
                                        </select>
                                    </div>
                                </div>
                                
                                <div class="form-row">
                                    <div class="form-group">
                                        <label>Status</label>
                                        <select id="taskStatus" class="form-control">
                                            <option value="Not Started">Not Started</option>
                                            <option value="In Progress">In Progress</option>
                                            <option value="Completed">Completed</option>
                                            <option value="On Hold">On Hold</option>
                                        </select>
                                    </div>
                                    <div class="form-group">
                                        <label>Phase</label>
                                        <select id="taskPhase" class="form-control">
                                            <option value="">No Phase</option>
                                        </select>
                                    </div>
                                </div>
                                
                                <div class="form-group">
                                    <label>Milestone</label>
                                    <select id="taskMilestone" class="form-control">
                                        <option value="">No Milestone</option>
                                    </select>
                                </div>
                            </form>
                        </div>
                        
                        <!-- Schedule & Duration Tab -->
                        <div class="tab-content" id="schedule-tab">
                            <form id="taskScheduleForm">
                                <div class="form-row">
                                    <div class="form-group">
                                        <label>Start Date *</label>
                                        <input type="date" id="taskStartDate" class="form-control" required>
                                    </div>
                                    <div class="form-group">
                                        <label>End Date *</label>
                                        <input type="date" id="taskEndDate" class="form-control" required>
                                    </div>
                                </div>
                                
                                <div class="form-row">
                                    <div class="form-group">
                                        <label>Duration (days)</label>
                                        <input type="number" id="taskDuration" class="form-control" min="1" value="1">
                                    </div>
                                    <div class="form-group">
                                        <label>Effort (hours)</label>
                                        <input type="number" id="taskEffort" class="form-control" min="0" step="0.5">
                                    </div>
                                </div>
                                
                                <div class="form-group">
                                    <label>Progress (%)</label>
                                    <div class="progress-input-group">
                                        <input type="range" id="taskProgress" class="form-control-range" min="0" max="100" value="0">
                                        <span id="progressValue">0%</span>
                                    </div>
                                </div>
                                
                                <div class="form-group">
                                    <label>Schedule Mode</label>
                                    <select id="scheduleMode" class="form-control">
                                        <option value="auto">Auto Schedule</option>
                                        <option value="manual">Manual Schedule</option>
                                        <option value="fixed">Fixed Dates</option>
                                    </select>
                                </div>
                                
                                <div class="form-check">
                                    <input type="checkbox" id="isMilestoneTask" class="form-check-input">
                                    <label for="isMilestoneTask">This is a milestone task (zero duration)</label>
                                </div>
                            </form>
                        </div>
                        
                        <!-- Dependencies Tab -->
                        <div class="tab-content" id="dependencies-tab">
                            <div class="dependencies-container">
                                <div class="dependency-section">
                                    <h3>Predecessors (This task depends on)</h3>
                                    <div class="dependency-controls">
                                        <select id="predecessorSelect" class="form-control">
                                            <option value="">Select a task...</option>
                                        </select>
                                        <select id="predecessorType" class="form-control">
                                            <option value="FS">Finish-to-Start (FS)</option>
                                            <option value="SS">Start-to-Start (SS)</option>
                                            <option value="FF">Finish-to-Finish (FF)</option>
                                            <option value="SF">Start-to-Finish (SF)</option>
                                        </select>
                                        <input type="number" id="predecessorLag" class="form-control" placeholder="Lag (days)" min="0" value="0">
                                        <button class="btn btn-primary" onclick="projectTaskManager.addPredecessor()">Add</button>
                                    </div>
                                    <div id="predecessorList" class="dependency-list"></div>
                                </div>
                                
                                <div class="dependency-section">
                                    <h3>Successors (Tasks that depend on this)</h3>
                                    <div class="dependency-controls">
                                        <select id="successorSelect" class="form-control">
                                            <option value="">Select a task...</option>
                                        </select>
                                        <button class="btn btn-primary" onclick="projectTaskManager.addSuccessor()">Add</button>
                                    </div>
                                    <div id="successorList" class="dependency-list"></div>
                                </div>
                                
                                <div class="dependency-info">
                                    <h4>Dependency Types:</h4>
                                    <ul>
                                        <li><strong>FS (Finish-to-Start):</strong> Predecessor must finish before successor can start</li>
                                        <li><strong>SS (Start-to-Start):</strong> Predecessor must start before successor can start</li>
                                        <li><strong>FF (Finish-to-Finish):</strong> Predecessor must finish before successor can finish</li>
                                        <li><strong>SF (Start-to-Finish):</strong> Predecessor must start before successor can finish</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Resources Tab -->
                        <div class="tab-content" id="resources-tab">
                            <form id="taskResourceForm">
                                <div class="form-group">
                                    <label>Assigned To</label>
                                    <select id="taskAssignee" class="form-control">
                                        <option value="">Unassigned</option>
                                    </select>
                                </div>
                                
                                <div class="form-group">
                                    <label>Additional Resources</label>
                                    <div id="resourceAssignments">
                                        <div class="resource-assignment">
                                            <select class="form-control resource-select">
                                                <option value="">Select resource...</option>
                                            </select>
                                            <input type="number" class="form-control allocation-input" placeholder="Allocation %" min="0" max="100" value="100">
                                            <button class="btn btn-danger btn-sm" onclick="this.parentElement.remove()">Remove</button>
                                        </div>
                                    </div>
                                    <button type="button" class="btn btn-secondary" onclick="projectTaskManager.addResourceAssignment()">
                                        Add Resource
                                    </button>
                                </div>
                                
                                <div class="form-group">
                                    <label>Work Type</label>
                                    <select id="workType" class="form-control">
                                        <option value="fixed-work">Fixed Work</option>
                                        <option value="fixed-duration">Fixed Duration</option>
                                        <option value="fixed-units">Fixed Units</option>
                                    </select>
                                </div>
                                
                                <div class="form-group">
                                    <label>Estimated Cost</label>
                                    <input type="number" id="taskCost" class="form-control" min="0" step="0.01">
                                </div>
                            </form>
                        </div>
                        
                        <!-- Advanced Tab -->
                        <div class="tab-content" id="advanced-tab">
                            <form id="taskAdvancedForm">
                                <div class="form-group">
                                    <label>Constraint Type</label>
                                    <select id="constraintType" class="form-control">
                                        <option value="ASAP">As Soon As Possible</option>
                                        <option value="ALAP">As Late As Possible</option>
                                        <option value="MSO">Must Start On</option>
                                        <option value="MFO">Must Finish On</option>
                                        <option value="SNET">Start No Earlier Than</option>
                                        <option value="SNLT">Start No Later Than</option>
                                        <option value="FNET">Finish No Earlier Than</option>
                                        <option value="FNLT">Finish No Later Than</option>
                                    </select>
                                </div>
                                
                                <div class="form-group">
                                    <label>Constraint Date</label>
                                    <input type="date" id="constraintDate" class="form-control">
                                </div>
                                
                                <div class="form-check">
                                    <input type="checkbox" id="isCritical" class="form-check-input">
                                    <label for="isCritical">Mark as Critical Task</label>
                                </div>
                                
                                <div class="form-check">
                                    <input type="checkbox" id="isRecurring" class="form-check-input">
                                    <label for="isRecurring">Recurring Task</label>
                                </div>
                                
                                <div id="recurringOptions" style="display: none;">
                                    <div class="form-group">
                                        <label>Recurrence Pattern</label>
                                        <select id="recurrencePattern" class="form-control">
                                            <option value="daily">Daily</option>
                                            <option value="weekly">Weekly</option>
                                            <option value="monthly">Monthly</option>
                                        </select>
                                    </div>
                                    <div class="form-group">
                                        <label>Recurrence Interval</label>
                                        <input type="number" id="recurrenceInterval" class="form-control" min="1" value="1">
                                    </div>
                                </div>
                                
                                <div class="form-group">
                                    <label>Tags</label>
                                    <input type="text" id="taskTags" class="form-control" placeholder="Enter tags separated by commas">
                                </div>
                                
                                <div class="form-group">
                                    <label>Notes</label>
                                    <textarea id="taskNotes" class="form-control" rows="3"></textarea>
                                </div>
                            </form>
                        </div>
                    </div>
                    
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="projectTaskManager.closeTaskModal()">Cancel</button>
                        <button class="btn btn-primary" onclick="projectTaskManager.saveProjectTask()">Save Task</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        // Initialize Quill editor
        this.taskEditor = new Quill('#taskDescription', {
            theme: 'snow',
            modules: {
                toolbar: [
                    ['bold', 'italic', 'underline'],
                    ['link', 'blockquote', 'code-block'],
                    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                    ['clean']
                ]
            }
        });
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Load project data
        this.loadProjectData();
    }
    
    setupEventListeners() {
        // Tab switching
        document.querySelectorAll('#projectTaskModal .tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchTaskTab(e.target.dataset.tab);
            });
        });
        
        // Duration calculation
        const startDate = document.getElementById('taskStartDate');
        const endDate = document.getElementById('taskEndDate');
        const duration = document.getElementById('taskDuration');
        
        if (startDate && endDate) {
            startDate.addEventListener('change', () => this.calculateDuration());
            endDate.addEventListener('change', () => this.calculateDuration());
            duration.addEventListener('change', () => this.calculateEndDate());
        }
        
        // Progress slider
        const progressSlider = document.getElementById('taskProgress');
        if (progressSlider) {
            progressSlider.addEventListener('input', (e) => {
                document.getElementById('progressValue').textContent = e.target.value + '%';
            });
        }
        
        // Milestone checkbox
        const milestoneCheck = document.getElementById('isMilestoneTask');
        if (milestoneCheck) {
            milestoneCheck.addEventListener('change', (e) => {
                if (e.target.checked) {
                    duration.value = 0;
                    duration.disabled = true;
                } else {
                    duration.disabled = false;
                    this.calculateDuration();
                }
            });
        }
        
        // Recurring task
        const recurringCheck = document.getElementById('isRecurring');
        if (recurringCheck) {
            recurringCheck.addEventListener('change', (e) => {
                document.getElementById('recurringOptions').style.display = 
                    e.target.checked ? 'block' : 'none';
            });
        }
    }
    
    switchTaskTab(tabName) {
        // Update active tab button
        document.querySelectorAll('#projectTaskModal .tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });
        
        // Show active tab content
        document.querySelectorAll('#projectTaskModal .tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `${tabName}-tab`);
        });
    }
    
    calculateDuration() {
        const startDate = document.getElementById('taskStartDate').value;
        const endDate = document.getElementById('taskEndDate').value;
        
        if (startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            const diffTime = Math.abs(end - start);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // Include both start and end days
            
            document.getElementById('taskDuration').value = diffDays;
        }
    }
    
    calculateEndDate() {
        const startDate = document.getElementById('taskStartDate').value;
        const duration = parseInt(document.getElementById('taskDuration').value);
        
        if (startDate && duration) {
            const start = new Date(startDate);
            const end = new Date(start);
            end.setDate(start.getDate() + duration - 1); // Duration includes start day
            
            document.getElementById('taskEndDate').value = end.toISOString().split('T')[0];
        }
    }
    
    async loadProjectData() {
        try {
            // Load project details
            const projectResponse = await fetch(`/api/projects/${this.currentProjectId}`);
            if (projectResponse.ok) {
                const project = await projectResponse.json();
                
                // Populate phases
                const phaseSelect = document.getElementById('taskPhase');
                if (project.phases && phaseSelect) {
                    project.phases.forEach(phase => {
                        const option = document.createElement('option');
                        option.value = phase.id;
                        option.textContent = phase.name;
                        phaseSelect.appendChild(option);
                    });
                }
                
                // Populate resources
                const resourceSelects = document.querySelectorAll('.resource-select');
                const assigneeSelect = document.getElementById('taskAssignee');
                if (project.resources) {
                    project.resources.forEach(resource => {
                        const option = document.createElement('option');
                        option.value = resource.id;
                        option.textContent = `${resource.name} (${resource.role})`;
                        
                        if (assigneeSelect) {
                            assigneeSelect.appendChild(option.cloneNode(true));
                        }
                        
                        resourceSelects.forEach(select => {
                            select.appendChild(option.cloneNode(true));
                        });
                    });
                }
            }
            
            // Load existing tasks for dependencies
            await this.loadProjectTasks();
            
        } catch (error) {
            console.error('Error loading project data:', error);
        }
    }
    
    async loadProjectTasks() {
        try {
            const response = await fetch(`/api/projects/${this.currentProjectId}/tasks`);
            if (response.ok) {
                this.projectTasks = await response.json();
                
                // Populate dependency selects
                const predecessorSelect = document.getElementById('predecessorSelect');
                const successorSelect = document.getElementById('successorSelect');
                
                this.projectTasks.forEach(task => {
                    if (task.id !== this.currentTaskId) { // Don't allow self-dependency
                        const option = document.createElement('option');
                        option.value = task.id;
                        option.textContent = task.title;
                        
                        if (predecessorSelect) {
                            predecessorSelect.appendChild(option.cloneNode(true));
                        }
                        if (successorSelect) {
                            successorSelect.appendChild(option.cloneNode(true));
                        }
                    }
                });
            }
        } catch (error) {
            console.error('Error loading project tasks:', error);
        }
    }
    
    addPredecessor() {
        const select = document.getElementById('predecessorSelect');
        const typeSelect = document.getElementById('predecessorType');
        const lagInput = document.getElementById('predecessorLag');
        
        if (select.value) {
            const task = this.projectTasks.find(t => t.id === select.value);
            const type = typeSelect.value;
            const lag = lagInput.value || 0;
            
            const listHtml = `
                <div class="dependency-item" data-task-id="${task.id}" data-type="${type}" data-lag="${lag}">
                    <span>${task.title} (${type}${lag > 0 ? ' +' + lag : ''})</span>
                    <button class="btn btn-sm btn-danger" onclick="this.parentElement.remove()">Remove</button>
                </div>
            `;
            
            document.getElementById('predecessorList').insertAdjacentHTML('beforeend', listHtml);
            
            // Reset selections
            select.value = '';
            typeSelect.value = 'FS';
            lagInput.value = 0;
        }
    }
    
    addSuccessor() {
        const select = document.getElementById('successorSelect');
        
        if (select.value) {
            const task = this.projectTasks.find(t => t.id === select.value);
            
            const listHtml = `
                <div class="dependency-item" data-task-id="${task.id}">
                    <span>${task.title}</span>
                    <button class="btn btn-sm btn-danger" onclick="this.parentElement.remove()">Remove</button>
                </div>
            `;
            
            document.getElementById('successorList').insertAdjacentHTML('beforeend', listHtml);
            
            // Reset selection
            select.value = '';
        }
    }
    
    addResourceAssignment() {
        const assignmentHtml = `
            <div class="resource-assignment">
                <select class="form-control resource-select">
                    <option value="">Select resource...</option>
                </select>
                <input type="number" class="form-control allocation-input" placeholder="Allocation %" min="0" max="100" value="100">
                <button class="btn btn-danger btn-sm" onclick="this.parentElement.remove()">Remove</button>
            </div>
        `;
        
        document.getElementById('resourceAssignments').insertAdjacentHTML('beforeend', assignmentHtml);
        
        // Populate the new select with resources
        this.loadProjectData();
    }
    
    async saveProjectTask() {
        // Gather all task data
        const taskData = {
            title: document.getElementById('taskTitle').value,
            description: this.taskEditor.root.innerHTML,
            category: document.getElementById('taskCategory').value,
            priority: document.getElementById('taskPriority').value,
            status: document.getElementById('taskStatus').value,
            project_id: this.currentProjectId,
            phase_id: document.getElementById('taskPhase').value || null,
            milestone_id: document.getElementById('taskMilestone').value || null,
            
            // Gantt properties
            gantt_properties: {
                start_date: document.getElementById('taskStartDate').value,
                end_date: document.getElementById('taskEndDate').value,
                duration: parseInt(document.getElementById('taskDuration').value),
                progress: parseInt(document.getElementById('taskProgress').value),
                is_milestone: document.getElementById('isMilestoneTask').checked,
                is_critical_path: document.getElementById('isCritical')?.checked || false
            },
            
            // Resources
            assigned_to: document.getElementById('taskAssignee').value,
            resource_assignments: this.getResourceAssignments(),
            
            // Dependencies
            dependencies: this.getDependencies(),
            blocks: this.getSuccessors(),
            
            // Advanced
            constraint_type: document.getElementById('constraintType').value,
            constraint_date: document.getElementById('constraintDate').value,
            tags: document.getElementById('taskTags').value,
            notes: document.getElementById('taskNotes').value,
            estimated_cost: parseFloat(document.getElementById('taskCost').value) || 0,
            effort_hours: parseFloat(document.getElementById('taskEffort').value) || 0
        };
        
        // Handle recurring tasks
        if (document.getElementById('isRecurring').checked) {
            taskData.recurrence = {
                pattern: document.getElementById('recurrencePattern').value,
                interval: parseInt(document.getElementById('recurrenceInterval').value)
            };
        }
        
        try {
            const url = this.currentTaskId 
                ? `/api/tasks/${this.currentTaskId}`
                : '/api/tasks';
            
            const method = this.currentTaskId ? 'PUT' : 'POST';
            
            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(taskData)
            });
            
            if (response.ok) {
                const savedTask = await response.json();
                
                // Link task to project if new
                if (!this.currentTaskId) {
                    await fetch(`/api/projects/${this.currentProjectId}/link-task`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            task_id: savedTask.id,
                            phase_id: taskData.phase_id,
                            milestone_id: taskData.milestone_id
                        })
                    });
                }
                
                showNotification('Task saved successfully', 'success');
                this.closeTaskModal();
                
                // Refresh project view
                if (window.projectManager) {
                    window.projectManager.loadProjectTasks();
                }
                
                // Refresh Gantt if visible
                if (window.projectManager && window.projectManager.ganttChart) {
                    window.projectManager.loadGanttChart(this.currentProjectId);
                }
                
            } else {
                throw new Error('Failed to save task');
            }
        } catch (error) {
            console.error('Error saving task:', error);
            showNotification('Failed to save task', 'error');
        }
    }
    
    getDependencies() {
        const dependencies = [];
        document.querySelectorAll('#predecessorList .dependency-item').forEach(item => {
            dependencies.push({
                task_id: item.dataset.taskId,
                type: item.dataset.type || 'FS',
                lag: parseInt(item.dataset.lag) || 0
            });
        });
        return dependencies;
    }
    
    getSuccessors() {
        const successors = [];
        document.querySelectorAll('#successorList .dependency-item').forEach(item => {
            successors.push(item.dataset.taskId);
        });
        return successors;
    }
    
    getResourceAssignments() {
        const assignments = [];
        document.querySelectorAll('#resourceAssignments .resource-assignment').forEach(item => {
            const resourceSelect = item.querySelector('.resource-select');
            const allocationInput = item.querySelector('.allocation-input');
            
            if (resourceSelect.value) {
                assignments.push({
                    resource_id: resourceSelect.value,
                    allocation_percentage: parseInt(allocationInput.value) || 100
                });
            }
        });
        return assignments;
    }
    
    closeTaskModal() {
        const modal = document.getElementById('projectTaskModal');
        if (modal) {
            modal.style.display = 'none';
        }
        this.currentTaskId = null;
    }
    
    async editProjectTask(taskId) {
        this.currentTaskId = taskId;
        
        try {
            const response = await fetch(`/api/tasks/${taskId}`);
            if (response.ok) {
                const task = await response.json();
                this.populateTaskForm(task);
                document.getElementById('projectTaskModal').style.display = 'block';
                document.getElementById('taskModalTitle').textContent = 'Edit Project Task';
            }
        } catch (error) {
            console.error('Error loading task:', error);
            showNotification('Failed to load task', 'error');
        }
    }
    
    populateTaskForm(task) {
        // Basic info
        document.getElementById('taskTitle').value = task.title || '';
        if (this.taskEditor) {
            this.taskEditor.root.innerHTML = task.description || '';
        }
        document.getElementById('taskCategory').value = task.category || 'Development';
        document.getElementById('taskPriority').value = task.priority || 'Medium';
        document.getElementById('taskStatus').value = task.status || 'Not Started';
        document.getElementById('taskPhase').value = task.phase_id || '';
        document.getElementById('taskMilestone').value = task.milestone_id || '';
        
        // Schedule
        const ganttProps = task.gantt_properties || {};
        document.getElementById('taskStartDate').value = ganttProps.start_date || '';
        document.getElementById('taskEndDate').value = ganttProps.end_date || '';
        document.getElementById('taskDuration').value = ganttProps.duration || 1;
        document.getElementById('taskProgress').value = ganttProps.progress || 0;
        document.getElementById('progressValue').textContent = (ganttProps.progress || 0) + '%';
        document.getElementById('isMilestoneTask').checked = ganttProps.is_milestone || false;
        document.getElementById('taskEffort').value = task.effort_hours || '';
        
        // Resources
        document.getElementById('taskAssignee').value = task.assigned_to || '';
        
        // Advanced
        document.getElementById('taskTags').value = task.tags || '';
        document.getElementById('taskNotes').value = task.notes || '';
        document.getElementById('taskCost').value = task.estimated_cost || '';
        
        // TODO: Load dependencies and resource assignments
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.projectTaskManager = new ProjectTaskManager();
});

// Utility function for notifications
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);
    
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 3000);
}