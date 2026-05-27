# gettree — no args needed, but completes cleanly
complete -f gettree

# gitsetup — completes the --y flag
_gitsetup_completions() {
    local cur="${COMP_WORDS[COMP_CWORD]}"
    COMPREPLY=($(compgen -W "--y" -- "$cur"))
}
complete -F _gitsetup_completions gitsetup
