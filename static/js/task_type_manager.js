// Task Type Manager - Handles differentiation between regular and project tasks

class TaskTypeManager {
    constructor() {
        this.currentTaskType = 'regular';
        this.projectFieldContainers = [
            'projectTaskFields',  // Container for all project-specific fields
            'ganttPropertiesSection',
            'resourceAllocationSection',
            'budgetSection'
        ];
        this.projectTabs = ['gantt', 'resources', 'budget'];
        this.initialized = false;
    }

    // Determine task type based on task data
    getTaskType(task) {
        if (!task) return 'regular';
        
        // Check if task has explicit type
        if (task.task_type) {
            return task.task_type;
        }
        
        // Check if task has project_id
        if (task.project_id) {
            return 'project';
        }
        
        // Check for project-specific fields
        if (task.gantt_properties || task.resource_allocation || task.budget_tracking) {
            return 'project';
        }
        
        // Check for dates that indicate project planning
        if (task.start_date || task.end_date || task.duration) {
            return 'project';
        }
        
        return 'regular';
    }

    // Setup task modal with type switcher
    setupTaskModal(task = null) {
        console.log('Setting up task modal with task:', task);
        const modalContent = document.querySelector('#taskModal .modal-content');
        if (!modalContent) {
            console.error('Modal content not found');
            return;
        }
        
        // Determine initial type
        this.currentTaskType = this.getTaskType(task);
        
        // Add type switcher if not exists
        if (!document.getElementById('taskTypeSwitcher')) {
            this.addTypeSwitcher();
        }
        
        // Set the current type
        const typeRadio = document.querySelector(`input[name="taskType"][value="${this.currentTaskType}"]`);
        if (typeRadio) {
            typeRadio.checked = true;
        }
        
        // Show/hide appropriate fields
        if (this.currentTaskType === 'project') {
            this.showProjectFields();
        } else {
            this.hideProjectFields();
        }
        
        // Store task type in hidden field
        this.updateTaskTypeField();
    }

    // Add type switcher UI
    addTypeSwitcher() {
        console.log('Adding type switcher');
        // Check if already exists
        if (document.getElementById('taskTypeSwitcher')) {
            console.log('Type switcher already exists');
            return;
        }
        
        const detailsTab = document.getElementById('detailsTab');
        if (!detailsTab) {
            console.error('Details tab not found');
            return;
        }
        
        const switcher = document.createElement('div');
        switcher.id = 'taskTypeSwitcher';
        switcher.className = 'task-type-switcher';
        switcher.innerHTML = `
            <div class="form-group type-selector">
                <label>Choose Task Type</label>
                <div class="type-options">
                    <label class="type-option">
                        <input type="radio" name="taskType" value="regular" checked>
                        <span>Regular Task</span>
                    </label>
                    <label class="type-option">
                        <input type="radio" name="taskType" value="project">
                        <span>Project Task</span>
                    </label>
                </div>
                <small id="typeDescription" class="type-info">💡 Regular tasks are simple to-do items without project management features</small>
            </div>
            <input type="hidden" id="taskTypeField" name="task_type" value="regular">
        `;
        
        // Insert at the beginning of the form
        const form = document.getElementById('taskForm');
        if (form && form.firstChild) {
            form.insertBefore(switcher, form.firstChild);
        }
        
        // Add event listeners
        const radios = switcher.querySelectorAll('input[name="taskType"]');
        radios.forEach(radio => {
            radio.addEventListener('change', (e) => this.handleTypeChange(e.target.value));
        });
    }

    // Handle type change
    handleTypeChange(newType) {
        this.currentTaskType = newType;
        
        if (newType === 'project') {
            this.showProjectFields();
            document.getElementById('typeDescription').innerHTML = 
                '📊 <strong>Project Task:</strong> Includes advanced features like timeline management, resource allocation, and budget tracking';
        } else {
            this.hideProjectFields();
            document.getElementById('typeDescription').innerHTML = 
                '💡 <strong>Regular Task:</strong> Simple to-do items for quick task management without complex planning';
        }
        
        // Update hidden field
        this.updateTaskTypeField();
        
        // If converting to project task, ensure project fields exist
        if (newType === 'project') {
            this.ensureProjectFieldsExist();
            if (!document.getElementById('taskStartDate')?.value) {
                this.setProjectDefaults();
            }
        }
    }

    // Show project-specific fields
    showProjectFields() {
        // First ensure the fields exist
        this.ensureProjectFieldsExist();
        
        // Show project field containers
        this.projectFieldContainers.forEach(containerId => {
            const container = document.getElementById(containerId);
            if (container) {
                container.style.display = 'block';
                container.classList.remove('hidden');
            }
        });
        
        // Show project tabs if they exist
        this.projectTabs.forEach(tabName => {
            const tabBtn = document.querySelector(`[data-tab="${tabName}"]`);
            if (tabBtn) {
                tabBtn.style.display = 'inline-block';
                tabBtn.classList.remove('hidden');
            }
        });
    }

    // Hide project-specific fields
    hideProjectFields() {
        // Hide project field containers
        this.projectFieldContainers.forEach(containerId => {
            const container = document.getElementById(containerId);
            if (container) {
                container.style.display = 'none';
                container.classList.add('hidden');
            }
        });
        
        // Hide project tabs
        this.projectTabs.forEach(tabName => {
            const tabBtn = document.querySelector(`[data-tab="${tabName}"]`);
            if (tabBtn) {
                tabBtn.style.display = 'none';
                tabBtn.classList.add('hidden');
            }
        });
        
        // Switch to details tab if on a project tab
        const activeTab = document.querySelector('.tab-btn.active');
        if (activeTab && this.projectTabs.includes(activeTab.dataset.tab)) {
            const detailsTab = document.querySelector('[data-tab="details"]');
            if (detailsTab) {
                detailsTab.click();
            }
        }
    }

    // Set default values for project fields
    setProjectDefaults() {
        const today = new Date().toISOString().split('T')[0];
        const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        
        // Set default dates
        const startDate = document.getElementById('taskStartDate');
        const endDate = document.getElementById('taskEndDate');
        const duration = document.getElementById('taskDuration');
        const progress = document.getElementById('taskProgress');
        
        if (startDate && !startDate.value) startDate.value = today;
        if (endDate && !endDate.value) endDate.value = nextWeek;
        if (duration && !duration.value) duration.value = '5';
        if (progress && !progress.value) progress.value = '0';
    }
    
    // Update hidden task type field
    updateTaskTypeField() {
        const typeField = document.getElementById('taskTypeField');
        if (typeField) {
            typeField.value = this.currentTaskType;
        }
    }
    
    // Ensure project fields exist in the DOM
    ensureProjectFieldsExist() {
        // Check if project fields already exist
        if (document.getElementById('projectTaskFields')) return;
        
        const detailsTab = document.getElementById('detailsTab');
        if (!detailsTab) return;
        
        // Create project fields container
        const projectFieldsHTML = `
            <div id="projectTaskFields" class="project-task-fields" style="display: none;">
                <h4>Project Management Features</h4>
                
                <!-- Gantt Properties -->
                <div id="ganttPropertiesSection" class="form-section">
                    <h5>📅 Timeline & Progress</h5>
                    <div class="form-row">
                        <div class="form-group">
                            <label for="taskStartDate">Start Date</label>
                            <input type="date" id="taskStartDate" name="start_date">
                        </div>
                        <div class="form-group">
                            <label for="taskEndDate">End Date</label>
                            <input type="date" id="taskEndDate" name="end_date">
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label for="taskDuration">Duration (days)</label>
                            <input type="number" id="taskDuration" name="duration" min="1" placeholder="5">
                        </div>
                        <div class="form-group">
                            <label for="taskProgress">Progress (%)</label>
                            <input type="number" id="taskProgress" name="progress" min="0" max="100" placeholder="0">
                        </div>
                    </div>
                </div>
                
                <!-- Resource Allocation -->
                <div id="resourceAllocationSection" class="form-section">
                    <h5>👥 Resource Management</h5>
                    <div class="form-row">
                        <div class="form-group">
                            <label for="taskResource">Assigned Resource</label>
                            <input type="text" id="taskResource" name="resource" placeholder="Team member or department">
                        </div>
                        <div class="form-group">
                            <label for="taskEstimatedHours">Estimated Hours</label>
                            <input type="number" id="taskEstimatedHours" name="estimated_hours" min="0" step="0.5" placeholder="8.0">
                        </div>
                    </div>
                </div>
                
                <!-- Budget -->
                <div id="budgetSection" class="form-section">
                    <h5>💰 Budget Tracking</h5>
                    <div class="form-row">
                        <div class="form-group">
                            <label for="taskBudget">Allocated Budget ($)</label>
                            <input type="number" id="taskBudget" name="budget" min="0" step="0.01" placeholder="1000.00">
                        </div>
                        <div class="form-group">
                            <label for="taskActualCost">Actual Cost ($)</label>
                            <input type="number" id="taskActualCost" name="actual_cost" min="0" step="0.01" placeholder="0.00">
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Find where to insert - after the basic fields
        const form = document.getElementById('taskForm');
        if (form) {
            // Find the submit buttons to insert before them
            const submitButtons = form.querySelector('.modal-footer');
            if (submitButtons) {
                const projectFields = document.createElement('div');
                projectFields.innerHTML = projectFieldsHTML;
                form.insertBefore(projectFields.firstElementChild, submitButtons);
            } else {
                // Append at the end of form
                form.insertAdjacentHTML('beforeend', projectFieldsHTML);
            }
        }
    }

    // Get task data with type information
    getTaskData(formData) {
        formData.task_type = this.currentTaskType;
        
        if (this.currentTaskType === 'project') {
            // Include project-specific fields only if they exist
            const startDate = document.getElementById('taskStartDate');
            const endDate = document.getElementById('taskEndDate');
            const duration = document.getElementById('taskDuration');
            const progress = document.getElementById('taskProgress');
            
            if (startDate || endDate || duration || progress) {
                formData.gantt_properties = {
                    start_date: startDate?.value || '',
                    end_date: endDate?.value || '',
                    duration: parseInt(duration?.value) || 0,
                    progress: parseInt(progress?.value) || 0
                };
            }
            
            const resource = document.getElementById('taskResource');
            const estimatedHours = document.getElementById('taskEstimatedHours');
            
            if (resource || estimatedHours) {
                formData.resource_allocation = {
                    resource: resource?.value || '',
                    estimated_hours: parseFloat(estimatedHours?.value) || 0
                };
            }
            
            const budget = document.getElementById('taskBudget');
            const actualCost = document.getElementById('taskActualCost');
            
            if (budget || actualCost) {
                formData.budget_tracking = {
                    budget: parseFloat(budget?.value) || 0,
                    actual_cost: parseFloat(actualCost?.value) || 0
                };
            }
        }
        
        return formData;
    }
    
    // Load task data and set type
    loadTaskData(task) {
        if (!task) return;
        
        // Set type based on task data
        this.currentTaskType = this.getTaskType(task);
        
        // Update type selector
        const typeRadio = document.querySelector(`input[name="taskType"][value="${this.currentTaskType}"]`);
        if (typeRadio) {
            typeRadio.checked = true;
        }
        
        // Update type field
        this.updateTaskTypeField();
        
        // Show/hide fields
        if (this.currentTaskType === 'project') {
            this.showProjectFields();
            
            // Load project-specific data
            if (task.gantt_properties) {
                const gp = task.gantt_properties;
                if (document.getElementById('taskStartDate')) {
                    document.getElementById('taskStartDate').value = gp.start_date || '';
                    document.getElementById('taskEndDate').value = gp.end_date || '';
                    document.getElementById('taskDuration').value = gp.duration || '';
                    document.getElementById('taskProgress').value = gp.progress || '0';
                }
            }
            
            if (task.resource_allocation) {
                const ra = task.resource_allocation;
                if (document.getElementById('taskResource')) {
                    document.getElementById('taskResource').value = ra.resource || '';
                    document.getElementById('taskEstimatedHours').value = ra.estimated_hours || '';
                }
            }
            
            if (task.budget_tracking) {
                const bt = task.budget_tracking;
                if (document.getElementById('taskBudget')) {
                    document.getElementById('taskBudget').value = bt.budget || '';
                    document.getElementById('taskActualCost').value = bt.actual_cost || '';
                }
            }
        } else {
            this.hideProjectFields();
        }
    }
}

// Initialize globally
const taskTypeManager = new TaskTypeManager();

// Export for use in other modules
window.taskTypeManager = taskTypeManager;

// Log to verify script is loaded
console.log('Task Type Manager loaded and initialized', window.taskTypeManager);

// Add CSS styles
const style = document.createElement('style');
style.textContent = `
    .task-type-switcher {
        margin: -10px -20px 20px -20px;
        padding: 0;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border-radius: 8px 8px 0 0;
        overflow: hidden;
    }
    
    .type-selector {
        padding: 15px 20px;
        margin-bottom: 0 !important;
    }
    
    .type-selector > label {
        color: rgba(255, 255, 255, 0.9);
        font-weight: 500;
        font-size: 0.9rem;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-bottom: 12px;
        display: block;
    }
    
    .type-options {
        display: flex;
        gap: 15px;
        margin-top: 10px;
    }
    
    .type-option {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        padding: 12px 20px;
        border-radius: 8px;
        transition: all 0.3s ease;
        background: rgba(255, 255, 255, 0.15);
        border: 2px solid transparent;
        color: white;
        font-weight: 500;
    }
    
    .type-option:hover {
        background: rgba(255, 255, 255, 0.25);
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }
    
    .type-option input[type="radio"] {
        display: none;
    }
    
    .type-option input[type="radio"]:checked + span {
        font-weight: 600;
    }
    
    .type-option input[type="radio"]:checked ~ .type-option,
    input[type="radio"]:checked + span {
        color: white;
    }
    
    input[type="radio"]:checked + .type-option,
    .type-option:has(input[type="radio"]:checked) {
        background: rgba(255, 255, 255, 0.3);
        border-color: rgba(255, 255, 255, 0.5);
        box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.1);
    }
    
    .type-option span {
        font-size: 1rem;
        display: flex;
        align-items: center;
        gap: 8px;
    }
    
    .type-info {
        display: block;
        margin-top: 12px;
        padding: 10px 15px;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 6px;
        color: rgba(255, 255, 255, 0.95);
        font-size: 0.875rem;
        line-height: 1.4;
    }
    
    .project-task-fields {
        background: linear-gradient(to bottom, #f8f9fa, #ffffff);
        border-radius: 12px;
        padding: 25px;
        margin: 20px 0;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
        border: 1px solid #e9ecef;
        position: relative;
        animation: slideDown 0.3s ease-out;
    }
    
    @keyframes slideDown {
        from {
            opacity: 0;
            transform: translateY(-20px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
    
    .project-task-fields::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 4px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border-radius: 12px 12px 0 0;
    }
    
    .project-task-fields h4 {
        color: #495057;
        margin: 0 0 25px 0;
        font-size: 1.25rem;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 10px;
    }
    
    .project-task-fields h4::before {
        content: '📊';
        font-size: 1.5rem;
    }
    
    .project-task-fields h5 {
        color: #6c757d;
        font-size: 0.95rem;
        font-weight: 600;
        margin: 30px 0 20px 0;
        padding-bottom: 10px;
        border-bottom: 2px solid #e9ecef;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }
    
    .form-section {
        margin-bottom: 30px;
        padding: 20px;
        background: white;
        border-radius: 8px;
        border: 1px solid #e9ecef;
    }
    
    .form-section:hover {
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
        transition: box-shadow 0.3s ease;
    }
    
    .form-row {
        display: flex;
        gap: 20px;
        margin-bottom: 20px;
    }
    
    .form-row .form-group {
        flex: 1;
    }
    
    .project-task-fields .form-group label {
        color: #495057;
        font-weight: 500;
        margin-bottom: 8px;
        font-size: 0.9rem;
    }
    
    .project-task-fields input[type="date"],
    .project-task-fields input[type="number"],
    .project-task-fields input[type="text"] {
        width: 100%;
        padding: 10px 12px;
        border: 1px solid #dee2e6;
        border-radius: 6px;
        font-size: 0.95rem;
        transition: all 0.3s ease;
        background: white;
    }
    
    .project-task-fields input:focus {
        border-color: #667eea;
        box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        outline: none;
    }
    
    .project-task-fields input::placeholder {
        color: #adb5bd;
        font-style: italic;
    }
    
    /* Hide project fields with animation */
    .project-task-fields.hidden {
        animation: slideUp 0.3s ease-out;
        display: none;
    }
    
    @keyframes slideUp {
        from {
            opacity: 1;
            transform: translateY(0);
        }
        to {
            opacity: 0;
            transform: translateY(-20px);
        }
    }
    
    /* Responsive design */
    @media (max-width: 768px) {
        .type-options {
            flex-direction: column;
        }
        
        .form-row {
            flex-direction: column;
            gap: 15px;
        }
    }
`;
document.head.appendChild(style);