/**
 * Force fix for Quill toolbar SVG visibility issue
 * This script MUST run after Quill editors are initialized
 */

function fixQuillSVGs() {
    console.log('Fixing Quill SVG dimensions...');
    
    // Find all SVGs in Quill toolbars
    const svgs = document.querySelectorAll('.ql-toolbar svg, .ql-snow .ql-toolbar svg');
    
    svgs.forEach((svg, index) => {
        // Force set dimensions
        svg.style.width = '18px';
        svg.style.height = '18px';
        svg.style.display = 'inline-block';
        svg.style.verticalAlign = 'middle';
        
        // Also set the viewBox if missing
        if (!svg.getAttribute('viewBox')) {
            svg.setAttribute('viewBox', '0 0 18 18');
        }
        
        // Make sure stroke elements are visible
        const strokes = svg.querySelectorAll('.ql-stroke');
        strokes.forEach(stroke => {
            stroke.style.stroke = '#444';
            stroke.style.strokeWidth = '2';
            stroke.style.fill = 'none';
        });
        
        // Make sure fill elements are visible
        const fills = svg.querySelectorAll('.ql-fill, .ql-stroke.ql-fill');
        fills.forEach(fill => {
            fill.style.fill = '#444';
        });
        
        console.log(`Fixed SVG ${index + 1}: width=${svg.style.width}, height=${svg.style.height}`);
    });
    
    // Also fix button dimensions if needed
    const buttons = document.querySelectorAll('.ql-toolbar button');
    buttons.forEach(btn => {
        btn.style.width = '';
        btn.style.height = '';
        btn.style.padding = '3px 5px';
    });
    
    console.log(`Fixed ${svgs.length} SVGs in Quill toolbars`);
}

// Run the fix when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        // Wait a bit for Quill to initialize
        setTimeout(fixQuillSVGs, 500);
        // Run again after a longer delay to catch dynamically created editors
        setTimeout(fixQuillSVGs, 2000);
    });
} else {
    // DOM already loaded, run after a short delay
    setTimeout(fixQuillSVGs, 500);
    setTimeout(fixQuillSVGs, 2000);
}

// Also provide a global function that can be called manually
window.fixQuillToolbars = fixQuillSVGs;

// Listen for any Quill initialization (for dynamically created editors)
const originalQuill = window.Quill;
if (originalQuill) {
    window.Quill = function(...args) {
        const instance = new originalQuill(...args);
        setTimeout(fixQuillSVGs, 100);
        return instance;
    };
    // Copy over static properties
    Object.keys(originalQuill).forEach(key => {
        window.Quill[key] = originalQuill[key];
    });
}