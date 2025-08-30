"""
FTP Sync Module for Task Manager
Handles uploading and downloading of deals data between team members via FTP
"""

import json
import os
import ftplib
import ssl
from datetime import datetime, timedelta
import logging
from typing import Dict, List, Optional, Tuple
import hashlib
import tempfile
from pathlib import Path

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class FTPSyncManager:
    """Manages FTP synchronization of deals between team members"""
    
    def __init__(self, config: Dict):
        """
        Initialize FTP Sync Manager
        
        Args:
            config: Dictionary containing FTP and sync configuration
        """
        self.config = config
        self.ftp_config = config.get('ftp_config', {})
        self.sync_settings = config.get('sync_settings', {})
        self.user_id = config.get('user_id', 'unknown')
        self.team_ids = config.get('team_ids', [])
        self.sync_log_file = 'data/sync_log.json'
        self.ftp = None
        
    def connect(self) -> bool:
        """
        Establish FTP connection
        
        Returns:
            True if connection successful, False otherwise
        """
        try:
            host = self.ftp_config.get('host')
            port = self.ftp_config.get('port', 21)
            username = self.ftp_config.get('username')
            password = self.ftp_config.get('password')
            use_tls = self.ftp_config.get('use_tls', True)  # Default to True for security
            
            # Always try TLS first if not explicitly disabled
            try:
                # Create FTP_TLS connection
                logger.info(f"Attempting secure FTP connection to {host}:{port}")
                
                # Create a more permissive SSL context
                context = ssl.create_default_context()
                context.check_hostname = False  # Some FTP servers have cert issues
                context.verify_mode = ssl.CERT_NONE  # Don't verify cert (for self-signed)
                
                # Connect with TLS
                self.ftp = ftplib.FTP_TLS(context=context)
                self.ftp.connect(host, port, timeout=30)
                
                # Send AUTH TLS command and login
                self.ftp.auth()
                self.ftp.login(username, password)
                
                # Secure the data connection
                self.ftp.prot_p()
                
                # Set encoding for proper file listing
                self.ftp.encoding = 'utf-8'
                
                logger.info("Successfully connected with TLS/SSL")
                
            except Exception as tls_error:
                # If TLS fails and use_tls is False, try plain FTP
                if not use_tls:
                    logger.warning(f"TLS connection failed: {tls_error}. Trying plain FTP...")
                    self.ftp = ftplib.FTP()
                    self.ftp.connect(host, port, timeout=30)
                    self.ftp.login(username, password)
                    self.ftp.encoding = 'utf-8'
                    logger.info("Connected with plain FTP (insecure)")
                else:
                    # TLS is required but failed
                    raise Exception(f"TLS connection required but failed: {str(tls_error)}")
            
            # Navigate to remote directory
            remote_dir = self.ftp_config.get('remote_dir', '/')
            try:
                self.ftp.cwd(remote_dir)
            except ftplib.error_perm:
                # Directory doesn't exist, try to create it
                self._create_remote_directory(remote_dir)
                self.ftp.cwd(remote_dir)
            
            logger.info(f"Successfully connected to FTP server {host}")
            return True
            
        except ftplib.error_perm as e:
            # Permission/Authentication errors
            error_msg = str(e)
            if '421' in error_msg and 'TLS' in error_msg:
                logger.error("FTP server requires TLS/SSL. Please enable 'Use FTPS' in configuration.")
            elif '530' in error_msg:
                logger.error("FTP login failed. Please check username and password.")
            else:
                logger.error(f"FTP permission error: {error_msg}")
            return False
        except ftplib.error_temp as e:
            logger.error(f"Temporary FTP error (try again): {str(e)}")
            return False
        except ConnectionRefusedError:
            logger.error(f"Connection refused. Please check FTP host and port.")
            return False
        except TimeoutError:
            logger.error(f"Connection timeout. Please check network and FTP server status.")
            return False
        except Exception as e:
            logger.error(f"Failed to connect to FTP: {str(e)}")
            return False
    
    def disconnect(self):
        """Close FTP connection"""
        if self.ftp:
            try:
                self.ftp.quit()
            except:
                self.ftp.close()
            self.ftp = None
    
    def _create_remote_directory(self, path: str):
        """Create remote directory structure if it doesn't exist"""
        dirs = path.strip('/').split('/')
        current_dir = ''
        for dir_name in dirs:
            current_dir += '/' + dir_name
            try:
                self.ftp.cwd(current_dir)
            except ftplib.error_perm:
                try:
                    self.ftp.mkd(current_dir)
                    logger.info(f"Created remote directory: {current_dir}")
                except:
                    pass
    
    def upload_deals(self, deals_data: List[Dict]) -> bool:
        """
        Upload local deals to FTP server
        
        Args:
            deals_data: List of deal dictionaries
            
        Returns:
            True if upload successful, False otherwise
        """
        if not self.connect():
            return False
        
        try:
            # Generate filename with user ID and timestamp
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            filename = f"deals_{self.user_id}_{timestamp}.json"
            
            # Add sync metadata to each deal
            for deal in deals_data:
                if 'sync_metadata' not in deal:
                    deal['sync_metadata'] = {}
                deal['sync_metadata']['last_synced'] = datetime.now().isoformat()
                deal['sync_metadata']['synced_by'] = self.user_id
            
            # Create a sync manifest that includes active deal IDs for this user
            # This helps track deletions
            sync_manifest = {
                'user_id': self.user_id,
                'timestamp': datetime.now().isoformat(),
                'active_deal_ids': [d['id'] for d in deals_data if d.get('owned_by') == self.user_id],
                'deleted_deals': self._get_deleted_deals(),  # Track deleted deals with timestamps
                'deals': deals_data
            }
            
            # Create temporary file
            with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as tmp_file:
                json.dump(sync_manifest, tmp_file, indent=2, default=str)
                tmp_filename = tmp_file.name
            
            # Upload file
            with open(tmp_filename, 'rb') as file:
                self.ftp.storbinary(f'STOR {filename}', file)
                logger.info(f"Successfully uploaded {filename}")
            
            # Clean up temp file
            os.unlink(tmp_filename)
            
            # Clean up old files if configured
            if self.sync_settings.get('keep_days'):
                self._cleanup_old_files()
            
            # Log the sync
            self._log_sync_action('upload', filename, len(deals_data))
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to upload deals: {str(e)}")
            return False
        finally:
            self.disconnect()
    
    def download_and_merge_deals(self, current_deals: List[Dict]) -> Tuple[List[Dict], Dict]:
        """
        Download deals from other team members and merge with current deals
        
        Args:
            current_deals: Current local deals
            
        Returns:
            Tuple of (merged_deals, sync_report)
        """
        if not self.connect():
            return current_deals, {'error': 'Failed to connect to FTP'}
        
        sync_report = {
            'files_processed': 0,
            'new_deals': 0,
            'updated_deals': 0,
            'deleted_deals': 0,
            'conflicts': [],
            'errors': []
        }
        
        try:
            # Get list of files on FTP
            files = self.ftp.nlst()
            
            # Filter for deal files from other users
            deal_files = [f for f in files if f.startswith('deals_') and f.endswith('.json')]
            other_user_files = [f for f in deal_files if not f.startswith(f'deals_{self.user_id}_')]
            
            logger.info(f"Found {len(deal_files)} total deal files, {len(other_user_files)} from other users")
            
            # Get previously synced files
            synced_files = self._get_synced_files()
            
            # Process each file
            for filename in other_user_files:
                if filename in synced_files:
                    logger.info(f"Skipping already synced file: {filename}")
                    continue  # Skip already processed files
                
                logger.info(f"Processing file: {filename}")
                
                try:
                    # Download file to temp location
                    with tempfile.NamedTemporaryFile(mode='wb', suffix='.json', delete=False) as tmp_file:
                        self.ftp.retrbinary(f'RETR {filename}', tmp_file.write)
                        tmp_filename = tmp_file.name
                    
                    # Read and parse JSON
                    with open(tmp_filename, 'r') as file:
                        remote_data = json.load(file)
                    
                    # Handle both old format (list of deals) and new format (manifest with deals)
                    if isinstance(remote_data, dict) and 'deals' in remote_data:
                        # New format with manifest
                        remote_deals = remote_data['deals']
                        remote_user = remote_data.get('user_id')
                        active_deal_ids = remote_data.get('active_deal_ids', [])
                        remote_deleted_deals = remote_data.get('deleted_deals', [])
                    else:
                        # Old format - just a list of deals
                        remote_deals = remote_data
                        remote_user = None
                        active_deal_ids = None
                        remote_deleted_deals = []
                    
                    # Merge deals
                    current_deals, merge_stats = self._merge_deals(
                        current_deals, 
                        remote_deals,
                        filename,
                        remote_user,
                        active_deal_ids,
                        remote_deleted_deals
                    )
                    
                    # Update sync report
                    sync_report['files_processed'] += 1
                    sync_report['new_deals'] += merge_stats['new']
                    sync_report['updated_deals'] += merge_stats['updated']
                    if 'deleted' in merge_stats:
                        sync_report['deleted_deals'] = sync_report.get('deleted_deals', 0) + merge_stats['deleted']
                    sync_report['conflicts'].extend(merge_stats['conflicts'])
                    
                    # Mark file as synced
                    self._mark_file_synced(filename)
                    
                    # Clean up temp file
                    os.unlink(tmp_filename)
                    
                except Exception as e:
                    logger.error(f"Error processing {filename}: {str(e)}")
                    sync_report['errors'].append(f"Failed to process {filename}: {str(e)}")
            
            return current_deals, sync_report
            
        except Exception as e:
            logger.error(f"Failed to download and merge deals: {str(e)}")
            sync_report['errors'].append(str(e))
            return current_deals, sync_report
        finally:
            self.disconnect()
    
    def _merge_deals(self, local_deals: List[Dict], remote_deals: List[Dict], source_file: str, 
                     remote_user: str = None, active_deal_ids: List[str] = None,
                     remote_deleted_deals: List[Dict] = None) -> Tuple[List[Dict], Dict]:
        """
        Merge remote deals with local deals and handle deletions
        
        Args:
            local_deals: Current local deals
            remote_deals: Deals from remote file
            source_file: Name of the source file
            remote_user: User ID who created the sync file
            active_deal_ids: List of deal IDs that are still active for the remote user
            remote_deleted_deals: List of deals deleted by the remote user
            
        Returns:
            Tuple of (merged_deals, merge_statistics)
        """
        merge_stats = {'new': 0, 'updated': 0, 'deleted': 0, 'conflicts': [], 'skipped_deleted': 0}
        local_deals_dict = {deal['id']: deal for deal in local_deals}
        
        # Get local deleted deals list
        local_deleted_deals = self._get_deleted_deals()
        local_deleted_ids = {d['deal_id'] for d in local_deleted_deals}
        
        # Also track remote deleted deals
        if remote_deleted_deals:
            for deleted_deal in remote_deleted_deals:
                if deleted_deal['deal_id'] not in local_deleted_ids:
                    # Track this deletion locally too
                    self._save_deleted_deal(deleted_deal['deal_id'], deleted_deal['deleted_by'])
                    local_deleted_ids.add(deleted_deal['deal_id'])
        
        for remote_deal in remote_deals:
            deal_id = remote_deal.get('id')
            if not deal_id:
                continue
            
            # Skip if this deal has been deleted locally
            if deal_id in local_deleted_ids:
                merge_stats['skipped_deleted'] += 1
                logger.info(f"Skipping deal {deal_id} - marked as deleted")
                continue
            
            if deal_id not in local_deals_dict:
                # New deal - add it, preserving ownership from source
                remote_deal['sync_metadata'] = remote_deal.get('sync_metadata', {})
                remote_deal['sync_metadata']['imported_from'] = source_file
                remote_deal['sync_metadata']['imported_at'] = datetime.now().isoformat()
                
                # Ensure ownership fields are preserved from the source
                if 'owned_by' not in remote_deal and 'created_by' in remote_deal:
                    remote_deal['owned_by'] = remote_deal['created_by']
                    
                local_deals.append(remote_deal)
                merge_stats['new'] += 1
                logger.info(f"Added new deal from {remote_deal.get('owned_by', 'unknown')}: {remote_deal.get('customerName', remote_deal.get('company_name', 'Unknown'))}")
                
            else:
                # Existing deal - check for updates
                local_deal = local_deals_dict[deal_id]
                should_update, conflict_info = self._should_update_deal(local_deal, remote_deal)
                
                if should_update:
                    # Merge the deals
                    merged_deal = self._merge_deal_fields(local_deal, remote_deal)
                    merged_deal['sync_metadata'] = merged_deal.get('sync_metadata', {})
                    merged_deal['sync_metadata']['last_merged'] = datetime.now().isoformat()
                    merged_deal['sync_metadata']['merged_from'] = source_file
                    
                    # Update in the list
                    for i, deal in enumerate(local_deals):
                        if deal['id'] == deal_id:
                            local_deals[i] = merged_deal
                            break
                    
                    merge_stats['updated'] += 1
                    logger.info(f"Updated deal: {merged_deal.get('company_name', 'Unknown')}")
                    
                elif conflict_info:
                    merge_stats['conflicts'].append(conflict_info)
        
        # Handle deletions if we have the active_deal_ids list
        if remote_user and active_deal_ids is not None:
            # Find deals owned by the remote user that are not in their active list
            deals_to_remove = []
            for deal in local_deals:
                if (deal.get('owned_by') == remote_user and 
                    deal['id'] not in active_deal_ids and
                    deal['id'] not in local_deleted_ids):  # Don't remove if already tracked as deleted
                    # This deal was deleted by the remote user
                    deals_to_remove.append(deal['id'])
                    merge_stats['deleted'] += 1
                    # Track this deletion
                    self._save_deleted_deal(deal['id'], remote_user)
                    logger.info(f"Removing deleted deal: {deal.get('customerName', 'Unknown')} (owned by {remote_user})")
            
            # Remove the deleted deals
            if deals_to_remove:
                local_deals = [d for d in local_deals if d['id'] not in deals_to_remove]
        
        return local_deals, merge_stats
    
    def _should_update_deal(self, local_deal: Dict, remote_deal: Dict) -> Tuple[bool, Optional[Dict]]:
        """
        Determine if a remote deal should update the local deal
        
        Args:
            local_deal: Local deal data
            remote_deal: Remote deal data
            
        Returns:
            Tuple of (should_update, conflict_info)
        """
        strategy = self.sync_settings.get('conflict_strategy', 'newest_wins')
        
        local_updated = local_deal.get('updated_at', local_deal.get('created_at', ''))
        remote_updated = remote_deal.get('updated_at', remote_deal.get('created_at', ''))
        
        # Log for debugging
        logger.info(f"Comparing deal {local_deal.get('id')}: local_updated={local_updated}, remote_updated={remote_updated}")
        
        if strategy == 'newest_wins':
            if remote_updated > local_updated:
                logger.info(f"Remote deal is newer, will update")
                return True, None
            elif remote_updated == local_updated:
                # Same timestamp - check if content differs
                if self._deals_differ(local_deal, remote_deal):
                    logger.warning(f"Same timestamp but different content for deal {local_deal.get('id')}")
                    # For same timestamp, merge the changes anyway
                    return True, {
                        'deal_id': local_deal['id'],
                        'company': local_deal.get('customerName', local_deal.get('company_name', 'Unknown')),
                        'local_updated': local_updated,
                        'remote_updated': remote_updated,
                        'type': 'same_timestamp_different_content'
                    }
            return False, None
            
        elif strategy == 'merge_all':
            # Always merge, combining fields intelligently
            return True, None
        
        return False, None
    
    def _deals_differ(self, deal1: Dict, deal2: Dict) -> bool:
        """Check if two deals have different content (excluding metadata)"""
        exclude_fields = ['sync_metadata', 'updated_at', 'notes']
        
        for key in deal1.keys():
            if key in exclude_fields:
                continue
            if deal1.get(key) != deal2.get(key):
                return True
        return False
    
    def _merge_deal_fields(self, local_deal: Dict, remote_deal: Dict) -> Dict:
        """
        Intelligently merge fields from remote deal into local deal
        
        Args:
            local_deal: Local deal data
            remote_deal: Remote deal data
            
        Returns:
            Merged deal
        """
        merged = local_deal.copy()
        
        # Always take the newer updated_at timestamp
        if remote_deal.get('updated_at', '') > local_deal.get('updated_at', ''):
            merged['updated_at'] = remote_deal['updated_at']
        
        # Preserve ownership fields - these should never be overwritten
        if 'owned_by' in local_deal:
            merged['owned_by'] = local_deal['owned_by']
        elif 'owned_by' in remote_deal:
            merged['owned_by'] = remote_deal['owned_by']
            
        if 'created_by' in local_deal:
            merged['created_by'] = local_deal['created_by']
        elif 'created_by' in remote_deal:
            merged['created_by'] = remote_deal['created_by']
        
        # Merge notes - combine unique notes from both
        local_notes = local_deal.get('notes', [])
        remote_notes = remote_deal.get('notes', [])
        merged_notes = self._merge_notes(local_notes, remote_notes)
        merged['notes'] = merged_notes
        
        # For other fields, use the newest based on updated_at
        if remote_deal.get('updated_at', '') > local_deal.get('updated_at', ''):
            # Take all fields from remote except notes (already merged)
            for key, value in remote_deal.items():
                if key not in ['notes', 'sync_metadata']:
                    merged[key] = value
        
        # Special handling for financial year and date_won
        if remote_deal.get('date_won') and not local_deal.get('date_won'):
            merged['date_won'] = remote_deal['date_won']
            merged['financial_year'] = remote_deal.get('financial_year')
        
        return merged
    
    def _merge_notes(self, local_notes: List[Dict], remote_notes: List[Dict]) -> List[Dict]:
        """Merge notes from local and remote, avoiding duplicates"""
        merged = local_notes.copy()
        local_note_ids = {note.get('id') for note in local_notes if note.get('id')}
        
        for remote_note in remote_notes:
            if remote_note.get('id') not in local_note_ids:
                merged.append(remote_note)
        
        # Sort by timestamp
        merged.sort(key=lambda x: x.get('timestamp', ''), reverse=True)
        return merged
    
    def _cleanup_old_files(self):
        """Keep only the 10 most recent sync files per user"""
        try:
            max_files_per_user = 10  # Maximum number of sync files to keep per user
            
            files = self.ftp.nlst()
            
            # Get all sync files for the current user
            user_files = []
            for filename in files:
                if filename.startswith(f'deals_{self.user_id}_'):
                    # Parse timestamp from filename
                    try:
                        parts = filename.replace('.json', '').split('_')
                        if len(parts) >= 3:
                            date_str = parts[2]
                            time_str = parts[3] if len(parts) > 3 else '000000'
                            file_date = datetime.strptime(f"{date_str}_{time_str}", '%Y%m%d_%H%M%S')
                            user_files.append((filename, file_date))
                    except Exception as e:
                        logger.warning(f"Could not parse date from filename {filename}: {e}")
            
            # Sort by date (newest first)
            user_files.sort(key=lambda x: x[1], reverse=True)
            
            # Delete files beyond the limit
            if len(user_files) > max_files_per_user:
                files_to_delete = user_files[max_files_per_user:]
                for filename, file_date in files_to_delete:
                    try:
                        self.ftp.delete(filename)
                        logger.info(f"Deleted old sync file (keeping only {max_files_per_user} most recent): {filename}")
                    except Exception as e:
                        logger.error(f"Failed to delete {filename}: {e}")
                        
        except Exception as e:
            logger.error(f"Error during cleanup: {str(e)}")
    
    def _log_sync_action(self, action: str, filename: str, deal_count: int):
        """Log sync actions for audit trail"""
        log_entry = {
            'timestamp': datetime.now().isoformat(),
            'action': action,
            'filename': filename,
            'user_id': self.user_id,
            'deal_count': deal_count
        }
        
        # Load existing log
        sync_log = []
        if os.path.exists(self.sync_log_file):
            try:
                with open(self.sync_log_file, 'r') as f:
                    sync_log = json.load(f)
            except:
                pass
        
        # Add new entry
        sync_log.append(log_entry)
        
        # Keep only last 100 entries
        sync_log = sync_log[-100:]
        
        # Save log
        os.makedirs(os.path.dirname(self.sync_log_file), exist_ok=True)
        with open(self.sync_log_file, 'w') as f:
            json.dump(sync_log, f, indent=2)
    
    def _get_synced_files(self) -> set:
        """Get list of previously synced files"""
        synced_files_path = 'data/synced_files.json'
        if os.path.exists(synced_files_path):
            try:
                with open(synced_files_path, 'r') as f:
                    return set(json.load(f))
            except:
                pass
        return set()
    
    def _mark_file_synced(self, filename: str):
        """Mark a file as synced to avoid reprocessing"""
        synced_files_path = 'data/synced_files.json'
        synced = self._get_synced_files()
        synced.add(filename)
        
        # Keep only filenames from last 30 days
        cutoff = datetime.now() - timedelta(days=30)
        filtered = set()
        for f in synced:
            try:
                parts = f.replace('.json', '').split('_')
                if len(parts) >= 3:
                    date_str = parts[2]
                    file_date = datetime.strptime(date_str, '%Y%m%d')
                    if file_date >= cutoff:
                        filtered.add(f)
            except:
                filtered.add(f)  # Keep if can't parse date
        
        os.makedirs('data', exist_ok=True)
        with open(synced_files_path, 'w') as f:
            json.dump(list(filtered), f, indent=2)
    
    def _get_deleted_deals(self) -> List[Dict]:
        """Get list of deleted deals with timestamps"""
        deleted_deals_file = os.path.join('data', 'deleted_deals.json')
        if os.path.exists(deleted_deals_file):
            try:
                with open(deleted_deals_file, 'r') as f:
                    return json.load(f)
            except:
                pass
        return []
    
    def _save_deleted_deal(self, deal_id: str, user_id: str):
        """Save a deleted deal to the tracking file"""
        deleted_deals_file = os.path.join('data', 'deleted_deals.json')
        deleted_deals = self._get_deleted_deals()
        
        # Add the new deletion
        deleted_deals.append({
            'deal_id': deal_id,
            'deleted_by': user_id,
            'deleted_at': datetime.now().isoformat()
        })
        
        # Keep only deletions from last 30 days
        cutoff = datetime.now() - timedelta(days=30)
        deleted_deals = [d for d in deleted_deals 
                        if datetime.fromisoformat(d['deleted_at']) > cutoff]
        
        # Save the updated list
        os.makedirs('data', exist_ok=True)
        with open(deleted_deals_file, 'w') as f:
            json.dump(deleted_deals, f, indent=2)
    
    def get_sync_status(self) -> Dict:
        """Get current sync status and statistics"""
        status = {
            'configured': bool(self.ftp_config.get('host')),
            'user_id': self.user_id,
            'team_members': self.team_ids,
            'last_sync': None,
            'sync_history': []
        }
        
        # Get last sync from log
        if os.path.exists(self.sync_log_file):
            try:
                with open(self.sync_log_file, 'r') as f:
                    sync_log = json.load(f)
                    if sync_log:
                        status['last_sync'] = sync_log[-1]['timestamp']
                        status['sync_history'] = sync_log[-10:]  # Last 10 entries
            except:
                pass
        
        return status