/**
 * Simple Rich Text Editor - No SVG dependencies
 * Uses text/emoji icons for maximum compatibility
 */

class SimpleEditor {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            console.error(`Container ${containerId} not found`);
            return;
        }
        
        this.options = {
            placeholder: options.placeholder || 'Enter text...',
            height: options.height || '200px',
            toolbar: options.toolbar || ['bold', 'italic', 'underline', 'bullet', 'number', 'link']
        };
        
        this.init();
    }
    
    init() {
        // Create wrapper
        const wrapper = document.createElement('div');
        wrapper.className = 'simple-editor-wrapper';
        
        // Create toolbar
        const toolbar = document.createElement('div');
        toolbar.className = 'simple-editor-toolbar';
        
        // Define buttons with text/emoji icons
        const buttons = {
            bold: { icon: 'B', title: 'Bold', command: 'bold' },
            italic: { icon: 'I', title: 'Italic', command: 'italic' },
            underline: { icon: 'U', title: 'Underline', command: 'underline' },
            bullet: { icon: '• List', title: 'Bullet List', command: 'insertUnorderedList' },
            number: { icon: '1. List', title: 'Numbered List', command: 'insertOrderedList' },
            link: { icon: '🔗', title: 'Insert Link', command: 'createLink' },
            heading: { icon: 'H', title: 'Heading', command: 'formatBlock', value: 'h3' },
            quote: { icon: '"', title: 'Quote', command: 'formatBlock', value: 'blockquote' },
            clear: { icon: '✖', title: 'Clear Formatting', command: 'removeFormat' }
        };
        
        // Add buttons to toolbar
        this.options.toolbar.forEach(btnName => {
            if (buttons[btnName]) {
                const btn = buttons[btnName];
                const button = document.createElement('button');
                button.className = 'simple-editor-btn';
                button.innerHTML = btn.icon;
                button.title = btn.title;
                button.dataset.command = btn.command;
                if (btn.value) button.dataset.value = btn.value;
                
                // Special styling for certain buttons
                if (btnName === 'bold') button.style.fontWeight = 'bold';
                if (btnName === 'italic') button.style.fontStyle = 'italic';
                if (btnName === 'underline') button.style.textDecoration = 'underline';
                
                button.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.executeCommand(btn.command, btn.value);
                });
                
                toolbar.appendChild(button);
            }
        });
        
        // Create editor area
        const editor = document.createElement('div');
        editor.className = 'simple-editor-content';
        editor.contentEditable = true;
        editor.style.height = this.options.height;
        editor.style.minHeight = '100px';
        editor.innerHTML = this.container.innerHTML || '';
        editor.dataset.placeholder = this.options.placeholder;
        
        // Handle placeholder
        editor.addEventListener('focus', () => {
            if (editor.innerText.trim() === '') {
                editor.classList.add('empty');
            }
        });
        
        editor.addEventListener('blur', () => {
            if (editor.innerText.trim() === '') {
                editor.classList.add('empty');
            } else {
                editor.classList.remove('empty');
            }
        });
        
        // Initial placeholder check
        if (editor.innerText.trim() === '') {
            editor.classList.add('empty');
        }
        
        // Store reference
        this.editor = editor;
        
        // Build the editor
        wrapper.appendChild(toolbar);
        wrapper.appendChild(editor);
        
        // Store original ID on wrapper for reference
        wrapper.dataset.originalId = this.container.id;
        
        // Replace container content
        this.container.innerHTML = '';
        this.container.appendChild(wrapper);
        
        // Add CSS if not already added
        if (!document.getElementById('simple-editor-styles')) {
            const style = document.createElement('style');
            style.id = 'simple-editor-styles';
            style.innerHTML = `
                .simple-editor-wrapper {
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    background: white;
                }
                
                .simple-editor-toolbar {
                    border-bottom: 1px solid #ddd;
                    padding: 8px;
                    background: #f8f9fa;
                    display: flex;
                    gap: 4px;
                    flex-wrap: wrap;
                }
                
                .simple-editor-btn {
                    padding: 4px 8px;
                    border: 1px solid #ddd;
                    background: white;
                    cursor: pointer;
                    border-radius: 3px;
                    font-size: 14px;
                    min-width: 30px;
                    height: 30px;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s;
                }
                
                .simple-editor-btn:hover {
                    background: #e9ecef;
                    border-color: #adb5bd;
                }
                
                .simple-editor-btn:active,
                .simple-editor-btn.active {
                    background: #007bff;
                    color: white;
                    border-color: #007bff;
                }
                
                .simple-editor-content {
                    padding: 12px;
                    overflow-y: auto;
                    outline: none;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    font-size: 14px;
                    line-height: 1.6;
                }
                
                .simple-editor-content.empty:before {
                    content: attr(data-placeholder);
                    color: #999;
                    font-style: italic;
                    pointer-events: none;
                    position: absolute;
                }
                
                .simple-editor-content:focus {
                    outline: 2px solid #007bff;
                    outline-offset: -2px;
                }
                
                .simple-editor-content h3 {
                    margin: 0.5em 0;
                    font-size: 1.2em;
                }
                
                .simple-editor-content blockquote {
                    border-left: 3px solid #007bff;
                    margin: 0.5em 0;
                    padding-left: 1em;
                    color: #666;
                }
                
                .simple-editor-content ul,
                .simple-editor-content ol {
                    margin: 0.5em 0;
                    padding-left: 1.5em;
                }
                
                .simple-editor-content a {
                    color: #007bff;
                    text-decoration: underline;
                }
            `;
            document.head.appendChild(style);
        }
    }
    
    executeCommand(command, value = null) {
        // Focus the editor
        this.editor.focus();
        
        if (command === 'createLink') {
            const url = prompt('Enter URL:');
            if (url) {
                document.execCommand(command, false, url);
            }
        } else if (command === 'formatBlock') {
            document.execCommand(command, false, value);
        } else {
            document.execCommand(command, false, null);
        }
        
        // Update button states
        this.updateButtonStates();
    }
    
    updateButtonStates() {
        const toolbar = this.container.querySelector('.simple-editor-toolbar');
        if (!toolbar) return;
        
        toolbar.querySelectorAll('.simple-editor-btn').forEach(btn => {
            const command = btn.dataset.command;
            if (command && command !== 'createLink') {
                if (document.queryCommandState(command)) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            }
        });
    }
    
    getContent() {
        return this.editor ? this.editor.innerHTML : '';
    }
    
    setContent(html) {
        if (this.editor) {
            this.editor.innerHTML = html;
            this.editor.classList.toggle('empty', this.editor.innerText.trim() === '');
        }
    }
    
    clear() {
        this.setContent('');
    }
    
    destroy() {
        // Restore original container content
        if (this.editor) {
            this.container.innerHTML = this.editor.innerHTML;
        }
    }
}

// Make it globally available
window.SimpleEditor = SimpleEditor;

// Helper function to replace Quill instances
window.replaceQuillWithSimpleEditor = function(selector, options = {}) {
    const element = document.querySelector(selector);
    if (!element) return null;
    
    // Get the container ID or create one
    let id = element.id;
    if (!id) {
        id = 'simple-editor-' + Date.now();
        element.id = id;
    }
    
    // Create new editor
    return new SimpleEditor(id, options);
};

console.log('SimpleEditor loaded - use new SimpleEditor(containerId, options) to create an editor');