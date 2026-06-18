import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.registerShortcut("ctrl+alt+o", {
    description: "Open current directory in Zed",
    handler: async (ctx) => {
      const result = await pi.exec("zed", [ctx.cwd], { cwd: ctx.cwd, timeout: 5000 });

      if (result.code === 0) {
        ctx.ui.notify("Opened current directory in Zed", "info");
      } else {
        ctx.ui.notify(result.stderr.trim() || "Failed to open current directory in Zed", "error");
      }
    },
  });
}
