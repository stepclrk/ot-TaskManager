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
        // Wait for DOM first if needed
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
            return;
        }
        
        await this.loadProjects();
        this.initializeEventListeners();
        
        // Small delay to ensure all DOM elements are ready
        setTimeout(() => {
            this.renderInitialView();
        }, 100);
    }
    
    renderInitialView() {
        // Try multiple times to find the container
        let attempts = 0;
        const maxAttempts = 5;
        
        const tryRender = () => {
            attempts++;
            const container = document.getElementById('projectsContainer') || 
                            document.getElementById('projectsGrid') || 
                            document.querySelector('.projects-container') ||
                            document.querySelector('.projects-grid');
            
            if (container) {
                // Ensure it has the ID for future references
                if (!container.id) {
                    container.id = 'projectsGrid';
                }
                console.log('Rendering initial project list with', this.projects.length, 'projects');
                this.renderProjectList();
            } else if (attempts < maxAttempts) {
                // Try again after a short delay
                console.log(`Container not found, attempt ${attempts}/${maxAttempts}, retrying...`);
                setTimeout(tryRender, 200);
            } else {
                console.error('No container found for projects display after', maxAttempts, 'attempts');
                // Last resort: create the container
                const created = this.getOrCreateContainer();
                if (created) {
                    console.log('Created container, rendering projects');
                    this.renderProjectList();
                }
            }
        };
        
        tryRender();
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
        
        // Setup dropdown toggles
        document.addEventListener('click', (e) => {
            if (e.target.matches('.dropdown-toggle')) {
                e.preventDefault();
                e.target.parentElement.classList.toggle('show');
            } else if (!e.target.closest('.dropdown')) {
                document.querySelectorAll('.dropdown.show').forEach(dropdown => {
                    dropdown.classList.remove('show');
                });
            }
        });
    }
    
    getOrCreateContainer() {
        // Try to find existing container - check both possible IDs
        let container = document.getElementById('projectsContainer') || 
                       document.getElementById('projectsGrid');
        if (container) return container;
        
        // Try by class names
        container = document.querySelector('.projects-container') || 
                   document.querySelector('.projects-grid');
        if (container) {
            return container;
        }
        
        // Create if doesn't exist
        const contentContainer = document.querySelector('.content-container');
        if (!contentContainer) {
            console.error('Cannot find content container to create view container');
            return null;
        }
        
        // Look for filters section to insert after
        const filtersSection = document.querySelector('.filters-section');
        if (filtersSection) {
            container = document.createElement('div');
            container.id = 'projectsGrid';
            container.className = 'projects-grid';
            filtersSection.insertAdjacentElement('afterend', container);
            return container;
        }
        
        // As last resort, append to content container
        container = document.createElement('div');
        container.id = 'projectsGrid';
        container.className = 'projects-grid';
        contentContainer.appendChild(container);
        return container;
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
        let container = document.getElementById('projectsContainer') || 
                       document.getElementById('projectsGrid') ||
                       document.querySelector('.projects-container') ||
                       document.querySelector('.projects-grid');
        if (!container) {
            console.error('Projects container not found - cannot render');
            return;
        }
        
        const filteredProjects = this.getFilteredProjects();
        
        // Restore the original class for grid view
        container.className = 'projects-grid';
        container.innerHTML = filteredProjects.map(project => this.createProjectCard(project)).join('');
        
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
        const projectTitle = project.title || project.name || 'Untitled Project';
        
        return `
            <div class="project-card" data-project-id="${project.id}">
                <div class="project-header">
                    <div>
                        <h3 class="project-title">${projectTitle}</h3>
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
                        <span>${this.formatDate(project.target_date || project.end_date)}</span>
                    </div>
                    <div class="info-item">
                        <i class="fas fa-dollar-sign"></i>
                        <span>${this.formatCurrency(project.budget?.total_budget || 0)}</span>
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
        // Get or ensure container exists
        let container = this.getOrCreateContainer();
        if (!container) {
            console.error('Cannot create Gantt view - no container available');
            return;
        }
        
        // Clear the container and add gantt view
        container.className = 'gantt-view-container';
        container.innerHTML = `
            <div class="gantt-view">
                <div class="gantt-header">
                    <h2>Project Timeline</h2>
                    <div class="gantt-controls">
                        <select id="ganttProjectSelect" class="form-control">
                            <option value="">All Projects</option>
                            ${this.projects.map(p => `
                                <option value="${p.id}">${p.title || p.name || 'Untitled'}</option>
                            `).join('')}
                        </select>
                        <div class="dropdown" style="display: inline-block;">
                            <button class="btn btn-secondary dropdown-toggle" data-toggle="dropdown">
                                <i class="fas fa-download"></i> Export
                            </button>
                            <div class="dropdown-menu">
                                <a class="dropdown-item" href="#" onclick="projectManager.exportGantt('png')">Export as PNG</a>
                                <a class="dropdown-item" href="#" onclick="projectManager.exportGantt('svg')">Export as SVG</a>
                                <a class="dropdown-item" href="#" onclick="projectManager.exportGantt('pdf')">Export as PDF</a>
                                <a class="dropdown-item" href="#" onclick="projectManager.exportGantt('csv')">Export as CSV</a>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="gantt-wrapper">
                    <div class="gantt-task-list">
                        <div id="gantt-task-list-items"></div>
                    </div>
                    <div id="gantt-container"></div>
                </div>
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
            let ganttTasks = [];
            
            if (projectId && projectId !== '') {
                // Load tasks for specific project
                const tasksResponse = await fetch(`/api/tasks?project_id=${projectId}`);
                const tasks = await tasksResponse.json();
                
                // Filter for project tasks
                ganttTasks = tasks.filter(task => task.project_id === projectId);
            } else {
                // Load all tasks or create sample data
                const tasksResponse = await fetch('/api/tasks');
                const allTasks = await tasksResponse.json();
                
                if (allTasks.length > 0) {
                    ganttTasks = allTasks;
                } else {
                    // Create sample tasks for demonstration
                    ganttTasks = this.createSampleGanttTasks();
                }
            }
            
            // Ensure all tasks have required date fields
            ganttTasks = ganttTasks.map(task => {
                if (!task.start_date) {
                    task.start_date = task.created_date || new Date().toISOString().split('T')[0];
                }
                if (!task.end_date) {
                    const start = new Date(task.start_date);
                    start.setDate(start.getDate() + 7); // Default 7 days duration
                    task.end_date = start.toISOString().split('T')[0];
                }
                return task;
            });
            
            this.renderGanttChart(ganttTasks, projectId);
        } catch (error) {
            console.error('Error loading Gantt data:', error);
            // Show sample data on error
            this.renderGanttChart(this.createSampleGanttTasks(), projectId);
        }
    }
    
    createSampleGanttTasks() {
        const today = new Date();
        const getDate = (daysOffset) => {
            const date = new Date(today);
            date.setDate(date.getDate() + daysOffset);
            return date.toISOString().split('T')[0];
        };
        
        return [
            {
                id: 'sample-1',
                title: 'Project Planning',
                start_date: getDate(0),
                end_date: getDate(5),
                progress: 100,
                priority: 'High'
            },
            {
                id: 'sample-2',
                title: 'Requirements Gathering',
                start_date: getDate(3),
                end_date: getDate(10),
                progress: 75,
                priority: 'High',
                dependencies: ['sample-1']
            },
            {
                id: 'sample-3',
                title: 'Design Phase',
                start_date: getDate(10),
                end_date: getDate(20),
                progress: 50,
                priority: 'Medium',
                dependencies: ['sample-2']
            },
            {
                id: 'sample-4',
                title: 'Development',
                start_date: getDate(20),
                end_date: getDate(45),
                progress: 25,
                priority: 'High',
                dependencies: ['sample-3']
            },
            {
                id: 'sample-5',
                title: 'Testing',
                start_date: getDate(40),
                end_date: getDate(55),
                progress: 0,
                priority: 'Medium',
                dependencies: ['sample-4']
            },
            {
                id: 'sample-6',
                title: 'Deployment',
                start_date: getDate(55),
                end_date: getDate(60),
                progress: 0,
                priority: 'Critical',
                dependencies: ['sample-5']
            }
        ];
    }
    
    renderGanttChart(tasks, projectId) {
        const container = document.getElementById('gantt-container');
        const taskListContainer = document.getElementById('gantt-task-list-items');
        if (!container || !taskListContainer) return;
        
        // Store tasks data for later use
        this.currentGanttTasks = tasks;
        
        // Format tasks for Frappe Gantt
        const ganttTasks = tasks.map(task => {
            const startDate = task.gantt_properties?.start_date || task.start_date || task.created_date;
            const endDate = task.gantt_properties?.end_date || task.end_date || task.due_date || startDate;
            const progress = task.gantt_properties?.progress || task.progress || 0;
            
            return {
                id: task.id,
                name: task.title,
                start: startDate,
                end: endDate,
                progress: progress,
                dependencies: task.dependencies || [],
                custom_class: '',
                _task: task // Store original task data
            };
        });
        
        // Populate task list sidebar
        taskListContainer.innerHTML = ganttTasks.map((task, index) => {
            const duration = this.calculateDuration(task.start, task.end);
            return `
                <div class="task-list-item" data-task-id="${task.id}" data-index="${index}">
                    <div class="task-name" title="${task.name}">
                        <span class="task-icon">📋</span>
                        ${task.name}
                    </div>
                    <div class="task-duration">${duration} days</div>
                    <div class="task-progress">
                        <div class="progress-bar-mini">
                            <div class="progress-fill-mini" style="width: ${task.progress}%"></div>
                        </div>
                        <span>${task.progress}%</span>
                    </div>
                </div>
            `;
        }).join('');
        
        // Add click handlers to task list items
        taskListContainer.querySelectorAll('.task-list-item').forEach(item => {
            item.addEventListener('click', () => {
                const taskId = item.dataset.taskId;
                this.openTaskDetails(taskId);
            });
        });
        
        // Initialize Gantt chart
        // Store config for alignment calculations
        this.ganttConfig = {
            header_height: 50,
            column_width: 30,
            step: 24,
            view_modes: ['Quarter Day', 'Half Day', 'Day', 'Week', 'Month'],
            bar_height: 20,
            bar_corner_radius: 3,
            arrow_curve: 5,
            padding: 18,
            view_mode: 'Week',
            date_format: 'YYYY-MM-DD'
        };
        
        this.ganttChart = new Gantt('#gantt-container', ganttTasks, {
            ...this.ganttConfig,
            on_click: (task) => {
                this.openTaskDetails(task.id);
            },
            on_date_change: (task, start, end) => {
                this.updateTaskDates(task.id, start, end);
            },
            on_progress_change: (task, progress) => {
                this.updateTaskProgress(task.id, progress);
            },
            custom_popup_html: (task) => {
                const taskData = task._task;
                return `
                    <div class="gantt-popup">
                        <h4>${task.name}</h4>
                        <p><strong>Start:</strong> ${this.formatDate(task._start)}</p>
                        <p><strong>End:</strong> ${this.formatDate(task._end)}</p>
                        <p><strong>Progress:</strong> ${task.progress}%</p>
                        <p><strong>Status:</strong> ${taskData?.status || 'Not Started'}</p>
                        ${taskData?.assigned_to ? `<p><strong>Assigned:</strong> ${taskData.assigned_to}</p>` : ''}
                        <button class="btn btn-sm btn-primary" onclick="projectManager.openTaskDetails('${task.id}')">
                            View Details
                        </button>
                    </div>
                `;
            }
        });
        
        // Synchronize task list with Gantt chart alignment
        this.alignTaskListWithGantt();
    }
    
    alignTaskListWithGantt() {
        const ganttContainer = document.getElementById('gantt-container');
        const taskListItems = document.getElementById('gantt-task-list-items');
        const taskListWrapper = document.querySelector('.gantt-task-list');
        
        if (!ganttContainer || !taskListItems) return;
        
        // Wait for Gantt to render completely
        setTimeout(() => {
            // Find the Gantt SVG and its components
            const ganttSvg = ganttContainer.querySelector('svg');
            if (!ganttSvg) {
                console.log('Gantt SVG not found, retrying...');
                setTimeout(() => this.alignTaskListWithGantt(), 200);
                return;
            }
            
            // Get all the bars to determine exact positioning
            let bars = ganttSvg.querySelectorAll('.bar-wrapper');
            
            // If no bar-wrapper, try to find individual bars
            if (bars.length === 0) {
                bars = ganttSvg.querySelectorAll('.bar');
            }
            
            const taskItemElements = taskListItems.querySelectorAll('.task-list-item');
            
            if (bars.length === 0 || taskItemElements.length === 0) {
                console.log('No bars found or no task items, using fallback');
                this.alignWithUniformSpacing(taskItemElements, taskListItems);
                return;
            }
            
            // Get configuration values
            const barHeight = this.ganttConfig?.bar_height || 20;
            const padding = this.ganttConfig?.padding || 18;
            const headerHeight = this.ganttConfig?.header_height || 50;
            const rowHeight = barHeight + padding;
            
            // Reset task list container
            taskListItems.style.position = 'relative';
            taskListItems.style.paddingTop = '0';
            taskListItems.style.marginTop = '0';
            taskListItems.style.minHeight = ganttSvg.getAttribute('height') + 'px';
            
            // Get positions of all bars
            const barData = [];
            bars.forEach((bar, index) => {
                // Try to get Y position from transform
                let yPos = 0;
                const transform = bar.getAttribute('transform');
                if (transform) {
                    const match = transform.match(/translate\([^,]+,\s*([\d.]+)/);
                    if (match) {
                        yPos = parseFloat(match[1]);
                    }
                } else {
                    // Try to get y attribute directly
                    const barEl = bar.querySelector('.bar') || bar;
                    const y = barEl.getAttribute('y');
                    if (y) {
                        yPos = parseFloat(y);
                    }
                }
                barData.push({ element: bar, y: yPos });
            });
            
            // Sort bars by Y position to ensure correct order
            barData.sort((a, b) => a.y - b.y);
            
            console.log('Bar data:', barData.map(b => b.y));
            
            // If we have bars, use their positions
            if (barData.length > 0) {
                // Get the first bar position to determine header offset
                const firstBarY = barData[0].y;
                
                // Bars are vertically centered in their row
                // The row starts at: barY - (rowHeight - barHeight) / 2
                // But we need to fine-tune this based on actual Gantt rendering
                const rowPadding = (rowHeight - barHeight) / 2;
                // Move down by 5% of row height for better alignment
                const adjustment = rowHeight * 0.30; // 30% of row height
                const contentStartY = firstBarY - rowPadding + adjustment;
                
                console.log('First bar Y:', firstBarY, 'Row padding:', rowPadding, 'Content start:', contentStartY);
                
                // Apply padding to align first task with first bar's row
                taskListItems.style.paddingTop = contentStartY + 'px';
                
                // Now set heights for each task item based on bar spacing
                taskItemElements.forEach((item, index) => {
                    if (index < barData.length) {
                        // Calculate height based on next bar position or use default
                        let itemHeight = rowHeight;
                        if (index < barData.length - 1) {
                            // Calculate actual spacing between bars
                            itemHeight = barData[index + 1].y - barData[index].y;
                        }
                        
                        // Apply styles - ensure no gaps
                        item.style.height = itemHeight + 'px';
                        item.style.lineHeight = itemHeight + 'px';
                        item.style.margin = '0';
                        item.style.padding = '0 15px';
                        item.style.position = 'relative';
                        item.style.display = 'flex';
                        item.style.alignItems = 'center';
                        
                        console.log(`Task ${index}: height=${itemHeight}px`);
                    } else {
                        // Hide extra task items if there are more tasks than bars
                        item.style.display = 'none';
                    }
                });
            } else {
                // Fallback: use uniform spacing
                this.alignWithUniformSpacing(taskItemElements, taskListItems);
            }
            
            // Sync scrolling
            this.setupScrollSync();
        }, 500); // Give time for Gantt to fully render
    }
    
    alignWithUniformSpacing(taskItemElements, taskListItems) {
        // Fallback alignment using uniform spacing
        const barHeight = this.ganttConfig?.bar_height || 20;
        const padding = this.ganttConfig?.padding || 18;
        const headerHeight = this.ganttConfig?.header_height || 50;
        const rowHeight = barHeight + padding;
        
        taskListItems.style.position = 'relative';
        taskListItems.style.paddingTop = headerHeight + 'px';
        
        taskItemElements.forEach((item, index) => {
            item.style.position = 'relative';
            item.style.height = rowHeight + 'px';
            item.style.display = 'flex';
            item.style.alignItems = 'center';
        });
    }
    
    setupScrollSync() {
        const ganttContainer = document.getElementById('gantt-container');
        const taskListWrapper = document.querySelector('.gantt-task-list');
        
        if (!ganttContainer || !taskListWrapper) return;
        
        let isScrolling = false;
        
        // Sync vertical scrolling
        ganttContainer.addEventListener('scroll', () => {
            if (isScrolling) return;
            isScrolling = true;
            taskListWrapper.scrollTop = ganttContainer.scrollTop;
            setTimeout(() => { isScrolling = false; }, 10);
        });
        
        taskListWrapper.addEventListener('scroll', () => {
            if (isScrolling) return;
            isScrolling = true;
            ganttContainer.scrollTop = taskListWrapper.scrollTop;
            setTimeout(() => { isScrolling = false; }, 10);
        });
    }
    
    renderBoardView() {
        // Get or ensure container exists
        let container = this.getOrCreateContainer();
        if (!container) {
            console.error('Cannot create board view - no container available');
            return;
        }
        
        const statuses = ['Planning', 'Active', 'On Hold', 'Completed'];
        
        // Set container class for board view
        container.className = 'board-view';
        container.innerHTML = `
            <div class="board-columns">
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
                <h4>${project.title || project.name || 'Untitled'}</h4>
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
        // Reset all form fields - check if they exist first
        const setFieldValue = (id, value) => {
            const field = document.getElementById(id);
            if (field) field.value = value;
        };
        
        // Reset fields that may exist
        setFieldValue('projectTitle', '');
        setFieldValue('projectName', '');
        setFieldValue('projectCode', '');
        setFieldValue('projectCustomer', '');
        setFieldValue('projectManager', '');
        setFieldValue('projectStatus', 'Planning');
        setFieldValue('projectPriority', 'Medium');
        setFieldValue('projectStartDate', '');
        setFieldValue('projectEndDate', '');
        setFieldValue('projectTargetDate', '');
        setFieldValue('projectType', 'Development');
        setFieldValue('projectMethodology', 'Agile');
        
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
        // Populate form fields with project data - check if they exist first
        const setFieldValue = (id, value) => {
            const field = document.getElementById(id);
            if (field) field.value = value || '';
        };
        
        // Set field values for fields that may exist
        setFieldValue('projectTitle', project.title || project.name);
        setFieldValue('projectName', project.title || project.name);
        setFieldValue('projectCode', project.project_code);
        setFieldValue('projectCustomer', project.customer_name);
        setFieldValue('projectManager', project.project_manager);
        setFieldValue('projectStatus', project.status || 'Planning');
        setFieldValue('projectPriority', project.priority || 'Medium');
        setFieldValue('projectStartDate', project.start_date);
        setFieldValue('projectEndDate', project.end_date);
        setFieldValue('projectTargetDate', project.target_date || project.end_date);
        setFieldValue('projectType', project.project_type || 'Development');
        setFieldValue('projectMethodology', project.methodology || 'Agile');
        
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
        
        // Initialize Quill editor for description - check which container exists
        const editorContainer = document.getElementById('projectDescriptionEditor') || 
                              document.getElementById('projectDescription');
        if (editorContainer && typeof Quill !== 'undefined') {
            const containerId = editorContainer.id;
            // Check if Quill is already initialized on this element
            if (!editorContainer.__quill) {
                this.descriptionEditor = new Quill('#' + containerId, {
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
                editorContainer.__quill = this.descriptionEditor;
            } else {
                // Use existing Quill instance
                this.descriptionEditor = editorContainer.__quill;
            }
        }
        
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
        // Get field values safely
        const getFieldValue = (id) => {
            const field = document.getElementById(id);
            return field ? field.value : '';
        };
        
        const titleValue = getFieldValue('projectTitle') || getFieldValue('projectName');
        
        const projectData = {
            name: titleValue,
            title: titleValue,
            project_code: getFieldValue('projectCode'),
            description: this.descriptionEditor?.root?.innerHTML || getFieldValue('projectDescription') || '',
            customer_name: getFieldValue('projectCustomer'),
            project_manager: getFieldValue('projectManager'),
            status: getFieldValue('projectStatus') || 'Planning',
            priority: getFieldValue('projectPriority') || 'Medium',
            start_date: getFieldValue('projectStartDate'),
            end_date: getFieldValue('projectEndDate'),
            target_date: getFieldValue('projectTargetDate') || getFieldValue('projectEndDate'),
            project_type: getFieldValue('projectType') || 'Development',
            methodology: getFieldValue('projectMethodology') || 'Agile'
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
                const projectName = (project.title || project.name || '').toLowerCase();
                return projectName.includes(searchLower) ||
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
    
    // Helper method to calculate duration between dates
    calculateDuration(start, end) {
        const startDate = new Date(start);
        const endDate = new Date(end);
        const diffTime = Math.abs(endDate - startDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays || 1;
    }
    
    // Strip HTML tags from text
    stripHtml(html) {
        const temp = document.createElement('div');
        temp.innerHTML = html;
        return temp.textContent || temp.innerText || '';
    }
    
    // Open task details modal
    async openTaskDetails(taskId) {
        try {
            // Find the task in our current data
            const task = this.currentGanttTasks?.find(t => t.id === taskId);
            if (task) {
                // Open task modal (assuming there's a task modal in the system)
                if (window.openTaskModal) {
                    window.openTaskModal(task);
                } else {
                    // Fallback: show task details in an alert or custom modal
                    this.showTaskDetailsModal(task);
                }
            } else {
                // If not found locally, try to fetch all tasks and find it
                const response = await fetch('/api/tasks');
                if (response.ok) {
                    const tasks = await response.json();
                    const foundTask = tasks.find(t => t.id === taskId);
                    if (foundTask) {
                        this.showTaskDetailsModal(foundTask);
                    }
                }
            }
        } catch (error) {
            console.error('Error loading task details:', error);
        }
    }
    
    // Update task dates when dragged in Gantt
    async updateTaskDates(taskId, start, end) {
        try {
            const response = await fetch(`/api/tasks/${taskId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    start_date: start.toISOString().split('T')[0],
                    end_date: end.toISOString().split('T')[0],
                    gantt_properties: {
                        start_date: start.toISOString().split('T')[0],
                        end_date: end.toISOString().split('T')[0]
                    }
                })
            });
            
            if (response.ok) {
                showNotification('Task dates updated', 'success');
            }
        } catch (error) {
            console.error('Error updating task dates:', error);
            showNotification('Failed to update task dates', 'error');
        }
    }
    
    // Update task progress
    async updateTaskProgress(taskId, progress) {
        try {
            const response = await fetch(`/api/tasks/${taskId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    gantt_properties: { progress: progress }
                })
            });
            
            if (response.ok) {
                showNotification('Task progress updated', 'success');
            }
        } catch (error) {
            console.error('Error updating task progress:', error);
            showNotification('Failed to update task progress', 'error');
        }
    }
    
    // Show task details in a custom modal
    showTaskDetailsModal(task) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'block';
        modal.innerHTML = `
            <div class="modal-content">
                <span class="close" onclick="this.parentElement.parentElement.remove()">&times;</span>
                <h2>${task.title}</h2>
                <div class="task-details">
                    <p><strong>Description:</strong> ${task.description || 'No description'}</p>
                    <p><strong>Status:</strong> ${task.status}</p>
                    <p><strong>Priority:</strong> ${task.priority}</p>
                    <p><strong>Assigned to:</strong> ${task.assigned_to || 'Unassigned'}</p>
                    <p><strong>Due Date:</strong> ${this.formatDate(task.due_date)}</p>
                    ${task.gantt_properties ? `
                        <p><strong>Start Date:</strong> ${this.formatDate(task.gantt_properties.start_date)}</p>
                        <p><strong>End Date:</strong> ${this.formatDate(task.gantt_properties.end_date)}</p>
                        <p><strong>Progress:</strong> ${task.gantt_properties.progress}%</p>
                    ` : ''}
                </div>
                <div class="modal-footer">
                    <button class="btn btn-primary" onclick="window.location.href='/tasks?edit=${task.id}'">
                        Edit Task
                    </button>
                    <button class="btn btn-secondary" onclick="this.parentElement.parentElement.parentElement.remove()">
                        Close
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
    
    exportGantt(format) {
        if (!this.ganttChart || !this.currentGanttTasks) {
            showNotification('No Gantt chart to export', 'warning');
            return;
        }
        
        switch(format) {
            case 'png':
                this.exportGanttAsPNG();
                break;
            case 'svg':
                this.exportGanttAsSVG();
                break;
            case 'pdf':
                this.exportGanttAsPDF();
                break;
            case 'csv':
                this.exportGanttAsCSV();
                break;
            default:
                showNotification('Unknown export format', 'error');
        }
    }
    
    exportGanttAsPNG() {
        const svg = document.querySelector('#gantt-container svg');
        if (!svg) return;
        
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        
        // Get SVG data
        const svgData = new XMLSerializer().serializeToString(svg);
        const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);
        
        img.onload = () => {
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
            
            // Download PNG
            canvas.toBlob((blob) => {
                const link = document.createElement('a');
                link.download = `gantt-chart-${new Date().toISOString().split('T')[0]}.png`;
                link.href = URL.createObjectURL(blob);
                link.click();
            });
            
            URL.revokeObjectURL(url);
        };
        
        img.src = url;
    }
    
    exportGanttAsSVG() {
        const svg = document.querySelector('#gantt-container svg');
        if (!svg) return;
        
        const svgData = new XMLSerializer().serializeToString(svg);
        const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        
        const link = document.createElement('a');
        link.download = `gantt-chart-${new Date().toISOString().split('T')[0]}.svg`;
        link.href = URL.createObjectURL(blob);
        link.click();
    }
    
    exportGanttAsPDF() {
        // This requires a library like jsPDF
        if (typeof jsPDF === 'undefined') {
            // Load jsPDF dynamically
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
            script.onload = () => {
                this.generatePDF();
            };
            document.head.appendChild(script);
        } else {
            this.generatePDF();
        }
    }
    
    generatePDF() {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('landscape', 'mm', 'a4');
        
        // Add title
        doc.setFontSize(16);
        doc.text('Project Gantt Chart', 10, 10);
        
        // Add task list
        doc.setFontSize(10);
        let y = 25;
        
        doc.text('Task Name', 10, y);
        doc.text('Start Date', 80, y);
        doc.text('End Date', 120, y);
        doc.text('Progress', 160, y);
        doc.text('Status', 200, y);
        
        y += 10;
        this.currentGanttTasks.forEach(task => {
            if (y > 180) {
                doc.addPage();
                y = 25;
            }
            
            doc.text(task.title.substring(0, 30), 10, y);
            doc.text(this.formatDate(task.start_date || task.gantt_properties?.start_date), 80, y);
            doc.text(this.formatDate(task.end_date || task.gantt_properties?.end_date), 120, y);
            doc.text(`${task.gantt_properties?.progress || 0}%`, 160, y);
            doc.text(task.status || 'Not Started', 200, y);
            
            y += 8;
        });
        
        // Save PDF
        doc.save(`gantt-chart-${new Date().toISOString().split('T')[0]}.pdf`);
    }
    
    exportGanttAsCSV() {
        if (!this.currentGanttTasks || this.currentGanttTasks.length === 0) {
            showNotification('No tasks to export', 'warning');
            return;
        }
        
        // Create CSV content
        const headers = ['Task Name', 'Start Date', 'End Date', 'Duration (days)', 'Progress (%)', 'Status', 'Assigned To', 'Priority'];
        const rows = this.currentGanttTasks.map(task => {
            const startDate = task.gantt_properties?.start_date || task.start_date || '';
            const endDate = task.gantt_properties?.end_date || task.end_date || task.due_date || '';
            const duration = this.calculateDuration(startDate, endDate);
            const progress = task.gantt_properties?.progress || task.progress || 0;
            
            return [
                `"${task.title.replace(/"/g, '""')}"`,
                startDate,
                endDate,
                duration,
                progress,
                task.status || 'Not Started',
                task.assigned_to || 'Unassigned',
                task.priority || 'Medium'
            ].join(',');
        });
        
        const csv = [headers.join(','), ...rows].join('\n');
        
        // Download CSV
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.download = `gantt-chart-${new Date().toISOString().split('T')[0]}.csv`;
        link.href = URL.createObjectURL(blob);
        link.click();
    }
}

// Mark that enhanced version is available (before initialization)
window.projectManagerEnhanced = true;

// Initialize when DOM is ready
function initializeProjectManager() {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeProjectManager);
    } else {
        // DOM is already loaded
        console.log('Initializing Enhanced ProjectManager...');
        window.projectManager = new ProjectManager();
    }
}

// Start initialization
initializeProjectManager();

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