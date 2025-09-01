"""
Team Management Module
Handles team member management, task assignments, and workload tracking
"""

import json
import os
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
import uuid

class TeamManager:
    def __init__(self, data_dir: str = 'data'):
        self.data_dir = data_dir
        self.teams_file = os.path.join(data_dir, 'teams.json')
        self.ensure_data_files()
        
    def ensure_data_files(self):
        """Ensure all required data files exist"""
        os.makedirs(self.data_dir, exist_ok=True)
        
        # Initialize teams file if it doesn't exist
        if not os.path.exists(self.teams_file):
            initial_data = {
                "teams": [],
                "members": [],
                "departments": ["Development", "Design", "Marketing", "Sales", "Support", "Management"]
            }
            self.save_teams_data(initial_data)
    
    def save_teams_data(self, data: Dict):
        """Save teams data to file"""
        with open(self.teams_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
    
    def load_teams_data(self) -> Dict:
        """Load teams data from file"""
        try:
            with open(self.teams_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except:
            return {"teams": [], "members": [], "departments": []}
    
    # Team Management
    def create_team(self, team_data: Dict) -> Dict:
        """Create a new team"""
        data = self.load_teams_data()
        
        team = {
            "id": str(uuid.uuid4()),
            "name": team_data.get("name", ""),
            "description": team_data.get("description", ""),
            "department": team_data.get("department", ""),
            "lead_id": team_data.get("lead_id", None),
            "member_ids": team_data.get("member_ids", []),
            "color": team_data.get("color", "#007bff"),
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat(),
            "is_active": True
        }
        
        data["teams"].append(team)
        self.save_teams_data(data)
        return team
    
    def update_team(self, team_id: str, updates: Dict) -> Optional[Dict]:
        """Update an existing team"""
        data = self.load_teams_data()
        
        for team in data["teams"]:
            if team["id"] == team_id:
                team.update(updates)
                team["updated_at"] = datetime.now().isoformat()
                self.save_teams_data(data)
                return team
        return None
    
    def delete_team(self, team_id: str) -> bool:
        """Delete a team (soft delete)"""
        data = self.load_teams_data()
        
        for team in data["teams"]:
            if team["id"] == team_id:
                team["is_active"] = False
                team["updated_at"] = datetime.now().isoformat()
                self.save_teams_data(data)
                return True
        return False
    
    def get_team(self, team_id: str) -> Optional[Dict]:
        """Get a specific team"""
        data = self.load_teams_data()
        
        for team in data["teams"]:
            if team["id"] == team_id:
                return team
        return None
    
    def get_all_teams(self, include_inactive: bool = False) -> List[Dict]:
        """Get all teams"""
        data = self.load_teams_data()
        
        if include_inactive:
            return data["teams"]
        return [t for t in data["teams"] if t.get("is_active", True)]
    
    # Member Management
    def create_member(self, member_data: Dict) -> Dict:
        """Create a new team member"""
        data = self.load_teams_data()
        
        member = {
            "id": str(uuid.uuid4()),
            "name": member_data.get("name", ""),
            "email": member_data.get("email", ""),
            "role": member_data.get("role", "Team Member"),
            "department": member_data.get("department", ""),
            "team_ids": member_data.get("team_ids", []),
            "skills": member_data.get("skills", []),
            "capacity_hours_per_week": member_data.get("capacity_hours_per_week", 40),
            "avatar_color": member_data.get("avatar_color", self._generate_avatar_color()),
            "is_active": True,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        }
        
        data["members"].append(member)
        self.save_teams_data(data)
        return member
    
    def update_member(self, member_id: str, updates: Dict) -> Optional[Dict]:
        """Update an existing member"""
        data = self.load_teams_data()
        
        for member in data["members"]:
            if member["id"] == member_id:
                member.update(updates)
                member["updated_at"] = datetime.now().isoformat()
                self.save_teams_data(data)
                return member
        return None
    
    def delete_member(self, member_id: str) -> bool:
        """Delete a member (soft delete)"""
        data = self.load_teams_data()
        
        for member in data["members"]:
            if member["id"] == member_id:
                member["is_active"] = False
                member["updated_at"] = datetime.now().isoformat()
                # Remove from all teams
                for team in data["teams"]:
                    if member_id in team.get("member_ids", []):
                        team["member_ids"].remove(member_id)
                    if team.get("lead_id") == member_id:
                        team["lead_id"] = None
                self.save_teams_data(data)
                return True
        return False
    
    def get_member(self, member_id: str) -> Optional[Dict]:
        """Get a specific member"""
        data = self.load_teams_data()
        
        for member in data["members"]:
            if member["id"] == member_id:
                return member
        return None
    
    def get_all_members(self, include_inactive: bool = False) -> List[Dict]:
        """Get all members"""
        data = self.load_teams_data()
        
        if include_inactive:
            return data["members"]
        return [m for m in data["members"] if m.get("is_active", True)]
    
    def get_members_by_team(self, team_id: str) -> List[Dict]:
        """Get all members of a specific team"""
        team = self.get_team(team_id)
        if not team:
            return []
        
        members = []
        for member_id in team.get("member_ids", []):
            member = self.get_member(member_id)
            if member and member.get("is_active", True):
                members.append(member)
        return members
    
    # Task Assignment Analytics
    def get_member_workload(self, member_id: str, tasks: List[Dict]) -> Dict:
        """Calculate workload for a member based on assigned tasks"""
        member = self.get_member(member_id)
        if not member:
            return {}
        
        assigned_tasks = [t for t in tasks if t.get("assigned_to_id") == member_id]
        
        # Calculate metrics
        total_tasks = len(assigned_tasks)
        open_tasks = len([t for t in assigned_tasks if t.get("status") in ["Open", "In Progress"]])
        completed_tasks = len([t for t in assigned_tasks if t.get("status") == "Completed"])
        overdue_tasks = len([t for t in assigned_tasks if self._is_task_overdue(t)])
        
        # Calculate estimated hours
        total_estimated_hours = sum(
            t.get("estimated_hours", 0) for t in assigned_tasks 
            if t.get("status") != "Completed"
        )
        
        # Calculate capacity utilization
        capacity_percentage = (total_estimated_hours / member.get("capacity_hours_per_week", 40)) * 100
        
        return {
            "member": member,
            "total_tasks": total_tasks,
            "open_tasks": open_tasks,
            "completed_tasks": completed_tasks,
            "overdue_tasks": overdue_tasks,
            "total_estimated_hours": total_estimated_hours,
            "capacity_hours_per_week": member.get("capacity_hours_per_week", 40),
            "capacity_percentage": min(capacity_percentage, 200),  # Cap at 200%
            "is_overloaded": capacity_percentage > 100
        }
    
    def get_team_workload(self, team_id: str, tasks: List[Dict]) -> Dict:
        """Calculate workload for an entire team"""
        team = self.get_team(team_id)
        if not team:
            return {}
        
        members = self.get_members_by_team(team_id)
        team_workload = {
            "team": team,
            "members_workload": [],
            "total_tasks": 0,
            "total_open_tasks": 0,
            "total_completed_tasks": 0,
            "total_overdue_tasks": 0,
            "average_capacity_percentage": 0
        }
        
        total_capacity_percentage = 0
        for member in members:
            member_workload = self.get_member_workload(member["id"], tasks)
            team_workload["members_workload"].append(member_workload)
            team_workload["total_tasks"] += member_workload.get("total_tasks", 0)
            team_workload["total_open_tasks"] += member_workload.get("open_tasks", 0)
            team_workload["total_completed_tasks"] += member_workload.get("completed_tasks", 0)
            team_workload["total_overdue_tasks"] += member_workload.get("overdue_tasks", 0)
            total_capacity_percentage += member_workload.get("capacity_percentage", 0)
        
        if members:
            team_workload["average_capacity_percentage"] = total_capacity_percentage / len(members)
        
        return team_workload
    
    def suggest_assignment(self, task: Dict, team_id: Optional[str] = None) -> Optional[str]:
        """Suggest the best team member to assign a task to based on workload"""
        if team_id:
            members = self.get_members_by_team(team_id)
        else:
            members = self.get_all_members()
        
        if not members:
            return None
        
        # Find member with lowest capacity percentage
        best_member = None
        lowest_capacity = float('inf')
        
        # This would need access to all tasks - simplified for now
        for member in members:
            # Check if member has required skills
            required_skills = task.get("required_skills", [])
            member_skills = member.get("skills", [])
            if required_skills and not any(skill in member_skills for skill in required_skills):
                continue
            
            # For now, return first available member
            # In production, would calculate actual workload
            return member["id"]
        
        return members[0]["id"] if members else None
    
    # Helper methods
    def _is_task_overdue(self, task: Dict) -> bool:
        """Check if a task is overdue"""
        if task.get("status") == "Completed":
            return False
        
        due_date = task.get("due_date") or task.get("end_date")
        if not due_date:
            return False
        
        try:
            due = datetime.fromisoformat(due_date.replace('Z', '+00:00'))
            return due < datetime.now()
        except:
            return False
    
    def _generate_avatar_color(self) -> str:
        """Generate a random avatar color"""
        import random
        colors = [
            "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7",
            "#DDA0DD", "#98D8C8", "#F7DC6F", "#BB8FCE", "#85C1E2",
            "#F8B739", "#52B788", "#E76F51", "#F72585", "#4CC9F0"
        ]
        return random.choice(colors)
    
    def get_departments(self) -> List[str]:
        """Get list of departments"""
        data = self.load_teams_data()
        return data.get("departments", [])
    
    def add_department(self, department: str) -> bool:
        """Add a new department"""
        data = self.load_teams_data()
        if department not in data.get("departments", []):
            data.setdefault("departments", []).append(department)
            self.save_teams_data(data)
            return True
        return False