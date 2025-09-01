// Teams Management JavaScript

let teams = [];
let members = [];
let tasks = [];
let departments = [];
let currentTeam = null;
let currentMember = null;

document.addEventListener('DOMContentLoaded', function() {
    // Load initial data
    loadTeams();
    loadMembers();
    loadTasks();
    loadDepartments();
    
    // Setup event listeners
    setupEventListeners();
    
    // Check if we need to edit a member
    const editMemberId = sessionStorage.getItem('editMemberId');
    if (editMemberId) {
        sessionStorage.removeItem('editMemberId');
        setTimeout(() => {
            editMember(editMemberId);
        }, 500);
    }
});

function setupEventListeners() {
    // View switcher
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            switchView(this.dataset.view);
        });
    });
    
    // Add buttons
    document.getElementById('addTeamBtn').addEventListener('click', showAddTeamModal);
    document.getElementById('addMemberBtn').addEventListener('click', showAddMemberModal);
    
    // Modal close buttons
    document.querySelectorAll('.modal .close').forEach(btn => {
        btn.addEventListener('click', function() {
            this.closest('.modal').style.display = 'none';
        });
    });
    
    // Member details modal close button
    const memberDetailsClose = document.querySelector('#memberDetailsModal .close');
    if (memberDetailsClose) {
        memberDetailsClose.addEventListener('click', function() {
            document.getElementById('memberDetailsModal').style.display = 'none';
        });
    }
    
    // Forms
    document.getElementById('teamForm').addEventListener('submit', saveTeam);
    document.getElementById('memberForm').addEventListener('submit', saveMember);
    
    // Close modal on outside click
    window.addEventListener('click', function(e) {
        if (e.target.classList.contains('modal')) {
            e.target.style.display = 'none';
        }
    });
}

function switchView(view) {
    // Update buttons
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === view);
    });
    
    // Update content
    document.querySelectorAll('.view-content').forEach(content => {
        content.classList.remove('active');
    });
    
    document.getElementById(`${view}View`).classList.add('active');
    
    // Load appropriate content
    if (view === 'teams') {
        renderTeams();
    } else if (view === 'members') {
        renderMembers();
    } else if (view === 'workload') {
        renderWorkload();
    }
}

// Data Loading Functions
async function loadTeams() {
    try {
        const response = await fetch('/api/teams');
        teams = await response.json();
        renderTeams();
        updateStats();
    } catch (error) {
        console.error('Error loading teams:', error);
    }
}

async function loadMembers() {
    try {
        const response = await fetch('/api/members');
        members = await response.json();
        renderMembers();
        updateStats();
    } catch (error) {
        console.error('Error loading members:', error);
    }
}

async function loadTasks() {
    try {
        const response = await fetch('/api/tasks');
        tasks = await response.json();
        updateStats();
    } catch (error) {
        console.error('Error loading tasks:', error);
    }
}

async function loadDepartments() {
    try {
        const response = await fetch('/api/departments');
        departments = await response.json();
        updateDepartmentSelects();
    } catch (error) {
        console.error('Error loading departments:', error);
    }
}

// Rendering Functions
function renderTeams() {
    const grid = document.getElementById('teamsGrid');
    grid.innerHTML = '';
    
    if (teams.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-users" style="font-size: 3rem; color: #dee2e6; margin-bottom: 20px;"></i>
                <h3>No teams yet</h3>
                <p>Create your first team to get started</p>
                <button class="btn btn-primary" onclick="showAddTeamModal()">
                    <i class="fas fa-plus"></i> Create Team
                </button>
            </div>
        `;
        return;
    }
    
    teams.forEach(team => {
        const teamMembers = members.filter(m => 
            m.team_ids && m.team_ids.includes(team.id)
        );
        
        const teamTasks = tasks.filter(t => 
            teamMembers.some(m => m.id === t.assigned_to_id)
        );
        
        const openTasks = teamTasks.filter(t => 
            t.status !== 'Completed' && t.status !== 'Closed'
        ).length;
        
        const card = document.createElement('div');
        card.className = 'team-card';
        card.style.setProperty('--team-color', team.color || '#007bff');
        
        card.innerHTML = `
            <div class="team-header">
                <div class="team-info">
                    <h3>${team.name}</h3>
                    ${team.department ? `<span class="team-department">${team.department}</span>` : ''}
                </div>
                <div class="team-actions">
                    <button onclick="editTeam('${team.id}')" title="Edit Team">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="deleteTeam('${team.id}')" title="Delete Team">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            
            <div class="team-description">
                ${team.description || 'No description provided'}
            </div>
            
            <div class="team-members">
                <h4>Team Members (${teamMembers.length})</h4>
                <div class="member-avatars">
                    ${teamMembers.slice(0, 5).map(member => `
                        <div class="member-avatar" 
                             style="background: ${member.avatar_color || generateColor()}" 
                             title="${member.name}">
                            ${getInitials(member.name)}
                        </div>
                    `).join('')}
                    ${teamMembers.length > 5 ? `
                        <div class="member-count">+${teamMembers.length - 5}</div>
                    ` : ''}
                </div>
            </div>
            
            <div class="team-stats">
                <div class="team-stat">
                    <div class="team-stat-value">${openTasks}</div>
                    <div class="team-stat-label">Active Tasks</div>
                </div>
                <div class="team-stat">
                    <div class="team-stat-value">${calculateTeamCapacity(team.id)}%</div>
                    <div class="team-stat-label">Capacity</div>
                </div>
                <div class="team-stat">
                    <div class="team-stat-value">${team.lead_id ? '✓' : '—'}</div>
                    <div class="team-stat-label">Team Lead</div>
                </div>
            </div>
        `;
        
        grid.appendChild(card);
    });
}

function renderMembers() {
    const list = document.getElementById('membersList');
    list.innerHTML = '';
    
    if (members.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-user" style="font-size: 3rem; color: #dee2e6; margin-bottom: 20px;"></i>
                <h3>No team members yet</h3>
                <p>Add your first team member to get started</p>
                <button class="btn btn-primary" onclick="showAddMemberModal()">
                    <i class="fas fa-user-plus"></i> Add Member
                </button>
            </div>
        `;
        return;
    }
    
    members.forEach(member => {
        // Filter tasks by member name (case-insensitive)
        const memberTasks = tasks.filter(t => {
            const assignedTo = (t.assigned_to || '').toLowerCase().trim();
            const memberName = (member.name || '').toLowerCase().trim();
            return assignedTo === memberName;
        });
        const openTasks = memberTasks.filter(t => 
            t.status !== 'Completed' && t.status !== 'Closed' && t.status !== 'Cancelled'
        ).length;
        
        const capacity = calculateMemberCapacity(member.id);
        const capacityClass = capacity > 100 ? 'danger' : capacity > 80 ? 'warning' : '';
        
        const item = document.createElement('div');
        item.className = 'member-item';
        item.onclick = () => showMemberDetails(member);
        
        item.innerHTML = `
            <div class="member-avatar-large" style="background: ${member.avatar_color || generateColor()}">
                ${getInitials(member.name)}
            </div>
            
            <div class="member-details">
                <div class="member-name">${member.name}</div>
                <div class="member-role">${member.role || 'Team Member'}</div>
                <div class="member-meta">
                    <span><i class="fas fa-envelope"></i> ${member.email}</span>
                    <span><i class="fas fa-building"></i> ${member.department || 'N/A'}</span>
                    <span><i class="fas fa-tasks"></i> ${openTasks} tasks</span>
                </div>
            </div>
            
            <div class="member-workload">
                <div class="capacity-bar">
                    <div class="capacity-fill ${capacityClass}" style="width: ${Math.min(capacity, 100)}%"></div>
                </div>
                <div class="capacity-text">${capacity}% capacity</div>
            </div>
        `;
        
        list.appendChild(item);
    });
}

function renderWorkload() {
    const chart = document.getElementById('workloadChart');
    chart.innerHTML = `
        <div class="workload-header">
            <div class="workload-title">Team Workload Overview</div>
            <div class="workload-filters">
                <select class="workload-filter" onchange="filterWorkload(this.value)">
                    <option value="all">All Teams</option>
                    ${teams.map(t => `<option value="${t.id}">${t.name}</option>`).join('')}
                </select>
            </div>
        </div>
        
        <div class="workload-visualization">
            ${renderWorkloadBars()}
        </div>
    `;
}

function renderWorkloadBars() {
    let html = '<div class="workload-bars">';
    
    members.forEach(member => {
        const capacity = calculateMemberCapacity(member.id);
        const capacityClass = capacity > 100 ? 'danger' : capacity > 80 ? 'warning' : '';
        
        html += `
            <div class="workload-bar-item">
                <div class="workload-member">
                    <span class="member-avatar-small" style="background: ${member.avatar_color || generateColor()}">
                        ${getInitials(member.name)}
                    </span>
                    <span>${member.name}</span>
                </div>
                <div class="workload-bar-container">
                    <div class="workload-bar ${capacityClass}" style="width: ${Math.min(capacity, 150)}%">
                        ${capacity}%
                    </div>
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    return html;
}

// Modal Functions
function showAddTeamModal() {
    currentTeam = null;
    document.getElementById('teamModalTitle').textContent = 'Create Team';
    document.getElementById('teamForm').reset();
    populateTeamModalSelects();
    document.getElementById('teamModal').style.display = 'block';
}

function showAddMemberModal() {
    currentMember = null;
    document.getElementById('memberModalTitle').textContent = 'Add Team Member';
    document.getElementById('memberForm').reset();
    populateMemberModalSelects();
    document.getElementById('memberModal').style.display = 'block';
}

function editTeam(teamId) {
    currentTeam = teams.find(t => t.id === teamId);
    if (!currentTeam) return;
    
    document.getElementById('teamModalTitle').textContent = 'Edit Team';
    document.getElementById('teamId').value = currentTeam.id;
    document.getElementById('teamName').value = currentTeam.name;
    document.getElementById('teamDescription').value = currentTeam.description || '';
    document.getElementById('teamDepartment').value = currentTeam.department || '';
    document.getElementById('teamLead').value = currentTeam.lead_id || '';
    document.getElementById('teamColor').value = currentTeam.color || '#007bff';
    
    populateTeamModalSelects();
    
    // Set selected members
    if (currentTeam.member_ids) {
        currentTeam.member_ids.forEach(memberId => {
            const checkbox = document.querySelector(`#teamMembersSelect input[value="${memberId}"]`);
            if (checkbox) checkbox.checked = true;
        });
    }
    
    document.getElementById('teamModal').style.display = 'block';
}

function populateTeamModalSelects() {
    // Populate team lead select
    const leadSelect = document.getElementById('teamLead');
    leadSelect.innerHTML = '<option value="">Select Team Lead</option>';
    members.forEach(member => {
        leadSelect.innerHTML += `<option value="${member.id}">${member.name}</option>`;
    });
    
    // Populate members checkboxes
    const membersSelect = document.getElementById('teamMembersSelect');
    membersSelect.innerHTML = '';
    members.forEach(member => {
        membersSelect.innerHTML += `
            <div class="member-checkbox">
                <input type="checkbox" id="member_${member.id}" value="${member.id}">
                <label for="member_${member.id}">${member.name} - ${member.role || 'Team Member'}</label>
            </div>
        `;
    });
}

function populateMemberModalSelects() {
    // Populate teams checkboxes
    const teamsSelect = document.getElementById('memberTeamsSelect');
    teamsSelect.innerHTML = '';
    teams.forEach(team => {
        teamsSelect.innerHTML += `
            <div class="team-checkbox">
                <input type="checkbox" id="team_${team.id}" value="${team.id}">
                <label for="team_${team.id}">${team.name}</label>
            </div>
        `;
    });
}

// Save Functions
async function saveTeam(e) {
    e.preventDefault();
    
    const selectedMembers = Array.from(
        document.querySelectorAll('#teamMembersSelect input:checked')
    ).map(cb => cb.value);
    
    const teamData = {
        name: document.getElementById('teamName').value,
        description: document.getElementById('teamDescription').value,
        department: document.getElementById('teamDepartment').value,
        lead_id: document.getElementById('teamLead').value || null,
        member_ids: selectedMembers,
        color: document.getElementById('teamColor').value
    };
    
    try {
        const teamId = document.getElementById('teamId').value;
        const url = teamId ? `/api/teams/${teamId}` : '/api/teams';
        const method = teamId ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(teamData)
        });
        
        if (response.ok) {
            closeTeamModal();
            loadTeams();
            showNotification('Team saved successfully', 'success');
        } else {
            showNotification('Error saving team', 'error');
        }
    } catch (error) {
        console.error('Error saving team:', error);
        showNotification('Error saving team', 'error');
    }
}

async function saveMember(e) {
    e.preventDefault();
    
    const selectedTeams = Array.from(
        document.querySelectorAll('#memberTeamsSelect input:checked')
    ).map(cb => cb.value);
    
    const memberData = {
        name: document.getElementById('memberName').value,
        email: document.getElementById('memberEmail').value,
        role: document.getElementById('memberRole').value,
        department: document.getElementById('memberDepartment').value,
        capacity_hours_per_week: parseInt(document.getElementById('memberCapacity').value),
        skills: document.getElementById('memberSkills').value.split(',').map(s => s.trim()),
        team_ids: selectedTeams
    };
    
    try {
        const memberId = document.getElementById('memberId').value;
        const url = memberId ? `/api/members/${memberId}` : '/api/members';
        const method = memberId ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(memberData)
        });
        
        if (response.ok) {
            closeMemberModal();
            loadMembers();
            showNotification('Member saved successfully', 'success');
        } else {
            showNotification('Error saving member', 'error');
        }
    } catch (error) {
        console.error('Error saving member:', error);
        showNotification('Error saving member', 'error');
    }
}

// Delete Functions
async function deleteTeam(teamId) {
    if (!confirm('Are you sure you want to delete this team?')) return;
    
    try {
        const response = await fetch(`/api/teams/${teamId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            loadTeams();
            showNotification('Team deleted successfully', 'success');
        } else {
            showNotification('Error deleting team', 'error');
        }
    } catch (error) {
        console.error('Error deleting team:', error);
        showNotification('Error deleting team', 'error');
    }
}

// Helper Functions
function updateStats() {
    document.getElementById('totalTeams').textContent = teams.length;
    document.getElementById('totalMembers').textContent = members.length;
    
    const activeTasks = tasks.filter(t => 
        t.status !== 'Completed' && t.status !== 'Closed'
    ).length;
    document.getElementById('activeTasks').textContent = activeTasks;
    
    // Calculate average capacity
    let totalCapacity = 0;
    let memberCount = 0;
    members.forEach(member => {
        const capacity = calculateMemberCapacity(member.id);
        totalCapacity += capacity;
        memberCount++;
    });
    
    const avgCapacity = memberCount > 0 ? Math.round(totalCapacity / memberCount) : 0;
    document.getElementById('avgCapacity').textContent = avgCapacity + '%';
}

function calculateMemberCapacity(memberId) {
    const member = members.find(m => m.id === memberId);
    if (!member) return 0;
    
    // Filter tasks by member name (case-insensitive)
    const memberTasks = tasks.filter(t => {
        const assignedTo = (t.assigned_to || '').toLowerCase().trim();
        const memberName = (member.name || '').toLowerCase().trim();
        return assignedTo === memberName && 
               t.status !== 'Completed' && 
               t.status !== 'Closed' &&
               t.status !== 'Cancelled';
    });
    
    const totalHours = memberTasks.reduce((sum, task) => {
        return sum + (task.estimated_hours || 0);
    }, 0);
    
    const weeklyCapacity = member.capacity_hours_per_week || 40;
    return Math.round((totalHours / weeklyCapacity) * 100);
}

function calculateTeamCapacity(teamId) {
    const teamMembers = members.filter(m => 
        m.team_ids && m.team_ids.includes(teamId)
    );
    
    if (teamMembers.length === 0) return 0;
    
    let totalCapacity = 0;
    teamMembers.forEach(member => {
        totalCapacity += calculateMemberCapacity(member.id);
    });
    
    return Math.round(totalCapacity / teamMembers.length);
}

function updateDepartmentSelects() {
    const selects = [
        document.getElementById('teamDepartment'),
        document.getElementById('memberDepartment')
    ];
    
    selects.forEach(select => {
        if (select) {
            select.innerHTML = '<option value="">Select Department</option>';
            departments.forEach(dept => {
                select.innerHTML += `<option value="${dept}">${dept}</option>`;
            });
        }
    });
}

function getInitials(name) {
    return name.split(' ')
        .map(word => word[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
}

function generateColor() {
    const colors = [
        '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
        '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
}

function closeTeamModal() {
    document.getElementById('teamModal').style.display = 'none';
    currentTeam = null;
}

function closeMemberModal() {
    document.getElementById('memberModal').style.display = 'none';
    currentMember = null;
}

function showNotification(message, type) {
    // Simple notification - you can enhance this
    console.log(`[${type}] ${message}`);
    // You can integrate with your existing notification system here
}

// Member Details Functions
function showMemberDetails(member) {
    // Redirect to member details page
    window.location.href = `/teams/member/${member.id}`;
}

function editMember(memberId) {
    const member = members.find(m => m.id === memberId);
    if (!member) return;
    
    currentMember = member;
    document.getElementById('memberModalTitle').textContent = 'Edit Member';
    document.getElementById('memberId').value = member.id;
    document.getElementById('memberName').value = member.name;
    document.getElementById('memberEmail').value = member.email;
    document.getElementById('memberRole').value = member.role || '';
    document.getElementById('memberDepartment').value = member.department || '';
    document.getElementById('memberCapacity').value = member.capacity || 40;
    document.getElementById('memberSkills').value = member.skills || '';
    
    // Show modal
    document.getElementById('memberModal').style.display = 'block';
}

// Export functions for global access
window.showAddTeamModal = showAddTeamModal;
window.showAddMemberModal = showAddMemberModal;
window.editTeam = editTeam;
window.deleteTeam = deleteTeam;
window.closeTeamModal = closeTeamModal;
window.closeMemberModal = closeMemberModal;
window.showMemberDetails = showMemberDetails;
window.editMember = editMember;