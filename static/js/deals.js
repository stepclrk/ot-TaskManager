let allDeals = [];
let currentDealId = null;
let dealSummaryEditor = null;
let noteEditor = null;
let dealConfig = {
    dealCustomerTypes: ['New Customer', 'Existing Customer'],
    dealTypes: ['BNCE', 'BNCF', 'Advisory', 'RTS'],
    dealStatuses: ['Open', 'Won', 'Lost'],
    csmLocations: ['Onshore', 'Offshore']
};

document.addEventListener('DOMContentLoaded', function() {
    loadConfiguration();
    loadDeals();
    initializeEditors();
    
    // Listen for configuration updates
    window.addEventListener('configUpdated', loadConfiguration);
});

function initializeEditors() {
    // Initialize Deal Summary editor
    if (document.getElementById('dealSummaryEditor')) {
        dealSummaryEditor = new Quill('#dealSummaryEditor', {
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
            placeholder: 'Enter deal summary...'
        });
    }
    
    // Initialize Notes editor
    if (document.getElementById('newNoteEditor')) {
        noteEditor = new Quill('#newNoteEditor', {
            theme: 'snow',
            modules: {
                toolbar: [
                    ['bold', 'italic', 'underline'],
                    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                    ['link', 'blockquote'],
                    ['clean']
                ]
            },
            placeholder: 'Add a note...'
        });
    }
}

async function loadConfiguration() {
    try {
        const response = await fetch('/api/config');
        const config = await response.json();
        
        // Update deal configuration if present
        if (config.dealCustomerTypes) dealConfig.dealCustomerTypes = config.dealCustomerTypes;
        if (config.dealTypes) dealConfig.dealTypes = config.dealTypes;
        if (config.dealStatuses) dealConfig.dealStatuses = config.dealStatuses;
        if (config.csmLocations) dealConfig.csmLocations = config.csmLocations;
        
        // Update dropdowns if they exist
        updateDropdowns();
    } catch (error) {
        console.error('Error loading configuration:', error);
    }
}

function updateDropdowns() {
    // Update filter dropdowns
    updateSelectOptions('statusFilter', dealConfig.dealStatuses);
    updateSelectOptions('typeFilter', dealConfig.dealTypes);
    updateSelectOptions('customerTypeFilter', dealConfig.dealCustomerTypes);
    
    // Update form dropdowns
    updateSelectOptions('customerType', dealConfig.dealCustomerTypes, 'Select Type');
    updateSelectOptions('dealType', dealConfig.dealTypes, 'Select Type');
    updateSelectOptions('dealStatus', dealConfig.dealStatuses, 'Select Status');
    updateSelectOptions('csmLocation', dealConfig.csmLocations, 'Select Location');
}

function updateSelectOptions(selectId, options, placeholder = 'All') {
    const select = document.getElementById(selectId);
    if (!select) return;
    
    // Save current value
    const currentValue = select.value;
    
    // Clear and rebuild options
    select.innerHTML = '';
    
    // Add placeholder option
    const placeholderOption = document.createElement('option');
    placeholderOption.value = '';
    placeholderOption.textContent = placeholder;
    select.appendChild(placeholderOption);
    
    // Add all options
    options.forEach(option => {
        const optionElement = document.createElement('option');
        optionElement.value = option;
        optionElement.textContent = option;
        select.appendChild(optionElement);
    });
    
    // Restore previous value if it still exists
    if (currentValue && options.includes(currentValue)) {
        select.value = currentValue;
    }
}

async function loadDeals() {
    try {
        const response = await fetch('/api/deals');
        allDeals = await response.json();
        renderDeals();
        updateStatistics();
        updateFinancialYearFilter();
    } catch (error) {
        console.error('Error loading deals:', error);
        showNotification('Error loading deals', 'error');
    }
}

function updateFinancialYearFilter() {
    const fyFilter = document.getElementById('fyFilter');
    if (!fyFilter) return;
    
    // Get unique financial years from deals
    const financialYears = new Set();
    allDeals.forEach(deal => {
        if (deal.financial_year) {
            financialYears.add(deal.financial_year);
        }
    });
    
    // Sort FYs
    const sortedFYs = Array.from(financialYears).sort();
    
    // Save current selection
    const currentValue = fyFilter.value;
    
    // Rebuild options
    fyFilter.innerHTML = '<option value="">All</option>';
    sortedFYs.forEach(fy => {
        const option = document.createElement('option');
        option.value = fy;
        option.textContent = fy;
        fyFilter.appendChild(option);
    });
    
    // Restore selection
    fyFilter.value = currentValue;
}

function renderDeals(deals = null) {
    const dealsToRender = deals || allDeals;
    const tbody = document.getElementById('dealsTableBody');
    
    if (dealsToRender.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; padding: 40px;">No deals found</td></tr>';
        return;
    }
    
    tbody.innerHTML = dealsToRender.map(deal => {
        const statusBadge = deal.dealStatus === 'Won' && deal.financial_year 
            ? `<span class="status-badge status-${(deal.dealStatus || 'open').toLowerCase()}">${deal.dealStatus} (${deal.financial_year})</span>`
            : `<span class="status-badge status-${(deal.dealStatus || 'open').toLowerCase()}">${deal.dealStatus || ''}</span>`;
        
        return `
        <tr onclick="editDeal('${deal.id}')">
            <td>${deal.salesforceId || ''}</td>
            <td>${deal.customerName || ''}</td>
            <td>${deal.customerType || ''}</td>
            <td>${deal.dealType || ''}</td>
            <td>${statusBadge}</td>
            <td>${deal.csmLocation || ''}</td>
            <td>${deal.csmAllocation ? deal.csmAllocation + '%' : ''}</td>
            <td>${formatCurrency(deal.dealForecast)}</td>
            <td>${formatCurrency(deal.dealActual)}</td>
            <td>
                <div class="action-buttons">
                    <button class="btn-icon" onclick="event.stopPropagation(); editDeal('${deal.id}')" title="Edit">
                        ✏️
                    </button>
                    <button class="btn-icon" onclick="event.stopPropagation(); copyDealToClipboard('${deal.id}')" title="Copy Deal Info">
                        📋
                    </button>
                    <button class="btn-icon" onclick="event.stopPropagation(); deleteDeal('${deal.id}')" title="Delete">
                        🗑️
                    </button>
                </div>
            </td>
        </tr>
    `}).join('');
}

function updateStatistics() {
    const totalDeals = allDeals.length;
    const openDeals = allDeals.filter(d => d.dealStatus === 'Open').length;
    const wonDeals = allDeals.filter(d => d.dealStatus === 'Won').length;
    const lostDeals = allDeals.filter(d => d.dealStatus === 'Lost').length;
    
    const totalForecast = allDeals.reduce((sum, deal) => sum + (parseFloat(deal.dealForecast) || 0), 0);
    const totalActual = allDeals.reduce((sum, deal) => sum + (parseFloat(deal.dealActual) || 0), 0);
    
    document.getElementById('totalDealsCount').textContent = totalDeals;
    document.getElementById('openDealsCount').textContent = openDeals;
    document.getElementById('wonDealsCount').textContent = wonDeals;
    document.getElementById('lostDealsCount').textContent = lostDeals;
    document.getElementById('totalForecast').textContent = formatCurrency(totalForecast);
    document.getElementById('totalActual').textContent = formatCurrency(totalActual);
}

function formatCurrency(amount) {
    const value = parseFloat(amount) || 0;
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(value);
}

function filterDeals() {
    const statusFilter = document.getElementById('statusFilter').value;
    const typeFilter = document.getElementById('typeFilter').value;
    const customerTypeFilter = document.getElementById('customerTypeFilter').value;
    const fyFilter = document.getElementById('fyFilter').value;
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    
    let filteredDeals = allDeals;
    
    if (statusFilter) {
        filteredDeals = filteredDeals.filter(d => d.dealStatus === statusFilter);
    }
    
    if (typeFilter) {
        filteredDeals = filteredDeals.filter(d => d.dealType === typeFilter);
    }
    
    if (customerTypeFilter) {
        filteredDeals = filteredDeals.filter(d => d.customerType === customerTypeFilter);
    }
    
    if (fyFilter) {
        filteredDeals = filteredDeals.filter(d => d.financial_year === fyFilter);
    }
    
    if (searchTerm) {
        filteredDeals = filteredDeals.filter(d => 
            (d.salesforceId && d.salesforceId.toLowerCase().includes(searchTerm)) ||
            (d.customerName && d.customerName.toLowerCase().includes(searchTerm)) ||
            (d.dealSummary && d.dealSummary.toLowerCase().includes(searchTerm))
        );
    }
    
    renderDeals(filteredDeals);
}

function toggleDateWon() {
    const status = document.getElementById('dealStatus').value;
    const dateWonGroup = document.getElementById('dateWonGroup');
    
    if (status === 'Won') {
        dateWonGroup.style.display = 'block';
        // If no date set, default to today
        if (!document.getElementById('dateWon').value) {
            document.getElementById('dateWon').value = new Date().toISOString().split('T')[0];
            calculateFinancialYear();
        }
    } else {
        dateWonGroup.style.display = 'none';
        document.getElementById('dateWon').value = '';
        document.getElementById('financialYearDisplay').textContent = '-';
    }
}

function calculateFinancialYear() {
    const dateWon = document.getElementById('dateWon').value;
    if (!dateWon) {
        document.getElementById('financialYearDisplay').textContent = '-';
        return;
    }
    
    const date = new Date(dateWon);
    const year = date.getFullYear();
    const month = date.getMonth() + 1; // JavaScript months are 0-indexed
    
    // If July or later, it's the next FY
    let fyYear;
    if (month >= 7) {
        fyYear = year + 1;
    } else {
        fyYear = year;
    }
    
    const fy = `FY${String(fyYear).slice(-2)}`;
    document.getElementById('financialYearDisplay').textContent = fy;
}

function openDealModal() {
    currentDealId = null;
    document.getElementById('modalTitle').textContent = 'New Deal';
    document.getElementById('dealForm').reset();
    document.getElementById('notesSection').style.display = 'none';
    document.getElementById('dateWonGroup').style.display = 'none';
    
    // Clear rich text editors
    if (dealSummaryEditor) {
        dealSummaryEditor.setText('');
    }
    if (noteEditor) {
        noteEditor.setText('');
    }
    
    document.getElementById('dealModal').style.display = 'block';
}

function closeDealModal() {
    document.getElementById('dealModal').style.display = 'none';
    currentDealId = null;
}

async function editDeal(dealId) {
    currentDealId = dealId;
    const deal = allDeals.find(d => d.id === dealId);
    
    if (!deal) return;
    
    document.getElementById('modalTitle').textContent = 'Edit Deal';
    document.getElementById('salesforceId').value = deal.salesforceId || '';
    document.getElementById('customerName').value = deal.customerName || '';
    document.getElementById('customerType').value = deal.customerType || '';
    document.getElementById('dealType').value = deal.dealType || '';
    document.getElementById('dealStatus').value = deal.dealStatus || '';
    document.getElementById('csmLocation').value = deal.csmLocation || '';
    document.getElementById('csmAllocation').value = deal.csmAllocation || '';
    document.getElementById('dealForecast').value = deal.dealForecast || '';
    document.getElementById('dealActual').value = deal.dealActual || '';
    
    // Handle date_won field
    if (deal.date_won) {
        document.getElementById('dateWon').value = deal.date_won;
        calculateFinancialYear();
    } else {
        document.getElementById('dateWon').value = '';
        document.getElementById('financialYearDisplay').textContent = '-';
    }
    
    // Show/hide date won field based on status
    toggleDateWon();
    
    // Set rich text editor content
    if (dealSummaryEditor) {
        if (deal.dealSummary) {
            // Check if it's HTML or plain text
            if (deal.dealSummary.includes('<') && deal.dealSummary.includes('>')) {
                dealSummaryEditor.root.innerHTML = deal.dealSummary;
            } else {
                dealSummaryEditor.setText(deal.dealSummary);
            }
        } else {
            dealSummaryEditor.setText('');
        }
    }
    
    // Clear note editor
    if (noteEditor) {
        noteEditor.setText('');
    }
    
    // Show notes section for existing deals
    document.getElementById('notesSection').style.display = 'block';
    renderNotes(deal.notes || []);
    
    document.getElementById('dealModal').style.display = 'block';
}

function renderNotes(notes) {
    const notesList = document.getElementById('notesList');
    
    if (notes.length === 0) {
        notesList.innerHTML = '<p style="text-align: center; color: #999;">No notes yet</p>';
        return;
    }
    
    notesList.innerHTML = notes.map(note => {
        // Check if note.text contains HTML
        const noteContent = (note.text && note.text.includes('<') && note.text.includes('>')) 
            ? note.text 
            : escapeHtml(note.text || '');
        
        return `
            <div class="note-item">
                <button class="note-delete" onclick="deleteNote('${note.id}')" title="Delete note">×</button>
                <div class="note-date">${new Date(note.timestamp).toLocaleString()}</div>
                <div class="note-text">${noteContent}</div>
            </div>
        `;
    }).join('');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function saveDeal() {
    // Get HTML content from Quill editor
    const dealSummaryContent = dealSummaryEditor ? dealSummaryEditor.root.innerHTML : '';
    
    const dealData = {
        salesforceId: document.getElementById('salesforceId').value,
        customerName: document.getElementById('customerName').value,
        customerType: document.getElementById('customerType').value,
        dealType: document.getElementById('dealType').value,
        dealStatus: document.getElementById('dealStatus').value,
        csmLocation: document.getElementById('csmLocation').value,
        csmAllocation: document.getElementById('csmAllocation').value,
        dealForecast: document.getElementById('dealForecast').value,
        dealActual: document.getElementById('dealActual').value,
        dealSummary: dealSummaryContent === '<p><br></p>' ? '' : dealSummaryContent
    };
    
    // Add date_won if status is Won
    if (dealData.dealStatus === 'Won') {
        dealData.date_won = document.getElementById('dateWon').value || new Date().toISOString().split('T')[0];
    }
    
    // Validate required fields
    if (!dealData.salesforceId || !dealData.customerName || !dealData.customerType || 
        !dealData.dealType || !dealData.dealStatus) {
        showNotification('Please fill in all required fields', 'error');
        return;
    }
    
    try {
        let response;
        if (currentDealId) {
            // Update existing deal
            response = await fetch(`/api/deals/${currentDealId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(dealData)
            });
        } else {
            // Create new deal
            response = await fetch('/api/deals', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(dealData)
            });
        }
        
        if (response.ok) {
            showNotification(currentDealId ? 'Deal updated successfully' : 'Deal created successfully', 'success');
            closeDealModal();
            loadDeals();
        } else {
            showNotification('Error saving deal', 'error');
        }
    } catch (error) {
        console.error('Error saving deal:', error);
        showNotification('Error saving deal', 'error');
    }
}

async function deleteDeal(dealId) {
    if (!confirm('Are you sure you want to delete this deal?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/deals/${dealId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            showNotification('Deal deleted successfully', 'success');
            loadDeals();
        } else {
            showNotification('Error deleting deal', 'error');
        }
    } catch (error) {
        console.error('Error deleting deal:', error);
        showNotification('Error deleting deal', 'error');
    }
}

async function addNote() {
    if (!currentDealId) return;
    
    // Get HTML content from Quill editor
    const noteContent = noteEditor ? noteEditor.root.innerHTML : '';
    const noteText = noteContent === '<p><br></p>' ? '' : noteContent;
    
    if (!noteText) {
        showNotification('Please enter a note', 'error');
        return;
    }
    
    try {
        const response = await fetch(`/api/deals/${currentDealId}/notes`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ text: noteText })
        });
        
        if (response.ok) {
            // Clear the note editor
            if (noteEditor) {
                noteEditor.setText('');
            }
            // Reload the deal to get updated notes
            const dealResponse = await fetch(`/api/deals/${currentDealId}`);
            const deal = await dealResponse.json();
            renderNotes(deal.notes || []);
            loadDeals(); // Refresh the main list
            showNotification('Note added successfully', 'success');
        } else {
            showNotification('Error adding note', 'error');
        }
    } catch (error) {
        console.error('Error adding note:', error);
        showNotification('Error adding note', 'error');
    }
}

async function deleteNote(noteId) {
    if (!currentDealId) return;
    
    if (!confirm('Are you sure you want to delete this note?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/deals/${currentDealId}/notes/${noteId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            // Reload the deal to get updated notes
            const dealResponse = await fetch(`/api/deals/${currentDealId}`);
            const deal = await dealResponse.json();
            renderNotes(deal.notes || []);
            loadDeals(); // Refresh the main list
            showNotification('Note deleted successfully', 'success');
        } else {
            showNotification('Error deleting note', 'error');
        }
    } catch (error) {
        console.error('Error deleting note:', error);
        showNotification('Error deleting note', 'error');
    }
}

function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        background: ${type === 'error' ? '#f44336' : '#4CAF50'};
        color: white;
        border-radius: 4px;
        box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        z-index: 10000;
        animation: slideIn 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    // Remove notification after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}

// Add animation styles
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Close modal when clicking outside of it
window.onclick = function(event) {
    const modal = document.getElementById('dealModal');
    if (event.target == modal) {
        closeDealModal();
    }
}

// Copy deal information to clipboard
async function copyDealToClipboard(dealId) {
    const deal = allDeals.find(d => d.id === dealId);
    if (!deal) return;
    
    // Strip HTML from summary for plain text
    const summaryText = deal.dealSummary ? 
        deal.dealSummary.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim() : 
        'No summary provided';
    
    // Format deal information as plain text
    let dealText = `DEAL INFORMATION\n`;
    dealText += `${'='.repeat(50)}\n\n`;
    
    dealText += `BASIC INFORMATION\n`;
    dealText += `-----------------\n`;
    dealText += `Salesforce ID: ${deal.salesforceId || 'N/A'}\n`;
    dealText += `Customer Name: ${deal.customerName || 'N/A'}\n`;
    dealText += `Customer Type: ${deal.customerType || 'N/A'}\n`;
    dealText += `Deal Type: ${deal.dealType || 'N/A'}\n`;
    dealText += `Status: ${deal.dealStatus || 'N/A'}\n\n`;
    
    dealText += `CSM DETAILS\n`;
    dealText += `-----------\n`;
    dealText += `CSM Location: ${deal.csmLocation || 'N/A'}\n`;
    dealText += `CSM Allocation: ${deal.csmAllocation ? deal.csmAllocation + '%' : 'N/A'}\n\n`;
    
    dealText += `FINANCIAL\n`;
    dealText += `---------\n`;
    dealText += `Forecast Amount: ${formatCurrency(deal.dealForecast)}\n`;
    dealText += `Actual Amount: ${formatCurrency(deal.dealActual)}\n\n`;
    
    dealText += `DEAL SUMMARY\n`;
    dealText += `------------\n`;
    dealText += `${summaryText}\n\n`;
    
    // Add notes if they exist
    if (deal.notes && deal.notes.length > 0) {
        dealText += `NOTES (${deal.notes.length})\n`;
        dealText += `${'='.repeat(50)}\n`;
        deal.notes.forEach((note, index) => {
            const noteDate = new Date(note.timestamp).toLocaleString();
            const noteText = note.text ? 
                note.text.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim() : 
                'Empty note';
            dealText += `\n[${index + 1}] ${noteDate}\n`;
            dealText += `${noteText}\n`;
        });
    }
    
    dealText += `\n${'='.repeat(50)}\n`;
    dealText += `Generated on: ${new Date().toLocaleString()}\n`;
    
    // Copy to clipboard
    try {
        await navigator.clipboard.writeText(dealText);
        showNotification('Deal information copied to clipboard!', 'success');
    } catch (err) {
        console.error('Failed to copy:', err);
        // Fallback method
        const textarea = document.createElement('textarea');
        textarea.value = dealText;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        try {
            document.execCommand('copy');
            showNotification('Deal information copied to clipboard!', 'success');
        } catch (err) {
            showNotification('Failed to copy deal information', 'error');
        }
        document.body.removeChild(textarea);
    }
}