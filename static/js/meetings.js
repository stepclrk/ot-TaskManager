let allMeetings = [];
let currentMeeting = null;
let config = {};
let templates = [];
let teamMembers = [];
let objectiveEditor = null;
let notesEditor = null;
let expandedNotesEditor = null;
let agendaNotesEditor = null;
let agendaSortable = null;
let currentView = 'grid';
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();
window.hasApiKey = false;

// Meeting templates
const defaultTemplates = {
    'team-meeting': {
        name: 'Team Meeting',
        agenda: [
            { title: 'Review of Previous Action Items', time: 10, presenter: '' },
            { title: 'Project Updates', time: 20, presenter: '' },
            { title: 'Challenges and Blockers', time: 15, presenter: '' },
            { title: 'Next Steps and Action Items', time: 10, presenter: '' },
            { title: 'Q&A', time: 5, presenter: '' }
        ]
    },
    'standup': {
        name: 'Daily Standup',
        agenda: [
            { title: 'What did you do yesterday?', time: 5, presenter: '' },
            { title: 'What will you do today?', time: 5, presenter: '' },
            { title: 'Any blockers or challenges?', time: 5, presenter: '' }
        ]
    },
    'client-meeting': {
        name: 'Client Meeting',
        agenda: [
            { title: 'Welcome and Introductions', time: 5, presenter: '' },
            { title: 'Project Status Review', time: 20, presenter: '' },
            { title: 'Client Feedback and Concerns', time: 15, presenter: '' },
            { title: 'Next Steps and Timeline', time: 15, presenter: '' },
            { title: 'Action Items and Follow-up', time: 5, presenter: '' }
        ]
    },
    'retrospective': {
        name: 'Sprint Retrospective',
        agenda: [
            { title: 'What went well?', time: 15, presenter: '' },
            { title: 'What could be improved?', time: 15, presenter: '' },
            { title: 'What will we commit to improve?', time: 15, presenter: '' },
            { title: 'Action Items', time: 15, presenter: '' }
        ]
    },
    'planning': {
        name: 'Planning Meeting',
        agenda: [
            { title: 'Review Requirements', time: 20, presenter: '' },
            { title: 'Task Breakdown', time: 25, presenter: '' },
            { title: 'Resource Allocation', time: 10, presenter: '' },
            { title: 'Timeline Discussion', time: 15, presenter: '' },
            { title: 'Risk Assessment', time: 10, presenter: '' }
        ]
    }
};

async function checkApiKey() {
    try {
        const response = await fetch('/api/settings');
        const settings = await response.json();
        
        const aiProvider = settings.ai_provider || 'claude';
        window.aiProvider = aiProvider;
        
        window.hasApiKey = (aiProvider === 'claude' && settings.api_key && settings.api_key !== '');
        window.aiEnabled = (aiProvider === 'claude');
        
        // Show/hide AI features
        const aiTab = document.querySelector('[data-tab="ai-assistant"]');
        if (aiTab) {
            aiTab.style.display = window.aiEnabled ? 'inline-block' : 'none';
        }
    } catch (error) {
        console.error('Error checking API key:', error);
        window.hasApiKey = false;
        window.aiEnabled = false;
    }
}

document.addEventListener('DOMContentLoaded', function() {
    checkApiKey();
    loadConfig();
    loadTemplates();
    loadTeamMembers();
    loadMeetings();
    initializeEditors();
    initializeEventListeners();
    renderCalendar();
});

// Force fix Quill toolbar visibility by directly manipulating SVG elements
function fixQuillToolbarVisibility() {
    setTimeout(() => {
        // Find all SVG elements in Quill toolbars
        const svgElements = document.querySelectorAll('.ql-toolbar svg');
        svgElements.forEach(svg => {
            // Force black stroke on all child elements
            svg.querySelectorAll('.ql-stroke').forEach(el => {
                el.setAttribute('stroke', '#000');
                el.style.stroke = '#000';
            });
            
            // Force black fill on all fill elements
            svg.querySelectorAll('.ql-fill, .ql-stroke.ql-fill').forEach(el => {
                el.setAttribute('fill', '#000');
                el.style.fill = '#000';
            });
            
            // Handle even elements
            svg.querySelectorAll('.ql-even').forEach(el => {
                el.setAttribute('stroke', '#000');
                el.style.stroke = '#000';
            });
        });
        
        // Also fix buttons
        document.querySelectorAll('.ql-toolbar button').forEach(button => {
            button.style.color = '#000';
            button.style.opacity = '1';
        });
        
        // console.log('Fixed Quill toolbar visibility');
    }, 100);
}

function initializeEditors() {
    // Use SimpleEditor instead of Quill
    const objectiveElement = document.getElementById('objectiveEditor');
    if (objectiveElement && !objectiveEditor) {
        objectiveEditor = new SimpleEditor('objectiveEditor', {
            placeholder: 'Enter meeting objective...',
            height: '150px',
            toolbar: ['bold', 'italic', 'underline', 'bullet', 'number', 'link', 'clear']
        });
        
        // Sync content to hidden field on any change
        objectiveElement.addEventListener('input', function() {
            document.getElementById('meetingObjective').value = objectiveEditor.getContent();
        });
    }

    const notesElement = document.getElementById('notesEditor');
    if (notesElement && !notesEditor) {
        notesEditor = new SimpleEditor('notesEditor', {
            placeholder: 'Meeting notes and discussion points...',
            height: '100px',
            toolbar: ['bold', 'italic', 'underline', 'bullet', 'number', 'link', 'heading', 'quote', 'clear']
        });
        
        // Sync content to hidden field on any change
        notesElement.addEventListener('input', function() {
            document.getElementById('meetingNotes').value = notesEditor.getContent();
        });
    }

    // Initialize agenda notes editor
    const agendaElement = document.getElementById('agendaNotesEditor');
    if (agendaElement && !agendaNotesEditor) {
        agendaNotesEditor = new SimpleEditor('agendaNotesEditor', {
            placeholder: 'Discussion notes for this agenda item...',
            height: '100px',
            toolbar: ['bold', 'italic', 'bullet', 'clear']
        });
        
        // Sync content to hidden field on any change
        agendaElement.addEventListener('input', function() {
            document.getElementById('agendaItemNotes').value = agendaNotesEditor.getContent();
        });
    }
}

function initializeEventListeners() {
    // Main buttons
    document.getElementById('addMeetingBtn').addEventListener('click', showAddMeetingModal);
    document.getElementById('createFromTemplateBtn').addEventListener('click', showTemplateSelector);
    document.getElementById('exportBtn').addEventListener('click', exportMeetings);
    document.getElementById('importBtn').addEventListener('click', () => document.getElementById('importFile').click());
    document.getElementById('importFile').addEventListener('change', importMeetings);
    
    // Filters
    document.getElementById('searchInput').addEventListener('input', filterMeetings);
    document.getElementById('statusFilter').addEventListener('change', filterMeetings);
    document.getElementById('typeFilter').addEventListener('change', filterMeetings);
    document.getElementById('customerFilter').addEventListener('change', filterMeetings);
    document.getElementById('projectFilter').addEventListener('change', filterMeetings);
    document.getElementById('groupBy').addEventListener('change', renderMeetings);
    document.getElementById('sortBy').addEventListener('change', renderMeetings);
    
    // View toggles
    document.getElementById('gridViewBtn').addEventListener('click', () => switchView('grid'));
    document.getElementById('calendarViewBtn').addEventListener('click', () => switchView('calendar'));
    
    // Calendar navigation
    document.getElementById('prevMonthBtn').addEventListener('click', () => navigateMonth(-1));
    document.getElementById('nextMonthBtn').addEventListener('click', () => navigateMonth(1));
    document.getElementById('todayBtn').addEventListener('click', goToToday);
    
    // Form submissions
    document.getElementById('meetingForm').addEventListener('submit', saveMeeting);
    document.getElementById('agendaForm').addEventListener('submit', saveAgendaItem);
    document.getElementById('actionForm').addEventListener('submit', saveActionItem);
    document.getElementById('decisionForm').addEventListener('submit', saveDecision);
    
    // Modal controls
    document.getElementById('cancelBtn').addEventListener('click', closeModal);
    document.getElementById('copyMinutesBtn').addEventListener('click', copyMeetingMinutes);
    document.getElementById('expandNotesBtn').addEventListener('click', expandNotes);
    
    // Tab management
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            switchTab(this.dataset.tab);
        });
    });
    
    // Template application
    document.getElementById('applyTemplateBtn').addEventListener('click', applyTemplate);
    
    // Agenda management
    document.getElementById('addAgendaBtn').addEventListener('click', showAddAgendaModal);
    
    // Attendee management
    document.getElementById('addAttendeeBtn').addEventListener('click', addAttendee);
    
    // Action items
    document.getElementById('addActionBtn').addEventListener('click', showAddActionModal);
    document.getElementById('convertActionsBtn').addEventListener('click', convertActionsToTasks);
    
    // Decisions
    document.getElementById('addDecisionBtn').addEventListener('click', showAddDecisionModal);
    
    // AI Assistant
    if (window.aiEnabled) {
        document.getElementById('generateSummaryBtn').addEventListener('click', generateSummary);
        document.getElementById('extractActionsBtn').addEventListener('click', extractActionItems);
        document.getElementById('generateMinutesBtn').addEventListener('click', generateMeetingMinutes);
    }
    
    // File upload
    setupFileUpload();
    
    // Modal close handlers
    document.querySelectorAll('.close, .cancel-agenda, .cancel-action, .cancel-decision').forEach(btn => {
        btn.addEventListener('click', function() {
            this.closest('.modal').style.display = 'none';
        });
    });
    
    // Initialize drag and drop for agenda
    initializeDragAndDrop();
}

function initializeDragAndDrop() {
    const agendaList = document.getElementById('agendaList');
    if (agendaList && typeof Sortable !== 'undefined') {
        agendaSortable = Sortable.create(agendaList, {
            handle: '.agenda-item',
            animation: 150,
            onEnd: function(evt) {
                updateAgendaOrder();
            }
        });
    }
}

async function loadConfig() {
    try {
        const response = await fetch('/api/config');
        config = await response.json();
    } catch (error) {
        console.error('Error loading config:', error);
        config = {};
    }
}

async function loadTemplates() {
    try {
        const response = await fetch('/api/meeting-templates');
        if (response.ok) {
            const data = await response.json();
            templates = { ...defaultTemplates, ...data };
        } else {
            templates = defaultTemplates;
        }
        populateTemplateDropdown();
    } catch (error) {
        console.error('Error loading templates:', error);
        templates = defaultTemplates;
        populateTemplateDropdown();
    }
}

async function loadTeamMembers() {
    try {
        const response = await fetch('/api/team-members');
        if (response.ok) {
            teamMembers = await response.json();
        } else {
            teamMembers = [];
        }
        populateAttendeeDatalist();
    } catch (error) {
        console.error('Error loading team members:', error);
        teamMembers = [];
    }
}

async function loadMeetings() {
    try {
        const response = await fetch('/api/meetings');
        if (response.ok) {
            allMeetings = await response.json();
            populateFilterDropdowns();
            renderMeetings();
            updateCalendar();
        } else {
            console.error('Failed to load meetings');
            allMeetings = [];
        }
    } catch (error) {
        console.error('Error loading meetings:', error);
        allMeetings = [];
    }
}

function populateFilterDropdowns() {
    // Get unique customers and projects
    const customers = new Set();
    const projects = new Set();
    
    allMeetings.forEach(meeting => {
        if (meeting.customerName) customers.add(meeting.customerName);
        if (meeting.projectName) projects.add(meeting.projectName);
    });
    
    // Populate customer filter
    const customerFilter = document.getElementById('customerFilter');
    if (customerFilter) {
        const currentValue = customerFilter.value;
        customerFilter.innerHTML = '<option value="">All Customers</option>';
        Array.from(customers).sort().forEach(customer => {
            customerFilter.innerHTML += `<option value="${escapeHtml(customer)}">${escapeHtml(customer)}</option>`;
        });
        customerFilter.value = currentValue; // Preserve selection
    }
    
    // Populate project filter
    const projectFilter = document.getElementById('projectFilter');
    if (projectFilter) {
        const currentValue = projectFilter.value;
        projectFilter.innerHTML = '<option value="">All Projects</option>';
        Array.from(projects).sort().forEach(project => {
            projectFilter.innerHTML += `<option value="${escapeHtml(project)}">${escapeHtml(project)}</option>`;
        });
        projectFilter.value = currentValue; // Preserve selection
    }
}

function populateTemplateDropdown() {
    const select = document.getElementById('templateSelect');
    select.innerHTML = '<option value="">-- Select Template --</option>';
    
    Object.keys(templates).forEach(key => {
        const option = document.createElement('option');
        option.value = key;
        option.textContent = templates[key].name;
        select.appendChild(option);
    });
}

function populateAttendeeDatalist() {
    const datalist = document.getElementById('assigneeList');
    datalist.innerHTML = '';
    
    teamMembers.forEach(member => {
        const option = document.createElement('option');
        option.value = member.name;
        datalist.appendChild(option);
    });
}

function switchView(view) {
    currentView = view;
    
    // Update button states
    document.getElementById('gridViewBtn').classList.toggle('active', view === 'grid');
    document.getElementById('calendarViewBtn').classList.toggle('active', view === 'calendar');
    
    // Show/hide views
    document.getElementById('meetingsGrid').style.display = view === 'grid' ? 'grid' : 'none';
    document.getElementById('calendarView').style.display = view === 'calendar' ? 'block' : 'none';
    
    if (view === 'calendar') {
        updateCalendar();
    }
}

function renderMeetings() {
    const container = document.getElementById('meetingsGrid');
    const filtered = getFilteredMeetings();
    const sorted = sortMeetings(filtered);
    
    if (sorted.length === 0) {
        container.innerHTML = '<div class="empty-state"><h3>No meetings found</h3><p>Create your first meeting or adjust your filters.</p></div>';
        return;
    }
    
    // Check if grouping is enabled
    const groupBy = document.getElementById('groupBy')?.value || '';
    
    if (groupBy) {
        // Group meetings
        const groups = {};
        sorted.forEach(meeting => {
            let groupKey = '';
            switch (groupBy) {
                case 'customer':
                    groupKey = meeting.customerName || 'No Customer';
                    break;
                case 'project':
                    groupKey = meeting.projectName || 'No Project';
                    break;
                case 'status':
                    groupKey = meeting.status || 'No Status';
                    break;
                case 'date':
                    groupKey = meeting.date || 'No Date';
                    break;
                default:
                    groupKey = 'All';
            }
            
            if (!groups[groupKey]) {
                groups[groupKey] = [];
            }
            groups[groupKey].push(meeting);
        });
        
        // Render grouped meetings
        container.innerHTML = Object.entries(groups)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([groupName, meetings]) => `
                <div class="meeting-group">
                    <h3 class="group-header">${escapeHtml(groupName)} (${meetings.length})</h3>
                    <div class="meeting-grid">
                        ${meetings.map(meeting => renderMeetingCard(meeting)).join('')}
                    </div>
                </div>
            `).join('');
    } else {
        // Render ungrouped meetings
        container.innerHTML = sorted.map(meeting => renderMeetingCard(meeting)).join('');
    }
}

function renderMeetingCard(meeting) {
    return `
        <div class="meeting-card ${(meeting.status || '').toLowerCase()}" onclick="editMeeting('${meeting.id}')">
            <div class="meeting-title">${escapeHtml(meeting.title)}</div>
            <div class="meeting-meta">
                ${meeting.customerName ? `<div>🏢 ${escapeHtml(meeting.customerName)}</div>` : ''}
                ${meeting.projectName ? `<div>📁 ${escapeHtml(meeting.projectName)}</div>` : ''}
                <div class="meeting-date">
                    <span>📅 ${formatDateTime(meeting.date, meeting.time)}</span>
                </div>
                <div class="meeting-attendees">
                    <span>👥 ${meeting.attendees ? meeting.attendees.length : 0} attendees</span>
                </div>
                <div>📍 ${escapeHtml(meeting.location || 'No location')}</div>
            </div>
            <div class="meeting-status">
                <span class="status-${(meeting.status || '').toLowerCase()}">${formatStatus(meeting.status)}</span>
            </div>
        </div>
    `;
}

function getFilteredMeetings() {
    const searchTerm = document.getElementById('searchInput')?.value?.toLowerCase() || '';
    const statusFilter = document.getElementById('statusFilter')?.value || '';
    const typeFilter = document.getElementById('typeFilter')?.value || '';
    const customerFilter = document.getElementById('customerFilter')?.value || '';
    const projectFilter = document.getElementById('projectFilter')?.value || '';
    
    return allMeetings.filter(meeting => {
        const matchesSearch = !searchTerm || 
            meeting.title?.toLowerCase().includes(searchTerm) ||
            (meeting.location && meeting.location.toLowerCase().includes(searchTerm)) ||
            (meeting.customerName && meeting.customerName.toLowerCase().includes(searchTerm)) ||
            (meeting.projectName && meeting.projectName.toLowerCase().includes(searchTerm)) ||
            (meeting.tags && Array.isArray(meeting.tags) && meeting.tags.some(tag => tag.toLowerCase().includes(searchTerm)));
        
        const matchesStatus = !statusFilter || meeting.status === statusFilter;
        const matchesType = !typeFilter || meeting.type === typeFilter;
        const matchesCustomer = !customerFilter || meeting.customerName === customerFilter;
        const matchesProject = !projectFilter || meeting.projectName === projectFilter;
        
        return matchesSearch && matchesStatus && matchesType && matchesCustomer && matchesProject;
    });
}

function sortMeetings(meetings) {
    const sortBy = document.getElementById('sortBy')?.value || 'date';
    
    return meetings.sort((a, b) => {
        switch (sortBy) {
            case 'title':
                return (a.title || '').localeCompare(b.title || '');
            case 'status':
                return (a.status || '').localeCompare(b.status || '');
            case 'customer':
                return (a.customerName || '').localeCompare(b.customerName || '');
            case 'project':
                return (a.projectName || '').localeCompare(b.projectName || '');
            case 'attendees':
                return (b.attendees?.length || 0) - (a.attendees?.length || 0);
            case 'date':
            default:
                // Handle both ISO format and separate date/time fields
                let dateA, dateB;
                if (a.date && a.date.includes('T')) {
                    dateA = new Date(a.date);
                } else {
                    dateA = new Date(a.date + 'T' + (a.time || '00:00'));
                }
                if (b.date && b.date.includes('T')) {
                    dateB = new Date(b.date);
                } else {
                    dateB = new Date(b.date + 'T' + (b.time || '00:00'));
                }
                return dateB - dateA; // Most recent first
        }
    });
}

function filterMeetings() {
    renderMeetings();
    if (currentView === 'calendar') {
        updateCalendar();
    }
}

function renderCalendar() {
    const grid = document.getElementById('calendarGrid');
    const title = document.getElementById('calendarTitle');
    
    // Set title
    const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    title.textContent = `${monthNames[currentMonth]} ${currentYear}`;
    
    // Get first day of month and days in month
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();
    
    // Generate calendar grid
    let html = '';
    const dayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    dayHeaders.forEach(day => {
        html += `<div class="calendar-day calendar-header">${day}</div>`;
    });
    
    // Previous month's trailing days
    const prevMonth = new Date(currentYear, currentMonth - 1, 0);
    for (let i = startingDay - 1; i >= 0; i--) {
        const day = prevMonth.getDate() - i;
        html += `<div class="calendar-day other-month">${day}</div>`;
    }
    
    // Current month's days
    const today = new Date();
    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(currentYear, currentMonth, day);
        const isToday = date.toDateString() === today.toDateString();
        const dayMeetings = getMeetingsForDate(date);
        
        html += `<div class="calendar-day ${isToday ? 'today' : ''}">
            <div class="day-number">${day}</div>
            ${dayMeetings.map(meeting => 
                `<div class="calendar-meeting" onclick="editMeeting('${meeting.id}')">${escapeHtml(meeting.title)}</div>`
            ).join('')}
        </div>`;
    }
    
    // Next month's leading days
    const totalCells = Math.ceil((startingDay + daysInMonth) / 7) * 7;
    const remainingCells = totalCells - (startingDay + daysInMonth);
    for (let day = 1; day <= remainingCells; day++) {
        html += `<div class="calendar-day other-month">${day}</div>`;
    }
    
    grid.innerHTML = html;
}

function getMeetingsForDate(date) {
    const dateStr = date.toISOString().split('T')[0];
    return getFilteredMeetings().filter(meeting => meeting.date === dateStr);
}

function updateCalendar() {
    if (currentView === 'calendar') {
        renderCalendar();
    }
}

function navigateMonth(direction) {
    currentMonth += direction;
    if (currentMonth < 0) {
        currentMonth = 11;
        currentYear--;
    } else if (currentMonth > 11) {
        currentMonth = 0;
        currentYear++;
    }
    renderCalendar();
}

function goToToday() {
    const today = new Date();
    currentMonth = today.getMonth();
    currentYear = today.getFullYear();
    renderCalendar();
}

function showAddMeetingModal() {
    currentMeeting = null;
    document.getElementById('modalTitle').textContent = 'New Meeting';
    resetForm();
    document.getElementById('meetingModal').style.display = 'block';
    
    // Set default date and time
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    document.getElementById('meetingDate').value = tomorrow.toISOString().split('T')[0];
    document.getElementById('meetingTime').value = '09:00';
    
    // Force switch to details tab after modal is visible
    setTimeout(() => {
        switchTab('details');
        // Quill toolbar fix no longer needed
    }, 50);
}

function editMeeting(meetingId) {
    const meeting = allMeetings.find(m => m.id === meetingId);
    if (!meeting) return;
    
    currentMeeting = meeting;
    document.getElementById('modalTitle').textContent = 'Edit Meeting';
    populateForm(meeting);
    document.getElementById('meetingModal').style.display = 'block';
    
    // Force switch to details tab after modal is visible
    setTimeout(() => {
        switchTab('details');
        // Quill toolbar fix no longer needed
    }, 50);
}

function resetForm() {
    document.getElementById('meetingForm').reset();
    document.getElementById('meetingId').value = '';
    
    if (objectiveEditor) objectiveEditor.clear();
    if (notesEditor) notesEditor.clear();
    
    // Reset tabs
    document.getElementById('agendaList').innerHTML = '';
    document.getElementById('attendeesList').innerHTML = '';
    document.getElementById('actionsList').innerHTML = '';
    document.getElementById('decisionsList').innerHTML = '';
    document.getElementById('attachmentsList').innerHTML = '';
    
    updateTabCounts();
}

function populateForm(meeting) {
    document.getElementById('meetingId').value = meeting.id;
    document.getElementById('meetingTitle').value = meeting.title || '';
    document.getElementById('meetingType').value = meeting.type || 'team';
    document.getElementById('meetingStatus').value = meeting.status || 'upcoming';
    document.getElementById('meetingDate').value = meeting.date || '';
    document.getElementById('meetingTime').value = meeting.time || '';
    document.getElementById('meetingDuration').value = meeting.duration || 60;
    document.getElementById('meetingLocation').value = meeting.location || '';
    document.getElementById('customerName').value = meeting.customerName || '';
    document.getElementById('projectName').value = meeting.projectName || '';
    document.getElementById('meetingTags').value = meeting.tags ? meeting.tags.join(', ') : '';
    
    if (objectiveEditor && meeting.objective) {
        objectiveEditor.setContent(meeting.objective);
        document.getElementById('meetingObjective').value = meeting.objective;
    }
    
    if (notesEditor && meeting.notes) {
        notesEditor.setContent(meeting.notes);
        document.getElementById('meetingNotes').value = meeting.notes;
    }
    
    // Populate agenda
    renderAgenda(meeting.agenda || []);
    
    // Populate attendees
    renderAttendees(meeting.attendees || []);
    
    // Populate action items
    renderActionItems(meeting.actionItems || []);
    
    // Populate decisions
    renderDecisions(meeting.decisions || []);
    
    // Populate attachments
    renderAttachments(meeting.attachments || []);
    
    updateTabCounts();
}

function switchTab(tabName) {
    // console.log('Switching to tab:', tabName);
    
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    
    // Update tab panels
    document.querySelectorAll('.tab-panel').forEach(panel => {
        // Handle both formats: with and without 'Tab' suffix
        const panelId = panel.id.replace('Tab', '');
        const shouldBeActive = panelId === tabName;
        // console.log(`Panel ${panel.id}: panelId=${panelId}, tabName=${tabName}, active=${shouldBeActive}`);
        
        panel.classList.toggle('active', shouldBeActive);
        
        // Force display style as backup
        if (shouldBeActive) {
            panel.style.display = 'block';
        } else {
            panel.style.display = 'none';
        }
    });
}

async function saveMeeting(event) {
    event.preventDefault();
    
    // Validate required fields and switch to the correct tab if needed
    const requiredFields = [
        { id: 'meetingTitle', tab: 'details', message: 'Meeting title is required' },
        { id: 'meetingDate', tab: 'details', message: 'Meeting date is required' },
        { id: 'meetingTime', tab: 'details', message: 'Meeting time is required' }
    ];
    
    for (const field of requiredFields) {
        const element = document.getElementById(field.id);
        if (element && !element.value) {
            // Switch to the tab containing the invalid field
            switchTab(field.tab);
            // Focus the field after a short delay to ensure the tab is visible
            setTimeout(() => {
                element.focus();
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);
            showNotification(field.message, 'error');
            return; // Stop form submission
        }
    }
    
    const formData = new FormData(event.target);
    const meetingData = {
        id: currentMeeting?.id || generateId(),
        title: formData.get('meetingTitle') || document.getElementById('meetingTitle').value,
        type: formData.get('meetingType') || document.getElementById('meetingType').value,
        status: formData.get('meetingStatus') || document.getElementById('meetingStatus').value,
        date: formData.get('meetingDate') || document.getElementById('meetingDate').value,
        time: formData.get('meetingTime') || document.getElementById('meetingTime').value,
        duration: parseInt(formData.get('meetingDuration') || document.getElementById('meetingDuration').value),
        location: formData.get('meetingLocation') || document.getElementById('meetingLocation').value,
        customerName: formData.get('customerName') || document.getElementById('customerName').value || '',
        projectName: formData.get('projectName') || document.getElementById('projectName').value || '',
        objective: document.getElementById('meetingObjective').value,
        notes: document.getElementById('meetingNotes').value,
        tags: (formData.get('meetingTags') || document.getElementById('meetingTags').value).split(',').map(s => s.trim()).filter(s => s),
        agenda: currentMeeting?.agenda || [],
        attendees: currentMeeting?.attendees || [],
        actionItems: currentMeeting?.actionItems || [],
        decisions: currentMeeting?.decisions || [],
        attachments: currentMeeting?.attachments || [],
        createdAt: currentMeeting?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    
    try {
        const url = currentMeeting ? `/api/meetings/${currentMeeting.id}` : '/api/meetings';
        const method = currentMeeting ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(meetingData)
        });
        
        if (response.ok) {
            const savedMeeting = await response.json();
            
            if (currentMeeting) {
                const index = allMeetings.findIndex(m => m.id === currentMeeting.id);
                allMeetings[index] = savedMeeting;
            } else {
                allMeetings.push(savedMeeting);
            }
            
            showNotification('Meeting saved successfully!', 'success');
            closeModal();
            renderMeetings();
            updateCalendar();
        } else {
            throw new Error('Failed to save meeting');
        }
    } catch (error) {
        console.error('Error saving meeting:', error);
        showNotification('Error saving meeting. Please try again.', 'error');
    }
}

function closeModal() {
    document.getElementById('meetingModal').style.display = 'none';
    currentMeeting = null;
}

// Agenda Management
function renderAgenda(agenda) {
    const container = document.getElementById('agendaList');
    container.innerHTML = agenda.map((item, index) => `
        <div class="agenda-item" data-index="${index}">
            <div class="agenda-header">
                <div class="agenda-title">${escapeHtml(item.title)}</div>
                ${item.time ? `<div class="agenda-time">${item.time} min</div>` : ''}
            </div>
            ${item.presenter ? `<div class="agenda-presenter">Presenter: ${escapeHtml(item.presenter)}</div>` : ''}
            ${item.notes ? `<div class="agenda-notes">${item.notes}</div>` : ''}
            <div class="agenda-actions">
                <button onclick="editAgendaItem(${index})" class="btn btn-small">Edit</button>
                <button onclick="deleteAgendaItem(${index})" class="btn btn-small btn-danger">Delete</button>
            </div>
        </div>
    `).join('');
    
    updateTimeAllocation(agenda);
}

function updateTimeAllocation(agenda) {
    const totalTime = agenda.reduce((sum, item) => sum + (item.time || 0), 0);
    const meetingDuration = parseInt(document.getElementById('meetingDuration').value) || 60;
    
    document.getElementById('totalAllocatedTime').textContent = totalTime;
    
    const progressBar = document.getElementById('timeProgressBar');
    const percentage = (totalTime / meetingDuration) * 100;
    progressBar.style.width = Math.min(percentage, 100) + '%';
    progressBar.classList.toggle('over-time', percentage > 100);
}

function showAddAgendaModal() {
    resetAgendaForm();
    document.getElementById('agendaModalTitle').textContent = 'Add Agenda Item';
    document.getElementById('agendaModal').style.display = 'block';
}

function editAgendaItem(index) {
    const agenda = currentMeeting?.agenda || [];
    const item = agenda[index];
    if (!item) return;
    
    document.getElementById('agendaItemId').value = index;
    document.getElementById('agendaItemTitle').value = item.title || '';
    document.getElementById('agendaItemTime').value = item.time || '';
    document.getElementById('agendaItemPresenter').value = item.presenter || '';
    
    if (agendaNotesEditor) {
        agendaNotesEditor.setContent(item.notes || '');
        document.getElementById('agendaItemNotes').value = item.notes || '';
    }
    
    document.getElementById('agendaModalTitle').textContent = 'Edit Agenda Item';
    document.getElementById('agendaModal').style.display = 'block';
}

function deleteAgendaItem(index) {
    if (!currentMeeting) currentMeeting = { agenda: [] };
    if (!currentMeeting.agenda) currentMeeting.agenda = [];
    
    if (confirm('Are you sure you want to delete this agenda item?')) {
        currentMeeting.agenda.splice(index, 1);
        renderAgenda(currentMeeting.agenda);
        updateTabCounts();
    }
}

function resetAgendaForm() {
    document.getElementById('agendaForm').reset();
    document.getElementById('agendaItemId').value = '';
    if (agendaNotesEditor) {
        agendaNotesEditor.clear();
    }
}

function saveAgendaItem(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const timeValue = formData.get('agendaItemTime') || document.getElementById('agendaItemTime').value;
    const agendaItem = {
        title: formData.get('agendaItemTitle') || document.getElementById('agendaItemTitle').value,
        time: timeValue ? parseInt(timeValue) : null,
        presenter: formData.get('agendaItemPresenter') || document.getElementById('agendaItemPresenter').value,
        notes: document.getElementById('agendaItemNotes').value
    };
    
    if (!currentMeeting) currentMeeting = { agenda: [] };
    if (!currentMeeting.agenda) currentMeeting.agenda = [];
    
    const itemId = document.getElementById('agendaItemId').value;
    if (itemId !== '') {
        // Edit existing
        currentMeeting.agenda[parseInt(itemId)] = agendaItem;
    } else {
        // Add new
        currentMeeting.agenda.push(agendaItem);
    }
    
    renderAgenda(currentMeeting.agenda);
    updateTabCounts();
    document.getElementById('agendaModal').style.display = 'none';
}

function updateAgendaOrder() {
    const items = document.querySelectorAll('.agenda-item');
    const newOrder = [];
    
    items.forEach((item, index) => {
        const oldIndex = parseInt(item.dataset.index);
        if (currentMeeting?.agenda?.[oldIndex]) {
            newOrder.push(currentMeeting.agenda[oldIndex]);
        }
    });
    
    if (currentMeeting) {
        currentMeeting.agenda = newOrder;
    }
}

// Attendee Management
function renderAttendees(attendees) {
    const container = document.getElementById('attendeesList');
    container.innerHTML = attendees.map((attendee, index) => `
        <div class="attendee-item">
            <div class="attendee-info">
                <div class="attendee-name">${escapeHtml(attendee.name)}</div>
                <div class="attendee-role">${escapeHtml(attendee.role)}</div>
                ${attendee.email ? `<div class="attendee-email">${escapeHtml(attendee.email)}</div>` : ''}
            </div>
            <div class="attendee-status">
                <select onchange="updateAttendeeStatus(${index}, this.value)" class="attendance-select">
                    <option value="pending" ${attendee.status === 'pending' ? 'selected' : ''}>Pending</option>
                    <option value="attended" ${attendee.status === 'attended' ? 'selected' : ''}>Attended</option>
                    <option value="absent" ${attendee.status === 'absent' ? 'selected' : ''}>Absent</option>
                    <option value="tentative" ${attendee.status === 'tentative' ? 'selected' : ''}>Tentative</option>
                </select>
                <button onclick="deleteAttendee(${index})" class="btn btn-small btn-danger">Remove</button>
            </div>
        </div>
    `).join('');
}

function addAttendee() {
    const name = document.getElementById('newAttendeeName').value.trim();
    const email = document.getElementById('newAttendeeEmail').value.trim();
    const role = document.getElementById('newAttendeeRole').value;
    
    if (!name) {
        showNotification('Please enter attendee name', 'error');
        return;
    }
    
    const attendee = {
        name: name,
        email: email,
        role: role,
        status: 'pending'
    };
    
    if (!currentMeeting) currentMeeting = { attendees: [] };
    if (!currentMeeting.attendees) currentMeeting.attendees = [];
    
    currentMeeting.attendees.push(attendee);
    renderAttendees(currentMeeting.attendees);
    updateTabCounts();
    
    // Clear form
    document.getElementById('newAttendeeName').value = '';
    document.getElementById('newAttendeeEmail').value = '';
    document.getElementById('newAttendeeRole').value = 'participant';
}

function updateAttendeeStatus(index, status) {
    if (currentMeeting?.attendees?.[index]) {
        currentMeeting.attendees[index].status = status;
    }
}

function deleteAttendee(index) {
    if (!currentMeeting?.attendees) return;
    
    if (confirm('Remove this attendee from the meeting?')) {
        currentMeeting.attendees.splice(index, 1);
        renderAttendees(currentMeeting.attendees);
        updateTabCounts();
    }
}

// Action Items Management
function renderActionItems(actionItems) {
    const container = document.getElementById('actionsList');
    container.innerHTML = actionItems.map((item, index) => {
        const dueDate = new Date(item.dueDate);
        const today = new Date();
        const isOverdue = dueDate < today && item.status !== 'completed';
        const isDueSoon = dueDate <= new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000) && item.status !== 'completed';
        
        return `
            <div class="action-item ${isOverdue ? 'overdue' : isDueSoon ? 'due-soon' : ''}">
                <div class="action-header">
                    <div class="action-title">${escapeHtml(item.title)}</div>
                    <div class="action-status action-${item.status}">${formatActionStatus(item.status)}</div>
                </div>
                ${item.description ? `<div class="action-description">${escapeHtml(item.description)}</div>` : ''}
                <div class="action-assignee">Assigned to: ${escapeHtml(item.assignee || 'Unassigned')}</div>
                ${item.dueDate ? `<div class="action-due">Due: ${formatDate(item.dueDate)}</div>` : ''}
                <div class="action-actions">
                    <button onclick="editActionItem(${index})" class="btn btn-small">Edit</button>
                    <button onclick="convertActionToTask(${index})" class="btn btn-small btn-info">Convert to Task</button>
                    <button onclick="deleteActionItem(${index})" class="btn btn-small btn-danger">Delete</button>
                </div>
            </div>
        `;
    }).join('');
}

function showAddActionModal() {
    resetActionForm();
    document.getElementById('actionModalTitle').textContent = 'Add Action Item';
    document.getElementById('actionModal').style.display = 'block';
}

window.editActionItem = function(index) {
    const actionItems = currentMeeting?.actionItems || [];
    const item = actionItems[index];
    if (!item) return;
    
    document.getElementById('actionItemId').value = index;
    document.getElementById('actionItemTitle').value = item.title || '';
    document.getElementById('actionItemDescription').value = item.description || '';
    document.getElementById('actionItemAssignee').value = item.assignee || '';
    document.getElementById('actionItemDue').value = item.dueDate || '';
    document.getElementById('actionItemStatus').value = item.status || 'pending';
    
    document.getElementById('actionModalTitle').textContent = 'Edit Action Item';
    document.getElementById('actionModal').style.display = 'block';
}

window.deleteActionItem = function(index) {
    if (!currentMeeting) currentMeeting = { actionItems: [] };
    if (!currentMeeting.actionItems) currentMeeting.actionItems = [];
    
    if (confirm('Are you sure you want to delete this action item?')) {
        currentMeeting.actionItems.splice(index, 1);
        renderActionItems(currentMeeting.actionItems);
        updateTabCounts();
    }
}

function resetActionForm() {
    document.getElementById('actionForm').reset();
    document.getElementById('actionItemId').value = '';
}

function saveActionItem(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const actionItem = {
        title: formData.get('actionItemTitle') || document.getElementById('actionItemTitle').value,
        description: formData.get('actionItemDescription') || document.getElementById('actionItemDescription').value,
        assignee: formData.get('actionItemAssignee') || document.getElementById('actionItemAssignee').value,
        dueDate: formData.get('actionItemDue') || document.getElementById('actionItemDue').value,
        status: formData.get('actionItemStatus') || document.getElementById('actionItemStatus').value,
        createdAt: new Date().toISOString()
    };
    
    if (!currentMeeting) currentMeeting = { actionItems: [] };
    if (!currentMeeting.actionItems) currentMeeting.actionItems = [];
    
    const itemId = document.getElementById('actionItemId').value;
    if (itemId !== '') {
        // Edit existing
        actionItem.createdAt = currentMeeting.actionItems[parseInt(itemId)].createdAt;
        currentMeeting.actionItems[parseInt(itemId)] = actionItem;
    } else {
        // Add new
        currentMeeting.actionItems.push(actionItem);
    }
    
    renderActionItems(currentMeeting.actionItems);
    updateTabCounts();
    document.getElementById('actionModal').style.display = 'none';
}

window.convertActionToTask = async function(index) {
    const actionItem = currentMeeting?.actionItems?.[index];
    if (!actionItem) return;
    
    try {
        const taskData = {
            title: actionItem.title,
            description: actionItem.description || '',
            assignedTo: actionItem.assignee || '',
            followUpDate: actionItem.dueDate || '',
            category: 'Meeting Action',
            priority: 'Medium',
            status: actionItem.status === 'completed' ? 'Completed' : 'In Progress',
            tags: ['meeting-action']
        };
        
        const response = await fetch('/api/tasks', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(taskData)
        });
        
        if (response.ok) {
            showNotification('Action item converted to task successfully!', 'success');
            actionItem.convertedToTask = true;
            renderActionItems(currentMeeting.actionItems);
        } else {
            throw new Error('Failed to create task');
        }
    } catch (error) {
        console.error('Error converting action to task:', error);
        showNotification('Error converting action to task. Please try again.', 'error');
    }
}

async function convertActionsToTasks() {
    if (!currentMeeting?.actionItems?.length) {
        showNotification('No action items to convert', 'warning');
        return;
    }
    
    const unconverted = currentMeeting.actionItems.filter(item => !item.convertedToTask);
    if (unconverted.length === 0) {
        showNotification('All action items have already been converted', 'info');
        return;
    }
    
    if (!confirm(`Convert ${unconverted.length} action item(s) to tasks?`)) return;
    
    try {
        const promises = unconverted.map(item => {
            const taskData = {
                title: item.title,
                description: item.description || '',
                assignedTo: item.assignee || '',
                followUpDate: item.dueDate || '',
                category: 'Meeting Action',
                priority: 'Medium',
                status: item.status === 'completed' ? 'Completed' : 'In Progress',
                tags: ['meeting-action']
            };
            
            return fetch('/api/tasks', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(taskData)
            });
        });
        
        const results = await Promise.all(promises);
        const successful = results.filter(r => r.ok).length;
        
        if (successful > 0) {
            // Mark as converted
            unconverted.forEach(item => item.convertedToTask = true);
            renderActionItems(currentMeeting.actionItems);
            showNotification(`Successfully converted ${successful} action item(s) to tasks!`, 'success');
        }
        
        if (successful < unconverted.length) {
            showNotification(`${unconverted.length - successful} conversions failed`, 'warning');
        }
    } catch (error) {
        console.error('Error converting actions to tasks:', error);
        showNotification('Error converting actions to tasks', 'error');
    }
}

// Decision Management
function renderDecisions(decisions) {
    const container = document.getElementById('decisionsList');
    container.innerHTML = decisions.map((decision, index) => `
        <div class="decision-item">
            <div class="decision-title">${escapeHtml(decision.title)}</div>
            <div class="decision-outcome">${escapeHtml(decision.outcome)}</div>
            <div class="decision-votes">
                <div class="vote-count">👍 ${decision.votesFor || 0} For</div>
                <div class="vote-count">👎 ${decision.votesAgainst || 0} Against</div>
                <div class="vote-count">🤷 ${decision.abstentions || 0} Abstentions</div>
            </div>
            <div class="decision-actions">
                <button onclick="editDecision(${index})" class="btn btn-small">Edit</button>
                <button onclick="deleteDecision(${index})" class="btn btn-small btn-danger">Delete</button>
            </div>
        </div>
    `).join('');
}

function showAddDecisionModal() {
    resetDecisionForm();
    document.getElementById('decisionModalTitle').textContent = 'Add Decision';
    document.getElementById('decisionModal').style.display = 'block';
}

function editDecision(index) {
    const decisions = currentMeeting?.decisions || [];
    const decision = decisions[index];
    if (!decision) return;
    
    document.getElementById('decisionItemId').value = index;
    document.getElementById('decisionTitle').value = decision.title || '';
    document.getElementById('decisionOutcome').value = decision.outcome || '';
    document.getElementById('decisionVotesFor').value = decision.votesFor || 0;
    document.getElementById('decisionVotesAgainst').value = decision.votesAgainst || 0;
    document.getElementById('decisionAbstentions').value = decision.abstentions || 0;
    
    document.getElementById('decisionModalTitle').textContent = 'Edit Decision';
    document.getElementById('decisionModal').style.display = 'block';
}

function deleteDecision(index) {
    if (!currentMeeting) currentMeeting = { decisions: [] };
    if (!currentMeeting.decisions) currentMeeting.decisions = [];
    
    if (confirm('Are you sure you want to delete this decision?')) {
        currentMeeting.decisions.splice(index, 1);
        renderDecisions(currentMeeting.decisions);
        updateTabCounts();
    }
}

function resetDecisionForm() {
    document.getElementById('decisionForm').reset();
    document.getElementById('decisionItemId').value = '';
}

function saveDecision(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const decision = {
        title: formData.get('decisionTitle') || document.getElementById('decisionTitle').value,
        outcome: formData.get('decisionOutcome') || document.getElementById('decisionOutcome').value,
        votesFor: parseInt(formData.get('decisionVotesFor') || document.getElementById('decisionVotesFor').value) || 0,
        votesAgainst: parseInt(formData.get('decisionVotesAgainst') || document.getElementById('decisionVotesAgainst').value) || 0,
        abstentions: parseInt(formData.get('decisionAbstentions') || document.getElementById('decisionAbstentions').value) || 0,
        timestamp: new Date().toISOString()
    };
    
    if (!currentMeeting) currentMeeting = { decisions: [] };
    if (!currentMeeting.decisions) currentMeeting.decisions = [];
    
    const itemId = document.getElementById('decisionItemId').value;
    if (itemId !== '') {
        // Edit existing
        decision.timestamp = currentMeeting.decisions[parseInt(itemId)].timestamp;
        currentMeeting.decisions[parseInt(itemId)] = decision;
    } else {
        // Add new
        currentMeeting.decisions.push(decision);
    }
    
    renderDecisions(currentMeeting.decisions);
    updateTabCounts();
    document.getElementById('decisionModal').style.display = 'none';
}

// File Upload Management
function setupFileUpload() {
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('fileInput');
    
    uploadArea.addEventListener('click', () => fileInput.click());
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('drag-over');
    });
    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('drag-over');
    });
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('drag-over');
        handleFiles(e.dataTransfer.files);
    });
    
    fileInput.addEventListener('change', (e) => {
        handleFiles(e.target.files);
    });
}

async function handleFiles(files) {
    for (const file of files) {
        await uploadFile(file);
    }
}

async function uploadFile(file) {
    try {
        const formData = new FormData();
        formData.append('file', file);
        
        const meetingId = currentMeeting?.id || document.getElementById('meetingId')?.value;
        if (!meetingId) {
            showNotification('Please save the meeting before adding attachments', 'warning');
            return;
        }
        
        const response = await fetch(`/api/meetings/${meetingId}/attachments`, {
            method: 'POST',
            body: formData
        });
        
        if (response.ok) {
            const result = await response.json();
            
            if (!currentMeeting) currentMeeting = { attachments: [] };
            if (!currentMeeting.attachments) currentMeeting.attachments = [];
            
            currentMeeting.attachments.push({
                id: result.id,
                filename: file.name,
                size: file.size,
                type: file.type,
                uploadedAt: new Date().toISOString()
            });
            
            renderAttachments(currentMeeting.attachments);
            updateTabCounts();
            showNotification(`File "${file.name}" uploaded successfully`, 'success');
        } else {
            throw new Error('Upload failed');
        }
    } catch (error) {
        console.error('Error uploading file:', error);
        showNotification(`Error uploading "${file.name}"`, 'error');
    }
}

function renderAttachments(attachments) {
    const container = document.getElementById('attachmentsList');
    const meetingId = currentMeeting?.id;
    
    container.innerHTML = attachments.map((attachment, index) => `
        <div class="attachment-item">
            <div class="attachment-info">
                <div class="attachment-name">${escapeHtml(attachment.filename)}</div>
                <div class="attachment-meta">${formatFileSize(attachment.size)} • ${formatDate(attachment.uploadedAt)}</div>
            </div>
            <div class="attachment-actions">
                ${meetingId && attachment.id ? `
                    <a href="/api/meetings/${meetingId}/attachments/${attachment.id}" 
                       class="btn btn-small" 
                       download="${attachment.filename}">Download</a>
                ` : ''}
                <button onclick="deleteAttachment(${index})" class="btn btn-small btn-danger">Delete</button>
            </div>
        </div>
    `).join('');
}

async function deleteAttachment(index) {
    if (!currentMeeting?.attachments) return;
    
    if (confirm('Delete this attachment?')) {
        const attachment = currentMeeting.attachments[index];
        const meetingId = currentMeeting.id;
        
        if (meetingId && attachment?.id) {
            try {
                const response = await fetch(`/api/meetings/${meetingId}/attachments/${attachment.id}`, {
                    method: 'DELETE'
                });
                
                if (response.ok) {
                    currentMeeting.attachments.splice(index, 1);
                    renderAttachments(currentMeeting.attachments);
                    updateTabCounts();
                    showNotification('Attachment deleted', 'success');
                } else {
                    throw new Error('Failed to delete attachment');
                }
            } catch (error) {
                console.error('Error deleting attachment:', error);
                showNotification('Error deleting attachment', 'error');
            }
        } else {
            // Just remove from local array if not saved yet
            currentMeeting.attachments.splice(index, 1);
            renderAttachments(currentMeeting.attachments);
            updateTabCounts();
        }
    }
}

// Template Management
function showTemplateSelector() {
    document.getElementById('templateSelector').style.display = 'block';
}

function applyTemplate() {
    const templateKey = document.getElementById('templateSelect').value;
    if (!templateKey || !templates[templateKey]) return;
    
    const template = templates[templateKey];
    
    // Apply template data
    document.getElementById('meetingTitle').value = template.name;
    
    if (template.agenda) {
        if (!currentMeeting) currentMeeting = {};
        currentMeeting.agenda = [...template.agenda];
        renderAgenda(currentMeeting.agenda);
        updateTabCounts();
    }
    
    // Switch to agenda tab
    switchTab('agenda');
    
    showNotification(`Template "${template.name}" applied successfully`, 'success');
    document.getElementById('templateSelector').style.display = 'none';
}

// AI Assistant Functions
async function generateSummary() {
    if (!window.aiEnabled) {
        showNotification('AI features require Claude API key', 'warning');
        return;
    }
    
    if (!currentMeeting) {
        showNotification('Please save the meeting first', 'warning');
        return;
    }
    
    try {
        const response = await fetch('/api/ai/meeting-summary', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                meetingData: currentMeeting
            })
        });
        
        if (response.ok) {
            const result = await response.json();
            displayAIOutput('Meeting Summary', result.summary);
        } else {
            throw new Error('Failed to generate summary');
        }
    } catch (error) {
        console.error('Error generating summary:', error);
        showNotification('Error generating summary. Please try again.', 'error');
    }
}

async function extractActionItems() {
    if (!window.aiEnabled) {
        showNotification('AI features require Claude API key', 'warning');
        return;
    }
    
    if (!currentMeeting?.notes) {
        showNotification('Please add meeting notes first', 'warning');
        return;
    }
    
    try {
        const response = await fetch('/api/ai/extract-actions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                meetingNotes: currentMeeting.notes,
                agenda: currentMeeting.agenda
            })
        });
        
        if (response.ok) {
            const result = await response.json();
            
            if (result.actionItems && result.actionItems.length > 0) {
                if (!currentMeeting.actionItems) currentMeeting.actionItems = [];
                currentMeeting.actionItems.push(...result.actionItems);
                renderActionItems(currentMeeting.actionItems);
                updateTabCounts();
                switchTab('actions');
                showNotification(`Extracted ${result.actionItems.length} action items`, 'success');
            } else {
                showNotification('No action items found in meeting notes', 'info');
            }
        } else {
            throw new Error('Failed to extract action items');
        }
    } catch (error) {
        console.error('Error extracting action items:', error);
        showNotification('Error extracting action items. Please try again.', 'error');
    }
}

async function generateMeetingMinutes() {
    if (!window.aiEnabled) {
        showNotification('AI features require Claude API key', 'warning');
        return;
    }
    
    if (!currentMeeting) {
        showNotification('Please save the meeting first', 'warning');
        return;
    }
    
    try {
        const response = await fetch('/api/ai/meeting-minutes', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                meetingData: currentMeeting
            })
        });
        
        if (response.ok) {
            const result = await response.json();
            displayAIOutput('Meeting Minutes', result.minutes);
        } else {
            throw new Error('Failed to generate minutes');
        }
    } catch (error) {
        console.error('Error generating minutes:', error);
        showNotification('Error generating minutes. Please try again.', 'error');
    }
}

function displayAIOutput(title, content) {
    const container = document.getElementById('aiOutput');
    container.innerHTML = `
        <div class="ai-result">
            <h4>${escapeHtml(title)}</h4>
            <div class="ai-content">${content}</div>
            <div class="ai-actions">
                <button onclick="copyAIContent()" class="btn btn-info">Copy to Clipboard</button>
            </div>
        </div>
    `;
}

function copyAIContent() {
    const content = document.querySelector('.ai-content');
    if (content) {
        navigator.clipboard.writeText(content.textContent).then(() => {
            showNotification('Content copied to clipboard', 'success');
        }).catch(err => {
            console.error('Failed to copy:', err);
            showNotification('Failed to copy content', 'error');
        });
    }
}

// Utility Functions
function updateTabCounts() {
    if (!currentMeeting) return;
    
    document.getElementById('agendaCount').textContent = currentMeeting.agenda?.length || '';
    document.getElementById('attendeeCount').textContent = currentMeeting.attendees?.length || '';
    document.getElementById('actionCount').textContent = currentMeeting.actionItems?.length || '';
    document.getElementById('decisionCount').textContent = currentMeeting.decisions?.length || '';
    document.getElementById('attachmentCount').textContent = currentMeeting.attachments?.length || '';
}

function generateId() {
    return 'meeting-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDateTime(date, time) {
    if (!date) return 'No date';
    
    // Handle ISO date format from API
    let d;
    if (date.includes('T')) {
        // Full ISO format like "2025-01-15T10:00:00Z"
        d = new Date(date);
    } else if (time) {
        // Separate date and time
        d = new Date(date + 'T' + time);
    } else {
        // Just date
        d = new Date(date);
    }
    
    if (isNaN(d.getTime())) return 'Invalid date';
    
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
}

function formatDate(dateString) {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString();
}

function formatStatus(status) {
    if (!status) return 'Unknown';
    
    // Handle both formats (lowercase and capitalized)
    const normalizedStatus = status.toLowerCase();
    const statusMap = {
        'upcoming': 'Upcoming',
        'in-progress': 'In Progress',
        'in progress': 'In Progress',
        'completed': 'Completed',
        'cancelled': 'Cancelled',
        'canceled': 'Cancelled',
        'standup': 'Standup'
    };
    return statusMap[normalizedStatus] || status;
}

function formatActionStatus(status) {
    const statusMap = {
        'pending': 'Pending',
        'in-progress': 'In Progress',
        'completed': 'Completed',
        'blocked': 'Blocked'
    };
    return statusMap[status] || status;
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

async function exportMeetings() {
    try {
        const dataStr = JSON.stringify(getFilteredMeetings(), null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `meetings-export-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        
        showNotification('Meetings exported successfully', 'success');
    } catch (error) {
        console.error('Error exporting meetings:', error);
        showNotification('Error exporting meetings', 'error');
    }
}

async function importMeetings(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    try {
        const text = await file.text();
        const importedMeetings = JSON.parse(text);
        
        if (!Array.isArray(importedMeetings)) {
            throw new Error('Invalid file format');
        }
        
        // Send to server
        const response = await fetch('/api/meetings/import', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ meetings: importedMeetings })
        });
        
        if (response.ok) {
            await loadMeetings();
            showNotification(`Successfully imported ${importedMeetings.length} meetings`, 'success');
        } else {
            throw new Error('Import failed');
        }
    } catch (error) {
        console.error('Error importing meetings:', error);
        showNotification('Error importing meetings. Please check file format.', 'error');
    }
    
    // Reset file input
    event.target.value = '';
}

// Notification function
function showNotification(message, type = 'info') {
    // Check if there's an enhanced notification function available (from enhanced_features.js)
    if (typeof window.enhancedFeatures !== 'undefined' && typeof window.enhancedFeatures.showNotification === 'function') {
        window.enhancedFeatures.showNotification(message, type);
    } else {
        // Simple notification implementation
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'};
            color: white;
            border-radius: 4px;
            z-index: 10000;
            animation: slideIn 0.3s ease;
        `;
        
        document.body.appendChild(notification);
        
        // Remove after 3 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
}

// Function to convert HTML to plain text
function htmlToText(html) {
    if (!html) return '';
    
    // Create a temporary div to parse HTML
    const temp = document.createElement('div');
    temp.innerHTML = html;
    
    // Replace common HTML elements with text equivalents
    temp.querySelectorAll('br').forEach(el => el.replaceWith('\n'));
    temp.querySelectorAll('p').forEach(el => el.replaceWith(el.textContent + '\n\n'));
    temp.querySelectorAll('li').forEach(el => el.replaceWith('• ' + el.textContent + '\n'));
    temp.querySelectorAll('h1').forEach(el => el.replaceWith('\n' + el.textContent.toUpperCase() + '\n' + '='.repeat(el.textContent.length) + '\n'));
    temp.querySelectorAll('h2').forEach(el => el.replaceWith('\n' + el.textContent + '\n' + '-'.repeat(el.textContent.length) + '\n'));
    temp.querySelectorAll('h3').forEach(el => el.replaceWith('\n### ' + el.textContent + '\n'));
    
    // Get the text content
    let text = temp.textContent || temp.innerText || '';
    
    // Clean up excessive whitespace
    text = text.replace(/\n{3,}/g, '\n\n').trim();
    
    return text;
}

// Copy meeting minutes to clipboard
async function copyMeetingMinutes() {
    if (!currentMeeting) {
        showNotification('No meeting to copy', 'warning');
        return;
    }
    
    try {
        // Generate formatted text version of meeting minutes
        let minutesText = '';
        
        // Header
        minutesText += '=' + '='.repeat(60) + '\n';
        minutesText += 'MEETING MINUTES\n';
        minutesText += '=' + '='.repeat(60) + '\n\n';
        
        // Basic Details
        minutesText += 'Meeting Title: ' + (currentMeeting.title || 'Untitled') + '\n';
        minutesText += 'Date: ' + formatDate(currentMeeting.date) + '\n';
        minutesText += 'Time: ' + (currentMeeting.time || 'Not specified') + '\n';
        minutesText += 'Duration: ' + (currentMeeting.duration || 'Not specified') + ' minutes\n';
        minutesText += 'Status: ' + (currentMeeting.status || 'Not specified') + '\n';
        minutesText += 'Location: ' + (currentMeeting.location || 'Not specified') + '\n';
        
        if (currentMeeting.customerName) {
            minutesText += 'Customer: ' + currentMeeting.customerName + '\n';
        }
        if (currentMeeting.projectName) {
            minutesText += 'Project: ' + currentMeeting.projectName + '\n';
        }
        
        minutesText += '\n';
        
        // Objective
        if (currentMeeting.objective) {
            minutesText += 'OBJECTIVE\n';
            minutesText += '-'.repeat(40) + '\n';
            minutesText += htmlToText(currentMeeting.objective) + '\n\n';
        }
        
        // Attendees
        if (currentMeeting.attendees && currentMeeting.attendees.length > 0) {
            minutesText += 'ATTENDEES\n';
            minutesText += '-'.repeat(40) + '\n';
            currentMeeting.attendees.forEach(attendee => {
                minutesText += '• ' + attendee.name;
                if (attendee.role) minutesText += ' (' + attendee.role + ')';
                if (attendee.email) minutesText += ' - ' + attendee.email;
                if (attendee.attended === false) minutesText += ' [ABSENT]';
                minutesText += '\n';
            });
            minutesText += '\n';
        }
        
        // Agenda
        if (currentMeeting.agenda && currentMeeting.agenda.length > 0) {
            minutesText += 'AGENDA\n';
            minutesText += '-'.repeat(40) + '\n';
            currentMeeting.agenda.forEach((item, index) => {
                minutesText += (index + 1) + '. ' + item.title;
                if (item.time) minutesText += ' (' + item.time + ' min)';
                minutesText += '\n';
                if (item.presenter) minutesText += '   Presenter: ' + item.presenter + '\n';
                if (item.notes) {
                    minutesText += '   Notes: ' + htmlToText(item.notes).replace(/\n/g, '\n   ') + '\n';
                }
            });
            minutesText += '\n';
        }
        
        // Action Items
        if (currentMeeting.actionItems && currentMeeting.actionItems.length > 0) {
            minutesText += 'ACTION ITEMS\n';
            minutesText += '-'.repeat(40) + '\n';
            currentMeeting.actionItems.forEach((item, index) => {
                minutesText += (index + 1) + '. ' + item.title + '\n';
                if (item.description) minutesText += '   Description: ' + item.description + '\n';
                if (item.assignee) minutesText += '   Assigned to: ' + item.assignee + '\n';
                if (item.dueDate) minutesText += '   Due date: ' + formatDate(item.dueDate) + '\n';
                minutesText += '   Status: ' + (item.status || 'pending') + '\n';
            });
            minutesText += '\n';
        }
        
        // Decisions
        if (currentMeeting.decisions && currentMeeting.decisions.length > 0) {
            minutesText += 'DECISIONS\n';
            minutesText += '-'.repeat(40) + '\n';
            currentMeeting.decisions.forEach((decision, index) => {
                minutesText += (index + 1) + '. ' + decision.decision + '\n';
                if (decision.rationale) minutesText += '   Rationale: ' + decision.rationale + '\n';
                if (decision.impact) minutesText += '   Impact: ' + decision.impact + '\n';
            });
            minutesText += '\n';
        }
        
        // Notes
        if (currentMeeting.notes) {
            minutesText += 'NOTES\n';
            minutesText += '-'.repeat(40) + '\n';
            minutesText += htmlToText(currentMeeting.notes) + '\n\n';
        }
        
        // Tags
        if (currentMeeting.tags && currentMeeting.tags.length > 0) {
            minutesText += 'Tags: ' + currentMeeting.tags.join(', ') + '\n';
        }
        
        // Footer
        minutesText += '\n' + '-'.repeat(60) + '\n';
        minutesText += 'Generated on: ' + new Date().toLocaleString() + '\n';
        
        // Copy to clipboard
        await navigator.clipboard.writeText(minutesText);
        showNotification('Meeting minutes copied to clipboard!', 'success');
        
    } catch (error) {
        console.error('Error copying meeting minutes:', error);
        showNotification('Failed to copy meeting minutes', 'error');
    }
}

// Expanded Notes Functions
function expandNotes() {
    // Initialize expanded editor if not already done
    const expandedElement = document.getElementById('expandedNotesEditor');
    if (expandedElement && !expandedNotesEditor) {
        expandedNotesEditor = new SimpleEditor('expandedNotesEditor', {
            placeholder: 'Meeting notes and discussion points...\n\nYou have plenty of space here to write detailed notes, action items, and observations.',
            height: '100%',
            toolbar: ['bold', 'italic', 'underline', 'strike', 'bullet', 'number', 'link', 'heading', 'quote', 'code', 'clear'],
            toolbarPosition: 'top'
        });
        
        // Force the editor to fill available space after initialization
        setTimeout(() => {
            const modal = document.getElementById('expandedNotesModal');
            const container = modal.querySelector('.expanded-notes-container');
            const body = modal.querySelector('.expanded-notes-body');
            const wrapper = expandedElement.querySelector('.simple-editor-wrapper');
            const editorContent = expandedElement.querySelector('.simple-editor-content');
            
            // Get the actual height of header and footer
            const header = modal.querySelector('.expanded-notes-header');
            const footer = modal.querySelector('.expanded-notes-footer');
            const headerHeight = header ? header.offsetHeight : 60;
            const footerHeight = footer ? footer.offsetHeight : 70;
            
            // Calculate available height for the body
            const totalHeight = window.innerHeight * 0.95; // 95vh
            const bodyHeight = totalHeight - headerHeight - footerHeight;
            
            if (body) {
                body.style.height = `${bodyHeight}px`;
            }
            
            if (wrapper) {
                wrapper.style.height = '100%';
                wrapper.style.display = 'flex';
                wrapper.style.flexDirection = 'column';
            }
            
            if (editorContent) {
                // Get toolbar height
                const toolbar = expandedElement.querySelector('.simple-editor-toolbar');
                const toolbarHeight = toolbar ? toolbar.offsetHeight : 50;
                
                // Set the content height to fill remaining space
                const contentHeight = bodyHeight - toolbarHeight - 20; // 20px for some padding
                editorContent.style.height = `${contentHeight}px`;
                editorContent.style.minHeight = `${contentHeight}px`;
                editorContent.style.maxHeight = `${contentHeight}px`;
                editorContent.style.fontSize = '16px';
                editorContent.style.lineHeight = '1.8';
                editorContent.style.padding = '30px';
                editorContent.style.overflowY = 'auto';
                editorContent.style.boxSizing = 'border-box';
            }
        }, 100);
    }
    
    // Get current notes content
    const currentContent = notesEditor ? notesEditor.getContent() : document.getElementById('meetingNotes').value;
    
    // Set content in expanded editor
    if (expandedNotesEditor) {
        expandedNotesEditor.setContent(currentContent);
    }
    
    // Show the modal
    const modal = document.getElementById('expandedNotesModal');
    if (modal) {
        modal.style.display = 'flex';
        modal.classList.add('show');
        
        // Focus the editor after a delay
        setTimeout(() => {
            const editorContent = document.querySelector('#expandedNotesEditor .simple-editor-content');
            if (editorContent) {
                editorContent.focus();
            }
        }, 200);
        
        // Add ESC key listener
        document.addEventListener('keydown', handleExpandedNotesEsc);
    }
}

function handleExpandedNotesEsc(event) {
    if (event.key === 'Escape') {
        const modal = document.getElementById('expandedNotesModal');
        if (modal && modal.classList.contains('show')) {
            closeExpandedNotes();
        }
    }
}

function saveExpandedNotes() {
    // Get content from expanded editor
    const expandedContent = expandedNotesEditor ? expandedNotesEditor.getContent() : '';
    
    // Update the main notes editor
    if (notesEditor) {
        notesEditor.setContent(expandedContent);
    }
    
    // Update the hidden field
    document.getElementById('meetingNotes').value = expandedContent;
    
    // Close the modal
    closeExpandedNotes();
    
    showNotification('Notes updated', 'success');
}

function closeExpandedNotes() {
    const modal = document.getElementById('expandedNotesModal');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('show');
    }
    
    // Remove ESC key listener
    document.removeEventListener('keydown', handleExpandedNotesEsc);
}

// Make functions available globally
window.expandNotes = expandNotes;
window.saveExpandedNotes = saveExpandedNotes;
window.closeExpandedNotes = closeExpandedNotes;