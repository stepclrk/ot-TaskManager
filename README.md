# OT Task Manager

A comprehensive task, project, and deals management system with team collaboration features and AI-powered assistance.

## Key Features

### Task Management
- **Full CRUD Operations** - Create, read, update, and delete tasks with rich metadata
- **Rich Text Editor** - Quill-powered editor for descriptions and notes  
- **Multiple Views** - List view and Kanban board with drag-and-drop
- **Task Dependencies** - Track blockers and dependencies between tasks
- **File Attachments** - Upload and manage task-related documents
- **Comments & History** - Complete audit trail and team discussions
- **Templates** - Reusable templates for common workflows
- **Smart Organization** - Categories, priorities, statuses, and tags

### Deals Management
- **Deal Pipeline** - Track deals through Open, Won, and Lost stages
- **Team Collaboration** - Multi-user ownership with read-only team viewing
- **FTP Synchronization** - Automatic cross-team deal synchronization
- **Financial Tracking** - Forecast vs actual amounts, Australian FY support
- **Comments System** - Inter-team communication on deals
- **CSM Allocation** - Track customer success manager assignments

### Projects & Objectives
- **Project Management** - Milestones, timelines, and progress tracking
- **OKR Framework** - Objectives and Key Results with measurable outcomes
- **Workspace Views** - Dedicated interfaces for projects and objectives
- **Visual Planning** - Gantt charts and timeline visualization

### Dashboard & Analytics  
- **Customizable Widgets** - Drag-and-drop dashboard layout
- **Real-time Metrics** - Live statistics for tasks, deals, and projects
- **Comprehensive Reports** - Data analysis with export capabilities
- **AI Insights** - Intelligent summaries and recommendations

### AI Features (Optional)
- **Task Summaries** - Auto-generate executive or detailed summaries
- **Follow-up Generation** - AI-suggested next actions
- **Text Enhancement** - Improve descriptions and communications
- **Smart Analysis** - Dashboard intelligence and pattern recognition
- *Requires Anthropic Claude API key*

## Quick Start

### Prerequisites
- Python 3.8+
- pip package manager

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/ot-TaskManager.git
cd ot-TaskManager
```

2. **Install dependencies**
```bash
pip install -r requirements.txt
```

3. **Run the application**

Windows (recommended):
```bash
run_task_manager.bat
```

All platforms:
```bash
# Production server
python -m waitress --port=8080 --threads=4 app:app

# Development server  
python app.py
```

4. **Access the application**
```
http://localhost:8080
```

## Configuration

### Initial Setup
1. Navigate to **Settings** page
2. Set your **User ID** (default: "demo")
3. Add **Team IDs** for collaboration
4. Configure features as needed

### Team Collaboration (Deals)
Enable FTP synchronization for multi-user deals:
1. Go to **Settings → Sync Configuration**
2. Enable sync and select FTP mode
3. Enter server details (host, port, credentials)
4. Set sync interval (default: 60 seconds)

### AI Integration
To enable AI features:
1. Get an [Anthropic Claude API key](https://console.anthropic.com/)
2. Go to **Settings → AI Configuration**  
3. Enter your API key
4. Select Anthropic as provider

## Usage Guide

### Managing Tasks
- **Add Task** - Click "+" or "Add Task" button
- **Edit** - Click any task to modify
- **Organize** - Drag tasks in Kanban view
- **Track** - Use Dependencies, Comments, Attachments, History tabs
- **Templates** - Start from predefined templates

### Working with Deals
- **New Deal** - Add deals with customer and financial data
- **Collaborate** - View team deals (read-only)
- **Comment** - Communicate on team members' deals
- **Sync** - Automatic FTP synchronization
- **Hide** - Remove irrelevant deals from view

### Dashboard Customization
1. Click **Customize Layout**
2. Drag widgets to rearrange
3. Configure widget settings
4. Save your layout

## Project Structure

```
ot-TaskManager/
├── app.py                 # Flask application server
├── ai_helper.py          # AI integration module  
├── ftp_sync.py           # FTP synchronization
├── requirements.txt      # Python dependencies
├── run_task_manager.bat  # Windows launcher
├── CLAUDE.md            # Development documentation
├── data/                # JSON data storage
│   ├── tasks.json       # Task data
│   ├── deals.json       # Deals data
│   ├── projects.json    # Projects
│   ├── objectives.json  # OKRs
│   ├── config.json      # Configuration
│   ├── settings.json    # User settings
│   ├── templates.json   # Task templates
│   └── attachments/     # File uploads
├── static/              # Frontend assets
│   ├── css/            # Stylesheets
│   └── js/             # JavaScript modules
└── templates/           # HTML templates
```

## API Reference

### Core Endpoints
- `/api/tasks` - Task operations
- `/api/deals` - Deal management
- `/api/projects` - Project endpoints
- `/api/objectives` - OKR management
- `/api/config` - Configuration
- `/api/settings` - User settings

### AI Endpoints
- `/api/ai/summary` - Generate summaries
- `/api/ai/followup` - Create follow-ups
- `/api/ai/enhance` - Enhance text

### Sync Endpoints
- `/api/deals/sync` - Manual sync
- `/api/sync/status` - Sync status

## Troubleshooting

### Common Issues

**Port conflicts:**
- Check if port 8080 is available
- Use alternative: `python app.py --port 8081`

**FTP sync failures:**
- Verify credentials in Settings
- Check TLS requirements
- Review firewall settings

**AI features not working:**
- Confirm API key is valid
- Check internet connectivity
- Verify API credits available

**Missing dependencies:**
```bash
pip install --upgrade pip
pip install -r requirements.txt --force-reinstall
```

## Development

### Running in Development Mode
```bash
export FLASK_ENV=development  # Linux/Mac
set FLASK_ENV=development     # Windows
python app.py
```

### Key Technologies
- **Backend**: Flask, Waitress
- **Frontend**: Vanilla JavaScript, Quill.js
- **Storage**: JSON files
- **AI**: Anthropic Claude API
- **Sync**: FTP with TLS

### Contributing
1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## Security Notes
- API keys stored locally in `settings.json`
- FTP passwords in plain text - use dedicated accounts
- No built-in authentication - use reverse proxy for production
- File uploads are sanitized with secure filenames

## Browser Support
- Chrome 90+ (recommended)
- Firefox 88+
- Safari 14+
- Edge 90+

## Roadmap
- [ ] User authentication system
- [ ] Database backend option
- [ ] Email notifications
- [ ] Calendar integration
- [ ] Mobile applications
- [ ] Advanced reporting
- [ ] Webhook integrations
- [ ] Real-time collaboration

## Support
For issues or questions:
1. Check troubleshooting section
2. Review [CLAUDE.md](CLAUDE.md) for technical details
3. Open a GitHub issue

## License
Open source - use and modify freely

## Acknowledgments
Built with:
- Flask web framework
- Waitress WSGI server
- Quill.js rich text editor
- Anthropic Claude AI
- Open source community

---
*Version 2.0 - Now with Deals Management and Team Collaboration*