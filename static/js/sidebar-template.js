// Sidebar template generator for consistent navigation across all pages
function generateSidebarHTML(activePage = '') {
    const navItems = [
        { href: '/', icon: '🏠', text: 'Dashboard', page: 'dashboard' },
        { href: '/objectives', icon: '🎯', text: 'Objectives', page: 'objectives' },
        { href: '/projects', icon: '📁', text: 'Projects', page: 'projects' },
        { href: '/tasks', icon: '✅', text: 'Tasks', page: 'tasks' },
        { href: '/deals', icon: '💼', text: 'Deals', page: 'deals' },
        { href: '/reports', icon: '📊', text: 'Reports', page: 'reports' },
        { href: '/settings', icon: '⚙️', text: 'Settings', page: 'settings' }
    ];
    
    const navItemsHTML = navItems.map(item => `
        <div class="nav-item">
            <a href="${item.href}" class="nav-link${item.page === activePage ? ' active' : ''}" data-tooltip="${item.text}">
                <span class="nav-icon">${item.icon}</span>
                <span class="nav-text">${item.text}</span>
            </a>
        </div>
    `).join('');
    
    return `
    <!-- Mobile Hamburger Menu -->
    <button id="hamburgerMenu" class="hamburger">
        <span></span>
        <span></span>
        <span></span>
    </button>
    
    <!-- Sidebar Navigation -->
    <nav id="sidebar" class="sidebar">
        <div class="sidebar-header">
            <a href="/" class="sidebar-logo">
                <span class="nav-icon">📋</span>
                <h1>Task Manager</h1>
            </a>
            <button id="sidebarToggle" class="sidebar-toggle">
                <span class="toggle-icon">◀</span>
            </button>
        </div>
        
        <div class="sidebar-nav">
            ${navItemsHTML}
        </div>
    </nav>
    
    <!-- Overlay for mobile -->
    <div id="sidebarOverlay" class="overlay"></div>`;
}

// Export for use in other files if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = generateSidebarHTML;
}