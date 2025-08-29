class SidebarManager {
    constructor() {
        this.sidebar = null;
        this.mainContent = null;
        this.toggleBtn = null;
        this.hamburger = null;
        this.overlay = null;
        this.isCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
        this.isMobile = window.innerWidth <= 768;
        
        this.init();
    }
    
    init() {
        this.sidebar = document.getElementById('sidebar');
        this.mainContent = document.getElementById('mainContent');
        this.toggleBtn = document.getElementById('sidebarToggle');
        this.hamburger = document.getElementById('hamburgerMenu');
        this.overlay = document.getElementById('sidebarOverlay');
        
        if (!this.sidebar) return;
        
        this.setupEventListeners();
        this.applyInitialState();
        this.setActiveNavItem();
    }
    
    setupEventListeners() {
        if (this.toggleBtn) {
            this.toggleBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Toggle button clicked');
                this.toggleSidebar();
            });
        }
        
        if (this.hamburger) {
            this.hamburger.addEventListener('click', () => this.toggleMobileSidebar());
        }
        
        if (this.overlay) {
            this.overlay.addEventListener('click', () => this.closeMobileSidebar());
        }
        
        window.addEventListener('resize', () => {
            this.handleResize();
        });
        
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                if (this.isMobile) {
                    this.closeMobileSidebar();
                }
            });
        });
    }
    
    applyInitialState() {
        if (!this.isMobile && this.isCollapsed) {
            this.sidebar.classList.add('collapsed');
            this.mainContent.classList.add('sidebar-collapsed');
        }
        this.updateToggleIcon();
    }
    
    toggleSidebar() {
        this.isCollapsed = !this.isCollapsed;
        
        if (this.isCollapsed) {
            this.sidebar.classList.add('collapsed');
            this.mainContent.classList.add('sidebar-collapsed');
        } else {
            this.sidebar.classList.remove('collapsed');
            this.mainContent.classList.remove('sidebar-collapsed');
        }
        
        localStorage.setItem('sidebarCollapsed', this.isCollapsed);
        this.updateToggleIcon();
        
        console.log('Sidebar toggled:', this.isCollapsed ? 'collapsed' : 'expanded');
    }
    
    toggleMobileSidebar() {
        this.sidebar.classList.toggle('mobile-open');
        this.overlay.classList.toggle('active');
        document.body.style.overflow = this.sidebar.classList.contains('mobile-open') ? 'hidden' : '';
    }
    
    closeMobileSidebar() {
        this.sidebar.classList.remove('mobile-open');
        this.overlay.classList.remove('active');
        document.body.style.overflow = '';
    }
    
    handleResize() {
        const wasMobile = this.isMobile;
        this.isMobile = window.innerWidth <= 768;
        
        if (wasMobile && !this.isMobile) {
            this.closeMobileSidebar();
            this.applyInitialState();
        } else if (!wasMobile && this.isMobile) {
            this.sidebar.classList.remove('collapsed');
            this.mainContent.classList.remove('sidebar-collapsed');
        }
    }
    
    updateToggleIcon() {
        if (this.toggleBtn) {
            const icon = this.toggleBtn.querySelector('.toggle-icon');
            if (icon) {
                icon.textContent = this.isCollapsed ? '▶' : '◀';
            }
        }
    }
    
    setActiveNavItem() {
        const currentPath = window.location.pathname;
        const navLinks = document.querySelectorAll('.nav-link');
        
        navLinks.forEach(link => {
            link.classList.remove('active');
            const href = link.getAttribute('href');
            
            if (currentPath === href || 
                (currentPath === '/' && href === '/') ||
                (currentPath.startsWith(href) && href !== '/')) {
                link.classList.add('active');
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new SidebarManager();
});