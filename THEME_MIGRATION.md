# Theme Migration Guide

## Overview
A unified theme system has been implemented to ensure consistent styling across all pages of the Task Manager application.

## What Changed

### 1. New Theme System (`theme.css`)
- Created a centralized theme file with CSS variables
- Defines consistent colors, spacing, typography, and shadows
- Provides reusable component styles

### 2. Color Palette
The application now uses a consistent color scheme:

**Primary Colors:**
- Primary: `#667eea` (Purple)
- Primary Gradient: `linear-gradient(135deg, #667eea 0%, #764ba2 100%)`

**Status Colors:**
- Success: `#28a745` (Green)
- Warning: `#ffc107` (Yellow)
- Danger: `#dc3545` (Red)
- Info: `#17a2b8` (Cyan)

**Neutral Colors:**
- Text Primary: `#2c3e50` (Dark Blue-Gray)
- Text Secondary: `#6c757d` (Gray)
- Background Primary: `#ffffff` (White)
- Background Secondary: `#f8f9fa` (Light Gray)

### 3. Consistent Components

All components now follow the same design patterns:

**Cards:**
- White background
- 12px border radius
- Subtle shadow
- Hover effects

**Buttons:**
- Primary buttons use purple gradient
- Consistent padding and sizing
- Hover animations

**Forms:**
- Unified input styling
- Focus states with purple outline
- Consistent spacing

**Modals:**
- Purple gradient headers
- Consistent padding and borders
- Smooth animations

### 4. Files Updated

**CSS Files:**
- `theme.css` - NEW: Central theme definitions
- `style.css` - Updated to use theme variables
- `member_details.css` - Updated to use theme variables
- `teams.css` - Updated to use theme variables

**HTML Templates:**
All templates now include `theme.css` as the first stylesheet:
- dashboard.html
- tasks.html
- teams.html
- member_details.html
- projects.html
- objectives.html
- deals.html
- settings.html
- reports.html
- project_workspace.html
- objective_workspace.html

## Benefits

1. **Consistency:** All pages now have the same look and feel
2. **Maintainability:** Changes to theme variables update the entire app
3. **Scalability:** New pages automatically inherit the theme
4. **Professional:** Cohesive design improves user experience

## Developer Guide

### Using Theme Variables

Instead of hardcoding colors and values, use CSS variables:

```css
/* OLD */
.my-element {
    color: #2c3e50;
    padding: 20px;
    border-radius: 12px;
}

/* NEW */
.my-element {
    color: var(--text-primary);
    padding: var(--spacing-lg);
    border-radius: var(--border-radius-lg);
}
```

### Available Variables

**Colors:**
- `var(--primary-color)`
- `var(--success-color)`
- `var(--text-primary)`
- `var(--background-primary)`

**Spacing:**
- `var(--spacing-xs)` - 4px
- `var(--spacing-sm)` - 8px
- `var(--spacing-md)` - 16px
- `var(--spacing-lg)` - 24px
- `var(--spacing-xl)` - 32px

**Typography:**
- `var(--font-xs)` - 0.75rem
- `var(--font-sm)` - 0.875rem
- `var(--font-base)` - 1rem
- `var(--font-lg)` - 1.125rem
- `var(--font-xl)` - 1.25rem

**Shadows:**
- `var(--shadow-sm)`
- `var(--shadow-md)`
- `var(--shadow-lg)`

### Creating New Components

When creating new components, follow these patterns:

```css
.new-component {
    /* Use theme variables */
    background: var(--background-primary);
    border-radius: var(--border-radius-lg);
    padding: var(--spacing-lg);
    box-shadow: var(--shadow-sm);
    
    /* Consistent transitions */
    transition: all var(--transition-normal);
}

.new-component:hover {
    box-shadow: var(--shadow-md);
    transform: translateY(-2px);
}
```

## Next Steps

To complete the migration:

1. Update remaining CSS files to use theme variables
2. Review and update any inline styles in JavaScript
3. Test all pages for visual consistency
4. Consider adding a dark mode using CSS variable overrides

## Testing Checklist

- [ ] All pages load with consistent styling
- [ ] Buttons have the same appearance across pages
- [ ] Cards and containers use consistent shadows
- [ ] Forms look identical on all pages
- [ ] Modals have unified styling
- [ ] Colors are consistent throughout
- [ ] Hover effects work uniformly
- [ ] Mobile responsive design is maintained