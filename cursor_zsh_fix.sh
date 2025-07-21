#!/bin/bash

# Cursor Terminal Hanging Fix for macOS + Zsh + Powerlevel10k
# This script automatically applies the fix to your .zshrc file

echo "🔧 Cursor Terminal Hanging Fix - Zsh + Powerlevel10k Edition"
echo "=========================================================="

# Check if we're on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo "❌ This fix is specifically for macOS. You're running: $OSTYPE"
    exit 1
fi

# Check if zsh is the current shell
if [[ "$SHELL" != *"zsh"* ]]; then
    echo "❌ This fix is for Zsh. Your current shell is: $SHELL"
    echo "💡 Switch to Zsh first: chsh -s $(which zsh)"
    exit 1
fi

# Check if .zshrc exists
if [[ ! -f ~/.zshrc ]]; then
    echo "❌ .zshrc file not found. Please set up Zsh first."
    exit 1
fi

echo "✅ macOS + Zsh detected"

# Backup existing .zshrc
backup_file="$HOME/.zshrc.backup.$(date +%Y%m%d_%H%M%S)"
cp ~/.zshrc "$backup_file"
echo "📂 Backup created: $backup_file"

# Check if fix is already applied
if grep -q "TERM_PROGRAM.*vscode" ~/.zshrc; then
    echo "⚠️  Fix appears to already be applied. Skipping..."
    echo "📍 If you're still having issues, manually check your .zshrc file"
    exit 0
fi

# Create the fix configuration
fix_config=$(cat << 'EOF'

# ============================================================
# Cursor Terminal Fix - Added by cursor_zsh_fix.sh
# Prevents terminal hanging in Cursor Agent Mode
# ============================================================

# Set Oh My Zsh theme conditionally based on terminal environment
if [[ "$TERM_PROGRAM" == "vscode" ]]; then
    # Running inside Cursor/VS Code - disable complex themes
    ZSH_THEME=""
    
    # Optional: Show detection message (remove if annoying)
    # echo "🔧 Cursor detected - using minimal prompt"
else
    # Running in regular terminal - use your preferred theme
    ZSH_THEME="powerlevel10k/powerlevel10k"
fi

# Note: Make sure 'source $ZSH/oh-my-zsh.sh' comes AFTER the theme setting above

# Configure prompts based on environment
if [[ "$TERM_PROGRAM" == "vscode" ]]; then
    # Minimal prompt for Cursor - clean and fast
    PROMPT='%F{cyan}%n%f@%F{green}%m%f:%F{blue}%~%f%# '
    RPROMPT=''  # Clear right prompt
    
    # Optional: Add git branch info (comment out if you don't want it)
    autoload -Uz vcs_info
    precmd_vcs_info() { vcs_info }
    precmd_functions+=( precmd_vcs_info )
    zstyle ':vcs_info:git:*' formats ' (%F{yellow}%b%f)'
    setopt PROMPT_SUBST
    PROMPT='%F{cyan}%n%f@%F{green}%m%f:%F{blue}%~%f${vcs_info_msg_0_}%# '
    
    # Disable complex features that might cause issues
    unsetopt correct_all
    unsetopt share_history
else
    # Load Powerlevel10k configuration for other terminals
    [[ -f ~/.p10k.zsh ]] && source ~/.p10k.zsh
fi

# ============================================================
# End of Cursor Terminal Fix
# ============================================================

EOF
)

# Add the fix to .zshrc
echo "$fix_config" >> ~/.zshrc

echo ""
echo "✅ Fix successfully applied to ~/.zshrc"
echo ""
echo "📋 What was added:"
echo "   • Conditional theme loading (simple for Cursor, P10k for others)"
echo "   • Minimal prompt with optional git branch info"
echo "   • Disabled potentially problematic zsh features in Cursor"
echo ""
echo "🔄 Next steps:"
echo "   1. Restart Cursor completely"
echo "   2. Open a new terminal in Cursor"
echo "   3. Test running commands - they should no longer hang!"
echo ""
echo "🎨 Your other terminals (iTerm2, etc.) will still use Powerlevel10k"
echo ""
echo "🔙 To rollback: cp $backup_file ~/.zshrc && source ~/.zshrc"

# Test if Cursor is currently running
if pgrep -x "Cursor" > /dev/null; then
    echo ""
    echo "⚠️  Cursor is currently running. Please restart it to apply changes."
fi

echo ""
echo "🎉 Done! The terminal hanging issue should now be resolved." 