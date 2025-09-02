let allDeals = [];
let currentDealId = null;
let currentUser = null;
let dealSummaryEditor = null; // SimpleEditor instance
let noteEditor = null; // SimpleEditor instance
let autoSyncInterval = null;
let hiddenDeals = [];
let dealConfig = {
    dealCustomerTypes: ['New Customer', 'Existing Customer'],
    dealTypes: ['BNCE', 'BNCF', 'Advisory', 'RTS'],
    dealStatuses: ['Open', 'Won', 'Lost'],
    csmLocations: ['Onshore', 'Offshore']
};

document.addEventListener('DOMContentLoaded', function() {
    // Debug: Check if modal exists
    const modal = document.getElementById('dealModal');
    if (!modal) {
        console.error('CRITICAL: Deal modal not found in DOM!');
        console.error('Check if deals.html template is loading correctly');
    } else {
        console.log('Deal modal found in DOM');
    }
    
    loadHiddenDeals();
    loadConfiguration();
    loadDeals();
    initializeEditors();
    initializeSyncUI();
    startAutoSync();
    
    // Listen for configuration updates
    window.addEventListener('configUpdated', loadConfiguration);
    
    // Check sync status on load
    checkSyncStatus();
});

function initializeEditors() {
    // Initialize Deal Summary editor
    const editorElement = document.getElementById('dealSummaryEditor');
    if (editorElement && !dealSummaryEditor) {
        try {
            dealSummaryEditor = new SimpleEditor('dealSummaryEditor', {
                placeholder: 'Enter deal summary...',
                height: '150px',
                toolbar: ['bold', 'italic', 'underline', 'bullet', 'number', 'link', 'heading', 'quote', 'clear']
            });
            console.log('Deal summary editor initialized successfully');
        } catch (err) {
            console.error('Failed to initialize Quill editor:', err);
        }
    } else if (dealSummaryEditor) {
        console.log('Deal summary editor already initialized');
    }
    
    // Initialize Notes editor
    if (document.getElementById('newNoteEditor')) {
        noteEditor = new SimpleEditor('newNoteEditor', {
            placeholder: 'Add a note...',
            height: '150px',
            toolbar: ['bold', 'italic', 'underline', 'bullet', 'number', 'link', 'quote', 'clear']
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
        const data = await response.json();
        
        // Handle new response format with current_user
        if (data.deals) {
            allDeals = data.deals;
            currentUser = data.current_user;
        } else {
            // Fallback for old format
            allDeals = data;
        }
        
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
    let dealsToRender = deals || allDeals;
    
    // Filter out hidden deals
    dealsToRender = dealsToRender.filter(deal => !hiddenDeals.includes(deal.id));
    
    const tbody = document.getElementById('dealsTableBody');
    
    if (dealsToRender.length === 0) {
        tbody.innerHTML = '<tr><td colspan="11" style="text-align: center; padding: 40px;">No deals found</td></tr>';
        return;
    }
    
    tbody.innerHTML = dealsToRender.map(deal => {
        const statusBadge = deal.dealStatus === 'Won' && deal.financial_year 
            ? `<span class="status-badge status-${(deal.dealStatus || 'open').toLowerCase()}">${deal.dealStatus} (${deal.financial_year})</span>`
            : `<span class="status-badge status-${(deal.dealStatus || 'open').toLowerCase()}">${deal.dealStatus || ''}</span>`;
        
        // Check if the current user owns this deal
        const isOwned = !deal.owned_by || deal.owned_by === currentUser;
        const createdBy = deal.owned_by || currentUser || 'Unknown';
        const rowClass = isOwned ? '' : 'read-only-deal';
        
        // Check for unread comments
        const comments = deal.comments || [];
        const unreadCount = isOwned ? 
            comments.filter(c => !c.read).length : 
            0; // Only show unread count for owned deals
        const unreadBadge = unreadCount > 0 ? 
            `<span class="unread-badge" title="${unreadCount} unread comment${unreadCount > 1 ? 's' : ''}">💬 ${unreadCount}</span>` : 
            '';
        
        // Debug logging
        if (deal.owned_by === 'doerte') {
            console.log('Doerte deal:', {
                dealId: deal.id,
                owned_by: deal.owned_by,
                currentUser: currentUser,
                isOwned: isOwned
            });
        }
        
        // Use data attributes instead of inline onclick to avoid quote escaping issues
        return `
        <tr class="${rowClass} deal-row" data-deal-id="${deal.id}" data-is-owned="${isOwned}">
            <td>${deal.salesforceId || ''} ${unreadBadge}</td>
            <td>${deal.customerName || ''}</td>
            <td>${deal.customerType || ''}</td>
            <td>${deal.dealType || ''}</td>
            <td>${statusBadge}</td>
            <td><span class="created-by ${isOwned ? 'created-by-me' : 'created-by-other'}">${createdBy}</span></td>
            <td>${deal.csmLocation || ''}</td>
            <td>${deal.csmAllocation ? deal.csmAllocation + '%' : ''}</td>
            <td>${formatCurrency(deal.dealForecast)}</td>
            <td>${formatCurrency(deal.dealActual)}</td>
            <td>
                <div class="action-buttons">
                    ${isOwned ? `
                        <button class="btn-icon btn-edit" data-deal-id="${deal.id}" title="Edit">
                            ✏️
                        </button>
                    ` : `
                        <button class="btn-icon btn-view" data-deal-id="${deal.id}" title="View (Read-only)">
                            👁️
                        </button>
                    `}
                    <button class="btn-icon btn-copy" data-deal-id="${deal.id}" title="Copy Deal Info">
                        📋
                    </button>
                    ${isOwned ? `
                        <button class="btn-icon btn-delete" data-deal-id="${deal.id}" title="Delete">
                            🗑️
                        </button>
                    ` : `
                        <button class="btn-icon btn-hide" data-deal-id="${deal.id}" title="Hide from my view">
                            🚫
                        </button>
                    `}
                </div>
            </td>
        </tr>
    `}).join('');
    
    // Add event listeners after rendering
    attachDealEventListeners();
}

function loadHiddenDeals() {
    const stored = localStorage.getItem('hiddenDeals');
    if (stored) {
        hiddenDeals = JSON.parse(stored);
        console.log(`Loaded ${hiddenDeals.length} hidden deals`);
    }
}

function saveHiddenDeals() {
    localStorage.setItem('hiddenDeals', JSON.stringify(hiddenDeals));
}

function hideDeal(dealId) {
    if (!hiddenDeals.includes(dealId)) {
        hiddenDeals.push(dealId);
        saveHiddenDeals();
        loadDeals(); // Reload to update display
        showNotification('Deal hidden from view. It will reappear if updated.', 'info');
    }
}

function attachDealEventListeners() {
    // Row click handlers
    document.querySelectorAll('.deal-row').forEach(row => {
        row.addEventListener('click', function(e) {
            // Don't trigger if clicking on a button
            if (e.target.closest('.action-buttons')) return;
            
            const dealId = this.dataset.dealId;
            const isOwned = this.dataset.isOwned === 'true';
            
            if (isOwned) {
                editDeal(dealId);
            } else {
                viewDeal(dealId);
            }
        });
    });
    
    // Edit button handlers
    document.querySelectorAll('.btn-edit').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            editDeal(this.dataset.dealId);
        });
    });
    
    // View button handlers
    document.querySelectorAll('.btn-view').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            viewDeal(this.dataset.dealId);
        });
    });
    
    // Copy button handlers
    document.querySelectorAll('.btn-copy').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            copyDealToClipboard(this.dataset.dealId);
        });
    });
    
    // Delete button handlers
    document.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            deleteDeal(this.dataset.dealId);
        });
    });
    
    // Hide button handlers
    document.querySelectorAll('.btn-hide').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            hideDeal(this.dataset.dealId);
        });
    });
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

function switchTab(tabName) {
    console.log('Switching to tab:', tabName);
    
    // Remove active class from all tabs and buttons
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    
    // Hide all tab contents in the deal modal specifically
    document.querySelectorAll('#dealModal .tab-content').forEach(content => {
        content.classList.remove('active');
        content.style.display = 'none';
    });
    
    // Add active class to selected tab
    if (tabName === 'details') {
        const btn = document.querySelector('.tab-btn[onclick="switchTab(\'details\')"]');
        if (btn) btn.classList.add('active');
        const tabContent = document.getElementById('tabDetails');
        if (tabContent) {
            tabContent.classList.add('active');
            tabContent.style.display = 'block';
        }
    } else if (tabName === 'comments') {
        const btn = document.querySelector('.tab-btn[onclick*="comments"]');
        if (btn) btn.classList.add('active');
        const tabContent = document.getElementById('tabComments');
        if (tabContent) {
            tabContent.classList.add('active');
            tabContent.style.display = 'block';
        }
        
        // Load comments when switching to tab
        if (currentDealId) {
            loadComments(currentDealId);
        }
    } else if (tabName === 'metadata') {
        const btn = document.querySelector('.tab-btn[onclick="switchTab(\'metadata\')"]');
        if (btn) btn.classList.add('active');
        const tabContent = document.getElementById('tabMetadata');
        if (tabContent) {
            tabContent.classList.add('active');
            tabContent.style.display = 'block';
        }
    }
}

function populateMetadata(deal) {
    // Format dates for display
    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        return date.toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };
    
    // Ownership info
    document.getElementById('metaOwner').textContent = deal.owned_by || deal.created_by || '-';
    document.getElementById('metaCreatedBy').textContent = deal.created_by || '-';
    
    // Timestamps
    document.getElementById('metaCreatedAt').textContent = formatDate(deal.created_at);
    document.getElementById('metaUpdatedAt').textContent = formatDate(deal.updated_at);
    
    // Sync information
    const syncMeta = deal.sync_metadata || {};
    document.getElementById('metaLastSynced').textContent = formatDate(syncMeta.last_synced);
    document.getElementById('metaSyncedBy').textContent = syncMeta.synced_by || '-';
    document.getElementById('metaImportedFrom').textContent = syncMeta.imported_from || syncMeta.merged_from || '-';
    
    // Deal ID
    document.getElementById('metaDealId').textContent = deal.id || '-';
}

function openDealModal() {
    currentDealId = null;
    document.getElementById('modalTitle').textContent = 'New Deal';
    document.getElementById('dealForm').reset();
    document.getElementById('notesSection').style.display = 'none';
    document.getElementById('dateWonGroup').style.display = 'none';
    
    // Clear rich text editors
    if (dealSummaryEditor) {
        dealSummaryEditor.clear();
    }
    if (noteEditor) {
        noteEditor.clear();
    }
    
    // Reset to first tab and ensure others are hidden
    switchTab('details');
    // Extra safety - force hide non-active tabs
    document.getElementById('tabComments').style.display = 'none';
    document.getElementById('tabMetadata').style.display = 'none';
    
    // Clear metadata for new deal
    document.getElementById('metaOwner').textContent = currentUser || 'Current User';
    document.getElementById('metaCreatedBy').textContent = currentUser || 'Current User';
    document.getElementById('metaCreatedAt').textContent = 'Not yet created';
    document.getElementById('metaUpdatedAt').textContent = 'Not yet created';
    document.getElementById('metaLastSynced').textContent = '-';
    document.getElementById('metaSyncedBy').textContent = '-';
    document.getElementById('metaImportedFrom').textContent = '-';
    document.getElementById('metaDealId').textContent = 'Will be generated on save';
    
    const modal = document.getElementById('dealModal');
    if (modal) {
        modal.style.display = 'block';
        // Ensure editor is initialized after modal is shown
        setTimeout(() => {
            if (!dealSummaryEditor) {
                initializeEditors();
            }
        }, 100);
    } else {
        console.error('Deal modal element not found');
        showNotification('Error: Cannot open deal modal', 'error');
    }
}

function closeDealModal() {
    const modal = document.getElementById('dealModal');
    if (modal) {
        modal.style.display = 'none';
    }
    currentDealId = null;
    
    // Re-enable form fields and editor when closing (for next use)
    const formFields = document.querySelectorAll('#dealForm input, #dealForm select, #dealForm textarea');
    formFields.forEach(field => field.disabled = false);
    
    // Re-enable rich text editor
    if (dealSummaryEditor) {
        // SimpleEditor is always enabled
    }
    if (noteEditor) {
        // SimpleEditor is always enabled
    }
    
    // Show save button
    const saveBtn = document.getElementById('saveDealBtn');
    if (saveBtn) saveBtn.style.display = 'inline-block';
    
    // Note: noteForm doesn't exist in current HTML, skipping
}

async function viewDeal(dealId) {
    console.log('viewDeal called with:', dealId);
    currentDealId = dealId;
    const deal = allDeals.find(d => d.id === dealId);
    
    if (!deal) {
        console.error('Deal not found:', dealId);
        showNotification('Deal not found', 'error');
        return;
    }
    
    console.log('Viewing deal:', {
        id: deal.id,
        owned_by: deal.owned_by,
        currentUser: currentUser
    });
    
    // Check if modal exists
    const modal = document.getElementById('dealModal');
    if (!modal) {
        console.error('Deal modal not found');
        showNotification('Error: Modal not found', 'error');
        return;
    }
    
    // Set modal to read-only mode
    document.getElementById('modalTitle').textContent = `View Deal (Created by ${deal.owned_by || 'unknown'})`;
    
    // Populate form fields
    document.getElementById('salesforceId').value = deal.salesforceId || '';
    document.getElementById('customerName').value = deal.customerName || '';
    document.getElementById('customerType').value = deal.customerType || '';
    document.getElementById('dealType').value = deal.dealType || '';
    document.getElementById('dealStatus').value = deal.dealStatus || '';
    document.getElementById('csmLocation').value = deal.csmLocation || '';
    document.getElementById('csmAllocation').value = deal.csmAllocation || '';
    document.getElementById('dealForecast').value = deal.dealForecast || '';
    document.getElementById('dealActual').value = deal.dealActual || '';
    
    // Populate metadata tab
    populateMetadata(deal);
    
    // Disable all form fields
    const formFields = document.querySelectorAll('#dealForm input, #dealForm select, #dealForm textarea');
    formFields.forEach(field => field.disabled = true);
    
    // Hide save button, show close button only
    const saveBtn = document.getElementById('saveDealBtn');
    if (saveBtn) {
        saveBtn.style.display = 'none';
    }
    
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
    
    // Set rich text editor content (read-only)
    if (dealSummaryEditor) {
        try {
            if (deal.dealSummary) {
                if (deal.dealSummary.includes('<') && deal.dealSummary.includes('>')) {
                    dealSummaryEditor.setContent(deal.dealSummary);
                } else {
                    dealSummaryEditor.setContent(deal.dealSummary);
                }
            } else {
                dealSummaryEditor.clear();
            }
            // SimpleEditor doesn't have disable method
        } catch (err) {
            console.error('Error setting deal summary:', err);
            // Try to reinitialize the editor if it failed
            initializeEditors();
            if (dealSummaryEditor && deal.dealSummary) {
                dealSummaryEditor.setContent(deal.dealSummary || '');
                // SimpleEditor doesn't have disable method
            }
        }
    } else {
        console.warn('Deal summary editor not initialized');
        // Try to initialize it now
        initializeEditors();
    }
    
    // Show notes section in read-only mode
    document.getElementById('notesSection').style.display = 'block';
    // Note: noteForm doesn't exist in current HTML
    renderNotes(deal.notes || []);
    
    // Reset to first tab and ensure others are hidden
    switchTab('details');
    // Extra safety - force hide non-active tabs
    document.getElementById('tabComments').style.display = 'none';
    document.getElementById('tabMetadata').style.display = 'none';
    
    // Load and display comments
    loadComments(dealId);
    
    // Show comment form for non-owned deals (allow commenting on others' deals)
    const addCommentForm = document.getElementById('addCommentForm');
    if (addCommentForm) {
        addCommentForm.style.display = 'block';
    }
    
    // Use the modal variable that was already declared earlier in the function
    if (modal) {
        modal.style.display = 'block';
        // Ensure editor is initialized after modal is shown
        setTimeout(() => {
            if (!dealSummaryEditor) {
                initializeEditors();
            }
        }, 100);
    } else {
        console.error('Deal modal element not found');
        showNotification('Error: Cannot open deal modal', 'error');
    }
}

async function editDeal(dealId) {
    console.log('editDeal called with:', dealId);
    currentDealId = dealId;
    const deal = allDeals.find(d => d.id === dealId);
    
    if (!deal) {
        console.error('Deal not found:', dealId);
        showNotification('Deal not found', 'error');
        return;
    }
    
    // Check if modal exists
    const modal = document.getElementById('dealModal');
    if (!modal) {
        console.error('Deal modal not found');
        showNotification('Error: Modal not found', 'error');
        return;
    }
    
    console.log('Editing deal:', {
        id: deal.id,
        owned_by: deal.owned_by,
        currentUser: currentUser,
        willRedirectToView: deal.owned_by && deal.owned_by !== currentUser
    });
    
    // Check ownership
    if (deal.owned_by && deal.owned_by !== currentUser) {
        // If not owned, show in view-only mode
        console.log('Redirecting to view mode - not owned by current user');
        viewDeal(dealId);
        return;
    }
    
    // Re-enable all form fields for editing
    const formFields = document.querySelectorAll('#dealForm input, #dealForm select, #dealForm textarea');
    formFields.forEach(field => field.disabled = false);
    
    // Show save button
    const saveBtn = document.getElementById('saveDealBtn');
    if (saveBtn) saveBtn.style.display = 'inline-block';
    
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
    
    // Populate metadata tab
    populateMetadata(deal);
    
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
        try {
            // SimpleEditor is always enabled // Ensure editor is enabled for editing
            if (deal.dealSummary) {
                // Check if it's HTML or plain text
                if (deal.dealSummary.includes('<') && deal.dealSummary.includes('>')) {
                    dealSummaryEditor.setContent(deal.dealSummary);
                } else {
                    dealSummaryEditor.setContent(deal.dealSummary);
                }
            } else {
                dealSummaryEditor.clear();
            }
        } catch (err) {
            console.error('Error setting deal summary:', err);
            // Try to reinitialize the editor if it failed
            initializeEditors();
            if (dealSummaryEditor && deal.dealSummary) {
                dealSummaryEditor.setContent(deal.dealSummary || '');
            }
        }
    } else {
        console.warn('Deal summary editor not initialized');
        // Try to initialize it now
        initializeEditors();
    }
    
    // Clear note editor
    if (noteEditor) {
        // SimpleEditor is always enabled // Ensure editor is enabled for editing
        noteEditor.clear();
    }
    
    // Show notes section for existing deals
    document.getElementById('notesSection').style.display = 'block';
    // Note: noteForm doesn't exist in current HTML
    renderNotes(deal.notes || []);
    
    // Reset to first tab and ensure others are hidden
    switchTab('details');
    // Extra safety - force hide non-active tabs
    document.getElementById('tabComments').style.display = 'none';
    document.getElementById('tabMetadata').style.display = 'none';
    
    // Load and display comments
    loadComments(dealId);
    
    // Hide comment form for owned deals (can't comment on own deals)
    const addCommentForm = document.getElementById('addCommentForm');
    if (addCommentForm) {
        addCommentForm.style.display = 'none';
    }
    
    // Use the modal variable that was already declared earlier in the function
    if (modal) {
        modal.style.display = 'block';
        // Ensure editor is initialized after modal is shown
        setTimeout(() => {
            if (!dealSummaryEditor) {
                initializeEditors();
            }
        }, 100);
    } else {
        console.error('Deal modal element not found');
        showNotification('Error: Cannot open deal modal', 'error');
    }
}

async function loadComments(dealId) {
    try {
        const response = await fetch(`/api/deals/${dealId}/comments`);
        const comments = await response.json();
        renderComments(comments);
        updateCommentBadge(comments);
    } catch (error) {
        console.error('Error loading comments:', error);
    }
}

function renderComments(comments) {
    const commentsList = document.getElementById('commentsList');
    
    if (!comments || comments.length === 0) {
        commentsList.innerHTML = '<p class="no-comments">No comments yet. Be the first to comment!</p>';
        return;
    }
    
    commentsList.innerHTML = comments.map(comment => {
        const isUnread = !comment.read;
        const commentClass = isUnread ? 'comment-item unread' : 'comment-item';
        const unreadIndicator = isUnread ? '<span class="unread-indicator">NEW</span>' : '';
        
        return `
            <div class="${commentClass}" data-comment-id="${comment.id}">
                <div class="comment-header">
                    <strong>${comment.author}</strong>
                    ${unreadIndicator}
                    <span class="comment-date">${formatCommentDate(comment.timestamp)}</span>
                </div>
                <div class="comment-text">${escapeHtml(comment.text || '')}</div>
            </div>
        `;
    }).join('');
}

function updateCommentBadge(comments) {
    const badge = document.getElementById('commentsBadge');
    const unreadCount = comments.filter(c => !c.read).length;
    
    if (unreadCount > 0) {
        badge.textContent = unreadCount;
        badge.style.display = 'inline-block';
    } else {
        badge.style.display = 'none';
    }
}

async function addComment() {
    const commentText = document.getElementById('commentText').value.trim();
    
    if (!commentText) {
        alert('Please enter a comment');
        return;
    }
    
    if (!currentDealId) {
        console.error('No deal selected');
        return;
    }
    
    try {
        const response = await fetch(`/api/deals/${currentDealId}/comments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ text: commentText })
        });
        
        if (response.ok) {
            document.getElementById('commentText').value = '';
            loadComments(currentDealId);
            showNotification('Comment added successfully', 'success');
        } else {
            const error = await response.json();
            showNotification(error.error || 'Failed to add comment', 'error');
        }
    } catch (error) {
        console.error('Error adding comment:', error);
        showNotification('Error adding comment', 'error');
    }
}

function formatCommentDate(dateStr) {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
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
    const dealSummaryContent = dealSummaryEditor ? dealSummaryEditor.getContent() : '';
    
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
    const noteContent = noteEditor ? noteEditor.getContent() : '';
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
                noteEditor.clear();
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
    
    // Remove notification after 6 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            if (document.body.contains(notification)) {
                document.body.removeChild(notification);
            }
        }, 300);
    }, 6000);
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

// ========= FTP SYNC FUNCTIONALITY =========

let syncConfig = null;
let syncStatus = {
    lastSync: null,
    syncing: false,
    configured: false
};

async function startAutoSync() {
    // Clear any existing interval
    if (autoSyncInterval) {
        clearInterval(autoSyncInterval);
    }
    
    try {
        // Get sync configuration
        const response = await fetch('/api/sync/config');
        const config = await response.json();
        
        if (config.sync_enabled && config.sync_settings?.auto_sync_interval) {
            const intervalMs = config.sync_settings.auto_sync_interval * 1000; // Convert seconds to milliseconds
            
            console.log(`Starting auto-sync with interval: ${config.sync_settings.auto_sync_interval} seconds`);
            
            // Set up the interval
            autoSyncInterval = setInterval(async () => {
                console.log('Running auto-sync...');
                await performAutoSync();
            }, intervalMs);
            
            // Also run immediately after a short delay
            setTimeout(() => performAutoSync(), 5000); // Wait 5 seconds after page load
        } else {
            console.log('Auto-sync is disabled or not configured');
        }
    } catch (error) {
        console.error('Error starting auto-sync:', error);
    }
}

async function performAutoSync() {
    try {
        console.log('Performing auto-sync...');
        const response = await fetch('/api/sync/auto', {
            method: 'POST'
        });
        
        if (response.ok) {
            const result = await response.json();
            console.log('Auto-sync completed:', result);
            
            // If deals were updated, reload them
            if (result.new_deals > 0 || result.updated_deals > 0 || result.deleted_deals > 0) {
                console.log('Deals were updated, reloading...');
                
                // Clear hidden deals for updated deals (they might have new content)
                if (result.updated_deals > 0) {
                    clearUpdatedFromHidden();
                }
                
                await loadDeals();
                showNotification(`Auto-sync: ${result.new_deals} new, ${result.updated_deals} updated, ${result.deleted_deals} deleted`, 'success');
            }
        } else {
            console.error('Auto-sync failed:', await response.text());
        }
    } catch (error) {
        console.error('Error during auto-sync:', error);
    }
}

function clearUpdatedFromHidden() {
    // This will be called after sync to potentially unhide updated deals
    // For now, we keep them hidden unless manually unhidden
    // Could be enhanced to track update timestamps
}

function initializeSyncUI() {
    // Add sync controls to the page header
    const pageHeader = document.querySelector('.page-header');
    if (pageHeader) {
        // Create sync status indicator
        const syncContainer = document.createElement('div');
        syncContainer.className = 'sync-container';
        syncContainer.innerHTML = `
            <div class="sync-status-indicator">
                <span class="sync-icon" id="syncIcon">🔄</span>
                <span class="sync-text" id="syncText">Not configured</span>
                <span class="sync-time" id="syncTime"></span>
            </div>
            <div class="sync-actions">
                <button class="btn btn-sm btn-sync" id="syncNowBtn" onclick="performSync()" disabled>
                    <span class="sync-btn-icon">🔄</span> Sync Now
                </button>
                <button class="btn btn-sm btn-config" onclick="openSyncConfig()">
                    ⚙️ Configure
                </button>
            </div>
        `;
        
        // Insert before the search section or at the end of header
        const searchSection = pageHeader.querySelector('.search-section');
        if (searchSection) {
            pageHeader.insertBefore(syncContainer, searchSection);
        } else {
            pageHeader.appendChild(syncContainer);
        }
    }
    
    // Load sync configuration
    loadSyncConfig();
}

async function loadSyncConfig() {
    try {
        const response = await fetch('/api/sync/config');
        if (response.ok) {
            syncConfig = await response.json();
            updateSyncUI();
            
            // Enable sync button if configured
            const syncBtn = document.getElementById('syncNowBtn');
            if (syncBtn && syncConfig.ftp_config?.host) {
                syncBtn.disabled = false;
                syncStatus.configured = true;
            }
        }
    } catch (error) {
        console.error('Error loading sync config:', error);
    }
}

async function checkSyncStatus() {
    try {
        const response = await fetch('/api/sync/status');
        if (response.ok) {
            const status = await response.json();
            syncStatus.configured = status.configured;
            syncStatus.lastSync = status.last_sync;
            updateSyncUI();
        }
    } catch (error) {
        console.error('Error checking sync status:', error);
    }
}

function updateSyncUI() {
    const syncIcon = document.getElementById('syncIcon');
    const syncText = document.getElementById('syncText');
    const syncTime = document.getElementById('syncTime');
    const syncBtn = document.getElementById('syncNowBtn');
    
    if (!syncIcon || !syncText) return;
    
    if (syncStatus.syncing) {
        syncIcon.className = 'sync-icon syncing';
        syncIcon.textContent = '⏳';
        syncText.textContent = 'Syncing...';
        if (syncBtn) syncBtn.disabled = true;
    } else if (syncStatus.configured) {
        syncIcon.className = 'sync-icon ready';
        syncIcon.textContent = '✅';
        syncText.textContent = 'Ready to sync';
        if (syncBtn) syncBtn.disabled = false;
        
        if (syncStatus.lastSync && syncTime) {
            const lastSyncDate = new Date(syncStatus.lastSync);
            const timeAgo = getTimeAgo(lastSyncDate);
            syncTime.textContent = `Last sync: ${timeAgo}`;
        }
    } else {
        syncIcon.className = 'sync-icon not-configured';
        syncIcon.textContent = '❌';
        syncText.textContent = 'Not configured';
        if (syncBtn) syncBtn.disabled = true;
    }
}

async function performSync() {
    if (syncStatus.syncing) return;
    
    syncStatus.syncing = true;
    updateSyncUI();
    
    try {
        // Perform automatic sync (upload then download)
        const response = await fetch('/api/sync/auto', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        if (response.ok) {
            const result = await response.json();
            
            // Show sync report
            let message = `Sync complete! Uploaded ${result.uploaded} deals.`;
            if (result.report.new_deals > 0) {
                message += ` Added ${result.report.new_deals} new deals.`;
            }
            if (result.report.updated_deals > 0) {
                message += ` Updated ${result.report.updated_deals} deals.`;
            }
            if (result.report.conflicts && result.report.conflicts.length > 0) {
                message += ` ${result.report.conflicts.length} conflicts detected.`;
            }
            
            showNotification(message, 'success');
            
            // Update sync status
            syncStatus.lastSync = result.timestamp;
            
            // Reload deals to show merged data
            await loadDeals();
            
        } else {
            const error = await response.json();
            showNotification('Sync failed: ' + (error.error || 'Unknown error'), 'error');
        }
    } catch (error) {
        console.error('Sync error:', error);
        showNotification('Sync failed: ' + error.message, 'error');
    } finally {
        syncStatus.syncing = false;
        updateSyncUI();
    }
}

function openSyncConfig() {
    // Create modal for sync configuration
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'block';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 600px;">
            <span class="close" onclick="this.parentElement.parentElement.remove()">&times;</span>
            <h2>FTP Sync Configuration</h2>
            <form id="syncConfigForm">
                <div class="form-section">
                    <h3>User Settings</h3>
                    <div class="form-group">
                        <label for="userId">Your User ID *</label>
                        <input type="text" id="userId" placeholder="e.g., john" required>
                        <small>Unique identifier for your deals</small>
                    </div>
                    <div class="form-group">
                        <label for="teamIds">Team Member IDs</label>
                        <input type="text" id="teamIds" placeholder="e.g., john, sarah, mike">
                        <small>Comma-separated list of team member IDs</small>
                    </div>
                </div>
                
                <div class="form-section">
                    <h3>FTP Settings</h3>
                    <div class="form-group">
                        <label for="ftpHost">FTP Host *</label>
                        <input type="text" id="ftpHost" placeholder="ftp.example.com" required>
                    </div>
                    <div class="form-group">
                        <label for="ftpPort">Port</label>
                        <input type="number" id="ftpPort" value="21">
                    </div>
                    <div class="form-group">
                        <label for="ftpUsername">Username *</label>
                        <input type="text" id="ftpUsername" required>
                    </div>
                    <div class="form-group">
                        <label for="ftpPassword">Password</label>
                        <input type="password" id="ftpPassword">
                        <small>Leave blank to keep existing password</small>
                    </div>
                    <div class="form-group">
                        <label for="ftpDir">Remote Directory</label>
                        <input type="text" id="ftpDir" value="/shared/taskmanager/deals/">
                    </div>
                    <div class="form-group">
                        <label>
                            <input type="checkbox" id="ftpTls" checked> Use FTPS (Secure FTP)
                        </label>
                        <small>Recommended - Most FTP servers require TLS/SSL</small>
                    </div>
                </div>
                
                <div class="form-section">
                    <h3>Sync Settings</h3>
                    <div class="form-group">
                        <label for="conflictStrategy">Conflict Resolution</label>
                        <select id="conflictStrategy">
                            <option value="newest_wins">Newest Wins (Recommended)</option>
                            <option value="merge_all">Merge All Fields</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="keepDays">Keep Files For (days)</label>
                        <input type="number" id="keepDays" value="7" min="1" max="30">
                    </div>
                </div>
                
                <div class="form-actions">
                    <button type="submit" class="btn btn-primary">Save Configuration</button>
                    <button type="button" class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
                    <button type="button" class="btn btn-test" onclick="testFTPConnection()">Test Connection</button>
                </div>
            </form>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Load existing config
    if (syncConfig) {
        document.getElementById('userId').value = syncConfig.user_id || '';
        document.getElementById('teamIds').value = (syncConfig.team_ids || []).join(', ');
        document.getElementById('ftpHost').value = syncConfig.ftp_config?.host || '';
        document.getElementById('ftpPort').value = syncConfig.ftp_config?.port || 21;
        document.getElementById('ftpUsername').value = syncConfig.ftp_config?.username || '';
        document.getElementById('ftpDir').value = syncConfig.ftp_config?.remote_dir || '/shared/taskmanager/deals/';
        document.getElementById('ftpTls').checked = syncConfig.ftp_config?.use_tls !== false; // Default to true
        document.getElementById('conflictStrategy').value = syncConfig.sync_settings?.conflict_strategy || 'newest_wins';
        document.getElementById('keepDays').value = syncConfig.sync_settings?.keep_days || 7;
    }
    
    // Handle form submission
    document.getElementById('syncConfigForm').onsubmit = async (e) => {
        e.preventDefault();
        await saveSyncConfig();
    };
}

async function saveSyncConfig() {
    const config = {
        user_id: document.getElementById('userId').value,
        team_ids: document.getElementById('teamIds').value.split(',').map(id => id.trim()).filter(id => id),
        sync_enabled: true,
        sync_mode: 'ftp',
        ftp_config: {
            host: document.getElementById('ftpHost').value,
            port: parseInt(document.getElementById('ftpPort').value),
            username: document.getElementById('ftpUsername').value,
            password: document.getElementById('ftpPassword').value,
            remote_dir: document.getElementById('ftpDir').value,
            use_tls: document.getElementById('ftpTls').checked
        },
        sync_settings: {
            conflict_strategy: document.getElementById('conflictStrategy').value,
            keep_days: parseInt(document.getElementById('keepDays').value),
            auto_sync_interval: 300,
            upload_on_change: true
        }
    };
    
    try {
        const response = await fetch('/api/sync/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config)
        });
        
        if (response.ok) {
            showNotification('Sync configuration saved!', 'success');
            document.querySelector('.modal').remove();
            
            // Reload config and update UI
            await loadSyncConfig();
            await checkSyncStatus();
        } else {
            const error = await response.json();
            showNotification('Failed to save configuration: ' + error.error, 'error');
        }
    } catch (error) {
        console.error('Error saving config:', error);
        showNotification('Failed to save configuration', 'error');
    }
}

async function testFTPConnection() {
    // Save config first, then try to upload
    await saveSyncConfig();
    
    try {
        const response = await fetch('/api/sync/upload', {
            method: 'POST'
        });
        
        if (response.ok) {
            showNotification('FTP connection successful!', 'success');
        } else {
            const error = await response.json();
            showNotification('FTP connection failed: ' + error.error, 'error');
        }
    } catch (error) {
        showNotification('FTP connection test failed', 'error');
    }
}

function getTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return Math.floor(seconds / 60) + ' minutes ago';
    if (seconds < 86400) return Math.floor(seconds / 3600) + ' hours ago';
    if (seconds < 2592000) return Math.floor(seconds / 86400) + ' days ago';
    
    return date.toLocaleDateString();
}