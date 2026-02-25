#!/bin/bash
# Ralph Health Monitor - checks on running Ralph loop agents
# Run via cron or heartbeat

WORKSPACE="${WORKSPACE:-/data/.openclaw/workspace}"
LOG_DIR="$WORKSPACE/.ralphy-logs"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Ralph Health: $*"
}

# Check if any Ralph loops are running
check_processes() {
    local running=0
    local stalled=0
    local done=0
    
    # Check for running processes (adapt to your spawn method)
    # This is a simplified version
    
    # Check log files for activity
    if [[ -d "$LOG_DIR" ]]; then
        local latest_log=$(ls -t "$LOG_DIR"/iteration-*.log 2>/dev/null | head -1)
        
        if [[ -n "$latest_log" ]]; then
            local mod_time=$(stat -c %Y "$latest_log" 2>/dev/null || stat -f %m "$latest_log" 2>/dev/null)
            local now=$(date +%s)
            local age=$((now - mod_time))
            
            if [[ $age -lt 300 ]]; then
                log "Active: Latest iteration log is ${age}s old"
                running=1
            elif [[ $age -lt 600 ]]; then
                log "Stalled: No activity in $age seconds"
                stalled=1
            fi
        fi
        
        # Check for completion
        if grep -q "RALPHY_COMPLETE" "$LOG_DIR"/iteration-*.log 2>/dev/null; then
            log "Done: Ralph loop completed"
            done=1
        fi
    fi
    
    # Check for notifications
    if [[ -f "$LOG_DIR/notifications.log" ]]; then
        local last_notify=$(tail -1 "$LOG_DIR/notifications.log")
        log "Last notification: $last_notify"
    fi
    
    # Output status
    if [[ $done -eq 1 ]]; then
        echo "status=done"
        return 0
    elif [[ $stalled -eq 1 ]]; then
        echo "status=stalled"
        return 2
    elif [[ $running -eq 1 ]]; then
        echo "status=running"
        return 0
    else
        echo "status=idle"
        return 1
    fi
}

# Main
log "Running Ralph health check..."

# Check for workspace
if [[ ! -d "$WORKSPACE" ]]; then
    log "ERROR: Workspace not found: $WORKSPACE"
    exit 1
fi

# Run check
check_processes
exit_code=$?

if [[ $exit_code -eq 0 ]]; then
    log "Health check OK"
elif [[ $exit_code -eq 2 ]]; then
    log "WARNING: Ralph loop appears stalled"
    # Could trigger restart here
else
    log "No active Ralph loops"
fi

exit $exit_code
