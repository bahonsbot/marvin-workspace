#!/bin/bash
# Ralph Loop Wrapper - runs coding agent until PRD tasks are complete
# Usage: ./ralphy.sh --prd PRD.md --model codex --workspace /path/to/project

set -e

# Defaults
MODEL="codex"
WORKSPACE=$(pwd)
MAX_ITERATIONS=10
ITERATION_DELAY=5
STALL_THRESHOLD=3
VERBOSE=0

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --prd)
            PRD_FILE="$2"
            shift 2
            ;;
        --model)
            MODEL="$2"
            shift 2
            ;;
        --workspace|-C)
            WORKSPACE="$2"
            shift 2
            ;;
        --max-iterations)
            MAX_ITERATIONS="$2"
            shift 2
            ;;
        --delay)
            ITERATION_DELAY="$2"
            shift 2
            ;;
        --verbose|-v)
            VERBOSE=1
            shift
            ;;
        --help|-h)
            echo "Usage: $0 --prd PRD.md [options]"
            echo ""
            echo "Options:"
            echo "  --prd FILE           PRD file with task checklist (required)"
            echo "  --model MODEL        Model to use: codex (default), minimax"
            echo "  --workspace,-C DIR   Working directory for the agent"
            echo "  --max-iterations N   Max loops before giving up (default: 10)"
            echo "  --delay SECONDS      Delay between iterations (default: 5)"
            echo "  --verbose,-v         Verbose output"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Validate required args
if [[ -z "$PRD_FILE" ]]; then
    echo "Error: --prd is required"
    exit 1
fi

if [[ ! -f "$WORKSPACE/$PRD_FILE" ]]; then
    echo "Error: PRD file not found: $WORKSPACE/$PRD_FILE"
    exit 1
fi

# Verify PRD file ownership (security check)
PRD_OWNER=$(stat -c '%u' "$WORKSPACE/$PRD_FILE" 2>/dev/null || echo "unknown")
CURRENT_USER=$(id -u)
if [[ "$PRD_OWNER" != "$CURRENT_USER" && "$PRD_OWNER" != "0" ]]; then
    echo "Warning: PRD file is owned by user ID $PRD_OWNER (running as $CURRENT_USER)"
    echo "This may indicate a permissions issue. Continue? (y/n)"
    read -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Derived values
SESSION_NAME="ralphy-$(date +%s)"
LOG_DIR="$WORKSPACE/.ralphy-logs"
ITERATION=0
STALL_COUNT=0
PREV_TASK_COUNT=0

# Setup
mkdir -p "$LOG_DIR"
cd "$WORKSPACE"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

verbose() {
    if [[ $VERBOSE -eq 1 ]]; then
        log "VERBOSE: $*"
    fi
}

# Extract task count from PRD
count_tasks() {
    grep -c "^\- \[ \]" "$WORKSPACE/$PRD_FILE" 2>/dev/null || echo "0"
}

# Extract completed task count
count_completed() {
    grep -c "^\- \[x\]" "$WORKSPACE/$PRD_FILE" 2>/dev/null || echo "0"
}

# Check if all tasks done
is_done() {
    local total=$(count_tasks)
    local done=$(count_completed)
    [[ $done -ge $total && $total -gt 0 ]]
}

# Build agent prompt
build_prompt() {
    cat << EOF
You are working on a coding task. Read the PRD at "$PRD_FILE" and complete all unchecked tasks.

For each task:
1. Implement the required functionality
2. If tests are part of the task, write failing tests FIRST, then implement to make them pass
3. After completing a task, mark it as done in the PRD with [x]
4. Run verification steps at the end to ensure everything works

Current status: $(count_completed)/$(count_tasks) tasks complete

When done with all tasks, reply with "RALPHY_COMPLETE" and summary of what was built.
EOF
}

# Notify on completion/error
notify() {
    local message="$1"
    local level="${2:-info}"
    
    # Try Telegram notification if available
    if [[ -x "$WORKSPACE/scripts/ralphy-notify.sh" ]]; then
        if [[ "$level" == "error" ]]; then
            "$WORKSPACE/scripts/ralphy-notify.sh" --urgent "🚨 Ralph Error: $message"
        else
            "$WORKSPACE/scripts/ralphy-notify.sh" "✅ $message"
        fi
    fi
    
    # Also write to notification file for monitoring
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [$level] $message" >> "$LOG_DIR/notifications.log"
}

# Main loop
log "Starting Ralph Loop for $PRD_FILE in $WORKSPACE"
log "Model: $MODEL, Max iterations: $MAX_ITERATIONS"

# Human approval gate - prevent automated execution without review
if [[ -t 0 ]]; then
    echo "========================================"
    echo "About to execute PRD: $PRD_FILE"
    echo "Workspace: $WORKSPACE"
    echo "Model: $MODEL"
    echo "========================================"
    read -p "Continue? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log "Aborted by user"
        exit 0
    fi
else
    log "WARNING: Running in non-interactive mode - skipping approval gate"
fi

while [[ $ITERATION -lt $MAX_ITERATIONS ]]; do
    ITERATION=$((ITERATION + 1))
    
    total_tasks=$(count_tasks)
    completed_tasks=$(count_completed)
    
    log "=== Iteration $ITERATION/$MAX_ITERATIONS ==="
    log "Progress: $completed_tasks/$total_tasks tasks complete"
    
    # Check if done
    if is_done; then
        log "All tasks completed!"
        notify "Ralph loop complete: $PRD_FILE finished in $ITERATION iterations" "success"
        exit 0
    fi
    
    # Check for stall
    if [[ $completed_tasks -eq $PREV_TASK_COUNT && $ITERATION -gt 1 ]]; then
        STALL_COUNT=$((STALL_COUNT + 1))
        log "WARNING: No progress detected (stall count: $STALL_COUNT/$STALL_THRESHOLD)"
        
        if [[ $STALL_COUNT -ge $STALL_THRESHOLD ]]; then
            log "ERROR: Agent stalled $STALL_THRESHOLD times in a row"
            notify "Ralph loop stalled: $PRD_FILE stuck at $completed_tasks/$total_tasks" "error"
            exit 1
        fi
    else
        STALL_COUNT=0
    fi
    
    PREV_TASK_COUNT=$completed_tasks
    
    # Run the agent
    prompt=$(build_prompt)
    iteration_log="$LOG_DIR/iteration-$ITERATION.log"
    
    log "Spawning Codex agent..."
    
    # Run Codex in background with PTY
    timeout 600 codius exec --full-auto "$prompt" 2>&1 | tee "$iteration_log" || {
        log "Warning: Agent exited with code $?"
    }
    
    # Small delay before checking status
    sleep $ITERATION_DELAY
done

log "ERROR: Max iterations reached ($MAX_ITERATIONS)"
notify "Ralph loop maxed out: $PRD_FILE reached $MAX_ITERATIONS iterations" "error"
exit 1
