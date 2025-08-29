// Deals Report Functions
// Note: allDeals and currentUser are already declared in reports.js
let dealConfig = {
    dealCustomerTypes: ['New Customer', 'Existing Customer'],
    dealTypes: ['BNCE', 'BNCF', 'Advisory', 'RTS'],
    dealStatuses: ['Open', 'Won', 'Lost'],
    csmLocations: ['Onshore', 'Offshore']
};

// Load configuration when page loads
// Note: Deals are already loaded by reports.js
document.addEventListener('DOMContentLoaded', function() {
    loadDealConfiguration();
});

async function loadDealConfiguration() {
    try {
        const response = await fetch('/api/config');
        const config = await response.json();
        
        // Update deal configuration if present
        if (config.dealCustomerTypes) dealConfig.dealCustomerTypes = config.dealCustomerTypes;
        if (config.dealTypes) dealConfig.dealTypes = config.dealTypes;
        if (config.dealStatuses) dealConfig.dealStatuses = config.dealStatuses;
        if (config.csmLocations) dealConfig.csmLocations = config.csmLocations;
        
        // Update report filter dropdowns
        updateReportDropdowns();
    } catch (error) {
        console.error('Error loading configuration:', error);
    }
}

function updateReportDropdowns() {
    // Update filter dropdowns in reports page
    updateReportSelectOptions('dealStatus', dealConfig.dealStatuses);
    updateReportSelectOptions('dealType', dealConfig.dealTypes);
    updateReportSelectOptions('customerType', dealConfig.dealCustomerTypes);
}

function updateReportSelectOptions(selectId, options) {
    const select = document.getElementById(selectId);
    if (!select) return;
    
    // Save current value
    const currentValue = select.value;
    
    // Clear and rebuild options
    select.innerHTML = '';
    
    // Add "All" option
    const allOption = document.createElement('option');
    allOption.value = '';
    allOption.textContent = 'All';
    select.appendChild(allOption);
    
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

// Helper function to escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
}

// Format currency helper function
function formatCurrency(amount) {
    const value = parseFloat(amount) || 0;
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(value);
}

async function generateDealsReport() {
    // Check if allDeals is available (should be loaded by reports.js)
    if (!allDeals || !Array.isArray(allDeals)) {
        console.error('Deals data not available - may still be loading');
        if (typeof showNotification === 'function') {
            showNotification('Please wait for data to load and try again', 'error');
        }
        return;
    }
    
    const statusFilter = document.getElementById('dealStatus').value;
    const typeFilter = document.getElementById('dealType').value;
    const customerTypeFilter = document.getElementById('customerType').value;
    
    // Filter deals
    let filteredDeals = [...allDeals];
    
    if (statusFilter) {
        filteredDeals = filteredDeals.filter(deal => deal.dealStatus === statusFilter);
    }
    
    if (typeFilter) {
        filteredDeals = filteredDeals.filter(deal => deal.dealType === typeFilter);
    }
    
    if (customerTypeFilter) {
        filteredDeals = filteredDeals.filter(deal => deal.customerType === customerTypeFilter);
    }
    
    // Calculate statistics
    const totalDeals = filteredDeals.length;
    const openDeals = filteredDeals.filter(d => d.dealStatus === 'Open').length;
    const wonDeals = filteredDeals.filter(d => d.dealStatus === 'Won').length;
    const lostDeals = filteredDeals.filter(d => d.dealStatus === 'Lost').length;
    
    const totalForecast = filteredDeals.reduce((sum, d) => sum + (parseFloat(d.dealForecast) || 0), 0);
    const totalActual = filteredDeals.reduce((sum, d) => sum + (parseFloat(d.dealActual) || 0), 0);
    
    // Update statistics
    document.getElementById('totalDealsReportCount').textContent = totalDeals;
    document.getElementById('openDealsReportCount').textContent = openDeals;
    document.getElementById('wonDealsReportCount').textContent = wonDeals;
    document.getElementById('totalForecastAmount').textContent = formatCurrency(totalForecast);
    document.getElementById('totalActualAmount').textContent = formatCurrency(totalActual);
    
    // Create charts
    createDealsCharts(filteredDeals);
    
    // Generate detailed report
    let reportHtml = '<table class="report-table">';
    reportHtml += '<thead><tr>';
    reportHtml += '<th>Salesforce ID</th>';
    reportHtml += '<th>Customer</th>';
    reportHtml += '<th>Type</th>';
    reportHtml += '<th>Deal Type</th>';
    reportHtml += '<th>Status</th>';
    reportHtml += '<th>CSM Location</th>';
    reportHtml += '<th>CSM %</th>';
    reportHtml += '<th>Forecast</th>';
    reportHtml += '<th>Actual</th>';
    reportHtml += '<th>Summary</th>';
    reportHtml += '</tr></thead>';
    reportHtml += '<tbody>';
    
    filteredDeals.forEach(deal => {
        reportHtml += '<tr>';
        reportHtml += `<td>${escapeHtml(deal.salesforceId)}</td>`;
        reportHtml += `<td>${escapeHtml(deal.customerName)}</td>`;
        reportHtml += `<td>${escapeHtml(deal.customerType)}</td>`;
        reportHtml += `<td>${escapeHtml(deal.dealType)}</td>`;
        reportHtml += `<td><span class="status-badge status-${(deal.dealStatus || '').toLowerCase()}">${escapeHtml(deal.dealStatus)}</span></td>`;
        reportHtml += `<td>${escapeHtml(deal.csmLocation)}</td>`;
        reportHtml += `<td>${deal.csmAllocation ? deal.csmAllocation + '%' : ''}</td>`;
        reportHtml += `<td>${formatCurrency(deal.dealForecast)}</td>`;
        reportHtml += `<td>${formatCurrency(deal.dealActual)}</td>`;
        reportHtml += `<td>${deal.dealSummary || ''}</td>`;
        reportHtml += '</tr>';
    });
    
    reportHtml += '</tbody></table>';
    
    document.getElementById('dealsReportContent').innerHTML = reportHtml;
    
    // Show report sections
    document.getElementById('dealsSummaryDashboard').style.display = 'block';
    document.getElementById('dealsDetailedReport').style.display = 'block';
    document.getElementById('dealsReportActions').style.display = 'flex';
}

function createDealsCharts(deals) {
    // Status chart
    const statusCounts = {
        'Open': deals.filter(d => d.dealStatus === 'Open').length,
        'Won': deals.filter(d => d.dealStatus === 'Won').length,
        'Lost': deals.filter(d => d.dealStatus === 'Lost').length
    };
    
    const statusCtx = document.getElementById('dealsStatusChart').getContext('2d');
    if (dealsStatusChart) dealsStatusChart.destroy();
    
    dealsStatusChart = new Chart(statusCtx, {
        type: 'pie',
        data: {
            labels: Object.keys(statusCounts),
            datasets: [{
                data: Object.values(statusCounts),
                backgroundColor: ['#3498db', '#27ae60', '#e74c3c']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });
    
    // Type chart
    const typeCounts = {};
    deals.forEach(deal => {
        const type = deal.dealType || 'Unknown';
        typeCounts[type] = (typeCounts[type] || 0) + 1;
    });
    
    const typeCtx = document.getElementById('dealsTypeChart').getContext('2d');
    if (dealsTypeChart) dealsTypeChart.destroy();
    
    dealsTypeChart = new Chart(typeCtx, {
        type: 'bar',
        data: {
            labels: Object.keys(typeCounts),
            datasets: [{
                label: 'Number of Deals',
                data: Object.values(typeCounts),
                backgroundColor: '#9b59b6'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
}

function copyDealsReport() {
    const reportContent = document.getElementById('dealsReportContent').innerText;
    const statsContent = document.getElementById('dealsSummaryDashboard').innerText;
    
    const fullReport = `DEALS REPORT\n\n${statsContent}\n\n${reportContent}`;
    
    navigator.clipboard.writeText(fullReport).then(() => {
        alert('Report copied to clipboard!');
    });
}

function exportDealsToCSV() {
    const statusFilter = document.getElementById('dealStatus').value;
    const typeFilter = document.getElementById('dealType').value;
    const customerTypeFilter = document.getElementById('customerType').value;
    
    // Filter deals
    let filteredDeals = [...allDeals];
    
    if (statusFilter) {
        filteredDeals = filteredDeals.filter(deal => deal.dealStatus === statusFilter);
    }
    
    if (typeFilter) {
        filteredDeals = filteredDeals.filter(deal => deal.dealType === typeFilter);
    }
    
    if (customerTypeFilter) {
        filteredDeals = filteredDeals.filter(deal => deal.customerType === customerTypeFilter);
    }
    
    // Create CSV content
    let csv = 'Salesforce ID,Customer Name,Customer Type,Deal Type,Status,CSM Location,CSM %,Forecast,Actual,Summary\n';
    
    filteredDeals.forEach(deal => {
        csv += `"${deal.salesforceId || ''}",`;
        csv += `"${deal.customerName || ''}",`;
        csv += `"${deal.customerType || ''}",`;
        csv += `"${deal.dealType || ''}",`;
        csv += `"${deal.dealStatus || ''}",`;
        csv += `"${deal.csmLocation || ''}",`;
        csv += `"${deal.csmAllocation || ''}",`;
        csv += `"${deal.dealForecast || '0'}",`;
        csv += `"${deal.dealActual || '0'}",`;
        // Strip HTML from summary
        const summaryText = deal.dealSummary ? deal.dealSummary.replace(/<[^>]*>/g, '').replace(/"/g, '""') : '';
        csv += `"${summaryText}"\n`;
    });
    
    // Download CSV
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `deals_report_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
}

function printDealsReport() {
    window.print();
}