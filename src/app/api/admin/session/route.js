import { requireAdmin } from "@/lib/admin-auth";

export const runtime = "nodejs";

export async function GET(request) {
  const admin = await requireAdmin(request);
  return Response.json(admin ? { authenticated: true, admin: { email: admin.email } } : { authenticated: false });
}
