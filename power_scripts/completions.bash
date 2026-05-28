# gettree — no args needed, but completes cleanly
complete -f gettree

# gitsetup — completes the --y flag
_gitsetup_completions() {
    local cur="${COMP_WORDS[COMP_CWORD]}"
    COMPREPLY=($(compgen -W "--y" -- "$cur"))
}
complete -F _gitsetup_completions gitsetup

# kbm — keyboard binding manager
_kbm_completions() {
    local cur prev
    cur="${COMP_WORDS[COMP_CWORD]}"
    prev="${COMP_WORDS[COMP_CWORD-1]}"

    if [[ "$prev" == "sync" ]]; then
        COMPREPLY=($(compgen -W "-d --delete" -- "$cur"))
        return
    fi

    COMPREPLY=($(compgen -W "sync validate list help" -- "$cur"))
}
complete -F _kbm_completions kbm
