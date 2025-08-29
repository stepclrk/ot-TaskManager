# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Running the Application

**Windows (preferred):**
```bash
run_task_manager.bat
```

**Manual start:**
```bash
# Install dependencies
pip install -r requirements.txt

# Production server (Waitress) - RECOMMENDED
python -m waitress --port=8080 --threads=4 app:app

# Development server (Flask) - for debugging only
python app.py
```

### Development Tasks

**Install/update all dependencies:**
```bash
pip install -r requirements.txt
```

**Update specific dependency (Windows):**
```bash
update_dependencies.bat
```

## Architecture Overview

### Core Application Structure

The application follows a monolithic Flask architecture with JSON file-based storage:

- **app.py** (2000+ lines): Central Flask application containing all route handlers and business logic. Key responsibilities:
  - API endpoints for tasks, deals, projects, objectives
  - File upload/download handling  
  - User settings and configuration management
  - FTP sync orchestration for deals
  - AI feature integration

- **ftp_sync.py**: Handles team collaboration for deals via FTP with TLS encryption. Implements:
  - Manifest-based synchronization to track deletions
  - Conflict resolution (newest_wins strategy)
  - Automatic retry with exponential backoff
  - File naming: `deals_[userid]_[YYYYMMDD]_[HHMMSS].json`

- **ai_helper.py**: Anthropic Claude API wrapper providing:
  - Task/deal summaries
  - Follow-up generation
  - Text enhancement
  - Response caching to minimize API calls

### Data Layer

All data stored as JSON files in `data/` directory:

**Core Data Files:**
- `tasks.json`: Task records with full history and metadata
- `deals.json`: Deal pipeline with ownership and sync metadata
- `projects.json` / `objectives.json`: Project and OKR tracking
- `config.json`: Application-wide configuration (categories, statuses, priorities)
- `settings.json`: User preferences, API keys, FTP credentials
- `templates.json`: Reusable task templates
- `attachments/`: UUID-named file uploads

**Sync Metadata Structure (Deals):**
```json
{
  "sync_metadata": {
    "last_synced": "ISO timestamp",
    "synced_by": "user_id",
    "imported_from": "source_filename",
    "imported_at": "ISO timestamp"
  }
}
```

### Frontend Architecture

**Multi-file JavaScript modules** with specific responsibilities:

- **tasks.js + tasks_enhanced.js**: Task modal management, form handling, and enhanced features (tabs, dependencies, attachments)
- **deals.js**: Deal CRUD, ownership validation, comment system, FTP sync UI
- **dashboard.js**: Widget management, drag-and-drop layout, AI summaries
- **enhanced_features.js**: Shared utilities for Quill editor, file uploads, templates

**Key Frontend Patterns:**
- Tab-based modals with separate content panels
- Event delegation for dynamically added elements
- LocalStorage for UI preferences (hidden deals, dashboard layout)
- Quill.js for all rich text editing

### Critical Implementation Details

**Deal Ownership Model:**
- `owned_by` field determines edit permissions
- Non-owners get read-only view with commenting ability
- Comments have read/unread status for owners
- Local hiding of irrelevant deals via localStorage

**FTP Sync Flow:**
1. Upload: Create manifest with active_deal_ids → Upload to FTP
2. Download: Fetch all team files → Merge by newest_wins → Process deletions via manifest
3. Auto-sync: Runs every 60 seconds (configurable) if enabled

**Modal Tab Systems:**
- Tasks use `.tab-panel` with nested visibility control
- Deals use `.tab-content` with explicit display styles
- CSS specificity: `#taskModal .tab-content` vs general `.tab-content`

**File Attachment Security:**
- Files renamed to UUID on upload
- Original names preserved in metadata
- Stored in `data/attachments/` with reference in parent object

## API Endpoint Patterns

### Standard CRUD Pattern
```
GET    /api/{resource}          - List all
POST   /api/{resource}          - Create new
GET    /api/{resource}/{id}     - Get specific
PUT    /api/{resource}/{id}     - Update specific  
DELETE /api/{resource}/{id}     - Delete specific
```

### Special Endpoints
- `/api/deals/sync` - Trigger manual FTP sync
- `/api/deals/{id}/comments` - GET/POST comments (team collaboration)
- `/api/tasks/{id}/dependencies` - Manage task relationships
- `/api/ai/summary` - Generate AI summaries (requires API key)
- `/api/import` / `/api/export` - Bulk data operations

## Common Development Scenarios

### Adding a New Tab to Task/Deal Modal
1. Add tab button in HTML template with `data-tab` attribute
2. Add corresponding tab panel div with matching ID pattern
3. Ensure CSS classes: deals use `.tab-content`, tasks use `.tab-panel`
4. Initialize content in `switchTab()` or `resetTabs()` functions

### Implementing New Sync Features
1. Update `ftp_sync.py` for sync logic
2. Add sync_metadata fields to data model
3. Update frontend sync status indicators in deals.js
4. Test with multiple user_ids locally

### Adding AI Features
1. Implement method in `ai_helper.py`
2. Add API endpoint in `app.py` with API key validation
3. Add UI trigger in relevant JavaScript file
4. Cache responses in `ai_summary_cache.json`

### Debugging FTP Sync Issues
1. Check Settings → Sync Configuration for credentials
2. Review browser console for sync status logs
3. Check `data/sync_log.json` for detailed sync history
4. Verify FTP server requires TLS (most do)

## Data Model Considerations

### Task Dependencies Structure
```json
{
  "dependencies": {
    "depends_on": ["task_id_1", "task_id_2"],
    "blocks": ["task_id_3"]
  }
}
```

### Deal Comment Threading
```json
{
  "comments": [{
    "id": "uuid",
    "text": "comment text",
    "author": "user_id",
    "timestamp": "ISO",
    "read": false
  }]
}
```

## Error Handling Patterns

- Backend: Return `{'error': 'message'}` with appropriate HTTP status
- Frontend: Check response.ok before processing
- Show notifications via `showNotification()` utility
- Log errors to console but not sensitive data

## Testing Approach

No automated test suite exists. Manual testing checklist:
1. Create/edit/delete for each entity type
2. Verify JSON persistence after operations
3. Test import/export with various data sets
4. Multi-user sync testing with different user_ids
5. Tab switching in all modals
6. File upload with various file types
7. AI features with/without API key