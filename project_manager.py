"""
Advanced Project Management Module
Provides critical path analysis, resource management, and project analytics
"""

import json
import os
from datetime import datetime, date, timedelta
from typing import List, Dict, Optional, Tuple, Set
import uuid
from collections import defaultdict, deque
import heapq

class ProjectManager:
    def __init__(self):
        self.projects_file = 'data/projects.json'
        self.tasks_file = 'data/tasks.json'
        self.resources_file = 'data/resources.json'
        
    def load_projects(self):
        """Load projects from JSON file"""
        if os.path.exists(self.projects_file):
            with open(self.projects_file, 'r') as f:
                return json.load(f)
        return []
    
    def save_projects(self, projects):
        """Save projects to JSON file"""
        os.makedirs('data', exist_ok=True)
        with open(self.projects_file, 'w') as f:
            json.dump(projects, f, indent=2, default=str)
    
    def calculate_critical_path(self, project_id: str) -> Dict:
        """
        Calculate the critical path for a project using the Critical Path Method (CPM)
        Returns the critical path, slack times, and project duration
        """
        project = self.get_project(project_id)
        if not project:
            return {"error": "Project not found"}
        
        tasks = self.get_project_tasks(project_id)
        if not tasks:
            return {"critical_path": [], "project_duration": 0, "slack_times": {}}
        
        # Build task dependency graph
        task_map = {task['id']: task for task in tasks}
        dependencies = defaultdict(list)
        dependents = defaultdict(list)
        
        for task in tasks:
            # Handle both old format (separate arrays) and potential new format
            task_deps = task.get('dependencies', [])
            
            # If dependencies is a list (old format)
            if isinstance(task_deps, list):
                depends_on = task_deps
            # If dependencies is a dict with depends_on key (new format)
            elif isinstance(task_deps, dict):
                depends_on = task_deps.get('depends_on', [])
            else:
                depends_on = []
            
            for dep_id in depends_on:
                if dep_id in task_map:
                    dependencies[task['id']].append(dep_id)
                    dependents[dep_id].append(task['id'])
        
        # Calculate early start and early finish times
        early_times = {}
        visited = set()
        
        def calculate_early_times(task_id):
            if task_id in visited:
                return early_times.get(task_id, {})
            
            visited.add(task_id)
            task = task_map[task_id]
            duration = self._get_task_duration(task)
            
            deps = dependencies[task_id]
            if not deps:
                # No dependencies, can start immediately
                early_start = 0
            else:
                # Must wait for all dependencies to finish
                early_start = 0
                for dep_id in deps:
                    dep_times = calculate_early_times(dep_id)
                    early_start = max(early_start, dep_times.get('early_finish', 0))
            
            early_finish = early_start + duration
            early_times[task_id] = {
                'early_start': early_start,
                'early_finish': early_finish,
                'duration': duration
            }
            
            return early_times[task_id]
        
        # Calculate early times for all tasks
        for task_id in task_map:
            calculate_early_times(task_id)
        
        # Find project duration (maximum early finish time)
        project_duration = max(
            times['early_finish'] for times in early_times.values()
        ) if early_times else 0
        
        # Calculate late start and late finish times (backward pass)
        late_times = {}
        visited_late = set()
        
        def calculate_late_times(task_id):
            if task_id in visited_late:
                return late_times.get(task_id, {})
            
            visited_late.add(task_id)
            task = task_map[task_id]
            duration = self._get_task_duration(task)
            
            deps = dependents[task_id]
            if not deps:
                # No dependent tasks, can finish at project end
                late_finish = project_duration
            else:
                # Must finish before any dependent task needs to start
                late_finish = project_duration
                for dep_id in deps:
                    dep_times = calculate_late_times(dep_id)
                    late_finish = min(late_finish, dep_times.get('late_start', project_duration))
            
            late_start = late_finish - duration
            late_times[task_id] = {
                'late_start': late_start,
                'late_finish': late_finish,
                'duration': duration
            }
            
            return late_times[task_id]
        
        # Calculate late times for all tasks
        for task_id in task_map:
            calculate_late_times(task_id)
        
        # Calculate slack times and identify critical path
        slack_times = {}
        critical_tasks = []
        
        for task_id in task_map:
            early = early_times.get(task_id, {})
            late = late_times.get(task_id, {})
            
            slack = late.get('late_start', 0) - early.get('early_start', 0)
            slack_times[task_id] = slack
            
            if slack == 0:
                critical_tasks.append(task_id)
        
        # Build the critical path sequence
        critical_path = self._build_critical_path_sequence(
            critical_tasks, dependencies, task_map
        )
        
        return {
            "critical_path": critical_path,
            "project_duration": project_duration,
            "slack_times": slack_times,
            "early_times": early_times,
            "late_times": late_times
        }
    
    def _get_task_duration(self, task: Dict) -> int:
        """Calculate task duration in days"""
        gantt_props = task.get('gantt_properties', {})
        
        if gantt_props.get('duration'):
            return gantt_props['duration']
        
        # Try to calculate from dates
        start_date = gantt_props.get('start_date') or task.get('created_date')
        end_date = gantt_props.get('end_date') or task.get('follow_up_date')
        
        if start_date and end_date:
            try:
                start = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
                end = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
                duration = (end - start).days
                return max(1, duration)  # Minimum 1 day duration
            except:
                pass
        
        return 5  # Default duration
    
    def _build_critical_path_sequence(self, critical_tasks: List[str], 
                                     dependencies: Dict, task_map: Dict) -> List[str]:
        """Build the ordered sequence of critical path tasks"""
        if not critical_tasks:
            return []
        
        # Find tasks with no dependencies in critical path
        start_tasks = []
        for task_id in critical_tasks:
            deps = dependencies[task_id]
            if not deps or not any(dep in critical_tasks for dep in deps):
                start_tasks.append(task_id)
        
        if not start_tasks:
            # Circular dependency or error, return unordered list
            return critical_tasks
        
        # Build path using BFS
        path = []
        visited = set()
        queue = deque(start_tasks)
        
        while queue:
            task_id = queue.popleft()
            if task_id in visited:
                continue
            
            visited.add(task_id)
            path.append(task_id)
            
            # Add dependent critical tasks
            for dependent_id in task_map:
                if dependent_id in critical_tasks and dependent_id not in visited:
                    deps = dependencies[dependent_id]
                    if task_id in deps:
                        # Check if all dependencies are visited
                        if all(dep in visited or dep not in critical_tasks for dep in deps):
                            queue.append(dependent_id)
        
        return path
    
    def calculate_resource_utilization(self, project_id: str, 
                                      start_date: Optional[str] = None,
                                      end_date: Optional[str] = None) -> Dict:
        """
        Calculate resource utilization for a project
        Returns utilization percentages and conflicts
        """
        project = self.get_project(project_id)
        if not project:
            return {"error": "Project not found"}
        
        resources = project.get('resources', [])
        tasks = self.get_project_tasks(project_id)
        
        # Build resource allocation timeline
        resource_timeline = defaultdict(list)
        
        for task in tasks:
            task_resources = task.get('resource_assignments', [])
            for assignment in task_resources:
                resource_id = assignment['resource_id']
                resource_timeline[resource_id].append({
                    'task_id': task['id'],
                    'task_name': task.get('title', 'Unnamed Task'),
                    'start_date': task.get('gantt_properties', {}).get('start_date'),
                    'end_date': task.get('gantt_properties', {}).get('end_date'),
                    'allocation_hours': assignment.get('allocation_hours', 0)
                })
        
        # Calculate utilization for each resource
        utilization_report = {}
        conflicts = []
        
        for resource in resources:
            resource_id = resource['id']
            resource_name = resource['name']
            allocations = resource_timeline[resource_id]
            
            if not allocations:
                utilization_report[resource_id] = {
                    'name': resource_name,
                    'utilization_percentage': 0,
                    'allocated_hours': 0,
                    'available_hours': self._calculate_available_hours(
                        resource, start_date, end_date
                    ),
                    'tasks': []
                }
                continue
            
            # Check for overlapping assignments
            sorted_allocations = sorted(
                allocations, 
                key=lambda x: x.get('start_date', '')
            )
            
            total_hours = sum(a['allocation_hours'] for a in allocations)
            available_hours = self._calculate_available_hours(
                resource, start_date, end_date
            )
            
            utilization_percentage = (
                (total_hours / available_hours * 100) if available_hours > 0 else 0
            )
            
            # Check for conflicts (overlapping assignments)
            for i in range(len(sorted_allocations)):
                for j in range(i + 1, len(sorted_allocations)):
                    if self._check_overlap(sorted_allocations[i], sorted_allocations[j]):
                        conflicts.append({
                            'resource_id': resource_id,
                            'resource_name': resource_name,
                            'task1': sorted_allocations[i]['task_name'],
                            'task2': sorted_allocations[j]['task_name'],
                            'overlap_period': self._get_overlap_period(
                                sorted_allocations[i], sorted_allocations[j]
                            )
                        })
            
            utilization_report[resource_id] = {
                'name': resource_name,
                'utilization_percentage': utilization_percentage,
                'allocated_hours': total_hours,
                'available_hours': available_hours,
                'tasks': allocations,
                'is_overallocated': utilization_percentage > 100
            }
        
        return {
            'utilization': utilization_report,
            'conflicts': conflicts,
            'summary': {
                'total_resources': len(resources),
                'overallocated_resources': sum(
                    1 for u in utilization_report.values() if u['is_overallocated']
                ),
                'average_utilization': (
                    sum(u['utilization_percentage'] for u in utilization_report.values()) / 
                    len(utilization_report) if utilization_report else 0
                )
            }
        }
    
    def _calculate_available_hours(self, resource: Dict, 
                                  start_date: Optional[str], 
                                  end_date: Optional[str]) -> float:
        """Calculate available working hours for a resource in a period"""
        allocation_percentage = resource.get('allocation_percentage', 100)
        
        # Default to 8 hours per day, 5 days per week
        hours_per_day = 8 * (allocation_percentage / 100)
        
        if not start_date or not end_date:
            # Use resource's allocation period
            start_date = resource.get('start_date')
            end_date = resource.get('end_date')
        
        if start_date and end_date:
            try:
                start = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
                end = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
                
                # Calculate working days (excluding weekends)
                total_days = (end - start).days + 1
                weeks = total_days // 7
                remaining_days = total_days % 7
                
                working_days = weeks * 5
                
                # Add remaining days (excluding weekends)
                for i in range(remaining_days):
                    day = start + timedelta(days=weeks * 7 + i)
                    if day.weekday() < 5:  # Monday = 0, Friday = 4
                        working_days += 1
                
                return working_days * hours_per_day
            except:
                pass
        
        # Default to 160 hours per month
        return 160 * (allocation_percentage / 100)
    
    def _check_overlap(self, alloc1: Dict, alloc2: Dict) -> bool:
        """Check if two allocations overlap in time"""
        start1 = alloc1.get('start_date')
        end1 = alloc1.get('end_date')
        start2 = alloc2.get('start_date')
        end2 = alloc2.get('end_date')
        
        if not all([start1, end1, start2, end2]):
            return False
        
        try:
            s1 = datetime.fromisoformat(start1.replace('Z', '+00:00'))
            e1 = datetime.fromisoformat(end1.replace('Z', '+00:00'))
            s2 = datetime.fromisoformat(start2.replace('Z', '+00:00'))
            e2 = datetime.fromisoformat(end2.replace('Z', '+00:00'))
            
            return not (e1 < s2 or e2 < s1)
        except:
            return False
    
    def _get_overlap_period(self, alloc1: Dict, alloc2: Dict) -> Dict:
        """Get the overlapping period between two allocations"""
        start1 = alloc1.get('start_date')
        end1 = alloc1.get('end_date')
        start2 = alloc2.get('start_date')
        end2 = alloc2.get('end_date')
        
        if not all([start1, end1, start2, end2]):
            return {}
        
        try:
            s1 = datetime.fromisoformat(start1.replace('Z', '+00:00'))
            e1 = datetime.fromisoformat(end1.replace('Z', '+00:00'))
            s2 = datetime.fromisoformat(start2.replace('Z', '+00:00'))
            e2 = datetime.fromisoformat(end2.replace('Z', '+00:00'))
            
            overlap_start = max(s1, s2)
            overlap_end = min(e1, e2)
            
            if overlap_start <= overlap_end:
                return {
                    'start': overlap_start.isoformat(),
                    'end': overlap_end.isoformat(),
                    'days': (overlap_end - overlap_start).days + 1
                }
        except:
            pass
        
        return {}
    
    def calculate_budget_forecast(self, project_id: str) -> Dict:
        """
        Calculate budget forecast and burn rate for a project
        """
        project = self.get_project(project_id)
        if not project:
            return {"error": "Project not found"}
        
        budget = project.get('budget', {})
        total_budget = budget.get('total_budget', 0)
        budget_breakdown = budget.get('budget_breakdown', [])
        expense_items = budget.get('expense_items', [])
        
        # Calculate spent, committed, and remaining
        total_spent = sum(
            item['amount'] for item in expense_items 
            if item.get('status') == 'Spent'
        )
        total_committed = sum(
            item['amount'] for item in expense_items 
            if item.get('status') == 'Committed'
        )
        total_planned = sum(
            item['amount'] for item in expense_items 
            if item.get('status') == 'Planned'
        )
        
        remaining_budget = total_budget - total_spent - total_committed
        
        # Calculate burn rate
        project_start = project.get('actual_start_date') or project.get('start_date')
        if project_start:
            try:
                start = datetime.fromisoformat(project_start.replace('Z', '+00:00'))
                today = datetime.now()
                days_elapsed = (today - start).days + 1
                
                if days_elapsed > 0:
                    daily_burn_rate = total_spent / days_elapsed
                    weekly_burn_rate = daily_burn_rate * 7
                    monthly_burn_rate = daily_burn_rate * 30
                    
                    # Forecast completion
                    if daily_burn_rate > 0:
                        days_to_budget_exhaustion = remaining_budget / daily_burn_rate
                        forecast_exhaustion_date = today + timedelta(days=days_to_budget_exhaustion)
                    else:
                        days_to_budget_exhaustion = float('inf')
                        forecast_exhaustion_date = None
                else:
                    daily_burn_rate = 0
                    weekly_burn_rate = 0
                    monthly_burn_rate = 0
                    days_to_budget_exhaustion = float('inf')
                    forecast_exhaustion_date = None
            except:
                daily_burn_rate = 0
                weekly_burn_rate = 0
                monthly_burn_rate = 0
                days_to_budget_exhaustion = float('inf')
                forecast_exhaustion_date = None
        else:
            daily_burn_rate = 0
            weekly_burn_rate = 0
            monthly_burn_rate = 0
            days_to_budget_exhaustion = float('inf')
            forecast_exhaustion_date = None
        
        # Category breakdown analysis
        category_analysis = []
        for category in budget_breakdown:
            cat_name = category['category']
            allocated = category['allocated']
            spent = category.get('spent', 0)
            committed = category.get('committed', 0)
            
            category_analysis.append({
                'category': cat_name,
                'allocated': allocated,
                'spent': spent,
                'committed': committed,
                'remaining': allocated - spent - committed,
                'utilization_percentage': (spent / allocated * 100) if allocated > 0 else 0,
                'status': 'Over Budget' if spent + committed > allocated else 'On Track'
            })
        
        return {
            'summary': {
                'total_budget': total_budget,
                'total_spent': total_spent,
                'total_committed': total_committed,
                'total_planned': total_planned,
                'remaining_budget': remaining_budget,
                'budget_utilization': (total_spent / total_budget * 100) if total_budget > 0 else 0
            },
            'burn_rate': {
                'daily': daily_burn_rate,
                'weekly': weekly_burn_rate,
                'monthly': monthly_burn_rate
            },
            'forecast': {
                'days_to_exhaustion': days_to_budget_exhaustion,
                'exhaustion_date': forecast_exhaustion_date.isoformat() if forecast_exhaustion_date else None,
                'projected_overrun': max(0, (total_spent + total_committed + total_planned) - total_budget)
            },
            'categories': category_analysis
        }
    
    def get_project(self, project_id: str) -> Optional[Dict]:
        """Get a specific project by ID"""
        projects = self.load_projects()
        for project in projects:
            if project['id'] == project_id:
                return project
        return None
    
    def get_project_tasks(self, project_id: str) -> List[Dict]:
        """Get all tasks associated with a project"""
        if os.path.exists(self.tasks_file):
            with open(self.tasks_file, 'r') as f:
                all_tasks = json.load(f)
                project_tasks = []
                for task in all_tasks:
                    if task.get('project_id') == project_id:
                        # Ensure dependencies structure is correct
                        if 'dependencies' not in task:
                            task['dependencies'] = []
                        if 'blocks' not in task:
                            task['blocks'] = []
                        project_tasks.append(task)
                return project_tasks
        return []
    
    def create_project_from_template(self, template_id: str, project_data: Dict) -> Dict:
        """Create a new project from a template"""
        templates = self.load_templates()
        template = None
        
        for t in templates:
            if t['id'] == template_id:
                template = t
                break
        
        if not template:
            return {"error": "Template not found"}
        
        # Create project structure from template
        project = {
            'id': str(uuid.uuid4()),
            'name': project_data.get('name', template['name']),
            'description': project_data.get('description', template.get('description', '')),
            'customer_name': project_data.get('customer_name', ''),
            'project_code': project_data.get('project_code', ''),
            'status': 'Planning',
            'priority': project_data.get('priority', 'Medium'),
            'created_date': datetime.now().isoformat(),
            'start_date': project_data.get('start_date'),
            'end_date': project_data.get('end_date'),
            'project_manager': project_data.get('project_manager', ''),
            'project_type': project_data.get('project_type', ''),
            'methodology': project_data.get('methodology', 'Agile'),
            'phases': [],
            'budget': {
                'total_budget': project_data.get('total_budget', 0),
                'currency': project_data.get('currency', 'USD'),
                'budget_breakdown': [],
                'expense_items': []
            },
            'resources': [],
            'risks': [],
            'gantt_data': {
                'critical_path': [],
                'baseline': {
                    'start_date': project_data.get('start_date'),
                    'end_date': project_data.get('end_date')
                },
                'dependencies': []
            },
            'task_ids': [],
            'deal_ids': [],
            'objective_ids': [],
            'tags': template.get('tags', []),
            'custom_fields': {},
            'attachments': [],
            'history': [],
            'comments': []
        }
        
        # Add phases from template
        start_date = datetime.fromisoformat(project_data['start_date']) if project_data.get('start_date') else datetime.now()
        
        for phase_template in template.get('default_phases', []):
            phase_start = start_date
            phase_end = phase_start + timedelta(days=phase_template['duration_days'])
            
            phase = {
                'id': str(uuid.uuid4()),
                'name': phase_template['name'],
                'description': phase_template.get('description', ''),
                'start_date': phase_start.isoformat(),
                'end_date': phase_end.isoformat(),
                'status': 'Not Started',
                'progress': 0,
                'milestones': []
            }
            
            # Add milestones from template
            for milestone_template in phase_template.get('milestones', []):
                milestone_date = phase_start + timedelta(days=milestone_template['offset_days'])
                milestone = {
                    'id': str(uuid.uuid4()),
                    'name': milestone_template['name'],
                    'description': milestone_template.get('description', ''),
                    'due_date': milestone_date.isoformat(),
                    'status': 'Pending',
                    'type': milestone_template.get('type', 'Deliverable'),
                    'dependencies': []
                }
                phase['milestones'].append(milestone)
            
            project['phases'].append(phase)
            start_date = phase_end
        
        # Add budget categories from template
        for category in template.get('default_budget_categories', []):
            project['budget']['budget_breakdown'].append({
                'category': category,
                'allocated': 0,
                'spent': 0,
                'committed': 0
            })
        
        # Add default roles from template
        for role in template.get('default_roles', []):
            project['resources'].append({
                'id': str(uuid.uuid4()),
                'name': '',
                'role': role,
                'allocation_percentage': 100,
                'start_date': project_data.get('start_date'),
                'end_date': project_data.get('end_date'),
                'hourly_rate': 0,
                'skills': []
            })
        
        # Save the project
        projects = self.load_projects()
        projects.append(project)
        self.save_projects(projects)
        
        return project
    
    def load_templates(self) -> List[Dict]:
        """Load project templates"""
        projects = self.load_projects()
        if isinstance(projects, dict) and 'templates' in projects:
            return projects['templates']
        return []
    
    def calculate_project_health_score(self, project_id: str) -> Dict:
        """
        Calculate overall project health score based on multiple factors
        """
        project = self.get_project(project_id)
        if not project:
            return {"error": "Project not found"}
        
        scores = {}
        weights = {
            'schedule': 0.3,
            'budget': 0.25,
            'resource': 0.2,
            'risk': 0.15,
            'progress': 0.1
        }
        
        # Schedule health - wrap in try/except to handle potential errors
        try:
            critical_path_data = self.calculate_critical_path(project_id)
        except Exception as e:
            # If critical path calculation fails, use default score
            critical_path_data = {'error': str(e)}
        if 'error' not in critical_path_data:
            # Check if project is on schedule
            project_end = project.get('end_date')
            if project_end:
                try:
                    end_date = datetime.fromisoformat(project_end.replace('Z', '+00:00'))
                    today = datetime.now()
                    days_remaining = (end_date - today).days
                    
                    if days_remaining > 30:
                        scores['schedule'] = 100
                    elif days_remaining > 7:
                        scores['schedule'] = 75
                    elif days_remaining > 0:
                        scores['schedule'] = 50
                    else:
                        scores['schedule'] = 25
                except:
                    scores['schedule'] = 50
            else:
                scores['schedule'] = 50
        else:
            scores['schedule'] = 50
        
        # Budget health
        budget_forecast = self.calculate_budget_forecast(project_id)
        if 'error' not in budget_forecast:
            utilization = budget_forecast['summary']['budget_utilization']
            if utilization < 80:
                scores['budget'] = 100
            elif utilization < 90:
                scores['budget'] = 75
            elif utilization < 100:
                scores['budget'] = 50
            else:
                scores['budget'] = 25
        else:
            scores['budget'] = 50
        
        # Resource health
        resource_utilization = self.calculate_resource_utilization(project_id)
        if 'error' not in resource_utilization:
            avg_utilization = resource_utilization['summary']['average_utilization']
            overallocated = resource_utilization['summary']['overallocated_resources']
            
            if avg_utilization < 80 and overallocated == 0:
                scores['resource'] = 100
            elif avg_utilization < 90 and overallocated < 2:
                scores['resource'] = 75
            elif avg_utilization < 100 and overallocated < 3:
                scores['resource'] = 50
            else:
                scores['resource'] = 25
        else:
            scores['resource'] = 50
        
        # Risk health
        risks = project.get('risks', [])
        high_risks = sum(1 for r in risks if r.get('impact') in ['High', 'Critical'] and r.get('status') == 'Open')
        
        if high_risks == 0:
            scores['risk'] = 100
        elif high_risks < 2:
            scores['risk'] = 75
        elif high_risks < 4:
            scores['risk'] = 50
        else:
            scores['risk'] = 25
        
        # Progress health
        phases = project.get('phases', [])
        if phases:
            avg_progress = sum(p.get('progress', 0) for p in phases) / len(phases)
            scores['progress'] = avg_progress
        else:
            scores['progress'] = 0
        
        # Calculate weighted score
        total_score = sum(scores.get(factor, 50) * weight for factor, weight in weights.items())
        
        # Determine health status
        if total_score >= 80:
            health_status = 'Excellent'
            health_color = 'green'
        elif total_score >= 60:
            health_status = 'Good'
            health_color = 'blue'
        elif total_score >= 40:
            health_status = 'At Risk'
            health_color = 'yellow'
        else:
            health_status = 'Critical'
            health_color = 'red'
        
        return {
            'overall_score': total_score,
            'health_status': health_status,
            'health_color': health_color,
            'component_scores': scores,
            'weights': weights,
            'recommendations': self._generate_health_recommendations(scores)
        }
    
    def _generate_health_recommendations(self, scores: Dict) -> List[str]:
        """Generate recommendations based on health scores"""
        recommendations = []
        
        if scores.get('schedule', 100) < 50:
            recommendations.append("Review project timeline and consider adjusting deadlines or adding resources")
        
        if scores.get('budget', 100) < 50:
            recommendations.append("Budget is at risk - review expenses and consider cost reduction measures")
        
        if scores.get('resource', 100) < 50:
            recommendations.append("Resources are overallocated - consider redistributing work or adding team members")
        
        if scores.get('risk', 100) < 50:
            recommendations.append("High number of critical risks - implement mitigation strategies immediately")
        
        if scores.get('progress', 100) < 30:
            recommendations.append("Project progress is behind schedule - review blockers and accelerate critical tasks")
        
        return recommendations