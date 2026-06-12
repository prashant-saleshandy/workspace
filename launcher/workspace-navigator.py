#!/usr/bin/env python3
"""
Workspace Navigator with hierarchical browsing
Press Ctrl+Shift+K to open
Enter = Navigate into folder
Ctrl+Enter = Open in selected editor
Ctrl+Shift+N = Create new folder
"""

import json
import os
import subprocess
import tkinter as tk
from pathlib import Path
from tkinter import font as tkfont
from tkinter import ttk


class WorkspaceNavigator:
    def __init__(self):
        self.root = tk.Tk()
        self.root.title("Workspace Navigator")
        self.root.configure(bg="#1e1e1e")

        # Base path
        self.base_path = Path("/home/prashant/prashant-workspace/saleshandy")
        self.current_path = self.base_path
        self.history = []

        # Config
        self.config_path = Path.home() / ".config/workspace-navigator/config.json"
        self.editor_var = tk.StringVar(value="zed")

        # Variables
        self.search_var = tk.StringVar()
        self.current_selection = 0
        self.filtered_items = []
        self.creating_new_folder = False
        self.new_folder_entry = None

        self.load_config()

        self.setup_ui()
        self.setup_global_bindings()
        self.load_current_directory()

    # ---------------- CONFIG ---------------- #

    def load_config(self):
        try:
            if self.config_path.exists():
                with open(self.config_path) as f:
                    config = json.load(f)
                    self.editor_var.set(config.get("editor", "zed"))
        except Exception:
            pass

    def save_config(self):
        try:
            self.config_path.parent.mkdir(parents=True, exist_ok=True)

            with open(self.config_path, "w") as f:
                json.dump({"editor": self.editor_var.get()}, f)
        except Exception:
            pass

    # ---------------- UI ---------------- #

    def setup_ui(self):
        window_width = 900
        window_height = 650
        screen_width = self.root.winfo_screenwidth()
        screen_height = self.root.winfo_screenheight()

        x = (screen_width - window_width) // 2
        y = (screen_height - window_height) // 2

        self.root.geometry(f"{window_width}x{window_height}+{x}+{y}")

        main_frame = tk.Frame(self.root, bg="#1e1e1e", padx=15, pady=15)
        main_frame.pack(fill=tk.BOTH, expand=True)

        # Path label
        self.path_label = tk.Label(
            main_frame,
            text="",
            bg="#1e1e1e",
            fg="#808080",
            font=("Arial", 10),
            anchor="w",
        )
        self.path_label.pack(fill=tk.X, pady=(0, 10))

        # Search
        self.search_entry = tk.Entry(
            main_frame,
            textvariable=self.search_var,
            bg="#2d2d2d",
            fg="#ffffff",
            insertbackground="#ffffff",
            font=("Arial", 14),
            relief=tk.FLAT,
            highlightthickness=2,
            highlightbackground="#3d3d3d",
            highlightcolor="#007acc",
        )
        self.search_entry.pack(fill=tk.X, pady=(0, 15), ipady=8)

        self.search_var.trace("w", lambda *args: self.filter_items())

        # Listbox
        listbox_frame = tk.Frame(main_frame, bg="#1e1e1e")
        listbox_frame.pack(fill=tk.BOTH, expand=True)

        self.listbox = tk.Listbox(
            listbox_frame,
            bg="#252526",
            fg="#cccccc",
            selectbackground="#094771",
            selectforeground="#ffffff",
            font=("Consolas", 11),
            activestyle="none",
            relief=tk.FLAT,
            highlightthickness=0,
        )
        self.listbox.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

        scrollbar = tk.Scrollbar(
            listbox_frame,
            orient="vertical",
            command=self.listbox.yview,
        )
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)

        self.listbox.configure(yscrollcommand=scrollbar.set)

        # Bottom section
        bottom_frame = tk.Frame(main_frame, bg="#1e1e1e")
        bottom_frame.pack(fill=tk.X, pady=(15, 0))

        help_frame = tk.Frame(bottom_frame, bg="#1e1e1e")
        help_frame.pack(side=tk.LEFT)

        editor_frame = tk.Frame(bottom_frame, bg="#1e1e1e")
        editor_frame.pack(side=tk.RIGHT)

        help_texts = [
            "↑↓ Navigate",
            "Enter Open",
            "Ctrl+Enter Open Editor",
            "Ctrl+Shift+N New Folder",
            "Backspace Back",
            "Esc Close",
        ]

        for text in help_texts:
            label = tk.Label(
                help_frame,
                text=text,
                bg="#1e1e1e",
                fg="#808080",
                font=("Arial", 9),
            )
            label.pack(side=tk.LEFT, padx=(0, 20))

        # Editor selector
        tk.Label(
            editor_frame,
            text="Editor:",
            bg="#1e1e1e",
            fg="#808080",
            font=("Arial", 9),
        ).pack(side=tk.LEFT, padx=(0, 5))

        def create_editor_button(text, value):
            btn = tk.Radiobutton(
                editor_frame,
                text=text,
                variable=self.editor_var,
                value=value,
                command=self.save_config,
                indicatoron=False,  # removes radio circle
                bd=0,
                highlightthickness=0,
                padx=12,
                pady=4,
                bg="#1e1e1e",
                fg="#cccccc",
                selectcolor="#007acc",
                activebackground="#2d2d2d",
                activeforeground="#ffffff",
                font=("Arial", 9),
            )

            btn.pack(side=tk.LEFT, padx=4)

            # Hover effect
            def on_enter(e):
                btn.config(bg="#2d2d2d")

            def on_leave(e):
                btn.config(bg="#1e1e1e")

            btn.bind("<Enter>", on_enter)
            btn.bind("<Leave>", on_leave)

            return btn

        create_editor_button("Zed", "zed")
        create_editor_button("VS Code", "vscode")

        # Bindings
        self.listbox.bind("<<ListboxSelect>>", self.on_listbox_select)

        self.search_entry.focus()

    # ---------------- KEY BINDINGS ---------------- #

    def setup_global_bindings(self):
        self.root.bind("<Return>", self.on_enter)
        self.root.bind("<Control-Return>", self.on_ctrl_enter)

        self.root.bind("<Up>", self.move_up)
        self.root.bind("<Down>", self.move_down)

        self.root.bind("<Escape>", lambda e: self.root.destroy())

        self.root.bind("<BackSpace>", self.go_back)

        self.root.bind("<Control-Shift-N>", self.create_new_folder)

    # ---------------- DIRECTORY ---------------- #

    def load_current_directory(self):
        self.items = []

        try:
            for item in sorted(self.current_path.iterdir()):
                if item.is_dir() and not item.name.startswith("."):
                    self.items.append(item)
        except Exception as e:
            print(e)

        self.update_path_label()
        self.filter_items()

    def update_path_label(self):
        rel_path = self.current_path.relative_to(self.base_path.parent)
        self.path_label.config(text=f"📁 {rel_path}")

    # ---------------- FILTER ---------------- #

    def filter_items(self):
        query = self.search_var.get().lower()

        if not query:
            self.filtered_items = self.items
        else:
            self.filtered_items = [
                item for item in self.items if query in item.name.lower()
            ]

        self.listbox.delete(0, tk.END)

        for item in self.filtered_items:
            self.listbox.insert(tk.END, f"📂 {item.name}")

        if self.filtered_items:
            self.current_selection = 0
            self.listbox.selection_set(0)

    # ---------------- NAVIGATION ---------------- #

    def on_listbox_select(self, event):
        selection = self.listbox.curselection()
        if selection:
            self.current_selection = selection[0]

    def move_up(self, event):
        if not self.filtered_items:
            return

        self.current_selection = max(0, self.current_selection - 1)

        self.listbox.selection_clear(0, tk.END)
        self.listbox.selection_set(self.current_selection)
        self.listbox.see(self.current_selection)

        return "break"

    def move_down(self, event):
        if not self.filtered_items:
            return

        self.current_selection = min(
            len(self.filtered_items) - 1, self.current_selection + 1
        )

        self.listbox.selection_clear(0, tk.END)
        self.listbox.selection_set(self.current_selection)
        self.listbox.see(self.current_selection)

        return "break"

    # ---------------- OPEN FOLDER ---------------- #

    def on_enter(self, event=None):
        # If a new folder input is active, confirm creation instead
        if self.new_folder_entry is not None:
            self.confirm_new_folder()
            return "break"

        if not self.filtered_items:
            return "break"

        selected_path = self.filtered_items[self.current_selection]

        self.history.append(self.current_path)
        self.current_path = selected_path

        self.search_var.set("")
        self.load_current_directory()

        return "break"

    # ---------------- OPEN EDITOR ---------------- #

    def on_ctrl_enter(self, event=None):
        if not self.filtered_items:
            return "break"

        selected_path = self.filtered_items[self.current_selection]

        editor = self.editor_var.get()

        if editor == "zed":
            commands = [
                "/home/prashant/.local/bin/zed",
                "zed",
                "/usr/local/bin/zed",
                "/opt/zed/zed",
            ]
        else:
            commands = [
                "code",
                "/usr/bin/code",
                "/snap/bin/code",
            ]

        for cmd in commands:
            try:
                subprocess.Popen(
                    [cmd, str(selected_path)],
                    start_new_session=True,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                )

                self.root.destroy()
                return "break"

            except FileNotFoundError:
                continue

        return "break"

    # ---------------- NEW FOLDER ---------------- #

    def create_new_folder(self, event=None):
        # Don't open a second input if one is already open
        if self.new_folder_entry is not None:
            return "break"

        # Insert a placeholder row at the top of the listbox
        self.listbox.insert(0, "")
        self.listbox.see(0)

        # Calculate the row height from the listbox font
        row_height = (
            tkfont.Font(font=self.listbox.cget("font")).metrics("linespace") + 6
        )

        # Overlay an Entry widget on top of that first row
        self.new_folder_entry = tk.Entry(
            self.listbox,
            bg="#1e3a52",
            fg="#ffffff",
            insertbackground="#ffffff",
            font=("Consolas", 11),
            relief=tk.FLAT,
            highlightthickness=1,
            highlightcolor="#007acc",
            highlightbackground="#007acc",
        )

        self.new_folder_entry.place(x=2, y=2, relwidth=1, width=-4, height=row_height)
        self.new_folder_entry.insert(0, "📂 ")
        self.new_folder_entry.icursor(tk.END)
        self.new_folder_entry.focus_set()

        # Bind keys ONLY on the entry widget — not on root
        self.new_folder_entry.bind(
            "<Return>", lambda e: (self.confirm_new_folder(), "break")
        )
        self.new_folder_entry.bind("<Escape>", lambda e: self.cancel_new_folder())

        # Block root-level <Return> from firing while input is open
        self.root.bind("<Return>", lambda e: "break")

        return "break"

    def confirm_new_folder(self):
        if self.new_folder_entry is None:
            return

        raw = self.new_folder_entry.get()

        # Strip the folder emoji prefix we inserted
        folder_name = raw.replace("📂 ", "").replace("📂", "").strip()

        self._cleanup_new_folder_entry()

        if folder_name:
            new_path = self.current_path / folder_name
            try:
                new_path.mkdir(parents=False, exist_ok=False)
            except FileExistsError:
                pass  # folder already exists, silently ignore
            except Exception as e:
                print(f"Could not create folder: {e}")

        self._restore_enter_binding()
        self.load_current_directory()
        self.search_entry.focus_set()

    def cancel_new_folder(self):
        self._cleanup_new_folder_entry()
        self._restore_enter_binding()
        self.load_current_directory()
        self.search_entry.focus_set()

    def _restore_enter_binding(self):
        self.root.bind("<Return>", self.on_enter)

    def _cleanup_new_folder_entry(self):
        if self.new_folder_entry is not None:
            self.new_folder_entry.destroy()
            self.new_folder_entry = None
        # Remove the placeholder row we inserted at index 0
        try:
            self.listbox.delete(0)
        except Exception:
            pass

    # ---------------- BACK ---------------- #

    def go_back(self, event=None):
        # If folder input is active, let Backspace work normally inside it
        if (
            self.new_folder_entry is not None
            and self.new_folder_entry.focus_get() == self.new_folder_entry
        ):
            return  # don't intercept

        if self.history:
            self.current_path = self.history.pop()

            self.search_var.set("")
            self.load_current_directory()

        return "break"

    # ---------------- RUN ---------------- #

    def run(self):
        self.root.mainloop()


def main():
    app = WorkspaceNavigator()
    app.run()


if __name__ == "__main__":
    main()
