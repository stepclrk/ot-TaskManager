// Teams Management JavaScript

let teams = [];
let members = [];
let tasks = [];
let departments = [];
let currentTeam = null;
let currentMember = null;

document.addEventListener('DOMContentLoaded', async function() {
    // Load initial data - wait for all data to load
    await Promise.all([
        loadTeams(),
        loadMembers(),
        loadTasks(),
        loadDepartments()
    ]);
    
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
    
    // Initial render - show members view (after all data is loaded)
    renderMembers();
});

function setupEventListeners() {
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

// View switching removed - only members view exists

// Data Loading Functions
async function loadTeams() {
    try {
        const response = await fetch('/api/teams');
        teams = await response.json();
        // renderTeams() removed - only members view exists now
        updateStats();
    } catch (error) {
        console.error('Error loading teams:', error);
    }
}

async function loadMembers() {
    try {
        const response = await fetch('/api/members');
        members = await response.json();
        // Don't render here - wait until all data is loaded
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
        // Re-render members if they're already displayed to update task counts
        if (document.getElementById('membersList').children.length > 0) {
            renderMembers();
        }
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
    
    // Add container for grid layout
    const gridContainer = document.createElement('div');
    gridContainer.className = 'members-grid';
    
    members.forEach(member => {
        // Filter tasks by member name (case-insensitive)
        const memberName = (member.name || '').toLowerCase().trim();
        const memberTasks = tasks.filter(t => {
            const assignedTo = (t.assigned_to || '').toLowerCase().trim();
            // Check if assigned_to matches member name
            return assignedTo === memberName && assignedTo !== '';
        });
        
        // Count open tasks (excluding completed, closed, and cancelled)
        // Include tasks with empty status or specific non-closed statuses
        const openTasks = memberTasks.filter(t => {
            const status = (t.status || '').toLowerCase().trim();
            // Count as active if status is not one of the closed statuses
            return status !== 'completed' && 
                   status !== 'closed' && 
                   status !== 'cancelled';
        }).length;
        
        const capacity = calculateMemberCapacity(member.id);
        const capacityClass = capacity > 100 ? 'danger' : capacity > 80 ? 'warning' : '';
        
        const card = document.createElement('div');
        card.className = 'member-card';
        card.onclick = () => showMemberDetails(member);
        
        card.innerHTML = `
            <div class="member-card-header">
                <div class="member-avatar-xlarge" style="background: ${member.avatar_color || generateColor()}">
                    ${getInitials(member.name)}
                </div>
                <button class="member-delete-btn" onclick="event.stopPropagation(); deleteMember('${member.id}')" title="Delete Member">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
            
            <div class="member-card-body">
                <div class="member-name">${member.name}</div>
                <div class="member-role">${member.role || 'Team Member'}</div>
                <div class="member-department">
                    <i class="fas fa-building"></i> ${member.department || 'N/A'}
                </div>
            </div>
            
            <div class="member-card-stats">
                <div class="stat-item">
                    <div class="stat-value">${openTasks}</div>
                    <div class="stat-label">Active Tasks</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${capacity}%</div>
                    <div class="stat-label">Capacity</div>
                </div>
            </div>
            
            <div class="member-card-footer">
                <div class="capacity-bar">
                    <div class="capacity-fill ${capacityClass}" style="width: ${Math.min(capacity, 100)}%"></div>
                </div>
                <div class="member-contact">
                    <a href="mailto:${member.email}" onclick="event.stopPropagation()" title="${member.email}">
                        <i class="fas fa-envelope"></i>
                    </a>
                    ${member.phone ? `<a href="tel:${member.phone}" onclick="event.stopPropagation()" title="${member.phone}"><i class="fas fa-phone"></i></a>` : ''}
                </div>
            </div>
        `;
        
        gridContainer.appendChild(card);
    });
    
    list.appendChild(gridContainer);
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

async function deleteMember(memberId) {
    const member = members.find(m => m.id === memberId);
    if (!member) return;
    
    // Count tasks assigned to this member
    const memberName = (member.name || '').toLowerCase().trim();
    const memberTasks = tasks.filter(t => {
        const assignedTo = (t.assigned_to || '').toLowerCase().trim();
        return assignedTo === memberName && assignedTo !== '';
    });
    
    const activeTasks = memberTasks.filter(t => {
        const status = (t.status || '').toLowerCase().trim();
        return status !== 'completed' && status !== 'closed' && status !== 'cancelled';
    }).length;
    
    let confirmMessage = `Are you sure you want to delete ${member.name}?`;
    if (activeTasks > 0) {
        confirmMessage += `\n\nWarning: This member has ${activeTasks} active task(s) assigned.`;
    }
    
    if (!confirm(confirmMessage)) return;
    
    try {
        const response = await fetch(`/api/members/${memberId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            await loadMembers();
            renderMembers();
            showNotification('Member deleted successfully', 'success');
        } else {
            showNotification('Error deleting member', 'error');
        }
    } catch (error) {
        console.error('Error deleting member:', error);
        showNotification('Error deleting member', 'error');
    }
}

// Helper Functions
function updateStats() {
    document.getElementById('totalTeams').textContent = teams.length;
    document.getElementById('totalMembers').textContent = members.length;
    
    // Only count tasks assigned to team members
    const memberNames = members.map(m => (m.name || '').toLowerCase().trim());
    const activeTasks = tasks.filter(t => {
        const assignedTo = (t.assigned_to || '').toLowerCase().trim();
        return memberNames.includes(assignedTo) && 
               t.status !== 'Completed' && 
               t.status !== 'Closed' &&
               t.status !== 'Cancelled';
    }).length;
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
window.deleteMember = deleteMember;
window.closeTeamModal = closeTeamModal;
window.closeMemberModal = closeMemberModal;
window.showMemberDetails = showMemberDetails;
window.editMember = editMember;