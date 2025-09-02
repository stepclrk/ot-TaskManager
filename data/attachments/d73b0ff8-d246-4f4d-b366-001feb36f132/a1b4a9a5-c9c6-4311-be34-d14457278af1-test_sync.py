"""
Test script to verify FTP sync functionality
"""

import json
from datetime import datetime
import os

def prepare_test_deal_file():
    """
    Prepare a test deal file as if from another user (andy)
    with an updated value and newer timestamp
    """
    
    # Read current deals
    with open('data/deals.json', 'r') as f:
        deals = json.load(f)
    
    if not deals:
        print("No deals found. Please create a deal first.")
        return
    
    # Modify the first deal
    deal = deals[0].copy()
    
    # Update some values to simulate Andy's changes
    deal['dealForecast'] = "2500000"  # Changed value
    deal['updated_at'] = datetime.now().isoformat()  # New timestamp
    deal['sync_metadata'] = {
        'last_synced': datetime.now().isoformat(),
        'synced_by': 'andy',
        'modified_by': 'andy'
    }
    
    # Add a note from Andy
    if 'notes' not in deal:
        deal['notes'] = []
    deal['notes'].append({
        'id': 'note-andy-1',
        'text': 'Updated forecast based on new requirements',
        'author': 'andy',
        'timestamp': datetime.now().isoformat()
    })
    
    # Save as Andy's file
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    filename = f'test_andy_deals_{timestamp}.json'
    
    with open(filename, 'w') as f:
        json.dump([deal], f, indent=2)
    
    print(f"Created test file: {filename}")
    print(f"Deal ID: {deal['id']}")
    print(f"Updated forecast from 2000000 to {deal['dealForecast']}")
    print(f"Updated timestamp: {deal['updated_at']}")
    print("\nNow you can:")
    print("1. Upload this file to FTP as: deals_andy_{timestamp}.json")
    print("2. Run sync from the deals page")
    print("3. The forecast should update from 2000000 to 2500000")
    
    return filename

def clear_sync_tracking():
    """Clear the synced files tracking to force reprocessing"""
    synced_file = 'data/synced_files.json'
    if os.path.exists(synced_file):
        with open(synced_file, 'w') as f:
            json.dump([], f)
        print("Cleared synced files tracking")
    else:
        print("No synced files tracking found")

def check_sync_config():
    """Check current sync configuration"""
    settings_file = 'data/settings.json'
    if os.path.exists(settings_file):
        with open(settings_file, 'r') as f:
            settings = json.load(f)
            
        user_id = settings.get('user_id', 'not set')
        team_ids = settings.get('team_ids', [])
        ftp_host = settings.get('ftp_config', {}).get('host', 'not set')
        
        print(f"Current user ID: {user_id}")
        print(f"Team IDs: {team_ids}")
        print(f"FTP Host: {ftp_host}")
        
        if user_id == 'andy':
            print("\n⚠️  WARNING: Your user ID is 'andy'. You won't download andy's files!")
            print("   Change your user ID to 'stephen' to receive andy's updates.")
    else:
        print("No settings file found. Please configure sync first.")

if __name__ == "__main__":
    print("=== FTP Sync Test Helper ===\n")
    
    print("1. Checking sync configuration...")
    check_sync_config()
    
    print("\n2. Creating test deal file from 'andy'...")
    test_file = prepare_test_deal_file()
    
    print("\n3. Clearing sync tracking (optional)...")
    response = input("Clear synced files tracking? (y/n): ")
    if response.lower() == 'y':
        clear_sync_tracking()
    
    print("\n✅ Test preparation complete!")
    print("\nNext steps:")
    print("1. Upload the test file to your FTP server")
    print("2. Make sure your user ID is NOT 'andy' (should be 'stephen')")
    print("3. Click 'Sync Now' on the deals page")
    print("4. Check if the deal forecast updates from 2000000 to 2500000")