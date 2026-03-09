#!/bin/bash
# Ralph Loop Wrapper - runs coding agent until PRD tasks are complete
# Usage: ./ralphy.sh --prd PRD.md --model codex --workspace /path/to/project

set -euo pipefail

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

# Resolve and validate PRD path is inside workspace
WORKSPACE_REAL=$(realpath "$WORKSPACE")
PRD_PATH=$(realpath -m "$WORKSPACE/$PRD_FILE")
if [[ "$PRD_PATH" != "$WORKSPACE_REAL"/* ]]; then
    echo "Error: --prd path escapes workspace boundary"
    exit 1
fi
if [[ ! -f "$PRD_PATH" ]]; then
    echo "Error: PRD file not found: $PRD_PATH"
    exit 1
fi

# Normalize PRD_FILE to workspace-relative for downstream logic
PRD_FILE="${PRD_PATH#$WORKSPACE_REAL/}"

# Verify PRD file ownership (security check)
PRD_OWNER=$(stat -c '%u' "$PRD_PATH" 2>/dev/null || echo "unknown")
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

# Initialize logging directory FIRST (before any log() calls)
LOG_DIR="$WORKSPACE/.ralphy-logs"
AUDIT_LOG="$HOME/.ralphy-logs/bypass_audit.log"

# Setup log directory
mkdir -p "$LOG_DIR"
chmod 700 "$LOG_DIR"
cd "$WORKSPACE"

# Logging functions (defined before first use)
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

verbose() {
    if [[ $VERBOSE -eq 1 ]]; then
        log "VERBOSE: $*"
    fi
}

# Audit logging for bypass activation
log_bypass_audit() {
    local reason="$1"
    mkdir -p "$(dirname "$AUDIT_LOG")"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] USER=$(whoami) PID=$$ REASON=$reason CMD=$0 $*" >> "$AUDIT_LOG"
    chmod 600 "$AUDIT_LOG" 2>/dev/null || true
}

# Resolve codius binary path (supports optional override)
resolve_codius_bin() {
    local candidate="${CODIUS_BIN:-}"

    if [[ -n "$candidate" ]]; then
        if [[ ! -x "$candidate" ]]; then
            echo "Error: CODIUS_BIN is set but not executable: $candidate"
            exit 1
        fi
        echo "$candidate"
        return 0
    fi

    candidate="$(command -v codius 2>/dev/null || true)"
    if [[ -z "$candidate" ]]; then
        echo "Error: codius binary not found in PATH"
        echo "Install codius or set CODIUS_BIN=/absolute/path/to/codius"
        exit 1
    fi

    echo "$candidate"
}

CODIUS_CMD="$(resolve_codius_bin)"
log "Using codius binary: $CODIUS_CMD"

# Derived values (after LOG_DIR is set)
SESSION_NAME="ralphy-$(date +%s)"
PID_FILE="$LOG_DIR/ralphy.pid"
ITERATION=0
STALL_COUNT=0
PREV_TASK_COUNT=0

# Cleanup PID file on exit
trap 'rm -f "$PID_FILE"' EXIT

# Write PID file
echo $$ > "$PID_FILE"
log "PID file created: $PID_FILE"

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

# Security: Scan PRD for dangerous patterns (ALWAYS run, even in unsafe mode)
PRD_HAS_DANGERS=false
if ! scan_prd_for_dangers "$PRD_FILE"; then
    PRD_HAS_DANGERS=true
    log "SECURITY WARNING: Dangerous patterns detected in PRD"
fi

# Human approval gate - prevent automated execution without review
if is_unsafe_allowed; then
    # Audit log the bypass activation
    log_bypass_audit "RALPHY_ALLOW_UNSAFE=1" "$@"
    
    # Startup banner - clear warning that unsafe mode is active
    echo ""
    echo "========================================"
    echo "⚠️  UNSAFE MODE ACTIVE"
    echo "========================================"
    echo "Autonomous coding will proceed without interactive confirmation"
    if [[ "$PRD_HAS_DANGERS" == "true" ]]; then
        echo "SECURITY: Dangerous patterns detected (logged to audit)"
        log "SECURITY: Proceeding despite dangerous patterns (unsafe mode)"
    fi
    echo "AUDIT: Human approval prompt SKIPPED"
    echo "Use ONLY in trusted environments"
    echo "Audit log: $AUDIT_LOG"
    echo "========================================"
    echo ""
    log "BYPASS: RALPHY_ALLOW_UNSAFE=1 set, skipping approval prompt (PRD scan still ran)"
elif [[ -t 0 ]]; then
    echo "========================================"
    echo "About to execute PRD: $PRD_FILE"
    echo "Workspace: $WORKSPACE"
    echo "Model: $MODEL"
    echo "========================================"
    if [[ "$PRD_HAS_DANGERS" == "true" ]]; then
        echo "⚠️  WARNING: PRD contains dangerous patterns"
    fi
    read -p "Continue? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log "Aborted by user"
        exit 0
    fi
else
    log "ERROR: Non-interactive mode requires RALPHY_ALLOW_UNSAFE=1"
    echo "ERROR: Running in non-interactive mode without approval bypass"
    echo "Set RALPHY_ALLOW_UNSAFE=1 to bypass (use with caution)"
    exit 1
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
    timeout 600 "$CODIUS_CMD" exec --full-auto "$prompt" 2>&1 | tee "$iteration_log" || {
        log "Warning: Agent exited with code $?"
    }
    
    # Small delay before checking status
    sleep $ITERATION_DELAY
done

log "ERROR: Max iterations reached ($MAX_ITERATIONS)"
notify "Ralph loop maxed out: $PRD_FILE reached $MAX_ITERATIONS iterations" "error"
exit 1

# ========== SECURITY: PRD Content Scanner ==========
# Scans PRD for dangerous patterns before execution

scan_prd_for_dangers() {
    local prd_file="$1"
    local dangerous_patterns="curl.*\|wget.*\|ssh.*\|scp.*\|rm -rf\|mkfs\|dd.*of=\|:(){:|:&}:\|eval|exec.*bash\|chmod 777\|chown.*root\|sudo|sudoers|/etc/passwd|/etc/shadow"
    
    if grep -qiE "$dangerous_patterns" "$prd_file" 2>/dev/null; then
        echo "[SECURITY] WARNING: Potentially dangerous patterns detected in PRD"
        grep -iE "$dangerous_patterns" "$prd_file" | head -5
        return 1
    fi
    return 0
}

# Check if unsafe operations are allowed
is_unsafe_allowed() {
    [[ "${RALPHY_ALLOW_UNSAFE:-0}" == "1" ]]
}
