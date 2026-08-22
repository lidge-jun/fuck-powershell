// @ts-check
import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

export default defineConfig({
  site: "https://lidge-jun.github.io",
  base: "/fuck-powershell/",
  trailingSlash: "always",
  integrations: [
    starlight({
      title: "fuck-powershell",
      description:
        "A reproducible-case archive of PowerShell landmines: where POSIX assumptions explode.",
      social: [
        { icon: "github", label: "GitHub", href: "https://github.com/lidge-jun/fuck-powershell" },
      ],
      sidebar: [
        { label: "Start", items: [
          { label: "About", link: "/" },
          { label: "Case schema", slug: "schema" },
          { label: "Install the skill", slug: "skill" },
        ]},
        { label: "Cases", items: [{ autogenerate: { directory: "cases" } }] },
      ],
    }),
  ],
});
