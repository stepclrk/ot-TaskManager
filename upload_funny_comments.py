#!/usr/bin/env python3
"""
Upload funny_comments.json to FTP server for team sharing
"""

import json
import os
from ftp_sync import FTPSyncManager

def upload_funny_comments():
    """Upload the funny comments file to FTP"""
    
    # Load settings
    settings_file = os.path.join('data', 'settings.json')
    with open(settings_file, 'r') as f:
        settings = json.load(f)
    
    if not settings.get('sync_enabled'):
        print("Sync is not enabled in settings")
        return False
    
    # Create sync manager
    sync_manager = FTPSyncManager(settings)
    
    # Connect to FTP
    if not sync_manager.connect():
        print("Failed to connect to FTP server")
        return False
    
    try:
        # Upload funny_comments.json
        local_file = os.path.join('data', 'funny_comments.json')
        remote_file = 'funny_comments.json'
        
        with open(local_file, 'rb') as f:
            sync_manager.ftp.storbinary(f'STOR {remote_file}', f)
        
        print(f"Successfully uploaded funny_comments.json to FTP server")
        return True
        
    except Exception as e:
        print(f"Error uploading file: {e}")
        return False
    finally:
        sync_manager.disconnect()

if __name__ == "__main__":
    success = upload_funny_comments()
    exit(0 if success else 1)