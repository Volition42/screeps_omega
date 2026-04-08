function dashboardUrl() {
  const serverUrl = process.env.SCREEPS_SERVER_PUBLIC_URL || process.env.SCREEPS_SERVER_URL || "";
  return serverUrl ? `${serverUrl}/web/` : "/web/";
}

function omegaAdminUrl() {
  const serverUrl = process.env.SCREEPS_SERVER_PUBLIC_URL || process.env.SCREEPS_SERVER_URL || "";
  return serverUrl ? `${serverUrl}/omega-admin/` : "/omega-admin/";
}

export async function register({ koa }) {
  koa.use(async (context, next) => {
    if (context.path === "/web" || context.path === "/web/") {
      context.status = 302;
      context.redirect(dashboardUrl());
      return;
    }

    if (
      context.path === "/web/omega-admin" ||
      context.path === "/web/omega-admin/" ||
      context.path === "/omega-admin" ||
      context.path === "/omega-admin/"
    ) {
      context.status = 302;
      context.redirect(omegaAdminUrl());
      return;
    }

    if (context.path.startsWith("/omega-admin/")) {
      context.status = 302;
      context.redirect(omegaAdminUrl());
      return;
    }

    const wrappedAdminMatch = context.path.match(/^\/\((https?:\/\/[^)]+\/omega-admin\/?)\)\/?$/);
    if (wrappedAdminMatch) {
      context.status = 302;
      context.redirect(omegaAdminUrl());
      return;
    }

    await next();

    if (
      typeof context.body === "string" &&
      context.body.includes("</body>") &&
      !context.body.includes("omega-admin-shortcut")
    ) {
      const shortcut = `
<style>
.omega-admin-shortcut {
  position: fixed;
  right: 18px;
  bottom: 18px;
  z-index: 9999;
  padding: 11px 16px;
  border-radius: 999px;
  border: 1px solid #254f3f;
  background: #254f3f;
  color: #f7f2e8;
  font: 600 14px/1 "Avenir Next", "Segoe UI", sans-serif;
  text-decoration: none;
  box-shadow: 0 10px 24px rgba(25, 41, 34, 0.22);
}
</style>
<a class="omega-admin-shortcut" href="${omegaAdminUrl()}">Omega Admin</a>
</body>`;
      context.body = context.body.replace("</body>", shortcut);
    }
  });
}
