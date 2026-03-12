#!/bin/bash
# Ralph Health Monitor - checks on running Ralph loop agents
# Run via cron or heartbeat

set -euo pipefail

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

# PID-based health check (moved above first call)
check_pid() {
    local pid_file="$WORKSPACE/.ralphy-logs/ralphy.pid"
    
    if [[ -f "$pid_file" ]]; then
        local pid=$(cat "$pid_file")
        
        if [[ -n "$pid" && "$pid" =~ ^[0-9]+$ ]]; then
            # Check if process exists
            if kill -0 "$pid" 2>/dev/null; then
                # Verify it's a ralph process
                local cmdline=$(cat /proc/$pid/cmdline 2>/dev/null | tr '\0' ' ')
                if echo "$cmdline" | grep -q "ralphy"; then
                    log "PID check OK: $pid is running"
                    return 0
                else
                    log "PID $pid exists but is not a ralph process: $cmdline"
                    return 1
                fi
            else
                log "PID $pid from file is not running (stale PID file)"
                return 1
            fi
        else
            log "Invalid PID in file: $pid"
            return 1
        fi
    fi
    
    # No PID file - check if ralph is running anyway
    local ralph_pids=$(pgrep -f "ralphy.sh" 2>/dev/null || true)
    if [[ -n "$ralph_pids" ]]; then
        log "Ralph running (no PID file): $ralph_pids"
        return 0
    fi
    
    return 1
}

# Main
log "Running Ralph health check..."

# Check PID first (if available)
if check_pid; then
    pid_status="ok"
fi

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
