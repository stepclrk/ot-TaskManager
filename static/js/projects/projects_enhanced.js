/**
 * Enhanced Project Management Module
 * Comprehensive project management with Gantt charts, resources, budget, and risks
 */

class ProjectManager {
    constructor() {
        this.currentProject = null;
        this.projects = [];
        this.ganttChart = null;
        this.currentView = 'list'; // list, gantt, board, portfolio
        this.filters = {
            status: '',
            priority: '',
            manager: '',
            search: ''
        };
        
        this.init();
    }
    
    async init() {
        await this.loadProjects();
        this.initializeEventListeners();
        this.renderProjectList();
    }
    
    async loadProjects() {
        try {
            const response = await fetch('/api/projects');
            if (response.ok) {
                this.projects = await response.json();
            }
        } catch (error) {
            console.error('Error loading projects:', error);
            showNotification('Failed to load projects', 'error');
        }
    }
    
    initializeEventListeners() {
        // View switcher
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchView(e.target.dataset.view);
            });
        });
        
        // Add project button
        const addBtn = document.getElementById('addProjectBtn');
        if (addBtn) {
            addBtn.addEventListener('click', () => this.showProjectModal());
        }
        
        // Search and filters
        const searchInput = document.getElementById('projectSearch');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.filters.search = e.target.value;
                this.applyFilters();
            });
        }
        
        // Portfolio view button
        const portfolioBtn = document.getElementById('portfolioViewBtn');
        if (portfolioBtn) {
            portfolioBtn.addEventListener('click', () => this.showPortfolioDashboard());
        }
    }
    
    switchView(view) {
        this.currentView = view;
        
        // Update active button
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === view);
        });
        
        // Show appropriate view
        switch(view) {
            case 'list':
                this.renderProjectList();
                break;
            case 'gantt':
                this.renderGanttView();
                break;
            case 'board':
                this.renderBoardView();
                break;
            case 'portfolio':
                this.showPortfolioDashboard();
                break;
        }
    }
    
    renderProjectList() {
        const container = document.getElementById('projectsContainer');
        if (!container) return;
        
        const filteredProjects = this.getFilteredProjects();
        
        container.innerHTML = `
            <div class="projects-grid">
                ${filteredProjects.map(project => this.createProjectCard(project)).join('')}
            </div>
        `;
        
        // Add click handlers
        container.querySelectorAll('.project-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (!e.target.closest('.project-actions')) {
                    // Open the enhanced project modal instead of navigating
                    this.editProject(card.dataset.projectId);
                }
            });
        });
    }
    
    createProjectCard(project) {
        const healthColor = project.health_color || 'gray';
        const healthStatus = project.health_status || 'Unknown';
        const progress = this.calculateProjectProgress(project);
        
        return `
            <div class="project-card" data-project-id="${project.id}">
                <div class="project-header">
                    <div>
                        <h3 class="project-title">${project.name}</h3>
                        <span class="project-code">${project.project_code || ''}</span>
                    </div>
                    <div class="project-health" style="background-color: ${healthColor}">
                        ${healthStatus}
                    </div>
                </div>
                
                <div class="project-meta">
                    <span class="project-status status-${project.status?.toLowerCase().replace(' ', '-')}">
                        ${project.status}
                    </span>
                    <span class="project-priority priority-${project.priority?.toLowerCase()}">
                        ${project.priority}
                    </span>
                </div>
                
                <div class="project-progress">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${progress}%"></div>
                    </div>
                    <span class="progress-text">${progress}% Complete</span>
                </div>
                
                <div class="project-info">
                    <div class="info-item">
                        <i class="fas fa-user"></i>
                        <span>${project.project_manager || 'Unassigned'}</span>
                    </div>
                    <div class="info-item">
                        <i class="fas fa-calendar"></i>
                        <span>${this.formatDate(project.end_date)}</span>
                    </div>
                    <div class="info-item">
                        <i class="fas fa-dollar-sign"></i>
                        <span>${this.formatCurrency(project.budget?.total_budget)}</span>
                    </div>
                </div>
                
                <div class="project-metrics">
                    <div class="metric">
                        <span class="metric-value">${project.task_ids?.length || 0}</span>
                        <span class="metric-label">Tasks</span>
                    </div>
                    <div class="metric">
                        <span class="metric-value">${project.resources?.length || 0}</span>
                        <span class="metric-label">Resources</span>
                    </div>
                    <div class="metric">
                        <span class="metric-value">${project.risks?.filter(r => r.status === 'Open').length || 0}</span>
                        <span class="metric-label">Open Risks</span>
                    </div>
                </div>
                
                <div class="project-actions">
                    <button class="btn-icon" onclick="projectManager.editProject('${project.id}')" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon" onclick="projectManager.showGanttChart('${project.id}')" title="Gantt Chart">
                        <i class="fas fa-chart-gantt"></i>
                    </button>
                    <button class="btn-icon" onclick="projectManager.deleteProject('${project.id}')" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }
    
    async renderGanttView() {
        const container = document.getElementById('projectsContainer');
        if (!container) return;
        
        container.innerHTML = `
            <div class="gantt-view">
                <div class="gantt-header">
                    <h2>Project Timeline</h2>
                    <div class="gantt-controls">
                        <select id="ganttProjectSelect" class="form-control">
                            <option value="">All Projects</option>
                            ${this.projects.map(p => `
                                <option value="${p.id}">${p.name}</option>
                            `).join('')}
                        </select>
                        <button class="btn btn-secondary" onclick="projectManager.toggleCriticalPath()">
                            <i class="fas fa-route"></i> Critical Path
                        </button>
                        <button class="btn btn-secondary" onclick="projectManager.exportGantt()">
                            <i class="fas fa-download"></i> Export
                        </button>
                    </div>
                </div>
                <div id="gantt-container"></div>
            </div>
        `;
        
        // Load Gantt data for selected project or all projects
        const projectSelect = document.getElementById('ganttProjectSelect');
        projectSelect.addEventListener('change', (e) => {
            this.loadGanttChart(e.target.value);
        });
        
        // Load initial Gantt chart
        if (this.projects.length > 0) {
            this.loadGanttChart(this.projects[0].id);
        }
    }
    
    async loadGanttChart(projectId) {
        try {
            const response = await fetch(`/api/projects/${projectId}/gantt`);
            if (response.ok) {
                const ganttData = await response.json();
                this.renderGanttChart(ganttData);
            }
        } catch (error) {
            console.error('Error loading Gantt data:', error);
        }
    }
    
    renderGanttChart(data) {
        const container = document.getElementById('gantt-container');
        if (!container) return;
        
        // Format tasks for Frappe Gantt
        const tasks = data.tasks.map(task => ({
            id: task.id,
            name: task.name,
            start: task.start,
            end: task.end,
            progress: task.progress,
            dependencies: task.dependencies.join(','),
            custom_class: task.is_critical ? 'critical-task' : ''
        }));
        
        // Initialize Gantt chart
        this.ganttChart = new Gantt('#gantt-container', tasks, {
            header_height: 50,
            column_width: 30,
            step: 24,
            view_modes: ['Quarter Day', 'Half Day', 'Day', 'Week', 'Month'],
            bar_height: 20,
            bar_corner_radius: 3,
            arrow_curve: 5,
            padding: 18,
            view_mode: 'Day',
            date_format: 'YYYY-MM-DD',
            custom_popup_html: (task) => {
                const taskData = data.tasks.find(t => t.id === task.id);
                return `
                    <div class="gantt-popup">
                        <h4>${task.name}</h4>
                        <p>Start: ${this.formatDate(task._start)}</p>
                        <p>End: ${this.formatDate(task._end)}</p>
                        <p>Progress: ${task.progress}%</p>
                        ${taskData?.resource ? `<p>Resource: ${taskData.resource}</p>` : ''}
                        ${taskData?.is_critical ? '<p class="critical">Critical Path</p>' : ''}
                    </div>
                `;
            },
            on_click: (task) => {
                this.showTaskDetails(task.id);
            },
            on_date_change: (task, start, end) => {
                this.updateTaskDates(task.id, start, end);
            },
            on_progress_change: (task, progress) => {
                this.updateTaskProgress(task.id, progress);
            }
        });
        
        // Highlight critical path if available
        if (data.critical_path && data.critical_path.length > 0) {
            this.highlightCriticalPath(data.critical_path);
        }
    }
    
    highlightCriticalPath(criticalPath) {
        criticalPath.forEach(taskId => {
            const element = document.querySelector(`g[data-id="${taskId}"]`);
            if (element) {
                element.classList.add('critical-path');
            }
        });
    }
    
    renderBoardView() {
        const container = document.getElementById('projectsContainer');
        if (!container) return;
        
        const statuses = ['Planning', 'Active', 'On Hold', 'Completed'];
        
        container.innerHTML = `
            <div class="board-view">
                ${statuses.map(status => `
                    <div class="board-column" data-status="${status}">
                        <div class="column-header">
                            <h3>${status}</h3>
                            <span class="column-count">${this.getProjectsByStatus(status).length}</span>
                        </div>
                        <div class="column-cards">
                            ${this.getProjectsByStatus(status).map(project => this.createBoardCard(project)).join('')}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        
        // Initialize drag and drop
        this.initializeDragAndDrop();
    }
    
    createBoardCard(project) {
        return `
            <div class="board-card" draggable="true" data-project-id="${project.id}">
                <h4>${project.name}</h4>
                <div class="board-card-meta">
                    <span class="priority-${project.priority?.toLowerCase()}">${project.priority}</span>
                    <span>${this.formatDate(project.end_date)}</span>
                </div>
                <div class="board-card-progress">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${this.calculateProjectProgress(project)}%"></div>
                    </div>
                </div>
            </div>
        `;
    }
    
    async showPortfolioDashboard() {
        const container = document.getElementById('projectsContainer');
        if (!container) return;
        
        try {
            const response = await fetch('/api/portfolio/dashboard');
            if (response.ok) {
                const data = await response.json();
                this.renderPortfolioDashboard(data);
            }
        } catch (error) {
            console.error('Error loading portfolio dashboard:', error);
        }
    }
    
    renderPortfolioDashboard(data) {
        const container = document.getElementById('projectsContainer');
        if (!container) return;
        
        container.innerHTML = `
            <div class="portfolio-dashboard">
                <h2>Portfolio Overview</h2>
                
                <div class="portfolio-metrics">
                    <div class="metric-card">
                        <i class="fas fa-project-diagram"></i>
                        <div class="metric-content">
                            <span class="metric-value">${data.summary.total_projects}</span>
                            <span class="metric-label">Total Projects</span>
                        </div>
                    </div>
                    <div class="metric-card">
                        <i class="fas fa-tasks"></i>
                        <div class="metric-content">
                            <span class="metric-value">${data.summary.active_projects}</span>
                            <span class="metric-label">Active Projects</span>
                        </div>
                    </div>
                    <div class="metric-card">
                        <i class="fas fa-dollar-sign"></i>
                        <div class="metric-content">
                            <span class="metric-value">${this.formatCurrency(data.summary.total_budget)}</span>
                            <span class="metric-label">Total Budget</span>
                        </div>
                    </div>
                    <div class="metric-card">
                        <i class="fas fa-chart-line"></i>
                        <div class="metric-content">
                            <span class="metric-value">${data.summary.budget_utilization.toFixed(1)}%</span>
                            <span class="metric-label">Budget Used</span>
                        </div>
                    </div>
                </div>
                
                <div class="portfolio-charts">
                    <div class="chart-container">
                        <h3>Project Health</h3>
                        <canvas id="healthChart"></canvas>
                    </div>
                    <div class="chart-container">
                        <h3>Resource Utilization</h3>
                        <canvas id="resourceChart"></canvas>
                    </div>
                </div>
                
                <div class="portfolio-resources">
                    <h3>Resource Allocation</h3>
                    <div class="resource-list">
                        ${data.resources.map(resource => `
                            <div class="resource-item">
                                <span class="resource-name">${resource.name}</span>
                                <span class="resource-projects">${resource.projects.join(', ')}</span>
                                <div class="resource-allocation ${resource.total_allocation > 100 ? 'overallocated' : ''}">
                                    ${resource.total_allocation}%
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                <div class="portfolio-timeline">
                    <h3>Project Timeline</h3>
                    <div id="portfolio-gantt"></div>
                </div>
            </div>
        `;
        
        // Render charts
        this.renderPortfolioCharts(data);
    }
    
    renderPortfolioCharts(data) {
        // Health chart
        const healthCtx = document.getElementById('healthChart')?.getContext('2d');
        if (healthCtx) {
            new Chart(healthCtx, {
                type: 'doughnut',
                data: {
                    labels: Object.keys(data.health_summary),
                    datasets: [{
                        data: Object.values(data.health_summary),
                        backgroundColor: ['#28a745', '#17a2b8', '#ffc107', '#dc3545']
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false
                }
            });
        }
        
        // Resource chart
        const resourceCtx = document.getElementById('resourceChart')?.getContext('2d');
        if (resourceCtx && data.resources.length > 0) {
            new Chart(resourceCtx, {
                type: 'bar',
                data: {
                    labels: data.resources.map(r => r.name),
                    datasets: [{
                        label: 'Allocation %',
                        data: data.resources.map(r => r.total_allocation),
                        backgroundColor: data.resources.map(r => 
                            r.total_allocation > 100 ? '#dc3545' : '#28a745'
                        )
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            max: 150
                        }
                    }
                }
            });
        }
    }
    
    async showProjectModal(projectId = null) {
        const modal = document.getElementById('projectModal');
        if (!modal) {
            this.createProjectModal();
        }
        
        if (projectId) {
            // Load existing project
            const project = this.projects.find(p => p.id === projectId);
            if (project) {
                this.currentProject = project;
                this.populateProjectForm(project);
            }
        } else {
            // New project
            this.currentProject = null;
            this.resetProjectForm();
        }
        
        document.getElementById('projectModal').style.display = 'block';
    }
    
    resetProjectForm() {
        // Reset all form fields
        document.getElementById('projectName').value = '';
        document.getElementById('projectCode').value = '';
        document.getElementById('projectCustomer').value = '';
        document.getElementById('projectManager').value = '';
        document.getElementById('projectStatus').value = 'Planning';
        document.getElementById('projectPriority').value = 'Medium';
        document.getElementById('projectStartDate').value = '';
        document.getElementById('projectEndDate').value = '';
        document.getElementById('projectType').value = 'Development';
        document.getElementById('projectMethodology').value = 'Agile';
        
        // Clear Quill editor
        if (this.descriptionEditor) {
            this.descriptionEditor.setText('');
        }
        
        // Clear other tabs
        document.getElementById('phasesList').innerHTML = '';
        document.getElementById('resourcesList').innerHTML = '';
        document.getElementById('budgetCategories').innerHTML = '';
        document.getElementById('risksList').innerHTML = '';
        document.getElementById('projectTasksList').innerHTML = '';
        
        // Reset to first tab
        this.switchTab('details');
    }
    
    populateProjectForm(project) {
        // Populate form fields with project data
        document.getElementById('projectName').value = project.name || '';
        document.getElementById('projectCode').value = project.project_code || '';
        document.getElementById('projectCustomer').value = project.customer_name || '';
        document.getElementById('projectManager').value = project.project_manager || '';
        document.getElementById('projectStatus').value = project.status || 'Planning';
        document.getElementById('projectPriority').value = project.priority || 'Medium';
        document.getElementById('projectStartDate').value = project.start_date || '';
        document.getElementById('projectEndDate').value = project.end_date || '';
        document.getElementById('projectType').value = project.project_type || 'Development';
        document.getElementById('projectMethodology').value = project.methodology || 'Agile';
        
        // Set Quill editor content
        if (this.descriptionEditor && project.description) {
            this.descriptionEditor.root.innerHTML = project.description;
        }
        
        // Update modal title
        document.getElementById('projectModalTitle').textContent = 'Edit Project';
    }
    
    createProjectModal() {
        const modalHtml = `
            <div id="projectModal" class="modal">
                <div class="modal-content large-modal">
                    <div class="modal-header">
                        <h2 id="projectModalTitle">New Project</h2>
                        <span class="close" onclick="projectManager.closeProjectModal()">&times;</span>
                    </div>
                    
                    <div class="modal-tabs">
                        <button class="tab-btn active" data-tab="details">Details</button>
                        <button class="tab-btn" data-tab="phases">Phases & Milestones</button>
                        <button class="tab-btn" data-tab="resources">Resources</button>
                        <button class="tab-btn" data-tab="budget">Budget</button>
                        <button class="tab-btn" data-tab="risks">Risks</button>
                        <button class="tab-btn" data-tab="tasks">Tasks</button>
                    </div>
                    
                    <div class="modal-body">
                        <div class="tab-content active" id="details-tab">
                            <form id="projectDetailsForm">
                                <div class="form-row">
                                    <div class="form-group">
                                        <label>Project Name *</label>
                                        <input type="text" id="projectName" class="form-control" required>
                                    </div>
                                    <div class="form-group">
                                        <label>Project Code</label>
                                        <input type="text" id="projectCode" class="form-control">
                                    </div>
                                </div>
                                
                                <div class="form-group">
                                    <label>Description</label>
                                    <div id="projectDescription"></div>
                                </div>
                                
                                <div class="form-row">
                                    <div class="form-group">
                                        <label>Customer</label>
                                        <input type="text" id="projectCustomer" class="form-control">
                                    </div>
                                    <div class="form-group">
                                        <label>Project Manager</label>
                                        <input type="text" id="projectManager" class="form-control">
                                    </div>
                                </div>
                                
                                <div class="form-row">
                                    <div class="form-group">
                                        <label>Status</label>
                                        <select id="projectStatus" class="form-control">
                                            <option value="Planning">Planning</option>
                                            <option value="Active">Active</option>
                                            <option value="On Hold">On Hold</option>
                                            <option value="Completed">Completed</option>
                                            <option value="Cancelled">Cancelled</option>
                                        </select>
                                    </div>
                                    <div class="form-group">
                                        <label>Priority</label>
                                        <select id="projectPriority" class="form-control">
                                            <option value="Low">Low</option>
                                            <option value="Medium">Medium</option>
                                            <option value="High">High</option>
                                            <option value="Critical">Critical</option>
                                        </select>
                                    </div>
                                </div>
                                
                                <div class="form-row">
                                    <div class="form-group">
                                        <label>Start Date</label>
                                        <input type="date" id="projectStartDate" class="form-control">
                                    </div>
                                    <div class="form-group">
                                        <label>End Date</label>
                                        <input type="date" id="projectEndDate" class="form-control">
                                    </div>
                                </div>
                                
                                <div class="form-row">
                                    <div class="form-group">
                                        <label>Project Type</label>
                                        <select id="projectType" class="form-control">
                                            <option value="Development">Development</option>
                                            <option value="Maintenance">Maintenance</option>
                                            <option value="Research">Research</option>
                                            <option value="Implementation">Implementation</option>
                                        </select>
                                    </div>
                                    <div class="form-group">
                                        <label>Methodology</label>
                                        <select id="projectMethodology" class="form-control">
                                            <option value="Agile">Agile</option>
                                            <option value="Waterfall">Waterfall</option>
                                            <option value="Hybrid">Hybrid</option>
                                        </select>
                                    </div>
                                </div>
                            </form>
                        </div>
                        
                        <div class="tab-content" id="phases-tab">
                            <div class="phases-container">
                                <div class="phases-header">
                                    <h3>Project Phases</h3>
                                    <button class="btn btn-primary" onclick="projectManager.addPhase()">
                                        <i class="fas fa-plus"></i> Add Phase
                                    </button>
                                </div>
                                <div id="phasesList"></div>
                            </div>
                        </div>
                        
                        <div class="tab-content" id="resources-tab">
                            <div class="resources-container">
                                <div class="resources-header">
                                    <h3>Team Resources</h3>
                                    <button class="btn btn-primary" onclick="projectManager.addResource()">
                                        <i class="fas fa-plus"></i> Add Resource
                                    </button>
                                </div>
                                <div id="resourcesList"></div>
                            </div>
                        </div>
                        
                        <div class="tab-content" id="budget-tab">
                            <div class="budget-container">
                                <div class="budget-summary">
                                    <div class="form-row">
                                        <div class="form-group">
                                            <label>Total Budget</label>
                                            <input type="number" id="totalBudget" class="form-control">
                                        </div>
                                        <div class="form-group">
                                            <label>Currency</label>
                                            <select id="budgetCurrency" class="form-control">
                                                <option value="USD">USD</option>
                                                <option value="EUR">EUR</option>
                                                <option value="GBP">GBP</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                                <div class="budget-categories">
                                    <h3>Budget Categories</h3>
                                    <button class="btn btn-primary" onclick="projectManager.addBudgetCategory()">
                                        <i class="fas fa-plus"></i> Add Category
                                    </button>
                                    <div id="budgetCategories"></div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="tab-content" id="risks-tab">
                            <div class="risks-container">
                                <div class="risks-header">
                                    <h3>Risk Register</h3>
                                    <button class="btn btn-primary" onclick="projectManager.addRisk()">
                                        <i class="fas fa-plus"></i> Add Risk
                                    </button>
                                </div>
                                <div id="risksList"></div>
                            </div>
                        </div>
                        
                        <div class="tab-content" id="tasks-tab">
                            <div class="tasks-container">
                                <div class="tasks-header">
                                    <h3>Project Tasks</h3>
                                    <button class="btn btn-primary" onclick="projectManager.linkTask()">
                                        <i class="fas fa-link"></i> Link Existing Task
                                    </button>
                                    <button class="btn btn-primary" onclick="projectManager.createTask()">
                                        <i class="fas fa-plus"></i> Create New Task
                                    </button>
                                </div>
                                <div id="projectTasksList"></div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="projectManager.closeProjectModal()">Cancel</button>
                        <button class="btn btn-primary" onclick="projectManager.saveProject()">Save Project</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        // Initialize Quill editor for description
        this.descriptionEditor = new Quill('#projectDescription', {
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
        
        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tab = e.target.dataset.tab;
                this.switchTab(tab);
            });
        });
    }
    
    switchTab(tabName) {
        // Update active tab button
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });
        
        // Show active tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `${tabName}-tab`);
        });
        
        // Load tab-specific data if needed
        if (this.currentProject) {
            switch(tabName) {
                case 'phases':
                    this.loadPhases();
                    break;
                case 'resources':
                    this.loadResources();
                    break;
                case 'budget':
                    this.loadBudget();
                    break;
                case 'risks':
                    this.loadRisks();
                    break;
                case 'tasks':
                    this.loadProjectTasks();
                    break;
            }
        }
    }
    
    async saveProject() {
        const projectData = {
            name: document.getElementById('projectName').value,
            project_code: document.getElementById('projectCode').value,
            description: this.descriptionEditor.root.innerHTML,
            customer_name: document.getElementById('projectCustomer').value,
            project_manager: document.getElementById('projectManager').value,
            status: document.getElementById('projectStatus').value,
            priority: document.getElementById('projectPriority').value,
            start_date: document.getElementById('projectStartDate').value,
            end_date: document.getElementById('projectEndDate').value,
            project_type: document.getElementById('projectType').value,
            methodology: document.getElementById('projectMethodology').value
        };
        
        try {
            const url = this.currentProject 
                ? `/api/projects/${this.currentProject.id}`
                : '/api/projects';
            
            const method = this.currentProject ? 'PUT' : 'POST';
            
            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(projectData)
            });
            
            if (response.ok) {
                showNotification('Project saved successfully', 'success');
                this.closeProjectModal();
                await this.loadProjects();
                this.renderProjectList();
            } else {
                throw new Error('Failed to save project');
            }
        } catch (error) {
            console.error('Error saving project:', error);
            showNotification('Failed to save project', 'error');
        }
    }
    
    closeProjectModal() {
        const modal = document.getElementById('projectModal');
        if (modal) {
            modal.style.display = 'none';
        }
        this.currentProject = null;
    }
    
    async deleteProject(projectId) {
        if (!confirm('Are you sure you want to delete this project?')) {
            return;
        }
        
        try {
            const response = await fetch(`/api/projects/${projectId}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                showNotification('Project deleted successfully', 'success');
                await this.loadProjects();
                this.renderProjectList();
            } else {
                throw new Error('Failed to delete project');
            }
        } catch (error) {
            console.error('Error deleting project:', error);
            showNotification('Failed to delete project', 'error');
        }
    }
    
    // Helper methods
    calculateProjectProgress(project) {
        if (!project.phases || project.phases.length === 0) {
            return 0;
        }
        
        const totalProgress = project.phases.reduce((sum, phase) => {
            return sum + (phase.progress || 0);
        }, 0);
        
        return Math.round(totalProgress / project.phases.length);
    }
    
    formatDate(dateString) {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleDateString();
    }
    
    formatCurrency(amount) {
        if (!amount) return '$0';
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount);
    }
    
    getFilteredProjects() {
        return this.projects.filter(project => {
            if (this.filters.status && project.status !== this.filters.status) {
                return false;
            }
            if (this.filters.priority && project.priority !== this.filters.priority) {
                return false;
            }
            if (this.filters.manager && project.project_manager !== this.filters.manager) {
                return false;
            }
            if (this.filters.search) {
                const searchLower = this.filters.search.toLowerCase();
                return project.name.toLowerCase().includes(searchLower) ||
                       project.description?.toLowerCase().includes(searchLower) ||
                       project.project_code?.toLowerCase().includes(searchLower);
            }
            return true;
        });
    }
    
    getProjectsByStatus(status) {
        return this.projects.filter(p => p.status === status);
    }
    
    applyFilters() {
        this.renderProjectList();
    }
    
    editProject(projectId) {
        this.showProjectModal(projectId);
        // Auto-switch to tasks tab if you want to see tasks immediately
        setTimeout(() => {
            // You can change this to any tab you prefer as default
            // this.switchTab('tasks'); // Uncomment to auto-open tasks tab
        }, 100);
    }
    
    showGanttChart(projectId) {
        this.currentView = 'gantt';
        this.renderGanttView();
        setTimeout(() => {
            document.getElementById('ganttProjectSelect').value = projectId;
            this.loadGanttChart(projectId);
        }, 100);
    }
    
    openProjectWorkspace(projectId) {
        // Deprecated - now we use the modal view
        // window.location.href = `/projects/${projectId}`;
        this.editProject(projectId);
    }
    
    // Additional methods for phases, resources, budget, risks
    addPhase() {
        const phaseHtml = `
            <div class="phase-item">
                <div class="phase-header">
                    <input type="text" placeholder="Phase Name" class="form-control phase-name">
                    <button class="btn btn-danger btn-sm" onclick="this.parentElement.parentElement.remove()">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Start Date</label>
                        <input type="date" class="form-control phase-start">
                    </div>
                    <div class="form-group">
                        <label>End Date</label>
                        <input type="date" class="form-control phase-end">
                    </div>
                </div>
            </div>
        `;
        document.getElementById('phasesList').insertAdjacentHTML('beforeend', phaseHtml);
    }
    
    addResource() {
        const resourceHtml = `
            <div class="resource-item">
                <div class="resource-header">
                    <input type="text" placeholder="Resource Name" class="form-control resource-name">
                    <button class="btn btn-danger btn-sm" onclick="this.parentElement.parentElement.remove()">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Role</label>
                        <select class="form-control resource-role">
                            <option value="Developer">Developer</option>
                            <option value="Designer">Designer</option>
                            <option value="PM">Project Manager</option>
                            <option value="QA">QA Engineer</option>
                            <option value="BA">Business Analyst</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Allocation %</label>
                        <input type="number" class="form-control resource-allocation" min="0" max="100" value="100">
                    </div>
                </div>
            </div>
        `;
        document.getElementById('resourcesList').insertAdjacentHTML('beforeend', resourceHtml);
    }
    
    addBudgetCategory() {
        const categoryHtml = `
            <div class="budget-category-item">
                <div class="form-row">
                    <div class="form-group">
                        <input type="text" placeholder="Category Name" class="form-control category-name">
                    </div>
                    <div class="form-group">
                        <input type="number" placeholder="Allocated Amount" class="form-control category-amount">
                    </div>
                    <button class="btn btn-danger btn-sm" onclick="this.parentElement.parentElement.remove()">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
        document.getElementById('budgetCategories').insertAdjacentHTML('beforeend', categoryHtml);
    }
    
    addRisk() {
        const riskHtml = `
            <div class="risk-item">
                <div class="risk-header">
                    <input type="text" placeholder="Risk Title" class="form-control risk-title">
                    <button class="btn btn-danger btn-sm" onclick="this.parentElement.parentElement.remove()">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Probability</label>
                        <select class="form-control risk-probability">
                            <option value="Low">Low</option>
                            <option value="Medium">Medium</option>
                            <option value="High">High</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Impact</label>
                        <select class="form-control risk-impact">
                            <option value="Low">Low</option>
                            <option value="Medium">Medium</option>
                            <option value="High">High</option>
                            <option value="Critical">Critical</option>
                        </select>
                    </div>
                </div>
                <div class="form-group">
                    <label>Mitigation Plan</label>
                    <textarea class="form-control risk-mitigation" rows="2"></textarea>
                </div>
            </div>
        `;
        document.getElementById('risksList').insertAdjacentHTML('beforeend', riskHtml);
    }
    
    linkTask() {
        // Open task selection modal to link existing tasks
        this.showTaskLinkingModal();
    }
    
    createTask() {
        // Use the enhanced project task manager
        if (window.projectTaskManager) {
            window.projectTaskManager.initializeProjectTaskModal(this.currentProject.id);
            document.getElementById('projectTaskModal').style.display = 'block';
        } else {
            console.error('Project Task Manager not loaded');
            showNotification('Task manager not available', 'error');
        }
    }
    
    showTaskLinkingModal() {
        // Create a modal to select and link existing tasks
        const modalHtml = `
            <div id="taskLinkModal" class="modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2>Link Existing Tasks</h2>
                        <span class="close" onclick="this.parentElement.parentElement.parentElement.remove()">&times;</span>
                    </div>
                    <div class="modal-body">
                        <div class="form-group">
                            <label>Select tasks to link to this project:</label>
                            <div id="availableTasksList" style="max-height: 400px; overflow-y: auto;">
                                <!-- Tasks will be loaded here -->
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="this.parentElement.parentElement.parentElement.remove()">Cancel</button>
                        <button class="btn btn-primary" onclick="projectManager.linkSelectedTasks()">Link Selected Tasks</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        document.getElementById('taskLinkModal').style.display = 'block';
        
        // Load available tasks
        this.loadAvailableTasksForLinking();
    }
    
    async loadAvailableTasksForLinking() {
        try {
            const response = await fetch('/api/tasks');
            if (response.ok) {
                const tasks = await response.json();
                const unlinkedTasks = tasks.filter(t => !t.project_id);
                
                const listContainer = document.getElementById('availableTasksList');
                if (unlinkedTasks.length === 0) {
                    listContainer.innerHTML = '<p>No unlinked tasks available</p>';
                } else {
                    listContainer.innerHTML = unlinkedTasks.map(task => `
                        <div class="form-check">
                            <input class="form-check-input" type="checkbox" value="${task.id}" id="task-${task.id}">
                            <label class="form-check-label" for="task-${task.id}">
                                <strong>${task.title}</strong> - ${task.status} (${task.priority})
                            </label>
                        </div>
                    `).join('');
                }
            }
        } catch (error) {
            console.error('Error loading tasks:', error);
        }
    }
    
    async linkSelectedTasks() {
        const checkboxes = document.querySelectorAll('#availableTasksList input:checked');
        const taskIds = Array.from(checkboxes).map(cb => cb.value);
        
        if (taskIds.length === 0) {
            showNotification('Please select at least one task', 'warning');
            return;
        }
        
        try {
            for (const taskId of taskIds) {
                await fetch(`/api/projects/${this.currentProject.id}/link-task`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ task_id: taskId })
                });
            }
            
            showNotification(`${taskIds.length} task(s) linked successfully`, 'success');
            document.getElementById('taskLinkModal').remove();
            this.loadProjectTasks();
            
        } catch (error) {
            console.error('Error linking tasks:', error);
            showNotification('Failed to link tasks', 'error');
        }
    }
    
    loadPhases() {
        if (this.currentProject && this.currentProject.phases) {
            const phasesList = document.getElementById('phasesList');
            phasesList.innerHTML = '';
            this.currentProject.phases.forEach(phase => {
                // Render existing phases
                this.addPhase();
                // Populate phase data
                const lastPhase = phasesList.lastElementChild;
                lastPhase.querySelector('.phase-name').value = phase.name;
                lastPhase.querySelector('.phase-start').value = phase.start_date;
                lastPhase.querySelector('.phase-end').value = phase.end_date;
            });
        }
    }
    
    loadResources() {
        if (this.currentProject && this.currentProject.resources) {
            const resourcesList = document.getElementById('resourcesList');
            resourcesList.innerHTML = '';
            this.currentProject.resources.forEach(resource => {
                this.addResource();
                const lastResource = resourcesList.lastElementChild;
                lastResource.querySelector('.resource-name').value = resource.name;
                lastResource.querySelector('.resource-role').value = resource.role;
                lastResource.querySelector('.resource-allocation').value = resource.allocation_percentage;
            });
        }
    }
    
    loadBudget() {
        if (this.currentProject && this.currentProject.budget) {
            document.getElementById('totalBudget').value = this.currentProject.budget.total_budget || '';
            document.getElementById('budgetCurrency').value = this.currentProject.budget.currency || 'USD';
            
            if (this.currentProject.budget.budget_breakdown) {
                const categoriesList = document.getElementById('budgetCategories');
                categoriesList.innerHTML = '';
                this.currentProject.budget.budget_breakdown.forEach(category => {
                    this.addBudgetCategory();
                    const lastCategory = categoriesList.lastElementChild;
                    lastCategory.querySelector('.category-name').value = category.category;
                    lastCategory.querySelector('.category-amount').value = category.allocated;
                });
            }
        }
    }
    
    loadRisks() {
        if (this.currentProject && this.currentProject.risks) {
            const risksList = document.getElementById('risksList');
            risksList.innerHTML = '';
            this.currentProject.risks.forEach(risk => {
                this.addRisk();
                const lastRisk = risksList.lastElementChild;
                lastRisk.querySelector('.risk-title').value = risk.title;
                lastRisk.querySelector('.risk-probability').value = risk.probability;
                lastRisk.querySelector('.risk-impact').value = risk.impact;
                lastRisk.querySelector('.risk-mitigation').value = risk.mitigation_plan || '';
            });
        }
    }
    
    async loadProjectTasks() {
        if (this.currentProject) {
            try {
                const response = await fetch(`/api/projects/${this.currentProject.id}/tasks`);
                if (response.ok) {
                    const tasks = await response.json();
                    const tasksList = document.getElementById('projectTasksList');
                    tasksList.innerHTML = '';
                    
                    if (tasks.length === 0) {
                        tasksList.innerHTML = '<p class="no-tasks">No tasks linked to this project yet.</p>';
                    } else {
                        tasks.forEach(task => {
                            const taskHtml = `
                                <div class="task-item">
                                    <span class="task-title">${task.title}</span>
                                    <span class="task-status status-${task.status?.toLowerCase().replace(' ', '-')}">${task.status}</span>
                                    <button class="btn btn-sm btn-danger" onclick="projectManager.unlinkTask('${task.id}')">
                                        <i class="fas fa-unlink"></i>
                                    </button>
                                </div>
                            `;
                            tasksList.insertAdjacentHTML('beforeend', taskHtml);
                        });
                    }
                }
            } catch (error) {
                console.error('Error loading project tasks:', error);
            }
        }
    }
    
    async unlinkTask(taskId) {
        if (confirm('Are you sure you want to unlink this task from the project?')) {
            try {
                const response = await fetch(`/api/projects/${this.currentProject.id}/unlink-task/${taskId}`, {
                    method: 'DELETE'
                });
                
                if (response.ok) {
                    this.loadProjectTasks();
                    showNotification('Task unlinked successfully', 'success');
                }
            } catch (error) {
                console.error('Error unlinking task:', error);
                showNotification('Failed to unlink task', 'error');
            }
        }
    }
    
    initializeDragAndDrop() {
        // Initialize drag and drop for board view
        const cards = document.querySelectorAll('.board-card');
        const columns = document.querySelectorAll('.board-column');
        
        cards.forEach(card => {
            card.addEventListener('dragstart', (e) => {
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/html', e.target.innerHTML);
                e.dataTransfer.setData('projectId', e.target.dataset.projectId);
                e.target.classList.add('dragging');
            });
            
            card.addEventListener('dragend', (e) => {
                e.target.classList.remove('dragging');
            });
        });
        
        columns.forEach(column => {
            column.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
            });
            
            column.addEventListener('drop', async (e) => {
                e.preventDefault();
                const projectId = e.dataTransfer.getData('projectId');
                const newStatus = e.currentTarget.dataset.status;
                
                // Update project status
                await this.updateProjectStatus(projectId, newStatus);
                
                // Refresh the board
                this.renderBoardView();
            });
        });
    }
    
    async updateProjectStatus(projectId, status) {
        try {
            const response = await fetch(`/api/projects/${projectId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ status: status })
            });
            
            if (response.ok) {
                // Update local data
                const project = this.projects.find(p => p.id === projectId);
                if (project) {
                    project.status = status;
                }
                showNotification('Project status updated', 'success');
            }
        } catch (error) {
            console.error('Error updating project status:', error);
            showNotification('Failed to update project status', 'error');
        }
    }
    
    async updateTaskDates(taskId, start, end) {
        // Update task dates via API
        console.log('Updating task dates:', taskId, start, end);
        // TODO: Implement API call
    }
    
    async updateTaskProgress(taskId, progress) {
        // Update task progress via API
        console.log('Updating task progress:', taskId, progress);
        // TODO: Implement API call
    }
    
    showTaskDetails(taskId) {
        // Show task details modal or navigate to task
        console.log('Showing task details:', taskId);
        // TODO: Implement task details view
    }
    
    toggleCriticalPath() {
        // Toggle critical path visibility
        const criticalElements = document.querySelectorAll('.critical-path');
        criticalElements.forEach(el => {
            el.classList.toggle('highlight');
        });
    }
    
    exportGantt() {
        // Export Gantt chart as image or PDF
        alert('Gantt export feature coming soon!');
        // TODO: Implement export functionality
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.projectManager = new ProjectManager();
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