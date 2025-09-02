from flask import Flask, jsonify, request, render_template, send_from_directory, send_file
from flask_cors import CORS
import json
import os
from datetime import datetime, date, timedelta
import uuid
import threading
import time
# from plyer import notification  # Removed - using browser notifications only
from ai_helper import call_ai_api
from werkzeug.utils import secure_filename
import shutil
import difflib
from ftp_sync import FTPSyncManager
from project_manager import ProjectManager
from team_manager import TeamManager
from meeting_exporter import MeetingExporter, get_meeting_filename

app = Flask(__name__)
CORS(app)

DATA_FILE = 'data/tasks.json'
CONFIG_FILE = 'data/config.json'
SETTINGS_FILE = 'data/settings.json'
TEMPLATES_FILE = 'data/templates.json'
ATTACHMENTS_DIR = 'data/attachments'
DASHBOARD_LAYOUTS_FILE = 'data/dashboard_layouts.json'
AI_SUMMARY_CACHE_FILE = 'data/ai_summary_cache.json'
TOPICS_FILE = 'data/objectives.json'
PROJECTS_FILE = 'data/projects.json'
DEALS_FILE = 'data/deals.json'
MEETINGS_FILE = 'data/meetings.json'
MEETING_TEMPLATES_FILE = 'data/meeting_templates.json'

def load_tasks():
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, 'r') as f:
            return json.load(f)
    return []

def save_tasks(tasks):
    os.makedirs('data', exist_ok=True)
    with open(DATA_FILE, 'w') as f:
        json.dump(tasks, f, indent=2, default=str)

def load_config():
    if os.path.exists(CONFIG_FILE):
        with open(CONFIG_FILE, 'r') as f:
            config = json.load(f)
            # Add deal configurations if they don't exist
            if 'dealCustomerTypes' not in config:
                config['dealCustomerTypes'] = ['New Customer', 'Existing Customer']
            if 'dealTypes' not in config:
                config['dealTypes'] = ['BNCE', 'BNCF', 'Advisory', 'RTS']
            if 'dealStatuses' not in config:
                config['dealStatuses'] = ['Open', 'Won', 'Lost']
            if 'csmLocations' not in config:
                config['csmLocations'] = ['Onshore', 'Offshore']
            # Add meeting configurations if they don't exist
            if 'meetingTypes' not in config:
                config['meetingTypes'] = ['Standup', 'Project', 'Client', 'Team', 'Review', 'Planning', 'Retrospective', 'One-on-One']
            if 'meetingStatuses' not in config:
                config['meetingStatuses'] = ['Scheduled', 'In Progress', 'Completed', 'Cancelled', 'Rescheduled']
            return config
    return {
        'categories': ['Development', 'Support', 'Bug', 'Feature', 'Documentation'],
        'statuses': ['Open', 'In Progress', 'Pending', 'Completed', 'Cancelled'],
        'priorities': ['Low', 'Medium', 'High', 'Urgent'],
        'tags': ['Frontend', 'Backend', 'Database', 'API', 'UI', 'Security'],
        'dealCustomerTypes': ['New Customer', 'Existing Customer'],
        'dealTypes': ['BNCE', 'BNCF', 'Advisory', 'RTS'],
        'dealStatuses': ['Open', 'Won', 'Lost'],
        'csmLocations': ['Onshore', 'Offshore'],
        'meetingTypes': ['Standup', 'Project', 'Client', 'Team', 'Review', 'Planning', 'Retrospective', 'One-on-One'],
        'meetingStatuses': ['Scheduled', 'In Progress', 'Completed', 'Cancelled', 'Rescheduled']
    }

def save_config(config):
    os.makedirs('data', exist_ok=True)
    with open(CONFIG_FILE, 'w') as f:
        json.dump(config, f, indent=2)

def load_settings():
    if os.path.exists(SETTINGS_FILE):
        with open(SETTINGS_FILE, 'r') as f:
            return json.load(f)
    return {
        'api_key': '',
        'notifications_enabled': True,
        'check_interval': 60
    }

def save_settings(settings):
    os.makedirs('data', exist_ok=True)
    with open(SETTINGS_FILE, 'w') as f:
        json.dump(settings, f, indent=2)

def load_templates():
    if os.path.exists(TEMPLATES_FILE):
        with open(TEMPLATES_FILE, 'r') as f:
            return json.load(f)
    return {
        'templates': [
            {
                'id': 'bug-report',
                'name': 'Bug Report',
                'title_pattern': 'Bug: {issue}',
                'description': 'Steps to reproduce:\n1. \n2. \n3. \n\nExpected behavior:\n\nActual behavior:',
                'category': 'Bug',
                'priority': 'High',
                'tags': 'bug,needs-investigation'
            },
            {
                'id': 'feature-request',
                'name': 'Feature Request',
                'title_pattern': 'Feature: {feature_name}',
                'description': 'Feature Description:\n\nBusiness Value:\n\nAcceptance Criteria:\n- [ ] ',
                'category': 'Feature',
                'priority': 'Medium',
                'tags': 'feature,enhancement'
            }
        ]
    }

def save_templates(templates):
    os.makedirs('data', exist_ok=True)
    with open(TEMPLATES_FILE, 'w') as f:
        json.dump(templates, f, indent=2)

def parse_follow_up_datetime(follow_up_value):
    """Parse follow-up date/datetime string and return datetime object"""
    if not follow_up_value:
        return None
    
    # Try parsing as datetime first (YYYY-MM-DDTHH:MM format from datetime-local input)
    try:
        # Handle both with and without seconds
        if 'T' in follow_up_value:
            if len(follow_up_value) == 16:  # YYYY-MM-DDTHH:MM
                return datetime.fromisoformat(follow_up_value + ':00')
            else:
                return datetime.fromisoformat(follow_up_value)
        elif ' ' in follow_up_value:
            # Handle space-separated datetime
            return datetime.strptime(follow_up_value, '%Y-%m-%d %H:%M:%S')
    except:
        pass
    
    # Try parsing as date only (YYYY-MM-DD format)
    try:
        date_obj = datetime.strptime(follow_up_value, '%Y-%m-%d')
        # Set to end of day for date-only values for backward compatibility
        return date_obj.replace(hour=23, minute=59, second=59)
    except:
        return None

def is_overdue(follow_up_value, status=None):
    """Check if a task is overdue based on follow-up date/time"""
    if status == 'Completed':
        return False
    follow_up_dt = parse_follow_up_datetime(follow_up_value)
    if not follow_up_dt:
        return False
    return follow_up_dt < datetime.now()

def is_due_today(follow_up_value):
    """Check if a task is due today"""
    follow_up_dt = parse_follow_up_datetime(follow_up_value)
    if not follow_up_dt:
        return False
    
    today = datetime.now().date()
    return follow_up_dt.date() == today

def format_follow_up_display(follow_up_value):
    """Format follow-up date/time for display"""
    follow_up_dt = parse_follow_up_datetime(follow_up_value)
    if not follow_up_dt:
        return None
    
    # If time is set (not 23:59:59), show date and time
    if follow_up_dt.hour != 23 or follow_up_dt.minute != 59:
        return follow_up_dt.strftime('%Y-%m-%d %I:%M %p')
    # Otherwise just show date
    return follow_up_dt.strftime('%Y-%m-%d')

def load_ai_summary_cache():
    if os.path.exists(AI_SUMMARY_CACHE_FILE):
        try:
            with open(AI_SUMMARY_CACHE_FILE, 'r') as f:
                return json.load(f)
        except:
            return None
    return None

def save_ai_summary_cache(summary, include_completed_cancelled=False):
    os.makedirs('data', exist_ok=True)
    cache_data = {
        'summary': summary,
        'timestamp': datetime.now().isoformat(),
        'include_completed_cancelled': include_completed_cancelled
    }
    with open(AI_SUMMARY_CACHE_FILE, 'w') as f:
        json.dump(cache_data, f, indent=2)

def load_objectives():
    if os.path.exists(TOPICS_FILE):
        with open(TOPICS_FILE, 'r') as f:
            return json.load(f)
    return []

def save_objectives(objectives):
    os.makedirs('data', exist_ok=True)
    with open(TOPICS_FILE, 'w') as f:
        json.dump(objectives, f, indent=2, default=str)

def load_projects():
    if os.path.exists(PROJECTS_FILE):
        with open(PROJECTS_FILE, 'r') as f:
            data = json.load(f)
            # Handle both old (list) and new (dict with projects/templates) formats
            if isinstance(data, list):
                return data
            elif isinstance(data, dict) and 'projects' in data:
                return data['projects']
            else:
                return data if isinstance(data, list) else []
    return []

def save_projects(projects):
    os.makedirs('data', exist_ok=True)
    # If projects is a dict (new format), save as is
    # If it's a list (old format), just save the list
    with open(PROJECTS_FILE, 'w') as f:
        json.dump(projects, f, indent=2, default=str)

def load_deals():
    if os.path.exists(DEALS_FILE):
        with open(DEALS_FILE, 'r') as f:
            return json.load(f)
    return []

def save_deals(deals):
    os.makedirs('data', exist_ok=True)
    with open(DEALS_FILE, 'w') as f:
        json.dump(deals, f, indent=2, default=str)

def load_meetings():
    if os.path.exists(MEETINGS_FILE):
        with open(MEETINGS_FILE, 'r') as f:
            return json.load(f)
    return []

def save_meetings(meetings):
    os.makedirs('data', exist_ok=True)
    with open(MEETINGS_FILE, 'w') as f:
        json.dump(meetings, f, indent=2, default=str)

def load_meeting_templates():
    if os.path.exists(MEETING_TEMPLATES_FILE):
        with open(MEETING_TEMPLATES_FILE, 'r') as f:
            return json.load(f)
    return {
        'templates': [
            {
                'id': 'weekly-standup',
                'name': 'Weekly Standup',
                'type': 'Standup',
                'duration': 30,
                'agenda': [
                    {'item': 'What did you accomplish last week?', 'duration': 10},
                    {'item': 'What will you work on this week?', 'duration': 10},
                    {'item': 'Any blockers or challenges?', 'duration': 10}
                ]
            },
            {
                'id': 'project-kickoff',
                'name': 'Project Kickoff Meeting',
                'type': 'Project',
                'duration': 60,
                'agenda': [
                    {'item': 'Project overview and objectives', 'duration': 15},
                    {'item': 'Team introductions and roles', 'duration': 15},
                    {'item': 'Timeline and milestones', 'duration': 15},
                    {'item': 'Next steps and action items', 'duration': 15}
                ]
            }
        ]
    }

def save_meeting_templates(templates):
    os.makedirs('data', exist_ok=True)
    with open(MEETING_TEMPLATES_FILE, 'w') as f:
        json.dump(templates, f, indent=2, default=str)

def calculate_financial_year(date_str):
    """Calculate Australian financial year from a date string.
    FY starts July 1st and ends June 30th.
    E.g., July 2025 - June 2026 is FY26"""
    try:
        if isinstance(date_str, str):
            date_obj = datetime.fromisoformat(date_str.replace('Z', '+00:00').split('T')[0])
        else:
            date_obj = date_str
        
        year = date_obj.year
        month = date_obj.month
        
        # If July or later, it's the next FY
        if month >= 7:
            fy_year = year + 1
        else:
            fy_year = year
        
        # Return in FY format (e.g., FY26)
        return f"FY{str(fy_year)[-2:]}"
    except:
        return None

def load_dashboard_layouts():
    if os.path.exists(DASHBOARD_LAYOUTS_FILE):
        with open(DASHBOARD_LAYOUTS_FILE, 'r') as f:
            return json.load(f)
    return {}

def save_dashboard_layout(user_id, layout):
    layouts = load_dashboard_layouts()
    layouts[user_id] = layout
    os.makedirs('data', exist_ok=True)
    with open(DASHBOARD_LAYOUTS_FILE, 'w') as f:
        json.dump(layouts, f, indent=2)

def add_task_history(task_id, field, old_value, new_value, action='modified'):
    """Add history entry to a task"""
    tasks = load_tasks()
    for task in tasks:
        if task.get('id') == task_id:
            if 'history' not in task:
                task['history'] = []
            task['history'].append({
                'timestamp': datetime.now().isoformat(),
                'action': action,
                'field': field,
                'old_value': old_value,
                'new_value': new_value
            })
            save_tasks(tasks)
            break

def find_similar_tasks(task_title, task_description='', customer=''):
    """Find tasks similar to the given task"""
    tasks = load_tasks()
    similar = []
    
    for existing in tasks:
        if existing.get('status') == 'Completed':
            continue
            
        similarity_score = 0
        
        # Check title similarity
        if existing.get('title'):
            title_ratio = difflib.SequenceMatcher(None, task_title.lower(), existing['title'].lower()).ratio()
            similarity_score += title_ratio * 50
        
        # Check description similarity
        if task_description and existing.get('description'):
            desc_ratio = difflib.SequenceMatcher(None, task_description.lower(), existing['description'].lower()).ratio()
            similarity_score += desc_ratio * 30
        
        # Check customer match
        if customer and existing.get('customer_name') == customer:
            similarity_score += 20
        
        if similarity_score > 40:  # Threshold for similarity
            similar.append({
                'task': existing,
                'score': similarity_score
            })
    
    # Sort by similarity score
    similar.sort(key=lambda x: x['score'], reverse=True)
    return similar[:5]  # Return top 5 similar tasks

@app.route('/test')
def test_page():
    """Test route to verify server is working"""
    return """
    <!DOCTYPE html>
    <html>
    <head>
        <title>Server Test</title>
        <style>
            body { font-family: Arial; padding: 20px; background: #f0f0f0; }
            .success { color: green; }
            .info { background: white; padding: 15px; border-radius: 5px; margin: 10px 0; }
        </style>
    </head>
    <body>
        <h1 class="success">✓ Server is Working!</h1>
        <div class="info">
            <h2>Navigation Links:</h2>
            <ul>
                <li><a href="/">Dashboard</a></li>
                <li><a href="/tasks">Tasks</a></li>
                <li><a href="/settings">Settings</a></li>
            </ul>
        </div>
        <div class="info">
            <h2>API Endpoints:</h2>
            <ul>
                <li><a href="/api/tasks">/api/tasks</a> - View tasks JSON</li>
                <li><a href="/api/config">/api/config</a> - View config JSON</li>
                <li><a href="/api/tasks/summary">/api/tasks/summary</a> - View summary JSON</li>
            </ul>
        </div>
    </body>
    </html>
    """

@app.route('/')
def index():
    try:
        # Check if template exists
        import os
        template_path = os.path.join(app.template_folder or 'templates', 'dashboard.html')
        if not os.path.exists(template_path):
            return f"Template not found at: {template_path}", 404
        return render_template('dashboard.html')
    except Exception as e:
        import traceback
        return f"<pre>Error loading dashboard:\n{str(e)}\n\nTraceback:\n{traceback.format_exc()}</pre>", 500

@app.route('/tasks')
def tasks_page():
    try:
        return render_template('tasks.html')
    except Exception as e:
        import traceback
        return f"<pre>Error loading tasks page:\n{str(e)}\n\nTraceback:\n{traceback.format_exc()}</pre>", 500

@app.route('/settings')
def settings_page():
    try:
        return render_template('settings.html')
    except Exception as e:
        import traceback
        return f"<pre>Error loading settings page:\n{str(e)}\n\nTraceback:\n{traceback.format_exc()}</pre>", 500

# Calendar route removed - feature disabled

@app.route('/reports')
def reports_page():
    try:
        return render_template('reports.html')
    except Exception as e:
        import traceback
        return f"<pre>Error loading reports page:\n{str(e)}\n\nTraceback:\n{traceback.format_exc()}</pre>", 500

@app.route('/objectives')
def objectives_page():
    try:
        return render_template('objectives.html')
    except Exception as e:
        import traceback
        return f"<pre>Error loading objectives page:\n{str(e)}\n\nTraceback:\n{traceback.format_exc()}</pre>", 500

@app.route('/objectives/<objective_id>')
def objective_workspace(objective_id):
    try:
        return render_template('objective_workspace.html')
    except Exception as e:
        import traceback
        return f"<pre>Error loading objective workspace:\n{str(e)}\n\nTraceback:\n{traceback.format_exc()}</pre>", 500

@app.route('/projects')
def projects():
    return render_template('projects_enhanced.html')

@app.route('/teams')
def teams():
    return render_template('teams.html')

@app.route('/teams/member/<member_id>')
def member_details(member_id):
    """Display member details page"""
    team_manager = TeamManager()
    member = team_manager.get_member(member_id)
    if not member:
        return "Member not found", 404
    return render_template('member_details.html', member=member)

@app.route('/deals')
def deals():
    return render_template('deals.html')

@app.route('/meetings')
def meetings():
    return render_template('meetings.html')

@app.route('/test-quill')
def test_quill():
    return send_file('test_quill_isolated.html')

@app.route('/inspect-quill')
def inspect_quill():
    return send_file('inspect_quill.html')

@app.route('/check-svg')
def check_svg():
    return send_file('check_svg.html')

@app.route('/test-css-conflict')
def test_css_conflict():
    return send_file('test_css_conflict.html')

@app.route('/test-quill-with-css')
def test_quill_with_css():
    return render_template('test_quill_with_css.html')

@app.route('/diagnose-invisible')
def diagnose_invisible():
    return send_file('diagnose_invisible.html')

@app.route('/projects/<project_id>')
def project_workspace(project_id):
    try:
        return render_template('project_workspace.html')
    except Exception as e:
        import traceback
        return f"<pre>Error loading project workspace:\n{str(e)}\n\nTraceback:\n{traceback.format_exc()}</pre>", 500

@app.route('/api/tasks', methods=['GET'])
def get_tasks():
    tasks = load_tasks()
    return jsonify(tasks)

@app.route('/api/tasks', methods=['POST'])
def create_task():
    task = request.json
    task['id'] = str(uuid.uuid4())
    task['created_date'] = datetime.now().isoformat()
    task['history'] = [{
        'timestamp': datetime.now().isoformat(),
        'action': 'created',
        'field': 'task',
        'old_value': None,
        'new_value': 'Task created'
    }]
    task['comments'] = []
    task['attachments'] = []
    task['dependencies'] = []
    task['blocks'] = []
    
    # Check for similar tasks
    similar = find_similar_tasks(
        task.get('title', ''),
        task.get('description', ''),
        task.get('customer_name', '')
    )
    
    tasks = load_tasks()
    tasks.append(task)
    save_tasks(tasks)
    
    response = {'task': task}
    if similar:
        response['similar_tasks'] = similar
    
    return jsonify(response), 201

@app.route('/api/tasks/<task_id>', methods=['PUT'])
def update_task(task_id):
    tasks = load_tasks()
    task_data = request.json
    for i, task in enumerate(tasks):
        if task['id'] == task_id:
            # Track history for changed fields
            if 'history' not in tasks[i]:
                tasks[i]['history'] = []
                
            # Preserve fields that might not be sent in the update
            preserved_fields = ['history', 'comments', 'attachments', 'dependencies', 'blocks', 'created_date']
            
            for field, new_value in task_data.items():
                if field not in preserved_fields and tasks[i].get(field) != new_value:
                    tasks[i]['history'].append({
                        'timestamp': datetime.now().isoformat(),
                        'action': 'modified',
                        'field': field,
                        'old_value': tasks[i].get(field),
                        'new_value': new_value
                    })
            
            # Update task data while preserving certain fields if not provided
            for field in preserved_fields:
                if field not in task_data and field in tasks[i]:
                    task_data[field] = tasks[i][field]
            
            tasks[i].update(task_data)
            save_tasks(tasks)
            return jsonify(tasks[i])
    return jsonify({'error': 'Task not found'}), 404

@app.route('/api/tasks/<task_id>/dependencies', methods=['PUT'])
def update_task_dependencies(task_id):
    """Update task dependencies"""
    tasks = load_tasks()
    dependencies = request.json.get('dependencies', [])
    
    for task in tasks:
        if task['id'] == task_id:
            task['dependencies'] = dependencies
            
            # Update blocks field for dependent tasks
            for t in tasks:
                if 'blocks' not in t:
                    t['blocks'] = []
                # Remove this task from blocks if no longer dependent
                if task_id in t.get('blocks', []) and t['id'] not in dependencies:
                    t['blocks'].remove(task_id)
                # Add this task to blocks if newly dependent
                elif t['id'] in dependencies and task_id not in t.get('blocks', []):
                    t['blocks'].append(task_id)
            
            save_tasks(tasks)
            return jsonify({'success': True, 'dependencies': dependencies})
    
    return jsonify({'error': 'Task not found'}), 404

@app.route('/api/tasks/<task_id>', methods=['DELETE'])
def delete_task(task_id):
    tasks = load_tasks()
    tasks = [task for task in tasks if task['id'] != task_id]
    save_tasks(tasks)
    return '', 204

@app.route('/api/tasks/summary', methods=['GET'])
def get_summary():
    tasks = load_tasks()
    topics = load_objectives()  # Load objectives
    today = date.today().isoformat()
    
    # Filter out completed and cancelled tasks for active counts
    active_statuses = ['Completed', 'Cancelled']
    active_tasks = [t for t in tasks if t.get('status') not in active_statuses]
    
    # Get active objectives
    active_objectives = [t for t in topics if t.get('status') not in ['Completed']]
    
    # Process objectives for dashboard display
    objectives_with_stats = []
    for obj in active_objectives:
        # Calculate OKR score
        okr_score = 0
        if obj.get('key_results'):
            total_progress = sum(kr.get('progress', 0) for kr in obj['key_results'])
            okr_score = total_progress / len(obj['key_results']) if obj['key_results'] else 0
        
        # Count associated tasks
        obj_tasks = [t for t in active_tasks if t.get('topic_id') == obj['id']]
        completed_obj_tasks = [t for t in tasks if t.get('topic_id') == obj['id'] and t.get('status') == 'Completed']
        
        objectives_with_stats.append({
            'id': obj.get('id'),
            'title': obj.get('title'),
            'type': obj.get('objective_type', 'aspirational'),
            'period': obj.get('period', 'Q1'),
            'confidence': obj.get('confidence', 0.5),
            'okr_score': okr_score,
            'key_results_count': len(obj.get('key_results', [])),
            'key_results_completed': sum(1 for kr in obj.get('key_results', []) if kr.get('progress', 0) >= 1),
            'total_tasks': len(obj_tasks) + len(completed_obj_tasks),
            'active_tasks': len(obj_tasks),
            'completed_tasks': len(completed_obj_tasks),
            'status': obj.get('status', 'Active'),
            'target_date': obj.get('target_date')
        })
    
    # Get all overdue tasks
    overdue_tasks = [t for t in active_tasks if is_overdue(t.get('follow_up_date'), t.get('status'))]
    # Sort overdue tasks by follow-up date (oldest first)
    overdue_tasks = sorted(overdue_tasks, key=lambda x: parse_follow_up_datetime(x.get('follow_up_date')) or datetime.min)
    
    summary = {
        'total': len(active_tasks),  # Only count active tasks
        'open': len([t for t in tasks if t.get('status') == 'Open']),
        'due_today': len([t for t in active_tasks if is_due_today(t.get('follow_up_date'))]),
        'overdue': len(overdue_tasks),
        'overdue_tasks': overdue_tasks,  # Include full list of overdue tasks
        'urgent': [t for t in active_tasks if t.get('priority') == 'Urgent'],
        'by_customer': {},
        'upcoming': [],
        'active_objectives': len(active_objectives),
        'objectives': objectives_with_stats[:5]  # Top 5 objectives for dashboard
    }
    
    # Only show active tasks grouped by customer
    for task in active_tasks:
        customer = task.get('customer_name', 'Unassigned')
        if customer not in summary['by_customer']:
            summary['by_customer'][customer] = []
        summary['by_customer'][customer].append(task)
    
    # Only show upcoming active tasks (not overdue and not due today)
    upcoming = [t for t in active_tasks if t.get('follow_up_date') and 
                not is_overdue(t.get('follow_up_date'), t.get('status')) and 
                not is_due_today(t.get('follow_up_date'))]
    # Sort by datetime properly
    upcoming = sorted(upcoming, key=lambda x: parse_follow_up_datetime(x.get('follow_up_date')) or datetime.max)[:5]
    
    return jsonify(summary)

@app.route('/api/ai/summary/cache-status', methods=['GET'])
def ai_summary_cache_status():
    """Get the cache status without generating a new summary"""
    cached = load_ai_summary_cache()
    if cached:
        cache_time = datetime.fromisoformat(cached['timestamp'])
        age_hours = (datetime.now() - cache_time).total_seconds() / 3600
        
        return jsonify({
            'has_cache': True,
            'age_hours': age_hours,
            'age_minutes': int(age_hours * 60),
            'timestamp': cached['timestamp'],
            'include_completed_cancelled': cached.get('include_completed_cancelled', False),
            'is_valid': age_hours < 3
        })
    
    return jsonify({'has_cache': False})

@app.route('/api/ai/test', methods=['POST'])
def test_api_key():
    """Test if the AI configuration is valid"""
    data = request.json
    test_key = data.get('api_key')
    ai_provider = data.get('ai_provider', 'claude')
    
    if ai_provider == 'claude':
        if not test_key:
            return jsonify({'success': False, 'error': 'No API key provided'}), 400
        
        # Create a simple test prompt
        test_prompt = "Reply with just 'OK' if you can read this message."
        
        # Test the API key
        result = call_ai_api({'api_key': test_key, 'ai_provider': 'claude'}, test_prompt, max_tokens=10)
        
        if result['success']:
            return jsonify({'success': True, 'message': 'Claude API key is valid'})
        else:
            return jsonify({'success': False, 'error': result.get('error', 'API key test failed')}), 400
    
    elif ai_provider == 'none':
        # Local summary mode is always ready
        return jsonify({'success': True, 'message': 'Template mode is ready'})
    
    else:
        return jsonify({'success': False, 'error': f'Unknown AI provider: {ai_provider}'}), 400


@app.route('/api/ai/summary', methods=['POST'])
def ai_summary():
    settings = load_settings()
    ai_provider = settings.get('ai_provider', 'claude')
    
    # Check configuration based on provider
    if ai_provider == 'claude' and not settings.get('api_key'):
        return jsonify({'error': 'Claude API key not configured'}), 400
    elif ai_provider == 'none':
        # Local summary mode doesn't need any configuration
        pass
    
    # Get optional parameter to include completed/cancelled tasks
    data = request.get_json() or {}
    include_completed_cancelled = data.get('includeCompletedCancelled', False)
    force_regenerate = data.get('forceRegenerate', False)
    
    # Check for cached summary
    if not force_regenerate:
        cached = load_ai_summary_cache()
        if cached:
            # Check if cache is valid (less than 3 hours old and same filter setting)
            cache_time = datetime.fromisoformat(cached['timestamp'])
            age_hours = (datetime.now() - cache_time).total_seconds() / 3600
            
            if age_hours < 3 and cached.get('include_completed_cancelled') == include_completed_cancelled:
                # Return cached summary with cache info
                return jsonify({
                    'summary': cached['summary'],
                    'cached': True,
                    'cache_age_minutes': int(age_hours * 60),
                    'cache_timestamp': cached['timestamp']
                })
    
    tasks = load_tasks()
    topics = load_objectives()  # Load objectives
    projects = load_projects()  # Load projects
    deals = load_deals()  # Load deals
    
    # Filter tasks based on the parameter
    if include_completed_cancelled:
        open_tasks = tasks
        active_objectives = topics
        active_projects = projects
        active_deals = deals
    else:
        open_tasks = [t for t in tasks if t.get('status') not in ['Completed', 'Cancelled']]
        active_objectives = [t for t in topics if t.get('status') not in ['Completed']]
        active_projects = [p for p in projects if p.get('status') not in ['Completed']]
        active_deals = [d for d in deals if d.get('dealStatus') != 'Lost']
    
    if not open_tasks and not active_objectives and not active_projects and not active_deals:
        summary_text = 'No active tasks, objectives, projects, or deals to summarize.'
        save_ai_summary_cache(summary_text, include_completed_cancelled)
        return jsonify({'summary': summary_text})
    
    # Build objectives summary
    objectives_text = []
    if active_objectives:
        objectives_text.append("\n**Active Objectives (OKRs):**")
        for obj in active_objectives[:10]:
            obj_info = f"- {obj.get('title', 'Untitled')} ({obj.get('objective_type', 'aspirational').title()}, {obj.get('period', 'Q1')})"
            
            # Add confidence and progress
            if obj.get('confidence'):
                obj_info += f" - Confidence: {int(obj.get('confidence', 0.5) * 100)}%"
            
            # Add key results summary
            if obj.get('key_results'):
                completed_krs = sum(1 for kr in obj['key_results'] if kr.get('progress', 0) >= 1)
                total_krs = len(obj['key_results'])
                obj_info += f" - Key Results: {completed_krs}/{total_krs} completed"
                
                # Calculate overall OKR score
                if total_krs > 0:
                    total_progress = sum(kr.get('progress', 0) for kr in obj['key_results'])
                    okr_score = total_progress / total_krs
                    obj_info += f" (Score: {int(okr_score * 100)}%)"
            
            # Count associated tasks
            obj_tasks = [t for t in open_tasks if t.get('topic_id') == obj['id']]
            if obj_tasks:
                obj_info += f" - {len(obj_tasks)} associated tasks"
            
            objectives_text.append(obj_info)
    
    # Build enhanced tasks summary with overdue detection
    from datetime import datetime as dt, timedelta
    today = dt.now().date()
    tomorrow = today + timedelta(days=1)
    week_from_now = today + timedelta(days=7)
    
    # Categorize tasks by urgency
    overdue_tasks = []
    due_today = []
    due_tomorrow = []
    due_this_week = []
    high_priority = []
    medium_priority = []
    low_priority = []
    no_date_tasks = []
    
    for task in open_tasks:
        # Parse follow-up date
        follow_up_date_str = task.get('follow_up_date', '')
        due_status = ""
        
        if follow_up_date_str:
            try:
                # Handle both date and datetime formats
                if 'T' in follow_up_date_str:
                    follow_up_date = dt.fromisoformat(follow_up_date_str.split('T')[0]).date()
                else:
                    follow_up_date = dt.fromisoformat(follow_up_date_str).date()
                
                # Calculate due status
                if follow_up_date < today:
                    due_status = f"OVERDUE ({(today - follow_up_date).days} days)"
                    overdue_tasks.append((task, due_status))
                elif follow_up_date == today:
                    due_status = "DUE TODAY"
                    due_today.append((task, due_status))
                elif follow_up_date == tomorrow:
                    due_status = "DUE TOMORROW"
                    due_tomorrow.append((task, due_status))
                elif follow_up_date <= week_from_now:
                    due_status = f"Due in {(follow_up_date - today).days} days"
                    due_this_week.append((task, due_status))
                else:
                    due_status = f"Due {follow_up_date.strftime('%Y-%m-%d')}"
            except:
                pass
        
        # Also categorize by priority if not already in urgent lists
        # Check if task ID is in any of the urgent lists
        task_id = task.get('id')
        urgent_task_ids = [t[0].get('id') for t in overdue_tasks + due_today + due_tomorrow]
        if task_id not in urgent_task_ids:
            priority = task.get('priority', 'Medium')
            if priority == 'Critical' or priority == 'High':
                high_priority.append((task, due_status))
            elif priority == 'Medium':
                medium_priority.append((task, due_status))
            elif priority == 'Low':
                low_priority.append((task, due_status))
            else:
                no_date_tasks.append((task, due_status))
    
    # Build structured task descriptions
    task_descriptions = []
    
    # Add overdue tasks first
    if overdue_tasks:
        task_descriptions.append("\n**⚠️ OVERDUE TASKS (Immediate Action Required):**")
        for task, due_status in overdue_tasks[:5]:  # Limit to top 5
            task_descriptions.append(f"- {task.get('title', 'Untitled')} - {due_status} (Priority: {task.get('priority', 'Medium')}, Customer: {task.get('customer_name', 'N/A')})")
    
    # Add tasks due today
    if due_today:
        task_descriptions.append("\n**🔴 DUE TODAY:**")
        for task, due_status in due_today:
            task_descriptions.append(f"- {task.get('title', 'Untitled')} (Priority: {task.get('priority', 'Medium')}, Customer: {task.get('customer_name', 'N/A')})")
    
    # Add tasks due tomorrow
    if due_tomorrow:
        task_descriptions.append("\n**🟡 DUE TOMORROW:**")
        for task, due_status in due_tomorrow:
            task_descriptions.append(f"- {task.get('title', 'Untitled')} (Priority: {task.get('priority', 'Medium')})")
    
    # Add high priority tasks
    if high_priority:
        task_descriptions.append("\n**🔥 HIGH PRIORITY TASKS:**")
        for task, due_status in high_priority[:5]:  # Limit to top 5
            info = f"- {task.get('title', 'Untitled')}"
            if due_status:
                info += f" ({due_status})"
            task_descriptions.append(info)
    
    # Add summary statistics
    task_descriptions.append(f"\n**📊 TASK SUMMARY:**")
    task_descriptions.append(f"- Total active tasks: {len(open_tasks)}")
    task_descriptions.append(f"- Overdue: {len(overdue_tasks)}")
    task_descriptions.append(f"- Due today: {len(due_today)}")
    task_descriptions.append(f"- Due this week: {len(due_this_week)}")
    task_descriptions.append(f"- High/Critical priority: {len([t for t in open_tasks if t.get('priority') in ['High', 'Critical']])}")
    
    # Build projects summary
    projects_text = []
    if active_projects:
        projects_text.append("\n**📂 ACTIVE PROJECTS:**")
        for proj in active_projects[:10]:
            proj_info = f"- {proj.get('title', proj.get('name', 'Untitled'))} ({proj.get('status', 'Active')})"
            
            # Count associated tasks
            proj_tasks = [t for t in open_tasks if t.get('project_id') == proj['id']]
            if proj_tasks:
                proj_info += f" - {len(proj_tasks)} tasks"
            
            # Add milestone info if available
            if proj.get('milestones'):
                active_milestones = [m for m in proj['milestones'] if not m.get('completed')]
                if active_milestones:
                    proj_info += f" - {len(active_milestones)} active milestones"
            
            projects_text.append(proj_info)
    
    # Build deals summary
    deals_text = []
    if active_deals:
        deals_text.append("\n**💰 DEALS OVERVIEW:**")
        
        # Calculate totals
        total_forecast = sum(float(d.get('dealForecast', 0) or 0) for d in active_deals)
        total_actual = sum(float(d.get('dealActual', 0) or 0) for d in active_deals)
        open_deals = [d for d in active_deals if d.get('dealStatus') == 'Open']
        won_deals = [d for d in active_deals if d.get('dealStatus') == 'Won']
        
        deals_text.append(f"- Total deals: {len(active_deals)} (Open: {len(open_deals)}, Won: {len(won_deals)})")
        deals_text.append(f"- Total forecast: ${total_forecast:,.0f}")
        deals_text.append(f"- Total actual: ${total_actual:,.0f}")
        
        # List top open deals
        if open_deals:
            deals_text.append("\n**Open Deals:**")
            for deal in sorted(open_deals, key=lambda d: float(d.get('dealForecast', 0) or 0), reverse=True)[:5]:
                deal_info = f"- {deal.get('customerName', 'Unknown')} - {deal.get('dealType', 'N/A')}"
                if deal.get('dealForecast'):
                    deal_info += f" (${float(deal.get('dealForecast', 0)):,.0f})"
                deals_text.append(deal_info)
    
    # Combine all sections for the prompt
    all_descriptions = objectives_text + task_descriptions + projects_text + deals_text
    
    # Enhanced prompt for consistent structure
    prompt = f"""Generate a task summary using EXACTLY this structure (use these exact section headers):

**🚨 URGENT ITEMS:**
List any overdue or due-today tasks. If none, write "No urgent items."

**📌 PRIORITY ITEMS:**
List the top 3 high/critical priority tasks. Focus on tasks marked as High or Critical priority.

**📅 DUE ITEMS:**
List upcoming tasks with deadlines in the next 7 days (excluding today's items already mentioned).

**💡 RECOMMENDATIONS:**
Provide 2-3 specific action recommendations for task management and productivity.

Important instructions:
- Use bullet points (•) for each item under sections
- Keep each item to one line
- Be specific with task names
- Do not use "Summary:" or similar prefixes
- Do not add any other sections or formatting

Task data:
""" + "\n".join(all_descriptions)
    
    result = call_ai_api(settings, prompt, task_type='summarization', max_tokens=500)
    
    if result['success']:
        summary_text = result['text']
        # Save to cache
        save_ai_summary_cache(summary_text, include_completed_cancelled)
        return jsonify({'summary': summary_text, 'cached': False})
    else:
        # Log the error for debugging
        error_msg = result.get('error', 'Unknown error occurred')
        print(f"AI API Error: {error_msg}")
        return jsonify({'error': error_msg}), 500

@app.route('/api/ai/follow-up', methods=['POST'])
def ai_follow_up():
    settings = load_settings()
    
    if not settings.get('api_key'):
        return jsonify({'error': 'API key not configured'}), 400
    
    data = request.json
    task = data.get('task')
    tone = data.get('tone', 'polite')
    message_type = data.get('message_type', 'email')
    
    tone_instructions = {
        'polite': 'Write in a professional and polite tone',
        'casual': 'Write in a friendly and casual tone',
        'funny': 'Write in a humorous and light-hearted tone while still being professional',
        'forceful': 'Write in a firm and assertive tone, emphasizing urgency'
    }
    
    # Adjust instructions based on message type
    if message_type == 'messenger':
        format_instruction = "Keep it brief and conversational, suitable for instant messaging or chat (2-3 sentences max). Don't include formal greetings or signatures."
        max_tokens = 150
    else:  # email
        format_instruction = "Write a complete email with appropriate greeting, body, and professional closing."
        max_tokens = 300
    
    # Build comprehensive task context
    task_context = f"Title: {task.get('title')}\nDescription: {task.get('description')}\nCustomer: {task.get('customer_name')}\nPriority: {task.get('priority')}"
    
    # Add status and dates if available
    if task.get('status'):
        task_context += f"\nStatus: {task.get('status')}"
    if task.get('follow_up_date'):
        task_context += f"\nDue Date: {task.get('follow_up_date')}"
    if task.get('assigned_to'):
        task_context += f"\nAssigned to: {task.get('assigned_to')}"
    
    # Add comments if they exist
    if task.get('comments') and len(task['comments']) > 0:
        task_context += "\n\nRecent Comments:"
        for comment in task['comments'][-3:]:  # Last 3 comments
            task_context += f"\n- {comment.get('text', '')}"
    
    # Add dependencies context if they exist
    if task.get('dependencies') and len(task['dependencies']) > 0:
        task_context += f"\n\nNote: This task has {len(task['dependencies'])} dependencies that may need to be mentioned."
    
    prompt = f"{tone_instructions.get(tone, tone_instructions['polite'])}. {format_instruction}\n\nWrite a follow-up message for this task:\n\n{task_context}"
    
    result = call_ai_api(settings, prompt, task_type='generation', max_tokens=max_tokens)
    
    if result['success']:
        return jsonify({'message': result['text']})
    else:
        return jsonify({'error': result.get('error', 'Unknown error occurred')}), 500

@app.route('/api/config', methods=['GET'])
def get_config():
    return jsonify(load_config())

@app.route('/api/config', methods=['POST'])
def update_config():
    config = request.json
    save_config(config)
    return jsonify(config)

@app.route('/api/test-notification', methods=['GET'])
def test_notification():
    """Test endpoint - system notifications disabled, using browser notifications only"""
    return jsonify({
        'success': True, 
        'message': 'System notifications disabled. Browser notifications are active when dashboard is open.'
    })

@app.route('/api/tasks/notification-check', methods=['GET'])
def check_notification_tasks():
    """Check for tasks that need notifications (for browser notifications)"""
    tasks = load_tasks()
    
    # Get active tasks only
    active_tasks = [t for t in tasks if t.get('status') not in ['Completed', 'Cancelled']]
    
    # Find overdue tasks
    overdue = []
    for task in active_tasks:
        if is_overdue(task.get('follow_up_date'), task.get('status')):
            overdue.append({
                'id': task.get('id'),
                'title': task.get('title'),
                'follow_up_date': task.get('follow_up_date'),
                'customer_name': task.get('customer_name'),
                'priority': task.get('priority')
            })
    
    # Find tasks due soon (within next hour)
    due_soon = []
    for task in active_tasks:
        follow_up_dt = parse_follow_up_datetime(task.get('follow_up_date'))
        if follow_up_dt:
            time_until_due = (follow_up_dt - datetime.now()).total_seconds()
            # Due within next hour but not overdue
            if 0 < time_until_due <= 3600:
                due_soon.append({
                    'id': task.get('id'),
                    'title': task.get('title'),
                    'follow_up_date': task.get('follow_up_date'),
                    'customer_name': task.get('customer_name'),
                    'priority': task.get('priority'),
                    'minutesUntilDue': time_until_due / 60
                })
    
    # Find tasks due today (but not overdue or due soon)
    due_today = []
    for task in active_tasks:
        if is_due_today(task.get('follow_up_date')) and not is_overdue(task.get('follow_up_date'), task.get('status')):
            follow_up_dt = parse_follow_up_datetime(task.get('follow_up_date'))
            if follow_up_dt:
                time_until_due = (follow_up_dt - datetime.now()).total_seconds()
                # Only include if more than 1 hour away (otherwise it's in due_soon)
                if time_until_due > 3600:
                    due_today.append({
                        'id': task.get('id'),
                        'title': task.get('title'),
                        'follow_up_date': task.get('follow_up_date'),
                        'customer_name': task.get('customer_name'),
                        'priority': task.get('priority')
                    })
    
    return jsonify({
        'overdue': overdue,
        'dueSoon': due_soon,
        'dueToday': due_today
    })

@app.route('/api/settings', methods=['GET'])
def get_settings():
    settings = load_settings()
    settings_safe = settings.copy()
    if settings_safe.get('api_key'):
        settings_safe['api_key'] = '***' + settings_safe['api_key'][-4:]
    return jsonify(settings_safe)

@app.route('/api/settings', methods=['POST'])
def update_settings():
    new_settings = request.json
    current_settings = load_settings()
    
    if new_settings.get('api_key') and not new_settings['api_key'].startswith('***'):
        current_settings['api_key'] = new_settings['api_key']
    
    # Handle AI provider selection
    if 'ai_provider' in new_settings:
        current_settings['ai_provider'] = new_settings['ai_provider']
        
        # No model initialization needed anymore
    
    for key in ['notifications_enabled', 'check_interval']:
        if key in new_settings:
            current_settings[key] = new_settings[key]
    
    save_settings(current_settings)
    return jsonify({'success': True})

@app.route('/api/export', methods=['GET'])
def export_tasks():
    tasks = load_tasks()
    return jsonify(tasks)

@app.route('/api/import', methods=['POST'])
def import_tasks():
    imported_tasks = request.json
    if not isinstance(imported_tasks, list):
        return jsonify({'error': 'Invalid format'}), 400
    
    current_tasks = load_tasks()
    for task in imported_tasks:
        if 'id' not in task:
            task['id'] = str(uuid.uuid4())
        if not any(t['id'] == task['id'] for t in current_tasks):
            current_tasks.append(task)
    
    save_tasks(current_tasks)
    return jsonify({'imported': len(imported_tasks)})

# Template endpoints
@app.route('/api/templates', methods=['GET'])
def get_templates():
    templates_data = load_templates()
    return jsonify(templates_data.get('templates', []))

@app.route('/api/templates', methods=['POST'])
def create_template():
    template = request.json
    if 'id' not in template:
        template['id'] = str(uuid.uuid4())
    templates_data = load_templates()
    if 'templates' not in templates_data:
        templates_data['templates'] = []
    templates_data['templates'].append(template)
    save_templates(templates_data)
    return jsonify(template), 201

@app.route('/api/templates/<template_identifier>', methods=['DELETE'])
def delete_template(template_identifier):
    templates_data = load_templates()
    # Support deletion by both ID and name
    templates_data['templates'] = [
        t for t in templates_data['templates'] 
        if t.get('id') != template_identifier and t.get('name') != template_identifier
    ]
    save_templates(templates_data)
    return '', 204

# Topics API endpoints
@app.route('/api/topics', methods=['GET'])
def get_objectives():
    objectives = load_objectives()
    return jsonify(objectives)

@app.route('/api/topics', methods=['POST'])
def create_objective():
    objective = request.json
    objective['id'] = str(uuid.uuid4())
    objective['created_at'] = datetime.now().isoformat()
    objective['updated_at'] = datetime.now().isoformat()
    
    # Set default status if not provided
    if 'status' not in objective:
        objective['status'] = 'Active'
    
    # Initialize key results if not provided
    if 'key_results' not in objective:
        objective['key_results'] = []
    else:
        # Add IDs to key results if not present
        for kr in objective['key_results']:
            if 'id' not in kr:
                kr['id'] = str(uuid.uuid4())
            if 'progress' not in kr:
                kr['progress'] = 0
            if 'status' not in kr:
                kr['status'] = 'Not Started'
    
    # OKR specific fields
    if 'objective_type' not in objective:
        objective['objective_type'] = 'aspirational'  # or 'committed'
    if 'confidence' not in objective:
        objective['confidence'] = 0.5  # 50% confidence by default
    if 'period' not in objective:
        objective['period'] = 'Q1'  # Default quarter
    
    objectives = load_objectives()
    objectives.append(objective)
    save_objectives(objectives)
    return jsonify(objective), 201

@app.route('/api/topics/<topic_id>', methods=['GET'])
def get_objective(topic_id):
    objectives = load_objectives()
    objective = next((o for o in objectives if o['id'] == topic_id), None)
    if objective:
        # Get tasks associated with this objective
        tasks = load_tasks()
        objective_tasks = [t for t in tasks if t.get('topic_id') == topic_id]
        objective['tasks'] = objective_tasks
        objective['task_count'] = len(objective_tasks)
        objective['open_tasks'] = len([t for t in objective_tasks if t.get('status') not in ['Completed', 'Cancelled']])
        return jsonify(objective)
    return jsonify({'error': 'Objective not found'}), 404

@app.route('/api/topics/<topic_id>', methods=['PUT'])
def update_objective(topic_id):
    objectives = load_objectives()
    objective_index = next((i for i, o in enumerate(objectives) if o['id'] == topic_id), None)
    
    if objective_index is not None:
        updated_objective = request.json
        updated_objective['id'] = topic_id
        updated_objective['updated_at'] = datetime.now().isoformat()
        
        # Ensure key results have IDs
        if 'key_results' in updated_objective:
            for kr in updated_objective['key_results']:
                if 'id' not in kr:
                    kr['id'] = str(uuid.uuid4())
                if 'progress' not in kr:
                    kr['progress'] = 0
                if 'status' not in kr:
                    kr['status'] = 'Not Started'
        
        # Calculate overall OKR score based on key results
        if 'key_results' in updated_objective and len(updated_objective['key_results']) > 0:
            total_progress = sum(kr.get('progress', 0) for kr in updated_objective['key_results'])
            updated_objective['okr_score'] = total_progress / len(updated_objective['key_results'])
        else:
            updated_objective['okr_score'] = 0
        
        objectives[objective_index] = updated_objective
        save_objectives(objectives)
        return jsonify(updated_objective)
    
    return jsonify({'error': 'Objective not found'}), 404

# DELETE endpoint moved below to avoid duplication

@app.route('/api/topics/<topic_id>/tasks', methods=['GET'])
def get_objective_tasks(topic_id):
    tasks = load_tasks()
    topic_tasks = [t for t in tasks if t.get('topic_id') == topic_id]
    return jsonify(topic_tasks)

@app.route('/api/topics/<topic_id>/notes', methods=['PUT'])
def update_objective_notes(topic_id):
    objectives = load_objectives()
    objective_index = next((i for i, o in enumerate(objectives) if o['id'] == topic_id), None)
    
    if objective_index is not None:
        notes_data = request.json
        objectives[objective_index]['notes'] = notes_data.get('notes', '')
        objectives[objective_index]['updated_at'] = datetime.now().isoformat()
        
        save_objectives(objectives)
        return jsonify({'success': True})
    
    return jsonify({'error': 'Objective not found'}), 404

@app.route('/api/topics/<topic_id>', methods=['DELETE'])
def delete_objective(topic_id):
    objectives = load_objectives()
    objective_index = next((i for i, o in enumerate(objectives) if o['id'] == topic_id), None)
    
    if objective_index is not None:
        # Remove the objective
        deleted_objective = objectives.pop(objective_index)
        save_objectives(objectives)
        
        # Remove objective association from tasks
        tasks = load_tasks()
        tasks_updated = False
        for task in tasks:
            if task.get('topic_id') == topic_id:
                del task['topic_id']
                tasks_updated = True
        
        if tasks_updated:
            save_tasks(tasks)
        
        return jsonify({'success': True, 'deleted': deleted_objective})
    
    return jsonify({'error': 'Objective not found'}), 404

# Initialize project manager
project_manager = ProjectManager()

# Projects (Topics) endpoints
@app.route('/api/projects', methods=['GET'])
def get_projects():
    projects = load_projects()
    # Add calculated fields for each project
    for project in projects:
        # Add health score - handle potential errors gracefully
        try:
            health = project_manager.calculate_project_health_score(project['id'])
            if 'error' not in health:
                project['health_score'] = health.get('overall_score', 50)
                project['health_status'] = health.get('health_status', 'Unknown')
                project['health_color'] = health.get('health_color', 'gray')
            else:
                # Default values if health calculation fails
                project['health_score'] = 50
                project['health_status'] = 'Unknown'
                project['health_color'] = 'gray'
        except Exception as e:
            # If any error occurs, use default values
            project['health_score'] = 50
            project['health_status'] = 'Unknown'
            project['health_color'] = 'gray'
            app.logger.warning(f"Failed to calculate health for project {project['id']}: {str(e)}")
    return jsonify(projects)

@app.route('/api/projects', methods=['POST'])
def create_project():
    project = request.json
    project['id'] = str(uuid.uuid4())
    project['created_at'] = datetime.now().isoformat()
    project['updated_at'] = datetime.now().isoformat()
    
    # Set default values
    if 'status' not in project:
        project['status'] = 'Planning'
    if 'notes' not in project:
        project['notes'] = ''
    
    projects = load_projects()
    projects.append(project)
    save_projects(projects)
    
    return jsonify(project), 201

@app.route('/api/projects/<project_id>', methods=['GET'])
def get_project(project_id):
    projects = load_projects()
    project = next((p for p in projects if p['id'] == project_id), None)
    
    if project:
        return jsonify(project)
    
    return jsonify({'error': 'Project not found'}), 404

@app.route('/api/projects/<project_id>', methods=['PUT'])
def update_project(project_id):
    projects = load_projects()
    project_index = next((i for i, p in enumerate(projects) if p['id'] == project_id), None)
    
    if project_index is not None:
        updated_data = request.json
        projects[project_index].update(updated_data)
        projects[project_index]['updated_at'] = datetime.now().isoformat()
        
        save_projects(projects)
        return jsonify(projects[project_index])
    
    return jsonify({'error': 'Project not found'}), 404

# DELETE endpoint moved below to avoid duplication

@app.route('/api/projects/<project_id>/tasks', methods=['GET'])
def get_project_tasks(project_id):
    tasks = load_tasks()
    project_tasks = [t for t in tasks if t.get('project_id') == project_id]
    return jsonify(project_tasks)

@app.route('/api/projects/<project_id>/notes', methods=['PUT'])
def update_project_notes(project_id):
    projects = load_projects()
    project_index = next((i for i, p in enumerate(projects) if p['id'] == project_id), None)
    
    if project_index is not None:
        notes_data = request.json
        projects[project_index]['notes'] = notes_data.get('notes', '')
        projects[project_index]['updated_at'] = datetime.now().isoformat()
        
        save_projects(projects)
        return jsonify({'success': True})
    
    return jsonify({'error': 'Project not found'}), 404

@app.route('/api/projects/<project_id>', methods=['DELETE'])
def delete_project(project_id):
    projects = load_projects()
    project_index = next((i for i, p in enumerate(projects) if p['id'] == project_id), None)
    
    if project_index is not None:
        # Remove the project
        deleted_project = projects.pop(project_index)
        save_projects(projects)
        
        # Remove project association from tasks
        tasks = load_tasks()
        tasks_updated = False
        for task in tasks:
            if task.get('project_id') == project_id:
                del task['project_id']
                tasks_updated = True
        
        if tasks_updated:
            save_tasks(tasks)
        
        return jsonify({'success': True, 'deleted': deleted_project})
    
    return jsonify({'error': 'Project not found'}), 404

# Enhanced Project Management Endpoints

# Project Phases
@app.route('/api/projects/<project_id>/phases', methods=['GET'])
def get_project_phases(project_id):
    project = project_manager.get_project(project_id)
    if project:
        return jsonify(project.get('phases', []))
    return jsonify({'error': 'Project not found'}), 404

@app.route('/api/projects/<project_id>/phases', methods=['POST'])
def create_project_phase(project_id):
    projects = load_projects()
    project_index = next((i for i, p in enumerate(projects) if p['id'] == project_id), None)
    
    if project_index is not None:
        phase = request.json
        phase['id'] = str(uuid.uuid4())
        phase['status'] = phase.get('status', 'Not Started')
        phase['progress'] = phase.get('progress', 0)
        phase['milestones'] = phase.get('milestones', [])
        
        if 'phases' not in projects[project_index]:
            projects[project_index]['phases'] = []
        
        projects[project_index]['phases'].append(phase)
        save_projects(projects)
        return jsonify(phase), 201
    
    return jsonify({'error': 'Project not found'}), 404

@app.route('/api/projects/<project_id>/phases/<phase_id>', methods=['PUT'])
def update_project_phase(project_id, phase_id):
    projects = load_projects()
    project_index = next((i for i, p in enumerate(projects) if p['id'] == project_id), None)
    
    if project_index is not None:
        phases = projects[project_index].get('phases', [])
        phase_index = next((i for i, p in enumerate(phases) if p['id'] == phase_id), None)
        
        if phase_index is not None:
            phases[phase_index].update(request.json)
            save_projects(projects)
            return jsonify(phases[phase_index])
        
        return jsonify({'error': 'Phase not found'}), 404
    
    return jsonify({'error': 'Project not found'}), 404

@app.route('/api/projects/<project_id>/phases/<phase_id>', methods=['DELETE'])
def delete_project_phase(project_id, phase_id):
    projects = load_projects()
    project_index = next((i for i, p in enumerate(projects) if p['id'] == project_id), None)
    
    if project_index is not None:
        phases = projects[project_index].get('phases', [])
        phase_index = next((i for i, p in enumerate(phases) if p['id'] == phase_id), None)
        
        if phase_index is not None:
            deleted_phase = phases.pop(phase_index)
            save_projects(projects)
            return jsonify({'success': True, 'deleted': deleted_phase})
        
        return jsonify({'error': 'Phase not found'}), 404
    
    return jsonify({'error': 'Project not found'}), 404

# Milestones
@app.route('/api/projects/<project_id>/milestones', methods=['GET'])
def get_project_milestones(project_id):
    project = project_manager.get_project(project_id)
    if project:
        milestones = []
        for phase in project.get('phases', []):
            for milestone in phase.get('milestones', []):
                milestone['phase_id'] = phase['id']
                milestone['phase_name'] = phase['name']
                milestones.append(milestone)
        return jsonify(milestones)
    return jsonify({'error': 'Project not found'}), 404

@app.route('/api/projects/<project_id>/milestones', methods=['POST'])
def create_project_milestone(project_id):
    projects = load_projects()
    project_index = next((i for i, p in enumerate(projects) if p['id'] == project_id), None)
    
    if project_index is not None:
        milestone_data = request.json
        phase_id = milestone_data.get('phase_id')
        
        if not phase_id:
            return jsonify({'error': 'Phase ID required'}), 400
        
        phases = projects[project_index].get('phases', [])
        phase_index = next((i for i, p in enumerate(phases) if p['id'] == phase_id), None)
        
        if phase_index is not None:
            milestone = {
                'id': str(uuid.uuid4()),
                'name': milestone_data.get('name'),
                'description': milestone_data.get('description', ''),
                'due_date': milestone_data.get('due_date'),
                'status': milestone_data.get('status', 'Pending'),
                'type': milestone_data.get('type', 'Deliverable'),
                'dependencies': milestone_data.get('dependencies', [])
            }
            
            if 'milestones' not in phases[phase_index]:
                phases[phase_index]['milestones'] = []
            
            phases[phase_index]['milestones'].append(milestone)
            save_projects(projects)
            return jsonify(milestone), 201
        
        return jsonify({'error': 'Phase not found'}), 404
    
    return jsonify({'error': 'Project not found'}), 404

# Gantt Chart Data
@app.route('/api/projects/<project_id>/gantt', methods=['GET'])
def get_project_gantt(project_id):
    project = project_manager.get_project(project_id)
    if project:
        tasks = project_manager.get_project_tasks(project_id)
        
        # Format tasks for Gantt chart
        gantt_tasks = []
        for task in tasks:
            gantt_props = task.get('gantt_properties', {})
            # Handle dependencies - it's a list, not a dict
            dependencies = task.get('dependencies', [])
            if isinstance(dependencies, dict):
                # If it's a dict (future format), get depends_on
                dependencies = dependencies.get('depends_on', [])
            
            gantt_task = {
                'id': task['id'],
                'name': task.get('title', 'Unnamed Task'),
                'start': gantt_props.get('start_date') or task.get('created_date'),
                'end': gantt_props.get('end_date') or task.get('follow_up_date'),
                'progress': gantt_props.get('progress', 0),
                'dependencies': dependencies,
                'is_critical': gantt_props.get('is_critical_path', False),
                'resource': task.get('assigned_to', ''),
                'phase_id': task.get('phase_id'),
                'milestone_id': task.get('milestone_id')
            }
            gantt_tasks.append(gantt_task)
        
        # Get critical path
        critical_path_data = project_manager.calculate_critical_path(project_id)
        
        return jsonify({
            'tasks': gantt_tasks,
            'critical_path': critical_path_data.get('critical_path', []),
            'project_duration': critical_path_data.get('project_duration', 0),
            'slack_times': critical_path_data.get('slack_times', {}),
            'gantt_data': project.get('gantt_data', {})
        })
    
    return jsonify({'error': 'Project not found'}), 404

@app.route('/api/projects/<project_id>/gantt', methods=['PUT'])
def update_project_gantt(project_id):
    projects = load_projects()
    project_index = next((i for i, p in enumerate(projects) if p['id'] == project_id), None)
    
    if project_index is not None:
        gantt_data = request.json
        
        # Update gantt data
        if 'gantt_data' not in projects[project_index]:
            projects[project_index]['gantt_data'] = {}
        
        projects[project_index]['gantt_data'].update(gantt_data)
        
        # Update task gantt properties if provided
        if 'tasks' in gantt_data:
            tasks = load_tasks()
            for gantt_task in gantt_data['tasks']:
                task_index = next((i for i, t in enumerate(tasks) if t['id'] == gantt_task['id']), None)
                if task_index is not None:
                    if 'gantt_properties' not in tasks[task_index]:
                        tasks[task_index]['gantt_properties'] = {}
                    
                    tasks[task_index]['gantt_properties'].update({
                        'start_date': gantt_task.get('start'),
                        'end_date': gantt_task.get('end'),
                        'progress': gantt_task.get('progress', 0),
                        'duration': gantt_task.get('duration'),
                        'is_critical_path': gantt_task.get('is_critical', False)
                    })
            
            save_tasks(tasks)
        
        save_projects(projects)
        return jsonify({'success': True})
    
    return jsonify({'error': 'Project not found'}), 404

# Critical Path Analysis
@app.route('/api/projects/<project_id>/critical-path', methods=['GET'])
def get_project_critical_path(project_id):
    result = project_manager.calculate_critical_path(project_id)
    if 'error' in result:
        return jsonify(result), 404
    return jsonify(result)

# Resource Management
@app.route('/api/projects/<project_id>/resources', methods=['GET'])
def get_project_resources(project_id):
    project = project_manager.get_project(project_id)
    if project:
        return jsonify(project.get('resources', []))
    return jsonify({'error': 'Project not found'}), 404

@app.route('/api/projects/<project_id>/resources', methods=['POST'])
def assign_project_resource(project_id):
    projects = load_projects()
    project_index = next((i for i, p in enumerate(projects) if p['id'] == project_id), None)
    
    if project_index is not None:
        resource = request.json
        resource['id'] = str(uuid.uuid4())
        
        if 'resources' not in projects[project_index]:
            projects[project_index]['resources'] = []
        
        projects[project_index]['resources'].append(resource)
        save_projects(projects)
        return jsonify(resource), 201
    
    return jsonify({'error': 'Project not found'}), 404

@app.route('/api/projects/<project_id>/resources/<resource_id>', methods=['PUT'])
def update_project_resource(project_id, resource_id):
    projects = load_projects()
    project_index = next((i for i, p in enumerate(projects) if p['id'] == project_id), None)
    
    if project_index is not None:
        resources = projects[project_index].get('resources', [])
        resource_index = next((i for i, r in enumerate(resources) if r['id'] == resource_id), None)
        
        if resource_index is not None:
            resources[resource_index].update(request.json)
            save_projects(projects)
            return jsonify(resources[resource_index])
        
        return jsonify({'error': 'Resource not found'}), 404
    
    return jsonify({'error': 'Project not found'}), 404

@app.route('/api/projects/<project_id>/resources/<resource_id>', methods=['DELETE'])
def remove_project_resource(project_id, resource_id):
    projects = load_projects()
    project_index = next((i for i, p in enumerate(projects) if p['id'] == project_id), None)
    
    if project_index is not None:
        resources = projects[project_index].get('resources', [])
        resource_index = next((i for i, r in enumerate(resources) if r['id'] == resource_id), None)
        
        if resource_index is not None:
            deleted_resource = resources.pop(resource_index)
            save_projects(projects)
            return jsonify({'success': True, 'deleted': deleted_resource})
        
        return jsonify({'error': 'Resource not found'}), 404
    
    return jsonify({'error': 'Project not found'}), 404

# Resource Utilization
@app.route('/api/projects/<project_id>/resource-utilization', methods=['GET'])
def get_resource_utilization(project_id):
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    
    result = project_manager.calculate_resource_utilization(project_id, start_date, end_date)
    if 'error' in result:
        return jsonify(result), 404
    return jsonify(result)

# Budget Tracking
@app.route('/api/projects/<project_id>/budget', methods=['GET'])
def get_project_budget(project_id):
    project = project_manager.get_project(project_id)
    if project:
        budget = project.get('budget', {})
        # Add forecast data
        forecast = project_manager.calculate_budget_forecast(project_id)
        budget['forecast'] = forecast
        return jsonify(budget)
    return jsonify({'error': 'Project not found'}), 404

@app.route('/api/projects/<project_id>/budget', methods=['PUT'])
def update_project_budget(project_id):
    projects = load_projects()
    project_index = next((i for i, p in enumerate(projects) if p['id'] == project_id), None)
    
    if project_index is not None:
        budget_data = request.json
        
        if 'budget' not in projects[project_index]:
            projects[project_index]['budget'] = {
                'total_budget': 0,
                'currency': 'USD',
                'budget_breakdown': [],
                'expense_items': []
            }
        
        projects[project_index]['budget'].update(budget_data)
        save_projects(projects)
        return jsonify(projects[project_index]['budget'])
    
    return jsonify({'error': 'Project not found'}), 404

@app.route('/api/projects/<project_id>/expenses', methods=['POST'])
def add_project_expense(project_id):
    projects = load_projects()
    project_index = next((i for i, p in enumerate(projects) if p['id'] == project_id), None)
    
    if project_index is not None:
        expense = request.json
        expense['id'] = str(uuid.uuid4())
        expense['date'] = expense.get('date', datetime.now().isoformat())
        
        if 'budget' not in projects[project_index]:
            projects[project_index]['budget'] = {
                'total_budget': 0,
                'currency': 'USD',
                'budget_breakdown': [],
                'expense_items': []
            }
        
        if 'expense_items' not in projects[project_index]['budget']:
            projects[project_index]['budget']['expense_items'] = []
        
        projects[project_index]['budget']['expense_items'].append(expense)
        
        # Update category spending
        category = expense.get('category')
        if category:
            for cat in projects[project_index]['budget'].get('budget_breakdown', []):
                if cat['category'] == category:
                    if expense.get('status') == 'Spent':
                        cat['spent'] = cat.get('spent', 0) + expense['amount']
                    elif expense.get('status') == 'Committed':
                        cat['committed'] = cat.get('committed', 0) + expense['amount']
                    break
        
        save_projects(projects)
        return jsonify(expense), 201
    
    return jsonify({'error': 'Project not found'}), 404

# Risk Management
@app.route('/api/projects/<project_id>/risks', methods=['GET'])
def get_project_risks(project_id):
    project = project_manager.get_project(project_id)
    if project:
        return jsonify(project.get('risks', []))
    return jsonify({'error': 'Project not found'}), 404

@app.route('/api/projects/<project_id>/risks', methods=['POST'])
def create_project_risk(project_id):
    projects = load_projects()
    project_index = next((i for i, p in enumerate(projects) if p['id'] == project_id), None)
    
    if project_index is not None:
        risk = request.json
        risk['id'] = str(uuid.uuid4())
        risk['identified_date'] = risk.get('identified_date', datetime.now().isoformat())
        risk['status'] = risk.get('status', 'Open')
        
        # Calculate risk score
        probability_scores = {'Low': 1, 'Medium': 2, 'High': 3}
        impact_scores = {'Low': 1, 'Medium': 2, 'High': 3, 'Critical': 4}
        
        prob_score = probability_scores.get(risk.get('probability', 'Low'), 1)
        impact_score = impact_scores.get(risk.get('impact', 'Low'), 1)
        risk['risk_score'] = prob_score * impact_score
        
        if 'risks' not in projects[project_index]:
            projects[project_index]['risks'] = []
        
        projects[project_index]['risks'].append(risk)
        save_projects(projects)
        return jsonify(risk), 201
    
    return jsonify({'error': 'Project not found'}), 404

@app.route('/api/projects/<project_id>/risks/<risk_id>', methods=['PUT'])
def update_project_risk(project_id, risk_id):
    projects = load_projects()
    project_index = next((i for i, p in enumerate(projects) if p['id'] == project_id), None)
    
    if project_index is not None:
        risks = projects[project_index].get('risks', [])
        risk_index = next((i for i, r in enumerate(risks) if r['id'] == risk_id), None)
        
        if risk_index is not None:
            updated_risk = request.json
            
            # Recalculate risk score if probability or impact changed
            if 'probability' in updated_risk or 'impact' in updated_risk:
                probability_scores = {'Low': 1, 'Medium': 2, 'High': 3}
                impact_scores = {'Low': 1, 'Medium': 2, 'High': 3, 'Critical': 4}
                
                prob = updated_risk.get('probability', risks[risk_index].get('probability', 'Low'))
                impact = updated_risk.get('impact', risks[risk_index].get('impact', 'Low'))
                
                prob_score = probability_scores.get(prob, 1)
                impact_score = impact_scores.get(impact, 1)
                updated_risk['risk_score'] = prob_score * impact_score
            
            risks[risk_index].update(updated_risk)
            save_projects(projects)
            return jsonify(risks[risk_index])
        
        return jsonify({'error': 'Risk not found'}), 404
    
    return jsonify({'error': 'Project not found'}), 404

@app.route('/api/projects/<project_id>/risks/<risk_id>', methods=['DELETE'])
def delete_project_risk(project_id, risk_id):
    projects = load_projects()
    project_index = next((i for i, p in enumerate(projects) if p['id'] == project_id), None)
    
    if project_index is not None:
        risks = projects[project_index].get('risks', [])
        risk_index = next((i for i, r in enumerate(risks) if r['id'] == risk_id), None)
        
        if risk_index is not None:
            deleted_risk = risks.pop(risk_index)
            save_projects(projects)
            return jsonify({'success': True, 'deleted': deleted_risk})
        
        return jsonify({'error': 'Risk not found'}), 404
    
    return jsonify({'error': 'Project not found'}), 404

# Templates
@app.route('/api/project-templates', methods=['GET'])
def get_project_templates():
    templates = project_manager.load_templates()
    return jsonify(templates)

@app.route('/api/project-templates', methods=['POST'])
def create_project_template():
    template = request.json
    template['id'] = str(uuid.uuid4())
    
    projects_data = load_projects()
    
    # Ensure we have the right structure
    if isinstance(projects_data, list):
        # Convert to dict with projects and templates
        projects_data = {
            'projects': projects_data,
            'templates': []
        }
    
    if 'templates' not in projects_data:
        projects_data['templates'] = []
    
    projects_data['templates'].append(template)
    save_projects(projects_data)
    
    return jsonify(template), 201

@app.route('/api/projects/from-template/<template_id>', methods=['POST'])
def create_project_from_template(template_id):
    project_data = request.json
    result = project_manager.create_project_from_template(template_id, project_data)
    
    if 'error' in result:
        return jsonify(result), 404
    
    return jsonify(result), 201

# Project Health Score
@app.route('/api/projects/<project_id>/health', methods=['GET'])
def get_project_health(project_id):
    health = project_manager.calculate_project_health_score(project_id)
    if 'error' in health:
        return jsonify(health), 404
    return jsonify(health)

# Portfolio Management
@app.route('/api/portfolio/dashboard', methods=['GET'])
def get_portfolio_dashboard():
    projects = load_projects()
    
    # Calculate portfolio metrics
    total_projects = len(projects)
    active_projects = sum(1 for p in projects if p.get('status') in ['Active', 'In Progress'])
    completed_projects = sum(1 for p in projects if p.get('status') == 'Completed')
    
    # Budget summary
    total_budget = sum(p.get('budget', {}).get('total_budget', 0) for p in projects)
    total_spent = 0
    
    for project in projects:
        expenses = project.get('budget', {}).get('expense_items', [])
        total_spent += sum(e['amount'] for e in expenses if e.get('status') == 'Spent')
    
    # Resource utilization across projects
    all_resources = {}
    for project in projects:
        for resource in project.get('resources', []):
            resource_id = resource['id']
            if resource_id not in all_resources:
                all_resources[resource_id] = {
                    'name': resource['name'],
                    'projects': [],
                    'total_allocation': 0
                }
            all_resources[resource_id]['projects'].append(project['name'])
            all_resources[resource_id]['total_allocation'] += resource.get('allocation_percentage', 0)
    
    # Health summary
    health_summary = {'Excellent': 0, 'Good': 0, 'At Risk': 0, 'Critical': 0}
    for project in projects:
        health = project_manager.calculate_project_health_score(project['id'])
        if 'error' not in health:
            health_summary[health['health_status']] = health_summary.get(health['health_status'], 0) + 1
    
    return jsonify({
        'summary': {
            'total_projects': total_projects,
            'active_projects': active_projects,
            'completed_projects': completed_projects,
            'total_budget': total_budget,
            'total_spent': total_spent,
            'budget_utilization': (total_spent / total_budget * 100) if total_budget > 0 else 0
        },
        'resources': list(all_resources.values()),
        'health_summary': health_summary,
        'projects': projects
    })

@app.route('/api/portfolio/resource-utilization', methods=['GET'])
def get_portfolio_resource_utilization():
    projects = load_projects()
    
    # Aggregate resource utilization across all projects
    resource_data = {}
    
    for project in projects:
        util = project_manager.calculate_resource_utilization(project['id'])
        if 'error' not in util:
            for resource_id, data in util['utilization'].items():
                if resource_id not in resource_data:
                    resource_data[resource_id] = {
                        'name': data['name'],
                        'projects': [],
                        'total_hours': 0,
                        'total_allocation': 0
                    }
                
                resource_data[resource_id]['projects'].append({
                    'project_id': project['id'],
                    'project_name': project['name'],
                    'allocation': data['utilization_percentage'],
                    'hours': data['allocated_hours']
                })
                resource_data[resource_id]['total_hours'] += data['allocated_hours']
                resource_data[resource_id]['total_allocation'] += data['utilization_percentage']
    
    return jsonify(resource_data)

# Integration with existing tasks
@app.route('/api/projects/<project_id>/link-task', methods=['POST'])
def link_task_to_project(project_id):
    task_id = request.json.get('task_id')
    phase_id = request.json.get('phase_id')
    milestone_id = request.json.get('milestone_id')
    
    if not task_id:
        return jsonify({'error': 'Task ID required'}), 400
    
    tasks = load_tasks()
    task_index = next((i for i, t in enumerate(tasks) if t['id'] == task_id), None)
    
    if task_index is not None:
        tasks[task_index]['project_id'] = project_id
        
        if phase_id:
            tasks[task_index]['phase_id'] = phase_id
        
        if milestone_id:
            tasks[task_index]['milestone_id'] = milestone_id
        
        save_tasks(tasks)
        
        # Update project task list
        projects = load_projects()
        project_index = next((i for i, p in enumerate(projects) if p['id'] == project_id), None)
        
        if project_index is not None:
            if 'task_ids' not in projects[project_index]:
                projects[project_index]['task_ids'] = []
            
            if task_id not in projects[project_index]['task_ids']:
                projects[project_index]['task_ids'].append(task_id)
                save_projects(projects)
        
        return jsonify({'success': True})
    
    return jsonify({'error': 'Task not found'}), 404

@app.route('/api/projects/<project_id>/unlink-task/<task_id>', methods=['DELETE'])
def unlink_task_from_project(project_id, task_id):
    tasks = load_tasks()
    task_index = next((i for i, t in enumerate(tasks) if t['id'] == task_id), None)
    
    if task_index is not None:
        if 'project_id' in tasks[task_index]:
            del tasks[task_index]['project_id']
        if 'phase_id' in tasks[task_index]:
            del tasks[task_index]['phase_id']
        if 'milestone_id' in tasks[task_index]:
            del tasks[task_index]['milestone_id']
        
        save_tasks(tasks)
        
        # Update project task list
        projects = load_projects()
        project_index = next((i for i, p in enumerate(projects) if p['id'] == project_id), None)
        
        if project_index is not None:
            if 'task_ids' in projects[project_index] and task_id in projects[project_index]['task_ids']:
                projects[project_index]['task_ids'].remove(task_id)
                save_projects(projects)
        
        return jsonify({'success': True})
    
    return jsonify({'error': 'Task not found'}), 404

# Reports
@app.route('/api/projects/<project_id>/reports/progress', methods=['GET'])
def get_project_progress_report(project_id):
    project = project_manager.get_project(project_id)
    if not project:
        return jsonify({'error': 'Project not found'}), 404
    
    tasks = project_manager.get_project_tasks(project_id)
    
    # Calculate progress metrics
    total_tasks = len(tasks)
    completed_tasks = sum(1 for t in tasks if t.get('status') == 'Completed')
    in_progress_tasks = sum(1 for t in tasks if t.get('status') == 'In Progress')
    
    # Phase progress
    phase_progress = []
    for phase in project.get('phases', []):
        phase_tasks = [t for t in tasks if t.get('phase_id') == phase['id']]
        phase_completed = sum(1 for t in phase_tasks if t.get('status') == 'Completed')
        
        phase_progress.append({
            'phase_name': phase['name'],
            'total_tasks': len(phase_tasks),
            'completed_tasks': phase_completed,
            'progress': (phase_completed / len(phase_tasks) * 100) if phase_tasks else 0,
            'status': phase.get('status', 'Not Started')
        })
    
    # Milestone status
    milestone_status = []
    for phase in project.get('phases', []):
        for milestone in phase.get('milestones', []):
            milestone_status.append({
                'milestone_name': milestone['name'],
                'phase_name': phase['name'],
                'due_date': milestone['due_date'],
                'status': milestone['status']
            })
    
    return jsonify({
        'project_name': project['name'],
        'overall_progress': (completed_tasks / total_tasks * 100) if total_tasks > 0 else 0,
        'task_summary': {
            'total': total_tasks,
            'completed': completed_tasks,
            'in_progress': in_progress_tasks,
            'pending': total_tasks - completed_tasks - in_progress_tasks
        },
        'phase_progress': phase_progress,
        'milestone_status': milestone_status,
        'critical_path': project_manager.calculate_critical_path(project_id).get('critical_path', []),
        'health_score': project_manager.calculate_project_health_score(project_id)
    })

# Team Management endpoints
team_manager = TeamManager()

@app.route('/api/teams', methods=['GET'])
def get_teams():
    teams = team_manager.get_all_teams()
    return jsonify(teams)

@app.route('/api/teams', methods=['POST'])
def create_team():
    team_data = request.json
    team = team_manager.create_team(team_data)
    return jsonify(team), 201

@app.route('/api/teams/<team_id>', methods=['GET'])
def get_team(team_id):
    team = team_manager.get_team(team_id)
    if team:
        return jsonify(team)
    return jsonify({'error': 'Team not found'}), 404

@app.route('/api/teams/<team_id>', methods=['PUT'])
def update_team(team_id):
    updates = request.json
    team = team_manager.update_team(team_id, updates)
    if team:
        return jsonify(team)
    return jsonify({'error': 'Team not found'}), 404

@app.route('/api/teams/<team_id>', methods=['DELETE'])
def delete_team(team_id):
    if team_manager.delete_team(team_id):
        return jsonify({'message': 'Team deleted successfully'})
    return jsonify({'error': 'Team not found'}), 404

@app.route('/api/teams/<team_id>/members', methods=['GET'])
def get_team_members(team_id):
    members = team_manager.get_members_by_team(team_id)
    return jsonify(members)

@app.route('/api/members', methods=['GET'])
def get_members():
    members = team_manager.get_all_members()
    return jsonify(members)

@app.route('/api/team-members', methods=['GET'])
def get_team_members_alias():
    """Alias for /api/members endpoint - returns all team members"""
    members = team_manager.get_all_members()
    return jsonify(members)

@app.route('/api/members', methods=['POST'])
def create_member():
    member_data = request.json
    member = team_manager.create_member(member_data)
    return jsonify(member), 201

@app.route('/api/members/<member_id>', methods=['GET'])
def get_member(member_id):
    member = team_manager.get_member(member_id)
    if member:
        return jsonify(member)
    return jsonify({'error': 'Member not found'}), 404

@app.route('/api/members/<member_id>', methods=['PUT'])
def update_member(member_id):
    updates = request.json
    member = team_manager.update_member(member_id, updates)
    if member:
        return jsonify(member)
    return jsonify({'error': 'Member not found'}), 404

@app.route('/api/members/<member_id>', methods=['DELETE'])
def delete_member(member_id):
    if team_manager.delete_member(member_id):
        return jsonify({'message': 'Member deleted successfully'})
    return jsonify({'error': 'Member not found'}), 404

@app.route('/api/members/<member_id>/workload', methods=['GET'])
def get_member_workload(member_id):
    tasks = load_tasks()
    workload = team_manager.get_member_workload(member_id, tasks)
    if workload:
        return jsonify(workload)
    return jsonify({'error': 'Member not found'}), 404

@app.route('/api/teams/<team_id>/workload', methods=['GET'])
def get_team_workload(team_id):
    tasks = load_tasks()
    workload = team_manager.get_team_workload(team_id, tasks)
    if workload:
        return jsonify(workload)
    return jsonify({'error': 'Team not found'}), 404

@app.route('/api/teams/suggest-assignment', methods=['POST'])
def suggest_assignment():
    task_data = request.json
    team_id = task_data.get('team_id')
    suggested_member_id = team_manager.suggest_assignment(task_data, team_id)
    if suggested_member_id:
        member = team_manager.get_member(suggested_member_id)
        return jsonify({'suggested_member': member})
    return jsonify({'error': 'No suitable member found'}), 404

@app.route('/api/departments', methods=['GET'])
def get_departments():
    departments = team_manager.get_departments()
    return jsonify(departments)

@app.route('/api/departments', methods=['POST'])
def add_department():
    department = request.json.get('department')
    if team_manager.add_department(department):
        return jsonify({'message': 'Department added successfully'})
    return jsonify({'error': 'Department already exists'}), 400

# Deals endpoints
@app.route('/api/deals', methods=['GET'])
def get_deals():
    deals = load_deals()
    # Add current user info to response
    settings = load_settings()
    current_user = settings.get('user_id', 'unknown')
    return jsonify({
        'deals': deals,
        'current_user': current_user
    })

@app.route('/api/deals', methods=['POST'])
def create_deal():
    deal = request.json
    deal['id'] = str(uuid.uuid4())
    deal['created_at'] = datetime.now().isoformat()
    deal['updated_at'] = datetime.now().isoformat()
    
    # Get current user from settings
    settings = load_settings()
    current_user = settings.get('user_id', 'unknown')
    deal['created_by'] = current_user
    deal['owned_by'] = current_user  # Owner is the creator
    
    # Initialize notes array if not provided
    if 'notes' not in deal:
        deal['notes'] = []
    
    # If status is Won and date_won not set, set it to today
    if deal.get('dealStatus') == 'Won' and not deal.get('date_won'):
        deal['date_won'] = datetime.now().date().isoformat()
    
    # Calculate financial year if date_won exists
    if deal.get('date_won'):
        deal['financial_year'] = calculate_financial_year(deal['date_won'])
    
    deals = load_deals()
    deals.append(deal)
    save_deals(deals)
    return jsonify(deal)

@app.route('/api/deals/<deal_id>', methods=['GET'])
def get_deal(deal_id):
    deals = load_deals()
    deal = next((d for d in deals if d['id'] == deal_id), None)
    if deal:
        return jsonify(deal)
    return jsonify({'error': 'Deal not found'}), 404

@app.route('/api/deals/<deal_id>', methods=['PUT'])
def update_deal(deal_id):
    deal_data = request.json
    deals = load_deals()
    settings = load_settings()
    current_user = settings.get('user_id', 'unknown')
    
    for i, deal in enumerate(deals):
        if deal['id'] == deal_id:
            # Check ownership - only allow updates if user owns the deal
            if deal.get('owned_by') and deal.get('owned_by') != current_user:
                return jsonify({'error': 'You can only edit deals you created'}), 403
            
            # Preserve original data
            deal_data['id'] = deal_id
            deal_data['created_at'] = deal.get('created_at', datetime.now().isoformat())
            deal_data['created_by'] = deal.get('created_by', current_user)
            deal_data['owned_by'] = deal.get('owned_by', current_user)
            deal_data['updated_at'] = datetime.now().isoformat()
            deal_data['updated_by'] = current_user
            
            # Preserve notes if not in update
            if 'notes' not in deal_data:
                deal_data['notes'] = deal.get('notes', [])
            
            # If status changed to Won and date_won not set, set it to today
            if deal_data.get('dealStatus') == 'Won' and not deal_data.get('date_won'):
                deal_data['date_won'] = datetime.now().date().isoformat()
            
            # Calculate financial year if date_won exists
            if deal_data.get('date_won'):
                deal_data['financial_year'] = calculate_financial_year(deal_data['date_won'])
            
            deals[i] = deal_data
            save_deals(deals)
            return jsonify(deal_data)
    return jsonify({'error': 'Deal not found'}), 404

@app.route('/api/deals/<deal_id>/notes', methods=['POST'])
def add_deal_note(deal_id):
    note = request.json
    note['id'] = str(uuid.uuid4())
    note['timestamp'] = datetime.now().isoformat()
    
    deals = load_deals()
    for deal in deals:
        if deal['id'] == deal_id:
            if 'notes' not in deal:
                deal['notes'] = []
            deal['notes'].append(note)
            deal['updated_at'] = datetime.now().isoformat()
            save_deals(deals)
            return jsonify(note)
    
    return jsonify({'error': 'Deal not found'}), 404

@app.route('/api/deals/<deal_id>/notes/<note_id>', methods=['DELETE'])
def delete_deal_note(deal_id, note_id):
    deals = load_deals()
    for deal in deals:
        if deal['id'] == deal_id:
            if 'notes' in deal:
                deal['notes'] = [n for n in deal['notes'] if n.get('id') != note_id]
                deal['updated_at'] = datetime.now().isoformat()
                save_deals(deals)
                return jsonify({'success': True})
    
    return jsonify({'error': 'Deal or note not found'}), 404

@app.route('/api/deals/<deal_id>/comments', methods=['GET', 'POST'])
def handle_deal_comments(deal_id):
    deals = load_deals()
    settings = load_settings()
    current_user = settings.get('user_id', 'unknown')
    
    for i, deal in enumerate(deals):
        if deal['id'] == deal_id:
            if request.method == 'GET':
                # Get comments and mark as read if owned by current user
                comments = deal.get('comments', [])
                
                # Mark comments as read if the current user owns the deal
                if deal.get('owned_by') == current_user:
                    unread_before = any(not c.get('read', False) for c in comments)
                    for comment in comments:
                        if not comment.get('read', False):
                            comment['read'] = True
                            comment['read_at'] = datetime.now().isoformat()
                    
                    # Save if we marked any as read
                    if unread_before:
                        deals[i] = deal
                        save_deals(deals)
                
                return jsonify(comments)
            
            elif request.method == 'POST':
                comment = request.json
                comment['id'] = str(uuid.uuid4())
                comment['author'] = current_user
                comment['timestamp'] = datetime.now().isoformat()
                comment['read'] = False  # New comments are unread
                
                if 'comments' not in deal:
                    deal['comments'] = []
                
                deal['comments'].append(comment)
                deals[i] = deal
                save_deals(deals)
                return jsonify(comment)
    
    return jsonify({'error': 'Deal not found'}), 404

@app.route('/api/deals/<deal_id>/comments/<comment_id>/read', methods=['POST'])
def mark_comment_read(deal_id, comment_id):
    deals = load_deals()
    settings = load_settings()
    current_user = settings.get('user_id', 'unknown')
    
    for i, deal in enumerate(deals):
        if deal['id'] == deal_id:
            # Only the deal owner can mark comments as read
            if deal.get('owned_by') != current_user:
                return jsonify({'error': 'Only the deal owner can mark comments as read'}), 403
            
            for comment in deal.get('comments', []):
                if comment.get('id') == comment_id:
                    comment['read'] = True
                    comment['read_at'] = datetime.now().isoformat()
                    deals[i] = deal
                    save_deals(deals)
                    return jsonify({'success': True})
            
            return jsonify({'error': 'Comment not found'}), 404
    
    return jsonify({'error': 'Deal not found'}), 404

@app.route('/api/deals/<deal_id>', methods=['DELETE'])
def delete_deal(deal_id):
    deals = load_deals()
    settings = load_settings()
    
    # Find the deal to get ownership info
    deal_to_delete = None
    for deal in deals:
        if deal['id'] == deal_id:
            deal_to_delete = deal
            break
    
    if not deal_to_delete:
        return jsonify({'error': 'Deal not found'}), 404
    
    # Remove the deal from the list
    deals = [d for d in deals if d['id'] != deal_id]
    save_deals(deals)
    
    # Track the deletion for sync purposes
    try:
        # Always track deletions, regardless of sync_enabled status
        # This ensures deletions are respected even if sync is enabled later
        deleted_deals_file = os.path.join('data', 'deleted_deals.json')
        deleted_deals = []
        
        # Load existing deletions
        if os.path.exists(deleted_deals_file):
            try:
                with open(deleted_deals_file, 'r') as f:
                    deleted_deals = json.load(f)
            except:
                pass
        
        # Add this deletion
        user_id = deal_to_delete.get('owned_by', settings.get('user_id', 'unknown'))
        deleted_deals.append({
            'deal_id': deal_id,
            'deleted_by': user_id,
            'deleted_at': datetime.now().isoformat()
        })
        
        # Keep only deletions from last 30 days
        from datetime import timedelta
        cutoff = datetime.now() - timedelta(days=30)
        deleted_deals = [d for d in deleted_deals 
                        if datetime.fromisoformat(d['deleted_at']) > cutoff]
        
        # Save the updated list
        with open(deleted_deals_file, 'w') as f:
            json.dump(deleted_deals, f, indent=2)
            
        app.logger.info(f"Tracked deletion of deal {deal_id} by {user_id}")
    except Exception as e:
        app.logger.error(f"Error tracking deal deletion: {str(e)}")
    
    return jsonify({'success': True})

# Funny Comments endpoints
@app.route('/api/funny-comments', methods=['GET'])
def get_funny_comments():
    """Get funny comments for the character mascot"""
    try:
        # Try to load from local file first
        comments_file = os.path.join('data', 'funny_comments.json')
        if os.path.exists(comments_file):
            with open(comments_file, 'r') as f:
                data = json.load(f)
                return jsonify(data)
        else:
            # Return default comments if file doesn't exist
            return jsonify({
                'comments': [
                    {
                        'id': '1',
                        'text': 'Hello! I\'m Tasky, your friendly task assistant!',
                        'category': 'greeting',
                        'mood': 'cheerful'
                    }
                ],
                'settings': {
                    'min_interval_minutes': 10,
                    'max_interval_minutes': 30,
                    'character_name': 'Tasky',
                    'character_emoji': '🤖'
                }
            })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/funny-comments/sync', methods=['POST'])
def sync_funny_comments():
    """Download funny comments from FTP if available"""
    try:
        settings = load_settings()
        if not settings.get('sync_enabled'):
            return jsonify({'success': False, 'message': 'Sync not enabled'}), 400
            
        sync_manager = FTPSyncManager(settings)
        
        # Try to download funny_comments.json from FTP
        if sync_manager.connect():
            try:
                # Download the file
                remote_file = 'funny_comments.json'
                local_file = os.path.join('data', 'funny_comments.json')
                
                sync_manager.ftp.retrbinary(f'RETR {remote_file}', 
                                          open(local_file, 'wb').write)
                sync_manager.disconnect()
                
                return jsonify({
                    'success': True,
                    'message': 'Funny comments synced successfully'
                })
            except Exception as e:
                sync_manager.disconnect()
                # File might not exist on FTP yet, not a critical error
                return jsonify({
                    'success': False,
                    'message': f'Comments file not found on FTP: {str(e)}'
                }), 404
        else:
            return jsonify({
                'success': False,
                'message': 'Could not connect to FTP server'
            }), 500
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# FTP Sync endpoints
@app.route('/api/sync/upload', methods=['POST'])
def sync_upload_deals():
    """Manually trigger upload of current deals to FTP"""
    try:
        settings = load_settings()
        sync_manager = FTPSyncManager(settings)
        
        deals = load_deals()
        success = sync_manager.upload_deals(deals)
        
        if success:
            return jsonify({
                'success': True,
                'message': f'Successfully uploaded {len(deals)} deals',
                'deal_count': len(deals),
                'timestamp': datetime.now().isoformat()
            })
        else:
            return jsonify({
                'success': False,
                'error': 'Failed to upload deals to FTP. Check server logs for details.'
            }), 500
            
    except Exception as e:
        error_msg = str(e)
        # Provide helpful error messages for common FTP issues
        if '421' in error_msg and 'TLS' in error_msg:
            error_msg = "FTP server requires TLS/SSL. Please enable 'Use FTPS' in the configuration."
        elif '530' in error_msg:
            error_msg = "FTP login failed. Please check your username and password."
        elif 'Connection refused' in error_msg:
            error_msg = "Connection refused. Please check the FTP host and port settings."
        elif 'timeout' in error_msg.lower():
            error_msg = "Connection timeout. Please check if the FTP server is accessible."
        
        return jsonify({
            'success': False,
            'error': error_msg
        }), 500

@app.route('/api/sync/download', methods=['POST'])
def sync_download_deals():
    """Manually trigger download and merge of deals from FTP"""
    try:
        settings = load_settings()
        sync_manager = FTPSyncManager(settings)
        
        current_deals = load_deals()
        merged_deals, sync_report = sync_manager.download_and_merge_deals(current_deals)
        
        # Save merged deals
        save_deals(merged_deals)
        
        return jsonify({
            'success': True,
            'report': sync_report,
            'total_deals': len(merged_deals),
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/sync/status', methods=['GET'])
def get_sync_status():
    """Get current sync status and statistics"""
    try:
        settings = load_settings()
        sync_manager = FTPSyncManager(settings)
        status = sync_manager.get_sync_status()
        
        return jsonify(status)
        
    except Exception as e:
        return jsonify({
            'error': str(e),
            'configured': False
        }), 500

@app.route('/api/sync/auto', methods=['POST'])
def sync_auto():
    """Perform automatic sync (upload then download)"""
    try:
        settings = load_settings()
        sync_manager = FTPSyncManager(settings)
        
        # First upload current deals
        deals = load_deals()
        upload_success = sync_manager.upload_deals(deals)
        
        if not upload_success:
            return jsonify({
                'success': False,
                'error': 'Failed to upload deals'
            }), 500
        
        # Then download and merge
        merged_deals, sync_report = sync_manager.download_and_merge_deals(deals)
        save_deals(merged_deals)
        
        return jsonify({
            'success': True,
            'uploaded': len(deals),
            'report': sync_report,
            'total_deals': len(merged_deals),
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/sync/config', methods=['GET'])
def get_sync_config():
    """Get sync configuration"""
    settings = load_settings()
    
    # Don't send password to frontend
    safe_config = {
        'user_id': settings.get('user_id', ''),
        'team_ids': settings.get('team_ids', []),
        'sync_enabled': settings.get('sync_enabled', False),
        'sync_mode': settings.get('sync_mode', 'ftp'),
        'ftp_config': {
            'host': settings.get('ftp_config', {}).get('host', ''),
            'port': settings.get('ftp_config', {}).get('port', 21),
            'username': settings.get('ftp_config', {}).get('username', ''),
            'remote_dir': settings.get('ftp_config', {}).get('remote_dir', '/'),
            'use_tls': settings.get('ftp_config', {}).get('use_tls', False)
        },
        'sync_settings': settings.get('sync_settings', {
            'auto_sync_interval': 300,
            'upload_on_change': True,
            'keep_days': 7,
            'conflict_strategy': 'newest_wins'
        })
    }
    
    return jsonify(safe_config)

@app.route('/api/sync/config', methods=['POST'])
def update_sync_config():
    """Update sync configuration"""
    config = request.json
    settings = load_settings()
    
    # Update settings with new config
    settings['user_id'] = config.get('user_id', settings.get('user_id', ''))
    settings['team_ids'] = config.get('team_ids', settings.get('team_ids', []))
    settings['sync_enabled'] = config.get('sync_enabled', False)
    settings['sync_mode'] = config.get('sync_mode', 'ftp')
    
    # Update FTP config (preserve password if not provided)
    if 'ftp_config' not in settings:
        settings['ftp_config'] = {}
    
    new_ftp = config.get('ftp_config', {})
    settings['ftp_config']['host'] = new_ftp.get('host', '')
    settings['ftp_config']['port'] = new_ftp.get('port', 21)
    settings['ftp_config']['username'] = new_ftp.get('username', '')
    if new_ftp.get('password'):  # Only update password if provided
        settings['ftp_config']['password'] = new_ftp['password']
    settings['ftp_config']['remote_dir'] = new_ftp.get('remote_dir', '/')
    settings['ftp_config']['use_tls'] = new_ftp.get('use_tls', False)
    
    # Update sync settings
    settings['sync_settings'] = config.get('sync_settings', settings.get('sync_settings', {}))
    
    save_settings(settings)
    
    return jsonify({'success': True, 'message': 'Sync configuration updated'})

# Comments endpoints
@app.route('/api/tasks/<task_id>/comments', methods=['POST'])
def add_comment(task_id):
    comment = request.json
    comment['id'] = str(uuid.uuid4())
    comment['timestamp'] = datetime.now().isoformat()
    
    tasks = load_tasks()
    for task in tasks:
        if task['id'] == task_id:
            if 'comments' not in task:
                task['comments'] = []
            task['comments'].append(comment)
            
            # Add to history
            if 'history' not in task:
                task['history'] = []
            task['history'].append({
                'timestamp': datetime.now().isoformat(),
                'action': 'comment_added',
                'field': 'comments',
                'old_value': None,
                'new_value': comment['text']
            })
            
            save_tasks(tasks)
            return jsonify(comment), 201
    
    return jsonify({'error': 'Task not found'}), 404

@app.route('/api/tasks/<task_id>/comments/<int:comment_index>', methods=['PUT'])
def edit_comment(task_id, comment_index):
    data = request.json
    new_text = data.get('text')
    
    if not new_text:
        return jsonify({'error': 'No text provided'}), 400
    
    tasks = load_tasks()
    for task in tasks:
        if task['id'] == task_id:
            if 'comments' not in task or comment_index >= len(task['comments']):
                return jsonify({'error': 'Comment not found'}), 404
            
            old_text = task['comments'][comment_index].get('text', '')
            task['comments'][comment_index]['text'] = new_text
            task['comments'][comment_index]['edited_at'] = datetime.now().isoformat()
            
            # Add to history
            if 'history' not in task:
                task['history'] = []
            task['history'].append({
                'timestamp': datetime.now().isoformat(),
                'action': 'comment_edited',
                'field': 'comments',
                'old_value': old_text,
                'new_value': new_text
            })
            
            save_tasks(tasks)
            return jsonify(task['comments'][comment_index]), 200
    
    return jsonify({'error': 'Task not found'}), 404

@app.route('/api/tasks/<task_id>/comments/<int:comment_index>', methods=['DELETE'])
def delete_comment(task_id, comment_index):
    tasks = load_tasks()
    for task in tasks:
        if task['id'] == task_id:
            if 'comments' not in task or comment_index >= len(task['comments']):
                return jsonify({'error': 'Comment not found'}), 404
            
            deleted_comment = task['comments'].pop(comment_index)
            
            # Add to history
            if 'history' not in task:
                task['history'] = []
            task['history'].append({
                'timestamp': datetime.now().isoformat(),
                'action': 'comment_deleted',
                'field': 'comments',
                'old_value': deleted_comment.get('text', ''),
                'new_value': None
            })
            
            save_tasks(tasks)
            return jsonify({'success': True}), 200
    
    return jsonify({'error': 'Task not found'}), 404

# Attachments endpoints
@app.route('/api/tasks/<task_id>/attachments', methods=['POST'])
def upload_attachment(task_id):
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    # Create attachment directory
    task_dir = os.path.join(ATTACHMENTS_DIR, task_id)
    os.makedirs(task_dir, exist_ok=True)
    
    # Save file with unique ID
    file_id = str(uuid.uuid4())
    filename = secure_filename(file.filename)
    file_path = os.path.join(task_dir, f"{file_id}-{filename}")
    file.save(file_path)
    
    # Update task with attachment info
    tasks = load_tasks()
    for task in tasks:
        if task['id'] == task_id:
            if 'attachments' not in task:
                task['attachments'] = []
            
            attachment = {
                'id': file_id,
                'filename': filename,
                'size': os.path.getsize(file_path),
                'uploaded_at': datetime.now().isoformat()
            }
            task['attachments'].append(attachment)
            
            # Add to history
            if 'history' not in task:
                task['history'] = []
            task['history'].append({
                'timestamp': datetime.now().isoformat(),
                'action': 'attachment_added',
                'field': 'attachments',
                'old_value': None,
                'new_value': filename
            })
            
            save_tasks(tasks)
            return jsonify(attachment), 201
    
    return jsonify({'error': 'Task not found'}), 404

@app.route('/api/tasks/<task_id>/attachments/<attachment_id>', methods=['GET'])
def download_attachment(task_id, attachment_id):
    tasks = load_tasks()
    for task in tasks:
        if task['id'] == task_id:
            for attachment in task.get('attachments', []):
                if attachment['id'] == attachment_id:
                    file_path = os.path.join(ATTACHMENTS_DIR, task_id, f"{attachment_id}-{attachment['filename']}")
                    if os.path.exists(file_path):
                        return send_file(file_path, as_attachment=True, download_name=attachment['filename'])
    
    return jsonify({'error': 'Attachment not found'}), 404

@app.route('/api/tasks/<task_id>/attachments/<attachment_id>', methods=['DELETE'])
def delete_attachment(task_id, attachment_id):
    """Delete an attachment from a task"""
    tasks = load_tasks()
    
    for task in tasks:
        if task['id'] == task_id:
            # Find and remove the attachment from the task
            attachments = task.get('attachments', [])
            attachment_to_delete = None
            
            for i, attachment in enumerate(attachments):
                if attachment['id'] == attachment_id:
                    attachment_to_delete = attachment
                    attachments.pop(i)
                    break
            
            if attachment_to_delete:
                # Delete the physical file
                file_path = os.path.join(ATTACHMENTS_DIR, task_id, f"{attachment_id}-{attachment_to_delete['filename']}")
                if os.path.exists(file_path):
                    try:
                        os.remove(file_path)
                    except Exception as e:
                        print(f"Error deleting file: {e}")
                
                # Add to history
                if 'history' not in task:
                    task['history'] = []
                
                task['history'].append({
                    'timestamp': datetime.now().isoformat(),
                    'action': 'attachment_deleted',
                    'field': 'attachments',
                    'old_value': attachment_to_delete['filename'],
                    'new_value': None
                })
                
                # Save updated tasks
                save_tasks(tasks)
                
                return jsonify({'success': True, 'message': 'Attachment deleted successfully'})
            else:
                return jsonify({'error': 'Attachment not found'}), 404
    
    return jsonify({'error': 'Task not found'}), 404

# Similar tasks endpoint
@app.route('/api/tasks/similar', methods=['POST'])
def get_similar_tasks():
    data = request.json
    similar = find_similar_tasks(
        data.get('title', ''),
        data.get('description', ''),
        data.get('customer', '')
    )
    return jsonify(similar)

# Calendar API endpoint removed - feature disabled

# Dashboard layout endpoints
@app.route('/api/dashboard/layout', methods=['GET'])
def get_dashboard_layout():
    user_id = request.args.get('user_id', 'default')
    layouts = load_dashboard_layouts()
    return jsonify(layouts.get(user_id, {}))

@app.route('/api/dashboard/layout', methods=['POST'])
def save_dashboard_layout_endpoint():
    data = request.json
    user_id = data.get('user_id', 'default')
    layout = data.get('layout', {})
    save_dashboard_layout(user_id, layout)
    return jsonify({'success': True})

# AI text enhancement endpoint
@app.route('/api/ai/enhance-text', methods=['POST'])
def enhance_text():
    settings = load_settings()
    
    if not settings.get('api_key'):
        return jsonify({'error': 'API key not configured'}), 400
    
    data = request.json
    text = data.get('text', '')
    enhancement_type = data.get('type', 'improve')  # improve, grammar, professional
    task_context = data.get('task_context', None)  # Optional task context
    
    prompts = {
        'improve': 'Improve the clarity and readability of this text while maintaining its meaning. Return ONLY the improved text, no explanations or meta-text:',
        'grammar': 'Fix any grammar and spelling errors in this text. Return ONLY the corrected text, no explanations:',
        'professional': 'Rewrite this text in a more professional tone. Return ONLY the rewritten text, no explanations:'
    }
    
    # Build prompt with optional context
    prompt = prompts.get(enhancement_type, prompts['improve'])
    
    # Add task context if provided
    if task_context:
        prompt += f"\n\nContext for this text (for reference only, do not include in enhanced text):\n"
        prompt += f"Task: {task_context.get('title', 'N/A')}\n"
        if task_context.get('customer_name'):
            prompt += f"Customer: {task_context['customer_name']}\n"
        if task_context.get('priority'):
            prompt += f"Priority: {task_context['priority']}\n"
        if task_context.get('comments') and len(task_context['comments']) > 0:
            prompt += f"Recent comment: {task_context['comments'][-1].get('text', '')}\n"
    
    prompt += f"\n\nText to enhance:\n{text}"
    
    result = call_ai_api(settings, prompt, task_type='enhancement', max_tokens=500)
    
    if result['success']:
        return jsonify({'enhanced_text': result['text']})
    else:
        return jsonify({'error': result.get('error', 'Unknown error occurred')}), 500

@app.route('/api/ai/enhance-objective', methods=['POST'])
def enhance_objective():
    """Enhance an OKR objective to be more ambitious and clear"""
    settings = load_settings()
    
    if not settings.get('api_key'):
        return jsonify({'error': 'API key not configured'}), 400
    
    data = request.json
    current_text = data.get('text', '')
    objective_type = data.get('type', 'aspirational')
    period = data.get('period', 'Q1')
    
    if not current_text:
        return jsonify({'error': 'No text provided'}), 400
    
    # Build prompt for enhancing objective
    prompt = f"""Transform this objective into a clear, ambitious OKR objective.

Current objective: {current_text}
Type: {objective_type} ({"must achieve" if objective_type == "committed" else "stretch goal"})
Period: {period}

Requirements:
- Make it qualitative and inspirational
- Make it ambitious but achievable within the period
- Keep it concise (one sentence)
- Start with an action verb
- Focus on outcomes, not activities
- Make it memorable and motivating

Return ONLY the enhanced objective text, nothing else."""
    
    result = call_ai_api(settings, prompt, max_tokens=100)
    
    if result['success']:
        return jsonify({'enhanced_text': result['text'].strip()})
    else:
        return jsonify({'error': result.get('error', 'Failed to enhance objective')}), 500

@app.route('/api/ai/enhance-why-matters', methods=['POST'])
def enhance_why_matters():
    """Generate or enhance the 'why this matters' description for an OKR"""
    settings = load_settings()
    
    if not settings.get('api_key'):
        return jsonify({'error': 'API key not configured'}), 400
    
    data = request.json
    objective = data.get('objective', '')
    current_text = data.get('current_text', '')
    objective_type = data.get('type', 'aspirational')
    period = data.get('period', 'Q1')
    
    if not objective:
        return jsonify({'error': 'No objective provided'}), 400
    
    # Build prompt
    if current_text:
        prompt = f"""Enhance this explanation of why an OKR objective matters.

Objective: {objective}
Current explanation: {current_text}
Type: {objective_type}
Period: {period}

Make it more compelling by:
- Clearly explaining the business impact
- Highlighting benefits to customers/users
- Connecting to larger strategic goals
- Creating urgency and motivation
- Being specific about outcomes

Keep it to 2-3 sentences. Return ONLY the enhanced explanation."""
    else:
        prompt = f"""Explain why this OKR objective matters.

Objective: {objective}
Type: {objective_type}
Period: {period}

Write a compelling 2-3 sentence explanation that:
- Clearly states the business impact
- Highlights benefits to customers/users
- Connects to strategic goals
- Creates urgency and motivation
- Is specific about expected outcomes

Return ONLY the explanation text."""
    
    result = call_ai_api(settings, prompt, max_tokens=200)
    
    if result['success']:
        return jsonify({'enhanced_text': result['text'].strip()})
    else:
        return jsonify({'error': result.get('error', 'Failed to enhance description')}), 500

@app.route('/api/ai/chat', methods=['POST'])
def ai_chat():
    """Handle chat messages from Tasky AI Assistant"""
    settings = load_settings()
    
    if not settings.get('api_key'):
        return jsonify({'error': 'API key not configured'}), 400
    
    data = request.json
    user_message = data.get('message', '')
    context_type = data.get('context', 'task_assistant')
    
    if not user_message:
        return jsonify({'error': 'No message provided'}), 400
    
    # Build context from all available data
    tasks = load_tasks()
    projects = load_projects()
    objectives = load_objectives()
    deals = load_deals()
    
    # Filter to active items
    active_tasks = [t for t in tasks if t.get('status') not in ['Completed', 'Cancelled']]
    active_projects = [p for p in projects if p.get('status') != 'Completed']
    active_objectives = [o for o in objectives if o.get('status') != 'Completed']
    active_deals = [d for d in deals if d.get('dealStatus') != 'Lost']
    
    # Count statistics
    overdue_tasks = []
    today_tasks = []
    high_priority_tasks = []
    
    from datetime import datetime, date
    today = date.today()
    
    for task in active_tasks:
        if task.get('follow_up_date'):
            try:
                follow_up = datetime.fromisoformat(task['follow_up_date']).date()
                if follow_up < today:
                    overdue_tasks.append(task)
                elif follow_up == today:
                    today_tasks.append(task)
            except:
                pass
        
        if task.get('priority') in ['High', 'Critical']:
            high_priority_tasks.append(task)
    
    # Build context for the AI
    context = f"""You are Tasky AI, a helpful assistant for a task management system. 
You have access to the following current data:

**TASKS:**
- Total active tasks: {len(active_tasks)}
- Overdue tasks: {len(overdue_tasks)}
- Due today: {len(today_tasks)}
- High/Critical priority: {len(high_priority_tasks)}

**PROJECTS:**
- Active projects: {len(active_projects)}

**OBJECTIVES (OKRs):**
- Active objectives: {len(active_objectives)}

**DEALS:**
- Active deals: {len(active_deals)}
- Total forecast value: ${sum(float(d.get('forecastLikely', 0)) for d in active_deals):,.2f}

When answering questions:
1. Be helpful and specific
2. Reference actual data when possible
3. Provide actionable insights
4. Keep responses concise but informative
5. Use formatting to make responses easy to read:
   - Use **bold** for emphasis on important points
   - Use bullet points (- ) for lists
   - Use numbered lists (1. 2. 3.) for steps
   - Use line breaks to separate different sections
   - Use `code style` for specific task names or technical terms when appropriate

User question: {user_message}

Please provide a helpful, well-formatted response:"""
    
    # Add specific task details if the user is asking about them
    if any(word in user_message.lower() for word in ['overdue', 'late', 'behind']):
        if overdue_tasks:
            context += "\n\n**Overdue tasks:**\n"
            for task in overdue_tasks[:5]:  # Show max 5
                context += f"- **{task['title']}** (Customer: {task.get('customer_name', 'N/A')})\n"
    
    if any(word in user_message.lower() for word in ['today', 'now', 'urgent']):
        if today_tasks:
            context += "\n\n**Tasks due today:**\n"
            for task in today_tasks[:5]:
                priority = task.get('priority', 'Normal')
                priority_marker = "🔴" if priority == "Critical" else "🟡" if priority == "High" else ""
                context += f"- **{task['title']}** {priority_marker} (Priority: {priority})\n"
    
    if any(word in user_message.lower() for word in ['project', 'projects']):
        if active_projects:
            context += "\n\n**Active projects:**\n"
            for project in active_projects[:5]:
                progress = project.get('progress', 0)
                context += f"- **{project['name']}** - Progress: `{progress}%`\n"
    
    if any(word in user_message.lower() for word in ['deal', 'deals', 'sales']):
        if active_deals:
            context += "\n\n**Top deals by value:**\n"
            sorted_deals = sorted(active_deals, key=lambda d: float(d.get('forecastLikely', 0)), reverse=True)
            for deal in sorted_deals[:5]:
                value = float(deal.get('forecastLikely', 0))
                status = deal.get('dealStatus', 'Open')
                context += f"- **{deal['customer_name']}**: `${value:,.2f}` ({status})\n"
    
    # Call the AI API
    result = call_ai_api(settings, context, max_tokens=500)
    
    if result['success']:
        return jsonify({'response': result['text']})
    else:
        return jsonify({'error': result.get('error', 'Failed to get AI response')}), 500

@app.route('/api/ai/task-summary/<task_id>', methods=['POST'])
def task_summary(task_id):
    """Generate executive or in-depth summary of a specific task"""
    settings = load_settings()
    
    if not settings.get('api_key'):
        return jsonify({'error': 'API key not configured'}), 400
    
    # Get summary type from request
    data = request.json
    summary_type = data.get('type', 'executive')  # 'executive' or 'detailed'
    
    # Load the specific task
    tasks = load_tasks()
    task = next((t for t in tasks if t['id'] == task_id), None)
    
    if not task:
        return jsonify({'error': 'Task not found'}), 404
    
    # Build comprehensive task information
    task_info = f"Task Title: {task.get('title', 'Untitled')}\n"
    task_info += f"Customer: {task.get('customer_name', 'N/A')}\n"
    task_info += f"Status: {task.get('status', 'Unknown')}\n"
    task_info += f"Priority: {task.get('priority', 'Medium')}\n"
    task_info += f"Category: {task.get('category', 'N/A')}\n"
    
    if task.get('assigned_to'):
        task_info += f"Assigned to: {task.get('assigned_to')}\n"
    
    if task.get('follow_up_date'):
        formatted_date = format_follow_up_display(task.get('follow_up_date'))
        task_info += f"Due Date: {formatted_date or task.get('follow_up_date')}\n"
        # Calculate if overdue
        if is_overdue(task.get('follow_up_date'), task.get('status')):
            task_info += "Status Note: OVERDUE\n"
    
    if task.get('description'):
        task_info += f"\nDescription:\n{task.get('description')}\n"
    
    # Add dependencies information
    if task.get('dependencies') and len(task['dependencies']) > 0:
        task_info += f"\nDependencies ({len(task['dependencies'])} tasks):\n"
        for dep_id in task['dependencies'][:5]:  # Limit to first 5
            dep_task = next((t for t in tasks if t['id'] == dep_id), None)
            if dep_task:
                task_info += f"  - {dep_task.get('title', 'Unknown')} (Status: {dep_task.get('status', 'Unknown')})\n"
    
    # Add blocks information
    if task.get('blocks') and len(task['blocks']) > 0:
        task_info += f"\nBlocks ({len(task['blocks'])} tasks):\n"
        for block_id in task['blocks'][:5]:  # Limit to first 5
            block_task = next((t for t in tasks if t['id'] == block_id), None)
            if block_task:
                task_info += f"  - {block_task.get('title', 'Unknown')}\n"
    
    # Add comments
    if task.get('comments') and len(task['comments']) > 0:
        task_info += f"\nComments ({len(task['comments'])} total):\n"
        for comment in task['comments']:
            task_info += f"  [{comment.get('timestamp', 'Unknown time')}]: {comment.get('text', '')}\n"
    
    # Add attachments information
    if task.get('attachments') and len(task['attachments']) > 0:
        task_info += f"\nAttachments ({len(task['attachments'])} files):\n"
        for attachment in task['attachments']:
            task_info += f"  - {attachment.get('filename', 'Unknown')} ({attachment.get('size', 0)} bytes)\n"
    
    # Add history/timeline for detailed summary
    if summary_type == 'detailed' and task.get('history'):
        task_info += f"\nActivity Timeline ({len(task['history'])} events):\n"
        for event in task['history'][-10:]:  # Last 10 events
            task_info += f"  [{event.get('timestamp', '')}] {event.get('action', '')}: "
            task_info += f"{event.get('field', '')} changed"
            if event.get('old_value') and event.get('new_value'):
                task_info += f" from '{event['old_value']}' to '{event['new_value']}'"
            task_info += "\n"
    
    # Create appropriate prompt based on summary type
    if summary_type == 'executive':
        prompt = f"""Create a concise executive summary of this task. Focus on:
1. Current status and urgency
2. Key blockers or dependencies
3. Main action items needed
4. Critical dates and deadlines

Keep it brief (3-4 sentences) and highlight only the most important information.

{task_info}"""
        max_tokens = 300
    else:  # detailed
        prompt = f"""Create a comprehensive summary of this task. Include:
1. Complete overview of the task and its objectives
2. Current status and progress analysis
3. All dependencies and their impact
4. Timeline of key events and changes
5. Comments analysis and key decisions made
6. Next steps and recommendations
7. Risk assessment if applicable

Provide a thorough analysis while maintaining clarity.

{task_info}"""
        max_tokens = 800
    
    result = call_ai_api(settings, prompt, task_type='summarization', max_tokens=max_tokens)
    
    if result['success']:
        return jsonify({'summary': result['text'], 'type': summary_type})
    else:
        return jsonify({'error': result.get('error', 'Unknown error occurred')}), 500

# System notifications disabled - using browser notifications only
# The check_notifications function and related code have been commented out
# Browser notifications are handled client-side in dashboard.js

'''
# Track which tasks have been notified to avoid spam
notified_tasks = {
    'overdue': set(),
    'due_today': set(),
    'due_soon': set()
}

def check_notifications():
    import sys
    global notified_tasks
    
    while True:
        try:
            settings = load_settings()
            if settings.get('notifications_enabled'):
                print(f"[{datetime.now().strftime('%H:%M:%S')}] Checking for notifications...", file=sys.stderr)
                tasks = load_tasks()
                
                # Debug: Show task follow-up times
                for task in tasks:
                    if task.get('follow_up_date') and task.get('status') != 'Completed':
                        follow_up_dt = parse_follow_up_datetime(task.get('follow_up_date'))
                        if follow_up_dt:
                            is_od = is_overdue(task.get('follow_up_date'), task.get('status'))
                            print(f"  Task '{task.get('title')}': Due {follow_up_dt.strftime('%Y-%m-%d %H:%M')} - Overdue: {is_od}", file=sys.stderr)
                
                # Filter to only show new overdue tasks
                all_overdue = [t for t in tasks if is_overdue(t.get('follow_up_date'), t.get('status'))]
                overdue = [t for t in all_overdue if t.get('id') not in notified_tasks['overdue']]
                
                all_due_today = [t for t in tasks if is_due_today(t.get('follow_up_date')) and t.get('status') != 'Completed']
                due_today = [t for t in all_due_today if t.get('id') not in notified_tasks['due_today']]
                
                # Check for tasks due within the next hour
                all_due_soon = []
                for task in tasks:
                    if task.get('status') == 'Completed':
                        continue
                    follow_up_dt = parse_follow_up_datetime(task.get('follow_up_date'))
                    if follow_up_dt:
                        time_until_due = (follow_up_dt - datetime.now()).total_seconds()
                        # Due within next hour but not overdue
                        if 0 < time_until_due <= 3600:
                            all_due_soon.append(task)
                
                due_soon = [t for t in all_due_soon if t.get('id') not in notified_tasks['due_soon']]
                
                print(f"  Found: {len(overdue)} new overdue (total: {len(all_overdue)}), "
                      f"{len(due_today)} new due today (total: {len(all_due_today)}), "
                      f"{len(due_soon)} new due soon (total: {len(all_due_soon)})", file=sys.stderr)
                
                # Clean up notified tasks that are no longer in their respective states
                # Remove from overdue list if task is no longer overdue
                notified_tasks['overdue'] = {tid for tid in notified_tasks['overdue'] 
                                            if any(t.get('id') == tid for t in all_overdue)}
                # Remove from due_today list if task is no longer due today
                notified_tasks['due_today'] = {tid for tid in notified_tasks['due_today']
                                              if any(t.get('id') == tid for t in all_due_today)}
                # Remove from due_soon list if task is no longer due soon
                notified_tasks['due_soon'] = {tid for tid in notified_tasks['due_soon']
                                             if any(t.get('id') == tid for t in all_due_soon)}
                
                # Try to send notifications with error handling
                try:
                    # On Windows, ensure the app_icon is None to avoid issues
                    if overdue:
                        notification.notify(
                            title='Overdue Tasks',
                            message=f'You have {len(overdue)} new overdue task(s)',
                            app_name='Task Manager',
                            app_icon=None,  # Important for Windows
                            timeout=10
                        )
                        # Mark these tasks as notified
                        for task in overdue:
                            notified_tasks['overdue'].add(task.get('id'))
                            print(f"  Notified for overdue: {task.get('title')}", file=sys.stderr)
                    
                    if due_today:
                        notification.notify(
                            title='Tasks Due Today',
                            message=f'You have {len(due_today)} task(s) due today',
                            app_name='Task Manager',
                            app_icon=None,  # Important for Windows
                            timeout=10
                        )
                        # Mark these tasks as notified
                        for task in due_today:
                            notified_tasks['due_today'].add(task.get('id'))
                            print(f"  Notified for due today: {task.get('title')}", file=sys.stderr)
                    
                    if due_soon:
                        notification.notify(
                            title='Tasks Due Soon',
                            message=f'You have {len(due_soon)} task(s) due within the next hour',
                            app_name='Task Manager',
                            app_icon=None,  # Important for Windows
                            timeout=10
                        )
                        # Mark these tasks as notified
                        for task in due_soon:
                            notified_tasks['due_soon'].add(task.get('id'))
                            print(f"  Notified for due soon: {task.get('title')}", file=sys.stderr)
                except Exception as e:
                    # Notifications might not work in WSL or certain environments
                    print(f"Note: Desktop notifications not available ({str(e)})", file=sys.stderr)
                    # Continue running without notifications
                    pass
            
            time.sleep(settings.get('check_interval', 60) * 60)
        except Exception as e:
            print(f"Error in notification thread: {str(e)}", file=sys.stderr)
            time.sleep(60)  # Wait a minute before retrying
'''

@app.errorhandler(404)
def not_found(error):
    return jsonify({'message': 'Route not found', 'error': str(error)}), 404

@app.route('/favicon.ico')
def favicon():
    return '', 204

# System notifications disabled - using browser notifications only
# notification_thread = threading.Thread(target=check_notifications, daemon=True)
# notification_thread.start()

# ============================
# MEETINGS API ENDPOINTS
# ============================

@app.route('/api/meetings', methods=['GET'])
def get_meetings():
    """Get all meetings"""
    meetings = load_meetings()
    return jsonify(meetings)

@app.route('/api/meetings', methods=['POST'])
def create_meeting():
    """Create a new meeting"""
    try:
        meeting = request.json
        meeting['id'] = str(uuid.uuid4())
        meeting['created_at'] = datetime.now().isoformat()
        meeting['updated_at'] = datetime.now().isoformat()
        
        # Set default values
        if 'status' not in meeting:
            meeting['status'] = 'Scheduled'
        if 'attendees' not in meeting:
            meeting['attendees'] = []
        if 'agenda' not in meeting:
            meeting['agenda'] = []
        if 'action_items' not in meeting:
            meeting['action_items'] = []
        if 'decisions' not in meeting:
            meeting['decisions'] = []
        if 'attachments' not in meeting:
            meeting['attachments'] = []
        if 'notes' not in meeting:
            meeting['notes'] = ''
        if 'metadata' not in meeting:
            meeting['metadata'] = {}
        
        meetings = load_meetings()
        meetings.append(meeting)
        save_meetings(meetings)
        
        return jsonify(meeting), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/meetings/<meeting_id>', methods=['GET'])
def get_meeting(meeting_id):
    """Get a specific meeting"""
    meetings = load_meetings()
    meeting = next((m for m in meetings if m['id'] == meeting_id), None)
    
    if not meeting:
        return jsonify({'error': 'Meeting not found'}), 404
    
    return jsonify(meeting)

@app.route('/api/meetings/<meeting_id>', methods=['PUT'])
def update_meeting(meeting_id):
    """Update a specific meeting"""
    try:
        meetings = load_meetings()
        meeting_data = request.json
        
        for i, meeting in enumerate(meetings):
            if meeting['id'] == meeting_id:
                meeting_data['updated_at'] = datetime.now().isoformat()
                # Preserve created_at and id
                meeting_data['id'] = meeting_id
                if 'created_at' in meeting:
                    meeting_data['created_at'] = meeting['created_at']
                
                meetings[i] = meeting_data
                save_meetings(meetings)
                return jsonify(meeting_data)
        
        return jsonify({'error': 'Meeting not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/meetings/<meeting_id>', methods=['DELETE'])
def delete_meeting(meeting_id):
    """Delete a specific meeting"""
    meetings = load_meetings()
    meetings = [m for m in meetings if m['id'] != meeting_id]
    save_meetings(meetings)
    return '', 204

@app.route('/api/meetings/<meeting_id>/action-items', methods=['POST'])
def add_action_item(meeting_id):
    """Add action item to a meeting"""
    try:
        meetings = load_meetings()
        action_item = request.json
        action_item['id'] = str(uuid.uuid4())
        action_item['created_at'] = datetime.now().isoformat()
        
        for meeting in meetings:
            if meeting['id'] == meeting_id:
                if 'action_items' not in meeting:
                    meeting['action_items'] = []
                meeting['action_items'].append(action_item)
                meeting['updated_at'] = datetime.now().isoformat()
                save_meetings(meetings)
                return jsonify(action_item), 201
        
        return jsonify({'error': 'Meeting not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/meetings/<meeting_id>/create-tasks', methods=['POST'])
def create_tasks_from_meeting(meeting_id):
    """Create tasks from meeting action items"""
    try:
        meetings = load_meetings()
        data = request.json
        action_item_ids = data.get('action_item_ids', [])
        
        meeting = next((m for m in meetings if m['id'] == meeting_id), None)
        if not meeting:
            return jsonify({'error': 'Meeting not found'}), 404
        
        tasks = load_tasks()
        created_tasks = []
        
        for action_item in meeting.get('action_items', []):
            if action_item['id'] in action_item_ids:
                # Create task from action item
                task = {
                    'id': str(uuid.uuid4()),
                    'title': action_item.get('title', 'Task from meeting'),
                    'description': action_item.get('description', ''),
                    'assigned_to': action_item.get('assigned_to', ''),
                    'priority': action_item.get('priority', 'Medium'),
                    'status': 'Open',
                    'category': 'Meeting Action',
                    'created_date': datetime.now().isoformat(),
                    'follow_up_date': action_item.get('due_date'),
                    'history': [{
                        'timestamp': datetime.now().isoformat(),
                        'action': 'created',
                        'field': 'task',
                        'old_value': None,
                        'new_value': f'Task created from meeting: {meeting.get("title", "")}'
                    }],
                    'comments': [],
                    'attachments': [],
                    'dependencies': [],
                    'blocks': [],
                    'meeting_reference': {
                        'meeting_id': meeting_id,
                        'meeting_title': meeting.get('title', ''),
                        'action_item_id': action_item['id']
                    }
                }
                
                tasks.append(task)
                created_tasks.append(task)
                
                # Update action item with task reference
                action_item['task_id'] = task['id']
                action_item['task_created'] = True
        
        # Save both tasks and meetings
        save_tasks(tasks)
        save_meetings(meetings)
        
        return jsonify({
            'created_tasks': created_tasks,
            'count': len(created_tasks)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/meetings/<meeting_id>/linked-tasks', methods=['GET'])
def get_meeting_linked_tasks(meeting_id):
    """Get all tasks linked to a meeting"""
    tasks = load_tasks()
    linked_tasks = []
    
    for task in tasks:
        if 'meeting_reference' in task and task['meeting_reference'].get('meeting_id') == meeting_id:
            linked_tasks.append(task)
    
    return jsonify(linked_tasks)

@app.route('/api/meetings/<meeting_id>/distribute', methods=['POST'])
def distribute_meeting(meeting_id):
    """Email distribution of meeting minutes (placeholder for future implementation)"""
    try:
        meetings = load_meetings()
        data = request.json
        recipients = data.get('recipients', [])
        
        meeting = next((m for m in meetings if m['id'] == meeting_id), None)
        if not meeting:
            return jsonify({'error': 'Meeting not found'}), 404
        
        # For now, just mark as distributed and store distribution info
        if 'metadata' not in meeting:
            meeting['metadata'] = {}
        
        meeting['metadata']['distributed'] = True
        meeting['metadata']['distribution_date'] = datetime.now().isoformat()
        meeting['metadata']['recipients'] = recipients
        meeting['updated_at'] = datetime.now().isoformat()
        
        save_meetings(meetings)
        
        # TODO: Implement actual email sending functionality
        return jsonify({
            'success': True,
            'message': f'Meeting minutes marked for distribution to {len(recipients)} recipients',
            'recipients': recipients
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/meeting-templates', methods=['GET'])
def get_meeting_templates():
    """Get all meeting templates"""
    templates = load_meeting_templates()
    return jsonify(templates)

@app.route('/api/meeting-templates', methods=['POST'])
def create_meeting_template():
    """Create a new meeting template"""
    try:
        template = request.json
        template['id'] = str(uuid.uuid4())
        template['created_at'] = datetime.now().isoformat()
        
        templates_data = load_meeting_templates()
        if 'templates' not in templates_data:
            templates_data['templates'] = []
        
        templates_data['templates'].append(template)
        save_meeting_templates(templates_data)
        
        return jsonify(template), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/meetings/from-template', methods=['POST'])
def create_meeting_from_template():
    """Create a meeting from a template"""
    try:
        data = request.json
        template_id = data.get('template_id')
        
        templates_data = load_meeting_templates()
        template = None
        
        for t in templates_data.get('templates', []):
            if t['id'] == template_id:
                template = t
                break
        
        if not template:
            return jsonify({'error': 'Template not found'}), 404
        
        # Create meeting from template
        meeting = {
            'id': str(uuid.uuid4()),
            'title': data.get('title', template.get('name', 'New Meeting')),
            'type': template.get('type', 'General'),
            'duration': template.get('duration', 60),
            'agenda': template.get('agenda', []).copy(),
            'date': data.get('date', ''),
            'time': data.get('time', ''),
            'location': data.get('location', ''),
            'status': 'Scheduled',
            'attendees': data.get('attendees', []),
            'action_items': [],
            'decisions': [],
            'attachments': [],
            'notes': '',
            'created_at': datetime.now().isoformat(),
            'updated_at': datetime.now().isoformat(),
            'metadata': {
                'created_from_template': template_id,
                'template_name': template.get('name')
            }
        }
        
        meetings = load_meetings()
        meetings.append(meeting)
        save_meetings(meetings)
        
        return jsonify(meeting), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/meetings/<meeting_id>/ai-summary', methods=['POST'])
def generate_meeting_summary(meeting_id):
    """Generate AI summary of meeting minutes"""
    try:
        settings = load_settings()
        
        if not settings.get('api_key'):
            return jsonify({'error': 'API key not configured'}), 400
        
        meetings = load_meetings()
        meeting = next((m for m in meetings if m['id'] == meeting_id), None)
        
        if not meeting:
            return jsonify({'error': 'Meeting not found'}), 404
        
        # Build meeting context for AI
        context = f"Meeting: {meeting.get('title', 'Untitled')}\n"
        context += f"Date: {meeting.get('date', 'Not specified')}\n"
        context += f"Type: {meeting.get('type', 'General')}\n"
        context += f"Duration: {meeting.get('duration', 'Not specified')} minutes\n\n"
        
        if meeting.get('attendees'):
            context += "Attendees:\n"
            for attendee in meeting['attendees']:
                context += f"- {attendee.get('name', '')} ({attendee.get('role', 'Attendee')})\n"
            context += "\n"
        
        if meeting.get('agenda'):
            context += "Agenda:\n"
            for item in meeting['agenda']:
                context += f"- {item.get('item', '')}\n"
            context += "\n"
        
        if meeting.get('notes'):
            context += f"Meeting Notes:\n{meeting['notes']}\n\n"
        
        if meeting.get('decisions'):
            context += "Decisions Made:\n"
            for decision in meeting['decisions']:
                context += f"- {decision.get('decision', '')}\n"
            context += "\n"
        
        if meeting.get('action_items'):
            context += "Action Items:\n"
            for action in meeting['action_items']:
                context += f"- {action.get('title', '')} (Assigned to: {action.get('assigned_to', 'Unassigned')})\n"
        
        prompt = f"Please provide a comprehensive summary of this meeting:\n\n{context}\n\nInclude:\n1. Key discussion points\n2. Decisions made\n3. Action items and ownership\n4. Next steps\n\nFormat the response in clear, professional language suitable for stakeholders who didn't attend."
        
        result = call_ai_api(settings, prompt, max_tokens=800)
        
        if result['success']:
            # Store summary in meeting metadata
            if 'metadata' not in meeting:
                meeting['metadata'] = {}
            meeting['metadata']['ai_summary'] = result['text']
            meeting['metadata']['summary_generated_at'] = datetime.now().isoformat()
            meeting['updated_at'] = datetime.now().isoformat()
            save_meetings(meetings)
            
            return jsonify({'summary': result['text']})
        else:
            return jsonify({'error': result.get('error', 'Failed to generate summary')}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/meetings/<meeting_id>/extract-actions', methods=['POST'])
def extract_action_items(meeting_id):
    """AI extraction of action items from meeting notes"""
    try:
        settings = load_settings()
        
        if not settings.get('api_key'):
            return jsonify({'error': 'API key not configured'}), 400
        
        meetings = load_meetings()
        meeting = next((m for m in meetings if m['id'] == meeting_id), None)
        
        if not meeting:
            return jsonify({'error': 'Meeting not found'}), 404
        
        notes = meeting.get('notes', '')
        if not notes.strip():
            return jsonify({'error': 'No meeting notes to analyze'}), 400
        
        prompt = f"""Analyze the following meeting notes and extract action items. For each action item, identify:
1. The task/action to be completed
2. Who is responsible (if mentioned)
3. Any deadline or due date (if mentioned)
4. Priority level (if apparent)

Meeting Notes:
{notes}

Format your response as a JSON array with objects containing: title, description, assigned_to, due_date, priority. Only include clear, actionable items. If information is not specified, use null or appropriate defaults."""
        
        result = call_ai_api(settings, prompt, max_tokens=600)
        
        if result['success']:
            try:
                # Try to parse the AI response as JSON
                import re
                json_match = re.search(r'\[.*\]', result['text'], re.DOTALL)
                if json_match:
                    extracted_actions = json.loads(json_match.group())
                else:
                    # Fallback: create a simple action item from the text
                    extracted_actions = [{
                        'title': 'Review meeting notes for action items',
                        'description': result['text'],
                        'assigned_to': None,
                        'due_date': None,
                        'priority': 'Medium'
                    }]
                
                # Add IDs and timestamps to extracted actions
                for action in extracted_actions:
                    action['id'] = str(uuid.uuid4())
                    action['created_at'] = datetime.now().isoformat()
                    action['extracted_by_ai'] = True
                
                return jsonify({'action_items': extracted_actions})
            except json.JSONDecodeError:
                # If JSON parsing fails, return the raw text
                return jsonify({
                    'action_items': [{
                        'id': str(uuid.uuid4()),
                        'title': 'AI Analysis Result',
                        'description': result['text'],
                        'assigned_to': None,
                        'due_date': None,
                        'priority': 'Medium',
                        'created_at': datetime.now().isoformat(),
                        'extracted_by_ai': True
                    }]
                })
        else:
            return jsonify({'error': result.get('error', 'Failed to extract action items')}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/meetings/<meeting_id>/export/html', methods=['GET'])
def export_meeting_html(meeting_id):
    """Export meeting as HTML"""
    try:
        meetings = load_meetings()
        meeting = next((m for m in meetings if m['id'] == meeting_id), None)
        
        if not meeting:
            return jsonify({'error': 'Meeting not found'}), 404
        
        exporter = MeetingExporter()
        html_content = exporter.export_to_html(meeting)
        
        return html_content, 200, {
            'Content-Type': 'text/html',
            'Content-Disposition': f'attachment; filename="{get_meeting_filename(meeting, "html")}"'
        }
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/meetings/<meeting_id>/export/pdf', methods=['GET'])
def export_meeting_pdf(meeting_id):
    """Export meeting as PDF"""
    try:
        meetings = load_meetings()
        meeting = next((m for m in meetings if m['id'] == meeting_id), None)
        
        if not meeting:
            return jsonify({'error': 'Meeting not found'}), 404
        
        try:
            exporter = MeetingExporter()
            pdf_buffer = exporter.export_to_pdf(meeting)
            
            return send_file(
                pdf_buffer,
                as_attachment=True,
                download_name=get_meeting_filename(meeting, 'pdf'),
                mimetype='application/pdf'
            )
        except ImportError as ie:
            return jsonify({
                'error': 'PDF export not available. Please install reportlab: pip install reportlab',
                'details': str(ie)
            }), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/meetings/<meeting_id>/export/word', methods=['GET'])
def export_meeting_word(meeting_id):
    """Export meeting as Word document"""
    try:
        meetings = load_meetings()
        meeting = next((m for m in meetings if m['id'] == meeting_id), None)
        
        if not meeting:
            return jsonify({'error': 'Meeting not found'}), 404
        
        try:
            exporter = MeetingExporter()
            word_buffer = exporter.export_to_word(meeting)
            
            return send_file(
                word_buffer,
                as_attachment=True,
                download_name=get_meeting_filename(meeting, 'docx'),
                mimetype='application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            )
        except ImportError as ie:
            return jsonify({
                'error': 'Word export not available. Please install python-docx: pip install python-docx',
                'details': str(ie)
            }), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/meetings/<meeting_id>/attachments', methods=['POST'])
def upload_meeting_attachment(meeting_id):
    """Upload an attachment for a meeting"""
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    # Create attachment directory for meetings
    meeting_dir = os.path.join(ATTACHMENTS_DIR, 'meetings', meeting_id)
    os.makedirs(meeting_dir, exist_ok=True)
    
    # Save file with unique ID
    file_id = str(uuid.uuid4())
    filename = secure_filename(file.filename)
    file_path = os.path.join(meeting_dir, f"{file_id}-{filename}")
    file.save(file_path)
    
    # Update meeting with attachment info
    meetings = load_meetings()
    for meeting in meetings:
        if meeting['id'] == meeting_id:
            if 'attachments' not in meeting:
                meeting['attachments'] = []
            
            attachment = {
                'id': file_id,
                'filename': filename,
                'size': os.path.getsize(file_path),
                'type': file.mimetype or 'application/octet-stream',
                'uploadedAt': datetime.now().isoformat()
            }
            meeting['attachments'].append(attachment)
            
            save_meetings(meetings)
            return jsonify(attachment)
    
    return jsonify({'error': 'Meeting not found'}), 404

@app.route('/api/meetings/<meeting_id>/attachments/<attachment_id>', methods=['DELETE'])
def delete_meeting_attachment(meeting_id, attachment_id):
    """Delete a meeting attachment"""
    meetings = load_meetings()
    
    for meeting in meetings:
        if meeting['id'] == meeting_id:
            if 'attachments' in meeting:
                # Find and remove attachment
                meeting['attachments'] = [
                    a for a in meeting['attachments'] 
                    if a['id'] != attachment_id
                ]
                
                # Delete file from disk
                meeting_dir = os.path.join(ATTACHMENTS_DIR, 'meetings', meeting_id)
                for filename in os.listdir(meeting_dir):
                    if filename.startswith(attachment_id):
                        file_path = os.path.join(meeting_dir, filename)
                        try:
                            os.remove(file_path)
                        except:
                            pass
                
                save_meetings(meetings)
                return '', 204
    
    return jsonify({'error': 'Meeting or attachment not found'}), 404

@app.route('/api/meetings/<meeting_id>/attachments/<attachment_id>', methods=['GET'])
def download_meeting_attachment(meeting_id, attachment_id):
    """Download a meeting attachment"""
    meetings = load_meetings()
    
    for meeting in meetings:
        if meeting['id'] == meeting_id:
            if 'attachments' in meeting:
                attachment = next((a for a in meeting['attachments'] if a['id'] == attachment_id), None)
                if attachment:
                    meeting_dir = os.path.join(ATTACHMENTS_DIR, 'meetings', meeting_id)
                    for filename in os.listdir(meeting_dir):
                        if filename.startswith(attachment_id):
                            file_path = os.path.join(meeting_dir, filename)
                            return send_file(file_path, as_attachment=True, download_name=attachment['filename'])
    
    return jsonify({'error': 'Attachment not found'}), 404

if __name__ == '__main__':
    
    # Try different ports if 5000 is in use
    import socket
    import webbrowser
    ports_to_try = [5000, 5001, 8080, 8000, 3000]
    port = None
    
    for p in ports_to_try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        result = sock.connect_ex(('localhost', p))
        sock.close()
        if result != 0:  # Port is available
            port = p
            break
    
    if port is None:
        port = 5000  # Default fallback
    
    print("="*50)
    print("   TASK MANAGER APPLICATION")
    print("="*50)
    print(f"Starting server on port {port}...")
    print(f"Dashboard: http://localhost:{port}/")
    print(f"Tasks: http://localhost:{port}/tasks")
    print(f"Settings: http://localhost:{port}/settings")
    print("="*50)
    print("Press Ctrl+C to stop the server")
    print()
    
    # Open browser automatically after a short delay
    # Only open browser in the main process, not in the reloader process
    if os.environ.get('WERKZEUG_RUN_MAIN') != 'true':
        def open_browser():
            time.sleep(1.5)
            webbrowser.open(f'http://localhost:{port}')
        
        browser_thread = threading.Thread(target=open_browser, daemon=True)
        browser_thread.start()
    
    app.run(debug=False, port=port, host='127.0.0.1')